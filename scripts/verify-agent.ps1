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
    $BadLedger = "crates\dbyte-agent\fixtures\corrupt-ledger.events"
    $JsonReport = "reports\verify-agent.json"
    $DecisionReport = "reports\dbyte-agent-decision.json"
    $MachineReport = "reports\dbyte-agent-machine.txt"
    $MachineReportScript = Join-Path $Root "scripts\report-agent-machine.ps1"
    $TelemetryReport = "reports\dbyte-agent-telemetry.txt"
    $TelemetryJsonReport = "reports\dbyte-agent-telemetry.json"
    $TelemetryReportScript = Join-Path $Root "scripts\report-agent-telemetry.ps1"
    $ReleaseManifest = "reports\dbyte-agent-release.json"
    $ReleaseManifestSeal = "reports\dbyte-agent-release.seal.txt"
    $ReleaseScript = Join-Path $Root "scripts\build-agent-release.ps1"

    Invoke-Checked "cargo fmt" {
        cargo fmt --manifest-path $Manifest -- --check
    }

    Invoke-Checked "cargo test" {
        cargo test --manifest-path $Manifest
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
        cargo run --manifest-path $Manifest --bin dbyte-agent-decision -- --ledger $CleanLedger --out $DecisionReport
    }

    if (!(Test-Path $DecisionReport)) {
        throw "missing decision report artifact: $DecisionReport"
    }

    $DecisionJson = Get-Content $DecisionReport -Raw
    if ($DecisionJson -notmatch '"decision_status": "ok"') {
        throw "decision report did not approve clean ledger"
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

    Write-Host "== gate passed =="
    Write-Host "AGENT TEST GATE PASSED"
}
finally {
    Pop-Location
}
