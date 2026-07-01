# DBYTE-OCEAN Service Core Sequence

This document defines the controlled path from the current evidence-first dashboard into a real operator-owned service core.

The project already has a verified evidence spine:

```text
pool-core replay
fixture and file ledger reports
session event parser
replay projection
bridge comparison reports
bridge file report
agent report index
dashboard evidence projection
release manifest gate
```

This is the proof layer. The next work is to grow it into a service layer without hiding state from the operator.

## Target service parts

```text
1. Protocol boundary
2. Worker session registry
3. Job source abstraction
4. Share intake service
5. Difficulty policy
6. Accounting projection
7. Settlement plan report
8. Local service dry-run
9. Service readiness planning
10. Controlled-listener preflight evidence
11. Preflight dashboard projection
12. Controlled-listener safety harness
13. Safety harness dashboard projection
14. Controlled-listener launch contract
15. Controlled listener
16. Readiness gate
```

Each part must emit a report before the next part can depend on it.

## Current implementation status

```text
Phase A: implemented, reported, and gated
Phase B: implemented, reported, and gated
Phase C: implemented, reported, and gated
Phase D: implemented, reported, and gated
Phase E: implemented, reported, and gated
Phase F: implemented, reported, and gated
Phase G: implemented, reported, and gated
Phase H: implemented, reported, dashboarded, and gated
Phase I readiness planning: implemented, reported, dashboarded, and gated
Phase I controlled-listener preflight evidence: implemented, reported, indexed, and gated
Phase I preflight dashboard projection: implemented, dashboarded, and tested
Phase I controlled-listener safety harness: implemented, reported, indexed, and gated
Phase I safety harness dashboard projection: implemented, dashboarded, and tested
Phase I controlled-listener launch contract: not implemented
Phase I controlled listener: not implemented
Phase J: not implemented
```

Current safe boundary:

```text
no external worker traffic
no live worker intake
no settlement execution
no payout execution
runtime enablement remains false in readiness reports
preflight endpoint remains localhost-only
preflight evidence is report-only
preflight dashboard evidence is read from the report index
safety harness remains disabled by default
safety harness evidence is report-only
safety harness dashboard evidence is read from the report index
safety harness runtime_started=false
safety harness bind_implemented=false
reports are generated from synthetic fixtures and local artifacts
operator-facing dashboard evidence is read from the report index
```

## Phase A: Protocol boundary

Goal: define the worker protocol surface without adding a network listener.

Tasks:

```text
1. Add message types for connect, authorize, subscribe, job, submit, accepted, rejected, and disconnect.
2. Add synthetic fixtures for one clean worker flow and one rejected worker flow.
3. Add parser tests for valid, unknown, and malformed input.
4. Emit a protocol summary report.
```

Definition of done:

```text
npm run verify passes
no network listener exists
fixtures are synthetic
malformed input is preserved as evidence
```

## Phase B: Session registry

Goal: make worker identity and state transitions explicit.

Tasks:

```text
1. Define session states: pending, authorized, subscribed, active, closed, rejected.
2. Bind each session to a worker name, difficulty, and session id.
3. Record authorization and refusal events in an append-only log.
4. Add replay tests for lifecycle transitions.
```

Definition of done:

```text
unknown sessions cannot submit work
closed sessions cannot submit work
session replay is deterministic
```

## Phase C: Job source abstraction

Goal: separate job templates from share validation.

Tasks:

```text
1. Define an internal job template model.
2. Add a fake job source for deterministic tests.
3. Add job expiration evidence.
4. Keep external node integration out of this phase.
```

Definition of done:

```text
fake jobs produce stable report output
stale jobs are rejected with visible reason
pool-core replay counters still match
```

## Phase D: Share intake service

Goal: turn protocol submits into pool-core ledger events.

Tasks:

```text
1. Convert authorized submit messages into ShareSubmit values.
2. Reject malformed, unknown-session, stale, low-difficulty, and duplicate submissions.
3. Append accepted and rejected outcomes to the share ledger.
4. Emit share-intake report fields that match pool-core replay fields.
```

Definition of done:

```text
accepted and rejected counts match pool-core replay
ledger sequence gaps fail the gate
all rejection reasons are visible
```

## Phase E: Difficulty policy

Goal: keep difficulty decisions explicit.

Tasks:

```text
1. Add static difficulty policy first.
2. Add dry-run variable difficulty recommendations later.
3. Emit reason fields for every recommendation.
4. Keep policy output display-only until dry-run evidence is stable.
```

Definition of done:

```text
policy output is deterministic
policy output is display-only
workers keep explicit assigned difficulty
```

## Phase F: Accounting projection

Goal: separate share acceptance from accounting.

Tasks:

```text
1. Project accepted shares into credited difficulty per worker group.
2. Add round or window boundaries as explicit input.
3. Add report fields for total credited difficulty, worker count, group count, and rejected shares.
4. Compare accounting totals against share ledger totals.
```

Definition of done:

```text
credited difficulty totals match share ledger totals
rows are sorted and stable
no value movement exists in this phase
```

## Phase G: Settlement plan report

Goal: produce an auditable plan without executing it.

Tasks:

```text
1. Add threshold policy.
2. Add fee estimate fields.
3. Add plan rows with account id, amount, reason, and status.
4. Keep execution disabled.
```

Definition of done:

```text
plan output is reproducible
no secret material is stored
no action is executed
operator approval is required for any future execution step
```

## Phase H: Local service dry-run

Goal: run the service loop against synthetic input before any real listener exists.

Tasks:

```text
1. Add a local-only service runner using fixture input.
2. Add startup, shutdown, and error reports.
3. Add rate-limit and malformed-input counters.
4. Add dashboard projection from report files only.
```

Definition of done:

```text
service runner has no public listener by default
all state is replayable
FULL VERIFY GATE PASSED
```

## Phase I: Service readiness planning

Goal: prove the operator-facing configuration, limits, and report evidence before any controlled listener implementation exists.

Tasks:

```text
1. Add readiness config fields with safe defaults.
2. Keep runtime enablement false by default.
3. Emit readiness status, blockers, and next-step fields.
4. Emit preflight endpoint, port, report-only, runtime, local endpoint, and operator-visible fields.
5. Add dashboard projection from report index fields only.
6. Gate readiness and preflight evidence through FULL VERIFY.
```

Definition of done:

```text
readiness report status=ok
runtime_enabled=false
blocker_count=0
preflight endpoint=127.0.0.1
preflight runtime_enabled=false
preflight report_only=true
preflight fields are carried by the report index
preflight fields are asserted by the Phase I gate
readiness dashboard renders from report index
FULL VERIFY GATE PASSED
```

## Phase I-next: Preflight dashboard projection

Goal: show the indexed preflight evidence to the operator before any controlled listener implementation exists.

Tasks:

```text
1. Read preflight status, enabled, endpoint, port, report-only, runtime, local endpoint, and operator-visible fields from the report index.
2. Render those fields in the Agent dashboard readiness panel.
3. Add dashboard tests for ok, missing, and attention preflight states.
4. Keep the dashboard read-only and report-index-only.
```

Definition of done:

```text
preflight dashboard renders from report index only
missing optional preflight evidence does not break healthy agent summary
attention preflight evidence remains visible
no runtime path is introduced
```

## Phase I-later: Controlled-listener safety harness

Goal: define the first controlled-listener safety contract without starting any runtime listener.

Tasks:

```text
1. Add disabled-by-default config fields for a future localhost-only listener.
2. Add report fields that make the requested endpoint, port, enabled flag, and approval state visible.
3. Add tests that prove no runtime path starts from default config.
4. Carry safety harness fields through the report index.
5. Assert safety harness fields in the Phase I gate.
```

Definition of done:

```text
safety_harness_enabled=false by default
safety_harness endpoint=127.0.0.1
safety_harness report_only=true
safety_harness runtime_started=false
safety_harness bind_implemented=false
safety_harness fields are carried by the report index
safety_harness fields are asserted by the Phase I gate
no socket bind is implemented in this phase
```

## Phase I-next: Safety harness dashboard projection

Goal: show the indexed safety harness evidence to the operator before any controlled listener implementation exists.

Tasks:

```text
1. Read safety harness status, enabled, endpoint, port, approval, report-only, runtime-started, bind-implemented, local endpoint, and operator-visible fields from the report index.
2. Render those fields in the Agent dashboard readiness panel.
3. Add dashboard tests for ok, missing, and attention safety harness states.
4. Keep the dashboard read-only and report-index-only.
```

Definition of done:

```text
safety harness dashboard renders from report index only
missing optional safety harness evidence does not break healthy agent summary
attention safety harness evidence remains visible
no runtime path is introduced
```

## Phase I-next: Controlled-listener launch contract

Goal: define the operator-visible launch contract before any listener implementation exists.

Tasks:

```text
1. Add report-only launch contract fields for requested host, port, enablement, approval, and reason.
2. Keep launch_allowed=false until all prior evidence and dashboard projections are present.
3. Add tests that prove no runtime start, socket bind, or external worker intake exists in this phase.
4. Carry launch contract fields through the report index before any listener code is added.
```

Definition of done:

```text
launch_allowed=false by default
launch contract is report-only
runtime_started=false
bind_implemented=false
external_worker_intake=false
operator approval remains required and visible
no listener implementation exists in this phase
```

## Phase I-final: Controlled listener

Goal: add the first operator-controlled listener only after readiness, preflight evidence, dashboard projection, safety harness, safety harness dashboard, and launch contract gates pass.

Tasks:

```text
1. Bind to localhost by default.
2. Require explicit configuration to bind any external interface.
3. Log every connection, authorization, submit, and disconnect.
4. Add rate limits and payload size limits before external traffic is allowed.
```

Definition of done:

```text
localhost mode passes integration tests
external bind is opt-in and visible in config
unknown sessions cannot submit work
operator report shows every live session
```

The controlled listener must not start by accepting external traffic. The first implementation step must be localhost-only, disabled by default, and covered by report evidence before any broader operator mode is allowed.

## Phase J: Readiness gate

Required evidence before the service is called ready:

```text
1. Protocol report status=ok
2. Session registry report status=ok
3. Job source report status=ok
4. Share intake report status=ok
5. Accounting projection status=ok
6. Settlement plan status=ok
7. Service runner status=ok
8. Service readiness status=ok
9. Preflight evidence status=ok
10. Preflight dashboard projection renders from report index
11. Safety harness evidence status=ok
12. Safety harness dashboard projection renders from report index
13. Launch contract evidence status=ok
14. Release manifest approved=true
15. Dashboard renders every report from index
16. FULL VERIFY GATE PASSED
```

## Next implementation PR

The next code PR should be a controlled-listener launch contract only: add report-only launch fields and tests that prove launch_allowed=false, runtime_started=false, bind_implemented=false, and external_worker_intake=false.

Do not accept external worker traffic in the next PR. Do not execute settlement or payout actions in the next PR.
