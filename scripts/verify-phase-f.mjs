#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const reportPath = "reports/dbyte-accounting-projection.json";
const indexPath = "reports/dbyte-agent-index-phase-f.json";

rmSync(reportPath, { force: true });
rmSync(indexPath, { force: true });
mkdirSync(dirname(reportPath), { recursive: true });

step("phase F report export", execPath, [
  "scripts/report-accounting-projection.mjs",
  "--protocol",
  "tests/fixtures/service-protocol.clean.jsonl",
  "--jobs",
  "tests/fixtures/job-source.clean.json",
  "--out",
  reportPath,
  "--window-id",
  "verify-window"
]);

const report = readJson(reportPath);
check(report.schema, 1);
check(report.status, "ok");
check(report.input_valid, true);
check(report.registry_valid, true);
check(report.intake_valid, true);
check(report.accounting_valid, true);
check(report.window.window_id, "verify-window");
check(report.summary.total_credited_difficulty, 10);
check(report.summary.intake_credited_difficulty, 10);
check(report.summary.worker_count, 1);
check(report.summary.group_count, 1);
check(report.summary.rejected_shares, 0);
check(report.summary.value_movement_count, 0);
check(report.checks.credited_matches_intake, true);
check(report.checks.no_value_movement, true);

step("phase F index export", shell(), shellArgs(["scripts/report-agent-index.ps1", "-Out", indexPath]));

const index = readJson(indexPath);
const entry = index.reports.find((item) => item.name === "phase_f_accounting_projection");
if (!entry) throw new Error("missing phase_f_accounting_projection");
check(entry.required, false);
check(entry.exists, true);
check(entry.status, "present");
check(entry.accounting_schema, 1);
check(entry.accounting_status, "ok");
check(entry.accounting_input_valid, true);
check(entry.accounting_registry_valid, true);
check(entry.accounting_intake_valid, true);
check(entry.accounting_valid, true);
check(entry.accounting_total_credited_difficulty, 10);
check(entry.accounting_intake_credited_difficulty, 10);
check(entry.accounting_worker_count, 1);
check(entry.accounting_group_count, 1);
check(entry.accounting_rejected_shares, 0);
check(entry.accounting_value_movement_count, 0);
check(entry.accounting_credited_matches_intake, true);
check(entry.accounting_no_value_movement, true);

console.log(`phase.f.report=${reportPath}`);
console.log(`phase.f.index=${indexPath}`);
console.log("PHASE F VERIFY PASSED");

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
