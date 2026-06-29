import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chartRows, fixtures } from "./fixtures.mjs";

const root = join(process.cwd(), "build");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith("/api/")) {
    writeJson(response, apiBody(url.pathname.replace(/^\/api\/+/, ""), request.method || "GET"));
    return;
  }

  if (url.pathname === "/reports/dbyte-agent-telemetry.json") {
    writeJson(response, {
      telemetry_schema: 1,
      telemetry_source: "e2e",
      telemetry_ts_unix: Math.floor(Date.now() / 1000),
      machine_name: "e2e-local",
      miner_algorithm: "randomx",
      miner_hashrate: 1200,
      miner_hashrate_unit: "hps",
      miner_accepted_shares: 10,
      miner_rejected_shares: 0,
      miner_reject_rate: 0,
      miner_uptime_seconds: 3600,
      pool_name: "test"
    });
    return;
  }

  if (url.pathname === "/sw.js") {
    writeText(response, "text/javascript; charset=utf-8", "self.addEventListener('install', () => self.skipWaiting());\n");
    return;
  }

  if (url.pathname === "/manifest.webmanifest") {
    writeJson(response, { name: "MoneroOcean", start_url: "/", display: "standalone" });
    return;
  }

  if (url.pathname === "/icon.svg") {
    writeText(response, "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'><rect width='1' height='1'/></svg>");
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const path = normalize(join(root, pathname));
  if (!path.startsWith(root) || !existsSync(path) || !(await stat(path)).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
  createReadStream(path).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Serving build on http://127.0.0.1:${port}\n`);
});

function apiBody(path, method) {
  if (method === "POST") return { msg: "Saved." };
  if (path === "config") return fixtures.config;
  if (path === "pool/ports") return fixtures.poolPorts;
  if (path === "pool/stats") return { pool_statistics: fixtures.poolStats };
  if (path === "network/stats") return fixtures.networkStats;
  if (path === "pool/chart/hashrate") return chartRows(24, 221_000_000);
  if (path === "pool/motd") return fixtures.motd;
  if (path === "pool/payments") return fixtures.payments;
  if (path === "pool/blocks") return fixtures.blocks;
  if (path.startsWith("pool/coin_altblocks/")) return fixtures.altBlocks;
  if (path.startsWith("miner/") && path.endsWith("/stats/allWorkers")) return fixtures.walletWorkers;
  if (path.startsWith("miner/") && path.endsWith("/chart/hashrate/allWorkers")) return fixtures.workerCharts;
  if (path.startsWith("miner/") && path.endsWith("/chart/hashrate")) return chartRows(18, 100_000);
  if (path.startsWith("miner/") && path.endsWith("/payments")) return fixtures.walletPayments;
  if (path.startsWith("miner/") && path.endsWith("/block_payments")) return fixtures.walletBlocks;
  if (path.startsWith("miner/") && path.endsWith("/stats")) return fixtures.walletStats;
  if (path === "fx/usd-thb") return { rates: { THB: 36 } };
  if (path.startsWith("user/")) return fixtures.userSettings;
  return {};
}

function writeJson(response, body) {
  writeText(response, "application/json; charset=utf-8", JSON.stringify(body));
}

function writeText(response, contentType, body) {
  response.writeHead(200, { "content-type": contentType });
  response.end(body);
}
