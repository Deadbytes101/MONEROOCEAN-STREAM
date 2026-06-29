param(
    [string]$Out = "reports\dbyte-agent-telemetry.txt",
    [string]$JsonOut = "reports\dbyte-agent-telemetry.json",
    [string]$MachineName = "deadbyte-local",
    [string]$Algorithm = "unknown",
    [double]$Hashrate = 0,
    [string]$HashrateUnit = "hps",
    [int]$AcceptedShares = 0,
    [int]$RejectedShares = 0,
    [int]$UptimeSeconds = 0,
    [string]$Pool = "manual",
    [string]$Source = "manual"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Assert-NonNegativeNumber {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            [double]$Value
        )

        if ($Value -lt 0) {
            throw "$Name must be non-negative"
        }
    }

    function Assert-NonNegativeInteger {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            [int]$Value
        )

        if ($Value -lt 0) {
            throw "$Name must be non-negative"
        }
    }

    if ([string]::IsNullOrWhiteSpace($MachineName)) {
        throw "MachineName must not be empty"
    }

    if ([string]::IsNullOrWhiteSpace($Algorithm)) {
        throw "Algorithm must not be empty"
    }

    if ([string]::IsNullOrWhiteSpace($HashrateUnit)) {
        throw "HashrateUnit must not be empty"
    }

    Assert-NonNegativeNumber "Hashrate" $Hashrate
    Assert-NonNegativeInteger "AcceptedShares" $AcceptedShares
    Assert-NonNegativeInteger "RejectedShares" $RejectedShares
    Assert-NonNegativeInteger "UptimeSeconds" $UptimeSeconds

    $OutputDir = Split-Path -Parent $Out
    if ($OutputDir) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    $JsonOutputDir = Split-Path -Parent $JsonOut
    if ($JsonOutputDir) {
        New-Item -ItemType Directory -Force -Path $JsonOutputDir | Out-Null
    }

    $Timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $TotalShares = $AcceptedShares + $RejectedShares
    $RejectRate = 0
    if ($TotalShares -gt 0) {
        $RejectRate = $RejectedShares / $TotalShares
    }

    $Lines = @(
        "telemetry.schema=1",
        "telemetry.source=$Source",
        "telemetry.ts_unix=$Timestamp",
        "machine.name=$MachineName",
        "miner.algorithm=$Algorithm",
        "miner.hashrate=$Hashrate",
        "miner.hashrate_unit=$HashrateUnit",
        "miner.accepted_shares=$AcceptedShares",
        "miner.rejected_shares=$RejectedShares",
        "miner.reject_rate=$RejectRate",
        "miner.uptime_seconds=$UptimeSeconds",
        "pool.name=$Pool"
    )

    $Json = [ordered]@{
        telemetry_schema = 1
        telemetry_source = $Source
        telemetry_ts_unix = $Timestamp
        machine_name = $MachineName
        miner_algorithm = $Algorithm
        miner_hashrate = $Hashrate
        miner_hashrate_unit = $HashrateUnit
        miner_accepted_shares = $AcceptedShares
        miner_rejected_shares = $RejectedShares
        miner_reject_rate = $RejectRate
        miner_uptime_seconds = $UptimeSeconds
        pool_name = $Pool
    }

    $Lines | Set-Content -Path $Out -Encoding utf8
    $Json | ConvertTo-Json | Set-Content -Path $JsonOut -Encoding utf8

    $ReportHash = Get-FileHash -Algorithm SHA256 $Out
    $ReportItem = Get-Item $Out
    $ReportSha256 = $ReportHash.Hash.ToLowerInvariant()
    $JsonReportHash = Get-FileHash -Algorithm SHA256 $JsonOut
    $JsonReportItem = Get-Item $JsonOut
    $JsonReportSha256 = $JsonReportHash.Hash.ToLowerInvariant()

    Write-Host "telemetry.report=$Out"
    Write-Host "telemetry.report_sha256=$ReportSha256"
    Write-Host "telemetry.report_size_bytes=$($ReportItem.Length)"
    Write-Host "telemetry.json=$JsonOut"
    Write-Host "telemetry.json_sha256=$JsonReportSha256"
    Write-Host "telemetry.json_size_bytes=$($JsonReportItem.Length)"
    Write-Host "AGENT TELEMETRY REPORT WRITTEN"
}
finally {
    Pop-Location
}
