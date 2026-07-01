#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { buildServiceCapabilityScorecard } from "../src/service-capability-scorecard.js";

const args = process.argv.slice(2);
const output = optionValue(args, "--out") || "reports/dbyte-service-capability-scorecard.json";
const scorecard = buildServiceCapabilityScorecard();
const report = {
  ...scorecard,
  report_path: output
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`service.capability.report=${output}`);
console.log(`service.capability.status=${report.status}`);
console.log(`service.capability.score=${report.score}`);
console.log(`service.capability.max_score=${report.max_score}`);
console.log(`service.capability.blockers=${report.summary.blocker_count}`);

if (report.status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
