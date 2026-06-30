#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { planDifficultyPolicy } from "../src/difficulty-policy.js";
import { makeFakeJobSource } from "../src/job-source.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replaySessionRegistry } from "../src/session-registry.js";

const args = process.argv.slice(2);
const protocolPath = optionValue(args, "--protocol") || "tests/fixtures/service-protocol.clean.jsonl";
const jobsPath = optionValue(args, "--jobs") || "tests/fixtures/job-source.clean.json";
const output = optionValue(args, "--out") || "reports/dbyte-difficulty-policy.json";

const protocolSource = await readFile(protocolPath, "utf8");
const jobFixture = JSON.parse(await readFile(jobsPath, "utf8"));
const parsed = parseServiceProtocolJsonl(protocolSource);
const registry = replaySessionRegistry(parsed.messages);
const jobSource = makeFakeJobSource(jobFixture.jobs || []);
const plan = planDifficultyPolicy({ sessions: registry.sessions, jobSource });
const status = parsed.valid && registry.valid && jobSource.valid && plan.valid ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  protocol_path: protocolPath,
  jobs_path: jobsPath,
  input_valid: parsed.valid,
  registry_valid: registry.valid,
  job_source_valid: jobSource.valid,
  policy_valid: plan.valid,
  policy: plan.policy,
  summary: plan.summary,
  assignments: plan.assignments,
  parse_errors: parsed.errors,
  registry_errors: registry.errors,
  job_errors: jobSource.errors
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`difficulty.policy.report=${output}`);
console.log(`difficulty.policy.status=${status}`);
console.log(`difficulty.policy.mode=${plan.summary.policy_mode}`);
console.log(`difficulty.policy.sessions=${plan.summary.session_count}`);
console.log(`difficulty.policy.changes=${plan.summary.recommended_changes}`);

if (status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
