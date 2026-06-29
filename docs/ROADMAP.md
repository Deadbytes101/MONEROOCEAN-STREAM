# DBYTE-OCEAN Roadmap

## v0.1 - Machine Agent

Goal: own the machine state before building higher layers.

- Detect machine name and platform.
- Detect CPU model and thread count.
- Load canonical configuration.
- Verify binary hash before launch.
- Start and supervise runtime process.
- Capture stdout and stderr.
- Record exit status and restart reason.

Definition of done:

- One owned machine runs under agent supervision.
- Unknown binaries are refused.
- Every restart has a recorded reason.
- Local event logs can be replayed.

## v0.2 - Config Compiler

Goal: no manual config chaos.

- Define canonical config format.
- Generate runtime config files.
- Validate required fields.
- Emit launch manifest.
- Keep generated files reproducible.

## v0.3 - Event Ledger

Goal: local truth before dashboard truth.

- Define event record schema.
- Store runtime events.
- Store backend observations.
- Track route changes.
- Add report command.

## v0.4 - Backend Adapter Layer

Goal: replaceable backends.

- Define adapter trait/interface.
- Add backend A adapter.
- Add backend B adapter.
- Normalize status reports.
- Keep policy independent from backend implementation.

## v0.5 - Routing Policy

Goal: explicit decisions.

- Define route score model.
- Use measured machine results.
- Penalize instability.
- Avoid fast route thrashing.
- Emit reason for every route switch.

## v0.6 - Local Core Lab

Goal: test the core protocol path locally before production.

- Simulate backend jobs.
- Simulate worker submissions.
- Validate event ledger correctness.
- Run integration tests without external dependency.

## v0.7 - Service Core

Goal: first real internal service stack.

- API server.
- Metrics engine.
- Report generator.
- Admin console.
- Persistent event store.

## v0.8 - Operator Dashboard

Goal: show truth, not hype.

- Machine overview.
- Runtime status.
- Backend comparison.
- Route decisions.
- Reproducible reports.
