import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

test.describe("documentation links", { concurrency: false }, () => {
  test("docs README links the service evidence entry", async () => {
    const index = await readFile("docs/README.md", "utf8");

    assert.match(index, /SERVICE_EVIDENCE_INDEX\.md/);
    assert.match(index, /SERVICE_SCORE_GAP\.md/);
    assert.match(index, /SERVICE_CAPABILITY_SCORECARD\.md|agent-docs\.md/);
    assert.match(index, /operator-runbook\.md/);
  });

  test("service evidence index links the main service documents", async () => {
    const index = await readFile("docs/SERVICE_EVIDENCE_INDEX.md", "utf8");

    assert.match(index, /SERVICE_CORE_SEQUENCE\.md/);
    assert.match(index, /SERVICE_CAPABILITY_SCORECARD\.md/);
    assert.match(index, /SERVICE_SCORE_GAP\.md/);
    assert.match(index, /operator-runbook\.md/);
  });

  test("score note states current score", async () => {
    const note = await readFile("docs/SERVICE_SCORE_GAP.md", "utf8");

    assert.match(note, /readiness_tier=phase_i_report_ready/);
    assert.match(note, /score=90/);
    assert.match(note, /max_score=100/);
    assert.match(note, /report_artifact_present=true/);
    assert.match(note, /local_verification_present=true/);
    assert.match(note, /dashboard_projection_present=true/);
    assert.match(note, /local evidence exists/);
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

  test("local link resolver ignores http links", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "docs-links-"));

    try {
      await writeFile(join(tempDir, "target.md"), "# Target\n");
      await writeFile(
        join(tempDir, "index.md"),
        "[local](target.md)\n[external](https://example.invalid/docs)\n",
      );

      await assertLocalMarkdownLinks(join(tempDir, "index.md"));
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test("local link resolver strips anchors before stat", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "docs-links-"));

    try {
      await writeFile(join(tempDir, "target.md"), "# Target\n");
      await writeFile(join(tempDir, "index.md"), "[local section](target.md#section)\n");

      await assertLocalMarkdownLinks(join(tempDir, "index.md"));
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test("local link resolver rejects empty links", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "docs-links-"));

    try {
      await writeFile(join(tempDir, "target.md"), "# Target\n");
      await writeFile(join(tempDir, "index.md"), "[local](target.md)\n[empty]()\n");

      await assert.rejects(
        () => assertLocalMarkdownLinks(join(tempDir, "index.md")),
        /empty link targets/,
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test("local link resolver rejects directory targets", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "docs-links-"));

    try {
      await mkdir(join(tempDir, "section"));
      await writeFile(join(tempDir, "target.md"), "# Target\n");
      await writeFile(join(tempDir, "index.md"), "[local](target.md)\n[directory](section)\n");

      await assert.rejects(
        () => assertLocalMarkdownLinks(join(tempDir, "index.md")),
        /local link must resolve/,
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test("local link resolver rejects traversal outside the root", async () => {
    const tempParent = await mkdtemp(join(tmpdir(), "docs-links-"));
    const rootDir = join(tempParent, "root");

    try {
      await mkdir(rootDir);
      await writeFile(join(tempParent, "outside.md"), "# Outside\n");
      await writeFile(join(rootDir, "index.md"), "[outside](../outside.md)\n");

      await assert.rejects(
        () => assertLocalMarkdownLinks(join(rootDir, "index.md")),
        /stay inside root/,
      );
    } finally {
      await rm(tempParent, { force: true, recursive: true });
    }
  });

  test("local link resolver rejects unsupported protocols", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "docs-links-"));

    try {
      await writeFile(join(tempDir, "target.md"), "# Target\n");
      await writeFile(join(tempDir, "index.md"), "[local](target.md)\n[mail](mailto:ops@example.invalid)\n");

      await assert.rejects(
        () => assertLocalMarkdownLinks(join(tempDir, "index.md")),
        /unsupported link protocols/,
      );
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});

async function assertLocalMarkdownLinks(sourcePath) {
  const source = await readFile(sourcePath, "utf8");
  const hrefs = [...source.matchAll(/\[[^\]]+\]\(([^)]*)\)/g)].map((match) => match[1]);
  const emptyHrefs = hrefs.filter((href) => !href);
  const unsupportedProtocolHrefs = hrefs.filter(
    (href) => hasProtocol(href) && !href.startsWith("http://") && !href.startsWith("https://"),
  );
  const links = hrefs.filter(isLocalMarkdownHref);
  const rootPath = linkRootFor(sourcePath);

  assert.deepEqual(emptyHrefs, [], `${sourcePath} should not contain empty link targets`);
  assert.deepEqual(unsupportedProtocolHrefs, [], `${sourcePath} should not contain unsupported link protocols`);
  assert.ok(links.length > 0, `${sourcePath} should contain local links`);

  for (const href of links) {
    const cleanHref = href.split("#")[0];
    const target = resolve(dirname(sourcePath), cleanHref);

    assert.equal(isInsideRoot(rootPath, target), true, `${sourcePath} local link must stay inside root: ${href}`);

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

function linkRootFor(sourcePath) {
  return resolve(isAbsolute(sourcePath) ? dirname(sourcePath) : ".");
}

function isInsideRoot(rootPath, targetPath) {
  const resolvedTarget = resolve(targetPath);
  const relativePath = relative(rootPath, resolvedTarget);

  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}
