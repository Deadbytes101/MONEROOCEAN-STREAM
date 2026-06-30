# DBYTE-OCEAN Implementation Sequence

This file turns the advanced architecture into small mergeable steps.

The rule is simple: every step must either add a replayable fact, strengthen a gate, or make an existing report more reproducible. No step should depend on hidden runtime behavior or dashboard-only truth.

## Phase 1: Evidence index expansion

Goal: make the report index discover the new local agent evidence surface.

Tasks:

```text
1. Add local_agent_evidence entry to the report index.
2. Record path, existence, SHA256, size, and status.
3. Add fixture coverage for present and missing evidence.
4. Keep index_scope=read_only.
5. Keep missing_required_count behavior explicit.
```

Definition of done:

```text
npm run verify passes
agent dashboard artifacts tests remain green
report index shows local agent evidence without making dashboard state authoritative
```

## Phase 2: Runtime session schema

Goal: define the first typed session event stream before implementing parser logic.

Tasks:

```text
1. Add sanitized JSONL fixture for runtime session events.
2. Add schema docs for event names and required fields.
3. Add parser tests for accepted, rejected, started, exited, and refusal events.
4. Preserve unknown lines as raw evidence.
```

Definition of done:

```text
fixtures contain no private operator values
parser rejects malformed JSONL clearly
parser never deletes raw evidence
```

## Phase 3: Runtime evidence report

Goal: emit a stable local report for runtime approval state.

Tasks:

```text
1. Add runtime evidence report command or fixture generator.
2. Emit status, approval reason, binary hash, config hash, and session path.
3. Add stable text report output.
4. Add stable JSON report output.
5. Add checker coverage for hash mismatch and missing manifest.
```

Definition of done:

```text
approved runtime produces status=ok
missing manifest produces status=attention
hash mismatch produces status=attention
release gate remains explicit
```

## Phase 4: Share replay bridge

Goal: bridge runtime session events into pool-core replay without trusting dashboard state.

Tasks:

```text
1. Convert accepted and rejected runtime events into pool-core ledger fixture events.
2. Run replay over generated fixture events.
3. Emit total_events, accepted_events, rejected_events, credited_difficulty, and session_count.
4. Add tests for zero-event and non-zero-event sessions.
```

Definition of done:

```text
pool-core tests pass
fixture replay report remains stable
summary counters match ledger replay counters
```

## Phase 5: Backend observation report

Goal: separate backend health from share success.

Tasks:

```text
1. Define backend observation fixture format.
2. Record profile name, observation time, latency bucket, and status class.
3. Add report command for observation summary.
4. Keep private endpoint values out of committed fixtures.
```

Definition of done:

```text
healthy backend, degraded backend, and missing observation fixtures are covered
report can be rendered by dashboard without private values
```

## Phase 6: Policy dry-run

Goal: produce explicit decisions without automatic switching.

Tasks:

```text
1. Add read-only policy dry-run report.
2. Consume share summary and backend observation summary.
3. Emit decision_status, decision_reason, decision_next, and selected_profile.
4. Add anti-thrash fields before any live switching exists.
```

Definition of done:

```text
clean evidence produces observe or hold
bad evidence produces attention or blocked
every decision has a reason
no live route mutation occurs
```

## Phase 7: Dashboard projection

Goal: render reports without becoming the source of truth.

Tasks:

```text
1. Add dashboard panel for runtime evidence.
2. Add dashboard panel for backend observation.
3. Add dashboard panel for policy dry-run.
4. Mark stale, missing, and blocked states visibly.
5. Keep all values derived from report files.
```

Definition of done:

```text
browser tests cover ok, stale, missing, and blocked states
responsive checks remain green
FULL VERIFY GATE PASSED
```

## Next immediate PR

The next implementation PR should be Phase 1 only: add `local_agent_evidence` to the report index and dashboard health rollup tests.

Do not implement live backend switching yet.
