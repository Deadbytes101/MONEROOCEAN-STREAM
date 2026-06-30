export function parseBridgeLedgerText(source) {
  const errors = [];
  const sessions = [];
  const jobs = [];
  const assignments = new Set();
  const submissions = [];

  String(source || "").split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const fields = line.split(",").map((field) => field.trim());
    const kind = fields[0] || "";

    if (kind === "session") {
      if (fields.length !== 4) {
        errors.push(error(lineNumber, "invalid_session_record", rawLine));
        return;
      }
      const difficulty = parsePositiveInteger(fields[3]);
      if (!fields[1] || !fields[2] || difficulty === null) {
        errors.push(error(lineNumber, "invalid_session_fields", rawLine));
        return;
      }
      sessions.push({ wallet: fields[1], worker: fields[2], difficulty });
      return;
    }

    if (kind === "job") {
      if (fields.length !== 3) {
        errors.push(error(lineNumber, "invalid_job_record", rawLine));
        return;
      }
      const height = parsePositiveInteger(fields[1]);
      const requiredDifficulty = parsePositiveInteger(fields[2]);
      if (height === null || requiredDifficulty === null) {
        errors.push(error(lineNumber, "invalid_job_fields", rawLine));
        return;
      }
      jobs.push({ height, required_difficulty: requiredDifficulty });
      return;
    }

    if (kind === "assign") {
      if (fields.length !== 3) {
        errors.push(error(lineNumber, "invalid_assign_record", rawLine));
        return;
      }
      const sessionIndex = lookupIndex(fields[1], sessions.length);
      const jobIndex = lookupIndex(fields[2], jobs.length);
      if (sessionIndex === null || jobIndex === null) {
        errors.push(error(lineNumber, "invalid_assign_indexes", rawLine));
        return;
      }
      assignments.add(`${sessionIndex}:${jobIndex}`);
      return;
    }

    if (kind === "submit") {
      if (fields.length !== 5) {
        errors.push(error(lineNumber, "invalid_submit_record", rawLine));
        return;
      }
      const sessionIndex = lookupIndex(fields[1], sessions.length);
      const jobIndex = lookupIndex(fields[2], jobs.length);
      const nonce = parseNonNegativeInteger(fields[3]);
      const difficulty = parseNonNegativeInteger(fields[4]);
      if (sessionIndex === null || jobIndex === null || nonce === null || difficulty === null) {
        errors.push(error(lineNumber, "invalid_submit_fields", rawLine));
        return;
      }
      if (!assignments.has(`${sessionIndex}:${jobIndex}`)) {
        errors.push(error(lineNumber, "unassigned_submit", rawLine));
        return;
      }

      const session = sessions[sessionIndex];
      const job = jobs[jobIndex];
      const requiredDifficulty = Math.max(session.difficulty, job.required_difficulty);
      const accepted = difficulty >= requiredDifficulty;
      submissions.push({
        session_index: sessionIndex + 1,
        job_index: jobIndex + 1,
        nonce,
        difficulty,
        accepted,
        credited_difficulty: accepted ? requiredDifficulty : 0
      });
      return;
    }

    errors.push(error(lineNumber, "unknown_record", rawLine));
  });

  const acceptedEvents = submissions.filter((item) => item.accepted).length;
  const rejectedEvents = submissions.length - acceptedEvents;
  const creditedDifficulty = submissions.reduce((sum, item) => sum + item.credited_difficulty, 0);

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      total_events: submissions.length,
      accepted_events: acceptedEvents,
      rejected_events: rejectedEvents,
      credited_difficulty: creditedDifficulty,
      session_count: sessions.length,
      job_count: jobs.length,
      assignment_count: assignments.size
    },
    sessions,
    jobs,
    submissions
  };
}

function lookupIndex(value, length) {
  const parsed = parsePositiveInteger(value);
  if (parsed === null) return null;
  const index = parsed - 1;
  if (index < 0 || index >= length) return null;
  return index;
}

function parsePositiveInteger(value) {
  const parsed = parseNonNegativeInteger(value);
  if (parsed === null || parsed === 0) return null;
  return parsed;
}

function parseNonNegativeInteger(value) {
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function error(lineNumber, reason, rawLine) {
  return { line_number: lineNumber, reason, raw_line: rawLine };
}
