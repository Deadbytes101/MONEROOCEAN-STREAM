export function planSettlement(input = {}) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const policy = normalizePolicy(input.policy || {});
  const planRows = rows
    .map((row) => planRow(row, policy))
    .sort((a, b) => a.account_id.localeCompare(b.account_id) || a.worker.localeCompare(b.worker));

  return {
    valid: true,
    policy,
    execution_enabled: false,
    operator_approval_required: true,
    rows: planRows,
    summary: summarizePlan(planRows)
  };
}

function normalizePolicy(policy) {
  return {
    mode: "threshold",
    min_amount_units: Math.max(1, Math.floor(Number(policy.min_amount_units) || 10)),
    reward_per_difficulty_units: Math.max(1, Math.floor(Number(policy.reward_per_difficulty_units) || 1)),
    fee_estimate_units: Math.max(0, Math.floor(Number(policy.fee_estimate_units) || 1)),
    execution_enabled: false,
    operator_approval_required: true
  };
}

function planRow(row, policy) {
  const creditedDifficulty = Math.max(0, Number(row.credited_difficulty) || 0);
  const amountUnits = creditedDifficulty * policy.reward_per_difficulty_units;
  const meetsThreshold = amountUnits >= policy.min_amount_units;
  const feeEstimateUnits = meetsThreshold ? Math.min(policy.fee_estimate_units, amountUnits) : 0;
  const netAmountUnits = Math.max(0, amountUnits - feeEstimateUnits);

  return {
    account_id: String(row.account_id || "<unknown>"),
    worker: String(row.worker || "<unknown>"),
    credited_difficulty: creditedDifficulty,
    amount_units: amountUnits,
    fee_estimate_units: feeEstimateUnits,
    net_amount_units: netAmountUnits,
    status: meetsThreshold ? "ready_for_review" : "below_threshold",
    reason: meetsThreshold ? "threshold_met" : "threshold_not_met",
    execution_enabled: false,
    operator_approval_required: true
  };
}

function summarizePlan(rows) {
  return {
    status: "ok",
    plan_rows: rows.length,
    review_rows: rows.filter((row) => row.status === "ready_for_review").length,
    held_rows: rows.filter((row) => row.status === "below_threshold").length,
    total_amount_units: rows.reduce((sum, row) => sum + row.amount_units, 0),
    total_fee_estimate_units: rows.reduce((sum, row) => sum + row.fee_estimate_units, 0),
    total_net_amount_units: rows.reduce((sum, row) => sum + row.net_amount_units, 0),
    execution_enabled: false,
    operator_approval_required: true,
    secret_material_stored: false
  };
}
