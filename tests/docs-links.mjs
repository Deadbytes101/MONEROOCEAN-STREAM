import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

test.describe("documentation links", { concurrency: false }, () => {
  test("docs README links the service evidence entry", async () => {
    const index = await readFile("docs/README.md", "utf8");

    assert.match(index, /SERVICE_EVIDENCE_INDEX\.md/);
    assert.match(index, /SERVICE_CAPABILITY_SCORECARD\.md|agent-docs\.md/);
    assert.match(index, /operator-runbook\.md/);
  });

  test("service evidence index links the main service documents", async () => {
    const index = await readFile("docs/SERVICE_EVIDENCE_INDEX.md", "utf8");

    assert.match(index, /SERVICE_CORE_SEQUENCE\.md/);
    assert.match(index, /SERVICE_CAPABILITY_SCORECARD\.md/);
    assert.match(index, /operator-runbook\.md/);
  });

  test("docs README local links resolve to files", async () => {
    await assertLocalMarkdownLinks("docs/README.md");
  });

  test("service evidence index local links resolve to files", async () => {
    await assertLocalMarkdownLinks("docs/SERVICE_EVIDENCE_INDEX.md");
  });

  test("operator runbook local links resolve to files", async () => {
    await assertLocalMarkdownLinks("docs/operator-runbook.md");
  });

  test("link classifier separates local anchors and protocols", () => {
    assert.equal(isLocalMarkdownHref("docs/README.md"), true);
    assert.equal(isLocalMarkdownHref("docs/README.md#testing"), true);
    assert.equal(isLocalMarkdownHref("#testing"), false);
    assert.equal(isLocalMarkdownHref("https://example.com"), false);
    assert.equal(isLocalMarkdownHref("mailto:ops@example.invalid"), false);

    assert.equal(hasProtocol("https://example.com"), true);
    assert.equal(hasProtocol("mailto:ops@example.invalid"), true);
    assert.equal(hasProtocol("docs/README.md"), false);
  });
});

async function assertLocalMarkdownLinks(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const hrefs = [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
  const unsupportedProtocolHrefs = hrefs.filter(
    (href) => hasProtocol(href) && !href.startsWith("http://") && !href.startsWith("https://"),
  );
  const links = hrefs.filter(isLocalMarkdownHref);

  assert.deepEqual(unsupportedProtocolHrefs, [], `${sourcePath} should not contain unsupported link protocols`);
  assert.ok(links.length > 0, `${sourcePath} should contain local links`);

  for (const href of links) {
    const cleanHref = href.split("#")[0];
    const target = normalize(join(dirname(sourcePath), cleanHref));
    const info = await stat(target);
    assert.equal(info.isFile(), true, `${sourcePath} local link must resolve: ${href}`);
  }
}

function isLocalMarkdownHref(href) {
  return Boolean(href) && !href.startsWith("#") && !hasProtocol(href);
}

function hasProtocol(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href);
}
