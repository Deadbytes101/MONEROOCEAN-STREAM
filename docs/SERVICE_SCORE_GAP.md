# DBYTE Service Score Gap

This note explains the current score gap in the service capability evidence set.

## Current score

```text
readiness_tier=phase_i_report_ready
score=90
max_score=100
```

The current score means the evidence set is healthy. It is not a final completion claim.

## Why the score is not 100

The remaining 10 points are reserved for later proof. They should stay reserved until the project has a separate report, local verification step, dashboard projection, and negative tests for that capability.

## Closure checklist

```text
report_artifact_present=true
local_verification_present=true
dashboard_projection_present=true
negative_tests_present=true
```

## Rule

Do not raise the score just because a plan exists. Raise it only when the local evidence exists and the full verification gate stays green.
