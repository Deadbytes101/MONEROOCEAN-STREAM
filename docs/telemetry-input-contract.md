# Telemetry Input Contract

This document defines the first DBYTE agent telemetry report format.

## Scope

Telemetry is explicit input from an owned local rig.

The script does not start mining, install services, hide work, scrape private accounts, or deploy anything. It only turns provided runtime numbers into a local report artifact.

## Report file

The default telemetry artifact is:

```text
reports/dbyte-agent-telemetry.txt
```

The file is ignored by git because `reports/` is runtime output.

## Command

```powershell
.\scripts\report-agent-telemetry.ps1 `
  -MachineName "deadbyte-local" `
  -Algorithm "randomx" `
  -Hashrate 1200 `
  -HashrateUnit "hps" `
  -AcceptedShares 10 `
  -RejectedShares 0 `
  -UptimeSeconds 3600 `
  -Pool "manual" `
  -Source "manual"
```

## Fields

The report uses stable `key=value` lines:

```text
telemetry.schema=1
telemetry.source=<manual|future-adapter>
telemetry.ts_unix=<unix timestamp>
machine.name=<local machine name>
miner.algorithm=<algorithm label>
miner.hashrate=<numeric hashrate>
miner.hashrate_unit=<hps|khps|mhps|custom>
miner.accepted_shares=<non-negative integer>
miner.rejected_shares=<non-negative integer>
miner.reject_rate=<rejected / total shares>
miner.uptime_seconds=<non-negative integer>
pool.name=<pool label>
```

## Invariants

A valid telemetry report must satisfy:

```text
machine.name is not empty
miner.algorithm is not empty
miner.hashrate is non-negative
miner.accepted_shares is non-negative
miner.rejected_shares is non-negative
miner.uptime_seconds is non-negative
miner.reject_rate is derived from accepted and rejected shares
```

## Design rule

The telemetry report is a contract, not an actuator.

It records what the rig reports. It does not decide whether to mine, where to connect, or how to run a miner.

Future routing policy must read telemetry as input and produce a separate explicit decision artifact.
