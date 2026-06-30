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

const INDEX = {
  index_schema: 1,
  index_scope: "read_only",
  index_ts_unix: NOW,
  index_status: "ok",
  report_count: 5,
  missing_required_count: 0,
  reports: [
    report("telemetry_json", "json", "reports/dbyte-agent-telemetry.json", true, true, "a"),
    report("decision", "json", "reports/dbyte-agent-decision.json", true, true, "b"),
    report("local_agent_evidence", "json", "reports/dbyte-agent-local-evidence.json", false, false, "<missing>"),
    poolReport("pool_core_ledger", "reports/dbyte-pool-ledger-report.json", 0, 0, 0, 0, 0, "c"),
    poolReport("pool_core_fixture_ledger", "reports/dbyte-pool-ledger-fixture-report.json", 2, 1, 1, 10, 2, "d")
  ]
};

test("agent summary renders optional local evidence index entry without blocking healthy artifacts", async () => {
  await withFetchFixtures({
    "reports/dbyte-agent-telemetry.json": TELEMETRY,
    "reports/dbyte-agent-decision.json": DECISION,
    "reports/dbyte-agent-index.json": INDEX
  }, async () => {
    const html = await agentSummaryPanel();

    assert.match(html, /DBYTE Agent Health/);
    assert.match(html, /local_artifacts_fresh/);
    assert.match(html, /DBYTE Report Index/);
    assert.match(html, /local_agent_evidence/);
    assert.match(html, /reports\/dbyte-agent-local-evidence\.json/);
    assert.match(html, /<td>no<\/td>/);
    assert.match(html, /missing/);
    assert.doesNotMatch(html, /undefined|NaN/);
  });
});

function report(name, kind, path, required, exists, hashPrefix) {
  return {
    name,
    kind,
    path,
    required,
    exists,
    status: exists ? "present" : "missing",
    sha256: exists ? hashPrefix.repeat(64) : "<missing>",
    size_bytes: exists ? 100 : 0
  };
}

function poolReport(name, path, total, accepted, rejected, difficulty, sessions, hashPrefix) {
  return {
    ...report(name, "json", path, true, true, hashPrefix),
    replay_schema: 1,
    replay_status: "ok",
    replay_total_events: total,
    replay_accepted_events: accepted,
    replay_rejected_events: rejected,
    replay_credited_difficulty: difficulty,
    replay_session_count: sessions
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
