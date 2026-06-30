$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $Root

try {
    function Invoke-Checked {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Name,

            [Parameter(Mandatory = $true)]
            [scriptblock]$Command
        )

        Write-Host "== $Name =="
        & $Command
        if ($LASTEXITCODE -ne 0) {
            throw "$Name failed with exit code $LASTEXITCODE"
        }
    }

    $Manifest = "crates\dbyte-pool-core\Cargo.toml"

    Invoke-Checked "pool core cargo fmt" {
        cargo fmt --manifest-path $Manifest -- --check
    }

    Invoke-Checked "pool core cargo test" {
        cargo test --manifest-path $Manifest -- --test-threads=1
    }

    Write-Host "POOL CORE TEST GATE PASSED"
}
finally {
    Pop-Location
}
