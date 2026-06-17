import test from "node:test";
import assert from "node:assert/strict";
import { RefreshScheduler } from "../src/scheduler.js";
import { minerEndpoint, POOL_CHART, WALLET_CHART, WALLET_WORKER_CHARTS } from "../src/api.js";
import { hasColdGraphLoad, isSameViewNavigation, isStaticRoute, shouldScrollToTop, shouldShowLoading } from "../src/render-policy.js";
import { compactWorkerRows, sortWorkerListRows, workerListSortMode, workerStatus } from "../src/wallet.js";
import { blockPaymentStage } from "../src/views/blocks.js";
import { annotateBlockRewards, blockRewardValueCell, walletWorkersSection } from "../src/views/wallet.js";

test.describe("wallet workers and render policy", { concurrency: false }, () => {
  test("worker list model unions current stats and charts with active stale dead status", () => {
    const now = 10_000_000;
    assert.equal(workerStatus(true, 1, 9400, now), "Active");
    assert.equal(workerStatus(true, 1, 9399, now), "Stale");
    assert.equal(workerStatus(false, 1, 9990, now), "Dead");
    assert.equal(workerStatus(true, 0, 9990, now), "Dead");

    const workers = compactWorkerRows({
      active: { hsh2: 20, hsh: 200, lastHash: 9700, totalHash: 1000, validShares: 5, invalidShares: 1, lastShareAlgo: "rx/0" },
      stale: { hsh2: 40, hsh: 400, lastHash: 9300, totalHashes: 2000, valid: 8, invalid: 2 },
      dead: { hsh2: 0, hsh: 0, lastHash: 9950, hashes: 3000, valid: 1, invalid: 3 },
      global: { hsh2: 999 }
    }, {
      active: [{ tme: 9990, hsh2: 10, hsh: 100 }, { tme: 9980, hsh2: 30, hsh: 300 }],
      chartOnly: [{ tme: 9800, hsh2: 15, hsh: 150 }]
    }, now);

    assert.deepEqual(workers.map((worker) => worker.n), ["stale", "active", "chartOnly", "dead"]);
    const byName = Object.fromEntries(workers.map((worker) => [worker.n, worker]));
    assert.equal(byName.active.l, 9990);
    assert.equal(byName.active.status, "Active");
    assert.equal(byName.active.ax, 20);
    assert.equal(byName.active.la, "rx/0");
    assert.equal(byName.stale.status, "Stale");
    assert.equal(byName.dead.status, "Dead");
    assert.equal(byName.chartOnly.status, "Dead");
    assert.equal(byName.chartOnly.l, 9800);
  });

  test("worker list sorting defaults to name and supports list columns", () => {
    const workers = [
      { n: "active", status: "Active", la: "rx/0", xmr: 20, raw: 200, ax: 20, ar: 200, l: 9990, vs: 5, is: 1, totalHashes: 1000 },
      { n: "stale", status: "Stale", la: "kawpow", xmr: 40, raw: 400, ax: 0, ar: 0, l: 9300, vs: 8, is: 2, totalHashes: 2000 },
      { n: "dead", status: "Dead", la: "", xmr: 0, raw: 0, ax: 0, ar: 0, l: 9950, vs: 1, is: 3, totalHashes: 3000 },
      { n: "chartOnly", status: "Dead", la: "ghostrider", xmr: 0, raw: 0, ax: 15, ar: 150, l: 9800, vs: 0, is: 0, totalHashes: 0 }
    ];

    assert.equal(workerListSortMode("bad"), "name");
    assert.equal(workerListSortMode("status"), "name");
    assert.equal(workerListSortMode("algo"), "algo");
    assert.deepEqual(sortWorkerListRows(workers).map((worker) => worker.n), ["active", "chartOnly", "dead", "stale"]);
    assert.deepEqual(sortWorkerListRows(workers, "name", "asc").map((worker) => worker.n), ["active", "chartOnly", "dead", "stale"]);
    assert.equal(sortWorkerListRows(workers, "xmr")[0].n, "stale");
    assert.equal(sortWorkerListRows(workers, "raw")[0].n, "stale");
    assert.equal(sortWorkerListRows(workers, "avg")[0].n, "active");
    assert.equal(sortWorkerListRows(workers, "avgraw")[0].n, "active");
    assert.equal(sortWorkerListRows(workers, "last")[0].n, "active");
    assert.equal(sortWorkerListRows(workers, "algo", "asc")[0].n, "dead");
    assert.equal(sortWorkerListRows(workers, "valid")[0].n, "stale");
    assert.equal(sortWorkerListRows(workers, "invalid")[0].n, "dead");
    assert.equal(sortWorkerListRows(workers, "hashes")[0].n, "dead");
  });

  test("worker list omits status column and renders red stale and dead rows", () => {
    const address = `4${"A".repeat(94)}`;
    const workers = compactWorkerRows({
      active: { hsh2: 20, hsh: 200, lastHash: 9990 },
      stale: { hsh2: 40, hsh: 400, lastHash: 9300 },
      dead: { hsh2: 0, hsh: 0, lastHash: 9950 }
    }, {
      chartOnly: [{ tme: 9800, hsh2: 15, hsh: 150 }]
    }, 10_000_000);
    const html = walletWorkersSection(address, workers, {}, "12h", "xmr", "status", "desc", false, "list");

    for (const key of ["name", "algo", "xmr", "raw", "avg", "avgraw", "last", "valid", "invalid", "hashes"]) {
      assert.match(html, new RegExp(`sort=${key}`));
    }
    assert.doesNotMatch(html, /sort=status/);
    assert.doesNotMatch(html, />Status</);
    assert.match(html, />Algo</);
    assert.match(html, />--</);
    assert.doesNotMatch(html, /<span class=red>Stale<\/span>/);
    assert.doesNotMatch(html, /<span class=red>Dead<\/span>/);
    assert.match(html, /<span class=red>stale<\/span>/);
    assert.match(html, /<span class=red>dead<\/span>/);
    assert.match(html, /aria-current=page>Dead<\/a><a class=chip href="[^"]*view=list[^"]*" aria-current=page>List<\/a>/);
    assert.match(html, /view=list/);

    const hiddenHtml = walletWorkersSection(address, workers, {}, "12h", "xmr", "name", "asc", false, "list", false);
    assert.match(hiddenHtml, />Dead<\/a><a class=chip href="[^"]*view=list[^"]*" aria-current=page>List<\/a>/);
    assert.match(hiddenHtml, /<span class=red>stale<\/span>/);
    assert.doesNotMatch(hiddenHtml, /<span class=red>dead<\/span>/);
    assert.doesNotMatch(hiddenHtml, /<span class=red>chartOnly<\/span>/);
    assert.match(hiddenHtml, /dead=0/);
  });

  test("worker graph modes mark stale and dead worker names red", () => {
    const address = `4${"A".repeat(94)}`;
    const workers = compactWorkerRows({
      active: { hsh2: 20, hsh: 200, lastHash: 9990 },
      stale: { hsh2: 40, hsh: 400, lastHash: 9300 },
      dead: { hsh2: 0, hsh: 0, lastHash: 9950 }
    }, {
      active: [{ tme: 9990, hsh2: 20 }],
      stale: [{ tme: 9300, hsh2: 40 }],
      dead: [{ tme: 9950, hsh2: 0 }],
      chartOnly: [{ tme: 9800, hsh2: 15 }]
    }, 10_000_000);
    const charts = {
      active: [{ tme: 9990, hsh2: 20 }],
      stale: [{ tme: 9300, hsh2: 40 }],
      dead: [{ tme: 9950, hsh2: 0 }],
      chartOnly: [{ tme: 9800, hsh2: 15 }]
    };
    const html = walletWorkersSection(address, workers, charts, "12h", "xmr", "h", "desc", false, 2);

    assert.doesNotMatch(html, /Dead\/stale:/);
    assert.match(html, /<h3>active/);
    assert.match(html, /<h3><span class=red title="Stale">stale<\/span>/);
    assert.match(html, /<h3><span class=red title="Dead">dead<\/span>/);
    assert.match(html, /<h3><span class=red title="Dead">chartOnly<\/span>/);
    assert.match(html, /<div class="worker-chart-header red"><h3><span class=red title="Dead">chartOnly<\/span> <span class=last-share-age/);
    assert.match(html, /<div class="worker-chart-header red"><h3><span class=red title="Dead">dead<\/span> <span class=last-share-age/);
    assert.match(html, /<span class=red title="Dead">0 H\/s<\/span>/);

    const hiddenHtml = walletWorkersSection(address, workers, charts, "12h", "xmr", "h", "desc", false, 2, false);
    assert.match(hiddenHtml, /<h3><span class=red title="Stale">stale<\/span>/);
    assert.doesNotMatch(hiddenHtml, /<h3><span class=red title="Dead">dead<\/span>/);
    assert.doesNotMatch(hiddenHtml, /<h3><span class=red title="Dead">chartOnly<\/span>/);
    assert.match(hiddenHtml, /dead=0/);

    const detailHtml = walletWorkersSection(address, workers, charts, "all", "xmr", "h", "desc", true, 2);
    assert.match(detailHtml, /<small>Last algo --<\/small>/);

    const fiveColumnHtml = walletWorkersSection(address, workers, charts, "12h", "xmr", "h", "desc", false, 5);
    assert.match(fiveColumnHtml, /class="worker-graph-grid w5"/);
    assert.match(fiveColumnHtml, /view=4&sort=h&dir=desc/);
    assert.match(fiveColumnHtml, /view=5&sort=h&dir=desc/);
  });

  test("block payout stage keeps unlock and pay-stage detail", () => {
    const pool = { coins: { 18081: { blockTime: 120 } } };
    assert.equal(blockPaymentStage({ height: 1000 }, "18081", pool, { 18081: { height: 1015 } }), "30 Mins Left");
    assert.equal(blockPaymentStage({ height: 1000 }, "18081", pool, { 18081: { height: 1035 } }), "Soon");
    assert.equal(blockPaymentStage({ height: 1000 }, "18081", pool, { 18081: { height: 1050 } }), "Delayed");
    assert.equal(blockPaymentStage({ pay_stage: "Pay stage" }, "9998", pool, {}), "Pay stage");
    assert.equal(blockPaymentStage({ payStatus: "Backend stage" }, "18081", pool, {}), "Backend stage");
    // Non-XMR coins honor the same pay_status/payStatus fallbacks as the XMR branch.
    assert.equal(blockPaymentStage({ payStatus: "Coin stage" }, "9998", pool, {}), "Coin stage");
    assert.equal(blockPaymentStage({ pay_status: "Coin status" }, "9998", pool, {}), "Coin status");
    assert.equal(blockPaymentStage({}, "9998", pool, {}), "Pending");
  });

  test("refresh scheduler dedupes timing state and can tick manually", async () => {
    let ticks = 0;
    const scheduler = new RefreshScheduler({ interval: 10, jitter: 0, onTick: async () => { ticks += 1; } });
    scheduler.start();
    await scheduler.tick();
    scheduler.stop();
    assert.equal(ticks, 1);
  });

  test("refresh scheduler backs off on failure, clamps at 5 min, and resets after success", async () => {
    const delays = [];
    let calls = 0;
    const scheduler = new RefreshScheduler({ interval: 1000, jitter: 0, onTick: async () => {
      calls += 1;
      if (calls < 3) throw new Error("boom");
    } });
    scheduler.running = true;
    scheduler.schedule = (delay) => delays.push(delay);
    await scheduler.tick();
    await scheduler.tick();
    await scheduler.tick();
    assert.deepEqual(delays, [1000, 2000, 1000]);
    assert.equal(scheduler.failures, 0);

    const clamp = new RefreshScheduler({ interval: 200_000, jitter: 0, onTick: async () => { throw new Error("boom"); } });
    clamp.running = true;
    clamp.failures = 4;
    const clampDelays = [];
    clamp.schedule = (delay) => clampDelays.push(delay);
    await clamp.tick();
    assert.deepEqual(clampDelays, [300_000]);
  });

  test("block reward annotation marks only the stale pruned zero tail", () => {
    const day = 24 * 60 * 60;
    const now = 1_000_000 * 1000;
    const nowSec = now / 1000;
    const rewards = [
      { ts: nowSec - 1 * day, value: 5, value_percent: 1 },
      { ts: nowSec - 1 * day, value: 0, value_percent: 0 },
      { ts: nowSec - 3 * day, value: 0, value_percent: 0 },
      { ts: nowSec - 4 * day, value: 0, value_percent: 0 }
    ];
    const annotated = annotateBlockRewards(rewards, now);
    assert.deepEqual(annotated.map((row) => row.s), [false, false, true, true], "only old trailing zeros are stale");

    const reset = annotateBlockRewards([
      { ts: nowSec - 4 * day, value: 0, value_percent: 0 },
      { ts: nowSec - 5 * day, value: 7, value_percent: 2 }
    ], now);
    assert.deepEqual(reset.map((row) => row.s), [false, false], "a later non-zero reward clears earlier stale zeros");

    assert.equal(blockRewardValueCell(0, 8, false), "0");
    assert.match(blockRewardValueCell(0, 8, true).html, /class=red title=.*DB-pruned/);
    assert.equal(blockRewardValueCell(1.5, 8, true), "1.5");
  });

  test("isSameViewNavigation keeps same-name static views and same wallet tab", () => {
    const address = `4${"A".repeat(94)}`;
    assert.equal(isSameViewNavigation(null, { n: "home" }), false);
    assert.equal(isSameViewNavigation({ n: "home" }, { n: "home" }), true);
    assert.equal(isSameViewNavigation({ n: "payments" }, { n: "payments" }), true);
    assert.equal(isSameViewNavigation({ n: "calc" }, { n: "calc" }), true);
    assert.equal(isSameViewNavigation({ n: "setup" }, { n: "setup" }), false);
    assert.equal(isSameViewNavigation({ n: "wallet", a: address, t: "overview" }, { n: "wallet", a: address, t: "overview" }), true);
    assert.equal(isSameViewNavigation({ n: "wallet", a: address, t: "overview" }, { n: "wallet", a: address, t: "rewards" }), false);
    assert.equal(isSameViewNavigation({ n: "wallet", a: address, t: "overview" }, { n: "wallet", a: "other", t: "overview" }), false);
  });

  test("render critical path only shows loaders for cold graph views", () => {
    const address = `4${"A".repeat(94)}`;
    const appState = { c: new Map(), w: [{ address }] };
    const home = { n: "home", p: "#/", q: {} };
    const coins = { n: "coins", p: "#/coins?sort=name", q: { sort: "name" } };
    const walletOverview = { n: "wallet", p: `#/wallet/${address}`, a: address, t: "overview", q: {} };
    const walletWorkers = { n: "wallet", p: `#/wallet/${address}/workers`, a: address, t: "workers", q: {} };

    assert.equal(isSameViewNavigation({ n: "coins", q: { sort: "pplns" } }, coins), true);
    assert.equal(isSameViewNavigation({ n: "blocks", c: "XMR" }, { n: "blocks", c: "XMR" }), true);
    assert.equal(isSameViewNavigation({ n: "blocks", c: "XMR" }, { n: "blocks", c: "RTM" }), false);
    assert.equal(isSameViewNavigation(walletOverview, walletWorkers), false);
    assert.equal(isStaticRoute({ n: "help" }), true);
    assert.equal(isStaticRoute({ n: "payments" }), false);
    assert.equal(shouldScrollToTop(home, walletOverview, false, false), true);
    assert.equal(shouldScrollToTop(home, walletOverview, false, true), false);

    assert.equal(hasColdGraphLoad(home, appState), true);
    assert.equal(shouldShowLoading(coins, home, { appState }), true);
    assert.equal(shouldShowLoading(coins, home, { background: true, appState }), false);
    assert.equal(shouldShowLoading(home, home, { appState }), false);
    assert.equal(shouldShowLoading({ n: "coins", q: { sort: "pplns" } }, coins, { appState }), false);
    assert.equal(shouldShowLoading(home, { n: "payments", q: {} }, { appState }), false);
    assert.equal(hasColdGraphLoad(walletOverview, appState), true);
    assert.equal(hasColdGraphLoad(walletWorkers, appState), false);
    assert.equal(hasColdGraphLoad({ ...walletOverview, a: "bad" }, appState), false);

    appState.c.set(POOL_CHART, {});
    appState.c.set(minerEndpoint(address, WALLET_CHART), {});
    assert.equal(hasColdGraphLoad(home, appState), false);
    assert.equal(hasColdGraphLoad(walletOverview, appState), true);

    appState.c.set(minerEndpoint(address, WALLET_WORKER_CHARTS), {});
    assert.equal(hasColdGraphLoad(walletOverview, appState), false);
    assert.equal(shouldShowLoading(home, walletOverview, { appState }), false);
  });
});
