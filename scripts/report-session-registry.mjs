#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replaySessionRegistry } from "../src/session-registry.js";

const args = process.argv.slice(2);
const input = optionValue(args, "--in") || "tests/fixtures/service-protocol.clean.jsonl";
const output = optionValue(args, "--out") || "reports/dbyte-session-registry.json";
const source = await readFile(input, "utf8");
const parsed = parseServiceProtocolJsonl(source);
const replay = replaySessionRegistry(parsed.messages);
const status = parsed.valid && replay.valid ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  source_path: input,
  input_valid: parsed.valid,
  registry_valid: replay.valid,
  valid_messages: parsed.messages.length,
  parse_errors: parsed.errors,
  registry_errors: replay.errors,
  summary: replay.summary,
  sessions: replay.sessions
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`session.registry.report=${output}`);
console.log(`session.registry.status=${status}`);
console.log(`session.registry.sessions=${replay.summary.session_count}`);
console.log(`session.registry.errors=${replay.summary.error_count}`);

if (status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
