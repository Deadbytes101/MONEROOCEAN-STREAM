import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { execPath } from "node:process";

const require = createRequire(import.meta.url);

function packageBin(packageName, binName = packageName) {
  const packagePath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const bin = typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.[binName] || Object.values(packageJson.bin || {})[0];
  if (!bin) throw new Error(`Missing package bin for ${packageName}`);
  return join(dirname(packagePath), bin);
}

test.describe("e2e browser suite", { concurrency: false }, () => {
  test("playwright browser checks", async (t) => {
    await buildStaticBundle();
    const run = await runPlaywrightNodeSubtests(t);
    assert.equal(run.code, 0, run.message);
    assert.equal(run.failures, 0, run.message);
  });
});

function buildStaticBundle() {
  return new Promise((resolve, reject) => {
    const child = spawn(execPath, ["scripts/build-static.mjs"], {
      cwd: process.cwd(),
      stdio: ["ignore", "inherit", "inherit"]
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Static build exited with code ${code}`));
    });
  });
}

function runPlaywrightNodeSubtests(t) {
  return new Promise((resolve, reject) => {
    const child = spawn(execPath, [packageBin("@playwright/test", "playwright"), "test", "--config=tests/playwright.config.mjs", "--reporter=./tests/e2e/node-progress-reporter.cjs"], {
      cwd: process.cwd(),
      env: { ...process.env, PLAYWRIGHT_LIST_PRINT_STEPS: "0" },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let pending = Promise.resolve();
    let buffered = "";
    let stderr = "";
    let failures = 0;
    child.stdout.on("data", (chunk) => {
      buffered += chunk;
      const lines = buffered.split("\n");
      buffered = lines.pop() || "";
      for (const line of lines) pending = pending.then(() => runProgressEvent(t, line)).catch(reject);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (buffered) pending = pending.then(() => runProgressEvent(t, buffered)).catch(reject);
      pending.then(() => resolve({
        code,
        failures,
        message: stderr || `Playwright exited with code ${code}`
      }), reject);
    });

    function runProgressEvent(parent, line) {
      if (!line.trim()) return Promise.resolve();
      const event = JSON.parse(line);
      if (event.type === "testEnd" && !event.ok && !event.skipped) failures += 1;
      if (event.type !== "testEnd") return Promise.resolve();
      const options = event.skipped ? { skip: true } : {};
      return parent.test(event.name, options, () => {
        assert.equal(event.ok, true, event.message);
      });
    }
  });
}
