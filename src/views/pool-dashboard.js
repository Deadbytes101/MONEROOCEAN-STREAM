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
        ${kpi("World XMR Hashrate", formatHashrate(topWorld), "")}
        ${kpi(linkLabel("Pool Hashrate", "#/coins"), formatHashrate(pool.hashRate), EXPLANATIONS.normalizedHashrate)}
        ${kpi(linkLabel("Current XMR Block Effort", blockRoute(topPort, 1, undefined, pool)), formatPercent(effortPercent(pool, network, topPort)), EXPLANATIONS.luck)}
        ${kpi("Blocks Found", formatNumber(blockCount(pool)), "")}
        ${kpi(uptimeLabel("Accounts Connected", uptime), formatNumber(pool.miners), "")}
        ${kpi(linkLabel("Payments Made", "#/payments"), formatNumber(pool.totalPayments), "")}
      </div>
    </div>
  </section>`;
}
