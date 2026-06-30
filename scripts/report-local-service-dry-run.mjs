#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { makeFakeJobSource } from "../src/job-source.js";
import { runLocalServiceDryRun } from "../src/local-service-dry-run.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";

const args = process.argv.slice(2);
const protocolPath = optionValue(args, "--protocol") || "tests/fixtures/service-protocol.clean.jsonl";
const jobsPath = optionValue(args, "--jobs") || "tests/fixtures/job-source.clean.json";
const output = optionValue(args, "--out") || "reports/dbyte-local-service-dry-run.json";
const maxMessagesPerSession = Number(optionValue(args, "--max-messages-per-session")) || 100;

const protocolSource = await readFile(protocolPath, "utf8");
const jobFixture = JSON.parse(await readFile(jobsPath, "utf8"));
const parsed = parseServiceProtocolJsonl(protocolSource);
const jobSource = makeFakeJobSource(jobFixture.jobs || []);
const dryRun = runLocalServiceDryRun({
  messages: parsed.messages,
  malformed_count: parsed.errors.length,
  jobSource,
  now_ts_unix: Number(jobFixture.now_ts_unix) || 0,
  limits: { max_messages_per_session: maxMessagesPerSession }
});
const status = parsed.valid && jobSource.valid && dryRun.valid ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  protocol_path: protocolPath,
  jobs_path: jobsPath,
  input_valid: parsed.valid,
  job_source_valid: jobSource.valid,
  dry_run_valid: dryRun.valid,
  mode: dryRun.mode,
  listener_enabled: dryRun.listener_enabled,
  external_bind_enabled: dryRun.external_bind_enabled,
  live_worker_intake_enabled: dryRun.live_worker_intake_enabled,
  startup: dryRun.startup,
  shutdown: dryRun.shutdown,
  counters: dryRun.counters,
  dashboard_projection: dryRun.dashboard_projection,
  replayable: dryRun.replayable,
  errors: dryRun.errors,
  parse_errors: parsed.errors,
  job_errors: jobSource.errors
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`local.dry_run.report=${output}`);
console.log(`local.dry_run.status=${status}`);
console.log(`local.dry_run.listener_enabled=${dryRun.listener_enabled}`);
console.log(`local.dry_run.messages=${dryRun.counters.input_messages}`);
console.log(`local.dry_run.errors=${dryRun.counters.error_count}`);

if (status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
