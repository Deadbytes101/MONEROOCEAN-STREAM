export function assessServiceReadiness(input = {}) {
  const config = normalizeConfig(input.config || {});
  const evidence = normalizeEvidence(input.evidence || {});
  const checks = {
    config_schema_valid: true,
    phase_h_gate_ok: evidence.phase_h_status === "ok",
    runtime_disabled: config.enabled === false,
    local_mode: config.mode === "local",
    payload_limit_present: config.max_payload_bytes > 0,
    message_limit_present: config.max_messages_per_session > 0,
    operator_approval_required: config.operator_approval_required === true,
    preflight_local_endpoint: config.preflight.endpoint === "127.0.0.1",
    preflight_report_only: true,
    report_only: true
  };
  const blockers = collectBlockers(config, checks);

  return {
    valid: blockers.length === 0,
    status: blockers.length === 0 ? "ok" : "attention",
    mode: "phase_i_readiness_planning",
    config,
    evidence,
    checks,
    preflight: {
      status: blockers.length === 0 ? "ok" : "attention",
      enabled: config.preflight.enabled,
      endpoint: config.preflight.endpoint,
      port: config.preflight.port,
      report_only: true,
      runtime_enabled: false,
      local_endpoint: config.preflight.endpoint === "127.0.0.1",
      operator_visible: true
    },
    summary: {
      blocker_count: blockers.length,
      report_only: true,
      runtime_enabled: false,
      preflight_enabled: config.preflight.enabled,
      preflight_report_only: true,
      next_step: blockers.length === 0 ? "review_configuration" : "fix_readiness_blockers"
    },
    blockers
  };
}

function normalizeConfig(config) {
  return {
    enabled: config.enabled === true,
    mode: String(config.mode || "local"),
    max_payload_bytes: normalizeInteger(config.max_payload_bytes, 4096),
    max_messages_per_session: normalizeInteger(config.max_messages_per_session, 100),
    operator_approval_required: config.operator_approval_required !== false,
    public_mode_acknowledged: config.public_mode_acknowledged === true,
    preflight: normalizePreflight(config.preflight || {})
  };
}

function normalizePreflight(preflight) {
  return {
    enabled: preflight.enabled === true,
    endpoint: String(preflight.endpoint || "127.0.0.1"),
    port: normalizeInteger(preflight.port, 0)
  };
}

function normalizeEvidence(evidence) {
  return {
    phase_a_status: String(evidence.phase_a_status || "ok"),
    phase_b_status: String(evidence.phase_b_status || "ok"),
    phase_c_status: String(evidence.phase_c_status || "ok"),
    phase_d_status: String(evidence.phase_d_status || "ok"),
    phase_e_status: String(evidence.phase_e_status || "ok"),
    phase_f_status: String(evidence.phase_f_status || "ok"),
    phase_g_status: String(evidence.phase_g_status || "ok"),
    phase_h_status: String(evidence.phase_h_status || "ok"),
    release_manifest_approved: evidence.release_manifest_approved !== false
  };
}

function collectBlockers(config, checks) {
  const blockers = [];

  if (!checks.phase_h_gate_ok) blockers.push("phase_h_gate_not_ok");
  if (!checks.runtime_disabled) blockers.push("runtime_must_remain_disabled_in_readiness_phase");
  if (!checks.local_mode) blockers.push("default_mode_must_remain_local");
  if (!checks.payload_limit_present) blockers.push("missing_payload_limit");
  if (!checks.message_limit_present) blockers.push("missing_message_limit");
  if (!checks.operator_approval_required) blockers.push("operator_approval_required");
  if (!checks.preflight_local_endpoint) blockers.push("preflight_endpoint_must_remain_local");
  if (config.mode !== "local" && config.public_mode_acknowledged !== true) blockers.push("non_local_mode_requires_visible_acknowledgement");

  return blockers;
}

function normalizeInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}
