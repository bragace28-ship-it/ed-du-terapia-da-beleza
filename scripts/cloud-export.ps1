$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

param(
  [string]$ProjectRef = 'cwdpwfzsasdsetthmpoa',
  [string]$BackupDir = './backup/cloud-export'
)

Write-Host '=== ED & DU | CONTROLLED CLOUD EXPORT ===' -ForegroundColor Cyan
Write-Host 'This script exports data/schema/functions. It does NOT reset or delete the Cloud project.' -ForegroundColor Yellow

if (!(Get-Command npx -ErrorAction SilentlyContinue)) { throw 'Node/npm não encontrado.' }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
New-Item -ItemType Directory -Force -Path "$BackupDir/functions" | Out-Null

npx supabase --version
npx supabase link --project-ref $ProjectRef

Write-Host '[1/5] Migration inventory...' -ForegroundColor Cyan
npx supabase migration list | Tee-Object -FilePath "$BackupDir/migration-list.txt"

Write-Host '[2/5] Schema export...' -ForegroundColor Cyan
npx supabase db dump --linked -f "$BackupDir/schema.sql"

Write-Host '[3/5] Data export...' -ForegroundColor Cyan
npx supabase db dump --linked --data-only --use-copy -f "$BackupDir/data.sql"

Write-Host '[4/5] Edge Functions export...' -ForegroundColor Cyan
$functions = @(
  'create-stripe-checkout','stripe-webhook','create-pix-charge',
  'pagbank-webhook','picpay-webhook','create-asaas-checkout','asaas-webhook'
)
foreach ($fn in $functions) {
  npx supabase functions download $fn --project-ref $ProjectRef --output-dir "supabase/functions/$fn"
}

Write-Host '[5/5] Backup verification...' -ForegroundColor Cyan
$required = @("$BackupDir/schema.sql", "$BackupDir/data.sql", "$BackupDir/migration-list.txt")
foreach ($file in $required) {
  if (!(Test-Path $file)) { throw "Backup ausente: $file" }
  if ((Get-Item $file).Length -lt 10) { throw "Backup vazio ou inválido: $file" }
}

Get-ChildItem $BackupDir -Recurse -File | Get-FileHash -Algorithm SHA256 | Export-Csv "$BackupDir/SHA256SUMS.csv" -NoTypeInformation
Write-Host '[PASS] Exportação controlada concluída. NÃO apagar o Cloud ainda.' -ForegroundColor Green
