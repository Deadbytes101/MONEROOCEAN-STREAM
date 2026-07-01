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

test.describe("agent scorecard dashboard projection", { concurrency: false }, () => {
  test("renders the service capability scorecard report index entry", async () => {
    await withFetchFixtures(agentFixtures(), async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Report Index/);
      assert.match(html, /service_capability_scorecard/);
      assert.match(html, /reports\/dbyte-service-capability-scorecard\.json/);
      assert.match(html, /present/);
      assert.match(html, /read_only/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("keeps scorecard index status visible when the scorecard needs attention", async () => {
    await withFetchFixtures(agentFixtures({ scorecard: { status: "attention" } }), async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Report Index/);
      assert.match(html, /service_capability_scorecard/);
      assert.match(html, /attention/);
      assert.match(html, /reports\/dbyte-service-capability-scorecard\.json/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });
});

function agentFixtures({ scorecard = {} } = {}) {
  return {
    "reports/dbyte-agent-telemetry.json": TELEMETRY,
    "reports/dbyte-agent-decision.json": DECISION,
    "reports/dbyte-agent-index.json": indexFixture(scorecard)
  };
}

function indexFixture(scorecard) {
  const reports = [
    poolCoreReport("pool_core_ledger", "reports/dbyte-pool-ledger-report.json", 0, 0, 0, 0, 0),
    poolCoreReport("pool_core_fixture_ledger", "reports/dbyte-pool-ledger-fixture-report.json", 2, 1, 1, 10, 2),
    poolCoreReport("pool_core_file_ledger", "reports/dbyte-pool-ledger-file-report.json", 2, 1, 1, 10, 2),
    scorecardReport(scorecard)
  ];

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

function scorecardReport({ status = "present" } = {}) {
  return {
    name: "service_capability_scorecard",
    kind: "json",
    path: "reports/dbyte-service-capability-scorecard.json",
    required: false,
    exists: true,
    status,
    sha256: "b".repeat(64),
    size_bytes: 1024,
    scorecard_schema: 1,
    scorecard_status: status === "present" ? "ok" : status,
    scorecard_report_only: true,
    scorecard_score: 90,
    scorecard_max_score: 100,
    scorecard_runtime_present: false,
    scorecard_intake_present: false,
    scorecard_value_movement_present: false
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
