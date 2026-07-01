import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chdir, execPath, platform } from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

chdir(root);

runStep("clean test artifacts", execPath, ["scripts/clean-test-artifacts.mjs"]);
runStep("lint", execPath, [packageBin("eslint", "eslint"), "."]);
runStep("javascript and browser tests", execPath, [
  "--require",
  "./tests/common/test_output_buffer.cjs",
  "--test",
  "--test-reporter=./tests/common/spec_reporter.cjs",
  "--test-concurrency=1",
  "tests/all.mjs"
]);
runStep("phase A gate", execPath, ["scripts/verify-phase-a.mjs"]);
runStep("phase B gate", execPath, ["scripts/verify-phase-b.mjs"]);
runStep("phase C gate", execPath, ["scripts/verify-phase-c.mjs"]);
runStep("phase D gate", execPath, ["scripts/verify-phase-d.mjs"]);
runStep("phase E gate", execPath, ["scripts/verify-phase-e.mjs"]);
runStep("phase F gate", execPath, ["scripts/verify-phase-f.mjs"]);
runStep("phase G gate", execPath, ["scripts/verify-phase-g.mjs"]);
runStep("phase H gate", execPath, ["scripts/verify-phase-h.mjs"]);
runStep("phase I gate", execPath, ["scripts/verify-phase-i.mjs"]);
runStep("service capability scorecard", execPath, ["scripts/report-service-capability-scorecard.mjs", "--out", "reports/dbyte-service-capability-scorecard.json"]);
runPowerShellStep("agent gate", "scripts/verify-agent.ps1");
assertScorecardIndex("reports/dbyte-agent-index.json");
runStep("static build", execPath, ["scripts/build-static.mjs"]);

console.log("FULL VERIFY GATE PASSED");

function runStep(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
}

function runPowerShellStep(name, scriptPath) {
  const command = platform === "win32" ? "powershell.exe" : "pwsh";
  runStep(name, command, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath]);
}

function packageBin(packageName, binName = packageName) {
  const packagePath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const bin = typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.[binName] || Object.values(packageJson.bin || {})[0];
  if (!bin) throw new Error(`Missing package bin for ${packageName}`);
  return join(dirname(packagePath), bin);
}

function assertScorecardIndex(path) {
  const index = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const entry = index.reports.find((item) => item.name === "service_capability_scorecard");
  if (!entry) throw new Error("report index missing service capability scorecard");
  check(entry.required, false);
  check(entry.exists, true);
  check(entry.status, "present");
  check(entry.scorecard_schema, 1);
  check(entry.scorecard_status, "ok");
  check(entry.scorecard_readiness_tier, "phase_i_report_ready");
  check(entry.scorecard_report_only, true);
  check(entry.scorecard_production_ready, false);
  check(entry.scorecard_public_service_ready, false);
  check(entry.scorecard_score, 90);
  check(entry.scorecard_max_score, 100);
  check(entry.scorecard_runtime_present, false);
  check(entry.scorecard_intake_present, false);
  check(entry.scorecard_value_movement_present, false);
  console.log("SERVICE CAPABILITY SCORECARD INDEX VERIFIED");
}

function check(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
