$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host '=== ED & DU | LOCAL PREFLIGHT ===' -ForegroundColor Cyan

function Check([string]$label, [scriptblock]$command) {
  try { & $command | Out-Host; Write-Host "[OK] $label" -ForegroundColor Green }
  catch { Write-Host "[FAIL] $label" -ForegroundColor Red; throw }
}

Check 'Git' { git --version }
Check 'Node.js' { node --version }
Check 'npm' { npm --version }
Check 'Docker Desktop' { docker version }
Check 'Docker Compose' { docker compose version }

if (!(Test-Path '.env')) {
  Write-Host '[BLOCK] .env nao existe. Copie .env.self-hosted.example para .env e preencha os valores locais.' -ForegroundColor Yellow
  exit 2
}

if (!(Test-Path 'package.json')) { throw 'package.json nao encontrado.' }
if (!(Test-Path 'Dockerfile')) { throw 'Dockerfile nao encontrado.' }
if (!(Test-Path 'docker-compose.yml')) { throw 'docker-compose.yml nao encontrado.' }

Write-Host '[OK] arquivos de infraestrutura encontrados' -ForegroundColor Green
Write-Host 'Proximo passo: docker compose config && docker compose build && docker compose up -d' -ForegroundColor Cyan
