param(
    [string]$Ledger = "crates\dbyte-agent\fixtures\decision-clean-ledger.events",
    [string]$Out = "reports\dbyte-agent-decision.json"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Assert-JsonField {
        param(
            [Parameter(Mandatory = $true)]
            [object]$Json,

            [Parameter(Mandatory = $true)]
            [string]$Name
        )

        if (-not $Json.PSObject.Properties[$Name]) {
            throw "decision report missing JSON field: $Name"
        }
    }

    $Manifest = "crates\dbyte-agent\Cargo.toml"
    $OutputDir = Split-Path -Parent $Out

    if ($OutputDir) {
        New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    }

    Write-Host "== decision report =="
    cargo run --quiet --manifest-path $Manifest --bin dbyte-agent-decision -- --ledger $Ledger --out $Out
    if ($LASTEXITCODE -ne 0) {
        throw "decision report failed with exit code $LASTEXITCODE"
    }

    if (!(Test-Path $Out)) {
        throw "missing decision report artifact: $Out"
    }

    $DecisionJson = Get-Content $Out -Raw | ConvertFrom-Json
    Assert-JsonField $DecisionJson "decision_scope"
    Assert-JsonField $DecisionJson "decision_status"
    Assert-JsonField $DecisionJson "decision_reason"
    Assert-JsonField $DecisionJson "decision_next"

    if ($DecisionJson.decision_scope -ne "read_only") {
        throw "decision report must stay read-only"
    }

    $ReportHash = Get-FileHash -Algorithm SHA256 $Out
    $ReportItem = Get-Item $Out
    $ReportSha256 = $ReportHash.Hash.ToLowerInvariant()

    Write-Host "decision.report=$Out"
    Write-Host "decision.report_sha256=$ReportSha256"
    Write-Host "decision.report_size_bytes=$($ReportItem.Length)"
    Write-Host "AGENT DECISION REPORT WRITTEN"
}
finally {
    Pop-Location
}
