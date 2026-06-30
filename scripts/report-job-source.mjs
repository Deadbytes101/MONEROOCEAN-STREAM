#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { makeFakeJobSource, summarizeJobSource } from "../src/job-source.js";

const args = process.argv.slice(2);
const input = optionValue(args, "--in") || "tests/fixtures/job-source.clean.json";
const output = optionValue(args, "--out") || "reports/dbyte-job-source.json";
const fixture = JSON.parse(await readFile(input, "utf8"));
const source = makeFakeJobSource(fixture.jobs || []);
const summary = summarizeJobSource(source, Number(fixture.now_ts_unix) || 0);

const report = {
  schema: 1,
  status: summary.status,
  source_path: input,
  source_kind: "fake",
  now_ts_unix: Number(fixture.now_ts_unix) || 0,
  valid: source.valid,
  summary,
  errors: source.errors,
  jobs: source.templates
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`job.source.report=${output}`);
console.log(`job.source.status=${report.status}`);
console.log(`job.source.total_jobs=${summary.total_jobs}`);
console.log(`job.source.stale_jobs=${summary.stale_jobs}`);

if (report.status !== "ok") process.exitCode = 1;

function optionValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return "";
  return argv[index + 1] || "";
}
