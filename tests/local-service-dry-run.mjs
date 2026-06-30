import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { makeFakeJobSource } from "../src/job-source.js";
import { runLocalServiceDryRun } from "../src/local-service-dry-run.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";

const execFileAsync = promisify(execFile);

test.describe("local service dry run", { concurrency: false }, () => {
  test("runs synthetic fixture input without enabling a listener", async () => {
    const protocolSource = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const jobFixture = JSON.parse(await readFile("tests/fixtures/job-source.clean.json", "utf8"));
    const parsed = parseServiceProtocolJsonl(protocolSource);
    const jobSource = makeFakeJobSource(jobFixture.jobs);
    const dryRun = runLocalServiceDryRun({ messages: parsed.messages, jobSource, now_ts_unix: jobFixture.now_ts_unix });

    assert.equal(dryRun.valid, true);
    assert.equal(dryRun.status, "ok");
    assert.equal(dryRun.listener_enabled, false);
    assert.equal(dryRun.external_bind_enabled, false);
    assert.equal(dryRun.live_worker_intake_enabled, false);
    assert.equal(dryRun.startup.status, "ok");
    assert.equal(dryRun.shutdown.status, "ok");
    assert.equal(dryRun.counters.input_messages, 7);
    assert.equal(dryRun.counters.accepted_submits, 1);
    assert.equal(dryRun.counters.plan_rows, 1);
    assert.equal(dryRun.dashboard_projection.source, "report_files_only");
    assert.equal(dryRun.replayable, true);
  });

  test("records rate limited messages without opening runtime intake", async () => {
    const protocolSource = await readFile("tests/fixtures/service-protocol.clean.jsonl", "utf8");
    const parsed = parseServiceProtocolJsonl(protocolSource);
    const dryRun = runLocalServiceDryRun({
      messages: parsed.messages,
      jobSource: makeFakeJobSource([]),
      now_ts_unix: 100,
      limits: { max_messages_per_session: 3 }
    });

    assert.equal(dryRun.status, "attention");
    assert.equal(dryRun.listener_enabled, false);
    assert.equal(dryRun.counters.rate_limited_messages, 4);
    assert.equal(dryRun.counters.error_count, 0);
  });

  test("keeps malformed counters visible", () => {
    const dryRun = runLocalServiceDryRun({
      messages: [],
      malformed_count: 2,
      jobSource: makeFakeJobSource([]),
      now_ts_unix: 100
    });

    assert.equal(dryRun.status, "attention");
    assert.equal(dryRun.valid, false);
    assert.equal(dryRun.counters.malformed_messages, 2);
    assert.equal(dryRun.replayable, true);
  });

  test("writes a stable local dry run report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-local-dry-run-"));
    const output = join(directory, "local-dry-run.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-local-service-dry-run.mjs",
        "--protocol",
        "tests/fixtures/service-protocol.clean.jsonl",
        "--jobs",
        "tests/fixtures/job-source.clean.json",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /local\.dry_run\.status=ok/);
      assert.match(stdout, /local\.dry_run\.listener_enabled=false/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.dry_run_valid, true);
      assert.equal(report.listener_enabled, false);
      assert.equal(report.external_bind_enabled, false);
      assert.equal(report.live_worker_intake_enabled, false);
      assert.equal(report.counters.input_messages, 7);
      assert.equal(report.counters.error_count, 0);
      assert.equal(report.dashboard_projection.source, "report_files_only");
      assert.equal(report.replayable, true);
      assert.deepEqual(report.errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
