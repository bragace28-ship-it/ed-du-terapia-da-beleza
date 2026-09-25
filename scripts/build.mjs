import {cp, mkdir, rm, readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';

const root=process.cwd();
const dist=resolve(root,'dist');
const v33Source=resolve(root,'index.html');
const masterSource=resolve(root,'master','index.html');
const deploySource=process.env.MASTER_DEPLOY === '1' ? masterSource : v33Source;
const lockPath=resolve(root,'V33_VISUAL_LOCK.json');

const cloudflareBranch=process.env.CF_PAGES_BRANCH;
if(cloudflareBranch && cloudflareBranch !== 'cloudflare-production') throw new Error(`CLEAN DEPLOYMENT BLOCKED: Cloudflare branch '${cloudflareBranch}' is not approved.`);

const v33Html=await readFile(v33Source,'utf8');
const html=await readFile(deploySource,'utf8');
const bytes=Buffer.from(html,'utf8');
const lock=JSON.parse(await readFile(lockPath,'utf8'));

if(!v33Html.includes('ED & DU') || !v33Html.includes('Terapia da Beleza'))
  throw new Error('Approved V33 visual baseline not found.');
if(process.env.MASTER_DEPLOY === '1' && (!html.includes('ED & DU') || !html.includes('Terapia da Beleza')))
  throw new Error('Master V46 artifact is missing required branding.');

const v33Bytes=Buffer.from(v33Html,'utf8');
const v33GitBlobSha=createHash('sha1').update(Buffer.from(`blob ${v33Bytes.length}\0`,'utf8')).update(v33Bytes).digest('hex');
const v33Sha256=createHash('sha256').update(v33Bytes).digest('hex');
if(v33Bytes.length !== lock.byteLength)
  throw new Error(`V33 VISUAL LOCK FAILED: byte length ${bytes.length} != ${lock.byteLength}.`);

if(v33GitBlobSha !== lock.gitBlobSha)
  throw new Error(`V33 VISUAL LOCK FAILED: repository index.html changed (blob ${v33GitBlobSha}).`);
if(lock.sha256 && v33Sha256 !== lock.sha256)
  throw new Error(`V33 VISUAL LOCK FAILED: repository index.html SHA-256 ${v33Sha256} != ${lock.sha256}.`);

const gitBlobSha=createHash('sha1')
  .update(Buffer.from(`blob ${bytes.length}\0`,'utf8'))
  .update(bytes)
  .digest('hex');

if(gitBlobSha !== lock.gitBlobSha)
  throw new Error(`V33 VISUAL LOCK FAILED: index.html is not the approved baseline (blob ${gitBlobSha}).`);

const sha256=createHash('sha256').update(bytes).digest('hex');
if(lock.sha256 && sha256 !== lock.sha256)
  throw new Error(`V33 VISUAL LOCK FAILED: SHA-256 ${sha256} != ${lock.sha256}.`);

if(/https?:\/\/[^"'\s]*supabase|@supabase|VITE_SUPABASE|supabase\.co/i.test(html))
  throw new Error('Legacy Supabase reference found.');

async function walk(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='dist') continue;
    const p=join(dir,entry.name);
    if(entry.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}
const trackedRuntimeFiles=(await walk(root)).filter(p=>/\.html?$/i.test(p));
const allowedHtml=new Set([v33Source,masterSource]);
const unexpectedHtml=trackedRuntimeFiles.filter(p=>!allowedHtml.has(p));
if(unexpectedHtml.length)
  throw new Error(`V33 VISUAL LOCK FAILED: unexpected HTML runtime files: ${unexpectedHtml.join(', ')}`);

if(process.argv.includes('--check')){
  console.log('V33 VISUAL LOCK: PASS');
  console.log(`Baseline: ${lock.version} | blob ${lock.gitBlobSha} | sha256 ${lock.sha256}`);
  process.exit(0);
}

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(deploySource,resolve(dist,'index.html'));
const built=await readFile(resolve(dist,'index.html'),'utf8');
const builtBytes=Buffer.from(built,'utf8');
const builtSha=createHash('sha1').update(Buffer.from(`blob ${builtBytes.length}\0`,'utf8')).update(builtBytes).digest('hex');
if(process.env.MASTER_DEPLOY !== '1' && (builtBytes.length !== lock.byteLength || builtSha !== lock.gitBlobSha)) throw new Error(`CLEAN DEPLOYMENT BLOCKED: dist/index.html does not exactly match immutable V33 (${builtSha}).`);
if(process.env.MASTER_DEPLOY === '1' && (builtBytes.length < 3000000 || builtSha === lock.gitBlobSha)) throw new Error('MASTER DEPLOYMENT BLOCKED: expected the distinct V46 master artifact.');
await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\\n');
await writeFile(resolve(dist,'version.json'),JSON.stringify({
  version:process.env.MASTER_DEPLOY === '1' ? '46.0.0' : lock.version,
  name:'ED & DU | Terapia da Beleza',
  visualBaseline:'IMMUTABLE-V33',
  runtimeArtifact:process.env.MASTER_DEPLOY === '1' ? 'MASTER-V46' : 'V33',
  gitBlobSha:lock.gitBlobSha,
  sha256:lock.sha256
}));
const distFiles=await readdir(dist);
const expectedDistFiles=new Set(['index.html','_redirects','version.json']);
if(distFiles.length !== expectedDistFiles.size || distFiles.some(name=>!expectedDistFiles.has(name)))
  throw new Error(`CLEAN DEPLOYMENT BLOCKED: dist contains unexpected files: ${distFiles.join(', ')}`);

console.log('Built approved V33 master.');
