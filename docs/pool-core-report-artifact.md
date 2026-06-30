# Pool Core Report Artifact

`reports/dbyte-pool-ledger-report.json` is the first DBYTE pool-core accounting artifact produced by the local verification gate.

## Purpose

The artifact proves that pool-core can emit a machine-readable replay summary before later integration work begins.

The current report contains:

- schema version
- status
- total event count
- accepted event count
- rejected event count
- credited difficulty total
- sorted per-session counters

## Gate

`npm run verify` runs `scripts/verify-pool-core.mjs` before the browser, dashboard, and agent gates.

The pool-core gate now does this:

```text
cargo fmt --manifest-path crates/dbyte-pool-core/Cargo.toml -- --check
cargo test --manifest-path crates/dbyte-pool-core/Cargo.toml -- --test-threads=1
cargo run --manifest-path crates/dbyte-pool-core/Cargo.toml --quiet --bin dbyte-pool-ledger-report
verify reports/dbyte-pool-ledger-report.json
```

Expected confirmation:

```text
POOL LEDGER REPORT VERIFIED
POOL CORE TEST GATE PASSED
```

## Current default shape

The default report is an empty, valid replay report:

```json
{
  "schema": 1,
  "status": "ok",
  "total_events": 0,
  "accepted_events": 0,
  "rejected_events": 0,
  "credited_difficulty": 0,
  "sessions": []
}
```

## Rule

Treat this artifact as the pool stack's first accounting evidence surface. Future accounting work should make this report richer without weakening the gate.
