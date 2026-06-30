# DBYTE Agent Docs

Start here when reviewing the local DBYTE agent release and dashboard evidence.

| Document | Purpose |
| --- | --- |
| [Release Artifact Contract](release-artifact-contract.md) | Defines release evidence, manifest, checker output, seal, and integrity rules. |
| [Operator Runbook](operator-runbook.md) | Lists the full gate, agent artifact commands, dashboard health check, and merge rule. |
| [Report Index Fields](report-index-fields.md) | Defines the read-only report index fields and per-report entry meanings. |
| [Index Freshness](index-freshness.md) | Defines the report index freshness window and stale health labels. |

Simple rule: run `npm run verify`, then trust only the artifacts produced by the green gate.
