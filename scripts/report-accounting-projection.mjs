#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { projectAccounting } from "../src/accounting-projection.js";
import { makeFakeJobSource } from "../src/job-source.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replaySessionRegistry } from "../src/session-registry.js";
import { replayShareIntake } from "../src/share-intake.js";

const args = process.argv.slice(2);
const protocolPath = optionValue(args, "--protocol") || "tests/fixtures/service-protocol.clean.jsonl";
const jobsPath = optionValue(args, "--jobs") || "tests/fixtures/job-source.clean.json";
const output = optionValue(args, "--out") || "reports/dbyte-accounting-projection.json";
const windowId = optionValue(args, "--window-id") || "synthetic-window-1";

const protocolSource = await readFile(protocolPath, "utf8");
const jobFixture = JSON.parse(await readFile(jobsPath, "utf8"));
const parsed = parseServiceProtocolJsonl(protocolSource);
const registry = replaySessionRegistry(parsed.messages);
const jobSource = makeFakeJobSource(jobFixture.jobs || []);
const intake = replayShareIntake(parsed.messages, jobSource, Number(jobFixture.now_ts_unix) || 0);
const projection = projectAccounting({
  sessions: registry.sessions,
  outcomes: intake.outcomes,
  window: {
    window_id: windowId,
    start_ts_unix: 0,
    end_ts_unix: Number(jobFixture.now_ts_unix) || 0
  }
});
const status = parsed.valid && registry.valid && jobSource.valid && intake.valid && projection.valid && projection.checks.credited_matches_intake ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  protocol_path: protocolPath,
  jobs_path: jobsPath,
  input_valid: parsed.valid,
  registry_valid: registry.valid,
  job_source_valid: jobSource.valid,
  intake_valid: intake.valid,
  accounting_valid: projection.valid,
  window: projection.window,
  summary: projection.summary,
  checks: projection.checks,
  rows: projection.rows,
  parse_errors: parsed.errors,
  registry_errors: registry.errors,
  job_errors: jobSource.errors
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`accounting.projection.report=${output}`);
console.log(`accounting.projection.status=${status}`);
console.log(`accounting.projection.credited=${projection.summary.total_credited_difficulty}`);
console.log(`accounting.projection.rows=${projection.summary.row_count}`);
console.log(`accounting.projection.rejected=${projection.summary.rejected_shares}`);

if (status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
