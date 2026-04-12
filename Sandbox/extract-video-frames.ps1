#Requires -Version 5.1
param(
    [Parameter(Mandatory = $true)]
    [string]$InputVideo,

    [Parameter(Mandatory = $false)]
    [string]$OutputDir = ".\frames",

    [Parameter(Mandatory = $false)]
    [string]$OutputPrefix = "frame",

    [Parameter(Mandatory = $false)]
    [double]$Fps = 0
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw "Missing required command: ffmpeg"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptDir

$inputAbs = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $InputVideo))
if (-not (Test-Path -LiteralPath $inputAbs)) {
    throw "Input video not found: $inputAbs"
}

$outDirAbs = [System.IO.Path]::GetFullPath((Join-Path $scriptDir $OutputDir))
if (-not (Test-Path -LiteralPath $outDirAbs)) {
    New-Item -ItemType Directory -Path $outDirAbs | Out-Null
}

$prefix = ($OutputPrefix -replace "[^a-zA-Z0-9_-]+", "")
if ([string]::IsNullOrWhiteSpace($prefix)) { $prefix = "frame" }
$outputPattern = Join-Path $outDirAbs "$prefix-%05d.png"

if ($Fps -gt 0) {
    & ffmpeg -y -i $inputAbs -vf "fps=$Fps" $outputPattern
}
else {
    & ffmpeg -y -i $inputAbs $outputPattern
}

if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg frame extraction failed."
}

Write-Host "Extracted frames to: $outDirAbs"
Write-Host "Pattern: $outputPattern"
