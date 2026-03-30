#Requires -Version 5.1
<#
.SYNOPSIS
  Show git status, stage all changes, commit, push, show status again.
.DESCRIPTION
  Runs from the git repository root (same folder as this script).
.PARAMETER CommitMessage
  Commit message. Default is a generic sync; use -CommitMessage for specifics.
.EXAMPLE
  .\Commit-AndPush.ps1
.EXAMPLE
  .\Commit-AndPush.ps1 -CommitMessage "feat(ui): adjust main page layout"
#>
param(
    [Parameter(Mandatory = $false)]
    [string]$CommitMessage = "chore: commit pending changes (stage all, sync to remote)"
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot ".git"))) {
    Write-Error "No .git found under $repoRoot. Place this script in your repository root."
}

Set-Location -LiteralPath $repoRoot

Write-Host "`n[1/5] git status (before)" -ForegroundColor Cyan
git status

Write-Host "`n[2/5] git add -A (all pending: new, modified, deleted)" -ForegroundColor Cyan
git add -A

$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "`nNothing staged; working tree matches index. Skipping commit/push." -ForegroundColor Yellow
    Write-Host "`n[5/5] git status (final)" -ForegroundColor Cyan
    git status
    exit 0
}

Write-Host "`n[3/5] git commit" -ForegroundColor Cyan
git commit -m $CommitMessage

Write-Host "`n[4/5] git push" -ForegroundColor Cyan
git push

Write-Host "`n[5/5] git status (after)" -ForegroundColor Cyan
git status

Write-Host "`nDone." -ForegroundColor Green
