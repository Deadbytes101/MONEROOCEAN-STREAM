param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Wallet
)

$ErrorActionPreference = "Stop"

$Base = "https://api.moneroocean.stream"
$SampleDir = Join-Path $PSScriptRoot "samples"

New-Item -ItemType Directory -Force -Path $SampleDir | Out-Null

$Endpoints = @(
    @{ Name = "miner-stats"; Path = "/miner/$Wallet/stats" },
    @{ Name = "workers"; Path = "/miner/$Wallet/stats/allWorkers" },
    @{ Name = "hashrate-chart"; Path = "/miner/$Wallet/chart/hashrate" },
    @{ Name = "workers-hashrate-chart"; Path = "/miner/$Wallet/chart/hashrate/allWorkers" },
    @{ Name = "payments"; Path = "/miner/$Wallet/payments?page=0&limit=15" },
    @{ Name = "pool-stats"; Path = "/pool/stats" },
    @{ Name = "network-stats"; Path = "/network/stats" }
)

function Write-Section {
    param([string]$Text)
    Write-Host ""
    Write-Host $Text -ForegroundColor Cyan
    Write-Host ("-" * $Text.Length) -ForegroundColor DarkCyan
}

function Get-SafeWalletLabel {
    param([string]$Address)

    if ($Address.Length -le 16) {
        return $Address
    }

    return "$($Address.Substring(0, 8))...$($Address.Substring($Address.Length - 8))"
}

Write-Section "MoneroOcean Steam API Probe"
Write-Host "Base:   $Base"
Write-Host "Wallet: $(Get-SafeWalletLabel $Wallet)"
Write-Host "Output: $SampleDir"

foreach ($Endpoint in $Endpoints) {
    $Url = "$Base$($Endpoint.Path)"
    $OutFile = Join-Path $SampleDir "$($Endpoint.Name).json"

    Write-Host ""
    Write-Host "GET $($Endpoint.Name)" -ForegroundColor Yellow
    Write-Host "  $Url"

    try {
        $Response = Invoke-RestMethod `
            -Uri $Url `
            -Method Get `
            -Headers @{ Accept = "application/json" } `
            -TimeoutSec 20

        $Response |
            ConvertTo-Json -Depth 64 |
            Out-File -Encoding utf8 $OutFile

        Write-Host "  OK -> $OutFile" -ForegroundColor Green
    }
    catch {
        Write-Host "  FAIL -> $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Probe finished." -ForegroundColor Cyan
