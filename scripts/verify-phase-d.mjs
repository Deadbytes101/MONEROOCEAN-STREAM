#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const intakeReport = "reports/dbyte-share-intake.json";
const indexReport = "reports/dbyte-agent-index-phase-d.json";

rmSync(intakeReport, { force: true });
rmSync(indexReport, { force: true });
mkdirSync(dirname(intakeReport), { recursive: true });

runStep("phase D intake export", execPath, [
  "scripts/report-share-intake.mjs",
  "--protocol",
  "tests/fixtures/service-protocol.clean.jsonl",
  "--jobs",
  "tests/fixtures/job-source.clean.json",
  "--out",
  intakeReport
]);

const intakeJson = readJson(intakeReport);
assertEqual(intakeJson.schema, 1, "phase D schema must be 1");
assertEqual(intakeJson.status, "ok", "phase D status must be ok");
assertEqual(intakeJson.input_valid, true, "phase D input must be valid");
assertEqual(intakeJson.job_source_valid, true, "phase D job source must be valid");
assertEqual(intakeJson.intake_valid, true, "phase D intake must be valid");
assertEqual(intakeJson.summary.total_submits, 1, "phase D report should contain one submit");
assertEqual(intakeJson.summary.accepted_submits, 1, "phase D report should contain one accepted submit");
assertEqual(intakeJson.summary.rejected_submits, 0, "phase D report should contain zero rejected submits");
assertEqual(intakeJson.summary.credited_difficulty, 10, "phase D report should credit difficulty 10");
assertEqual(intakeJson.summary.rejection_reasons.length, 0, "phase D report should contain zero rejection reasons");

runStep("phase D index export", shellCommand(), shellArgs([
  "scripts/report-agent-index.ps1",
  "-Out",
  indexReport
]));

const indexJson = readJson(indexReport);
const entry = indexJson.reports.find((report) => report.name === "phase_d_share_intake");
if (!entry) throw new Error("phase_d_share_intake index entry is missing");
assertEqual(entry.required, false, "phase_d_share_intake must remain optional");
assertEqual(entry.exists, true, "phase_d_share_intake must exist after export");
assertEqual(entry.status, "present", "phase_d_share_intake status must be present");
assertEqual(entry.intake_schema, 1, "phase_d_share_intake intake_schema must be 1");
assertEqual(entry.intake_status, "ok", "phase_d_share_intake intake_status must be ok");
assertEqual(entry.intake_input_valid, true, "phase_d_share_intake input valid must be true");
assertEqual(entry.intake_job_source_valid, true, "phase_d_share_intake job source valid must be true");
assertEqual(entry.intake_valid, true, "phase_d_share_intake intake valid must be true");
assertEqual(entry.intake_total_submits, 1, "phase_d_share_intake total submits must be one");
assertEqual(entry.intake_accepted_submits, 1, "phase_d_share_intake accepted submits must be one");
assertEqual(entry.intake_rejected_submits, 0, "phase_d_share_intake rejected submits must be zero");
assertEqual(entry.intake_credited_difficulty, 10, "phase_d_share_intake credited difficulty must be 10");
assertEqual(entry.intake_rejection_count, 0, "phase_d_share_intake rejection count must be zero");

console.log(`phase.d.report=${intakeReport}`);
console.log(`phase.d.index=${indexReport}`);
console.log("PHASE D VERIFY PASSED");

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
