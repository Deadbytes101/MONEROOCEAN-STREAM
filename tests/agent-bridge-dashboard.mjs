import test from "node:test";
import assert from "node:assert/strict";
import { agentSummaryPanel } from "../src/views/agent.js";

const NOW = Math.floor(Date.now() / 1000);

const TELEMETRY = {
  telemetry_schema: 1,
  telemetry_source: "bridge-test",
  telemetry_ts_unix: NOW,
  machine_name: "bridge-rig",
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
  report_count: 6,
  missing_required_count: 0,
  reports: [
    {
      name: "telemetry_json",
      kind: "json",
      path: "reports/dbyte-agent-telemetry.json",
      required: true,
      exists: true,
      status: "present",
      sha256: "a".repeat(64),
      size_bytes: 412
    },
    {
      name: "decision",
      kind: "json",
      path: "reports/dbyte-agent-decision.json",
      required: true,
      exists: true,
      status: "present",
      sha256: "b".repeat(64),
      size_bytes: 653
    },
    {
      name: "pool_core_ledger",
      kind: "json",
      path: "reports/dbyte-pool-ledger-report.json",
      required: true,
      exists: true,
      status: "present",
      sha256: "c".repeat(64),
      size_bytes: 154,
      replay_schema: 1,
      replay_status: "ok",
      replay_total_events: 0,
      replay_accepted_events: 0,
      replay_rejected_events: 0,
      replay_credited_difficulty: 0,
      replay_session_count: 0
    },
    {
      name: "pool_core_fixture_ledger",
      kind: "json",
      path: "reports/dbyte-pool-ledger-fixture-report.json",
      required: true,
      exists: true,
      status: "present",
      sha256: "d".repeat(64),
      size_bytes: 401,
      replay_schema: 1,
      replay_status: "ok",
      replay_total_events: 2,
      replay_accepted_events: 1,
      replay_rejected_events: 1,
      replay_credited_difficulty: 10,
      replay_session_count: 2
    },
    {
      name: "bridge_compare",
      kind: "json",
      path: "reports/dbyte-bridge-compare.json",
      required: false,
      exists: true,
      status: "present",
      sha256: "e".repeat(64),
      size_bytes: 640
    },
    {
      name: "bridge_file",
      kind: "json",
      path: "reports/dbyte-bridge-file.json",
      required: false,
      exists: true,
      status: "present",
      sha256: "f".repeat(64),
      size_bytes: 520
    }
  ]
};

test("agent summary renders bridge evidence from the report index", async () => {
  await withFetchFixtures({
    "reports/dbyte-agent-telemetry.json": TELEMETRY,
    "reports/dbyte-agent-decision.json": DECISION,
    "reports/dbyte-agent-index.json": INDEX
  }, async () => {
    const html = await agentSummaryPanel();

    assert.match(html, /DBYTE Agent Health/);
    assert.match(html, /local_artifacts_fresh/);
    assert.match(html, /DBYTE Pool Core Evidence/);
    assert.match(html, /Bridge compare/);
    assert.match(html, /Bridge file/);
    assert.match(html, /Bridge index name/);
    assert.match(html, /Bridge index status/);
    assert.match(html, /Bridge path/);
    assert.match(html, /Bridge file index name/);
    assert.match(html, /Bridge file index status/);
    assert.match(html, /Bridge file path/);
    assert.match(html, /bridge_compare/);
    assert.match(html, /bridge_file/);
    assert.match(html, /reports\/dbyte-bridge-compare\.json/);
    assert.match(html, /reports\/dbyte-bridge-file\.json/);
    assert.match(html, /<td>no<\/td>/);
    assert.doesNotMatch(html, /undefined|NaN/);
  });
});

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
