#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const phaseReport = "reports/dbyte-service-protocol-summary.json";
const indexReport = "reports/dbyte-agent-index-phase-a.json";

rmSync(phaseReport, { force: true });
rmSync(indexReport, { force: true });
mkdirSync(dirname(phaseReport), { recursive: true });

runStep("phase A report export", execPath, [
  "scripts/report-service-protocol.mjs",
  "--in",
  "tests/fixtures/service-protocol.clean.jsonl",
  "--out",
  phaseReport
]);

const phaseJson = JSON.parse(readFileSync(phaseReport, "utf8"));
assertEqual(phaseJson.schema, 1, "phase A schema must be 1");
assertEqual(phaseJson.status, "ok", "phase A status must be ok");
assertEqual(phaseJson.valid, true, "phase A report must be valid");
assertEqual(phaseJson.valid_messages, 7, "phase A report should contain seven valid messages");
assertEqual(phaseJson.invalid_messages, 0, "phase A report should contain zero invalid messages");
assertEqual(phaseJson.summary.total_messages, 7, "phase A report should contain seven total messages");
assertEqual(phaseJson.summary.accepted, 1, "phase A report should contain one accepted item");
assertEqual(phaseJson.summary.rejected, 0, "phase A report should contain zero rejected items");
assertEqual(phaseJson.summary.credited_difficulty, 10, "phase A report should credit difficulty 10");
assertEqual(phaseJson.summary.session_count, 1, "phase A report should contain one session");

runStep("phase A index export", shellCommand(), shellArgs([
  "scripts/report-agent-index.ps1",
  "-Out",
  indexReport
]));

const indexJson = JSON.parse(readFileSync(indexReport, "utf8"));
const entry = indexJson.reports.find((report) => report.name === "phase_a_summary");
if (!entry) throw new Error("phase_a_summary index entry is missing");
assertEqual(entry.required, false, "phase_a_summary must remain optional");
assertEqual(entry.exists, true, "phase_a_summary must exist after export");
assertEqual(entry.status, "present", "phase_a_summary status must be present");
assertEqual(entry.phase_schema, 1, "phase_a_summary phase_schema must be 1");
assertEqual(entry.phase_status, "ok", "phase_a_summary phase_status must be ok");
assertEqual(entry.phase_valid, true, "phase_a_summary phase_valid must be true");
assertEqual(entry.phase_valid_messages, 7, "phase_a_summary valid messages must be seven");
assertEqual(entry.phase_invalid_messages, 0, "phase_a_summary invalid messages must be zero");
assertEqual(entry.phase_total_messages, 7, "phase_a_summary total messages must be seven");
assertEqual(entry.phase_accepted, 1, "phase_a_summary accepted count must be one");
assertEqual(entry.phase_rejected, 0, "phase_a_summary rejected count must be zero");
assertEqual(entry.phase_credited_difficulty, 10, "phase_a_summary credited difficulty must be 10");
assertEqual(entry.phase_session_count, 1, "phase_a_summary session count must be one");

console.log(`phase.a.report=${phaseReport}`);
console.log(`phase.a.index=${indexReport}`);
console.log("PHASE A VERIFY PASSED");

function runStep(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
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
