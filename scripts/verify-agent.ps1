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

    function Assert-BridgeCompareReport {
        param(
            [Parameter(Mandatory = $true)]
            [object]$Report,

            [Parameter(Mandatory = $true)]
            [string]$Label
        )

        if ($Report.schema -ne 1) {
            throw "$Label schema must be 1"
        }
        if ($Report.status -ne "ok") {
            throw "$Label status must be ok"
        }
        if ($Report.matches.total_events -ne $true) {
            throw "$Label total_events must match"
        }
        if ($Report.matches.accepted_events -ne $true) {
            throw "$Label accepted_events must match"
        }
        if ($Report.matches.rejected_events -ne $true) {
            throw "$Label rejected_events must match"
        }
        if ($Report.matches.credited_difficulty -ne $true) {
            throw "$Label credited_difficulty must match"
        }
    }

    function Assert-BridgeCompareIndexEntry {
        param(
            [Parameter(Mandatory = $true)]
            [object]$Entry,

            [Parameter(Mandatory = $true)]
            [string]$Name
        )

        if (!$Entry) {
            throw "report index missing $Name artifact entry"
        }
        if ($Entry.required -ne $false) {
            throw "$Name index entry must remain optional in this phase"
        }
        if ($Entry.compare_schema -ne 1) {
            throw "$Name index entry must include compare_schema 1"
        }
        if ($Entry.compare_status -ne "ok") {
            throw "$Name index entry must include compare_status ok"
        }
        if ($Entry.compare_total_events -ne $true) {
            throw "$Name index entry must include total_events match"
        }
        if ($Entry.compare_accepted_events -ne $true) {
            throw "$Name index entry must include accepted_events match"
        }
        if ($Entry.compare_rejected_events -ne $true) {
            throw "$Name index entry must include rejected_events match"
        }
        if ($Entry.compare_credited_difficulty -ne $true) {
            throw "$Name index entry must include credited_difficulty match"
        }
    }

    function Assert-BridgeFileIndexEntry {
        param(
            [Parameter(Mandatory = $true)]
            [object]$Entry
        )

        if (!$Entry) {
            throw "report index missing bridge_file artifact entry"
        }
        if ($Entry.required -ne $false) {
            throw "bridge_file index entry must remain optional in this phase"
        }
        if ($Entry.bridge_schema -ne 1) {
            throw "bridge_file index entry must include bridge_schema 1"
        }
        if ($Entry.bridge_status -ne "ok") {
            throw "bridge_file index entry must include bridge_status ok"
        }
        if ($Entry.bridge_valid -ne $true) {
            throw "bridge_file index entry must include bridge_valid true"
        }
        if ($Entry.bridge_total_events -ne 2) {
            throw "bridge_file index entry should contain two events"
        }
        if ($Entry.bridge_accepted_events -ne 1) {
            throw "bridge_file index entry should contain one accepted event"
        }
        if ($Entry.bridge_rejected_events -ne 1) {
            throw "bridge_file index entry should contain one rejected event"
        }
        if ($Entry.bridge_credited_difficulty -ne 10) {
            throw "bridge_file index entry should credit difficulty 10"
        }
        if ($Entry.bridge_session_count -ne 2) {
            throw "bridge_file index entry should contain two sessions"
        }
        if ($Entry.bridge_job_count -ne 1) {
            throw "bridge_file index entry should contain one job"
        }
        if ($Entry.bridge_assignment_count -ne 2) {
            throw "bridge_file index entry should contain two assignments"
        }
    }

    function Assert-PoolCoreReplayEntry {
        param(
            [Parameter(Mandatory = $true)]
            [object]$Entry,

            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            [int]$TotalEvents,

            [Parameter(Mandatory = $true)]
            [int]$AcceptedEvents,

            [Parameter(Mandatory = $true)]
            [int]$RejectedEvents,

            [Parameter(Mandatory = $true)]
            [int]$CreditedDifficulty,

            [Parameter(Mandatory = $true)]
            [int]$SessionCount
        )

        if (!$Entry) {
            throw "report index missing $Name artifact entry"
        }
        if ($Entry.replay_schema -ne 1) {
            throw "$Name index entry must include replay_schema 1"
        }
        if ($Entry.replay_status -ne "ok") {
            throw "$Name index entry must include replay_status ok"
        }
        if ($Entry.replay_total_events -ne $TotalEvents) {
            throw "$Name replay should contain $TotalEvents events"
        }
        if ($Entry.replay_accepted_events -ne $AcceptedEvents) {
            throw "$Name replay should contain $AcceptedEvents accepted events"
        }
        if ($Entry.replay_rejected_events -ne $RejectedEvents) {
            throw "$Name replay should contain $RejectedEvents rejected events"
        }
        if ($Entry.replay_credited_difficulty -ne $CreditedDifficulty) {
            throw "$Name replay should credit difficulty $CreditedDifficulty"
        }
        if ($Entry.replay_session_count -ne $SessionCount) {
            throw "$Name replay should contain $SessionCount session rows"
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
    $ProjectionReport = "reports\dbyte-replay-projection.json"
    $ProjectionReportScript = Join-Path $Root "scripts\report-replay-projection.mjs"
    $PoolLedgerFixtureReport = "reports\dbyte-pool-ledger-fixture-report.json"
    $PoolLedgerFileReport = "reports\dbyte-pool-ledger-file-report.json"
    $BridgeCompareReport = "reports\dbyte-bridge-compare.json"
    $BridgeFileCompareReport = "reports\dbyte-bridge-file-compare.json"
    $BridgeCompareScript = Join-Path $Root "scripts\report-bridge-compare.mjs"
    $BridgeFileFixture = "tests\fixtures\pool-core-bridge.ledger"
    $BridgeFileReport = "reports\dbyte-bridge-file.json"
    $BridgeFileScript = Join-Path $Root "scripts\report-bridge-file.mjs"
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

    Invoke-Checked "projection report export" {
        node $ProjectionReportScript --in $SessionEventsSummaryReport --out $ProjectionReport
    }

    if (!(Test-Path $ProjectionReport)) {
        throw "missing projection artifact: $ProjectionReport"
    }

    $ProjectionJson = Get-Content $ProjectionReport -Raw | ConvertFrom-Json
    if ($ProjectionJson.schema -ne 1) {
        throw "projection schema must be 1"
    }
    if ($ProjectionJson.status -ne "ok") {
        throw "projection status must be ok"
    }
    if ($ProjectionJson.total_events -ne 2) {
        throw "projection should contain two events"
    }
    if ($ProjectionJson.accepted_events -ne 1) {
        throw "projection should contain one accepted event"
    }
    if ($ProjectionJson.rejected_events -ne 1) {
        throw "projection should contain one rejected event"
    }
    if ($ProjectionJson.credited_difficulty -ne 10) {
        throw "projection should credit difficulty 10"
    }

    Write-Host "projection.report=$ProjectionReport"
    Write-Host "AGENT PROJECTION VERIFIED"

    if (!(Test-Path $PoolLedgerFixtureReport)) {
        throw "missing pool core fixture artifact: $PoolLedgerFixtureReport"
    }

    Invoke-Checked "bridge compare report export" {
        node $BridgeCompareScript --projection $ProjectionReport --pool $PoolLedgerFixtureReport --out $BridgeCompareReport
    }

    if (!(Test-Path $BridgeCompareReport)) {
        throw "missing bridge compare artifact: $BridgeCompareReport"
    }

    $BridgeCompareJson = Get-Content $BridgeCompareReport -Raw | ConvertFrom-Json
    Assert-BridgeCompareReport $BridgeCompareJson "bridge compare"

    Write-Host "bridge.compare.report=$BridgeCompareReport"
    Write-Host "AGENT BRIDGE COMPARE VERIFIED"

    if (!(Test-Path $PoolLedgerFileReport)) {
        throw "missing pool core file artifact: $PoolLedgerFileReport"
    }

    Invoke-Checked "file compare report export" {
        node $BridgeCompareScript --projection $ProjectionReport --pool $PoolLedgerFileReport --out $BridgeFileCompareReport
    }

    if (!(Test-Path $BridgeFileCompareReport)) {
        throw "missing file compare artifact: $BridgeFileCompareReport"
    }

    $BridgeFileCompareJson = Get-Content $BridgeFileCompareReport -Raw | ConvertFrom-Json
    Assert-BridgeCompareReport $BridgeFileCompareJson "file compare"

    Write-Host "bridge.file.compare.report=$BridgeFileCompareReport"
    Write-Host "AGENT FILE COMPARE VERIFIED"

    Invoke-Checked "bridge file report export" {
        node $BridgeFileScript --in $BridgeFileFixture --out $BridgeFileReport
    }

    if (!(Test-Path $BridgeFileReport)) {
        throw "missing bridge file artifact: $BridgeFileReport"
    }

    $BridgeFileJson = Get-Content $BridgeFileReport -Raw | ConvertFrom-Json
    if ($BridgeFileJson.schema -ne 1) {
        throw "bridge file schema must be 1"
    }
    if ($BridgeFileJson.status -ne "ok") {
        throw "bridge file status must be ok"
    }
    if ($BridgeFileJson.valid -ne $true) {
        throw "bridge file report must be valid"
    }
    if ($BridgeFileJson.summary.total_events -ne 2) {
        throw "bridge file should contain two events"
    }
    if ($BridgeFileJson.summary.accepted_events -ne 1) {
        throw "bridge file should contain one accepted event"
    }
    if ($BridgeFileJson.summary.rejected_events -ne 1) {
        throw "bridge file should contain one rejected event"
    }
    if ($BridgeFileJson.summary.credited_difficulty -ne 10) {
        throw "bridge file should credit difficulty 10"
    }
    if ($BridgeFileJson.summary.session_count -ne 2) {
        throw "bridge file should contain two sessions"
    }
    if ($BridgeFileJson.summary.job_count -ne 1) {
        throw "bridge file should contain one job"
    }
    if ($BridgeFileJson.summary.assignment_count -ne 2) {
        throw "bridge file should contain two assignments"
    }

    Write-Host "bridge.file.report=$BridgeFileReport"
    Write-Host "AGENT BRIDGE FILE VERIFIED"

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

    $ProjectionEntry = $IndexJson.reports | Where-Object { $_.name -eq "replay_projection" -and $_.exists -and $_.status -eq "present" }
    if (!$ProjectionEntry) {
        throw "report index missing replay_projection artifact entry"
    }
    if ($ProjectionEntry.required -ne $false) {
        throw "replay_projection index entry must remain optional in this phase"
    }

    $BridgeCompareEntry = $IndexJson.reports | Where-Object { $_.name -eq "bridge_compare" -and $_.exists -and $_.status -eq "present" }
    Assert-BridgeCompareIndexEntry $BridgeCompareEntry "bridge_compare"

    $BridgeFileCompareEntry = $IndexJson.reports | Where-Object { $_.name -eq "bridge_file_compare" -and $_.exists -and $_.status -eq "present" }
    Assert-BridgeCompareIndexEntry $BridgeFileCompareEntry "bridge_file_compare"

    $BridgeFileEntry = $IndexJson.reports | Where-Object { $_.name -eq "bridge_file" -and $_.exists -and $_.status -eq "present" }
    Assert-BridgeFileIndexEntry $BridgeFileEntry

    $PoolCoreEntry = $IndexJson.reports | Where-Object { $_.name -eq "pool_core_ledger" -and $_.exists -and $_.status -eq "present" }
    Assert-PoolCoreReplayEntry $PoolCoreEntry "pool_core_ledger" 0 0 0 0 0

    $PoolCoreFixtureEntry = $IndexJson.reports | Where-Object { $_.name -eq "pool_core_fixture_ledger" -and $_.exists -and $_.status -eq "present" }
    Assert-PoolCoreReplayEntry $PoolCoreFixtureEntry "pool_core_fixture_ledger" 2 1 1 10 2

    $PoolCoreFileEntry = $IndexJson.reports | Where-Object { $_.name -eq "pool_core_file_ledger" -and $_.exists -and $_.status -eq "present" }
    Assert-PoolCoreReplayEntry $PoolCoreFileEntry "pool_core_file_ledger" 2 1 1 10 2

    Write-Host "index.report=$IndexReport"
    Write-Host "AGENT REPORT INDEX VERIFIED"

    Write-Host "== gate passed =="
    Write-Host "AGENT TEST GATE PASSED"
}
finally {
    Pop-Location
}
