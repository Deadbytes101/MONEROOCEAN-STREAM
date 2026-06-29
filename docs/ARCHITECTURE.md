# DBYTE-OCEAN Architecture

This document defines the first architecture layer: machine truth, verified launch, routing policy, and reproducible reporting.

```mermaid
flowchart TD
    A[Owned Machine] --> B[Machine Identity]
    B --> C[DBYTE Agent]

    C --> D[Verified Launcher]
    D --> D1[Binary Hash Manifest]
    D --> D2[Generated Config]
    D --> D3[Process Watchdog]

    D --> E[Runtime Process]
    E --> F[Log Parser]
    F --> G[Local Event Ledger]

    G --> H[Metrics Engine]
    H --> I[Routing Policy]
    I --> J[Backend Adapter]

    J --> K[Backend A]
    J --> L[Backend B]
    J --> M[Future Local Core]

    G --> N[Report Generator]
    N --> O[Truth Report]
```

## Layer 1: Machine Identity

The machine identity layer records stable facts about the machine: name, CPU model, thread count, memory profile, platform, and operator notes.

## Layer 2: Verified Launcher

The launcher refuses to start an unknown binary. It records the binary path, expected hash, generated configuration path, launch time, exit code, and restart reason.

## Layer 3: Log Parser

The parser converts process output into structured local events. Raw logs remain available. Parsed events are append-only where practical.

## Layer 4: Routing Policy

Routing decisions must be explicit. The policy engine may choose between backends, but every switch must produce a reason in the local ledger.

## Layer 5: Report Generator

Reports must be reproducible from stored local events. The dashboard is only a view over the recorded truth, not the source of truth.
