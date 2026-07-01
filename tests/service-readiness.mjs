import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { assessServiceReadiness } from "../src/service-readiness.js";

const execFileAsync = promisify(execFile);

test.describe("service readiness report", { concurrency: false }, () => {
  test("keeps the default readiness plan report-only and disabled", () => {
    const readiness = assessServiceReadiness();

    assert.equal(readiness.valid, true);
    assert.equal(readiness.status, "ok");
    assert.equal(readiness.mode, "phase_i_readiness_planning");
    assert.equal(readiness.config.enabled, false);
    assert.equal(readiness.config.mode, "local");
    assert.equal(readiness.checks.report_only, true);
    assert.equal(readiness.summary.runtime_enabled, false);
    assert.deepEqual(readiness.blockers, []);
  });

  test("keeps preflight evidence report-only with local defaults", () => {
    const readiness = assessServiceReadiness();

    assert.equal(readiness.preflight.status, "ok");
    assert.equal(readiness.preflight.enabled, false);
    assert.equal(readiness.preflight.endpoint, "127.0.0.1");
    assert.equal(readiness.preflight.port, 0);
    assert.equal(readiness.preflight.report_only, true);
    assert.equal(readiness.preflight.runtime_enabled, false);
    assert.equal(readiness.preflight.local_endpoint, true);
    assert.equal(readiness.summary.preflight_report_only, true);
  });

  test("keeps requested local preflight visible without enabling runtime", () => {
    const readiness = assessServiceReadiness({ config: { preflight: { enabled: true, endpoint: "127.0.0.1", port: 18080 } } });

    assert.equal(readiness.valid, true);
    assert.equal(readiness.status, "ok");
    assert.equal(readiness.preflight.enabled, true);
    assert.equal(readiness.preflight.endpoint, "127.0.0.1");
    assert.equal(readiness.preflight.port, 18080);
    assert.equal(readiness.preflight.runtime_enabled, false);
    assert.equal(readiness.summary.runtime_enabled, false);
    assert.equal(readiness.summary.preflight_enabled, true);
  });

  test("keeps the safety harness report-only and not started by default", () => {
    const readiness = assessServiceReadiness();

    assert.equal(readiness.safety_harness.status, "ok");
    assert.equal(readiness.safety_harness.enabled, false);
    assert.equal(readiness.safety_harness.endpoint, "127.0.0.1");
    assert.equal(readiness.safety_harness.port, 0);
    assert.equal(readiness.safety_harness.operator_approval_required, true);
    assert.equal(readiness.safety_harness.report_only, true);
    assert.equal(readiness.safety_harness.runtime_started, false);
    assert.equal(readiness.safety_harness.bind_implemented, false);
    assert.equal(readiness.safety_harness.local_endpoint, true);
    assert.equal(readiness.summary.safety_harness_runtime_started, false);
  });

  test("blocks requested safety harness enablement without starting runtime", () => {
    const readiness = assessServiceReadiness({ config: { safety_harness: { enabled: true, endpoint: "127.0.0.1", port: 18080 } } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.equal(readiness.safety_harness.enabled, true);
    assert.equal(readiness.safety_harness.runtime_started, false);
    assert.equal(readiness.safety_harness.bind_implemented, false);
    assert.equal(readiness.summary.runtime_enabled, false);
    assert.match(readiness.blockers.join("\n"), /safety_harness_must_remain_disabled/);
  });

  test("blocks non-local safety harness endpoints", () => {
    const readiness = assessServiceReadiness({ config: { safety_harness: { endpoint: "0.0.0.0", port: 18080 } } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.equal(readiness.safety_harness.local_endpoint, false);
    assert.equal(readiness.safety_harness.runtime_started, false);
    assert.equal(readiness.safety_harness.bind_implemented, false);
    assert.match(readiness.blockers.join("\n"), /safety_harness_endpoint_must_remain_local/);
  });

  test("blocks enabled runtime config in the readiness phase", () => {
    const readiness = assessServiceReadiness({ config: { enabled: true } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.equal(readiness.summary.runtime_enabled, false);
    assert.match(readiness.blockers.join("\n"), /runtime_must_remain_disabled/);
  });

  test("keeps non-local mode visible until acknowledgement exists", () => {
    const readiness = assessServiceReadiness({ config: { mode: "public" } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.match(readiness.blockers.join("\n"), /default_mode_must_remain_local/);
    assert.match(readiness.blockers.join("\n"), /non_local_mode_requires_visible_acknowledgement/);
  });

  test("blocks non-local preflight endpoints", () => {
    const readiness = assessServiceReadiness({ config: { preflight: { enabled: true, endpoint: "0.0.0.0", port: 18080 } } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.equal(readiness.preflight.local_endpoint, false);
    assert.equal(readiness.preflight.runtime_enabled, false);
    assert.match(readiness.blockers.join("\n"), /preflight_endpoint_must_remain_local/);
  });

  test("writes a stable service readiness report artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-service-readiness-"));
    const output = join(directory, "service-readiness.json");

    try {
      const { stdout } = await execFileAsync(execPath, ["scripts/report-service-readiness.mjs", "--out", output]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /service\.readiness\.status=ok/);
      assert.match(stdout, /service\.readiness\.runtime_enabled=false/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.readiness_valid, true);
      assert.equal(report.mode, "phase_i_readiness_planning");
      assert.equal(report.summary.report_only, true);
      assert.equal(report.summary.runtime_enabled, false);
      assert.equal(report.preflight.report_only, true);
      assert.equal(report.preflight.runtime_enabled, false);
      assert.equal(report.preflight.local_endpoint, true);
      assert.equal(report.safety_harness.report_only, true);
      assert.equal(report.safety_harness.runtime_started, false);
      assert.equal(report.safety_harness.bind_implemented, false);
      assert.equal(report.safety_harness.local_endpoint, true);
      assert.deepEqual(report.blockers, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("report command exits nonzero for blocked config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-service-readiness-blocked-"));
    const config = join(directory, "config.json");
    const output = join(directory, "service-readiness.json");

    try {
      await writeFile(config, `${JSON.stringify({ enabled: true }, null, 2)}\n`, "utf8");
      await assert.rejects(
        execFileAsync(execPath, ["scripts/report-service-readiness.mjs", "--config", config, "--out", output]),
        /Command failed/
      );
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.equal(report.status, "attention");
      assert.equal(report.readiness_valid, false);
      assert.match(report.blockers.join("\n"), /runtime_must_remain_disabled/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
