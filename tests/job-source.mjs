import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { makeFakeJobSource, summarizeJobSource } from "../src/job-source.js";

const execFileAsync = promisify(execFile);

test.describe("job source abstraction", { concurrency: false }, () => {
  test("builds deterministic fake jobs", async () => {
    const fixture = JSON.parse(await readFile("tests/fixtures/job-source.clean.json", "utf8"));
    const source = makeFakeJobSource(fixture.jobs);
    const summary = summarizeJobSource(source, fixture.now_ts_unix);

    assert.equal(source.valid, true);
    assert.deepEqual(source.errors, []);
    assert.equal(source.templates.length, 2);
    assert.deepEqual(source.templates.map((job) => job.job_id), ["synthetic-job-1", "synthetic-job-2"]);
    assert.deepEqual(summary, {
      status: "ok",
      valid: true,
      total_jobs: 2,
      active_jobs: 2,
      stale_jobs: 0,
      error_count: 0,
      minimum_difficulty: 10,
      maximum_difficulty: 20,
      stale_reasons: []
    });
  });

  test("marks stale jobs with visible evidence", async () => {
    const fixture = JSON.parse(await readFile("tests/fixtures/job-source.stale.json", "utf8"));
    const source = makeFakeJobSource(fixture.jobs);
    const summary = summarizeJobSource(source, fixture.now_ts_unix);

    assert.equal(source.valid, true);
    assert.equal(summary.status, "attention");
    assert.equal(summary.total_jobs, 1);
    assert.equal(summary.active_jobs, 0);
    assert.equal(summary.stale_jobs, 1);
    assert.deepEqual(summary.stale_reasons, [{ job_id: "synthetic-job-stale", reason: "job_expired" }]);
  });

  test("rejects invalid fake jobs without hiding the reason", () => {
    const source = makeFakeJobSource([
      {
        job_id: "synthetic-job-bad",
        source: "fake",
        seed_hash: "",
        target: "00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        difficulty: 10,
        created_ts_unix: 1,
        expires_ts_unix: 2
      }
    ]);
    const summary = summarizeJobSource(source, 1);

    assert.equal(source.valid, false);
    assert.deepEqual(source.errors, [{ job_id: "synthetic-job-bad", reason: "missing_seed_hash" }]);
    assert.equal(summary.status, "attention");
    assert.equal(summary.error_count, 1);
    assert.equal(summary.total_jobs, 0);
  });

  test("writes a stable job source report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-job-source-"));
    const output = join(directory, "job-source.json");

    try {
      const { stdout } = await execFileAsync(execPath, [
        "scripts/report-job-source.mjs",
        "--in",
        "tests/fixtures/job-source.clean.json",
        "--out",
        output
      ]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /job\.source\.status=ok/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.source_kind, "fake");
      assert.equal(report.valid, true);
      assert.equal(report.summary.total_jobs, 2);
      assert.equal(report.summary.active_jobs, 2);
      assert.equal(report.summary.stale_jobs, 0);
      assert.equal(report.summary.minimum_difficulty, 10);
      assert.equal(report.summary.maximum_difficulty, 20);
      assert.deepEqual(report.errors, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
