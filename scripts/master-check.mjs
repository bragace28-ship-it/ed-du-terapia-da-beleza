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
  throw new Error('Legacy version reference found in Master source.');
if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(legacyFree))
  throw new Error('Legacy Supabase reference found in Master source.');
const agendaDecl=html.indexOf('const agendaDataM={};');
const agendaSync=html.indexOf('syncAgendaCalendarM();');
if(agendaDecl<0 || agendaSync<0 || agendaDecl>agendaSync)
  throw new Error('Agenda initialization order invalid: sync runs before agendaDataM exists.');

const required=['agendaAppointmentsM','saveAgendaAddM','saveAgendaEditM','saveAgendaBlockM','appointmentConflictM','blockConflictM','views.agenda'];
for(const marker of required)
  if(!html.includes(marker)) throw new Error('MASTER missing required Agenda marker: '+marker);

const agendaRuntime=await readFile(resolve(root,'master','runtime-homologation.js'),'utf8');
if(!agendaRuntime.includes("Agendado:'confirmed'") || !agendaRuntime.includes("Pendente:'requested'"))
  throw new Error('MASTER agenda status mapping does not match the Neon appointments constraint.');
if(/insert\(\{[^}]*\bsource\s*:/.test(agendaRuntime))
  throw new Error('MASTER appointment insert contains a field not present in the Neon appointments schema.');
const appointmentMigration=await readFile(resolve(root,'db','007_master_v46_appointments_service_fk.sql'),'utf8');
if(!/add column if not exists service_id uuid/i.test(appointmentMigration) || !/foreign key \(service_id\) references public\.services\(id\)/i.test(appointmentMigration))
  throw new Error('MASTER appointment service relationship migration is incomplete.');
const neonBridge=await readFile(resolve(root,'master','neon-live-bridge.js'),'utf8');
for(const marker of ['async function pushNewAgendaBlocks','await pushNewAgendaBlocks()','data.blocks=d.map(dbAgendaBlockToUi)',"wrapMutation('saveAgendaBlockDayM')"])
  if(!neonBridge.includes(marker)) throw new Error('MASTER agenda-block Neon sync is missing: '+marker);
const blockDayStart=agendaRuntime.indexOf('window.saveAgendaBlockDayM=function');
const blockDayEnd=agendaRuntime.indexOf('};',blockDayStart);
const blockDaySource=blockDayStart>=0&&blockDayEnd>blockDayStart?agendaRuntime.slice(blockDayStart,blockDayEnd):'';
if(!blockDaySource.includes('eddu_master_data_v1')||blockDaySource.includes("getItem('eddu_data')"))
  throw new Error('MASTER full-day block must use the canonical Neon sync queue.');

const runtimeFiles=[
  'master/runtime-functional-hotfix.js',
  'master/runtime-homologation.js',
  'master/runtime-hardening.js',
  'master/runtime-fixes.js',
  'master/runtime-navigation-hardening.js',
  'master/runtime-navigation-bridge.js',
  'master/runtime-render-guard.js',
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
    throw new Error('Legacy version reference found in '+file);
  if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(code))
    throw new Error('Legacy Supabase reference found in '+file);
  await check(file.replace(/[^a-z0-9]+/gi,'-'),code);
}

await rm(dir,{recursive:true,force:true});
console.log('MASTER CHECK: PASS | htmlScripts='+blocks.length+' | runtimeFiles='+runtimeFiles.length+' | apiFiles='+apiFiles.length+' | matrix=86 | bytes='+Buffer.byteLength(html));
