import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute } from "../src/routes.js";
import { agentSummaryPanel } from "../src/views/agent.js";

const NOW = Math.floor(Date.now() / 1000);
const STALE_TS = NOW - 3_600;

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
  report_count: 2,
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
    }
  ]
};

test.describe("agent dashboard artifacts", { concurrency: false }, () => {
  test("agent route is public and stable", () => {
    assert.deepEqual(parseRoute("#/agent"), { n: "agent", p: "#/agent", q: {} });
  });

  test("agent summary renders telemetry, decision JSON, index JSON, and health rollup", async () => {
    await withFetchFixtures(agentFixtures(), async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent Health/);
      assert.match(html, /local_artifacts_fresh/);
      assert.match(html, /unit-rig/);
      assert.match(html, /DBYTE Decision/);
      assert.match(html, /DBYTE Report Index/);
      assert.match(html, /Path/);
      assert.match(html, /Required/);
      assert.match(html, /Index age/);
      assert.match(html, /<td>yes<\/td>/);
      assert.match(html, /telemetry_json/);
      assert.match(html, /reports\/dbyte-agent-telemetry\.json/);
      assert.match(html, /present/);
      assert.match(html, /read_only/);
      assert.match(html, /ledger_clean/);
      assert.match(html, /observe/);
      assert.match(html, /Generated/);
      assert.match(html, /Freshness/);
      assert.match(html, /fresh/);
      assert.match(html, /reports\/dbyte-agent-decision\.json/);
      assert.match(html, /reports\/dbyte-agent-index\.json/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("agent health rollup marks stale report index as attention", async () => {
    await withFetchFixtures(agentFixtures({
      index: { ...INDEX, index_ts_unix: STALE_TS }
    }), async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent Health/);
      assert.match(html, /attention/);
      assert.match(html, /index_stale_artifact/);
      assert.match(html, /refresh_index/);
      assert.match(html, /stale_artifact/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("agent health rollup marks stale telemetry and decision artifacts as attention", async () => {
    await withFetchFixtures(agentFixtures({
      telemetry: { ...TELEMETRY, telemetry_ts_unix: STALE_TS },
      decision: { ...DECISION, decision_ts_unix: STALE_TS }
    }), async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent Health/);
      assert.match(html, /attention/);
      assert.match(html, /telemetry_stale_artifact/);
      assert.match(html, /stale_artifact/);
      assert.match(html, /DBYTE Decision/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("agent health rollup marks blocked decisions as blocked", async () => {
    await withFetchFixtures(agentFixtures({
      decision: { ...DECISION, decision_status: "blocked", decision_reason: "file_mismatch", decision_next: "verify_file" }
    }), async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent Health/);
      assert.match(html, /blocked/);
      assert.match(html, /file_mismatch/);
      assert.match(html, /verify_file/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("agent health rollup marks missing report index as attention", async () => {
    await withFetchFixtures({
      "reports/dbyte-agent-telemetry.json": TELEMETRY,
      "reports/dbyte-agent-decision.json": DECISION
    }, async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent Health/);
      assert.match(html, /missing_index/);
      assert.match(html, /DBYTE Report Index/);
      assert.match(html, /report-agent-index\.ps1/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("agent summary shows a decision artifact command when decision JSON is missing", async () => {
    await withFetchFixtures({
      "reports/dbyte-agent-telemetry.json": TELEMETRY,
      "reports/dbyte-agent-index.json": INDEX
    }, async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent Health/);
      assert.match(html, /missing_decision/);
      assert.match(html, /DBYTE Decision/);
      assert.match(html, /Local decision JSON is not available yet/);
      assert.match(html, /report-agent-decision\.ps1/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });
});

function agentFixtures(overrides = {}) {
  return {
    "reports/dbyte-agent-telemetry.json": overrides.telemetry || TELEMETRY,
    "reports/dbyte-agent-decision.json": overrides.decision || DECISION,
    "reports/dbyte-agent-index.json": overrides.index || INDEX
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
