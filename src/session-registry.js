const FINAL_STATES = new Set(["closed", "rejected"]);

export function replaySessionRegistry(messages) {
  const sessions = new Map();
  const events = [];
  const errors = [];

  for (const record of messages || []) {
    const sessionId = String(record.session_id || "");
    const current = sessions.get(sessionId) || newSession(sessionId);
    const next = applyMessage(current, record);

    if (next.error) {
      errors.push({
        line_number: record.line_number || 0,
        session_id: sessionId,
        message: String(record.message || ""),
        reason: next.error,
        state: current.state
      });
      continue;
    }

    sessions.set(sessionId, next.session);
    events.push({
      line_number: record.line_number || 0,
      session_id: sessionId,
      message: String(record.message || ""),
      state: next.session.state
    });
  }

  const rows = [...sessions.values()].sort((a, b) => a.session_id.localeCompare(b.session_id));
  return {
    valid: errors.length === 0,
    sessions: rows,
    events,
    errors,
    summary: summarizeRows(rows, errors)
  };
}

function newSession(sessionId) {
  return {
    session_id: sessionId,
    state: "pending",
    account_id: "",
    worker: "",
    job_id: "",
    accepted: 0,
    rejected: 0,
    credited_difficulty: 0,
    last_message: "<none>"
  };
}

function applyMessage(session, record) {
  const message = String(record.message || "");
  if (FINAL_STATES.has(session.state) && message !== "disconnect") return { error: "session_final" };

  switch (message) {
    case "connect":
      return transition(session, record, ["pending"], "connected", {
        worker: String(record.worker || "")
      });
    case "authorize":
      return transition(session, record, ["connected"], "authorized", {
        account_id: String(record.account_id || ""),
        worker: String(record.worker || session.worker || "")
      });
    case "subscribe":
      return transition(session, record, ["authorized"], "subscribed");
    case "job":
      return transition(session, record, ["subscribed", "active"], "active", {
        job_id: String(record.job_id || "")
      });
    case "submit":
      if (session.state !== "active") return { error: "submit_before_active" };
      if (String(record.job_id || "") !== session.job_id) return { error: "submit_unknown_job" };
      return transition(session, record, ["active"], "active");
    case "accepted":
      if (session.state !== "active") return { error: "accepted_before_active" };
      if (String(record.job_id || "") !== session.job_id) return { error: "accepted_unknown_job" };
      return transition(session, record, ["active"], "active", {
        accepted: session.accepted + 1,
        credited_difficulty: session.credited_difficulty + Math.max(0, Number(record.credited_difficulty) || 0)
      });
    case "rejected":
      return transition(session, record, ["connected", "authorized", "subscribed", "active", "pending"], "rejected", {
        rejected: session.rejected + 1
      });
    case "disconnect":
      return transition(session, record, ["connected", "authorized", "subscribed", "active", "rejected"], "closed");
    default:
      return { error: "unknown_message" };
  }
}

function transition(session, record, allowedStates, state, updates = {}) {
  if (!allowedStates.includes(session.state)) return { error: `invalid_transition_${session.state}_to_${String(record.message || "")}` };
  return {
    session: {
      ...session,
      ...updates,
      state,
      last_message: String(record.message || "")
    }
  };
}

function summarizeRows(rows, errors) {
  return {
    session_count: rows.length,
    active_sessions: rows.filter((row) => row.state === "active").length,
    closed_sessions: rows.filter((row) => row.state === "closed").length,
    rejected_sessions: rows.filter((row) => row.state === "rejected").length,
    accepted: rows.reduce((sum, row) => sum + row.accepted, 0),
    rejected: rows.reduce((sum, row) => sum + row.rejected, 0),
    credited_difficulty: rows.reduce((sum, row) => sum + row.credited_difficulty, 0),
    error_count: errors.length
  };
}
