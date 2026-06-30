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
runPowerShellStep("agent gate", "scripts/verify-agent.ps1");
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
