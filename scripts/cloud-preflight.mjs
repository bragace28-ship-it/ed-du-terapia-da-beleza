import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root=process.cwd();

const required=[
  'master/index.html',
  'master/FEATURE_MATRIX_86.json',
  'master/neon-auth-client.js',
  'master/neon-live-bridge.js',
  'master/runtime-command-gateway.js',
  'master/runtime-real-checkout.js',
  'functions/api/health.js',
  'functions/api/payments.js',
  'functions/api/webhooks/asaas.js'
];

for(const p of required) await access(resolve(p));

const lock=JSON.parse(await readFile(resolve(root,'MASTER_APPROVED_LOCK.json'),'utf8'));
const html=await readFile(resolve(root,'master','index.html'),'utf8');
const matrix=JSON.parse(await readFile(resolve(root,'master','FEATURE_MATRIX_86.json'),'utf8'));

if(matrix.count!==86 || matrix.items?.length!==86 || matrix.items.some((x,i)=>x.id!==String(i+1).padStart(3,'0')))
  throw new Error('MASTER-86 MATRIX FAILED');

const stripEmbeddedDataImages=s=>s.replace(/data:image\\/[^;]+;base64,[A-Za-z0-9+/=]+/gi,'');
const legacyFree=stripEmbeddedDataImages(html);

if(/(?:V33|v33|fin33|eddu_v33)/i.test(legacyFree))
  throw new Error('Legacy version reference found in Master source.');
if(/@supabase|VITE_SUPABASE|supabase\\.co/i.test(legacyFree))
  throw new Error('Legacy Supabase reference found in Master source.');

const agendaDecl=html.indexOf('const agendaDataM={};');
const agendaSync=html.indexOf('syncAgendaCalendarM();');
if(agendaDecl<0 || agendaSync<0 || agendaDecl>agendaSync)
  throw new Error('Agenda initialization order invalid.');

const qa=spawnSync(process.execPath,['scripts/qa.mjs'],{encoding:'utf8'});
if(qa.status!==0){
  process.stdout.write(qa.stdout||'');
  process.stderr.write(qa.stderr||'');
  throw new Error('Static QA failed');
}

const requiredRuntime=[
  'NEON_DATABASE_URL',
  'ASAAS_API_KEY',
  'ASAAS_WEBHOOK_TOKEN',
  'PAGBANK_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'PICPAY_CLIENT_ID',
  'PICPAY_CLIENT_SECRET',
  'PICPAY_WEBHOOK_TOKEN',
  'NUPAY_MERCHANT_KEY',
  'NUPAY_MERCHANT_TOKEN'
];

const missing=requiredRuntime.filter(k=>!process.env[k]);
const allow=process.env.ALLOW_PRODUCTION_DEPLOY==='1';
console.log(JSON.stringify({
  ok:missing.length===0,
  artifact:'MASTER',
  release:lock.canonical_release,
  matrix:86,
  missingRuntimeSecrets:missing,
  allowProductionDeploy:allow
},null,2));

if(allow && missing.length) throw new Error('Production deployment blocked: required Master runtime secrets are missing: '+missing.join(', '));
