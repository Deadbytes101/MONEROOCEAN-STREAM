#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { assessServiceReadiness } from "../src/service-readiness.js";

const args = process.argv.slice(2);
const configPath = optionValue(args, "--config");
const output = optionValue(args, "--out") || "reports/dbyte-service-readiness.json";
const config = configPath ? JSON.parse(await readFile(configPath, "utf8")) : {};
const readiness = assessServiceReadiness({ config });
const report = {
  schema: 1,
  status: readiness.status,
  config_path: configPath || "<default>",
  readiness_valid: readiness.valid,
  mode: readiness.mode,
  config: readiness.config,
  evidence: readiness.evidence,
  checks: readiness.checks,
  preflight: readiness.preflight,
  summary: readiness.summary,
  blockers: readiness.blockers
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`service.readiness.report=${output}`);
console.log(`service.readiness.status=${report.status}`);
console.log(`service.readiness.runtime_enabled=${report.summary.runtime_enabled}`);
console.log(`service.readiness.blockers=${report.summary.blocker_count}`);

if (report.status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
