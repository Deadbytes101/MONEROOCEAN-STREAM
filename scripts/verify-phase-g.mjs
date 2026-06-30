#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const reportPath = "reports/dbyte-settlement-plan.json";
const indexPath = "reports/dbyte-agent-index-phase-g.json";

rmSync(reportPath, { force: true });
rmSync(indexPath, { force: true });
mkdirSync(dirname(reportPath), { recursive: true });

step("phase G report export", execPath, [
  "scripts/report-settlement-plan.mjs",
  "--protocol",
  "tests/fixtures/service-protocol.clean.jsonl",
  "--jobs",
  "tests/fixtures/job-source.clean.json",
  "--out",
  reportPath,
  "--min-amount-units",
  "10",
  "--fee-estimate-units",
  "1"
]);

const report = readJson(reportPath);
check(report.schema, 1);
check(report.status, "ok");
check(report.input_valid, true);
check(report.registry_valid, true);
check(report.accounting_valid, true);
check(report.plan_valid, true);
check(report.execution_enabled, false);
check(report.operator_approval_required, true);
check(report.policy.mode, "threshold");
check(report.summary.plan_rows, 1);
check(report.summary.review_rows, 1);
check(report.summary.held_rows, 0);
check(report.summary.total_amount_units, 10);
check(report.summary.total_fee_estimate_units, 1);
check(report.summary.total_net_amount_units, 9);
check(report.summary.secret_material_stored, false);

step("phase G index export", shell(), shellArgs(["scripts/report-agent-index.ps1", "-Out", indexPath]));

const index = readJson(indexPath);
const entry = index.reports.find((item) => item.name === "phase_g_settlement_plan");
if (!entry) throw new Error("missing phase_g_settlement_plan");
check(entry.required, false);
check(entry.exists, true);
check(entry.status, "present");
check(entry.plan_schema, 1);
check(entry.plan_status, "ok");
check(entry.plan_input_valid, true);
check(entry.plan_registry_valid, true);
check(entry.plan_accounting_valid, true);
check(entry.plan_valid, true);
check(entry.plan_execution_enabled, false);
check(entry.plan_operator_approval_required, true);
check(entry.plan_policy_mode, "threshold");
check(entry.plan_rows, 1);
check(entry.plan_review_rows, 1);
check(entry.plan_held_rows, 0);
check(entry.plan_total_amount_units, 10);
check(entry.plan_total_fee_estimate_units, 1);
check(entry.plan_total_net_amount_units, 9);
check(entry.plan_secret_material_stored, false);

console.log(`phase.g.report=${reportPath}`);
console.log(`phase.g.index=${indexPath}`);
console.log("PHASE G VERIFY PASSED");

function step(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function shell() {
  return platform === "win32" ? "powershell.exe" : "pwsh";
}

function shellArgs(args) {
  return ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ...args];
}

function check(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
