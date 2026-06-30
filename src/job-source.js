export function makeJobTemplate(input) {
  const job = {
    job_id: String(input?.job_id || ""),
    source: String(input?.source || "fake"),
    seed_hash: String(input?.seed_hash || ""),
    target: String(input?.target || ""),
    difficulty: Number(input?.difficulty) || 0,
    created_ts_unix: Number(input?.created_ts_unix) || 0,
    expires_ts_unix: Number(input?.expires_ts_unix) || 0
  };

  const error = validateJobTemplate(job);
  if (error) return { ok: false, error, job };
  return { ok: true, error: "", job };
}

export function makeFakeJobSource(jobs) {
  const templates = [];
  const errors = [];

  for (const input of jobs || []) {
    const result = makeJobTemplate(input);
    if (result.ok) templates.push(result.job);
    else errors.push({ job_id: result.job.job_id || "<missing>", reason: result.error });
  }

  templates.sort((a, b) => a.job_id.localeCompare(b.job_id));

  return {
    valid: errors.length === 0,
    templates,
    errors
  };
}

export function summarizeJobSource(source, nowUnix = 0) {
  const now = Number(nowUnix) || 0;
  const templates = source?.templates || [];
  const stale = templates.filter((job) => isJobStale(job, now));
  const active = templates.filter((job) => !isJobStale(job, now));

  return {
    status: source?.valid && stale.length === 0 ? "ok" : "attention",
    valid: source?.valid === true,
    total_jobs: templates.length,
    active_jobs: active.length,
    stale_jobs: stale.length,
    error_count: source?.errors?.length || 0,
    minimum_difficulty: templates.length ? Math.min(...templates.map((job) => job.difficulty)) : 0,
    maximum_difficulty: templates.length ? Math.max(...templates.map((job) => job.difficulty)) : 0,
    stale_reasons: stale.map((job) => ({ job_id: job.job_id, reason: "job_expired" }))
  };
}

export function isJobStale(job, nowUnix) {
  const now = Number(nowUnix) || 0;
  return Number(job?.expires_ts_unix) <= now;
}

function validateJobTemplate(job) {
  if (!job.job_id) return "missing_job_id";
  if (!job.seed_hash) return "missing_seed_hash";
  if (!job.target) return "missing_target";
  if (!Number.isFinite(job.difficulty) || job.difficulty <= 0) return "invalid_difficulty";
  if (!Number.isFinite(job.created_ts_unix) || job.created_ts_unix < 0) return "invalid_created_timestamp";
  if (!Number.isFinite(job.expires_ts_unix) || job.expires_ts_unix <= job.created_ts_unix) return "invalid_expiry";
  return "";
}
