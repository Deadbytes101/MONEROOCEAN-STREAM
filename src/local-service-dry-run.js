import { projectAccounting } from "./accounting-projection.js";
import { makeFakeJobSource } from "./job-source.js";
import { planDifficultyPolicy } from "./difficulty-policy.js";
import { replaySessionRegistry } from "./session-registry.js";
import { planSettlement } from "./settlement-plan.js";
import { replayShareIntake } from "./share-intake.js";

export function runLocalServiceDryRun(input = {}) {
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const jobSource = input.jobSource || makeFakeJobSource([]);
  const nowUnix = Number(input.now_ts_unix) || 0;
  const limits = normalizeLimits(input.limits || {});
  const malformedCount = Math.max(0, Number(input.malformed_count) || 0);
  const rateLimitedMessages = countRateLimitedMessages(messages, limits);
  const registry = replaySessionRegistry(messages);
  const intake = replayShareIntake(messages, jobSource, nowUnix);
  const policy = planDifficultyPolicy({ sessions: registry.sessions, jobSource });
  const accounting = projectAccounting({
    sessions: registry.sessions,
    outcomes: intake.outcomes,
    window: {
      window_id: "local-dry-run-window",
      start_ts_unix: 0,
      end_ts_unix: nowUnix
    }
  });
  const settlement = planSettlement({
    rows: accounting.rows,
    policy: {
      min_amount_units: 10,
      fee_estimate_units: 1,
      reward_per_difficulty_units: 1
    }
  });
  const errors = [
    ...registry.errors.map((error) => ({ source: "registry", reason: error.reason || "registry_error" })),
    ...jobSource.errors.map((error) => ({ source: "job_source", reason: error.reason || "job_source_error" }))
  ];
  const status = errors.length === 0 && malformedCount === 0 && rateLimitedMessages === 0 ? "ok" : "attention";

  return {
    valid: status === "ok",
    status,
    mode: "local_fixture_dry_run",
    listener_enabled: false,
    external_bind_enabled: false,
    live_worker_intake_enabled: false,
    startup: {
      status: "ok",
      source: "fixture",
      listener: "disabled"
    },
    shutdown: {
      status: "ok",
      reason: "dry_run_complete"
    },
    counters: {
      input_messages: messages.length,
      malformed_messages: malformedCount,
      rate_limited_messages: rateLimitedMessages,
      error_count: errors.length,
      accepted_submits: intake.summary.accepted_submits,
      rejected_submits: intake.summary.rejected_submits,
      plan_rows: settlement.summary.plan_rows
    },
    dashboard_projection: {
      source: "report_files_only",
      registry_sessions: registry.summary.session_count,
      job_source_jobs: jobSource.summary?.total_jobs || jobSource.templates.length,
      intake_status: intake.summary.rejected_submits === 0 ? "ok" : "attention",
      policy_status: policy.summary.status,
      accounting_status: accounting.summary.status,
      settlement_status: settlement.summary.status
    },
    replayable: true,
    errors
  };
}

function normalizeLimits(limits) {
  return {
    max_messages_per_session: Math.max(1, Math.floor(Number(limits.max_messages_per_session) || 100))
  };
}

function countRateLimitedMessages(messages, limits) {
  const counts = new Map();
  let limited = 0;
  for (const message of messages) {
    const sessionId = String(message.session_id || "<missing>");
    const next = (counts.get(sessionId) || 0) + 1;
    counts.set(sessionId, next);
    if (next > limits.max_messages_per_session) limited += 1;
  }
  return limited;
}
