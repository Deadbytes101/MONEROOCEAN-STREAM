import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";
import { promisify } from "node:util";
import { buildServiceCapabilityScorecard } from "../src/service-capability-scorecard.js";
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

  test("keeps the launch contract report-only and not allowed by default", () => {
    const readiness = assessServiceReadiness();

    assert.equal(readiness.launch_contract.status, "ok");
    assert.equal(readiness.launch_contract.enabled, false);
    assert.equal(readiness.launch_contract.host, "127.0.0.1");
    assert.equal(readiness.launch_contract.port, 0);
    assert.equal(readiness.launch_contract.operator_approval_required, true);
    assert.equal(readiness.launch_contract.launch_allowed, false);
    assert.equal(readiness.launch_contract.report_only, true);
    assert.equal(readiness.launch_contract.runtime_started, false);
    assert.equal(readiness.launch_contract.bind_implemented, false);
    assert.equal(readiness.launch_contract.external_worker_intake, false);
    assert.equal(readiness.launch_contract.local_host, true);
    assert.equal(readiness.summary.launch_allowed, false);
    assert.equal(readiness.summary.launch_external_worker_intake, false);
  });

  test("blocks requested launch contract enablement without starting runtime", () => {
    const readiness = assessServiceReadiness({ config: { launch_contract: { enabled: true, host: "127.0.0.1", port: 18080 } } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.equal(readiness.launch_contract.enabled, true);
    assert.equal(readiness.launch_contract.launch_allowed, false);
    assert.equal(readiness.launch_contract.runtime_started, false);
    assert.equal(readiness.launch_contract.bind_implemented, false);
    assert.equal(readiness.launch_contract.external_worker_intake, false);
    assert.equal(readiness.summary.runtime_enabled, false);
    assert.match(readiness.blockers.join("\n"), /launch_contract_must_remain_disabled/);
  });

  test("blocks non-local launch contract hosts", () => {
    const readiness = assessServiceReadiness({ config: { launch_contract: { host: "0.0.0.0", port: 18080 } } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.equal(readiness.launch_contract.local_host, false);
    assert.equal(readiness.launch_contract.launch_allowed, false);
    assert.equal(readiness.launch_contract.runtime_started, false);
    assert.equal(readiness.launch_contract.bind_implemented, false);
    assert.equal(readiness.launch_contract.external_worker_intake, false);
    assert.match(readiness.blockers.join("\n"), /launch_contract_host_must_remain_local/);
  });

  test("keeps the readiness closure report-only and inert", () => {
    const readiness = assessServiceReadiness();

    assert.equal(readiness.readiness_closure.status, "ok");
    assert.equal(readiness.readiness_closure.report_only, true);
    assert.equal(readiness.readiness_closure.dashboard_projection_source, "report_index");
    assert.equal(readiness.readiness_closure.readiness_evidence_present, true);
    assert.equal(readiness.readiness_closure.preflight_evidence_present, true);
    assert.equal(readiness.readiness_closure.safety_harness_evidence_present, true);
    assert.equal(readiness.readiness_closure.launch_contract_evidence_present, true);
    assert.equal(readiness.readiness_closure.readiness_dashboard_projected, true);
    assert.equal(readiness.readiness_closure.preflight_dashboard_projected, true);
    assert.equal(readiness.readiness_closure.safety_harness_dashboard_projected, true);
    assert.equal(readiness.readiness_closure.launch_contract_dashboard_projected, true);
    assert.equal(readiness.readiness_closure.runtime_present, false);
    assert.equal(readiness.readiness_closure.intake_present, false);
    assert.equal(readiness.readiness_closure.value_movement_present, false);
    assert.equal(readiness.summary.readiness_closure_report_only, true);
    assert.equal(readiness.summary.readiness_closure_runtime_present, false);
    assert.equal(readiness.summary.readiness_closure_intake_present, false);
    assert.equal(readiness.summary.readiness_closure_value_movement_present, false);
  });

  test("keeps the readiness closure in attention when readiness has blockers", () => {
    const readiness = assessServiceReadiness({ config: { enabled: true } });

    assert.equal(readiness.valid, false);
    assert.equal(readiness.status, "attention");
    assert.equal(readiness.readiness_closure.status, "attention");
    assert.equal(readiness.readiness_closure.report_only, true);
    assert.equal(readiness.readiness_closure.runtime_present, false);
    assert.equal(readiness.readiness_closure.intake_present, false);
    assert.equal(readiness.readiness_closure.value_movement_present, false);
    assert.match(readiness.blockers.join("\n"), /runtime_must_remain_disabled/);
  });

  test("scores current report-only service capability without claiming listener readiness", () => {
    const scorecard = buildServiceCapabilityScorecard();

    assert.equal(scorecard.status, "ok");
    assert.equal(scorecard.mode, "report_only_capability_scorecard");
    assert.equal(scorecard.report_only, true);
    assert.equal(scorecard.score, 90);
    assert.equal(scorecard.max_score, 100);
    assert.equal(scorecard.summary.ok_capabilities, 5);
    assert.equal(scorecard.summary.planned_capabilities, 1);
    assert.equal(scorecard.summary.runtime_present, false);
    assert.equal(scorecard.summary.intake_present, false);
    assert.equal(scorecard.summary.value_movement_present, false);
    assert.deepEqual(scorecard.blockers, []);
  });

  test("turns scorecard attention when readiness has blockers", () => {
    const readiness = assessServiceReadiness({ config: { enabled: true } });
    const scorecard = buildServiceCapabilityScorecard({ readiness });

    assert.equal(scorecard.status, "attention");
    assert.equal(scorecard.score < scorecard.max_score, true);
    assert.match(scorecard.blockers.join("\n"), /readiness_not_ok/);
  });

  test("writes a stable service capability scorecard artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dbyte-service-scorecard-"));
    const output = join(directory, "scorecard.json");

    try {
      const { stdout } = await execFileAsync(execPath, ["scripts/report-service-capability-scorecard.mjs", "--out", output]);
      const report = JSON.parse(await readFile(output, "utf8"));

      assert.match(stdout, /service\.capability\.status=ok/);
      assert.match(stdout, /service\.capability\.score=90/);
      assert.equal(report.schema, 1);
      assert.equal(report.status, "ok");
      assert.equal(report.report_path, output);
      assert.equal(report.score, 90);
      assert.equal(report.max_score, 100);
      assert.equal(report.summary.runtime_present, false);
      assert.equal(report.summary.intake_present, false);
      assert.equal(report.summary.value_movement_present, false);
      assert.deepEqual(report.blockers, []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
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
      assert.equal(report.launch_contract.report_only, true);
      assert.equal(report.launch_contract.launch_allowed, false);
      assert.equal(report.launch_contract.runtime_started, false);
      assert.equal(report.launch_contract.bind_implemented, false);
      assert.equal(report.launch_contract.external_worker_intake, false);
      assert.equal(report.launch_contract.local_host, true);
      assert.equal(report.readiness_closure.report_only, true);
      assert.equal(report.readiness_closure.dashboard_projection_source, "report_index");
      assert.equal(report.readiness_closure.runtime_present, false);
      assert.equal(report.readiness_closure.intake_present, false);
      assert.equal(report.readiness_closure.value_movement_present, false);
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
