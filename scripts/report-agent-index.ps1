param(
    [string]$Out = "reports\dbyte-agent-index.json"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    $OutputDir = Split-Path -Parent $Out
    if ($OutputDir) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    $Reports = @(
        @{ name = "machine"; kind = "text"; path = "reports\dbyte-agent-machine.txt"; required = $true },
        @{ name = "telemetry"; kind = "text"; path = "reports\dbyte-agent-telemetry.txt"; required = $true },
        @{ name = "telemetry_json"; kind = "json"; path = "reports\dbyte-agent-telemetry.json"; required = $true },
        @{ name = "decision"; kind = "json"; path = "reports\dbyte-agent-decision.json"; required = $true },
        @{ name = "release"; kind = "text"; path = "reports\dbyte-agent-release.txt"; required = $true },
        @{ name = "release_manifest"; kind = "json"; path = "reports\dbyte-agent-release.json"; required = $true },
        @{ name = "release_seal"; kind = "text"; path = "reports\dbyte-agent-release.seal.txt"; required = $true },
        @{ name = "checker"; kind = "text"; path = "reports\dbyte-agent-check.txt"; required = $true },
        @{ name = "verify_ledger"; kind = "json"; path = "reports\verify-agent.json"; required = $true },
        @{ name = "local_agent_evidence"; kind = "json"; path = "reports\dbyte-agent-local-evidence.json"; required = $false },
        @{ name = "session_events_summary"; kind = "json"; path = "reports\dbyte-session-events-summary.json"; required = $false },
        @{ name = "replay_projection"; kind = "json"; path = "reports\dbyte-replay-projection.json"; required = $false },
        @{ name = "bridge_compare"; kind = "json"; path = "reports\dbyte-bridge-compare.json"; required = $false },
        @{ name = "bridge_file"; kind = "json"; path = "reports\dbyte-bridge-file.json"; required = $false },
        @{ name = "pool_core_ledger"; kind = "json"; path = "reports\dbyte-pool-ledger-report.json"; required = $true },
        @{ name = "pool_core_fixture_ledger"; kind = "json"; path = "reports\dbyte-pool-ledger-fixture-report.json"; required = $true }
    )

    $Items = foreach ($Report in $Reports) {
        $Path = [string]$Report.path
        $Exists = Test-Path $Path
        $Sha256 = "<missing>"
        $SizeBytes = 0
        $Status = "missing"

        if ($Exists) {
            $Hash = Get-FileHash -Algorithm SHA256 $Path
            $Item = Get-Item $Path
            $Sha256 = $Hash.Hash.ToLowerInvariant()
            $SizeBytes = $Item.Length
            $Status = "present"
        }

        $Entry = [ordered]@{
            name = [string]$Report.name
            kind = [string]$Report.kind
            path = $Path
            required = [bool]$Report.required
            exists = [bool]$Exists
            status = $Status
            sha256 = $Sha256
            size_bytes = [int64]$SizeBytes
        }

        if ([string]$Report.name -like "pool_core*_ledger" -and $Exists) {
            $PoolCoreJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Sessions = @($PoolCoreJson.sessions)
            $Entry.replay_schema = [int]$PoolCoreJson.schema
            $Entry.replay_status = [string]$PoolCoreJson.status
            $Entry.replay_total_events = [int64]$PoolCoreJson.total_events
            $Entry.replay_accepted_events = [int64]$PoolCoreJson.accepted_events
            $Entry.replay_rejected_events = [int64]$PoolCoreJson.rejected_events
            $Entry.replay_credited_difficulty = [int64]$PoolCoreJson.credited_difficulty
            $Entry.replay_session_count = [int64]$Sessions.Count
        }

        $Entry
    }

    $MissingRequired = @($Items | Where-Object { $_.required -and -not $_.exists })
    $IndexStatus = "ok"
    if ($MissingRequired.Count -gt 0) {
        $IndexStatus = "attention"
    }

    $Index = [ordered]@{
        index_schema = 1
        index_scope = "read_only"
        index_ts_unix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        index_status = $IndexStatus
        report_count = $Items.Count
        missing_required_count = $MissingRequired.Count
        reports = @($Items)
    }

    $Index | ConvertTo-Json -Depth 6 | Set-Content -Path $Out -Encoding utf8

    $IndexJson = Get-Content $Out -Raw | ConvertFrom-Json
    if ($IndexJson.index_scope -ne "read_only") {
        throw "report index must stay read-only"
    }

    $ReportHash = Get-FileHash -Algorithm SHA256 $Out
    $ReportItem = Get-Item $Out
    $ReportSha256 = $ReportHash.Hash.ToLowerInvariant()

    Write-Host "index.report=$Out"
    Write-Host "index.report_sha256=$ReportSha256"
    Write-Host "index.report_size_bytes=$($ReportItem.Length)"
    Write-Host "index.report_status=$($IndexJson.index_status)"
    Write-Host "AGENT REPORT INDEX WRITTEN"
}
finally {
    Pop-Location
}
