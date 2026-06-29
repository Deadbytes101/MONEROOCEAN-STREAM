import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chdir, execPath } from "node:process";

const require = createRequire(import.meta.url);

chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

function packageBin(packageName, binName = packageName) {
  const packagePath = require.resolve(`${packageName}/package.json`);
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
  const bin = typeof packageJson.bin === "string"
    ? packageJson.bin
    : packageJson.bin?.[binName] || Object.values(packageJson.bin || {})[0];
  if (!bin) throw new Error(`Missing package bin for ${packageName}`);
  return join(dirname(packagePath), bin);
}

function runTool(packageName, binName, args) {
  execFileSync(execPath, [packageBin(packageName, binName), ...args], { stdio: "inherit" });
}

function output(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function cacheKey() {
  let key;
  try {
    key = output("git", ["rev-parse", "--short", "HEAD"]);
  } catch {
    key = String(Math.floor(Date.now() / 1000));
  }

  try {
    execFileSync("git", ["diff", "--quiet", "--", "."]);
    execFileSync("git", ["diff", "--cached", "--quiet", "--", "."]);
  } catch {
    key = `${key}-dirty-${Math.floor(Date.now() / 1000)}`;
  }

  return key;
}

const sha = cacheKey();

rmSync("build", { recursive: true, force: true });
mkdirSync("build", { recursive: true });

runTool("esbuild", "esbuild", ["script.js", "--bundle", "--format=iife", "--target=es2022", "--minify", "--outfile=build/script.esbuild.js", "--log-level=warning"]);
runTool("terser", "terser", ["build/script.esbuild.js", "--compress", "passes=10,booleans_as_integers=true,unsafe=true,unsafe_arrows=true,unsafe_methods=true,unsafe_comps=true,unsafe_math=true,pure_getters=true,module=true,hoist_props=true,keep_fargs=false", "--mangle", "--ecma", "2022", "-o", "build/script.js"]);
rmSync("build/script.esbuild.js", { force: true });
runTool("esbuild", "esbuild", ["style.css", "--bundle", "--minify", "--outfile=build/style.css", "--log-level=warning"]);
runTool("csso-cli", "csso", ["build/style.css", "--output", "build/style.css"]);

const html = readFileSync("index.html", "utf8")
  .replace('href="style.css"', `href="style.css?v=${sha}"`)
  .replace('src="script.js" type="module"', `src="script.js?v=${sha}" defer`);
writeFileSync(join("build", "index.html"), html);

runTool("html-minifier-terser", "html-minifier-terser", ["build/index.html", "--collapse-whitespace", "--remove-comments", "--remove-redundant-attributes", "--collapse-boolean-attributes", "--remove-attribute-quotes", "--remove-optional-tags", "--use-short-doctype", "--minify-css", "true", "--minify-js", "true", "-o", "build/index.html"]);

console.log(`Built build/index.html, build/script.js, build/style.css using cache key ${sha}`);
