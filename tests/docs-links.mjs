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
});

async function assertLocalMarkdownLinks(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const links = [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((href) => href && !href.startsWith("http") && !href.startsWith("#"));

  assert.ok(links.length > 0, `${sourcePath} should contain local links`);

  for (const href of links) {
    const cleanHref = href.split("#")[0];
    const target = normalize(join(dirname(sourcePath), cleanHref));
    const info = await stat(target);
    assert.equal(info.isFile(), true, `${sourcePath} local link must resolve: ${href}`);
  }
}
