# Local Agent Evidence Fields

This document defines local, read-only evidence fields for DBYTE agent reports.

The purpose is reproducibility: an operator should be able to inspect what was approved, what was launched, what exited, and which local files were used as evidence.

## Principles

- Evidence is local and explicit.
- Raw logs remain available.
- Parsed reports are derived from raw evidence.
- Generated files are not the source of truth.
- Unknown binaries are refused by default.
- Private operator values stay outside committed fixtures.

## Required report fields

```text
schema
status
rig_id
agent_version
agent_started_at_unix
approved_binary_path
approved_binary_sha256
approved_config_path
approved_config_sha256
raw_log_dir
session_event_path
last_exit_code
last_exit_reason
```

## Healthy status

A healthy report should contain:

```text
status=ok
approval=manifest_verified
raw_logs=present
session_events=present
```

## Attention status

The operator should investigate when any of these appear:

```text
status=attention
approval=missing_manifest
approval=hash_mismatch
approval=unknown_binary
raw_logs=missing
session_events=missing
```

## Report index integration

The report index should treat these files as evidence entries. It should record path, existence, SHA256, size, and status. The dashboard can display this evidence, but it must not become the source of truth.
