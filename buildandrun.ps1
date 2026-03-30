#Requires -Version 5.1
<#
.SYNOPSIS
  Build and run the Triangle MAUI app on Windows Desktop (unpackaged WinUI).
#>
param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Debug'
)

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    Write-Error 'This script targets Windows Desktop (net10.0-windows). Run on Windows.'
}

$repoRoot = $PSScriptRoot
$csproj = Join-Path $repoRoot 'TriangleGame\TriangleGame.csproj'
$winTfm = 'net10.0-windows10.0.19041.0'

if (-not (Test-Path -LiteralPath $csproj)) {
    Write-Error "Project not found: $csproj"
}

Set-Location -LiteralPath $repoRoot

Write-Host "`n[1/2] dotnet build ($winTfm, $Configuration)" -ForegroundColor Cyan
dotnet build $csproj -c $Configuration -f $winTfm
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n[2/2] dotnet run (Windows)" -ForegroundColor Cyan
dotnet run --project $csproj -c $Configuration -f $winTfm --no-build
exit $LASTEXITCODE