import {readFile,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';

const root=process.cwd();
const html=await readFile(resolve(root,'master','index.html'),'utf8');
const matrix=JSON.parse(await readFile(resolve(root,'master','FEATURE_MATRIX_86.json'),'utf8'));
if(matrix.count!==86 || matrix.items?.length!==86 || matrix.items.some((x,i)=>x.id!==String(i+1).padStart(3,'0')))
  throw new Error('MASTER-86 MATRIX FAILED: expected exactly IDs 001-086.');
if(html.length<3000000) throw new Error('MASTER V46 artifact unexpectedly small.');
if(/@supabase|VITE_SUPABASE|supabase\\.co/i.test(html)) throw new Error('Legacy Supabase reference found in Master V46.');
const required=['agendaAppointmentsM','saveAgendaAddM','saveAgendaEditM','saveAgendaBlockM','appointmentConflictM','blockConflictM','views.agenda'];
for(const marker of required) if(!html.includes(marker)) throw new Error('MASTER V46 missing required Agenda marker: '+marker);
const blocks=[...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
const dir=resolve(tmpdir(),'eddu-master-v46-check');
await rm(dir,{recursive:true,force:true}); await import('node:fs/promises').then(fs=>fs.mkdir(dir,{recursive:true}));
for(let i=0;i<blocks.length;i++){
  const p=resolve(dir,\`script-${i+1}.js\`);
  await writeFile(p,blocks[i]);
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0) throw new Error(\`MASTER V46 JS SYNTAX FAILED in script ${i+1}: ${r.stderr||r.stdout}\`);
}
await rm(dir,{recursive:true,force:true});
console.log(\`MASTER V46 CHECK: PASS | scripts=${blocks.length} | matrix=86 | bytes=${Buffer.byteLength(html)}\`);
