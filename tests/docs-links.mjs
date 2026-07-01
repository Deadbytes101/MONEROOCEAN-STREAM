import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
});
