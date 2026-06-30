import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { chdir } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = "crates/dbyte-pool-core/Cargo.toml";
const ledgerReportPath = "reports/dbyte-pool-ledger-report.json";
const ledgerFixtureReportPath = "reports/dbyte-pool-ledger-fixture-report.json";
const ledgerFileReportPath = "reports/dbyte-pool-ledger-file-report.json";
const ledgerFileFixturePath = "tests/fixtures/pool-core-bridge.ledger";

chdir(root);

runStep("pool core cargo fmt", "cargo", ["fmt", "--manifest-path", manifest, "--", "--check"]);
runStep("pool core cargo test", "cargo", ["test", "--manifest-path", manifest, "--", "--test-threads=1"]);
writePoolLedgerReport(ledgerReportPath, []);
verifyPoolLedgerReport();
writePoolLedgerReport(ledgerFixtureReportPath, ["--fixture", "two-session"]);
verifyPoolLedgerFixtureReport(ledgerFixtureReportPath, "fixture");
writePoolLedgerReport(ledgerFileReportPath, ["--file", ledgerFileFixturePath]);
verifyPoolLedgerFixtureReport(ledgerFileReportPath, "file");

console.log("POOL CORE TEST GATE PASSED");

function runStep(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
}

function writePoolLedgerReport(path, reportArgs) {
  console.log(`== pool ledger report export: ${path} ==`);
  const output = execFileSync("cargo", [
    "run",
    "--manifest-path",
    manifest,
    "--quiet",
    "--bin",
    "dbyte-pool-ledger-report",
    "--",
    ...reportArgs
  ], { encoding: "utf8" });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${output.trimEnd()}\n`, "utf8");
  const stat = statSync(path);
  console.log(`pool.ledger.report=${path}`);
  console.log(`pool.ledger.report_size_bytes=${stat.size}`);
}

function verifyPoolLedgerReport() {
  console.log("== pool ledger report verify ==");
  const report = JSON.parse(readFileSync(ledgerReportPath, "utf8"));
  if (report.schema !== 1) throw new Error("invalid pool ledger report schema");
  if (report.status !== "ok") throw new Error("invalid pool ledger report status");
  if (report.total_events !== 0) throw new Error("unexpected default pool ledger event count");
  if (!Array.isArray(report.sessions)) throw new Error("pool ledger sessions must be an array");
  console.log("POOL LEDGER REPORT VERIFIED");
}

function verifyPoolLedgerFixtureReport(path, label) {
  console.log(`== pool ledger ${label} report verify ==`);
  const report = JSON.parse(readFileSync(path, "utf8"));
  if (report.schema !== 1) throw new Error(`invalid pool ledger ${label} report schema`);
  if (report.status !== "ok") throw new Error(`invalid pool ledger ${label} report status`);
  if (report.total_events !== 2) throw new Error(`unexpected pool ledger ${label} event count`);
  if (report.accepted_events !== 1) throw new Error(`unexpected pool ledger ${label} accepted count`);
  if (report.rejected_events !== 1) throw new Error(`unexpected pool ledger ${label} rejected count`);
  if (report.credited_difficulty !== 10) throw new Error(`unexpected pool ledger ${label} credited difficulty`);
  if (!Array.isArray(report.sessions) || report.sessions.length !== 2) {
    throw new Error(`pool ledger ${label} sessions must contain two rows`);
  }
  console.log(`POOL LEDGER ${label.toUpperCase()} REPORT VERIFIED`);
}
