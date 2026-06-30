#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const reportPath = "reports/dbyte-difficulty-policy.json";
const indexPath = "reports/dbyte-agent-index-phase-e.json";

rmSync(reportPath, { force: true });
rmSync(indexPath, { force: true });
mkdirSync(dirname(reportPath), { recursive: true });

step("phase E report export", execPath, [
  "scripts/report-difficulty-policy.mjs",
  "--protocol",
  "tests/fixtures/service-protocol.clean.jsonl",
  "--jobs",
  "tests/fixtures/job-source.clean.json",
  "--out",
  reportPath
]);

const report = readJson(reportPath);
check(report.schema, 1);
check(report.status, "ok");
check(report.input_valid, true);
check(report.registry_valid, true);
check(report.job_source_valid, true);
check(report.policy_valid, true);
check(report.policy.dry_run, true);
check(report.summary.policy_mode, "static");
check(report.summary.session_count, 1);
check(report.summary.recommended_changes, 0);
check(report.summary.minimum_assigned_difficulty, 10);
check(report.summary.maximum_assigned_difficulty, 10);
check(report.summary.reason_count, 1);

step("phase E index export", shell(), shellArgs(["scripts/report-agent-index.ps1", "-Out", indexPath]));

const index = readJson(indexPath);
const entry = index.reports.find((item) => item.name === "phase_e_difficulty_policy");
if (!entry) throw new Error("missing phase_e_difficulty_policy");
check(entry.required, false);
check(entry.exists, true);
check(entry.status, "present");
check(entry.policy_schema, 1);
check(entry.policy_status, "ok");
check(entry.policy_input_valid, true);
check(entry.policy_registry_valid, true);
check(entry.policy_job_source_valid, true);
check(entry.policy_valid, true);
check(entry.policy_mode, "static");
check(entry.policy_dry_run, true);
check(entry.policy_session_count, 1);
check(entry.policy_recommended_changes, 0);
check(entry.policy_minimum_assigned_difficulty, 10);
check(entry.policy_maximum_assigned_difficulty, 10);
check(entry.policy_reason_count, 1);

console.log(`phase.e.report=${reportPath}`);
console.log(`phase.e.index=${indexPath}`);
console.log("PHASE E VERIFY PASSED");

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
