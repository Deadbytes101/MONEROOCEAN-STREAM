import { formatAge, formatHashrate, formatNumber, formatPercent } from "../format.js";
import { escapeHtml, kpi } from "./common.js";

const TELEMETRY_JSON_PATH = "reports/dbyte-agent-telemetry.json";
const DECISION_JSON_PATH = "reports/dbyte-agent-decision.json";
const TELEMETRY_STALE_SECONDS = 300;
const DECISION_STALE_SECONDS = 300;

export async function agentView() {
  const [telemetry, decision] = await loadAgentArtifacts();
  if (!telemetry && !decision) return unavailableView();
  return agentPanels(telemetry, decision, "DBYTE Agent", "Local runtime telemetry from the DBYTE agent JSON artifact.");
}

export async function agentSummaryPanel() {
  const [telemetry, decision] = await loadAgentArtifacts();
  if (!telemetry && !decision) return unavailableView("DBYTE Agent", "Local agent JSON artifacts are not available yet.");
  return agentPanels(telemetry, decision, "DBYTE Agent", "Dashboard-facing local telemetry and decision JSON.");
}

async function loadAgentArtifacts() {
  return Promise.all([loadJson(TELEMETRY_JSON_PATH), loadJson(DECISION_JSON_PATH)]);
}

async function loadJson(path) {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function agentPanels(telemetry, decision, title, subtitle) {
  return [
    telemetry ? telemetryPanel(telemetry, title, subtitle) : missingTelemetryPanel(title),
    decision ? decisionPanel(decision) : missingDecisionPanel()
  ].join("");
}

function telemetryPanel(telemetry, title, subtitle) {
  const hashrate = normalizedHashrate(telemetry);
  const rejectRate = Number(telemetry.miner_reject_rate) || 0;
  const acceptedShares = Number(telemetry.miner_accepted_shares) || 0;
  const rejectedShares = Number(telemetry.miner_rejected_shares) || 0;
  const capturedAt = Number(telemetry.telemetry_ts_unix) || 0;
  const freshness = artifactFreshness(capturedAt, TELEMETRY_STALE_SECONDS);

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
      ${kpi("Freshness", freshnessValue(freshness), "Whether the local telemetry artifact is still fresh.")}
      ${kpi("Accepted", formatNumber(acceptedShares), "Accepted shares in the latest telemetry report.")}
      ${kpi("Rejected", formatNumber(rejectedShares), "Rejected shares in the latest telemetry report.")}
    </div>
    <div class="card table-wrap">
      <table aria-label="DBYTE agent telemetry details">
        <tbody>
          ${detailRow("Source", telemetry.telemetry_source)}
          ${detailRow("Timestamp", formatAge(capturedAt))}
          ${detailRow("Freshness", freshness.label)}
          ${detailRow("Raw hashrate", `${formatNumber(telemetry.miner_hashrate, 4)} ${telemetry.miner_hashrate_unit || "hps"}`)}
          ${detailRow("Reject rate", formatPercent(rejectRate * 100, 2))}
          ${detailRow("Uptime", `${formatNumber(telemetry.miner_uptime_seconds)} seconds`)}
          ${detailRow("Pool", telemetry.pool_name)}
          ${detailRow("JSON", TELEMETRY_JSON_PATH)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function decisionPanel(decision) {
  const status = String(decision.decision_status || "unknown");
  const reason = String(decision.decision_reason || "unknown");
  const next = String(decision.decision_next || "observe");
  const generatedAt = Number(decision.decision_ts_unix) || 0;
  const freshness = artifactFreshness(generatedAt, DECISION_STALE_SECONDS);
  const events = Number(decision.ledger_events) || 0;
  const validEvents = Number(decision.ledger_valid_events) || 0;
  const invalidEvents = Number(decision.ledger_invalid_events) || 0;

  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Decision</h2>
        <p class=muted>Read-only operator decision from the local decision JSON artifact.</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Decision", { html: `<span class="${decisionStatusClass(status)}">${escapeHtml(status)}</span>` }, "Read-only decision status. This page does not start miners or change wallets.")}
      ${kpi("Freshness", freshnessValue(freshness), "Whether the local decision artifact is still fresh.")}
      ${kpi("Reason", reason, "Machine-readable reason from the decision artifact.")}
      ${kpi("Next", next, "Recommended operator action. This is display-only.")}
      ${kpi("Generated", formatAge(generatedAt), "How old the local decision artifact is.")}
      ${kpi("Invalid", formatNumber(invalidEvents), "Invalid ledger events rejected by the decision artifact.")}
    </div>
    <div class="card table-wrap">
      <table aria-label="DBYTE agent decision details">
        <tbody>
          ${detailRow("Scope", decision.decision_scope)}
          ${detailRow("Generated", formatAge(generatedAt))}
          ${detailRow("Freshness", freshness.label)}
          ${detailRow("Schema", decision.decision_schema)}
          ${detailRow("Ledger", decision.ledger_path)}
          ${detailRow("Events", formatNumber(events))}
          ${detailRow("Valid events", formatNumber(validEvents))}
          ${detailRow("Last event", decision.ledger_last_event)}
          ${detailRow("Last file match", decision.ledger_last_file_match)}
          ${detailRow("Last invalid reason", decision.ledger_last_invalid_reason)}
          ${detailRow("JSON", DECISION_JSON_PATH)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function missingTelemetryPanel(title = "DBYTE Agent") {
  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p class=muted>Local telemetry JSON is not available yet.</p>
      </div>
    </div>
    <div class=card>
      <p>Run <code>.\\scripts\\report-agent-telemetry.ps1</code> to write <code>${escapeHtml(TELEMETRY_JSON_PATH)}</code>.</p>
    </div>
  </section>`;
}

function missingDecisionPanel() {
  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Decision</h2>
        <p class=muted>Local decision JSON is not available yet.</p>
      </div>
    </div>
    <div class=card>
      <p>Run <code>.\\scripts\\report-agent-decision.ps1</code> to write <code>${escapeHtml(DECISION_JSON_PATH)}</code>.</p>
    </div>
  </section>`;
}

function unavailableView(title = "DBYTE Agent", subtitle = "Local telemetry JSON is not available yet.") {
  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p class=muted>${escapeHtml(subtitle)}</p>
      </div>
    </div>
    <div class=card>
      <p>Run <code>.\\scripts\\report-agent-telemetry.ps1</code> and <code>.\\scripts\\report-agent-decision.ps1</code> to write local dashboard artifacts.</p>
    </div>
  </section>`;
}

function artifactFreshness(tsUnix, maxAgeSeconds) {
  if (!Number.isFinite(tsUnix) || tsUnix <= 0) return { label: "missing_timestamp", className: "red" };
  const age = nowUnix() - tsUnix;
  if (age < -60) return { label: "future_clock", className: "muted" };
  if (age > maxAgeSeconds) return { label: "stale_artifact", className: "red" };
  return { label: "fresh", className: "green" };
}

function freshnessValue(freshness) {
  return { html: `<span class="${freshness.className}">${escapeHtml(freshness.label)}</span>` };
}

function nowUnix() {
  return Math.floor(Date.now() / 1000);
}

function decisionStatusClass(status) {
  if (status === "ok") return "green";
  if (status === "blocked") return "red";
  return "muted";
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
