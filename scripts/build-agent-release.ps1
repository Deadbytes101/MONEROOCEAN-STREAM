$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    $Manifest = "crates\dbyte-agent\Cargo.toml"
    $Binary = "crates\dbyte-agent\target\release\dbyte-agent.exe"
    $Report = "reports\dbyte-agent-release.txt"
    $JsonReport = "reports\dbyte-agent-release.json"

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
    $BuiltAtUnix = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $GitCommit = (git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "git commit lookup failed with exit code $LASTEXITCODE"
    }

    if (!(Test-Path $ReportDir)) {
        New-Item -ItemType Directory -Path $ReportDir | Out-Null
    }

    $Lines = @(
        "agent.binary=$Binary",
        "agent.sha256=$($Hash.Hash.ToLowerInvariant())",
        "agent.size_bytes=$($Item.Length)",
        "agent.report=$Report",
        "agent.manifest=$JsonReport",
        "agent.built_at_unix=$BuiltAtUnix",
        "agent.git_commit=$GitCommit"
    )

    $Json = [ordered]@{
        agent_binary = $Binary
        agent_sha256 = $Hash.Hash.ToLowerInvariant()
        agent_size_bytes = $Item.Length
        agent_report = $Report
        agent_manifest = $JsonReport
        agent_built_at_unix = $BuiltAtUnix
        agent_git_commit = $GitCommit
    }

    $Lines | Set-Content -Path $Report -Encoding utf8
    $Json | ConvertTo-Json | Set-Content -Path $JsonReport -Encoding utf8
    $Lines | ForEach-Object { Write-Host $_ }

    Write-Host "== release build passed =="
    Write-Host "AGENT RELEASE BINARY BUILT"
}
finally {
    Pop-Location
}
