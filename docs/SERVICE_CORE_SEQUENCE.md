# DBYTE-OCEAN Service Core Sequence

This document is the controlled path from the current evidence-first dashboard into an operator-owned service core. The goal is to make the project capable of running a real pool-like backend only after the protocol, ledger, accounting, and operator gates are explicit.

The rule stays strict: no hidden worker enrollment, no stealth mining, no unauthorized endpoints, no automatic fund movement, and no live mutation before the evidence gate says the service is safe to operate.

## Current base

The project already has a verified spine:

```text
pool-core replay
fixture/file ledger reports
session event parser
replay projection
bridge compare reports
bridge file report
agent report index
dashboard evidence projection
release manifest gate
```

This is not yet a production pool. It is the proof layer that a production service must obey.

## Target shape

A service-core system needs these owned parts:

```text
1. Front door protocol service
2. Worker session registry
3. Job source and job template cache
4. Share intake validator
5. Difficulty policy
6. Append-only share ledger
7. Accounting projection
8. Payout planner
9. Operator observation reports
10. Dashboard projection
```

Every part must emit replayable evidence before it can control real state.

## Phase A: Protocol boundary

Goal: define the public worker protocol surface without opening a live listener.

Tasks:

```text
1. Add a protocol message model for connect, authorize, subscribe, job, submit, accepted, rejected, and disconnect.
2. Add sanitized fixtures for one clean worker and one rejected worker.
3. Add parser tests that preserve unknown or malformed input as evidence.
4. Keep all fixtures local and synthetic.
5. Emit a protocol summary report.
```

Definition of done:

```text
npm run verify passes
no network listener exists
no private endpoint or wallet is committed
malformed worker input is rejected without crashing
```

## Phase B: Session registry

Goal: make worker identity explicit before accepting shares.

Tasks:

```text
1. Define worker session state: pending, authorized, subscribed, active, closed, rejected.
2. Bind every session to a wallet, worker name, difficulty, and session id.
3. Record authorization and refusal events in an append-only log.
4. Add replay tests for session lifecycle transitions.
```

Definition of done:

```text
unknown workers cannot submit shares
closed sessions cannot submit shares
session replay is deterministic
```

## Phase C: Job source abstraction

Goal: separate job templates from share validation.

Tasks:

```text
1. Define an internal job template model.
2. Add a fake job source for deterministic tests.
3. Add job expiration and stale-job evidence.
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
2. Reject malformed, unauthorized, stale, low-difficulty, and duplicate submissions.
3. Append accepted and rejected outcomes to the share ledger.
4. Emit share-intake report fields matching pool-core replay fields.
```

Definition of done:

```text
accepted/rejected counts match pool-core replay
ledger sequence gaps fail the gate
all rejection reasons are visible
```

## Phase E: Difficulty policy

Goal: control worker difficulty without hidden behavior.

Tasks:

```text
1. Add static difficulty policy first.
2. Add dry-run variable difficulty recommendations later.
3. Emit reason fields for every recommendation.
4. Never auto-retarget before dry-run evidence is stable.
```

Definition of done:

```text
policy output is deterministic
policy output is display-only
workers keep explicit assigned difficulty
```

## Phase F: Accounting projection

Goal: separate share acceptance from reward accounting.

Tasks:

```text
1. Project accepted shares into credited difficulty per wallet and worker.
2. Add round or window boundaries as explicit input.
3. Add report fields for total credited difficulty, wallet count, worker count, and rejected shares.
4. Compare accounting totals against share ledger totals.
```

Definition of done:

```text
credited difficulty totals match share ledger totals
wallet and worker rows are sorted and stable
no payout movement exists yet
```

## Phase G: Payout planner

Goal: produce an auditable payout plan without sending funds.

Tasks:

```text
1. Add payout threshold policy.
2. Add fee estimate fields.
3. Add payout plan report with wallet, amount, reason, and status.
4. Keep payout execution disabled.
```

Definition of done:

```text
payout plan is reproducible
no private key or seed material is stored
no transaction is broadcast
operator must approve any future execution step
```

## Phase H: Live service dry-run

Goal: run the service loop against synthetic input before accepting real workers.

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

## Phase I: Controlled listener

Goal: add the first operator-controlled listener only after all dry-run gates pass.

Tasks:

```text
1. Bind to localhost by default.
2. Require explicit configuration to bind any external interface.
3. Log every connection, authorization, share submit, and disconnect.
4. Add rate limits and payload size limits before accepting external traffic.
```

Definition of done:

```text
localhost mode passes integration tests
external bind is opt-in and visible in config
no unauthorized worker can submit shares
operator report shows every live session
```

## Phase J: Production readiness gate

Goal: define the final line before calling the system production-ready.

Required evidence:

```text
1. Protocol report status=ok
2. Session registry report status=ok
3. Job source report status=ok
4. Share intake report status=ok
5. Accounting projection status=ok
6. Payout planner status=ok
7. Service runner status=ok
8. Release manifest approved=true
9. Dashboard renders all reports from index
10. FULL VERIFY GATE PASSED
```

Non-negotiable boundary:

```text
No stealth mining.
No unauthorized endpoints.
No hidden worker enrollment.
No automatic payout execution without a separate operator-approved phase.
No dashboard-only truth.
```

## Next implementation PR

The next code PR should be Phase A only: add the protocol message model, synthetic fixtures, parser tests, and a protocol summary report. Do not add a network listener in that PR.
