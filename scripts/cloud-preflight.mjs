import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const required=[
  'V33_VISUAL_LOCK.json',
  'index.html',
  'db/001_production_schema.sql',
  'db/002_reset_demo_data.sql',
  'functions/api/health.js',
  'functions/api/payments.js',
  'functions/api/webhooks/asaas.js'
];
for(const p of required) await access(resolve(p));

const lock=JSON.parse(await readFile('V33_VISUAL_LOCK.json','utf8'));
const html=await readFile('index.html','utf8');
const bytes=Buffer.from(html,'utf8');
if(bytes.length!==lock.byteLength) throw new Error('V33 byte-length lock failed');
if(!html.includes('ED & DU')||!html.includes('Terapia da Beleza')) throw new Error('V33 markers missing');
if(/https?:\/\/[^"'\\s]*supabase|@supabase|VITE_SUPABASE|supabase\\.co/i.test(html)) throw new Error('Supabase runtime reference found in immutable V33');

const qa=spawnSync(process.execPath,['scripts/qa.mjs'],{encoding:'utf8'});
if(qa.status!==0){
  process.stdout.write(qa.stdout||'');
  process.stderr.write(qa.stderr||'');
  throw new Error('Static QA failed');
}

const hasNeon=Boolean(process.env.NEON_DATABASE_URL);
const hasAsaas=Boolean(process.env.ASAAS_API_KEY);
const allow=process.env.ALLOW_PRODUCTION_DEPLOY==='1';
console.log(JSON.stringify({ok:true,hasNeon,hasAsaas,allowProductionDeploy:allow},null,2));
if(allow && !hasNeon) throw new Error('Production deployment blocked: NEON_DATABASE_URL secret is missing');
if(allow && !hasAsaas) throw new Error('Production deployment blocked: ASAAS_API_KEY secret is missing');
