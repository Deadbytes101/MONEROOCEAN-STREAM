<div align="center">

# mo-pool-ui

Static, framework-free web dashboard for the MoneroOcean mining pool.
<img width="911" height="912" alt="ICON" src="https://github.com/user-attachments/assets/022b871c-9bf3-4f42-b88c-ed55a227624f" />

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A522.9-brightgreen.svg" alt="Node >=22.9">
  <img src="https://img.shields.io/badge/platform-browser-lightgrey.svg" alt="Platform: browser">
  <img src="https://img.shields.io/badge/focus-frontend-d29922.svg" alt="Focus: frontend">
  <a href="https://github.com/MoneroOcean"><img src="https://img.shields.io/badge/MoneroOcean-ecosystem-6f42c1.svg" alt="MoneroOcean ecosystem"></a>
</p>

</div>

## Overview

mo-pool-ui is a static dashboard for the MoneroOcean mining pool. It talks directly to the public MoneroOcean pool API, lets miners inspect pool and wallet state, and keeps the deployed surface to three files: `index.html`, `script.js`, and `style.css`.

Internally the dashboard is split into small ES modules under `src/`, with `script.js` kept as the stable browser and build entry point. The production build bundles those modules back into `build/script.js`, minifies CSS, and adds a git-based cache key to the generated HTML.

The UI is the frontend companion to [nodejs-pool](https://github.com/MoneroOcean/nodejs-pool), the pool backend whose API it consumes. It has no third-party browser framework dependency.

## DBYTE agent release evidence

This repository also contains the DBYTE agent release gate under `crates/dbyte-agent/` and `scripts/`.

The release artifact contract is documented in [`docs/release-artifact-contract.md`](docs/release-artifact-contract.md). It defines the local release report, JSON manifest, checker report, manifest seal, seal readback, and invariants required for a valid release.

The operator runbook is documented in [`docs/operator-runbook.md`](docs/operator-runbook.md). It keeps the merge gate, agent artifact commands, and Agent dashboard health check in one place.

## Features

- Pool overview, coin list, blocks, payments, uptime, and profit calculator views.
- Wallet dashboard with workers, hashrate charts, block rewards, payout history, and wallet settings helpers.
- Miner setup command generation for MoneroOcean XMRig, SRBMiner-Multi, Multi-Miner, xmrig-proxy, and xmr-node-proxy.
- Hash-route navigation with SEO metadata and canonical URL updates.
- Local display preferences for theme and explanatory text.
- Focused Node.js tests for routing, formatting, wallet behavior, setup output, scheduler behavior, build invariants, and pool-specific calculations.

## Architecture

| Path | Role |
| --- | --- |
| `index.html` | Static shell and crawler-visible metadata. |
| `style.css` | Full UI styling, bundled and minified during build. |
| `script.js` | Browser/build entry point that starts the app (`startApp` from `src/main.js`). |
| `src/` | Application modules: API calls, routing, views, formatting, charting, state, preferences, setup helpers, and wallet logic. |
| `src/views/` | Rendered page views. |
| `src/styles/` | Style sources used by the build. |
| `tests/` | Node.js test suite plus Playwright end-to-end tests. |
| `scripts/build-static.sh` | Static bundling helper. |
| `build.sh` | Production build and deploy script. |

The source uses modern JavaScript modules during development, and esbuild produces an ES2022 IIFE for deployment.

## Install

```sh
npm install
```

Requires Node.js `>=22.9.0` and npm `>=11.10.0` (see `engines` in `package.json`).

## Usage

Build and deploy to `/var/www/mo-pool-ui`:

```sh
npm run build
```

The build script removes and recreates `build/`, bundles `script.js` with esbuild, bundles `style.css`, rewrites cache-busted asset URLs in `build/index.html`, runs the test suite, and copies the result to `/var/www/mo-pool-ui`.

To produce only the static bundle without deploying:

```sh
npm run build:static
```

## Testing

```sh
npm run verify
```

Runs the full local gate: clean step, lint, Node.js unit and integration tests, Playwright browser checks, DBYTE agent gate, and static build. A valid run ends with `FULL VERIFY GATE PASSED`.

Additional targets:

```sh
npm test           # JavaScript and browser test suite
npm run test:unit  # focused Node.js unit suite
npm run test:e2e   # builds the static bundle, then runs Playwright e2e tests
```

The end-to-end target builds the static output first and drives a real browser via Playwright, so it requires the Playwright browser binaries to be installed (`npx playwright install`) and is heavier than the default unit run.

## Contributors

- [MoneroOcean](https://github.com/MoneroOcean) - MoneroOcean-specific maintenance and current dashboard refactor.
- [Thunderosa](https://github.com/Thunderosa) - main early author in the SupportXMR GUI lineage.
- [M5M400](https://github.com/M5M400) - SupportXMR GUI owner and contributor.
- [tevador](https://github.com/tevador) - legacy GUI contribution.
- [mesh0000](https://github.com/mesh0000) - main author of the older `poolui` / XMRPoolUI frontend.
- Snipa22 / Alexander Blair - `nodejs-pool` backend author/maintainer and minor `poolui` contributor.

## Lineage

This UI is based on MoneroOcean's legacy `moneroocean-gui`, which was forked from `M5M400/supportxmr-gui`. It is designed for MoneroOcean's `nodejs-pool` API, whose history traces through Snipa22's `nodejs-pool`, Mesh00's AngularJS `poolui` / XMRPoolUI frontend, and Zone117x's original `node-cryptonote-pool`.

Based on work of [Thunderosa](https://github.com/Thunderosa) and [mesh0000](https://github.com/mesh0000).

## MoneroOcean ecosystem

| Component | Role |
| --- | --- |
| [nodejs-pool](https://github.com/MoneroOcean/nodejs-pool) | Pool backend — stratum, share storage, payments |
| [mo-pool-ui](https://github.com/MoneroOcean/mo-pool-ui) | Static web frontend for the pool |
| [xmr-node-proxy](https://github.com/MoneroOcean/xmr-node-proxy) | Stratum proxy / share aggregator |
| [mo-miner](https://github.com/MoneroOcean/mo-miner) | MoneroOcean end-user CPU/GPU mining client (multi-algo) |
| [multi-miner](https://github.com/MoneroOcean/multi-miner) | Multi-algo miner manager |
| [node-powhash](https://github.com/MoneroOcean/node-powhash) | Native multi-algo PoW hashing addon |
| [node-randomx](https://github.com/MoneroOcean/node-randomx) | Native RandomX hashing addon |
| [node-blocktemplate](https://github.com/MoneroOcean/node-blocktemplate) | Native block-template & serialization addon |
| [grpc-json-proxy](https://github.com/MoneroOcean/grpc-json-proxy) | gRPC ↔ JSON-RPC proxy (Tari base node) |

## License

MIT — see [LICENSE](LICENSE).
