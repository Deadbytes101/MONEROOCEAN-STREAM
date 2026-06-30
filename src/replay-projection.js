export function projectSessionSummaryToReplayReport(report) {
  const summary = report?.summary || {};
  const accepted = nonNegativeInteger(summary.unit_accepted);
  const rejected = nonNegativeInteger(summary.unit_rejected);
  const credited = nonNegativeInteger(summary.credited_units);
  const total = accepted + rejected;
  const sessionCount = total > 0 ? 1 : 0;

  return {
    schema: 1,
    status: report?.status === "ok" && report?.valid === true ? "ok" : "attention",
    source_schema: nonNegativeInteger(report?.schema),
    source_path: String(report?.source_path || "<unknown>"),
    total_events: total,
    accepted_events: accepted,
    rejected_events: rejected,
    credited_difficulty: credited,
    sessions: sessionCount === 0 ? [] : [{
      session_id: "fixture-session-1",
      accepted_shares: accepted,
      rejected_shares: rejected,
      credited_difficulty: credited
    }]
  };
}

function nonNegativeInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.trunc(number);
}
