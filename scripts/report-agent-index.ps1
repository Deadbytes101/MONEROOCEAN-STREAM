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
        @{ name = "phase_e_difficulty_policy"; kind = "json"; path = "reports\dbyte-difficulty-policy.json"; required = $false },
        @{ name = "phase_f_accounting_projection"; kind = "json"; path = "reports\dbyte-accounting-projection.json"; required = $false },
        @{ name = "phase_g_settlement_plan"; kind = "json"; path = "reports\dbyte-settlement-plan.json"; required = $false },
        @{ name = "phase_h_local_dry_run"; kind = "json"; path = "reports\dbyte-local-service-dry-run.json"; required = $false },
        @{ name = "phase_i_service_readiness"; kind = "json"; path = "reports\dbyte-service-readiness.json"; required = $false },
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

        if ([string]$Report.name -eq "phase_e_difficulty_policy" -and $Exists) {
            $PhaseEJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.policy_schema = [int]$PhaseEJson.schema
            $Entry.policy_status = [string]$PhaseEJson.status
            $Entry.policy_input_valid = [bool]$PhaseEJson.input_valid
            $Entry.policy_registry_valid = [bool]$PhaseEJson.registry_valid
            $Entry.policy_job_source_valid = [bool]$PhaseEJson.job_source_valid
            $Entry.policy_valid = [bool]$PhaseEJson.policy_valid
            $Entry.policy_mode = [string]$PhaseEJson.summary.policy_mode
            $Entry.policy_dry_run = [bool]$PhaseEJson.summary.dry_run
            $Entry.policy_session_count = [int64]$PhaseEJson.summary.session_count
            $Entry.policy_recommended_changes = [int64]$PhaseEJson.summary.recommended_changes
            $Entry.policy_minimum_assigned_difficulty = [int64]$PhaseEJson.summary.minimum_assigned_difficulty
            $Entry.policy_maximum_assigned_difficulty = [int64]$PhaseEJson.summary.maximum_assigned_difficulty
            $Entry.policy_reason_count = [int64]$PhaseEJson.summary.reason_count
        }

        if ([string]$Report.name -eq "phase_f_accounting_projection" -and $Exists) {
            $PhaseFJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.accounting_schema = [int]$PhaseFJson.schema
            $Entry.accounting_status = [string]$PhaseFJson.status
            $Entry.accounting_input_valid = [bool]$PhaseFJson.input_valid
            $Entry.accounting_registry_valid = [bool]$PhaseFJson.registry_valid
            $Entry.accounting_intake_valid = [bool]$PhaseFJson.intake_valid
            $Entry.accounting_valid = [bool]$PhaseFJson.accounting_valid
            $Entry.accounting_total_credited_difficulty = [int64]$PhaseFJson.summary.total_credited_difficulty
            $Entry.accounting_intake_credited_difficulty = [int64]$PhaseFJson.summary.intake_credited_difficulty
            $Entry.accounting_worker_count = [int64]$PhaseFJson.summary.worker_count
            $Entry.accounting_group_count = [int64]$PhaseFJson.summary.group_count
            $Entry.accounting_rejected_shares = [int64]$PhaseFJson.summary.rejected_shares
            $Entry.accounting_value_movement_count = [int64]$PhaseFJson.summary.value_movement_count
            $Entry.accounting_credited_matches_intake = [bool]$PhaseFJson.checks.credited_matches_intake
            $Entry.accounting_no_value_movement = [bool]$PhaseFJson.checks.no_value_movement
        }

        if ([string]$Report.name -eq "phase_g_settlement_plan" -and $Exists) {
            $PhaseGJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.plan_schema = [int]$PhaseGJson.schema
            $Entry.plan_status = [string]$PhaseGJson.status
            $Entry.plan_input_valid = [bool]$PhaseGJson.input_valid
            $Entry.plan_registry_valid = [bool]$PhaseGJson.registry_valid
            $Entry.plan_accounting_valid = [bool]$PhaseGJson.accounting_valid
            $Entry.plan_valid = [bool]$PhaseGJson.plan_valid
            $Entry.plan_execution_enabled = [bool]$PhaseGJson.execution_enabled
            $Entry.plan_operator_approval_required = [bool]$PhaseGJson.operator_approval_required
            $Entry.plan_policy_mode = [string]$PhaseGJson.policy.mode
            $Entry.plan_rows = [int64]$PhaseGJson.summary.plan_rows
            $Entry.plan_review_rows = [int64]$PhaseGJson.summary.review_rows
            $Entry.plan_held_rows = [int64]$PhaseGJson.summary.held_rows
            $Entry.plan_total_amount_units = [int64]$PhaseGJson.summary.total_amount_units
            $Entry.plan_total_fee_estimate_units = [int64]$PhaseGJson.summary.total_fee_estimate_units
            $Entry.plan_total_net_amount_units = [int64]$PhaseGJson.summary.total_net_amount_units
            $Entry.plan_secret_material_stored = [bool]$PhaseGJson.summary.secret_material_stored
        }

        if ([string]$Report.name -eq "phase_h_local_dry_run" -and $Exists) {
            $PhaseHJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.dry_run_schema = [int]$PhaseHJson.schema
            $Entry.dry_run_status = [string]$PhaseHJson.status
            $Entry.dry_run_input_valid = [bool]$PhaseHJson.input_valid
            $Entry.dry_run_job_source_valid = [bool]$PhaseHJson.job_source_valid
            $Entry.dry_run_valid = [bool]$PhaseHJson.dry_run_valid
            $Entry.dry_run_mode = [string]$PhaseHJson.mode
            $Entry.dry_run_listener_enabled = [bool]$PhaseHJson.listener_enabled
            $Entry.dry_run_external_bind_enabled = [bool]$PhaseHJson.external_bind_enabled
            $Entry.dry_run_live_worker_intake_enabled = [bool]$PhaseHJson.live_worker_intake_enabled
            $Entry.dry_run_startup_status = [string]$PhaseHJson.startup.status
            $Entry.dry_run_shutdown_status = [string]$PhaseHJson.shutdown.status
            $Entry.dry_run_input_messages = [int64]$PhaseHJson.counters.input_messages
            $Entry.dry_run_malformed_messages = [int64]$PhaseHJson.counters.malformed_messages
            $Entry.dry_run_rate_limited_messages = [int64]$PhaseHJson.counters.rate_limited_messages
            $Entry.dry_run_error_count = [int64]$PhaseHJson.counters.error_count
            $Entry.dry_run_accepted_submits = [int64]$PhaseHJson.counters.accepted_submits
            $Entry.dry_run_rejected_submits = [int64]$PhaseHJson.counters.rejected_submits
            $Entry.dry_run_plan_rows = [int64]$PhaseHJson.counters.plan_rows
            $Entry.dry_run_dashboard_source = [string]$PhaseHJson.dashboard_projection.source
            $Entry.dry_run_replayable = [bool]$PhaseHJson.replayable
        }

        if ([string]$Report.name -eq "phase_i_service_readiness" -and $Exists) {
            $PhaseIJson = Get-Content $Path -Raw | ConvertFrom-Json
            $Entry.readiness_schema = [int]$PhaseIJson.schema
            $Entry.readiness_status = [string]$PhaseIJson.status
            $Entry.readiness_valid = [bool]$PhaseIJson.readiness_valid
            $Entry.readiness_mode = [string]$PhaseIJson.mode
            $Entry.readiness_config_mode = [string]$PhaseIJson.config.mode
            $Entry.readiness_config_enabled = [bool]$PhaseIJson.config.enabled
            $Entry.readiness_report_only = [bool]$PhaseIJson.summary.report_only
            $Entry.readiness_runtime_enabled = [bool]$PhaseIJson.summary.runtime_enabled
            $Entry.readiness_blocker_count = [int64]$PhaseIJson.summary.blocker_count
            $Entry.readiness_next_step = [string]$PhaseIJson.summary.next_step
            $Entry.readiness_phase_h_gate_ok = [bool]$PhaseIJson.checks.phase_h_gate_ok
            $Entry.readiness_local_mode = [bool]$PhaseIJson.checks.local_mode
            $Entry.readiness_payload_limit_present = [bool]$PhaseIJson.checks.payload_limit_present
            $Entry.readiness_message_limit_present = [bool]$PhaseIJson.checks.message_limit_present
            $Entry.readiness_operator_approval_required = [bool]$PhaseIJson.checks.operator_approval_required
            $Entry.preflight_status = [string]$PhaseIJson.preflight.status
            $Entry.preflight_enabled = [bool]$PhaseIJson.preflight.enabled
            $Entry.preflight_endpoint = [string]$PhaseIJson.preflight.endpoint
            $Entry.preflight_port = [int64]$PhaseIJson.preflight.port
            $Entry.preflight_report_only = [bool]$PhaseIJson.preflight.report_only
            $Entry.preflight_runtime_enabled = [bool]$PhaseIJson.preflight.runtime_enabled
            $Entry.preflight_local_endpoint = [bool]$PhaseIJson.preflight.local_endpoint
            $Entry.preflight_operator_visible = [bool]$PhaseIJson.preflight.operator_visible
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
