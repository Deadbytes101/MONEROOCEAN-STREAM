# DBYTE Pool Stack Architecture

This document sets the long-term direction for turning the current dashboard and local evidence tooling into a DBYTE-owned pool and miner stack.

The goal is not to clone MoneroOcean blindly. The goal is to build a small, explicit, testable stack that can eventually compete with MoneroOcean by being easier to inspect, easier to verify, and harder to operate incorrectly.

## Operating boundary

This stack is for owned infrastructure and authorized rigs only.

Non-goals:

- No stealth mining.
- No hidden deployment.
- No persistence or evasion behavior.
- No third-party machine control without explicit consent.
- No payout transaction without operator-visible evidence and an explicit release gate during early development.

## Design principles

- Truth before convenience.
- Every state transition must be observable.
- Every report artifact must be reproducible.
- Every critical decision must have a machine-readable reason.
- Every daemon-facing action must have a dry-run test path.
- Operator dashboards must display causes, not just colors.
- The system should prefer small native components over a large opaque service.

## Current base

The current repository is a static dashboard and local evidence layer. It is not a pool backend yet.

Current useful pieces:

- Static dashboard shell.
- Agent dashboard route.
- Local telemetry, decision, and report index artifacts.
- Freshness checks for telemetry, decision, and report index JSON.
- Release manifest, checker report, manifest seal, and readback checks.
- Full local gate through `npm run verify`.

## Target stack

```text
DBYTE Pool Stack
├─ pool-core
│  ├─ stratum listener
│  ├─ miner sessions
│  ├─ job distribution
│  ├─ share validation
│  ├─ vardiff policy
│  └─ reject reason model
├─ ledger
│  ├─ append-only share events
│  ├─ replay verifier
│  ├─ wallet accounting
│  └─ worker hashrate windows
├─ coin-daemon bridge
│  ├─ daemon RPC client
│  ├─ block template fetch
│  ├─ block candidate submit
│  └─ reorg and orphan observation
├─ payout engine
│  ├─ payout threshold policy
│  ├─ dry-run payout report
│  ├─ signed payout intent
│  └─ operator-approved send path
├─ miner stack
│  ├─ local rig profile
│  ├─ benchmark report
│  ├─ algorithm capability table
│  └─ operator-visible switch reason
└─ dashboard
   ├─ pool health
   ├─ miner health
   ├─ share ledger health
   ├─ payout evidence
   └─ release evidence
```

## Phase 1: Pool core scaffold

Purpose: build the backend skeleton before touching real money or real payouts.

Deliverables:

- `crates/dbyte-pool-core/`
- typed miner session model
- typed job model
- typed share submit model
- reject reason enum
- in-memory fake stratum harness
- deterministic unit tests for accepted and rejected shares

Exit gate:

```text
pool-core tests pass
no daemon required
no payout code present
no live mining required
```

## Phase 2: Share ledger and accounting

Purpose: make share history replayable and inspectable.

Deliverables:

- append-only share event file
- replay verifier
- per-wallet share totals
- per-worker hashrate windows
- invalid share counters
- report JSON for dashboard display

Exit gate:

```text
same input ledger produces same accounting report
corrupt ledger is rejected
missing ledger produces explicit initialization state
```

## Phase 3: Coin daemon bridge

Purpose: connect pool-core to a daemon through a controlled boundary.

Deliverables:

- daemon RPC client
- block template parser
- block candidate serializer boundary
- dry-run daemon fixture tests
- daemon health report JSON

Exit gate:

```text
daemon fixture tests pass
live daemon integration remains opt-in
bad daemon response is rejected with a visible reason
```

## Phase 4: Payout evidence engine

Purpose: calculate payouts safely before allowing operator-approved sends.

Deliverables:

- payout threshold policy
- payout preview report
- payout intent file
- payout checker
- no automatic send in early versions

Exit gate:

```text
payout dry-run report is reproducible
payout intent is verified before any send path exists
operator action is required for transaction broadcast
```

## Phase 5: Miner stack and algorithm switching

Purpose: compete with multi-algo pool/miner ecosystems by making switching explainable.

Deliverables:

- local rig profile
- benchmark evidence
- algorithm capability matrix
- profitability input report
- switch decision report
- dashboard reason: why this algorithm now

Exit gate:

```text
switch decision is explainable
switch decision can be replayed
operator can override policy
no hidden miner control path exists
```

## First real engineering step

The next code-bearing change should not be another dashboard polish pass.

The next code-bearing change should create `crates/dbyte-pool-core/` with only typed models, reject reasons, and deterministic tests. Real networking should wait until the model tests are stable.

Simple rule: build the truth model before opening the socket.
