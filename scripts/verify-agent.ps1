$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Invoke-Checked {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            [scriptblock]$Command
        )

        Write-Host "== $Name =="
        & $Command
        if ($LASTEXITCODE -ne 0) {
            throw "$Name failed with exit code $LASTEXITCODE"
        }
    }

    function Assert-Contains {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            [string[]]$Lines,

            [Parameter(Mandatory = $true)]
            [string]$Expected
        )

        if ($Lines -notcontains $Expected) {
            throw "$Name missing expected line: $Expected"
        }
    }

    $Manifest = "crates\dbyte-agent\Cargo.toml"
    $Config = "configs\agent.example.toml"
    $CleanLedger = "crates\dbyte-agent\fixtures\clean-ledger.events"
    $DecisionCleanLedger = "crates\dbyte-agent\fixtures\decision-clean-ledger.events"
    $BadLedger = "crates\dbyte-agent\fixtures\corrupt-ledger.events"
    $JsonReport = "reports\verify-agent.json"
    $DecisionReport = "reports\dbyte-agent-decision.json"
    $DecisionReportScript = Join-Path $Root "scripts\report-agent-decision.ps1"
    $MachineReport = "reports\dbyte-agent-machine.txt"
    $MachineReportScript = Join-Path $Root "scripts\report-agent-machine.ps1"
    $TelemetryReport = "reports\dbyte-agent-telemetry.txt"
    $TelemetryJsonReport = "reports\dbyte-agent-telemetry.json"
    $TelemetryReportScript = Join-Path $Root "scripts\report-agent-telemetry.ps1"
    $ReleaseManifest = "reports\dbyte-agent-release.json"
    $ReleaseManifestSeal = "reports\dbyte-agent-release.seal.txt"
    $ReleaseScript = Join-Path $Root "scripts\build-agent-release.ps1"
    $LocalEvidenceReport = "reports\dbyte-agent-local-evidence.json"
    $LocalEvidenceReportScript = Join-Path $Root "scripts\report-agent-local-evidence.ps1"
    $SessionEventsFixture = "tests\fixtures\session-events.clean.jsonl"
    $SessionEventsSummaryReport = "reports\dbyte-session-events-summary.json"
    $SessionEventsSummaryScript = Join-Path $Root "scripts\report-session-events.mjs"
    $IndexReport = "reports\dbyte-agent-index.json"
    $IndexReportScript = Join-Path $Root "scripts\report-agent-index.ps1"

    Invoke-Checked "cargo fmt" {
        cargo fmt --manifest-path $Manifest -- --check
    }

    Invoke-Checked "cargo test" {
        cargo test --manifest-path $Manifest -- --test-threads=1
    }

    Invoke-Checked "machine report export" {
        & $MachineReportScript -Config $Config -Out $MachineReport
    }

    if (!(Test-Path $MachineReport)) {
        throw "missing machine report artifact: $MachineReport"
    }

    Invoke-Checked "telemetry report export" {
        & $TelemetryReportScript -Out $TelemetryReport -JsonOut $TelemetryJsonReport -MachineName "deadbyte-local" -Algorithm "test" -Hashrate 0 -HashrateUnit "hps" -AcceptedShares 0 -RejectedShares 0 -UptimeSeconds 0 -Pool "test" -Source "verify-agent"
    }

    if (!(Test-Path $TelemetryReport)) {
        throw "missing telemetry report artifact: $TelemetryReport"
    }

    if (!(Test-Path $TelemetryJsonReport)) {
        throw "missing telemetry json artifact: $TelemetryJsonReport"
    }

    Invoke-Checked "clean ledger check" {
        cargo run --manifest-path $Manifest --bin dbyte-agent -- --config $Config --ledger $CleanLedger check-ledger
    }

    Write-Host "== bad ledger check =="
    cargo run --manifest-path $Manifest --bin dbyte-agent -- --config $Config --ledger $BadLedger check-ledger
    if ($LASTEXITCODE -ne 1) {
        throw "bad ledger check should return exit code 1, got $LASTEXITCODE"
    }

    Invoke-Checked "json report export" {
        cargo run --manifest-path $Manifest --bin dbyte-agent -- --config $Config --ledger $CleanLedger --out $JsonReport report-json
    }

    if (!(Test-Path $JsonReport)) {
        throw "missing report artifact: $JsonReport"
    }

    Invoke-Checked "decision report export" {
        & $DecisionReportScript -Ledger $DecisionCleanLedger -Out $DecisionReport
    }

    if (!(Test-Path $DecisionReport)) {
        throw "missing decision report artifact: $DecisionReport"
    }

    $DecisionJson = Get-Content $DecisionReport -Raw
    if ($DecisionJson -notmatch '"decision_status": "ok"') {
        throw "decision report did not approve decision clean ledger"
    }
    if ($DecisionJson -notmatch '"decision_scope": "read_only"') {
        throw "decision report must stay read-only"
    }

    Write-Host "decision.report=$DecisionReport"
    Write-Host "AGENT DECISION ARTIFACT VERIFIED"

    Invoke-Checked "release build check" {
        & $ReleaseScript
    }

    Write-Host "== seal readback check =="
    if (!(Test-Path $ReleaseManifest)) {
        throw "missing release manifest artifact: $ReleaseManifest"
    }

    if (!(Test-Path $ReleaseManifestSeal)) {
        throw "missing release manifest seal artifact: $ReleaseManifestSeal"
    }

    $ReleaseManifestHash = Get-FileHash -Algorithm SHA256 $ReleaseManifest
    $ReleaseManifestItem = Get-Item $ReleaseManifest
    $ReleaseManifestSha256 = $ReleaseManifestHash.Hash.ToLowerInvariant()
    $SealLines = Get-Content $ReleaseManifestSeal

    Assert-Contains "seal readback" $SealLines "seal.manifest=$ReleaseManifest"
    Assert-Contains "seal readback" $SealLines "seal.manifest_sha256=$ReleaseManifestSha256"
    Assert-Contains "seal readback" $SealLines "seal.manifest_size_bytes=$($ReleaseManifestItem.Length)"

    Write-Host "seal.readback=$ReleaseManifestSeal"
    Write-Host "seal.manifest_sha256=$ReleaseManifestSha256"
    Write-Host "AGENT SEAL READBACK VERIFIED"

    Invoke-Checked "local evidence report export" {
        & $LocalEvidenceReportScript -Out $LocalEvidenceReport -Config $Config -ReleaseManifest $ReleaseManifest
    }

    if (!(Test-Path $LocalEvidenceReport)) {
        throw "missing local evidence artifact: $LocalEvidenceReport"
    }

    $LocalEvidenceJson = Get-Content $LocalEvidenceReport -Raw | ConvertFrom-Json
    if ($LocalEvidenceJson.schema -ne 1) {
        throw "local evidence schema must be 1"
    }
    if ($LocalEvidenceJson.status -ne "ok") {
        throw "local evidence status must be ok"
    }
    if ($LocalEvidenceJson.approval -ne "manifest_verified") {
        throw "local evidence approval must be manifest_verified"
    }
    if ($LocalEvidenceJson.approved_binary_sha256 -ne $ReleaseManifestSha256 -and $LocalEvidenceJson.release_manifest_sha256 -ne $ReleaseManifestSha256) {
        throw "local evidence must record release manifest sha256"
    }

    Write-Host "local.evidence.report=$LocalEvidenceReport"
    Write-Host "AGENT LOCAL EVIDENCE VERIFIED"

    Invoke-Checked "event summary report export" {
        node $SessionEventsSummaryScript --in $SessionEventsFixture --out $SessionEventsSummaryReport
    }

    if (!(Test-Path $SessionEventsSummaryReport)) {
        throw "missing event summary artifact: $SessionEventsSummaryReport"
    }

    $SessionEventsSummaryJson = Get-Content $SessionEventsSummaryReport -Raw | ConvertFrom-Json
    if ($SessionEventsSummaryJson.schema -ne 1) {
        throw "event summary schema must be 1"
    }
    if ($SessionEventsSummaryJson.status -ne "ok") {
        throw "event summary status must be ok"
    }
    if ($SessionEventsSummaryJson.valid_events -ne 5) {
        throw "event summary should contain five valid events"
    }
    if ($SessionEventsSummaryJson.invalid_events -ne 0) {
        throw "event summary should contain zero invalid events"
    }
    if ($SessionEventsSummaryJson.summary.credited_units -ne 10) {
        throw "event summary should credit ten units"
    }

    Write-Host "event.summary.report=$SessionEventsSummaryReport"
    Write-Host "AGENT EVENT SUMMARY VERIFIED"

    Invoke-Checked "report index export" {
        & $IndexReportScript -Out $IndexReport
    }

    if (!(Test-Path $IndexReport)) {
        throw "missing report index artifact: $IndexReport"
    }

    $IndexJson = Get-Content $IndexReport -Raw | ConvertFrom-Json
    if ($IndexJson.index_scope -ne "read_only") {
        throw "report index must stay read-only"
    }
    if ($IndexJson.index_status -ne "ok") {
        throw "report index did not approve generated reports"
    }

    $LocalEvidenceEntry = $IndexJson.reports | Where-Object { $_.name -eq "local_agent_evidence" -and $_.exists -and $_.status -eq "present" }
    if (!$LocalEvidenceEntry) {
        throw "report index missing local_agent_evidence artifact entry"
    }
    if ($LocalEvidenceEntry.required -ne $false) {
        throw "local_agent_evidence index entry must remain optional in this phase"
    }

    $SessionEventsSummaryEntry = $IndexJson.reports | Where-Object { $_.name -eq "session_events_summary" -and $_.exists -and $_.status -eq "present" }
    if (!$SessionEventsSummaryEntry) {
        throw "report index missing session_events_summary artifact entry"
    }
    if ($SessionEventsSummaryEntry.required -ne $false) {
        throw "session_events_summary index entry must remain optional in this phase"
    }

    $PoolCoreEntry = $IndexJson.reports | Where-Object { $_.name -eq "pool_core_ledger" -and $_.exists -and $_.status -eq "present" }
    if (!$PoolCoreEntry) {
        throw "report index missing pool_core_ledger artifact entry"
    }
    if ($PoolCoreEntry.replay_schema -ne 1) {
        throw "pool_core_ledger index entry must include replay_schema 1"
    }
    if ($PoolCoreEntry.replay_status -ne "ok") {
        throw "pool_core_ledger index entry must include replay_status ok"
    }
    if ($PoolCoreEntry.replay_total_events -ne 0) {
        throw "pool_core_ledger default replay should contain zero events"
    }

    $PoolCoreFixtureEntry = $IndexJson.reports | Where-Object { $_.name -eq "pool_core_fixture_ledger" -and $_.exists -and $_.status -eq "present" }
    if (!$PoolCoreFixtureEntry) {
        throw "report index missing pool_core_fixture_ledger artifact entry"
    }
    if ($PoolCoreFixtureEntry.replay_schema -ne 1) {
        throw "pool_core_fixture_ledger index entry must include replay_schema 1"
    }
    if ($PoolCoreFixtureEntry.replay_status -ne "ok") {
        throw "pool_core_fixture_ledger index entry must include replay_status ok"
    }
    if ($PoolCoreFixtureEntry.replay_total_events -ne 2) {
        throw "pool_core_fixture_ledger replay should contain two events"
    }
    if ($PoolCoreFixtureEntry.replay_accepted_events -ne 1) {
        throw "pool_core_fixture_ledger replay should contain one accepted event"
    }
    if ($PoolCoreFixtureEntry.replay_rejected_events -ne 1) {
        throw "pool_core_fixture_ledger replay should contain one rejected event"
    }
    if ($PoolCoreFixtureEntry.replay_credited_difficulty -ne 10) {
        throw "pool_core_fixture_ledger replay should credit difficulty 10"
    }
    if ($PoolCoreFixtureEntry.replay_session_count -ne 2) {
        throw "pool_core_fixture_ledger replay should contain two session rows"
    }

    Write-Host "index.report=$IndexReport"
    Write-Host "AGENT REPORT INDEX VERIFIED"

    Write-Host "== gate passed =="
    Write-Host "AGENT TEST GATE PASSED"
}
finally {
    Pop-Location
}
