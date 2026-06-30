#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseBridgeLedgerText } from "../src/bridge-ledger-file.js";

const args = process.argv.slice(2);
const input = optionValue(args, "--in") || "tests/fixtures/pool-core-bridge.ledger";
const output = optionValue(args, "--out") || "reports/dbyte-bridge-file.json";

const source = await readFile(input, "utf8");
const parsed = parseBridgeLedgerText(source);
const report = {
  schema: 1,
  status: parsed.valid ? "ok" : "attention",
  source_path: input,
  valid: parsed.valid,
  summary: parsed.summary,
  errors: parsed.errors
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`bridge.file.report=${output}`);
console.log(`bridge.file.status=${report.status}`);
console.log(`bridge.file.total_events=${report.summary.total_events}`);
console.log(`bridge.file.accepted_events=${report.summary.accepted_events}`);
console.log(`bridge.file.rejected_events=${report.summary.rejected_events}`);
console.log(`bridge.file.credited_difficulty=${report.summary.credited_difficulty}`);

if (!parsed.valid) process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
