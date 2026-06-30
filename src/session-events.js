const KNOWN_EVENTS = new Set([
  "session_started",
  "sample_observed",
  "unit_accepted",
  "unit_rejected",
  "session_exited",
  "launch_refused"
]);

export function parseSessionEventJsonl(source) {
  const events = [];
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

    const validationError = validateSessionEvent(record);
    if (validationError) {
      errors.push(parseError(lineNumber, validationError, rawLine));
      return;
    }

    events.push({ ...record, line_number: lineNumber });
  });

  return {
    valid: errors.length === 0,
    events,
    errors
  };
}

export function summarizeSessionEvents(events) {
  const summary = {
    total_events: 0,
    session_started: 0,
    sample_observed: 0,
    unit_accepted: 0,
    unit_rejected: 0,
    session_exited: 0,
    launch_refused: 0,
    credited_units: 0,
    last_event: "<none>"
  };

  for (const record of events || []) {
    const eventName = String(record.event || "");
    summary.total_events += 1;
    summary.last_event = eventName;

    if (Object.prototype.hasOwnProperty.call(summary, eventName)) {
      summary[eventName] += 1;
    }

    if (eventName === "unit_accepted") {
      summary.credited_units += Math.max(0, Number(record.credited_units) || 0);
    }
  }

  return summary;
}

function validateSessionEvent(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "record_not_object";
  if (record.schema !== 1) return "unsupported_schema";
  if (typeof record.event !== "string" || !KNOWN_EVENTS.has(record.event)) return "unknown_event";
  if (typeof record.rig_id !== "string" || record.rig_id.trim() === "") return "missing_rig_id";
  if (!Number.isFinite(Number(record.ts_unix)) || Number(record.ts_unix) < 0) return "invalid_timestamp";
  if (record.event === "sample_observed" && (!Number.isFinite(Number(record.sample_value)) || Number(record.sample_value) < 0)) return "invalid_sample_value";
  if (record.event === "unit_accepted" && (!Number.isFinite(Number(record.credited_units)) || Number(record.credited_units) < 0)) return "invalid_credited_units";
  if (record.event === "session_exited" && !Number.isInteger(Number(record.exit_code))) return "invalid_exit_code";
  return null;
}

function parseError(lineNumber, reason, rawLine, detail = "") {
  return {
    line_number: lineNumber,
    reason,
    raw_line: rawLine,
    detail
  };
}
