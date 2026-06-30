param(
    [string]$Out = "reports\dbyte-agent-local-evidence.json",
    [string]$Config = "configs\agent.example.toml",
    [string]$ReleaseManifest = "reports\dbyte-agent-release.json"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Get-Sha256OrMissing {
        param([Parameter(Mandatory = $true)][string]$Path)
        if (!(Test-Path $Path)) { return "<missing>" }
        $Hash = Get-FileHash -Algorithm SHA256 $Path
        return $Hash.Hash.ToLowerInvariant()
    }

    function Get-SizeOrZero {
        param([Parameter(Mandatory = $true)][string]$Path)
        if (!(Test-Path $Path)) { return 0 }
        $Item = Get-Item $Path
        return [int64]$Item.Length
    }

    $OutputDir = Split-Path -Parent $Out
    if ($OutputDir) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    $ReleaseJson = $null
    if (Test-Path $ReleaseManifest) {
        $ReleaseJson = Get-Content $ReleaseManifest -Raw | ConvertFrom-Json
    }

    $BinaryPath = "<missing>"
    $BinarySha256 = "<missing>"
    $BinarySizeBytes = 0

    if ($ReleaseJson) {
        $BinaryPath = [string]$ReleaseJson.agent_binary
        $BinarySha256 = [string]$ReleaseJson.agent_sha256
        $BinarySizeBytes = [int64]$ReleaseJson.agent_size_bytes
    }

    $Approval = "manifest_verified"
    $Status = "ok"
    if (!(Test-Path $ReleaseManifest)) {
        $Approval = "missing_manifest"
        $Status = "attention"
    } elseif ($BinaryPath -eq "" -or $BinarySha256 -eq "") {
        $Approval = "manifest_incomplete"
        $Status = "attention"
    }

    $Evidence = [ordered]@{
        schema = 1
        status = $Status
        approval = $Approval
        rig_id = "deadbyte-local"
        agent_version = "0.1.0"
        agent_started_at_unix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        approved_binary_path = $BinaryPath
        approved_binary_sha256 = $BinarySha256
        approved_binary_size_bytes = $BinarySizeBytes
        approved_config_path = $Config
        approved_config_sha256 = Get-Sha256OrMissing -Path $Config
        approved_config_size_bytes = Get-SizeOrZero -Path $Config
        release_manifest_path = $ReleaseManifest
        release_manifest_sha256 = Get-Sha256OrMissing -Path $ReleaseManifest
        release_manifest_size_bytes = Get-SizeOrZero -Path $ReleaseManifest
        raw_log_dir = "reports\runtime\raw"
        raw_logs = "missing"
        session_event_path = "reports\runtime\runtime-session.jsonl"
        session_event_sha256 = "<missing>"
        session_event_size_bytes = 0
        session_events = "missing"
        last_exit_code = 0
        last_exit_reason = "not_started"
    }

    $Evidence | ConvertTo-Json -Depth 4 | Set-Content -Path $Out -Encoding utf8

    $ReportHash = Get-FileHash -Algorithm SHA256 $Out
    $ReportItem = Get-Item $Out
    $ReportSha256 = $ReportHash.Hash.ToLowerInvariant()

    Write-Host "local.evidence.report=$Out"
    Write-Host "local.evidence.report_sha256=$ReportSha256"
    Write-Host "local.evidence.report_size_bytes=$($ReportItem.Length)"
    Write-Host "local.evidence.status=$Status"
    Write-Host "local.evidence.approval=$Approval"
    Write-Host "AGENT LOCAL EVIDENCE REPORT WRITTEN"
}
finally {
    Pop-Location
}
