import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replaySessionRegistry } from "../src/session-registry.js";

const execFileAsync = promisify(execFile);

test.describe("session registry replay", { concurrency: false }, () => {
  test("replays the clean synthetic lifecycle", async () => {
    const source = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const parsed = parseServiceProtocolJsonl(source);
    const replay = replaySessionRegistry(parsed.messages);

    assert.equal(replay.valid, true);
    assert.deepEqual(replay.errors, []);
    assert.equal(replay.sessions.length, 1);
    assert.deepEqual(replay.summary, {
      session_count: 1,
      active_sessions: 0,
      closed_sessions: 1,
      rejected_sessions: 0,
      accepted: 1,
      rejected: 0,
      credited_difficulty: 10,
      error_count: 0
    });
    assert.deepEqual(replay.sessions[0], {
      session_id: "synthetic-session-1",
      state: "closed",
      account_id: "synthetic-account-a",
      worker: "synthetic-worker-a",
      job_id: "synthetic-job-1",
      accepted: 1,
      rejected: 0,
      credited_difficulty: 10,
      last_message: "disconnect"
    });
  });

  test("replays a rejected synthetic lifecycle", async () => {
    const source = await readFile("tests/fixtures/service-protocol.rejected.jsonl", "utf8");
    const parsed = parseServiceProtocolJsonl(source);
    const replay = replaySessionRegistry(parsed.messages);

    assert.equal(replay.valid, true);
    assert.equal(replay.sessions.length, 1);
    assert.equal(replay.sessions[0].state, "closed");
    assert.equal(replay.summary.rejected, 1);
    assert.equal(replay.summary.credited_difficulty, 0);
    assert.equal(replay.summary.error_count, 0);
  });

  test("rejects invalid transitions without mutating session state", () => {
    const parsed = parseServiceProtocolJsonl([
      JSON.stringify({ schema: 1, message: "connect", session_id: "synthetic-session-x", worker: "synthetic-worker-x", ts_unix: 1 }),
      JSON.stringify({ schema: 1, message: "submit", session_id: "synthetic-session-x", job_id: "synthetic-job-x", nonce: "00000002", share_difficulty: 10, ts_unix: 2 }),
      JSON.stringify({ schema: 1, message: "disconnect", session_id: "synthetic-session-x", reason: "operator_closed", ts_unix: 3 })
    ].join("\n"));
    const replay = replaySessionRegistry(parsed.messages);

    assert.equal(replay.valid, false);
    assert.equal(replay.errors.length, 1);
    assert.equal(replay.errors[0].reason, "submit_before_active");
    assert.equal(replay.sessions.length, 1);
    assert.equal(replay.sessions[0].state, "closed");
    assert.equal(replay.sessions[0].accepted, 0);
    assert.equal(replay.sessions[0].credited_difficulty, 0);
  });

  test("writes a stable registry report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-session-registry-"));
    const output = join(directory, "registry.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-session-registry.mjs",
        "--in",
        "tests/fixtures/service-protocol.clean.jsonl",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /session\.registry\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.input_valid, true);
      assert.equal(report.registry_valid, true);
      assert.equal(report.summary.session_count, 1);
      assert.equal(report.summary.closed_sessions, 1);
      assert.equal(report.summary.accepted, 1);
      assert.equal(report.summary.credited_difficulty, 10);
      assert.deepEqual(report.parse_errors, []);
      assert.deepEqual(report.registry_errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
