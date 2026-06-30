import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execPath } from "node:process";
import { parseSessionEventJsonl, summarizeSessionEvents } from "../src/session-events.js";
import { projectSessionSummaryToReplayReport } from "../src/replay-projection.js";

const execFileAsync = promisify(execFile);

test.describe("session event parser", { concurrency: false }, () => {
  test("parses clean session event fixture and summarizes counters", async () => {
    const source = await readFile("tests/fixtures/session-events.clean.jsonl", "utf8");
    const result = parseSessionEventJsonl(source);
    const summary = summarizeSessionEvents(result.events);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.events.length, 5);
    assert.deepEqual(summary, {
      total_events: 5,
      session_started: 1,
      sample_observed: 1,
      unit_accepted: 1,
      unit_rejected: 1,
      session_exited: 1,
      launch_refused: 0,
      credited_units: 10,
      last_event: "session_exited"
    });
  });

  test("keeps raw rejected lines for audit", () => {
    const result = parseSessionEventJsonl([
      "not-json",
      JSON.stringify({ schema: 1, event: "missing", rig_id: "a960d-lab", ts_unix: 1 }),
      JSON.stringify({ schema: 1, event: "session_started", rig_id: "", ts_unix: 2 })
    ].join("\n"));

    assert.equal(result.valid, false);
    assert.equal(result.events.length, 0);
    assert.equal(result.errors.length, 3);
    assert.equal(result.errors[0].line_number, 1);
    assert.equal(result.errors[0].reason, "invalid_json");
    assert.equal(result.errors[0].raw_line, "not-json");
    assert.equal(result.errors[1].reason, "unknown_event");
    assert.equal(result.errors[2].reason, "missing_rig_id");
    assert.doesNotMatch(JSON.stringify(result), /undefined|NaN/);
  });

  test("writes a stable summary report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-session-report-"));
    const output = join(directory, "summary.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-session-events.mjs",
        "--in",
        "tests/fixtures/session-events.clean.jsonl",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /session\.report_status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.valid, true);
      assert.equal(report.valid_events, 5);
      assert.equal(report.invalid_events, 0);
      assert.equal(report.summary.unit_accepted, 1);
      assert.equal(report.summary.unit_rejected, 1);
      assert.equal(report.summary.credited_units, 10);
      assert.deepEqual(report.errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("projects summary report into replay-like counters", () => {
    const projected = projectSessionSummaryToReplayReport({
      schema: 1,
      status: "ok",
      source_path: "tests/fixtures/session-events.clean.jsonl",
      valid: true,
      summary: {
        unit_accepted: 1,
        unit_rejected: 1,
        credited_units: 10
      }
    });

    assert.deepEqual(projected, {
      schema: 1,
      status: "ok",
      source_schema: 1,
      source_path: "tests/fixtures/session-events.clean.jsonl",
      total_events: 2,
      accepted_events: 1,
      rejected_events: 1,
      credited_difficulty: 10,
      sessions: [{
        session_id: "fixture-session-1",
        accepted_shares: 1,
        rejected_shares: 1,
        credited_difficulty: 10
      }]
    });
  });

  test("writes a stable replay projection report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-replay-projection-"));
    const summaryOutput = join(directory, "summary.json");
    const projectionOutput = join(directory, "projection.json");

    try {
      await execFileAsync(execPath, [
        "scripts/report-session-events.mjs",
        "--in",
        "tests/fixtures/session-events.clean.jsonl",
        "--out",
        summaryOutput
      ]);
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-replay-projection.mjs",
        "--in",
        summaryOutput,
        "--out",
        projectionOutput
      ]);
      const report = JSON.parse(await readFile(projectionOutput, "utf8"));

      assert.match(stdout, /replay\.projection\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.total_events, 2);
      assert.equal(report.accepted_events, 1);
      assert.equal(report.rejected_events, 1);
      assert.equal(report.credited_difficulty, 10);
      assert.equal(report.sessions.length, 1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("compares projection counters against pool core fixture output", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-bridge-compare-"));
    const summaryOutput = join(directory, "summary.json");
    const projectionOutput = join(directory, "projection.json");
    const poolOutput = join(directory, "pool.json");
    const compareOutput = join(directory, "compare.json");

    try {
      await execFileAsync(execPath, [
        "scripts/report-session-events.mjs",
        "--in",
        "tests/fixtures/session-events.clean.jsonl",
        "--out",
        summaryOutput
      ]);
      await execFileAsync(execPath, [
        "scripts/report-replay-projection.mjs",
        "--in",
        summaryOutput,
        "--out",
        projectionOutput
      ]);
      const { stdout: poolStdout } = await execFileAsync("cargo", [
        "run",
        "--manifest-path",
        "crates/dbyte-pool-core/Cargo.toml",
        "--quiet",
        "--bin",
        "dbyte-pool-ledger-report",
        "--",
        "--fixture",
        "two-session"
      ]);
      await writeFile(poolOutput, poolStdout, "utf8");
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-bridge-compare.mjs",
        "--projection",
        projectionOutput,
        "--pool",
        poolOutput,
        "--out",
        compareOutput
      ]);
      const report = JSON.parse(await readFile(compareOutput, "utf8"));

      assert.match(stdout, /bridge\.compare\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.deepEqual(report.matches, {
        total_events: true,
        accepted_events: true,
        rejected_events: true,
        credited_difficulty: true
      });
      assert.equal(report.projection.credited_difficulty, 10);
      assert.equal(report.pool.credited_difficulty, 10);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
