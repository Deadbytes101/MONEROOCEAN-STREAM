import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { chdir } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = "crates/dbyte-pool-core/Cargo.toml";
const ledgerReportPath = "reports/dbyte-pool-ledger-report.json";

chdir(root);

runStep("pool core cargo fmt", "cargo", ["fmt", "--manifest-path", manifest, "--", "--check"]);
runStep("pool core cargo test", "cargo", ["test", "--manifest-path", manifest, "--", "--test-threads=1"]);
writePoolLedgerReport();
verifyPoolLedgerReport();

console.log("POOL CORE TEST GATE PASSED");

function runStep(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
}

function writePoolLedgerReport() {
  console.log("== pool ledger report export ==");
  const output = execFileSync("cargo", [
    "run",
    "--manifest-path",
    manifest,
    "--quiet",
    "--bin",
    "dbyte-pool-ledger-report"
  ], { encoding: "utf8" });
  mkdirSync(dirname(ledgerReportPath), { recursive: true });
  writeFileSync(ledgerReportPath, output.trimEnd() + "\n", "utf8");
  const stat = statSync(ledgerReportPath);
  console.log(`pool.ledger.report=${ledgerReportPath}`);
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
