import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { makeFakeJobSource } from "../src/job-source.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replayShareIntake } from "../src/share-intake.js";

const execFileAsync = promisify(execFile);

test.describe("share intake replay", { concurrency: false }, () => {
  test("accepts a clean synthetic submit", async () => {
    const protocolSource = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const jobFixture = JSON.parse(await readFile("tests/fixtures/job-source.clean.json", "utf8"));
    const parsed = parseServiceProtocolJsonl(protocolSource);
    const jobSource = makeFakeJobSource(jobFixture.jobs);
    const replay = replayShareIntake(parsed.messages, jobSource, jobFixture.now_ts_unix);

    assert.equal(replay.valid, true);
    assert.deepEqual(replay.summary, {
      total_submits: 1,
      accepted_submits: 1,
      rejected_submits: 0,
      credited_difficulty: 10,
      rejection_reasons: []
    });
    assert.equal(replay.outcomes[0].accepted, true);
    assert.equal(replay.outcomes[0].reason, "accepted");
    assert.equal(replay.outcomes[0].required_difficulty, 10);
    assert.equal(replay.outcomes[0].credited_difficulty, 10);
  });

  test("rejects stale jobs with visible evidence", async () => {
    const protocolSource = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const jobFixture = JSON.parse(await readFile("tests/fixtures/job-source.stale.json", "utf8"));
    const parsed = parseServiceProtocolJsonl(protocolSource);
    const jobSource = makeFakeJobSource(jobFixture.jobs);
    const replay = replayShareIntake(parsed.messages, jobSource, jobFixture.now_ts_unix);

    assert.equal(replay.summary.total_submits, 1);
    assert.equal(replay.summary.accepted_submits, 0);
    assert.equal(replay.summary.rejected_submits, 1);
    assert.equal(replay.outcomes[0].reason, "unknown_job");
    assert.equal(replay.outcomes[0].credited_difficulty, 0);
  });

  test("rejects low difficulty and duplicate submits", () => {
    const parsed = parseServiceProtocolJsonl([
      JSON.stringify({ schema: 1, message: "connect", session_id: "synthetic-session-x", worker: "synthetic-worker-x", ts_unix: 1 }),
      JSON.stringify({ schema: 1, message: "authorize", session_id: "synthetic-session-x", account_id: "synthetic-account-x", worker: "synthetic-worker-x", ts_unix: 2 }),
      JSON.stringify({ schema: 1, message: "subscribe", session_id: "synthetic-session-x", worker: "synthetic-worker-x", ts_unix: 3 }),
      JSON.stringify({ schema: 1, message: "job", session_id: "synthetic-session-x", job_id: "synthetic-job-1", difficulty: 10, ts_unix: 4 }),
      JSON.stringify({ schema: 1, message: "submit", session_id: "synthetic-session-x", job_id: "synthetic-job-1", nonce: "00000001", share_difficulty: 5, ts_unix: 5 }),
      JSON.stringify({ schema: 1, message: "submit", session_id: "synthetic-session-x", job_id: "synthetic-job-1", nonce: "00000002", share_difficulty: 10, ts_unix: 6 }),
      JSON.stringify({ schema: 1, message: "submit", session_id: "synthetic-session-x", job_id: "synthetic-job-1", nonce: "00000002", share_difficulty: 10, ts_unix: 7 })
    ].join("\n"));
    const jobSource = makeFakeJobSource([
      {
        job_id: "synthetic-job-1",
        source: "fake",
        seed_hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        target: "00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        difficulty: 10,
        created_ts_unix: 1,
        expires_ts_unix: 100
      }
    ]);
    const replay = replayShareIntake(parsed.messages, jobSource, 10);

    assert.equal(replay.summary.total_submits, 3);
    assert.equal(replay.summary.accepted_submits, 1);
    assert.equal(replay.summary.rejected_submits, 2);
    assert.equal(replay.summary.credited_difficulty, 10);
    assert.deepEqual(replay.summary.rejection_reasons.map((item) => item.reason), ["low_difficulty", "duplicate_submit"]);
  });

  test("writes a stable share intake report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-share-intake-"));
    const output = join(directory, "share-intake.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-share-intake.mjs",
        "--protocol",
        "tests/fixtures/service-protocol.clean.jsonl",
        "--jobs",
        "tests/fixtures/job-source.clean.json",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /share\.intake\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.input_valid, true);
      assert.equal(report.job_source_valid, true);
      assert.equal(report.intake_valid, true);
      assert.equal(report.summary.total_submits, 1);
      assert.equal(report.summary.accepted_submits, 1);
      assert.equal(report.summary.rejected_submits, 0);
      assert.equal(report.summary.credited_difficulty, 10);
      assert.deepEqual(report.parse_errors, []);
      assert.deepEqual(report.job_errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
