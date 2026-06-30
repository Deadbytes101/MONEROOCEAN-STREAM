#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { projectSessionSummaryToReplayReport } from "../src/replay-projection.js";

const args = process.argv.slice(2);
const input = optionValue(args, "--in") || "reports/dbyte-session-events-summary.json";
const output = optionValue(args, "--out") || "reports/dbyte-replay-projection.json";
const source = JSON.parse(await readFile(input, "utf8"));
const report = projectSessionSummaryToReplayReport(source);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`replay.projection.report=${output}`);
console.log(`replay.projection.status=${report.status}`);
console.log(`replay.projection.total_events=${report.total_events}`);
console.log(`replay.projection.accepted_events=${report.accepted_events}`);
console.log(`replay.projection.rejected_events=${report.rejected_events}`);

if (report.status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
