param(
    [string]$Out = "reports\dbyte-agent-local-evidence.json",
    [string]$Config = "configs\agent.example.toml",
    [string]$ReleaseManifest = "reports\dbyte-agent-release.json",
    [string]$RawLogDir = "reports\runtime\raw",
    [string]$SessionEventPath = "reports\runtime\runtime-session.jsonl"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Get-Sha256OrMissing {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Path
        )

        if (!(Test-Path $Path)) {
            return "<missing>"
        }

        $Hash = Get-FileHash -Algorithm SHA256 $Path
        return $Hash.Hash.ToLowerInvariant()
    }

    function Get-FileSizeOrZero {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Path
        )

        if (!(Test-Path $Path)) {
            return 0
        }

        $Item = Get-Item $Path
        return [int64]$Item.Length
    }

    function Get-TomlStringValue {
        param(
            [Parameter(Mandatory = $true)]
            [string[]]$Lines,

            [Parameter(Mandatory = $true)]
            [string]$Key
        )

        $Pattern = "^\s*$([regex]::Escape($Key))\s*=\s*\"([^\"]*)\"\s*$"
        foreach ($Line in $Lines) {
            $Match = [regex]::Match($Line, $Pattern)
            if ($Match.Success) {
                return $Match.Groups[1].Value
            }
        }

        return "<unknown>"
    }

    $OutputDir = Split-Path -Parent $Out
    if ($OutputDir) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    $ConfigLines = @()
    if (Test-Path $Config) {
        $ConfigLines = @(Get-Content $Config)
    }

    $RigId = Get-TomlStringValue -Lines $ConfigLines -Key "name"
    $ConfigSha256 = Get-Sha256OrMissing -Path $Config
    $ConfigSizeBytes = Get-FileSizeOrZero -Path $Config

    $ReleaseJson = $null
    if (Test-Path $ReleaseManifest) {
        $ReleaseJson = Get-Content $ReleaseManifest -Raw | ConvertFrom-Json
    }

    $ApprovedBinaryPath = "<missing>"
    $ApprovedBinarySha256 = "<missing>"
    $ApprovedBinarySizeBytes = 0
    $AgentVersion = "0.1.0"

    if ($ReleaseJson) {
        if ($ReleaseJson.PSObject.Properties.Name -contains "agent_binary") {
            $ApprovedBinaryPath = [string]$ReleaseJson.agent_binary
        } elseif ($ReleaseJson.PSObject.Properties.Name -contains "binary_path") {
            $ApprovedBinaryPath = [string]$ReleaseJson.binary_path
        }

        if ($ReleaseJson.PSObject.Properties.Name -contains "agent_sha256") {
            $ApprovedBinarySha256 = [string]$ReleaseJson.agent_sha256
        } elseif ($ReleaseJson.PSObject.Properties.Name -contains "binary_sha256") {
            $ApprovedBinarySha256 = [string]$ReleaseJson.binary_sha256
        }

        if ($ReleaseJson.PSObject.Properties.Name -contains "agent_size_bytes") {
            $ApprovedBinarySizeBytes = [int64]$ReleaseJson.agent_size_bytes
        } elseif ($ReleaseJson.PSObject.Properties.Name -contains "binary_size_bytes") {
            $ApprovedBinarySizeBytes = [int64]$ReleaseJson.binary_size_bytes
        }
    }

    $ReleaseManifestSha256 = Get-Sha256OrMissing -Path $ReleaseManifest
    $ReleaseManifestSizeBytes = Get-FileSizeOrZero -Path $ReleaseManifest
    $RawLogsStatus = "missing"
    if (Test-Path $RawLogDir) {
        $RawLogsStatus = "present"
    }

    $SessionEventsStatus = "missing"
    $SessionEventSha256 = Get-Sha256OrMissing -Path $SessionEventPath
    $SessionEventSizeBytes = Get-FileSizeOrZero -Path $SessionEventPath
    if (Test-Path $SessionEventPath) {
        $SessionEventsStatus = "present"
    }

    $Approval = "manifest_verified"
    $Status = "ok"
    if (!(Test-Path $ReleaseManifest)) {
        $Approval = "missing_manifest"
        $Status = "attention"
    } elseif ($ApprovedBinaryPath -eq "<missing>" -or $ApprovedBinarySha256 -eq "<missing>") {
        $Approval = "manifest_incomplete"
        $Status = "attention"
    }

    $Evidence = [ordered]@{
        schema = 1
        status = $Status
        approval = $Approval
        rig_id = $RigId
        agent_version = $AgentVersion
        agent_started_at_unix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        approved_binary_path = $ApprovedBinaryPath
        approved_binary_sha256 = $ApprovedBinarySha256
        approved_binary_size_bytes = $ApprovedBinarySizeBytes
        approved_config_path = $Config
        approved_config_sha256 = $ConfigSha256
        approved_config_size_bytes = $ConfigSizeBytes
        release_manifest_path = $ReleaseManifest
        release_manifest_sha256 = $ReleaseManifestSha256
        release_manifest_size_bytes = $ReleaseManifestSizeBytes
        raw_log_dir = $RawLogDir
        raw_logs = $RawLogsStatus
        session_event_path = $SessionEventPath
        session_event_sha256 = $SessionEventSha256
        session_event_size_bytes = $SessionEventSizeBytes
        session_events = $SessionEventsStatus
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
