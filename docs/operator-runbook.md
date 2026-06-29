# Operator Runbook

This repo is operated through a small set of explicit local commands.

## Full gate

Run this before merging any pull request:

```powershell
npm run verify
```

This runs the local clean step, lint, JavaScript tests, browser checks, the DBYTE agent gate, and the static build.

A valid run ends with:

```text
FULL VERIFY GATE PASSED
```

## Agent artifacts

Generate local agent telemetry:

```powershell
.\scripts\report-agent-telemetry.ps1
```

Generate the read-only decision artifact:

```powershell
.\scripts\report-agent-decision.ps1
```

Generate the read-only report index:

```powershell
.\scripts\report-agent-index.ps1
```

Build and verify the release evidence:

```powershell
.\scripts\verify-agent.ps1
```

The report index is written to:

```text
reports\dbyte-agent-index.json
```

Expected healthy index fields:

```text
index_scope: read_only
index_status: ok
missing_required_count: 0
```

## Dashboard operator view

Open the Agent route:

```text
#/agent
```

Read the top panel first:

```text
DBYTE Agent Health
```

Expected healthy state:

```text
Health: ok
Reason: local_artifacts_fresh
Next: observe
```

Anything else is operator attention. Refresh stale artifacts before trusting local status.

## Merge rule

Do not merge until the working tree is clean and the full gate passes:

```powershell
git status
npm run verify
```

Simple rule: no green gate, no merge.
