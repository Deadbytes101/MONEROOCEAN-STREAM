#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseServiceProtocolJsonl, summarizeServiceProtocol } from "../src/service-protocol.js";

const args = process.argv.slice(2);
const input = optionValue(args, "--in") || "tests/fixtures/service-protocol.clean.jsonl";
const output = optionValue(args, "--out") || "reports/dbyte-service-protocol-summary.json";
const source = await readFile(input, "utf8");
const parsed = parseServiceProtocolJsonl(source);
const summary = summarizeServiceProtocol(parsed.messages);
const status = parsed.valid ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  source_path: input,
  valid: parsed.valid,
  valid_messages: parsed.messages.length,
  invalid_messages: parsed.errors.length,
  summary,
  errors: parsed.errors
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`service.protocol.report=${output}`);
console.log(`service.protocol.status=${status}`);
console.log(`service.protocol.valid_messages=${parsed.messages.length}`);
console.log(`service.protocol.invalid_messages=${parsed.errors.length}`);

if (!parsed.valid) process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
