import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chdir } from "node:process";

chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const windows = process.platform === "win32";
const commandName = (name) => windows ? `${name}.cmd` : name;

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit", shell: windows });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: "utf8", shell: windows }).trim();
}

function cacheKey() {
  let key;
  try {
    key = output("git", ["rev-parse", "--short", "HEAD"]);
  } catch {
    key = String(Math.floor(Date.now() / 1000));
  }

  try {
    execFileSync("git", ["diff", "--quiet", "--", "."], { shell: windows });
    execFileSync("git", ["diff", "--cached", "--quiet", "--", "."], { shell: windows });
  } catch {
    key = `${key}-dirty-${Math.floor(Date.now() / 1000)}`;
  }

  return key;
}

const sha = cacheKey();
const npx = commandName("npx");

rmSync("build", { recursive: true, force: true });
mkdirSync("build", { recursive: true });

run(npx, ["esbuild", "script.js", "--bundle", "--format=iife", "--target=es2022", "--minify", "--outfile=build/script.esbuild.js", "--log-level=warning"]);
run(npx, ["terser", "build/script.esbuild.js", "--compress", "passes=10,booleans_as_integers=true,unsafe=true,unsafe_arrows=true,unsafe_methods=true,unsafe_comps=true,unsafe_math=true,pure_getters=true,module=true,hoist_props=true,keep_fargs=false", "--mangle", "--ecma", "2022", "-o", "build/script.js"]);
rmSync("build/script.esbuild.js", { force: true });
run(npx, ["esbuild", "style.css", "--bundle", "--minify", "--outfile=build/style.css", "--log-level=warning"]);
run(npx, ["csso-cli", "build/style.css", "--output", "build/style.css"]);

const html = readFileSync("index.html", "utf8")
  .replace('href="style.css"', `href="style.css?v=${sha}"`)
  .replace('src="script.js" type="module"', `src="script.js?v=${sha}" defer`);
writeFileSync(join("build", "index.html"), html);

run(npx, ["html-minifier-terser", "build/index.html", "--collapse-whitespace", "--remove-comments", "--remove-redundant-attributes", "--collapse-boolean-attributes", "--remove-attribute-quotes", "--remove-optional-tags", "--use-short-doctype", "--minify-css", "true", "--minify-js", "true", "-o", "build/index.html"]);

console.log(`Built build/index.html, build/script.js, build/style.css using cache key ${sha}`);
