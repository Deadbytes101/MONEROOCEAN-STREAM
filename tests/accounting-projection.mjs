import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { projectAccounting } from "../src/accounting-projection.js";
import { makeFakeJobSource } from "../src/job-source.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replaySessionRegistry } from "../src/session-registry.js";
import { replayShareIntake } from "../src/share-intake.js";

const execFileAsync = promisify(execFile);

test.describe("accounting projection", { concurrency: false }, () => {
  test("projects accepted shares into stable account and worker rows", async () => {
    const protocolSource = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const jobFixture = JSON.parse(await readFile("tests/fixtures/job-source.clean.json", "utf8"));
    const parsed = parseServiceProtocolJsonl(protocolSource);
    const registry = replaySessionRegistry(parsed.messages);
    const jobSource = makeFakeJobSource(jobFixture.jobs);
    const intake = replayShareIntake(parsed.messages, jobSource, jobFixture.now_ts_unix);
    const projection = projectAccounting({ sessions: registry.sessions, outcomes: intake.outcomes, window: { window_id: "unit-window", start_ts_unix: 0, end_ts_unix: 100 } });

    assert.equal(projection.valid, true);
    assert.deepEqual(projection.window, { window_id: "unit-window", start_ts_unix: 0, end_ts_unix: 100 });
    assert.deepEqual(projection.summary, {
      status: "ok",
      total_credited_difficulty: 10,
      intake_credited_difficulty: 10,
      accepted_shares: 1,
      intake_accepted_submits: 1,
      rejected_shares: 0,
      worker_count: 1,
      group_count: 1,
      row_count: 1,
      value_movement_count: 0
    });
    assert.deepEqual(projection.rows[0], {
      account_id: "synthetic-account-a",
      worker: "synthetic-worker-a",
      session_count: 1,
      accepted_shares: 1,
      credited_difficulty: 10,
      value_movement: false,
      reason: "accounting_projection"
    });
    assert.equal(projection.checks.credited_matches_intake, true);
    assert.equal(projection.checks.no_value_movement, true);
  });

  test("keeps rejected shares visible without crediting them", () => {
    const projection = projectAccounting({
      sessions: [{ session_id: "session-a", account_id: "account-a", worker: "worker-a" }],
      outcomes: [
        { session_id: "session-a", accepted: true, credited_difficulty: 10 },
        { session_id: "session-a", accepted: false, credited_difficulty: 0, reason: "low_difficulty" }
      ],
      window: { window_id: "reject-window", start_ts_unix: 1, end_ts_unix: 2 }
    });

    assert.equal(projection.summary.total_credited_difficulty, 10);
    assert.equal(projection.summary.rejected_shares, 1);
    assert.equal(projection.rows.length, 1);
    assert.equal(projection.rows[0].credited_difficulty, 10);
    assert.equal(projection.checks.credited_matches_intake, true);
  });

  test("sorts rows by account and worker", () => {
    const projection = projectAccounting({
      sessions: [
        { session_id: "session-b", account_id: "account-b", worker: "worker-b" },
        { session_id: "session-a", account_id: "account-a", worker: "worker-a" }
      ],
      outcomes: [
        { session_id: "session-b", accepted: true, credited_difficulty: 20 },
        { session_id: "session-a", accepted: true, credited_difficulty: 10 }
      ]
    });

    assert.deepEqual(projection.rows.map((row) => `${row.account_id}/${row.worker}`), ["account-a/worker-a", "account-b/worker-b"]);
    assert.equal(projection.summary.total_credited_difficulty, 30);
    assert.equal(projection.summary.worker_count, 2);
    assert.equal(projection.summary.group_count, 2);
  });

  test("writes a stable accounting projection report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-accounting-projection-"));
    const output = join(directory, "accounting-projection.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-accounting-projection.mjs",
        "--protocol",
        "tests/fixtures/service-protocol.clean.jsonl",
        "--jobs",
        "tests/fixtures/job-source.clean.json",
        "--out",
        output,
        "--window-id",
        "test-window"
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /accounting\.projection\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.window.window_id, "test-window");
      assert.equal(report.summary.total_credited_difficulty, 10);
      assert.equal(report.summary.worker_count, 1);
      assert.equal(report.summary.group_count, 1);
      assert.equal(report.checks.no_value_movement, true);
      assert.equal(report.rows[0].value_movement, false);
      assert.deepEqual(report.parse_errors, []);
      assert.deepEqual(report.registry_errors, []);
      assert.deepEqual(report.job_errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
