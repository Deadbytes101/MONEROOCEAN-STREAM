# Release Artifact Contract

This document defines the local release evidence files produced by the DBYTE agent gate.

## Scope

The release artifact chain is local, explicit, and file based. It records what was built, which files were checked, and which hashes were observed at build time.

It does not start mining work, install services, deploy to other machines, hide processes, or perform background execution.

## Generated files

The release gate writes these files under `reports/`:

```text
reports/dbyte-agent-release.txt
reports/dbyte-agent-release.json
reports/dbyte-agent-check.txt
reports/dbyte-agent-release.seal.txt
```

## Text release report

`reports/dbyte-agent-release.txt` is the human readable release report.

It records:

```text
agent.binary
agent.sha256
agent.size_bytes
agent.report
agent.manifest
agent.manifest_seal
agent.checker_report
agent.built_at_unix
agent.git_commit
agent.checker_report_sha256
agent.checker_report_size_bytes
```

The text report does not contain its own hash. Its hash is recorded in the JSON manifest to avoid a self-referential artifact.

## JSON release manifest

`reports/dbyte-agent-release.json` is the machine readable release manifest.

It records the binary path, binary SHA256, binary size, text report path, text report SHA256, checker report path, checker report SHA256, build timestamp, git commit, and seal file path.

The Rust checker reads this JSON file and verifies the binary fields. When artifact hash and size fields are present, the checker also verifies those artifact files.

## Checker report

`reports/dbyte-agent-check.txt` stores the stable output from the Rust checker.

The release script requires the checker output contract to contain:

```text
check.valid=true
runtime.approved=true
runtime.reason=manifest_verified
```

The checker report hash and size are recorded in the text report and JSON manifest.

## Manifest seal

`reports/dbyte-agent-release.seal.txt` records the SHA256 and size of the JSON manifest.

It exists outside the JSON manifest so the JSON file does not need to contain its own hash.

The seal file records:

```text
seal.manifest
seal.manifest_sha256
seal.manifest_size_bytes
seal.git_commit
seal.built_at_unix
```

The verify gate reads the seal file back from disk and checks it against the current JSON manifest.

## Verification order

The gate follows this order:

```text
build release binary
write text report and JSON manifest
run Rust checker
write checker report
hash checker report
hash text report
rewrite JSON manifest with artifact fields
run final Rust checker
write manifest seal
read seal file back from disk
pass the gate
```

## Invariants

A valid local release must satisfy these invariants:

```text
binary hash matches manifest
binary size matches manifest
text report hash matches manifest
text report size matches manifest
checker report hash matches manifest
checker report size matches manifest
seal hash matches JSON manifest
seal size matches JSON manifest
final checker output equals initial checker output
```

If any invariant fails, the gate must fail.
