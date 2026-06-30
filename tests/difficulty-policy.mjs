import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { planDifficultyPolicy } from "../src/difficulty-policy.js";
import { makeFakeJobSource } from "../src/job-source.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replaySessionRegistry } from "../src/session-registry.js";

const execFileAsync = promisify(execFile);

test.describe("difficulty policy dry run", { concurrency: false }, () => {
  test("keeps a deterministic static assigned difficulty", async () => {
    const protocolSource = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const jobFixture = JSON.parse(await readFile("tests/fixtures/job-source.clean.json", "utf8"));
    const parsed = parseServiceProtocolJsonl(protocolSource);
    const registry = replaySessionRegistry(parsed.messages);
    const jobSource = makeFakeJobSource(jobFixture.jobs);
    const plan = planDifficultyPolicy({ sessions: registry.sessions, jobSource });

    assert.equal(plan.valid, true);
    assert.deepEqual(plan.policy, {
      mode: "static",
      dry_run: true,
      static_difficulty: 10,
      reason: "static_policy"
    });
    assert.equal(plan.assignments.length, 1);
    assert.deepEqual(plan.assignments[0], {
      session_id: "synthetic-session-1",
      worker: "synthetic-worker-a",
      state: "closed",
      assigned_difficulty: 10,
      recommended_difficulty: 10,
      action: "keep",
      reason: "static_policy",
      dry_run: true
    });
    assert.equal(plan.summary.recommended_changes, 0);
  });

  test("respects explicit assigned difficulty without retargeting", () => {
    const plan = planDifficultyPolicy({
      sessions: [{ session_id: "synthetic-session-x", worker: "synthetic-worker-x", state: "active", assigned_difficulty: 32 }],
      jobSource: makeFakeJobSource([]),
      policy: { static_difficulty: 8 }
    });

    assert.equal(plan.assignments[0].assigned_difficulty, 32);
    assert.equal(plan.assignments[0].recommended_difficulty, 32);
    assert.equal(plan.assignments[0].action, "keep");
    assert.equal(plan.summary.minimum_assigned_difficulty, 32);
    assert.equal(plan.summary.maximum_assigned_difficulty, 32);
    assert.equal(plan.summary.recommended_changes, 0);
  });

  test("is stable for empty session input", () => {
    const plan = planDifficultyPolicy({ sessions: [], jobSource: makeFakeJobSource([]), policy: { static_difficulty: 4 } });

    assert.equal(plan.valid, true);
    assert.deepEqual(plan.assignments, []);
    assert.deepEqual(plan.summary, {
      status: "ok",
      dry_run: true,
      policy_mode: "static",
      session_count: 0,
      recommended_changes: 0,
      minimum_assigned_difficulty: 0,
      maximum_assigned_difficulty: 0,
      reason_count: 0
    });
  });

  test("writes a stable difficulty policy report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-difficulty-policy-"));
    const output = join(directory, "difficulty-policy.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-difficulty-policy.mjs",
        "--protocol",
        "tests/fixtures/service-protocol.clean.jsonl",
        "--jobs",
        "tests/fixtures/job-source.clean.json",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /difficulty\.policy\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.input_valid, true);
      assert.equal(report.registry_valid, true);
      assert.equal(report.job_source_valid, true);
      assert.equal(report.policy_valid, true);
      assert.equal(report.summary.policy_mode, "static");
      assert.equal(report.summary.session_count, 1);
      assert.equal(report.summary.recommended_changes, 0);
      assert.equal(report.assignments[0].assigned_difficulty, 10);
      assert.deepEqual(report.parse_errors, []);
      assert.deepEqual(report.registry_errors, []);
      assert.deepEqual(report.job_errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
