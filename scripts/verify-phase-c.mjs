#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { execPath, platform } from "node:process";

const jobReport = "reports/dbyte-job-source.json";
const indexReport = "reports/dbyte-agent-index-phase-c.json";

rmSync(jobReport, { force: true });
rmSync(indexReport, { force: true });
mkdirSync(dirname(jobReport), { recursive: true });

runStep("phase C job source export", execPath, [
  "scripts/report-job-source.mjs",
  "--in",
  "tests/fixtures/job-source.clean.json",
  "--out",
  jobReport
]);

const jobJson = readJson(jobReport);
assertEqual(jobJson.schema, 1, "phase C schema must be 1");
assertEqual(jobJson.status, "ok", "phase C status must be ok");
assertEqual(jobJson.source_kind, "fake", "phase C source kind must be fake");
assertEqual(jobJson.valid, true, "phase C report must be valid");
assertEqual(jobJson.summary.total_jobs, 2, "phase C report should contain two jobs");
assertEqual(jobJson.summary.active_jobs, 2, "phase C report should contain two active jobs");
assertEqual(jobJson.summary.stale_jobs, 0, "phase C report should contain zero stale jobs");
assertEqual(jobJson.summary.error_count, 0, "phase C report should contain zero errors");
assertEqual(jobJson.summary.minimum_difficulty, 10, "phase C report minimum difficulty should be 10");
assertEqual(jobJson.summary.maximum_difficulty, 20, "phase C report maximum difficulty should be 20");

runStep("phase C index export", shellCommand(), shellArgs([
  "scripts/report-agent-index.ps1",
  "-Out",
  indexReport
]));

const indexJson = readJson(indexReport);
const entry = indexJson.reports.find((report) => report.name === "phase_c_job_source");
if (!entry) throw new Error("phase_c_job_source index entry is missing");
assertEqual(entry.required, false, "phase_c_job_source must remain optional");
assertEqual(entry.exists, true, "phase_c_job_source must exist after export");
assertEqual(entry.status, "present", "phase_c_job_source status must be present");
assertEqual(entry.job_schema, 1, "phase_c_job_source job_schema must be 1");
assertEqual(entry.job_status, "ok", "phase_c_job_source job_status must be ok");
assertEqual(entry.job_source_kind, "fake", "phase_c_job_source kind must be fake");
assertEqual(entry.job_valid, true, "phase_c_job_source job_valid must be true");
assertEqual(entry.job_total_jobs, 2, "phase_c_job_source total jobs must be two");
assertEqual(entry.job_active_jobs, 2, "phase_c_job_source active jobs must be two");
assertEqual(entry.job_stale_jobs, 0, "phase_c_job_source stale jobs must be zero");
assertEqual(entry.job_error_count, 0, "phase_c_job_source error count must be zero");
assertEqual(entry.job_minimum_difficulty, 10, "phase_c_job_source minimum difficulty must be 10");
assertEqual(entry.job_maximum_difficulty, 20, "phase_c_job_source maximum difficulty must be 20");

console.log(`phase.c.report=${jobReport}`);
console.log(`phase.c.index=${indexReport}`);
console.log("PHASE C VERIFY PASSED");

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
