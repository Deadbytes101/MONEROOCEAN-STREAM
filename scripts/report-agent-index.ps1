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
        @{ name = "phase_a_summary"; kind = "json"; path = "reports\dbyte-service-protocol-summary.json"; required = $false },
        @{ name = "phase_b_registry"; kind = "json"; path = "reports\dbyte-session-registry.json"; required = $false },
        @{ name = "phase_c_job_source"; kind = "json"; path = "reports\dbyte-job-source.json"; required = $false },
        @{ name = "phase_d_share_intake"; kind = "json"; path = "reports\dbyte-share-intake.json"; required = $false },
        @{ name = "session_events_summary"; kind = "json"; path = "reports\dbyte-session-events-summary.json"; required = $false },
        @{ name = "replay_projection"; kind = "json"; path = "reports\dbyte-replay-projection.json"; required = $false },
        @{ name = "bridge_compare"; kind = "json"; path = "reports\dbyte-bridge-compare.json"; required = $false },
        @{ name = "bridge_file_compare"; kind = "json"; path = "reports\dbyte-bridge-file-compare.json"; required = $false },
        @{ name = "bridge_file"; kind = "json"; path = "reports\dbyte-bridge-file.json"; required = $false },
        @{ name = "pool_core_ledger"; kind = "json"; path = "reports\dbyte-pool-ledger-report.json"; required = $true },
        @{ name = "pool_core_fixture_ledger"; kind = "json"; path = "reports\dbyte-pool-ledger-fixture-report.json"; required = $true },
        @{ name = "pool_core_file_ledger"; kind = "json"; path = "reports\dbyte-pool-ledger-file-report.json"; required = $true }
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

        if ([string]$Report.name -eq "phase_a_summary" -and $Exists) {
            $PhaseAJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.phase_schema = [int]$PhaseAJson.schema
            $Entry.phase_status = [string]$PhaseAJson.status
            $Entry.phase_valid = [bool]$PhaseAJson.valid
            $Entry.phase_valid_messages = [int64]$PhaseAJson.valid_messages
            $Entry.phase_invalid_messages = [int64]$PhaseAJson.invalid_messages
            $Entry.phase_total_messages = [int64]$PhaseAJson.summary.total_messages
            $Entry.phase_accepted = [int64]$PhaseAJson.summary.accepted
            $Entry.phase_rejected = [int64]$PhaseAJson.summary.rejected
            $Entry.phase_credited_difficulty = [int64]$PhaseAJson.summary.credited_difficulty
            $Entry.phase_session_count = [int64]$PhaseAJson.summary.session_count
        }

        if ([string]$Report.name -eq "phase_b_registry" -and $Exists) {
            $PhaseBJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.registry_schema = [int]$PhaseBJson.schema
            $Entry.registry_status = [string]$PhaseBJson.status
            $Entry.registry_input_valid = [bool]$PhaseBJson.input_valid
            $Entry.registry_valid = [bool]$PhaseBJson.registry_valid
            $Entry.registry_valid_messages = [int64]$PhaseBJson.valid_messages
            $Entry.registry_session_count = [int64]$PhaseBJson.summary.session_count
            $Entry.registry_active_sessions = [int64]$PhaseBJson.summary.active_sessions
            $Entry.registry_closed_sessions = [int64]$PhaseBJson.summary.closed_sessions
            $Entry.registry_rejected_sessions = [int64]$PhaseBJson.summary.rejected_sessions
            $Entry.registry_accepted = [int64]$PhaseBJson.summary.accepted
            $Entry.registry_rejected = [int64]$PhaseBJson.summary.rejected
            $Entry.registry_credited_difficulty = [int64]$PhaseBJson.summary.credited_difficulty
            $Entry.registry_error_count = [int64]$PhaseBJson.summary.error_count
        }

        if ([string]$Report.name -eq "phase_c_job_source" -and $Exists) {
            $PhaseCJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.job_schema = [int]$PhaseCJson.schema
            $Entry.job_status = [string]$PhaseCJson.status
            $Entry.job_source_kind = [string]$PhaseCJson.source_kind
            $Entry.job_valid = [bool]$PhaseCJson.valid
            $Entry.job_total_jobs = [int64]$PhaseCJson.summary.total_jobs
            $Entry.job_active_jobs = [int64]$PhaseCJson.summary.active_jobs
            $Entry.job_stale_jobs = [int64]$PhaseCJson.summary.stale_jobs
            $Entry.job_error_count = [int64]$PhaseCJson.summary.error_count
            $Entry.job_minimum_difficulty = [int64]$PhaseCJson.summary.minimum_difficulty
            $Entry.job_maximum_difficulty = [int64]$PhaseCJson.summary.maximum_difficulty
        }

        if ([string]$Report.name -eq "phase_d_share_intake" -and $Exists) {
            $PhaseDJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.intake_schema = [int]$PhaseDJson.schema
            $Entry.intake_status = [string]$PhaseDJson.status
            $Entry.intake_input_valid = [bool]$PhaseDJson.input_valid
            $Entry.intake_job_source_valid = [bool]$PhaseDJson.job_source_valid
            $Entry.intake_valid = [bool]$PhaseDJson.intake_valid
            $Entry.intake_total_submits = [int64]$PhaseDJson.summary.total_submits
            $Entry.intake_accepted_submits = [int64]$PhaseDJson.summary.accepted_submits
            $Entry.intake_rejected_submits = [int64]$PhaseDJson.summary.rejected_submits
            $Entry.intake_credited_difficulty = [int64]$PhaseDJson.summary.credited_difficulty
            $Entry.intake_rejection_count = [int64]@($PhaseDJson.summary.rejection_reasons).Count
        }

        if ([string]$Report.name -like "bridge*compare" -and $Exists) {
            $CompareJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.compare_schema = [int]$CompareJson.schema
            $Entry.compare_status = [string]$CompareJson.status
            $Entry.compare_total_events = [bool]$CompareJson.matches.total_events
            $Entry.compare_accepted_events = [bool]$CompareJson.matches.accepted_events
            $Entry.compare_rejected_events = [bool]$CompareJson.matches.rejected_events
            $Entry.compare_credited_difficulty = [bool]$CompareJson.matches.credited_difficulty
        }

        if ([string]$Report.name -eq "bridge_file" -and $Exists) {
            $BridgeFileJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.bridge_schema = [int]$BridgeFileJson.schema
            $Entry.bridge_status = [string]$BridgeFileJson.status
            $Entry.bridge_valid = [bool]$BridgeFileJson.valid
            $Entry.bridge_total_events = [int64]$BridgeFileJson.summary.total_events
            $Entry.bridge_accepted_events = [int64]$BridgeFileJson.summary.accepted_events
            $Entry.bridge_rejected_events = [int64]$BridgeFileJson.summary.rejected_events
            $Entry.bridge_credited_difficulty = [int64]$BridgeFileJson.summary.credited_difficulty
            $Entry.bridge_session_count = [int64]$BridgeFileJson.summary.session_count
            $Entry.bridge_job_count = [int64]$BridgeFileJson.summary.job_count
            $Entry.bridge_assignment_count = [int64]$BridgeFileJson.summary.assignment_count
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
