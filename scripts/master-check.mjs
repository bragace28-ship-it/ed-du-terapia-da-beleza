import {readFile,writeFile,rm,mkdtemp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';

const root=process.cwd();
const html=await readFile(resolve(root,'master','index.html'),'utf8');
const matrix=JSON.parse(await readFile(resolve(root,'master','FEATURE_MATRIX_86.json'),'utf8'));

if(matrix.count!==86 || matrix.items?.length!==86 || matrix.items.some((x,i)=>x.id!==String(i+1).padStart(3,'0')))
  throw new Error('MASTER-86 MATRIX FAILED: expected exactly IDs 001-086.');
if(Buffer.byteLength(html)<3000000)
  throw new Error('MASTER artifact unexpectedly small.');
const stripEmbeddedDataImages=s=>s.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi,'');
const legacyFree=stripEmbeddedDataImages(html);
if(/(?:V33|v33|fin33|eddu_v33)/i.test(legacyFree))
  throw new Error('Legacy V33 reference found in Master source.');
if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(legacyFree))
  throw new Error('Legacy Supabase reference found in Master source.');
const agendaDecl=html.indexOf('const agendaDataM={};');
const agendaSync=html.indexOf('syncAgendaCalendarM();');
if(agendaDecl<0 || agendaSync<0 || agendaDecl>agendaSync)
  throw new Error('Agenda initialization order invalid: sync runs before agendaDataM exists.');

const required=['agendaAppointmentsM','saveAgendaAddM','saveAgendaEditM','saveAgendaBlockM','appointmentConflictM','blockConflictM','views.agenda'];
for(const marker of required)
  if(!html.includes(marker)) throw new Error('MASTER missing required Agenda marker: '+marker);

const runtimeFiles=[
  'master/runtime-functional-hotfix.js',
  'master/runtime-homologation.js',
  'master/runtime-hardening.js',
  'master/runtime-fixes.js',
  'master/runtime-navigation-hardening.js',
  'master/runtime-navigation-bridge.js',
  'master/neon-live-bridge.js','master/neon-auth-client.js'
];

const apiFiles=[
  'functions/api/data/[entity].js',
  'functions/api/health.js',
  'functions/api/payments.js',
  'functions/api/webhooks/asaas.js'
];

const dir=await mkdtemp(resolve(tmpdir(),'eddu-master-v46-check-'));
let count=0;
async function check(label,code){
  const p=resolve(dir,'script-'+(++count)+'-'+label+'.js');
  await writeFile(p,code);
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0) throw new Error('JS SYNTAX FAILED in '+label+': '+(r.stderr||r.stdout));
}

const blocks=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
for(let i=0;i<blocks.length;i++) await check('html-'+(i+1),blocks[i]);

for(const file of [...runtimeFiles,...apiFiles]){
  const code=await readFile(resolve(root,file),'utf8');
  if(/(?:V33|v33|fin33|eddu_v33)/i.test(stripEmbeddedDataImages(code)))
    throw new Error('Legacy V33 reference found in '+file);
  if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(code))
    throw new Error('Legacy Supabase reference found in '+file);
  await check(file.replace(/[^a-z0-9]+/gi,'-'),code);
}

await rm(dir,{recursive:true,force:true});
console.log('MASTER CHECK: PASS | htmlScripts='+blocks.length+' | runtimeFiles='+runtimeFiles.length+' | apiFiles='+apiFiles.length+' | matrix=86 | bytes='+Buffer.byteLength(html));
