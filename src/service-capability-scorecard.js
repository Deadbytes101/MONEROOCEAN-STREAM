import { assessServiceReadiness } from "./service-readiness.js";

export function buildServiceCapabilityScorecard(input = {}) {
  const readiness = input.readiness || assessServiceReadiness(input);
  const checks = {
    readiness_ok: readiness.valid === true && readiness.status === "ok",
    report_only: readiness.summary.report_only === true,
    report_index_projection: readiness.readiness_closure.dashboard_projection_source === "report_index",
    runtime_absent: readiness.summary.runtime_enabled === false && readiness.readiness_closure.runtime_present === false,
    intake_absent: readiness.readiness_closure.intake_present === false,
    value_movement_absent: readiness.readiness_closure.value_movement_present === false,
    launch_not_allowed: readiness.launch_contract.launch_allowed === false,
    launch_runtime_absent: readiness.launch_contract.runtime_started === false,
    launch_bind_absent: readiness.launch_contract.bind_implemented === false,
    launch_intake_absent: readiness.launch_contract.external_worker_intake === false
  };
  const blockers = collectBlockers(checks);
  const capabilities = buildCapabilities(readiness, checks);
  const earnedScore = capabilities.reduce((sum, capability) => sum + capability.score, 0);
  const maxScore = capabilities.reduce((sum, capability) => sum + capability.max_score, 0);

  return {
    schema: 1,
    status: blockers.length === 0 ? "ok" : "attention",
    mode: "report_only_capability_scorecard",
    report_only: true,
    competitive_target: "evidence_first_operator_pool",
    max_score: maxScore,
    score: earnedScore,
    score_percent: maxScore === 0 ? 0 : Number(((earnedScore / maxScore) * 100).toFixed(2)),
    checks,
    capabilities,
    summary: {
      capability_count: capabilities.length,
      ok_capabilities: capabilities.filter((capability) => capability.status === "ok").length,
      attention_capabilities: capabilities.filter((capability) => capability.status === "attention").length,
      planned_capabilities: capabilities.filter((capability) => capability.status === "planned").length,
      blocker_count: blockers.length,
      report_only: true,
      runtime_present: false,
      intake_present: false,
      value_movement_present: false,
      next_step: blockers.length === 0 ? "compare_operator_metrics" : "fix_capability_blockers"
    },
    blockers
  };
}

function buildCapabilities(readiness, checks) {
  return [
    capability("deterministic_replay_spine", checks.readiness_ok, 20, [
      "service_readiness_status_ok",
      "phase_i_gate_ok",
      `blockers=${readiness.summary.blocker_count}`
    ]),
    capability("operator_report_index_projection", checks.report_index_projection, 20, [
      `dashboard_projection_source=${readiness.readiness_closure.dashboard_projection_source}`,
      `readiness_dashboard_projected=${readiness.readiness_closure.readiness_dashboard_projected}`,
      `launch_contract_dashboard_projected=${readiness.readiness_closure.launch_contract_dashboard_projected}`
    ]),
    capability("runtime_boundary", checks.runtime_absent && checks.intake_absent, 20, [
      `runtime_enabled=${readiness.summary.runtime_enabled}`,
      `runtime_present=${readiness.readiness_closure.runtime_present}`,
      `intake_present=${readiness.readiness_closure.intake_present}`
    ]),
    capability("launch_control", checks.launch_not_allowed && checks.launch_runtime_absent && checks.launch_bind_absent && checks.launch_intake_absent, 20, [
      `launch_allowed=${readiness.launch_contract.launch_allowed}`,
      `runtime_started=${readiness.launch_contract.runtime_started}`,
      `bind_implemented=${readiness.launch_contract.bind_implemented}`,
      `external_worker_intake=${readiness.launch_contract.external_worker_intake}`
    ]),
    capability("value_movement_boundary", checks.value_movement_absent, 10, [
      `value_movement_present=${readiness.readiness_closure.value_movement_present}`,
      "settlement_execution=report_only"
    ]),
    {
      id: "controlled_listener",
      status: "planned",
      score: 0,
      max_score: 10,
      evidence: [
        "controlled_listener_not_implemented",
        "requires_later_localhost_only_gate"
      ]
    }
  ];
}

function capability(id, ok, maxScore, evidence) {
  return {
    id,
    status: ok ? "ok" : "attention",
    score: ok ? maxScore : 0,
    max_score: maxScore,
    evidence
  };
}

function collectBlockers(checks) {
  const blockers = [];

  if (!checks.readiness_ok) blockers.push("readiness_not_ok");
  if (!checks.report_only) blockers.push("scorecard_requires_report_only_readiness");
  if (!checks.report_index_projection) blockers.push("dashboard_projection_must_come_from_report_index");
  if (!checks.runtime_absent) blockers.push("runtime_must_remain_absent_for_scorecard");
  if (!checks.intake_absent) blockers.push("intake_must_remain_absent_for_scorecard");
  if (!checks.value_movement_absent) blockers.push("value_movement_must_remain_absent_for_scorecard");
  if (!checks.launch_not_allowed) blockers.push("launch_must_remain_not_allowed_for_scorecard");
  if (!checks.launch_runtime_absent) blockers.push("launch_runtime_must_remain_absent_for_scorecard");
  if (!checks.launch_bind_absent) blockers.push("launch_bind_must_remain_absent_for_scorecard");
  if (!checks.launch_intake_absent) blockers.push("launch_intake_must_remain_absent_for_scorecard");

  return blockers;
}
