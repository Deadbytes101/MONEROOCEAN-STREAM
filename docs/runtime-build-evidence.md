# Runtime Build Evidence

This document defines the evidence contract for building and launching an external runtime worker under DBYTE agent supervision.

The first target worker is XMRig or a compatible MoneroOcean-oriented fork, but the contract is intentionally worker-neutral. The agent must treat the worker as an external process. It must not treat any downloaded binary, copied executable, or hand-edited runtime configuration as trusted by default.

## Scope

This document covers owned-machine, explicit-operator usage only.

The runtime evidence layer does:

- record source repository identity;
- record source commit or release tag;
- record build host and toolchain details;
- record build command intent;
- record produced binary path, size, and SHA256;
- record generated configuration path and SHA256;
- require explicit launch through the verified launcher;
- preserve stdout and stderr as raw evidence;
- parse only the minimum telemetry needed by the local ledger.

The runtime evidence layer does not:

- hide a process;
- install persistence;
- run without an explicit operator action;
- bypass another machine owner's policy;
- disguise CPU usage, network usage, process names, windows, services, or logs;
- modify worker source code to bypass an upstream maintainer's license, fee, donation, or attribution policy.

Simple rule: if the operator cannot explain what binary is running, where it came from, and why it was launched, the agent must refuse to supervise it.

## Evidence files

A valid runtime build should produce a local evidence directory similar to:

```text
reports/runtime/
  runtime-build.txt
  runtime-build.json
  runtime-config.json
  runtime-launch.txt
  runtime-session.jsonl
```

These files are local evidence. They are not secrets. They should not contain private wallet keys, access tokens, SSH keys, service credentials, or API keys.

## Build manifest

`reports/runtime/runtime-build.json` should use stable fields:

```json
{
  "schema": 1,
  "status": "ok",
  "worker_name": "xmrig",
  "source_repo": "<repo-url-or-local-path>",
  "source_ref": "<tag-branch-or-commit>",
  "source_commit": "<full-commit-sha-if-known>",
  "build_host": "<machine-name>",
  "build_os": "<os-name-and-version>",
  "toolchain": "<compiler-and-build-tool-version>",
  "build_command": "<human-readable-command-record>",
  "binary_path": "<relative-or-absolute-path>",
  "binary_sha256": "<sha256>",
  "binary_size_bytes": 0,
  "built_at_unix": 0
}
```

The manifest is evidence, not trust by itself. The verified launcher must check the binary path, hash, and approved worker identity before launch.

## Configuration manifest

The DBYTE config model is the source of truth. Worker-native config files are generated artifacts.

`reports/runtime/runtime-config.json` should record:

```json
{
  "schema": 1,
  "status": "ok",
  "rig_id": "a960d-lab",
  "worker_name": "xmrig",
  "config_source": "config/rigs/a960d-lab.json",
  "generated_config": "reports/runtime/generated-worker-config.json",
  "generated_config_sha256": "<sha256>",
  "pool_profile": "moneroocean-reference",
  "thread_policy": "safe",
  "generated_at_unix": 0
}
```

The generated worker config may contain wallet or pool information. Do not commit generated runtime configs unless they are sanitized fixtures.

## Launch record

Every launch must emit a small launch record:

```text
launch.schema=1
launch.status=approved
launch.reason=manifest_verified
rig.id=a960d-lab
worker.name=xmrig
worker.binary=<path>
worker.binary_sha256=<sha256>
worker.config=<path>
worker.config_sha256=<sha256>
launch.ts_unix=<timestamp>
```

Unknown binary, missing manifest, hash mismatch, unsupported rig id, or unapproved worker name must produce `launch.status=refused`.

## Session event stream

The first session stream can be JSONL:

```json
{"schema":1,"event":"runtime_started","rig_id":"a960d-lab","worker":"xmrig","ts_unix":0}
{"schema":1,"event":"hashrate_observed","rig_id":"a960d-lab","algo":"rx/0","hps":0.0,"ts_unix":0}
{"schema":1,"event":"share_accepted","rig_id":"a960d-lab","latency_ms":0,"ts_unix":0}
{"schema":1,"event":"share_rejected","rig_id":"a960d-lab","reason":"unknown","ts_unix":0}
{"schema":1,"event":"runtime_exited","rig_id":"a960d-lab","exit_code":0,"ts_unix":0}
```

Raw logs must be preserved separately so the parser can be audited when a parsed event looks wrong.

## Definition of done

The first runtime build evidence milestone is complete when:

- the operator can identify source repo, source commit, build host, toolchain, and binary SHA256;
- the launcher refuses a tampered binary;
- the launcher refuses a missing or stale generated config;
- one owned rig can produce a session JSONL file;
- accepted and rejected share events can be counted without reading the dashboard;
- the report index can discover the runtime evidence files without treating them as trusted state.
