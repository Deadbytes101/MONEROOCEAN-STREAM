import { isJobStale } from "./job-source.js";

export function replayShareIntake(messages, jobSource, nowUnix = 0) {
  const sessions = new Map();
  const jobs = new Map((jobSource?.templates || []).map((job) => [job.job_id, job]));
  const seenSubmits = new Set();
  const outcomes = [];

  for (const record of messages || []) {
    applyLifecycleMessage(sessions, record);
    if (record.message !== "submit") continue;

    const session = sessions.get(String(record.session_id || ""));
    const outcome = evaluateSubmit(record, session, jobs, seenSubmits, nowUnix);
    outcomes.push(outcome);
  }

  outcomes.sort((a, b) => a.line_number - b.line_number || a.session_id.localeCompare(b.session_id));

  return {
    valid: true,
    outcomes,
    summary: summarizeOutcomes(outcomes)
  };
}

function applyLifecycleMessage(sessions, record) {
  const sessionId = String(record.session_id || "");
  if (!sessionId) return;
  const current = sessions.get(sessionId) || {
    session_id: sessionId,
    state: "pending",
    job_id: ""
  };

  switch (record.message) {
    case "connect":
      sessions.set(sessionId, { ...current, state: "connected" });
      break;
    case "authorize":
      sessions.set(sessionId, { ...current, state: current.state === "connected" ? "authorized" : current.state });
      break;
    case "subscribe":
      sessions.set(sessionId, { ...current, state: current.state === "authorized" ? "subscribed" : current.state });
      break;
    case "job":
      sessions.set(sessionId, { ...current, state: current.state === "subscribed" || current.state === "active" ? "active" : current.state, job_id: String(record.job_id || "") });
      break;
    case "disconnect":
      sessions.set(sessionId, { ...current, state: "closed" });
      break;
    default:
      sessions.set(sessionId, current);
      break;
  }
}

function evaluateSubmit(record, session, jobs, seenSubmits, nowUnix) {
  const lineNumber = record.line_number || 0;
  const sessionId = String(record.session_id || "");
  const jobId = String(record.job_id || "");
  const nonce = String(record.nonce || "");
  const shareDifficulty = Math.max(0, Number(record.share_difficulty) || 0);
  const base = {
    line_number: lineNumber,
    session_id: sessionId,
    job_id: jobId,
    nonce,
    accepted: false,
    reason: "",
    share_difficulty: shareDifficulty,
    required_difficulty: 0,
    credited_difficulty: 0
  };

  if (!session || session.state !== "active") return reject(base, "session_not_active");
  if (session.job_id !== jobId) return reject(base, "session_job_mismatch");

  const job = jobs.get(jobId);
  if (!job) return reject(base, "unknown_job");

  const withJob = { ...base, required_difficulty: job.difficulty };
  if (isJobStale(job, Number(record.ts_unix) || nowUnix)) return reject(withJob, "job_expired");

  const submitKey = `${sessionId}:${jobId}:${nonce}`;
  if (seenSubmits.has(submitKey)) return reject(withJob, "duplicate_submit");
  seenSubmits.add(submitKey);

  if (shareDifficulty < job.difficulty) return reject(withJob, "low_difficulty");

  return {
    ...withJob,
    accepted: true,
    reason: "accepted",
    credited_difficulty: job.difficulty
  };
}

function reject(outcome, reason) {
  return {
    ...outcome,
    accepted: false,
    reason,
    credited_difficulty: 0
  };
}

function summarizeOutcomes(outcomes) {
  return {
    total_submits: outcomes.length,
    accepted_submits: outcomes.filter((outcome) => outcome.accepted).length,
    rejected_submits: outcomes.filter((outcome) => !outcome.accepted).length,
    credited_difficulty: outcomes.reduce((sum, outcome) => sum + outcome.credited_difficulty, 0),
    rejection_reasons: outcomes
      .filter((outcome) => !outcome.accepted)
      .map((outcome) => ({ line_number: outcome.line_number, session_id: outcome.session_id, job_id: outcome.job_id, reason: outcome.reason }))
  };
}
