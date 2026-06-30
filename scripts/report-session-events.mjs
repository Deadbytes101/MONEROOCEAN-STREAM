#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseSessionEventJsonl, summarizeSessionEvents } from "../src/session-events.js";

const args = process.argv.slice(2);
const input = optionValue(args, "--in") || "tests/fixtures/session-events.clean.jsonl";
const output = optionValue(args, "--out") || "reports/dbyte-session-events-summary.json";
const source = await readFile(input, "utf8");
const parsed = parseSessionEventJsonl(source);
const summary = summarizeSessionEvents(parsed.events);
const status = parsed.valid ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  source_path: input,
  valid: parsed.valid,
  valid_events: parsed.events.length,
  invalid_events: parsed.errors.length,
  summary,
  errors: parsed.errors
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`session.report=${output}`);
console.log(`session.report_status=${status}`);
console.log(`session.valid_events=${parsed.events.length}`);
console.log(`session.invalid_events=${parsed.errors.length}`);

if (!parsed.valid) process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
