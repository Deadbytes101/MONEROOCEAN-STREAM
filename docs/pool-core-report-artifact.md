# Pool Core Report Artifact

`reports/dbyte-pool-ledger-report.json` is the first DBYTE pool-core accounting artifact produced by the local verification gate.

`reports/dbyte-pool-ledger-fixture-report.json` is the deterministic non-zero replay fixture report produced by the same gate.

## Purpose

The artifacts prove that pool-core can emit machine-readable replay summaries before later integration work begins.

The current reports contain:

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
cargo run --manifest-path crates/dbyte-pool-core/Cargo.toml --quiet --bin dbyte-pool-ledger-report -- --fixture two-session
verify reports/dbyte-pool-ledger-fixture-report.json
```

Expected confirmation:

```text
POOL LEDGER REPORT VERIFIED
POOL LEDGER FIXTURE REPORT VERIFIED
POOL CORE TEST GATE PASSED
```

## Index surface

The agent report index includes these artifacts as `pool_core_ledger` and `pool_core_fixture_ledger`.

Expected index entries:

```json
{
  "name": "pool_core_ledger",
  "kind": "json",
  "path": "reports\\dbyte-pool-ledger-report.json",
  "required": true,
  "exists": true,
  "status": "present",
  "replay_status": "ok",
  "replay_total_events": 0
}
```

```json
{
  "name": "pool_core_fixture_ledger",
  "kind": "json",
  "path": "reports\\dbyte-pool-ledger-fixture-report.json",
  "required": true,
  "exists": true,
  "status": "present",
  "replay_status": "ok",
  "replay_total_events": 2,
  "replay_accepted_events": 1,
  "replay_rejected_events": 1,
  "replay_credited_difficulty": 10,
  "replay_session_count": 2
}
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

## Current fixture shape

The `two-session` fixture report proves non-zero counters through the same replay path:

```json
{
  "schema": 1,
  "status": "ok",
  "total_events": 2,
  "accepted_events": 1,
  "rejected_events": 1,
  "credited_difficulty": 10,
  "sessions": [
    {
      "session_id": 1,
      "accepted_shares": 1,
      "rejected_shares": 0,
      "credited_difficulty": 10
    },
    {
      "session_id": 2,
      "accepted_shares": 0,
      "rejected_shares": 1,
      "credited_difficulty": 0
    }
  ]
}
```

## Rule

Treat these artifacts as the pool stack's first accounting evidence surfaces. Future accounting work should make these reports richer without weakening the gate.
