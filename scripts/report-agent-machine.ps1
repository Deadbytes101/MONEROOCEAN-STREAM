$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

param(
    [string]$Config = "configs\agent.example.toml",
    [string]$Out = "reports\dbyte-agent-machine.txt"
)

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Assert-HasLinePrefix {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            [string[]]$Lines,

            [Parameter(Mandatory = $true)]
            [string]$Prefix
        )

        foreach ($Line in $Lines) {
            if ($Line.StartsWith($Prefix)) {
                return
            }
        }

        throw "$Name missing line prefix: $Prefix"
    }

    $Manifest = "crates\dbyte-agent\Cargo.toml"
    $OutputDir = Split-Path -Parent $Out

    if ($OutputDir) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    Write-Host "== machine report =="
    $ReportLines = cargo run --quiet --manifest-path $Manifest --bin dbyte-agent -- --config $Config machine
    if ($LASTEXITCODE -ne 0) {
        throw "machine report failed with exit code $LASTEXITCODE"
    }

    Assert-HasLinePrefix "machine report" $ReportLines "agent.version="
    Assert-HasLinePrefix "machine report" $ReportLines "machine.name="
    Assert-HasLinePrefix "machine report" $ReportLines "os="
    Assert-HasLinePrefix "machine report" $ReportLines "arch="
    Assert-HasLinePrefix "machine report" $ReportLines "parallelism.available="
    Assert-HasLinePrefix "machine report" $ReportLines "cwd="
    Assert-HasLinePrefix "machine report" $ReportLines "exe.path="
    Assert-HasLinePrefix "machine report" $ReportLines "config.event_log_path="

    $ReportLines | Set-Content -Path $Out -Encoding utf8

    $ReportHash = Get-FileHash -Algorithm SHA256 $Out
    $ReportItem = Get-Item $Out
    $ReportSha256 = $ReportHash.Hash.ToLowerInvariant()

    Write-Host "machine.report=$Out"
    Write-Host "machine.report_sha256=$ReportSha256"
    Write-Host "machine.report_size_bytes=$($ReportItem.Length)"
    Write-Host "AGENT MACHINE REPORT WRITTEN"
}
finally {
    Pop-Location
}
