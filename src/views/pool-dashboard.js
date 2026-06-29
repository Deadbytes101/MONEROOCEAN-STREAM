import { EXPLANATIONS } from "../constants.js";
import { formatHashrate, formatNumber, formatPercent } from "../format.js";
import { effortPercent, topCoinPort, worldHashrateForPort } from "../pool.js";
import { kpi, linkLabel, uptimeLabel } from "./common.js";
import { blockRoute } from "./blocks.js";

function blockCount(pool) {
  return pool.blocksFound || pool.totalBlocksFound || pool.totalBlocks || pool.validBlocks || pool.totalBlocks || 0;
}

export function poolDashboard(pool, network, uptime) {
  const topPort = topCoinPort(pool);
  const topWorld = worldHashrateForPort(network[topPort] || network[Number(topPort)] || {}, topPort, pool);
  return `<section class="panel pool-overview">
    <div class=card>
      <div class="grid kpi-grid pool-kpi-grid">
        ${kpi("Wallets", formatNumber(pool.miners), "Connected pool wallets.")}
        ${kpi(linkLabel("Pool hashrate", "#/coins"), formatHashrate(pool.hashRate), EXPLANATIONS.normalizedHashrate)}
        ${kpi("XMR world", formatHashrate(topWorld), "Network estimate for the current top coin.")}
        ${kpi(linkLabel("XMR last effort", blockRoute(topPort, 1, undefined, pool)), formatPercent(effortPercent(pool, network, topPort)), EXPLANATIONS.luck)}
        ${kpi("Blocks Found", formatNumber(blockCount(pool)), "")}
        ${kpi(linkLabel("Payments made", "#/payments"), formatNumber(pool.totalPayments), "")}
      </div>
    </div>
  </section>`;
}
