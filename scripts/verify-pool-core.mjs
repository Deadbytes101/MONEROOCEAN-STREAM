import { execFileSync } from "node:child_process";
import { chdir } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = "crates/dbyte-pool-core/Cargo.toml";

chdir(root);

runStep("pool core cargo fmt", "cargo", ["fmt", "--manifest-path", manifest, "--", "--check"]);
runStep("pool core cargo test", "cargo", ["test", "--manifest-path", manifest, "--", "--test-threads=1"]);

console.log("POOL CORE TEST GATE PASSED");

function runStep(name, command, args) {
  console.log(`== ${name} ==`);
  execFileSync(command, args, { stdio: "inherit" });
}
