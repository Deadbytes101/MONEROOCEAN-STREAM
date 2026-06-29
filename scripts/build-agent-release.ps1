$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    $Manifest = "crates\dbyte-agent\Cargo.toml"
    $Binary = "crates\dbyte-agent\target\release\dbyte-agent.exe"
    $Report = "reports\dbyte-agent-release.txt"

    Write-Host "== release build =="
    cargo build --release --manifest-path $Manifest
    if ($LASTEXITCODE -ne 0) {
        throw "release build failed with exit code $LASTEXITCODE"
    }

    if (!(Test-Path $Binary)) {
        throw "missing release binary: $Binary"
    }

    $Hash = Get-FileHash -Algorithm SHA256 $Binary
    $Item = Get-Item $Binary
    $ReportDir = Split-Path -Parent $Report

    if (!(Test-Path $ReportDir)) {
        New-Item -ItemType Directory -Path $ReportDir | Out-Null
    }

    $Lines = @(
        "agent.binary=$Binary",
        "agent.sha256=$($Hash.Hash.ToLowerInvariant())",
        "agent.size_bytes=$($Item.Length)",
        "agent.report=$Report"
    )

    $Lines | Set-Content -Path $Report -Encoding utf8
    $Lines | ForEach-Object { Write-Host $_ }

    Write-Host "== release build passed =="
    Write-Host "AGENT RELEASE BINARY BUILT"
}
finally {
    Pop-Location
}
