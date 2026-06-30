import { formatAge, formatHashrate, formatNumber, formatPercent } from "../format.js";
import { escapeHtml, kpi } from "./common.js";

const TELEMETRY_JSON_PATH = "reports/dbyte-agent-telemetry.json";
const DECISION_JSON_PATH = "reports/dbyte-agent-decision.json";
const INDEX_JSON_PATH = "reports/dbyte-agent-index.json";
const POOL_CORE_LEDGER_REPORT_NAME = "pool_core_ledger";
const POOL_CORE_FIXTURE_LEDGER_REPORT_NAME = "pool_core_fixture_ledger";
const POOL_CORE_FILE_LEDGER_REPORT_NAME = "pool_core_file_ledger";
const BRIDGE_COMPARE_REPORT_NAME = "bridge_compare";
const BRIDGE_FILE_COMPARE_REPORT_NAME = "bridge_file_compare";
const BRIDGE_FILE_REPORT_NAME = "bridge_file";
const PHASE_H_LOCAL_DRY_RUN_REPORT_NAME = "phase_h_local_dry_run";
const PHASE_I_SERVICE_READINESS_REPORT_NAME = "phase_i_service_readiness";
const POOL_CORE_LEDGER_REPORT_PATH = "reports/dbyte-pool-ledger-report.json";
const POOL_CORE_FIXTURE_LEDGER_REPORT_PATH = "reports/dbyte-pool-ledger-fixture-report.json";
const POOL_CORE_FILE_LEDGER_REPORT_PATH = "reports/dbyte-pool-ledger-file-report.json";
const BRIDGE_COMPARE_REPORT_PATH = "reports/dbyte-bridge-compare.json";
const BRIDGE_FILE_COMPARE_REPORT_PATH = "reports/dbyte-bridge-file-compare.json";
const BRIDGE_FILE_REPORT_PATH = "reports/dbyte-bridge-file.json";
const PHASE_H_LOCAL_DRY_RUN_REPORT_PATH = "reports/dbyte-local-service-dry-run.json";
const PHASE_I_SERVICE_READINESS_REPORT_PATH = "reports/dbyte-service-readiness.json";
const TELEMETRY_STALE_SECONDS = 300;
const DECISION_STALE_SECONDS = 300;
const INDEX_STALE_SECONDS = 300;

export async function agentView() {
  const [telemetry, decision, index] = await loadAgentArtifacts();
  if (!telemetry && !decision && !index) return unavailableView();
  return agentPanels(telemetry, decision, index, "DBYTE Agent", "Local runtime telemetry from the DBYTE agent JSON artifact.");
}

export async function agentSummaryPanel() {
  const [telemetry, decision, index] = await loadAgentArtifacts();
  if (!telemetry && !decision && !index) return unavailableView("DBYTE Agent", "Local agent JSON artifacts are not available yet.");
  return agentPanels(telemetry, decision, index, "DBYTE Agent", "Dashboard-facing local telemetry and decision JSON.");
}

async function loadAgentArtifacts() {
  return Promise.all([loadJson(TELEMETRY_JSON_PATH), loadJson(DECISION_JSON_PATH), loadJson(INDEX_JSON_PATH)]);
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

function agentPanels(telemetry, decision, index, title, subtitle) {
  return [
    healthPanel(telemetry, decision, index),
    telemetry ? telemetryPanel(telemetry, title, subtitle) : missingTelemetryPanel(title),
    decision ? decisionPanel(decision) : missingDecisionPanel(),
    index ? poolCoreArtifactPanel(index) : "",
    index ? serviceDryRunPanel(index) : "",
    index ? serviceReadinessPanel(index) : "",
    index ? indexPanel(index) : missingIndexPanel()
  ].join("");
}

function healthPanel(telemetry, decision, index) {
  const health = agentHealth(telemetry, decision, index);
  const telemetryFreshness = telemetry ? artifactFreshness(Number(telemetry.telemetry_ts_unix) || 0, TELEMETRY_STALE_SECONDS) : { label: "missing_artifact", className: "red" };
  const decisionFreshness = decision ? artifactFreshness(Number(decision.decision_ts_unix) || 0, DECISION_STALE_SECONDS) : { label: "missing_artifact", className: "red" };
  const indexFreshness = index ? artifactFreshness(Number(index.index_ts_unix) || 0, INDEX_STALE_SECONDS) : { label: "missing_artifact", className: "red" };
  const indexStatus = index ? String(index.index_status || "unknown") : "missing_artifact";
  const reports = indexReports(index);
  const poolCoreReport = poolCoreLedgerReport(reports);
  const poolCoreFixtureReport = poolCoreFixtureLedgerReport(reports);
  const poolCoreFileReport = poolCoreFileLedgerReport(reports);
  const bridgeReport = bridgeCompareReport(reports);
  const bridgeFileCompareArtifact = bridgeFileCompareReport(reports);
  const bridgeFileArtifact = bridgeFileReport(reports);
  const poolCoreStatus = poolCoreReplayStatus(poolCoreReport);
  const poolCoreFixtureStatus = poolCoreReplayStatus(poolCoreFixtureReport);
  const poolCoreFileStatus = poolCoreReplayStatus(poolCoreFileReport);
  const bridgeStatus = bridgeReport ? String(bridgeReport.compare_status || bridgeReport.status || "unknown") : "missing";
  const bridgeFileCompareStatus = bridgeFileCompareArtifact ? String(bridgeFileCompareArtifact.compare_status || bridgeFileCompareArtifact.status || "unknown") : "missing";
  const bridgeFileStatus = bridgeFileArtifact ? String(bridgeFileArtifact.bridge_status || bridgeFileArtifact.status || "unknown") : "missing";

  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Agent Health</h2>
        <p class=muted>Single display-only operator state from local telemetry, decision, index, and freshness artifacts.</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Health", { html: `<span class="${decisionStatusClass(health.status)}">${escapeHtml(health.status)}</span>` }, "Overall local agent health for operator review.")}
      ${kpi("Reason", health.reason, "Why this health state was selected.")}
      ${kpi("Next", health.next, "Suggested operator action label.")}
      ${kpi("Telemetry", freshnessValue(telemetryFreshness), "Telemetry artifact freshness.")}
      ${kpi("Decision", freshnessValue(decisionFreshness), "Decision artifact freshness.")}
      ${kpi("Index", { html: `<span class="${reportStatusClass(indexStatus)}">${escapeHtml(indexStatus)}</span>` }, "Report index status.")}
      ${kpi("Index age", freshnessValue(indexFreshness), "Report index artifact freshness.")}
      ${kpi("Pool core", { html: `<span class="${reportStatusClass(poolCoreStatus)}">${escapeHtml(poolCoreStatus)}</span>` }, "Pool-core zero-init replay report status from the local report index.")}
      ${kpi("Pool fixture", { html: `<span class="${reportStatusClass(poolCoreFixtureStatus)}">${escapeHtml(poolCoreFixtureStatus)}</span>` }, "Pool-core deterministic fixture replay report status from the local report index.")}
      ${kpi("Pool file", { html: `<span class="${reportStatusClass(poolCoreFileStatus)}">${escapeHtml(poolCoreFileStatus)}</span>` }, "Pool-core deterministic file replay report status from the local report index.")}
      ${kpi("Bridge compare", { html: `<span class="${reportStatusClass(bridgeStatus)}">${escapeHtml(bridgeStatus)}</span>` }, "Bridge comparison result status from the local report index.")}
      ${kpi("Bridge file compare", { html: `<span class="${reportStatusClass(bridgeFileCompareStatus)}">${escapeHtml(bridgeFileCompareStatus)}</span>` }, "Bridge file comparison result status from the local report index.")}
      ${kpi("Bridge file", { html: `<span class="${reportStatusClass(bridgeFileStatus)}">${escapeHtml(bridgeFileStatus)}</span>` }, "Bridge file parse result status from the local report index.")}
    </div>
  </section>`;
}

function agentHealth(telemetry, decision, index) {
  if (!telemetry) return { status: "attention", reason: "missing_telemetry", next: "generate_telemetry" };
  if (!decision) return { status: "attention", reason: "missing_decision", next: "generate_decision" };
  if (!index) return { status: "attention", reason: "missing_index", next: "generate_index" };

  const indexStatus = String(index.index_status || "unknown");
  if (indexStatus !== "ok") return { status: "attention", reason: `index_${indexStatus}`, next: "inspect_index" };

  const reports = indexReports(index);
  const poolCoreReport = poolCoreLedgerReport(reports);
  if (!poolCoreReport) return { status: "attention", reason: "missing_pool_core_ledger", next: "refresh_index" };

  const poolCoreFixtureReport = poolCoreFixtureLedgerReport(reports);
  if (!poolCoreFixtureReport) return { status: "attention", reason: "missing_pool_core_fixture_ledger", next: "refresh_index" };

  const poolCoreFileReport = poolCoreFileLedgerReport(reports);
  if (!poolCoreFileReport) return { status: "attention", reason: "missing_pool_core_file_ledger", next: "refresh_index" };

  const replayStatus = String(poolCoreReport.replay_status || "");
  if (replayStatus && replayStatus !== "ok") return { status: "attention", reason: `pool_core_${replayStatus}`, next: "inspect_pool_core_report" };

  const fixtureReplayStatus = String(poolCoreFixtureReport.replay_status || "");
  if (fixtureReplayStatus && fixtureReplayStatus !== "ok") return { status: "attention", reason: `pool_core_fixture_${fixtureReplayStatus}`, next: "inspect_pool_core_fixture_report" };

  const fileReplayStatus = String(poolCoreFileReport.replay_status || "");
  if (fileReplayStatus && fileReplayStatus !== "ok") return { status: "attention", reason: `pool_core_file_${fileReplayStatus}`, next: "inspect_pool_core_file_report" };

  const indexFreshness = artifactFreshness(Number(index.index_ts_unix) || 0, INDEX_STALE_SECONDS);
  if (indexFreshness.label !== "fresh") return { status: "attention", reason: `index_${indexFreshness.label}`, next: "refresh_index" };

  const telemetryFreshness = artifactFreshness(Number(telemetry.telemetry_ts_unix) || 0, TELEMETRY_STALE_SECONDS);
  if (telemetryFreshness.label !== "fresh") return { status: "attention", reason: `telemetry_${telemetryFreshness.label}`, next: "refresh_telemetry" };

  const decisionFreshness = artifactFreshness(Number(decision.decision_ts_unix) || 0, DECISION_STALE_SECONDS);
  if (decisionFreshness.label !== "fresh") return { status: "attention", reason: `decision_${decisionFreshness.label}`, next: "refresh_decision" };

  const decisionStatus = String(decision.decision_status || "unknown");
  if (decisionStatus === "blocked") return { status: "blocked", reason: String(decision.decision_reason || "decision_blocked"), next: String(decision.decision_next || "inspect_decision") };
  if (decisionStatus !== "ok") return { status: "attention", reason: String(decision.decision_reason || "decision_attention"), next: String(decision.decision_next || "inspect_decision") };

  return { status: "ok", reason: "local_artifacts_fresh", next: "observe" };
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
        <p class=muted>Display-only operator decision from the local decision JSON artifact.</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Decision", { html: `<span class="${decisionStatusClass(status)}">${escapeHtml(status)}</span>` }, "Display-only decision status.")}
      ${kpi("Freshness", freshnessValue(freshness), "Whether the local decision artifact is still fresh.")}
      ${kpi("Reason", reason, "Machine-readable reason from the decision artifact.")}
      ${kpi("Next", next, "Recommended operator action label.")}
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

function poolCoreArtifactPanel(index) {
  const reports = indexReports(index);
  const report = poolCoreLedgerReport(reports);
  const fixtureReport = poolCoreFixtureLedgerReport(reports);
  const fileReport = poolCoreFileLedgerReport(reports);
  const bridgeReport = bridgeCompareReport(reports);
  const bridgeFileCompareArtifact = bridgeFileCompareReport(reports);
  const bridgeFileArtifact = bridgeFileReport(reports);
  const status = report ? String(report.status || "unknown") : "missing";
  const fixtureStatus = fixtureReport ? String(fixtureReport.status || "unknown") : "missing";
  const fileStatus = fileReport ? String(fileReport.status || "unknown") : "missing";
  const bridgeStatus = bridgeReport ? String(bridgeReport.status || "unknown") : "missing";
  const bridgeCompareResultStatus = bridgeReport ? String(bridgeReport.compare_status || "--") : "--";
  const bridgeKpiStatus = bridgeReport ? String(bridgeReport.compare_status || bridgeStatus) : "missing";
  const bridgeFileCompareStatus = bridgeFileCompareArtifact ? String(bridgeFileCompareArtifact.status || "unknown") : "missing";
  const bridgeFileCompareResultStatus = bridgeFileCompareArtifact ? String(bridgeFileCompareArtifact.compare_status || "--") : "--";
  const bridgeFileCompareKpiStatus = bridgeFileCompareArtifact ? String(bridgeFileCompareArtifact.compare_status || bridgeFileCompareStatus) : "missing";
  const bridgeFileStatus = bridgeFileArtifact ? String(bridgeFileArtifact.status || "unknown") : "missing";
  const bridgeFileResultStatus = bridgeFileArtifact ? String(bridgeFileArtifact.bridge_status || "--") : "--";
  const bridgeFileKpiStatus = bridgeFileArtifact ? String(bridgeFileArtifact.bridge_status || bridgeFileStatus) : "missing";
  const path = report ? String(report.path || POOL_CORE_LEDGER_REPORT_PATH) : POOL_CORE_LEDGER_REPORT_PATH;
  const fixturePath = fixtureReport ? String(fixtureReport.path || POOL_CORE_FIXTURE_LEDGER_REPORT_PATH) : POOL_CORE_FIXTURE_LEDGER_REPORT_PATH;
  const filePath = fileReport ? String(fileReport.path || POOL_CORE_FILE_LEDGER_REPORT_PATH) : POOL_CORE_FILE_LEDGER_REPORT_PATH;
  const bridgePath = bridgeReport ? String(bridgeReport.path || BRIDGE_COMPARE_REPORT_PATH) : BRIDGE_COMPARE_REPORT_PATH;
  const bridgeFileComparePath = bridgeFileCompareArtifact ? String(bridgeFileCompareArtifact.path || BRIDGE_FILE_COMPARE_REPORT_PATH) : BRIDGE_FILE_COMPARE_REPORT_PATH;
  const bridgeFilePath = bridgeFileArtifact ? String(bridgeFileArtifact.path || BRIDGE_FILE_REPORT_PATH) : BRIDGE_FILE_REPORT_PATH;
  const replayStatus = poolCoreReplayStatus(report);
  const fixtureReplayStatus = poolCoreReplayStatus(fixtureReport);
  const fileReplayStatus = poolCoreReplayStatus(fileReport);
  const totalEvents = report ? Number(report.replay_total_events) || 0 : 0;
  const fixtureTotalEvents = fixtureReport ? Number(fixtureReport.replay_total_events) || 0 : 0;
  const fixtureAcceptedEvents = fixtureReport ? Number(fixtureReport.replay_accepted_events) || 0 : 0;
  const fixtureRejectedEvents = fixtureReport ? Number(fixtureReport.replay_rejected_events) || 0 : 0;
  const fixtureCreditedDifficulty = fixtureReport ? Number(fixtureReport.replay_credited_difficulty) || 0 : 0;
  const fixtureSessionCount = fixtureReport ? Number(fixtureReport.replay_session_count) || 0 : 0;
  const fileTotalEvents = fileReport ? Number(fileReport.replay_total_events) || 0 : 0;
  const fileAcceptedEvents = fileReport ? Number(fileReport.replay_accepted_events) || 0 : 0;
  const fileRejectedEvents = fileReport ? Number(fileReport.replay_rejected_events) || 0 : 0;
  const fileCreditedDifficulty = fileReport ? Number(fileReport.replay_credited_difficulty) || 0 : 0;
  const fileSessionCount = fileReport ? Number(fileReport.replay_session_count) || 0 : 0;

  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Pool Core Evidence</h2>
        <p class=muted>Display-only pool-core zero-init, deterministic fixture replay, deterministic file replay, bridge comparison, file-output comparison, and bridge file artifacts discovered through the local report index.</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Default", { html: `<span class="${reportStatusClass(replayStatus)}">${escapeHtml(replayStatus)}</span>` }, "Zero-init pool-core replay report status embedded in the index entry.")}
      ${kpi("Fixture", { html: `<span class="${reportStatusClass(fixtureReplayStatus)}">${escapeHtml(fixtureReplayStatus)}</span>` }, "Deterministic non-zero pool-core fixture replay report status embedded in the index entry.")}
      ${kpi("File", { html: `<span class="${reportStatusClass(fileReplayStatus)}">${escapeHtml(fileReplayStatus)}</span>` }, "Deterministic pool-core file replay report status embedded in the index entry.")}
      ${kpi("Bridge compare", { html: `<span class="${reportStatusClass(bridgeKpiStatus)}">${escapeHtml(bridgeKpiStatus)}</span>` }, "Bridge comparison result status embedded in the index entry.")}
      ${kpi("Bridge file compare", { html: `<span class="${reportStatusClass(bridgeFileCompareKpiStatus)}">${escapeHtml(bridgeFileCompareKpiStatus)}</span>` }, "Bridge file comparison result status embedded in the index entry.")}
      ${kpi("Bridge file", { html: `<span class="${reportStatusClass(bridgeFileKpiStatus)}">${escapeHtml(bridgeFileKpiStatus)}</span>` }, "Bridge file parse result status embedded in the index entry.")}
      ${kpi("Default events", formatNumber(totalEvents), "Zero-init replay event count embedded in the index entry.")}
      ${kpi("Fixture events", formatNumber(fixtureTotalEvents), "Fixture replay event count embedded in the index entry.")}
      ${kpi("File events", formatNumber(fileTotalEvents), "File replay event count embedded in the index entry.")}
      ${kpi("Fixture accepted", formatNumber(fixtureAcceptedEvents), "Fixture accepted replay events embedded in the index entry.")}
      ${kpi("Fixture rejected", formatNumber(fixtureRejectedEvents), "Fixture rejected replay events embedded in the index entry.")}
      ${kpi("Fixture credited", formatNumber(fixtureCreditedDifficulty), "Fixture credited difficulty total embedded in the index entry.")}
      ${kpi("Fixture sessions", formatNumber(fixtureSessionCount), "Fixture replay session rows embedded in the index entry.")}
      ${kpi("File accepted", formatNumber(fileAcceptedEvents), "File accepted replay events embedded in the index entry.")}
      ${kpi("File rejected", formatNumber(fileRejectedEvents), "File rejected replay events embedded in the index entry.")}
      ${kpi("File credited", formatNumber(fileCreditedDifficulty), "File credited difficulty total embedded in the index entry.")}
      ${kpi("File sessions", formatNumber(fileSessionCount), "File replay session rows embedded in the index entry.")}
    </div>
    <div class="card table-wrap">
      <table aria-label="DBYTE pool core evidence details">
        <tbody>
          ${detailRow("Default index name", report ? report.name : POOL_CORE_LEDGER_REPORT_NAME)}
          ${detailRow("Default index status", status)}
          ${detailRow("Default replay status", replayStatus)}
          ${detailRow("Default path", path)}
          ${detailRow("Default total events", formatNumber(totalEvents))}
          ${detailRow("Fixture index name", fixtureReport ? fixtureReport.name : POOL_CORE_FIXTURE_LEDGER_REPORT_NAME)}
          ${detailRow("Fixture index status", fixtureStatus)}
          ${detailRow("Fixture replay status", fixtureReplayStatus)}
          ${detailRow("Fixture path", fixturePath)}
          ${detailRow("Fixture total events", formatNumber(fixtureTotalEvents))}
          ${detailRow("Fixture accepted events", formatNumber(fixtureAcceptedEvents))}
          ${detailRow("Fixture rejected events", formatNumber(fixtureRejectedEvents))}
          ${detailRow("Fixture credited difficulty", formatNumber(fixtureCreditedDifficulty))}
          ${detailRow("Fixture session rows", formatNumber(fixtureSessionCount))}
          ${detailRow("File index name", fileReport ? fileReport.name : POOL_CORE_FILE_LEDGER_REPORT_NAME)}
          ${detailRow("File index status", fileStatus)}
          ${detailRow("File replay status", fileReplayStatus)}
          ${detailRow("File path", filePath)}
          ${detailRow("File total events", formatNumber(fileTotalEvents))}
          ${detailRow("File accepted events", formatNumber(fileAcceptedEvents))}
          ${detailRow("File rejected events", formatNumber(fileRejectedEvents))}
          ${detailRow("File credited difficulty", formatNumber(fileCreditedDifficulty))}
          ${detailRow("File session rows", formatNumber(fileSessionCount))}
          ${detailRow("Bridge index name", bridgeReport ? bridgeReport.name : BRIDGE_COMPARE_REPORT_NAME)}
          ${detailRow("Bridge index status", bridgeStatus)}
          ${detailRow("Bridge compare status", bridgeCompareResultStatus)}
          ${detailRow("Bridge total events match", compareMatchLabel(bridgeReport, "compare_total_events"))}
          ${detailRow("Bridge accepted events match", compareMatchLabel(bridgeReport, "compare_accepted_events"))}
          ${detailRow("Bridge rejected events match", compareMatchLabel(bridgeReport, "compare_rejected_events"))}
          ${detailRow("Bridge credited difficulty match", compareMatchLabel(bridgeReport, "compare_credited_difficulty"))}
          ${detailRow("Bridge path", bridgePath)}
          ${detailRow("Bridge file compare index name", bridgeFileCompareArtifact ? bridgeFileCompareArtifact.name : BRIDGE_FILE_COMPARE_REPORT_NAME)}
          ${detailRow("Bridge file compare index status", bridgeFileCompareStatus)}
          ${detailRow("Bridge file compare status", bridgeFileCompareResultStatus)}
          ${detailRow("Bridge file total events match", compareMatchLabel(bridgeFileCompareArtifact, "compare_total_events"))}
          ${detailRow("Bridge file accepted events match", compareMatchLabel(bridgeFileCompareArtifact, "compare_accepted_events"))}
          ${detailRow("Bridge file rejected events match", compareMatchLabel(bridgeFileCompareArtifact, "compare_rejected_events"))}
          ${detailRow("Bridge file credited difficulty match", compareMatchLabel(bridgeFileCompareArtifact, "compare_credited_difficulty"))}
          ${detailRow("Bridge file compare path", bridgeFileComparePath)}
          ${detailRow("Bridge file index name", bridgeFileArtifact ? bridgeFileArtifact.name : BRIDGE_FILE_REPORT_NAME)}
          ${detailRow("Bridge file index status", bridgeFileStatus)}
          ${detailRow("Bridge file status", bridgeFileResultStatus)}
          ${detailRow("Bridge file valid", booleanFieldLabel(bridgeFileArtifact, "bridge_valid"))}
          ${detailRow("Bridge file total events", numberFieldLabel(bridgeFileArtifact, "bridge_total_events"))}
          ${detailRow("Bridge file accepted events", numberFieldLabel(bridgeFileArtifact, "bridge_accepted_events"))}
          ${detailRow("Bridge file rejected events", numberFieldLabel(bridgeFileArtifact, "bridge_rejected_events"))}
          ${detailRow("Bridge file credited difficulty", numberFieldLabel(bridgeFileArtifact, "bridge_credited_difficulty"))}
          ${detailRow("Bridge file sessions", numberFieldLabel(bridgeFileArtifact, "bridge_session_count"))}
          ${detailRow("Bridge file jobs", numberFieldLabel(bridgeFileArtifact, "bridge_job_count"))}
          ${detailRow("Bridge file assignments", numberFieldLabel(bridgeFileArtifact, "bridge_assignment_count"))}
          ${detailRow("Bridge file path", bridgeFilePath)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function serviceDryRunPanel(index) {
  const reports = indexReports(index);
  const dryRunReport = localDryRunReport(reports);
  const status = dryRunReport ? String(dryRunReport.dry_run_status || dryRunReport.status || "unknown") : "missing";
  const path = dryRunReport ? String(dryRunReport.path || PHASE_H_LOCAL_DRY_RUN_REPORT_PATH) : PHASE_H_LOCAL_DRY_RUN_REPORT_PATH;

  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Service Dry-Run Evidence</h2>
        <p class=muted>Display-only Phase H projection from the local report index.</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Dry run", { html: `<span class="${reportStatusClass(status)}">${escapeHtml(status)}</span>` }, "Local fixture dry-run status embedded in the report index.")}
      ${kpi("Messages", numberFieldLabel(dryRunReport, "dry_run_input_messages"), "Synthetic fixture input messages replayed by the dry-run report.")}
      ${kpi("Errors", numberFieldLabel(dryRunReport, "dry_run_error_count"), "Dry-run error count embedded in the report index.")}
      ${kpi("Accepted", numberFieldLabel(dryRunReport, "dry_run_accepted_submits"), "Accepted submit count embedded in the report index.")}
      ${kpi("Rejected", numberFieldLabel(dryRunReport, "dry_run_rejected_submits"), "Rejected submit count embedded in the report index.")}
      ${kpi("Replayable", booleanFieldLabel(dryRunReport, "dry_run_replayable"), "Whether all dry-run state is replayable from report files.")}
    </div>
    <div class="card table-wrap">
      <table aria-label="DBYTE local service dry-run evidence details">
        <tbody>
          ${detailRow("Index name", dryRunReport ? dryRunReport.name : PHASE_H_LOCAL_DRY_RUN_REPORT_NAME)}
          ${detailRow("Index status", dryRunReport ? dryRunReport.status : "missing")}
          ${detailRow("Dry-run status", status)}
          ${detailRow("Mode", dryRunReport ? dryRunReport.dry_run_mode : "--")}
          ${detailRow("Startup", dryRunReport ? dryRunReport.dry_run_startup_status : "--")}
          ${detailRow("Shutdown", dryRunReport ? dryRunReport.dry_run_shutdown_status : "--")}
          ${detailRow("Dashboard source", dryRunReport ? dryRunReport.dry_run_dashboard_source : "--")}
          ${detailRow("Malformed messages", numberFieldLabel(dryRunReport, "dry_run_malformed_messages"))}
          ${detailRow("Rate-limited messages", numberFieldLabel(dryRunReport, "dry_run_rate_limited_messages"))}
          ${detailRow("Plan rows", numberFieldLabel(dryRunReport, "dry_run_plan_rows"))}
          ${detailRow("Path", path)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function serviceReadinessPanel(index) {
  const reports = indexReports(index);
  const readinessReport = serviceReadinessReport(reports);
  const status = readinessReport ? String(readinessReport.readiness_status || readinessReport.status || "unknown") : "missing";
  const path = readinessReport ? String(readinessReport.path || PHASE_I_SERVICE_READINESS_REPORT_PATH) : PHASE_I_SERVICE_READINESS_REPORT_PATH;

  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Service Readiness Evidence</h2>
        <p class=muted>Display-only Phase I readiness projection from the local report index.</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Readiness", { html: `<span class="${reportStatusClass(status)}">${escapeHtml(status)}</span>` }, "Readiness status embedded in the report index.")}
      ${kpi("Mode", readinessReport ? readinessReport.readiness_config_mode : "--", "Configured readiness mode embedded in the report index.")}
      ${kpi("Report-only", booleanFieldLabel(readinessReport, "readiness_report_only"), "Whether this readiness state is report-only.")}
      ${kpi("Runtime", booleanFieldLabel(readinessReport, "readiness_runtime_enabled"), "Whether runtime enablement is visible in the readiness report.")}
      ${kpi("Blockers", numberFieldLabel(readinessReport, "readiness_blocker_count"), "Readiness blocker count embedded in the report index.")}
      ${kpi("Phase H", booleanFieldLabel(readinessReport, "readiness_phase_h_gate_ok"), "Whether the Phase H gate was accepted by readiness checks.")}
    </div>
    <div class="card table-wrap">
      <table aria-label="DBYTE service readiness evidence details">
        <tbody>
          ${detailRow("Index name", readinessReport ? readinessReport.name : PHASE_I_SERVICE_READINESS_REPORT_NAME)}
          ${detailRow("Index status", readinessReport ? readinessReport.status : "missing")}
          ${detailRow("Readiness status", status)}
          ${detailRow("Readiness mode", readinessReport ? readinessReport.readiness_mode : "--")}
          ${detailRow("Config mode", readinessReport ? readinessReport.readiness_config_mode : "--")}
          ${detailRow("Config enabled", booleanFieldLabel(readinessReport, "readiness_config_enabled"))}
          ${detailRow("Report-only", booleanFieldLabel(readinessReport, "readiness_report_only"))}
          ${detailRow("Runtime enabled", booleanFieldLabel(readinessReport, "readiness_runtime_enabled"))}
          ${detailRow("Blockers", numberFieldLabel(readinessReport, "readiness_blocker_count"))}
          ${detailRow("Next step", readinessReport ? readinessReport.readiness_next_step : "--")}
          ${detailRow("Local mode", booleanFieldLabel(readinessReport, "readiness_local_mode"))}
          ${detailRow("Payload limit", booleanFieldLabel(readinessReport, "readiness_payload_limit_present"))}
          ${detailRow("Message limit", booleanFieldLabel(readinessReport, "readiness_message_limit_present"))}
          ${detailRow("Operator approval", booleanFieldLabel(readinessReport, "readiness_operator_approval_required"))}
          ${detailRow("Path", path)}
        </tbody>
      </table>
    </div>
  </section>`;
}

function indexPanel(index) {
  const status = String(index.index_status || "unknown");
  const scope = String(index.index_scope || "unknown");
  const generatedAt = Number(index.index_ts_unix) || 0;
  const reportCount = Number(index.report_count) || 0;
  const missingRequiredCount = Number(index.missing_required_count) || 0;
  const reports = indexReports(index);

  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Report Index</h2>
        <p class=muted>Display-only inventory of required local agent and pool-core report files.</p>
      </div>
    </div>
    <div class="card grid kpi-grid">
      ${kpi("Index", { html: `<span class="${reportStatusClass(status)}">${escapeHtml(status)}</span>` }, "Overall report index status.")}
      ${kpi("Scope", scope, "Report index scope.")}
      ${kpi("Reports", formatNumber(reportCount), "Report files tracked by the index.")}
      ${kpi("Missing", formatNumber(missingRequiredCount), "Required reports missing from disk.")}
      ${kpi("Generated", formatAge(generatedAt), "How old the local index artifact is.")}
      ${kpi("JSON", INDEX_JSON_PATH, "Local report index JSON path.")}
    </div>
    <div class="card table-wrap">
      <table aria-label="DBYTE agent report index details">
        <thead><tr><th>Name</th><th>Status</th><th>Required</th><th>Path</th><th>Size</th><th>SHA256</th></tr></thead>
        <tbody>${reports.map(reportRow).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

function reportRow(report) {
  const status = String(report.status || "unknown");
  return `<tr>
    <th>${escapeHtml(report.name || "--")}</th>
    <td><span class="${reportStatusClass(status)}">${escapeHtml(status)}</span></td>
    <td>${escapeHtml(requiredLabel(report.required))}</td>
    <td><code>${escapeHtml(report.path || "--")}</code></td>
    <td>${escapeHtml(formatNumber(Number(report.size_bytes) || 0))}</td>
    <td><code>${escapeHtml(report.sha256 || "--")}</code></td>
  </tr>`;
}

function indexReports(index) {
  return index && Array.isArray(index.reports) ? index.reports : [];
}

function poolCoreLedgerReport(reports) {
  return reports.find((report) => String(report.name || "") === POOL_CORE_LEDGER_REPORT_NAME) || null;
}

function poolCoreFixtureLedgerReport(reports) {
  return reports.find((report) => String(report.name || "") === POOL_CORE_FIXTURE_LEDGER_REPORT_NAME) || null;
}

function poolCoreFileLedgerReport(reports) {
  return reports.find((report) => String(report.name || "") === POOL_CORE_FILE_LEDGER_REPORT_NAME) || null;
}

function bridgeCompareReport(reports) {
  return reports.find((report) => String(report.name || "") === BRIDGE_COMPARE_REPORT_NAME) || null;
}

function bridgeFileCompareReport(reports) {
  return reports.find((report) => String(report.name || "") === BRIDGE_FILE_COMPARE_REPORT_NAME) || null;
}

function bridgeFileReport(reports) {
  return reports.find((report) => String(report.name || "") === BRIDGE_FILE_REPORT_NAME) || null;
}

function localDryRunReport(reports) {
  return reports.find((report) => String(report.name || "") === PHASE_H_LOCAL_DRY_RUN_REPORT_NAME) || null;
}

function serviceReadinessReport(reports) {
  return reports.find((report) => String(report.name || "") === PHASE_I_SERVICE_READINESS_REPORT_NAME) || null;
}

function poolCoreReplayStatus(report) {
  if (!report) return "missing";
  return String(report.replay_status || report.status || "unknown");
}

function compareMatchLabel(report, key) {
  return booleanFieldLabel(report, key);
}

function booleanFieldLabel(report, key) {
  if (!report || !(key in report)) return "--";
  return report[key] === true ? "yes" : "no";
}

function numberFieldLabel(report, key) {
  if (!report || !(key in report)) return "--";
  return formatNumber(Number(report[key]) || 0);
}

function requiredLabel(required) {
  return required === true ? "yes" : "no";
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
      <p>Run <code>.&#92;scripts&#92;report-agent-telemetry.ps1</code> to write <code>${escapeHtml(TELEMETRY_JSON_PATH)}</code>.</p>
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
      <p>Run <code>.&#92;scripts&#92;report-agent-decision.ps1</code> to write <code>${escapeHtml(DECISION_JSON_PATH)}</code>.</p>
    </div>
  </section>`;
}

function missingIndexPanel() {
  return `<section class=panel>
    <div class=panel-header>
      <div>
        <h2>DBYTE Report Index</h2>
        <p class=muted>Local report index JSON is not available yet.</p>
      </div>
    </div>
    <div class=card>
      <p>Run <code>.&#92;scripts&#92;report-agent-index.ps1</code> to write <code>${escapeHtml(INDEX_JSON_PATH)}</code>.</p>
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
      <p>Run <code>.&#92;scripts&#92;report-agent-telemetry.ps1</code>, <code>.&#92;scripts&#92;report-agent-decision.ps1</code>, and <code>.&#92;scripts&#92;report-agent-index.ps1</code> to write local dashboard artifacts.</p>
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

function reportStatusClass(status) {
  if (status === "ok" || status === "present") return "green";
  if (status === "missing" || status === "attention" || status === "blocked") return "red";
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
