# DBYTE Service Capability Scorecard

The service capability scorecard is an operator-facing report artifact. It summarizes what the service evidence layer can prove today and what is still planned.

The scorecard is intentionally conservative. A score of `90/100` means the Phase I report and dashboard evidence is healthy. It does not mean the project is production-ready or public-service-ready.

## Current tier

```text
readiness_tier=phase_i_report_ready
score=90
max_score=100
production_ready=false
public_service_ready=false
```

The remaining 10 points are reserved for the later controlled service implementation and its own gates.

## Current capability buckets

```text
deterministic_replay_spine: ok
operator_report_index_projection: ok
runtime_boundary: ok
launch_control: ok
value_movement_boundary: ok
controlled_listener: planned
```

The planned bucket must not contribute score until its own local-only implementation and verification gates exist.

## Required boundaries

```text
report_only=true
runtime_present=false
intake_present=false
value_movement_present=false
production_ready=false
public_service_ready=false
```

The scorecard must stay honest. It can show strong evidence without claiming readiness that has not been built and verified.

## Report path

```text
reports/dbyte-service-capability-scorecard.json
```

Full verify writes the scorecard report before the final agent report index is generated. The final index then carries the scorecard fields and `verify-all` asserts them.

## Index fields

```text
scorecard_schema
scorecard_status
scorecard_mode
scorecard_readiness_tier
scorecard_report_only
scorecard_production_ready
scorecard_public_service_ready
scorecard_target
scorecard_score
scorecard_max_score
scorecard_score_percent
scorecard_capability_count
scorecard_ok_capabilities
scorecard_attention_capabilities
scorecard_planned_capabilities
scorecard_blocker_count
scorecard_runtime_present
scorecard_intake_present
scorecard_value_movement_present
scorecard_next_step
```

## Operator rule

The scorecard is a truth report, not a launch switch. If the scorecard says `phase_i_report_ready`, the next safe work is more evidence, dashboard projection, or local-only gated implementation work. It is not a claim that broader service operation is ready.
