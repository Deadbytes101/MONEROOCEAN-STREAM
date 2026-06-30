const KNOWN_MESSAGES = new Set([
  "connect",
  "authorize",
  "subscribe",
  "job",
  "submit",
  "accepted",
  "rejected",
  "disconnect"
]);

export function parseServiceProtocolJsonl(source) {
  const messages = [];
  const errors = [];
  const lines = String(source || "").split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    let record;
    try {
      record = JSON.parse(trimmed);
    } catch (error) {
      errors.push(parseError(lineNumber, "invalid_json", rawLine, error.message));
      return;
    }

    const validationError = validateProtocolMessage(record);
    if (validationError) {
      errors.push(parseError(lineNumber, validationError, rawLine));
      return;
    }

    messages.push({ ...record, line_number: lineNumber });
  });

  return {
    valid: errors.length === 0,
    messages,
    errors
  };
}

export function summarizeServiceProtocol(messages) {
  const sessions = new Set();
  const summary = {
    total_messages: 0,
    connect: 0,
    authorize: 0,
    subscribe: 0,
    job: 0,
    submit: 0,
    accepted: 0,
    rejected: 0,
    disconnect: 0,
    credited_difficulty: 0,
    session_count: 0,
    last_message: "<none>"
  };

  for (const record of messages || []) {
    const message = String(record.message || "");
    summary.total_messages += 1;
    summary.last_message = message;
    sessions.add(String(record.session_id));

    if (Object.prototype.hasOwnProperty.call(summary, message)) {
      summary[message] += 1;
    }

    if (message === "accepted") {
      summary.credited_difficulty += Math.max(0, Number(record.credited_difficulty) || 0);
    }
  }

  summary.session_count = sessions.size;
  return summary;
}

function validateProtocolMessage(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "record_not_object";
  if (record.schema !== 1) return "unsupported_schema";
  if (typeof record.message !== "string" || !KNOWN_MESSAGES.has(record.message)) return "unknown_message";
  if (typeof record.session_id !== "string" || record.session_id.trim() === "") return "missing_session_id";
  if (!Number.isFinite(Number(record.ts_unix)) || Number(record.ts_unix) < 0) return "invalid_timestamp";

  if (record.message === "authorize" && isBlank(record.account_id)) return "missing_account_id";
  if (record.message === "job" && isBlank(record.job_id)) return "missing_job_id";
  if (record.message === "submit" && isBlank(record.job_id)) return "missing_job_id";
  if (record.message === "submit" && isBlank(record.nonce)) return "missing_nonce";
  if (record.message === "submit" && (!Number.isFinite(Number(record.share_difficulty)) || Number(record.share_difficulty) < 0)) return "invalid_share_difficulty";
  if (record.message === "accepted" && isBlank(record.job_id)) return "missing_job_id";
  if (record.message === "accepted" && (!Number.isFinite(Number(record.credited_difficulty)) || Number(record.credited_difficulty) < 0)) return "invalid_credited_difficulty";
  if (record.message === "rejected" && isBlank(record.reason)) return "missing_reject_reason";

  return null;
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function parseError(lineNumber, reason, rawLine, detail = "") {
  return {
    line_number: lineNumber,
    reason,
    raw_line: rawLine,
    detail
  };
}
