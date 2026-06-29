import { formatAge, formatHashrate, formatNumber, formatPercent } from "../format.js";
import { escapeHtml, kpi } from "./common.js";

const TELEMETRY_JSON_PATH = "reports/dbyte-agent-telemetry.json";

export async function agentView() {
  const telemetry = await loadTelemetry();
  if (!telemetry) return unavailableView();
  return telemetryPanel(telemetry, "DBYTE Agent", "Local runtime telemetry from the DBYTE agent JSON artifact.");
}

export async function agentSummaryPanel() {
  const telemetry = await loadTelemetry();
  if (!telemetry) {
    return `<section class=panel>
      <div class=panel-header>
        <div>
          <h2>DBYTE Agent</h2>
          <p class=muted>Local telemetry JSON is not available yet.</p>
        </div>
      </div>
      <div class=card>
        <p>Run <code>.\\scripts\\report-agent-telemetry.ps1</code> to write <code>${escapeHtml(TELEMETRY_JSON_PATH)}</code>.</p>
      </div>
    </section>`;
  }
  return telemetryPanel(telemetry, "DBYTE Agent", "Dashboard-facing local telemetry JSON.");
}

async function loadTelemetry() {
  try {
    const response = await fetch(TELEMETRY_JSON_PATH, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function telemetryPanel(telemetry, title, subtitle) {
  const hashrate = normalizedHashrate(telemetry);
  const rejectRate = Number(telemetry.miner_reject_rate) || 0;
  const acceptedShares = Number(telemetry.miner_accepted_shares) || 0;
  const rejectedShares = Number(telemetry.miner_rejected_shares) || 0;

  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p class=muted>${escapeHtml(subtitle)}</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Machine", telemetry.machine_name || "--", "Local machine name reported by the DBYTE agent.")}
      ${kpi("Algorithm", telemetry.miner_algorithm || "--", "Algorithm label from the latest telemetry report.")}
      ${kpi("Hashrate", formatHashrate(hashrate), "Reported local hashrate normalized for display.")}
      ${kpi("Reject rate", formatPercent(rejectRate * 100, 2), "Rejected shares divided by total shares.")}
      ${kpi("Accepted", formatNumber(acceptedShares), "Accepted shares in the latest telemetry report.")}
      ${kpi("Rejected", formatNumber(rejectedShares), "Rejected shares in the latest telemetry report.")}
    </div>
    <div class="card table-wrap">
      <table aria-label="DBYTE agent telemetry details">
        <tbody>
          ${detailRow("Source", telemetry.telemetry_source)}
          ${detailRow("Timestamp", formatAge(telemetry.telemetry_ts_unix))}
          ${detailRow("Raw hashrate", `${formatNumber(telemetry.miner_hashrate, 4)} ${telemetry.miner_hashrate_unit || "hps"}`)}
          ${detailRow("Uptime", `${formatNumber(telemetry.miner_uptime_seconds)} seconds`)}
          ${detailRow("Pool", telemetry.pool_name)}
          ${detailRow("JSON", TELEMETRY_JSON_PATH)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function unavailableView() {
  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h1>DBYTE Agent</h1>
        <p class=muted>Local telemetry JSON is not available yet.</p>
      </div>
    </div>
    <div class=card>
      <p>Run <code>.\\scripts\\report-agent-telemetry.ps1</code> to write <code>${escapeHtml(TELEMETRY_JSON_PATH)}</code>.</p>
    </div>
  </section>`;
}

function normalizedHashrate(telemetry) {
  const value = Number(telemetry.miner_hashrate) || 0;
  const unit = String(telemetry.miner_hashrate_unit || "hps").toLowerCase();
  if (unit === "khps") return value * 1_000;
  if (unit === "mhps") return value * 1_000_000;
  return value;
}

function detailRow(label, value) {
  return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value ?? "--")}</td></tr>`;
}
