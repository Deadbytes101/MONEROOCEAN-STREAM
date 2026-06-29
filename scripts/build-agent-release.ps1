$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Assert-Equal {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            $Actual,

            [Parameter(Mandatory = $true)]
            $Expected
        )

        if ($Actual -ne $Expected) {
            throw "$Name mismatch: expected '$Expected', got '$Actual'"
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
    $Binary = "crates\dbyte-agent\target\release\dbyte-agent.exe"
    $Report = "reports\dbyte-agent-release.txt"
    $JsonReport = "reports\dbyte-agent-release.json"
    $CheckerReport = "reports\dbyte-agent-check.txt"
    $ManifestSeal = "reports\dbyte-agent-release.seal.txt"

    Write-Host "== release build =="
    cargo build --release --manifest-path $Manifest --bin dbyte-agent
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

    $BinarySha256 = $Hash.Hash.ToLowerInvariant()
    $Lines = @(
        "agent.binary=$Binary",
        "agent.sha256=$BinarySha256",
        "agent.size_bytes=$($Item.Length)",
        "agent.report=$Report",
        "agent.manifest=$JsonReport",
        "agent.manifest_seal=$ManifestSeal",
        "agent.checker_report=$CheckerReport",
        "agent.built_at_unix=$BuiltAtUnix",
        "agent.git_commit=$GitCommit"
    )

    $Json = [ordered]@{
        agent_binary = $Binary
        agent_sha256 = $BinarySha256
        agent_size_bytes = $Item.Length
        agent_report = $Report
        agent_manifest = $JsonReport
        agent_manifest_seal = $ManifestSeal
        agent_checker_report = $CheckerReport
        agent_built_at_unix = $BuiltAtUnix
        agent_git_commit = $GitCommit
    }

    $Lines | Set-Content -Path $Report -Encoding utf8
    $Json | ConvertTo-Json | Set-Content -Path $JsonReport -Encoding utf8

    Write-Host "== rust manifest check =="
    $CheckerOutput = cargo run --quiet --manifest-path $Manifest --bin dbyte-agent-check -- $JsonReport
    $CheckerExitCode = $LASTEXITCODE
    $CheckerOutput | Set-Content -Path $CheckerReport -Encoding utf8
    $CheckerOutput | ForEach-Object { Write-Host $_ }
    if ($CheckerExitCode -ne 0) {
        throw "rust manifest check failed with exit code $CheckerExitCode"
    }

    if (!(Test-Path $CheckerReport)) {
        throw "missing checker report artifact: $CheckerReport"
    }

    Assert-Contains "rust manifest check" $CheckerOutput "check.valid=true"
    Assert-Contains "rust manifest check" $CheckerOutput "runtime.approved=true"
    Assert-Contains "rust manifest check" $CheckerOutput "runtime.reason=manifest_verified"

    $CheckerReportHash = Get-FileHash -Algorithm SHA256 $CheckerReport
    $CheckerReportItem = Get-Item $CheckerReport
    $CheckerReportSha256 = $CheckerReportHash.Hash.ToLowerInvariant()

    $Lines += @(
        "agent.checker_report_sha256=$CheckerReportSha256",
        "agent.checker_report_size_bytes=$($CheckerReportItem.Length)"
    )
    $Json["agent_checker_report_sha256"] = $CheckerReportSha256
    $Json["agent_checker_report_size_bytes"] = $CheckerReportItem.Length

    $Lines | Set-Content -Path $Report -Encoding utf8
    $ReportHash = Get-FileHash -Algorithm SHA256 $Report
    $ReportItem = Get-Item $Report
    $ReportSha256 = $ReportHash.Hash.ToLowerInvariant()
    $Json["agent_report_sha256"] = $ReportSha256
    $Json["agent_report_size_bytes"] = $ReportItem.Length
    $Json | ConvertTo-Json | Set-Content -Path $JsonReport -Encoding utf8

    $ManifestCheck = Get-Content $JsonReport -Raw | ConvertFrom-Json
    Assert-Equal "agent_binary" $ManifestCheck.agent_binary $Binary
    Assert-Equal "agent_sha256" $ManifestCheck.agent_sha256 $BinarySha256
    Assert-Equal "agent_size_bytes" $ManifestCheck.agent_size_bytes $Item.Length
    Assert-Equal "agent_report" $ManifestCheck.agent_report $Report
    Assert-Equal "agent_report_sha256" $ManifestCheck.agent_report_sha256 $ReportSha256
    Assert-Equal "agent_report_size_bytes" $ManifestCheck.agent_report_size_bytes $ReportItem.Length
    Assert-Equal "agent_manifest" $ManifestCheck.agent_manifest $JsonReport
    Assert-Equal "agent_manifest_seal" $ManifestCheck.agent_manifest_seal $ManifestSeal
    Assert-Equal "agent_checker_report" $ManifestCheck.agent_checker_report $CheckerReport
    Assert-Equal "agent_checker_report_sha256" $ManifestCheck.agent_checker_report_sha256 $CheckerReportSha256
    Assert-Equal "agent_checker_report_size_bytes" $ManifestCheck.agent_checker_report_size_bytes $CheckerReportItem.Length
    Assert-Equal "agent_built_at_unix" $ManifestCheck.agent_built_at_unix $BuiltAtUnix
    Assert-Equal "agent_git_commit" $ManifestCheck.agent_git_commit $GitCommit

    Write-Host "== final rust manifest check =="
    $FinalCheckerOutput = cargo run --quiet --manifest-path $Manifest --bin dbyte-agent-check -- $JsonReport
    $FinalCheckerExitCode = $LASTEXITCODE
    $FinalCheckerOutput | ForEach-Object { Write-Host $_ }
    if ($FinalCheckerExitCode -ne 0) {
        throw "final rust manifest check failed with exit code $FinalCheckerExitCode"
    }

    Assert-Contains "final rust manifest check" $FinalCheckerOutput "check.valid=true"
    Assert-Contains "final rust manifest check" $FinalCheckerOutput "runtime.approved=true"
    Assert-Contains "final rust manifest check" $FinalCheckerOutput "runtime.reason=manifest_verified"
    Assert-Equal "final checker output" ($FinalCheckerOutput -join "`n") ($CheckerOutput -join "`n")

    $JsonReportHash = Get-FileHash -Algorithm SHA256 $JsonReport
    $JsonReportItem = Get-Item $JsonReport
    $JsonReportSha256 = $JsonReportHash.Hash.ToLowerInvariant()
    $SealLines = @(
        "seal.manifest=$JsonReport",
        "seal.manifest_sha256=$JsonReportSha256",
        "seal.manifest_size_bytes=$($JsonReportItem.Length)",
        "seal.git_commit=$GitCommit",
        "seal.built_at_unix=$BuiltAtUnix"
    )
    $SealLines | Set-Content -Path $ManifestSeal -Encoding utf8

    Assert-Contains "manifest seal" $SealLines "seal.manifest=$JsonReport"
    Assert-Contains "manifest seal" $SealLines "seal.manifest_sha256=$JsonReportSha256"
    Assert-Contains "manifest seal" $SealLines "seal.manifest_size_bytes=$($JsonReportItem.Length)"
    Assert-Contains "manifest seal" $SealLines "seal.git_commit=$GitCommit"
    Assert-Contains "manifest seal" $SealLines "seal.built_at_unix=$BuiltAtUnix"

    $Lines | ForEach-Object { Write-Host $_ }

    Write-Host "== manifest check passed =="
    Write-Host "AGENT RELEASE MANIFEST VERIFIED"
    Write-Host "agent.report_sha256=$ReportSha256"
    Write-Host "checker.report=$CheckerReport"
    Write-Host "checker.report_sha256=$CheckerReportSha256"
    Write-Host "manifest.seal=$ManifestSeal"
    Write-Host "manifest.seal_sha256=$JsonReportSha256"
    Write-Host "== manifest seal passed =="
    Write-Host "AGENT MANIFEST SEAL VERIFIED"
    Write-Host "== final manifest check passed =="
    Write-Host "AGENT FINAL MANIFEST VERIFIED"
    Write-Host "== checker output passed =="
    Write-Host "AGENT CHECKER OUTPUT VERIFIED"

    Write-Host "== release build passed =="
    Write-Host "AGENT RELEASE BINARY BUILT"
}
finally {
    Pop-Location
}
