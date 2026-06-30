#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { projectAccounting } from "../src/accounting-projection.js";
import { makeFakeJobSource } from "../src/job-source.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replaySessionRegistry } from "../src/session-registry.js";
import { planSettlement } from "../src/settlement-plan.js";
import { replayShareIntake } from "../src/share-intake.js";

const args = process.argv.slice(2);
const protocolPath = optionValue(args, "--protocol") || "tests/fixtures/service-protocol.clean.jsonl";
const jobsPath = optionValue(args, "--jobs") || "tests/fixtures/job-source.clean.json";
const output = optionValue(args, "--out") || "reports/dbyte-settlement-plan.json";
const minAmountUnits = Number(optionValue(args, "--min-amount-units")) || 10;
const feeEstimateUnits = Number(optionValue(args, "--fee-estimate-units")) || 1;

const protocolSource = await readFile(protocolPath, "utf8");
const jobFixture = JSON.parse(await readFile(jobsPath, "utf8"));
const parsed = parseServiceProtocolJsonl(protocolSource);
const registry = replaySessionRegistry(parsed.messages);
const jobSource = makeFakeJobSource(jobFixture.jobs || []);
const intake = replayShareIntake(parsed.messages, jobSource, Number(jobFixture.now_ts_unix) || 0);
const accounting = projectAccounting({
  sessions: registry.sessions,
  outcomes: intake.outcomes,
  window: {
    window_id: "settlement-window",
    start_ts_unix: 0,
    end_ts_unix: Number(jobFixture.now_ts_unix) || 0
  }
});
const plan = planSettlement({
  rows: accounting.rows,
  policy: {
    min_amount_units: minAmountUnits,
    fee_estimate_units: feeEstimateUnits,
    reward_per_difficulty_units: 1
  }
});
const status = parsed.valid && registry.valid && jobSource.valid && intake.valid && accounting.valid && plan.valid ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  protocol_path: protocolPath,
  jobs_path: jobsPath,
  input_valid: parsed.valid,
  registry_valid: registry.valid,
  job_source_valid: jobSource.valid,
  intake_valid: intake.valid,
  accounting_valid: accounting.valid,
  plan_valid: plan.valid,
  execution_enabled: false,
  operator_approval_required: true,
  policy: plan.policy,
  summary: plan.summary,
  rows: plan.rows,
  parse_errors: parsed.errors,
  registry_errors: registry.errors,
  job_errors: jobSource.errors
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`settlement.plan.report=${output}`);
console.log(`settlement.plan.status=${status}`);
console.log(`settlement.plan.rows=${plan.summary.plan_rows}`);
console.log(`settlement.plan.review_rows=${plan.summary.review_rows}`);
console.log(`settlement.plan.execution_enabled=${report.execution_enabled}`);

if (status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
