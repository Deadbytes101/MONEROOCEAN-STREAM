import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execPath } from "node:process";
import { parseBridgeLedgerText } from "../src/bridge-ledger-file.js";

const execFileAsync = promisify(execFile);

const VALID_SOURCE = `
# kind,wallet_or_session,worker_or_job,difficulty_or_nonce,optional_difficulty
session,wallet-one,worker-a,10
session,wallet-two,worker-b,10
job,1000,10
assign,1,1
assign,2,1
submit,2,1,7,10
submit,1,1,8,1
`;

test.describe("bridge file report", { concurrency: false }, () => {
  test("parses the bridge fixture into deterministic counters", () => {
    const parsed = parseBridgeLedgerText(VALID_SOURCE);

    assert.equal(parsed.valid, true);
    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(parsed.summary, {
      total_events: 2,
      accepted_events: 1,
      rejected_events: 1,
      credited_difficulty: 10,
      session_count: 2,
      job_count: 1,
      assignment_count: 2
    });
    assert.equal(parsed.submissions.length, 2);
    assert.equal(parsed.submissions[0].accepted, true);
    assert.equal(parsed.submissions[1].accepted, false);
  });

  test("rejects malformed bridge records without unsafe output", () => {
    const parsed = parseBridgeLedgerText([
      "session,wallet-one,worker-a,10",
      "job,1000,10",
      "submit,1,1,7,10",
      "unknown,row"
    ].join("\n"));

    assert.equal(parsed.valid, false);
    assert.equal(parsed.errors.length, 2);
    assert.equal(parsed.errors[0].reason, "unassigned_submit");
    assert.equal(parsed.errors[1].reason, "unknown_record");
    assert.doesNotMatch(JSON.stringify(parsed), /undefined|NaN/);
  });

  test("writes a stable bridge file report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-bridge-file-"));
    const output = join(directory, "bridge-file.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-bridge-file.mjs",
        "--in",
        "tests/fixtures/pool-core-bridge.ledger",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /bridge\.file\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.valid, true);
      assert.equal(report.summary.total_events, 2);
      assert.equal(report.summary.accepted_events, 1);
      assert.equal(report.summary.rejected_events, 1);
      assert.equal(report.summary.credited_difficulty, 10);
      assert.equal(report.summary.session_count, 2);
      assert.equal(report.summary.job_count, 1);
      assert.equal(report.summary.assignment_count, 2);
      assert.deepEqual(report.errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
