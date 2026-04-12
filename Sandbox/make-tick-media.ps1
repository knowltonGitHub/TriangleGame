#Requires -Version 5.1
param(
    [Parameter(Mandatory = $false)]
    [string]$InputDir = ".",

    [Parameter(Mandatory = $false)]
    [string]$Pattern = "tg_b*_tick-*.png",

    [Parameter(Mandatory = $false)]
    [double]$FrameSeconds = 0.5,

    [Parameter(Mandatory = $false)]
    [string]$OutputBase = "fall-debug",

    [Parameter(Mandatory = $false)]
    [string]$OutputDir = "."
)

$ErrorActionPreference = "Stop"

function Require-Command([string]$name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $name"
    }
}

function To-FfmpegPath([string]$path) {
    return ([System.IO.Path]::GetFullPath($path)).Replace("\", "/")
}
function Resolve-AnyPath([string]$baseDir, [string]$p) {
    if ([System.IO.Path]::IsPathRooted($p)) {
        return [System.IO.Path]::GetFullPath($p)
    }
    return [System.IO.Path]::GetFullPath((Join-Path $baseDir $p))
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $scriptDir

Require-Command "ffmpeg"

$inputDirAbs = Resolve-AnyPath $scriptDir $InputDir
if (-not (Test-Path -LiteralPath $inputDirAbs)) {
    throw "Input directory not found: $inputDirAbs"
}

$files = Get-ChildItem -File -Path $inputDirAbs -Filter $Pattern | Sort-Object Name
if (-not $files -or $files.Count -eq 0) {
    throw "No PNG files matched pattern '$Pattern' in '$inputDirAbs'."
}

$outDirAbs = Resolve-AnyPath $scriptDir $OutputDir
if (-not (Test-Path -LiteralPath $outDirAbs)) {
    New-Item -ItemType Directory -Path $outDirAbs | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$base = "$OutputBase-$stamp"
$mp4Path = Join-Path $outDirAbs "$base.mp4"
$gifPath = Join-Path $outDirAbs "$base.gif"
$listPath = Join-Path $env:TEMP ("tg-frames-" + [guid]::NewGuid().ToString("N") + ".txt")

try {
    $lines = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $files.Count; $i++) {
        $ff = To-FfmpegPath($files[$i].FullName)
        $lines.Add("file '$ff'")
        if ($i -lt $files.Count - 1) {
            $lines.Add("duration $FrameSeconds")
        }
    }
    # Repeat final frame so the last duration is respected.
    $last = To-FfmpegPath($files[$files.Count - 1].FullName)
    $lines.Add("file '$last'")
    Set-Content -LiteralPath $listPath -Value $lines -Encoding ASCII

    & ffmpeg -y -f concat -safe 0 -i $listPath -vf "fps=1/$FrameSeconds,pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p" -c:v libx264 $mp4Path
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg MP4 creation failed." }

    & ffmpeg -y -f concat -safe 0 -i $listPath -filter_complex "fps=1/$FrameSeconds,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" $gifPath
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg GIF creation failed." }
}
finally {
    if (Test-Path -LiteralPath $listPath) {
        Remove-Item -LiteralPath $listPath -Force
    }
}

Write-Host "Created MP4: $mp4Path"
Write-Host "Created GIF: $gifPath"
