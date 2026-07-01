import test from "node:test";
import assert from "node:assert/strict";
import { agentSummaryPanel } from "../src/views/agent.js";

const NOW = Math.floor(Date.now() / 1000);
const TELEMETRY = {
  telemetry_schema: 1,
  telemetry_source: "unit-test",
  telemetry_ts_unix: NOW,
  machine_name: "unit-rig",
  miner_algorithm: "randomx",
  miner_hashrate: 1200,
  miner_hashrate_unit: "hps",
  miner_accepted_shares: 10,
  miner_rejected_shares: 0,
  miner_reject_rate: 0,
  miner_uptime_seconds: 3600,
  pool_name: "test"
};
const DECISION = {
  decision_schema: 1,
  decision_ts_unix: NOW,
  decision_scope: "read_only",
  decision_status: "ok",
  decision_reason: "ledger_clean",
  decision_next: "observe",
  ledger_path: "crates/dbyte-agent/fixtures/decision-clean-ledger.events",
  ledger_exists: true,
  ledger_events: 3,
  ledger_valid_events: 3,
  ledger_invalid_events: 0,
  ledger_identity_reports: 1,
  ledger_machine_reports: 1,
  ledger_file_verifications: 1,
  ledger_file_verify_errors: 0,
  ledger_last_event: "file_verified",
  ledger_last_file_match: true,
  ledger_last_invalid_line: 0,
  ledger_last_invalid_reason: "<none>"
};

const REPORTS = [
  poolCoreReport("pool_core_ledger", "reports/dbyte-pool-ledger-report.json", 0, 0, 0, 0, 0),
  poolCoreReport("pool_core_fixture_ledger", "reports/dbyte-pool-ledger-fixture-report.json", 2, 1, 1, 10, 2),
  poolCoreReport("pool_core_file_ledger", "reports/dbyte-pool-ledger-file-report.json", 2, 1, 1, 10, 2),
  readinessReport()
];

test.describe("agent service readiness dashboard", { concurrency: false }, () => {
  test("renders Phase I readiness evidence from the report index", async () => {
    await withFetchFixtures({
      "reports/dbyte-agent-telemetry.json": TELEMETRY,
      "reports/dbyte-agent-decision.json": DECISION,
      "reports/dbyte-agent-index.json": indexFixture(REPORTS)
    }, async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Service Readiness Evidence/);
      assert.match(html, /phase_i_service_readiness/);
      assert.match(html, /reports\/dbyte-service-readiness\.json/);
      assert.match(html, /phase_i_readiness_planning/);
      assert.match(html, /review_configuration/);
      assert.match(html, /Report-only/);
      assert.match(html, /Runtime enabled/);
      assert.match(html, /Preflight status/);
      assert.match(html, /Preflight endpoint/);
      assert.match(html, /Preflight report-only/);
      assert.match(html, /Preflight runtime enabled/);
      assert.match(html, /Preflight local endpoint/);
      assert.match(html, /Preflight operator visible/);
      assert.match(html, /Safety harness status/);
      assert.match(html, /Safety harness endpoint/);
      assert.match(html, /Safety harness approval/);
      assert.match(html, /Safety harness report-only/);
      assert.match(html, /Safety harness runtime started/);
      assert.match(html, /Safety harness bind implemented/);
      assert.match(html, /Safety harness local endpoint/);
      assert.match(html, /Safety harness operator visible/);
      assert.match(html, /Launch contract status/);
      assert.match(html, /Launch contract host/);
      assert.match(html, /Launch contract approval/);
      assert.match(html, /Launch contract allowed/);
      assert.match(html, /Launch contract report-only/);
      assert.match(html, /Launch contract runtime started/);
      assert.match(html, /Launch contract bind implemented/);
      assert.match(html, /Launch contract external worker intake/);
      assert.match(html, /Launch contract local host/);
      assert.match(html, /Launch contract operator visible/);
      assert.match(html, /127\.0\.0\.1/);
      assert.match(html, />0<\/td>/);
      assert.match(html, /yes/);
      assert.match(html, /no/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("renders missing Phase I readiness evidence without breaking the healthy agent summary", async () => {
    const reports = REPORTS.filter((report) => report.name !== "phase_i_service_readiness");

    await withFetchFixtures({
      "reports/dbyte-agent-telemetry.json": TELEMETRY,
      "reports/dbyte-agent-decision.json": DECISION,
      "reports/dbyte-agent-index.json": indexFixture(reports)
    }, async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent Health/);
      assert.match(html, /local_artifacts_fresh/);
      assert.match(html, /DBYTE Service Readiness Evidence/);
      assert.match(html, /phase_i_service_readiness/);
      assert.match(html, /missing/);
      assert.match(html, /Preflight status/);
      assert.match(html, /Safety harness status/);
      assert.match(html, /Launch contract status/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("renders attention Phase I readiness evidence from the report index", async () => {
    const reports = REPORTS.map((report) => report.name === "phase_i_service_readiness"
      ? {
          ...report,
          readiness_status: "attention",
          readiness_valid: false,
          readiness_runtime_enabled: true,
          readiness_blocker_count: 2,
          readiness_next_step: "fix_readiness_blockers",
          readiness_local_mode: false,
          preflight_status: "attention",
          preflight_enabled: true,
          preflight_endpoint: "192.0.2.10",
          preflight_port: 18080,
          preflight_report_only: true,
          preflight_runtime_enabled: true,
          preflight_local_endpoint: false,
          preflight_operator_visible: true,
          safety_harness_status: "attention",
          safety_harness_enabled: true,
          safety_harness_endpoint: "192.0.2.20",
          safety_harness_port: 18081,
          safety_harness_operator_approval_required: false,
          safety_harness_report_only: true,
          safety_harness_runtime_started: true,
          safety_harness_bind_implemented: true,
          safety_harness_local_endpoint: false,
          safety_harness_operator_visible: true,
          launch_contract_status: "attention",
          launch_contract_enabled: false,
          launch_contract_host: "192.0.2.30",
          launch_contract_port: 18082,
          launch_contract_operator_approval_required: false,
          launch_contract_allowed: false,
          launch_contract_report_only: true,
          launch_contract_runtime_started: false,
          launch_contract_bind_implemented: false,
          launch_contract_external_worker_intake: false,
          launch_contract_local_host: false,
          launch_contract_operator_visible: true
        }
      : report);

    await withFetchFixtures({
      "reports/dbyte-agent-telemetry.json": TELEMETRY,
      "reports/dbyte-agent-decision.json": DECISION,
      "reports/dbyte-agent-index.json": indexFixture(reports)
    }, async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Service Readiness Evidence/);
      assert.match(html, /attention/);
      assert.match(html, /fix_readiness_blockers/);
      assert.match(html, /192\.0\.2\.10/);
      assert.match(html, /192\.0\.2\.20/);
      assert.match(html, /192\.0\.2\.30/);
      assert.match(html, /18,080/);
      assert.match(html, /18,081/);
      assert.match(html, /18,082/);
      assert.match(html, />2<\/td>/);
      assert.match(html, /no/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });
});

function indexFixture(reports) {
  return {
    index_schema: 1,
    index_scope: "read_only",
    index_ts_unix: NOW,
    index_status: "ok",
    report_count: reports.length,
    missing_required_count: 0,
    reports
  };
}

function poolCoreReport(name, path, totalEvents, acceptedEvents, rejectedEvents, creditedDifficulty, sessionCount) {
  return {
    name,
    kind: "json",
    path,
    required: true,
    exists: true,
    status: "present",
    sha256: "a".repeat(64),
    size_bytes: 512,
    replay_schema: 1,
    replay_status: "ok",
    replay_total_events: totalEvents,
    replay_accepted_events: acceptedEvents,
    replay_rejected_events: rejectedEvents,
    replay_credited_difficulty: creditedDifficulty,
    replay_session_count: sessionCount
  };
}

function readinessReport() {
  return {
    name: "phase_i_service_readiness",
    kind: "json",
    path: "reports/dbyte-service-readiness.json",
    required: false,
    exists: true,
    status: "present",
    sha256: "b".repeat(64),
    size_bytes: 512,
    readiness_schema: 1,
    readiness_status: "ok",
    readiness_valid: true,
    readiness_mode: "phase_i_readiness_planning",
    readiness_config_mode: "local",
    readiness_config_enabled: false,
    readiness_report_only: true,
    readiness_runtime_enabled: false,
    readiness_blocker_count: 0,
    readiness_next_step: "review_configuration",
    readiness_phase_h_gate_ok: true,
    readiness_local_mode: true,
    readiness_payload_limit_present: true,
    readiness_message_limit_present: true,
    readiness_operator_approval_required: true,
    preflight_status: "ok",
    preflight_enabled: false,
    preflight_endpoint: "127.0.0.1",
    preflight_port: 0,
    preflight_report_only: true,
    preflight_runtime_enabled: false,
    preflight_local_endpoint: true,
    preflight_operator_visible: true,
    safety_harness_status: "ok",
    safety_harness_enabled: false,
    safety_harness_endpoint: "127.0.0.1",
    safety_harness_port: 0,
    safety_harness_operator_approval_required: true,
    safety_harness_report_only: true,
    safety_harness_runtime_started: false,
    safety_harness_bind_implemented: false,
    safety_harness_local_endpoint: true,
    safety_harness_operator_visible: true,
    launch_contract_status: "ok",
    launch_contract_enabled: false,
    launch_contract_host: "127.0.0.1",
    launch_contract_port: 0,
    launch_contract_operator_approval_required: true,
    launch_contract_allowed: false,
    launch_contract_report_only: true,
    launch_contract_runtime_started: false,
    launch_contract_bind_implemented: false,
    launch_contract_external_worker_intake: false,
    launch_contract_local_host: true,
    launch_contract_operator_visible: true
  };
}

async function withFetchFixtures(fixtures, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = String(input);
    if (!(path in fixtures)) return { ok: false, async json() { return {}; } };
    return {
      ok: true,
      async json() {
        return fixtures[path];
      }
    };
  };

  try {
    return await callback();
  } finally {
    if (originalFetch) globalThis.fetch = originalFetch;
    else delete globalThis.fetch;
  }
}
