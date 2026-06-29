import { EXPLANATIONS } from "../constants.js";
import { formatHashrate, formatNumber, formatPercent } from "../format.js";
import { effortPercent, topCoinPort, worldHashrateForPort } from "../pool.js";
import { kpi, linkLabel } from "./common.js";
import { blockRoute } from "./blocks.js";

function pplnsWindow(pool) {
  const seconds = Number(pool.pplnsWindowTime) || 0;
  if (!seconds) return "--";
  return `${formatNumber(seconds / 3600, 2)} h`;
}

export function poolDashboard(pool, network) {
  const topPort = topCoinPort(pool);
  const topWorld = worldHashrateForPort(network[topPort] || network[Number(topPort)] || {}, topPort, pool);
  return `<section class="panel pool-overview">
    <div class=card>
      <div class="grid kpi-grid pool-kpi-grid">
        ${kpi("Wallets", formatNumber(pool.miners), "Connected pool wallets.")}
        ${kpi(linkLabel("Pool hashrate", "#/coins"), formatHashrate(pool.hashRate), EXPLANATIONS.normalizedHashrate)}
        ${kpi("XMR world", formatHashrate(topWorld), "Network estimate for the current top coin.")}
        ${kpi(linkLabel("XMR last effort", blockRoute(topPort, 1, undefined, pool)), formatPercent(effortPercent(pool, network, topPort)), EXPLANATIONS.luck)}
        ${kpi(linkLabel("Payments made", "#/payments"), formatNumber(pool.totalPayments), "Historical payout batches.")}
        ${kpi("PPLNS window", pplnsWindow(pool), EXPLANATIONS.pplns)}
      </div>
    </div>
  </section>`;
}
