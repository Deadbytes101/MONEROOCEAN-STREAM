import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseSessionEventJsonl, summarizeSessionEvents } from "../src/session-events.js";

test.describe("session event parser", { concurrency: false }, () => {
  test("parses clean session event fixture and summarizes counters", async () => {
    const source = await readFile("tests/fixtures/session-events.clean.jsonl", "utf8");
    const result = parseSessionEventJsonl(source);
    const summary = summarizeSessionEvents(result.events);

    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
    assert.equal(result.events.length, 5);
    assert.deepEqual(summary, {
      total_events: 5,
      session_started: 1,
      sample_observed: 1,
      unit_accepted: 1,
      unit_rejected: 1,
      session_exited: 1,
      launch_refused: 0,
      credited_units: 10,
      last_event: "session_exited"
    });
  });

  test("keeps raw rejected lines for audit", () => {
    const result = parseSessionEventJsonl([
      "not-json",
      JSON.stringify({ schema: 1, event: "missing", rig_id: "a960d-lab", ts_unix: 1 }),
      JSON.stringify({ schema: 1, event: "session_started", rig_id: "", ts_unix: 2 })
    ].join("\n"));

    assert.equal(result.valid, false);
    assert.equal(result.events.length, 0);
    assert.equal(result.errors.length, 3);
    assert.equal(result.errors[0].line_number, 1);
    assert.equal(result.errors[0].reason, "invalid_json");
    assert.equal(result.errors[0].raw_line, "not-json");
    assert.equal(result.errors[1].reason, "unknown_event");
    assert.equal(result.errors[2].reason, "missing_rig_id");
    assert.doesNotMatch(JSON.stringify(result), /undefined|NaN/);
  });
});
