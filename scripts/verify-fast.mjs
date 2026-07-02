import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chdir, execPath } from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

chdir(root);

runStep("clean test artifacts", execPath, ["scripts/clean-test-artifacts.mjs"]);
runStep("lint", execPath, [packageBin("eslint", "eslint"), "."]);
runStep("unit test lane", execPath, [
  "--require",
  "./tests/common/test_output_buffer.cjs",
  "--test",
  "--test-reporter=./tests/common/spec_reporter.cjs",
  "--test-concurrency=1",
  "tests/build-invariants.mjs",
  "tests/core-routing-privacy.mjs",
  "tests/rendered-views.mjs",
  "tests/wallet-workers-render-policy.mjs",
  "tests/setup-settings.mjs",
  "tests/dom-interactions.mjs",
  "tests/settings-setup-interactions.mjs"
]);

console.log("FAST VERIFY GATE PASSED");

function runStep(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
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
