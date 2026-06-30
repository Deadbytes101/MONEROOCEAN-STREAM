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
      assert.match(html, />0<\/td>/);
      assert.match(html, /yes/);
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
    readiness_operator_approval_required: true
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
