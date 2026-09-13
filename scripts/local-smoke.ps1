$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host '=== ED & DU | LOCAL CONTAINER SMOKE ===' -ForegroundColor Cyan

$services = docker compose ps --format json | ConvertFrom-Json
if (!$services) { throw 'Nenhum servico Docker Compose esta em execucao.' }

$bad = @($services | Where-Object { $_.State -ne 'running' })
if ($bad.Count -gt 0) {
  $bad | Format-Table Name, State, Health
  throw 'Existe servico que nao esta running.'
}

$health = (Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/healthz').Content.Trim()
if ($health -ne 'ok') { throw "healthz inesperado: $health" }

$page = (Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/').Content
if ($page.Length -lt 1000) { throw 'index.html parece incompleto.' }
if ($page -notmatch 'eddu-production-boot') { throw 'Production boot gate nao encontrado.' }

Write-Host '[OK] containers running' -ForegroundColor Green
Write-Host '[OK] /healthz' -ForegroundColor Green
Write-Host '[OK] frontend responde' -ForegroundColor Green
Write-Host '[PASS] smoke local' -ForegroundColor Green
