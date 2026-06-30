#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { makeFakeJobSource } from "../src/job-source.js";
import { parseServiceProtocolJsonl } from "../src/service-protocol.js";
import { replayShareIntake } from "../src/share-intake.js";

const args = process.argv.slice(2);
const protocolPath = optionValue(args, "--protocol") || "tests/fixtures/service-protocol.clean.jsonl";
const jobsPath = optionValue(args, "--jobs") || "tests/fixtures/job-source.clean.json";
const output = optionValue(args, "--out") || "reports/dbyte-share-intake.json";

const protocolSource = await readFile(protocolPath, "utf8");
const jobFixture = JSON.parse(await readFile(jobsPath, "utf8"));
const parsed = parseServiceProtocolJsonl(protocolSource);
const jobSource = makeFakeJobSource(jobFixture.jobs || []);
const replay = replayShareIntake(parsed.messages, jobSource, Number(jobFixture.now_ts_unix) || 0);
const status = parsed.valid && jobSource.valid && replay.summary.rejected_submits === 0 ? "ok" : "attention";

const report = {
  schema: 1,
  status,
  protocol_path: protocolPath,
  jobs_path: jobsPath,
  input_valid: parsed.valid,
  job_source_valid: jobSource.valid,
  intake_valid: replay.valid,
  parse_errors: parsed.errors,
  job_errors: jobSource.errors,
  summary: replay.summary,
  outcomes: replay.outcomes
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`share.intake.report=${output}`);
console.log(`share.intake.status=${status}`);
console.log(`share.intake.accepted=${replay.summary.accepted_submits}`);
console.log(`share.intake.rejected=${replay.summary.rejected_submits}`);
console.log(`share.intake.credited_difficulty=${replay.summary.credited_difficulty}`);

if (status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
