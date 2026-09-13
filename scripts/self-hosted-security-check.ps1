$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host '=== ED & DU | SELF-HOSTED SECURITY CHECK ===' -ForegroundColor Cyan

$tracked = git ls-files
$forbidden = @('.env','.env.local','.env.production','.env.self-hosted')
foreach ($f in $forbidden) {
  if ($tracked -contains $f) { throw "Arquivo secreto rastreado pelo Git: $f" }
}

$patterns = @(
  'sk_live_',
  'rk_live_',
  'whsec_',
  'asaas_access_token',
  'PAGBANK_TOKEN\s*=\s*[^\r\n]+',
  'STRIPE_SECRET_KEY\s*=\s*[^\r\n]+',
  'ASAAS_API_KEY\s*=\s*[^\r\n]+'
)

$files = git ls-files | Where-Object { $_ -notmatch '(^|/)(node_modules|dist|backup)/' }
$hits = @()
foreach ($file in $files) {
  if (Test-Path $file) {
    $text = Get-Content -Raw -LiteralPath $file
    foreach ($pattern in $patterns) {
      if ($text -match $pattern) { $hits += "$file :: $pattern" }
    }
  }
}
if ($hits.Count -gt 0) {
  $hits | ForEach-Object { Write-Host "[FAIL] $_" -ForegroundColor Red }
  throw 'Possível segredo/chave encontrada no repositório.'
}

Write-Host '[OK] nenhum arquivo .env secreto rastreado' -ForegroundColor Green
Write-Host '[OK] nenhum padrão conhecido de segredo encontrado' -ForegroundColor Green
Write-Host '[NEXT] RLS, SECURITY DEFINER e search_path serão auditados após importação das migrations.' -ForegroundColor Yellow
Write-Host '[PASS] preflight de segurança' -ForegroundColor Green
