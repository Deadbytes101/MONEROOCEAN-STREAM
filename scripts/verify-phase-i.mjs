#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const reportPath = "reports/dbyte-service-readiness.json";
const indexPath = "reports/dbyte-agent-index-phase-i.json";

rmSync(reportPath, { force: true });
rmSync(indexPath, { force: true });
mkdirSync(dirname(reportPath), { recursive: true });

step("phase I report export", execPath, ["scripts/report-service-readiness.mjs", "--out", reportPath]);

const report = readJson(reportPath);
check(report.schema, 1);
check(report.status, "ok");
check(report.readiness_valid, true);
check(report.mode, "phase_i_readiness_planning");
check(report.config.enabled, false);
check(report.config.mode, "local");
check(report.summary.report_only, true);
check(report.summary.runtime_enabled, false);
check(report.summary.blocker_count, 0);
check(report.preflight.status, "ok");
check(report.preflight.enabled, false);
check(report.preflight.endpoint, "127.0.0.1");
check(report.preflight.port, 0);
check(report.preflight.report_only, true);
check(report.preflight.runtime_enabled, false);
check(report.preflight.local_endpoint, true);
check(report.preflight.operator_visible, true);
check(report.safety_harness.status, "ok");
check(report.safety_harness.enabled, false);
check(report.safety_harness.endpoint, "127.0.0.1");
check(report.safety_harness.port, 0);
check(report.safety_harness.operator_approval_required, true);
check(report.safety_harness.report_only, true);
check(report.safety_harness.runtime_started, false);
check(report.safety_harness.bind_implemented, false);
check(report.safety_harness.local_endpoint, true);
check(report.safety_harness.operator_visible, true);
check(report.summary.safety_harness_enabled, false);
check(report.summary.safety_harness_report_only, true);
check(report.summary.safety_harness_runtime_started, false);
check(report.checks.phase_h_gate_ok, true);
check(report.checks.local_mode, true);
check(report.checks.payload_limit_present, true);
check(report.checks.message_limit_present, true);
check(report.checks.operator_approval_required, true);
check(report.checks.safety_harness_disabled, true);
check(report.checks.safety_harness_local_endpoint, true);
check(report.checks.safety_harness_operator_approval_required, true);
check(report.checks.safety_harness_runtime_not_started, true);
check(report.checks.safety_harness_bind_not_implemented, true);

step("phase I index export", shell(), shellArgs(["scripts/report-agent-index.ps1", "-Out", indexPath]));

const index = readJson(indexPath);
const entry = index.reports.find((item) => item.name === "phase_i_service_readiness");
if (!entry) throw new Error("missing phase_i_service_readiness");
check(entry.required, false);
check(entry.exists, true);
check(entry.status, "present");
check(entry.readiness_schema, 1);
check(entry.readiness_status, "ok");
check(entry.readiness_valid, true);
check(entry.readiness_mode, "phase_i_readiness_planning");
check(entry.readiness_config_mode, "local");
check(entry.readiness_config_enabled, false);
check(entry.readiness_report_only, true);
check(entry.readiness_runtime_enabled, false);
check(entry.readiness_blocker_count, 0);
check(entry.readiness_phase_h_gate_ok, true);
check(entry.readiness_local_mode, true);
check(entry.readiness_payload_limit_present, true);
check(entry.readiness_message_limit_present, true);
check(entry.readiness_operator_approval_required, true);
check(entry.preflight_status, "ok");
check(entry.preflight_enabled, false);
check(entry.preflight_endpoint, "127.0.0.1");
check(entry.preflight_port, 0);
check(entry.preflight_report_only, true);
check(entry.preflight_runtime_enabled, false);
check(entry.preflight_local_endpoint, true);
check(entry.preflight_operator_visible, true);
check(entry.safety_harness_status, "ok");
check(entry.safety_harness_enabled, false);
check(entry.safety_harness_endpoint, "127.0.0.1");
check(entry.safety_harness_port, 0);
check(entry.safety_harness_operator_approval_required, true);
check(entry.safety_harness_report_only, true);
check(entry.safety_harness_runtime_started, false);
check(entry.safety_harness_bind_implemented, false);
check(entry.safety_harness_local_endpoint, true);
check(entry.safety_harness_operator_visible, true);

console.log(`phase.i.report=${reportPath}`);
console.log(`phase.i.index=${indexPath}`);
console.log("PHASE I VERIFY PASSED");

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
