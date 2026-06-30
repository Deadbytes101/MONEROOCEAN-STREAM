import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { parseServiceProtocolJsonl, summarizeServiceProtocol } from "../src/service-protocol.js";

const execFileAsync = promisify(execFile);

test.describe("service protocol boundary", { concurrency: false }, () => {
  test("parses the clean synthetic worker flow", async () => {
    const source = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const result = parseServiceProtocolJsonl(source);
    const summary = summarizeServiceProtocol(result.messages);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.messages.length, 7);
    assert.deepEqual(summary, {
      total_messages: 7,
      connect: 1,
      authorize: 1,
      subscribe: 1,
      job: 1,
      submit: 1,
      accepted: 1,
      rejected: 0,
      disconnect: 1,
      credited_difficulty: 10,
      session_count: 1,
      last_message: "disconnect"
    });
  });

  test("parses the rejected synthetic worker flow", async () => {
    const source = await readFile("tests/fixtures/service-protocol.rejected.jsonl", "utf8");
    const result = parseServiceProtocolJsonl(source);
    const summary = summarizeServiceProtocol(result.messages);

    assert.equal(result.valid, true);
    assert.equal(summary.total_messages, 3);
    assert.equal(summary.connect, 1);
    assert.equal(summary.rejected, 1);
    assert.equal(summary.disconnect, 1);
    assert.equal(summary.accepted, 0);
    assert.equal(summary.credited_difficulty, 0);
    assert.equal(summary.session_count, 1);
  });

  test("keeps malformed protocol input as raw evidence", () => {
    const result = parseServiceProtocolJsonl([
      "not-json",
      JSON.stringify({ schema: 1, message: "mystery", session_id: "synthetic-session-x", ts_unix: 1 }),
      JSON.stringify({ schema: 1, message: "connect", session_id: "", ts_unix: 2 }),
      JSON.stringify({ schema: 1, message: "submit", session_id: "synthetic-session-x", job_id: "synthetic-job-x", ts_unix: 3 })
    ].join("\n"));

    assert.equal(result.valid, false);
    assert.equal(result.messages.length, 0);
    assert.equal(result.errors.length, 4);
    assert.equal(result.errors[0].reason, "invalid_json");
    assert.equal(result.errors[0].raw_line, "not-json");
    assert.equal(result.errors[1].reason, "unknown_message");
    assert.equal(result.errors[2].reason, "missing_session_id");
    assert.equal(result.errors[3].reason, "missing_nonce");
    assert.doesNotMatch(JSON.stringify(result), /undefined|NaN/);
  });

  test("writes a stable protocol summary report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-service-protocol-"));
    const output = join(directory, "protocol.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-service-protocol.mjs",
        "--in",
        "tests/fixtures/service-protocol.clean.jsonl",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /service\.protocol\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.valid, true);
      assert.equal(report.valid_messages, 7);
      assert.equal(report.invalid_messages, 0);
      assert.equal(report.summary.accepted, 1);
      assert.equal(report.summary.rejected, 0);
      assert.equal(report.summary.credited_difficulty, 10);
      assert.deepEqual(report.errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
