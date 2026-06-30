export function planDifficultyPolicy(input = {}) {
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  const policy = normalizePolicy(input.policy || {}, input.jobSource);
  const assignments = sessions
    .map((session) => planSessionDifficulty(session, policy))
    .sort((a, b) => a.session_id.localeCompare(b.session_id));

  return {
    valid: true,
    policy,
    assignments,
    summary: summarizeAssignments(assignments, policy)
  };
}

function normalizePolicy(policy, jobSource) {
  const staticDifficulty = Number(policy.static_difficulty) || minimumJobDifficulty(jobSource) || 1;
  return {
    mode: "static",
    dry_run: true,
    static_difficulty: Math.max(1, Math.floor(staticDifficulty)),
    reason: "static_policy"
  };
}

function minimumJobDifficulty(jobSource) {
  const difficulties = (jobSource?.templates || [])
    .map((job) => Number(job.difficulty) || 0)
    .filter((difficulty) => difficulty > 0);
  if (difficulties.length === 0) return 0;
  return Math.min(...difficulties);
}

function planSessionDifficulty(session, policy) {
  const assignedDifficulty = Number(session.assigned_difficulty) || policy.static_difficulty;
  return {
    session_id: String(session.session_id || ""),
    worker: String(session.worker || ""),
    state: String(session.state || "unknown"),
    assigned_difficulty: assignedDifficulty,
    recommended_difficulty: assignedDifficulty,
    action: "keep",
    reason: policy.reason,
    dry_run: true
  };
}

function summarizeAssignments(assignments, policy) {
  const difficulties = assignments.map((assignment) => assignment.assigned_difficulty);
  return {
    status: "ok",
    dry_run: true,
    policy_mode: policy.mode,
    session_count: assignments.length,
    recommended_changes: assignments.filter((assignment) => assignment.action !== "keep").length,
    minimum_assigned_difficulty: difficulties.length ? Math.min(...difficulties) : 0,
    maximum_assigned_difficulty: difficulties.length ? Math.max(...difficulties) : 0,
    reason_count: new Set(assignments.map((assignment) => assignment.reason)).size
  };
}
