# Run once after: gh auth login
# Optional: .\push-to-github.ps1 -RepoName my-15-puzzle
param(
  [string] $RepoName = '15-puzzle',
  [string] $Description = '15-puzzle (4x4) with A* Manhattan solver in a Web Worker (React + Vite + Tailwind)'
)

$ErrorActionPreference = 'Stop'
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
Set-Location $PSScriptRoot

cmd /c 'gh auth status >nul 2>&1'
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Log in first: gh auth login' -ForegroundColor Yellow
  exit 1
}

$hasOrigin = (git remote 2>$null) -match '^origin$'
if ($hasOrigin) {
  Write-Host 'Pushing to existing origin...'
  git push -u origin main
  exit $LASTEXITCODE
}

Write-Host "Creating GitHub repo '$RepoName' and pushing..."
gh repo create $RepoName --public --source . --remote origin --push --description $Description
