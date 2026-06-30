#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const registryReport = "reports/dbyte-session-registry.json";
const indexReport = "reports/dbyte-agent-index-phase-b.json";

rmSync(registryReport, { force: true });
rmSync(indexReport, { force: true });
mkdirSync(dirname(registryReport), { recursive: true });

runStep("phase B registry export", execPath, [
  "scripts/report-session-registry.mjs",
  "--in",
  "tests/fixtures/service-protocol.clean.jsonl",
  "--out",
  registryReport
]);

const registryJson = readJson(registryReport);
assertEqual(registryJson.schema, 1, "phase B schema must be 1");
assertEqual(registryJson.status, "ok", "phase B status must be ok");
assertEqual(registryJson.input_valid, true, "phase B input must be valid");
assertEqual(registryJson.registry_valid, true, "phase B registry must be valid");
assertEqual(registryJson.valid_messages, 7, "phase B registry should contain seven valid messages");
assertEqual(registryJson.summary.session_count, 1, "phase B registry should contain one session");
assertEqual(registryJson.summary.active_sessions, 0, "phase B registry should contain zero active sessions");
assertEqual(registryJson.summary.closed_sessions, 1, "phase B registry should contain one closed session");
assertEqual(registryJson.summary.rejected_sessions, 0, "phase B registry should contain zero rejected sessions");
assertEqual(registryJson.summary.accepted, 1, "phase B registry should contain one accepted item");
assertEqual(registryJson.summary.rejected, 0, "phase B registry should contain zero rejected items");
assertEqual(registryJson.summary.credited_difficulty, 10, "phase B registry should credit difficulty 10");
assertEqual(registryJson.summary.error_count, 0, "phase B registry should contain zero errors");

runStep("phase B index export", shellCommand(), shellArgs([
  "scripts/report-agent-index.ps1",
  "-Out",
  indexReport
]));

const indexJson = readJson(indexReport);
const entry = indexJson.reports.find((report) => report.name === "phase_b_registry");
if (!entry) throw new Error("phase_b_registry index entry is missing");
assertEqual(entry.required, false, "phase_b_registry must remain optional");
assertEqual(entry.exists, true, "phase_b_registry must exist after export");
assertEqual(entry.status, "present", "phase_b_registry status must be present");
assertEqual(entry.registry_schema, 1, "phase_b_registry registry_schema must be 1");
assertEqual(entry.registry_status, "ok", "phase_b_registry registry_status must be ok");
assertEqual(entry.registry_input_valid, true, "phase_b_registry registry_input_valid must be true");
assertEqual(entry.registry_valid, true, "phase_b_registry registry_valid must be true");
assertEqual(entry.registry_valid_messages, 7, "phase_b_registry valid messages must be seven");
assertEqual(entry.registry_session_count, 1, "phase_b_registry session count must be one");
assertEqual(entry.registry_active_sessions, 0, "phase_b_registry active sessions must be zero");
assertEqual(entry.registry_closed_sessions, 1, "phase_b_registry closed sessions must be one");
assertEqual(entry.registry_rejected_sessions, 0, "phase_b_registry rejected sessions must be zero");
assertEqual(entry.registry_accepted, 1, "phase_b_registry accepted count must be one");
assertEqual(entry.registry_rejected, 0, "phase_b_registry rejected count must be zero");
assertEqual(entry.registry_credited_difficulty, 10, "phase_b_registry credited difficulty must be 10");
assertEqual(entry.registry_error_count, 0, "phase_b_registry error count must be zero");

console.log(`phase.b.report=${registryReport}`);
console.log(`phase.b.index=${indexReport}`);
console.log("PHASE B VERIFY PASSED");

function runStep(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function shellCommand() {
  return platform === "win32" ? "powershell.exe" : "pwsh";
}

function shellArgs(args) {
  return ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ...args];
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
