#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const projectionPath = optionValue(args, "--projection") || "reports/dbyte-replay-projection.json";
const poolPath = optionValue(args, "--pool") || "reports/dbyte-pool-ledger-fixture-report.json";
const output = optionValue(args, "--out") || "reports/dbyte-bridge-compare.json";

const projection = JSON.parse(await readFile(projectionPath, "utf8"));
const pool = JSON.parse(await readFile(poolPath, "utf8"));
const matches = {
  total_events: projection.total_events === pool.total_events,
  accepted_events: projection.accepted_events === pool.accepted_events,
  rejected_events: projection.rejected_events === pool.rejected_events,
  credited_difficulty: projection.credited_difficulty === pool.credited_difficulty
};
const ok = Object.values(matches).every(Boolean);
const report = {
  schema: 1,
  status: ok ? "ok" : "attention",
  projection_path: projectionPath,
  pool_path: poolPath,
  matches,
  projection: counters(projection),
  pool: counters(pool)
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`bridge.compare.report=${output}`);
console.log(`bridge.compare.status=${report.status}`);
console.log(`bridge.compare.total_events=${matches.total_events}`);
console.log(`bridge.compare.accepted_events=${matches.accepted_events}`);
console.log(`bridge.compare.rejected_events=${matches.rejected_events}`);
console.log(`bridge.compare.credited_difficulty=${matches.credited_difficulty}`);

if (!ok) process.exitCode = 1;

function counters(report) {
  return {
    total_events: report.total_events,
    accepted_events: report.accepted_events,
    rejected_events: report.rejected_events,
    credited_difficulty: report.credited_difficulty
  };
}

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
