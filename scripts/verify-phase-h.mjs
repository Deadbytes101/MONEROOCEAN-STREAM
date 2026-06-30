#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const reportPath = "reports/dbyte-local-service-dry-run.json";
const indexPath = "reports/dbyte-agent-index-phase-h.json";

rmSync(reportPath, { force: true });
rmSync(indexPath, { force: true });
mkdirSync(dirname(reportPath), { recursive: true });

step("phase H report export", execPath, [
  "scripts/report-local-service-dry-run.mjs",
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
check(report.job_source_valid, true);
check(report.dry_run_valid, true);
check(report.mode, "local_fixture_dry_run");
check(report.listener_enabled, false);
check(report.external_bind_enabled, false);
check(report.live_worker_intake_enabled, false);
check(report.startup.status, "ok");
check(report.shutdown.status, "ok");
check(report.counters.input_messages, 7);
check(report.counters.malformed_messages, 0);
check(report.counters.rate_limited_messages, 0);
check(report.counters.error_count, 0);
check(report.counters.accepted_submits, 1);
check(report.counters.rejected_submits, 0);
check(report.counters.plan_rows, 1);
check(report.dashboard_projection.source, "report_files_only");
check(report.replayable, true);

step("phase H index export", shell(), shellArgs(["scripts/report-agent-index.ps1", "-Out", indexPath]));

const index = readJson(indexPath);
const entry = index.reports.find((item) => item.name === "phase_h_local_dry_run");
if (!entry) throw new Error("missing phase_h_local_dry_run");
check(entry.required, false);
check(entry.exists, true);
check(entry.status, "present");
check(entry.dry_run_schema, 1);
check(entry.dry_run_status, "ok");
check(entry.dry_run_input_valid, true);
check(entry.dry_run_job_source_valid, true);
check(entry.dry_run_valid, true);
check(entry.dry_run_mode, "local_fixture_dry_run");
check(entry.dry_run_listener_enabled, false);
check(entry.dry_run_external_bind_enabled, false);
check(entry.dry_run_live_worker_intake_enabled, false);
check(entry.dry_run_startup_status, "ok");
check(entry.dry_run_shutdown_status, "ok");
check(entry.dry_run_input_messages, 7);
check(entry.dry_run_malformed_messages, 0);
check(entry.dry_run_rate_limited_messages, 0);
check(entry.dry_run_error_count, 0);
check(entry.dry_run_accepted_submits, 1);
check(entry.dry_run_rejected_submits, 0);
check(entry.dry_run_plan_rows, 1);
check(entry.dry_run_dashboard_source, "report_files_only");
check(entry.dry_run_replayable, true);

console.log(`phase.h.report=${reportPath}`);
console.log(`phase.h.index=${indexPath}`);
console.log("PHASE H VERIFY PASSED");

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
