import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute } from "../src/routes.js";
import { agentSummaryPanel } from "../src/views/agent.js";

const TELEMETRY = {
  telemetry_schema: 1,
  telemetry_source: "unit-test",
  telemetry_ts_unix: 1700000000,
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
  decision_scope: "read_only",
  decision_status: "ok",
  decision_reason: "ledger_clean",
  decision_next: "observe",
  ledger_path: "crates\\dbyte-agent\\fixtures\\decision-clean-ledger.events",
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

test.describe("agent dashboard artifacts", { concurrency: false }, () => {
  test("agent route is public and stable", () => {
    assert.deepEqual(parseRoute("#/agent"), { n: "agent", p: "#/agent", q: {} });
  });

  test("agent summary renders telemetry and read-only decision JSON", async () => {
    await withFetchFixtures({
      "reports/dbyte-agent-telemetry.json": TELEMETRY,
      "reports/dbyte-agent-decision.json": DECISION
    }, async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Agent/);
      assert.match(html, /unit-rig/);
      assert.match(html, /DBYTE Decision/);
      assert.match(html, /read_only/);
      assert.match(html, /ledger_clean/);
      assert.match(html, /observe/);
      assert.match(html, /reports\/dbyte-agent-decision\.json/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
  });

  test("agent summary shows a decision artifact command when decision JSON is missing", async () => {
    await withFetchFixtures({
      "reports/dbyte-agent-telemetry.json": TELEMETRY
    }, async () => {
      const html = await agentSummaryPanel();

      assert.match(html, /DBYTE Decision/);
      assert.match(html, /Local decision JSON is not available yet/);
      assert.match(html, /report-agent-decision\.ps1/);
      assert.doesNotMatch(html, /undefined|NaN/);
    });
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
