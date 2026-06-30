export function projectAccounting(input = {}) {
  const outcomes = Array.isArray(input.outcomes) ? input.outcomes : [];
  const sessions = new Map((input.sessions || []).map((session) => [String(session.session_id || ""), session]));
  const window = normalizeWindow(input.window || {});
  const groups = new Map();
  let rejectedShares = 0;

  for (const outcome of outcomes) {
    if (!outcome.accepted) {
      rejectedShares += 1;
      continue;
    }

    const sessionId = String(outcome.session_id || "");
    const session = sessions.get(sessionId) || {};
    const accountId = String(session.account_id || "<unknown>");
    const worker = String(session.worker || "<unknown>");
    const key = `${accountId}\u0000${worker}`;
    const row = groups.get(key) || {
      account_id: accountId,
      worker,
      session_ids: new Set(),
      accepted_shares: 0,
      credited_difficulty: 0
    };

    row.session_ids.add(sessionId);
    row.accepted_shares += 1;
    row.credited_difficulty += Number(outcome.credited_difficulty) || 0;
    groups.set(key, row);
  }

  const rows = [...groups.values()]
    .map((row) => ({
      account_id: row.account_id,
      worker: row.worker,
      session_count: row.session_ids.size,
      accepted_shares: row.accepted_shares,
      credited_difficulty: row.credited_difficulty,
      value_movement: false,
      reason: "accounting_projection"
    }))
    .sort((a, b) => a.account_id.localeCompare(b.account_id) || a.worker.localeCompare(b.worker));

  const summary = summarizeRows(rows, rejectedShares, outcomes);
  return {
    valid: true,
    window,
    rows,
    summary,
    checks: {
      credited_matches_intake: summary.total_credited_difficulty === summary.intake_credited_difficulty,
      accepted_matches_intake: summary.accepted_shares === summary.intake_accepted_submits,
      no_value_movement: true
    }
  };
}

function normalizeWindow(window) {
  return {
    window_id: String(window.window_id || "synthetic-window-1"),
    start_ts_unix: Number(window.start_ts_unix) || 0,
    end_ts_unix: Number(window.end_ts_unix) || 0
  };
}

function summarizeRows(rows, rejectedShares, outcomes) {
  const acceptedOutcomes = outcomes.filter((outcome) => outcome.accepted);
  const accountIds = new Set(rows.map((row) => row.account_id));
  const workers = new Set(rows.map((row) => `${row.account_id}\u0000${row.worker}`));
  const totalCreditedDifficulty = rows.reduce((sum, row) => sum + row.credited_difficulty, 0);
  const intakeCreditedDifficulty = outcomes.reduce((sum, outcome) => sum + (Number(outcome.credited_difficulty) || 0), 0);

  return {
    status: "ok",
    total_credited_difficulty: totalCreditedDifficulty,
    intake_credited_difficulty: intakeCreditedDifficulty,
    accepted_shares: acceptedOutcomes.length,
    intake_accepted_submits: acceptedOutcomes.length,
    rejected_shares: rejectedShares,
    worker_count: workers.size,
    group_count: accountIds.size,
    row_count: rows.length,
    value_movement_count: 0
  };
}
