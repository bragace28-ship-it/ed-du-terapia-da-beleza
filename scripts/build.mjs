import {cp, mkdir, rm, readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);

const root=process.cwd();
const dist=resolve(root,'dist');
const source=resolve(root,'index.html');
const lockPath=resolve(root,'V33_VISUAL_LOCK.json');

function applyApprovedStartup(html){
  const oldSection='<section id="financial-panel" class="screen active" aria-label="Painel Financeiro">';
  const newSection='<section id="financial-panel" class="screen" aria-label="Painel Financeiro">';
  const oldBoot="if(client) client.classList.remove('active');\n    if(professional) professional.classList.remove('active');\n    if(finance) finance.classList.add('active');\n    renderFinancialPanel();";
  const newBoot="if(client) client.classList.remove('active');\n    if(professional) professional.classList.add('active');\n    if(finance) finance.classList.remove('active');";
  if(!html.includes(oldSection)) throw new Error('V33 startup patch: financial panel active marker not found.');
  if(!html.includes(oldBoot)) throw new Error('V33 startup patch: boot block not found.');
  const financialCss='#financial-panel.screen{\n  display:block;';
  const financialCssFixed='#financial-panel.screen{\n  display:none;';
  if(!html.includes(financialCss)) throw new Error('V33 startup patch: financial CSS marker not found.');
  const roleOverride="if(professional) professional.classList.remove('active');\n    if(finance) finance.classList.toggle('active',role==='professional');";
  const roleOverrideFixed="if(professional) professional.classList.toggle('active',role==='professional');\n    if(finance) finance.classList.remove('active');";
  if(!html.includes(roleOverride)) throw new Error('V33 startup patch: financial role override not found.');
  return html.replace(oldSection,newSection).replace(oldBoot,newBoot).replace(financialCss,financialCssFixed).replace(roleOverride,roleOverrideFixed);
}

const cloudflareBranch=process.env.CF_PAGES_BRANCH;
if(cloudflareBranch && cloudflareBranch !== 'cloudflare-production') throw new Error(`CLEAN DEPLOYMENT BLOCKED: Cloudflare branch '${cloudflareBranch}' is not approved.`);

const html=await readFile(source,'utf8');
const bytes=Buffer.from(html,'utf8');
const lock=JSON.parse(await readFile(lockPath,'utf8'));

if(!html.includes('ED & DU') || !html.includes('Terapia da Beleza'))
  throw new Error('Approved V33 master not found.');

if(bytes.length !== lock.byteLength)
  throw new Error(`V33 VISUAL LOCK FAILED: byte length ${bytes.length} != ${lock.byteLength}.`);

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
const unexpectedHtml=trackedRuntimeFiles.filter(p=>p!==source);
if(unexpectedHtml.length)
  throw new Error(`V33 VISUAL LOCK FAILED: unexpected HTML runtime files: ${unexpectedHtml.join(', ')}`);

if(process.argv.includes('--check')){
  console.log('V33 VISUAL LOCK: PASS');
  console.log(`Baseline: ${lock.version} | blob ${lock.gitBlobSha} | sha256 ${lock.sha256}`);
  process.exit(0);
}

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(source,resolve(dist,'index.html'));
const builtSource=await readFile(resolve(dist,'index.html'),'utf8');
const builtSourceBytes=Buffer.from(builtSource,'utf8');
const builtSourceSha=createHash('sha1').update(Buffer.from(`blob ${builtSourceBytes.length}\0`,'utf8')).update(builtSourceBytes).digest('hex');
if(builtSourceBytes.length !== lock.byteLength || builtSourceSha !== lock.gitBlobSha)
  throw new Error(`CLEAN DEPLOYMENT BLOCKED: dist source does not exactly match immutable V33 (${builtSourceSha}).`);

// Functional startup patch only: preserve the approved visual source and open the Professional dashboard first.
const built=applyApprovedStartup(builtSource);
await writeFile(resolve(dist,'index.html'),built);

const functionalJs=resolve(root,'runtime/v33-entry.js');
const functionalCss=resolve(root,'runtime/v33-functional.css');
const functionalFiles=['runtime/v33-entry.js','runtime/v33-auth-pin.js','runtime/v33-block03-comandas.js','runtime/v33-block04-gateways.js','runtime/v33-block06-08-agenda-financeiro.js'];
const functionalSource=(await Promise.all(functionalFiles.map(async p=>readFile(resolve(root,p),'utf8')))).join('\n');
const functionalStyles=await readFile(functionalCss,'utf8');
if(/<style|document\\.write|innerHTML|outerHTML|insertAdjacentHTML|\\.style\\s*=|location\\.replace/i.test(functionalSource))
  throw new Error('V33 FUNCTIONAL FIREWALL FAILED: runtime JS contains forbidden direct visual/HTML mutation.');
if(cloudflareBranch === 'cloudflare-production' && /HOMOLOGATION_ACCESS\\s*=\\s*true/.test(functionalSource))
  throw new Error('PRODUCTION BLOCKED: homologation login/PIN bypass must be disabled before release.');
const cssSelectors=functionalStyles.split('{').slice(0,-1).map(x=>x.split('}').pop().trim()).filter(Boolean);
if(cssSelectors.some(selector=>selector.split(',').some(part=>part.trim() && !part.trim().startsWith('.eddu-fn-'))))
  throw new Error('V33 FUNCTIONAL FIREWALL FAILED: runtime CSS must be namespaced under .eddu-fn-.');

await execFileAsync(resolve(root,'node_modules','esbuild','bin','esbuild'),[functionalJs,'--bundle','--format=iife','--platform=browser','--target=es2020','--outfile='+resolve(dist,'eddu-functional-v33.js')]);
await writeFile(resolve(dist,'eddu-functional-v33.css'),functionalStyles);
const releaseHtml=await readFile(resolve(dist,'index.html'),'utf8');
const injected=releaseHtml.replace('</head>','<link rel="stylesheet" href="/eddu-functional-v33.css"></head>').replace('</body>','<script src="/eddu-functional-v33.js"></script></body>');
await writeFile(resolve(dist,'index.html'),injected);

await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\\n');
await writeFile(resolve(dist,'version.json'),JSON.stringify({
  version:lock.version,
  name:'ED & DU | Terapia da Beleza',
  visualBaseline:'IMMUTABLE-V33',
  gitBlobSha:lock.gitBlobSha,
  sha256:lock.sha256
}));
const distFiles=await readdir(dist);
const expectedDistFiles=new Set(['index.html','_redirects','version.json','eddu-functional-v33.js','eddu-functional-v33.css']);
if(distFiles.length !== expectedDistFiles.size || distFiles.some(name=>!expectedDistFiles.has(name)))
  throw new Error(`CLEAN DEPLOYMENT BLOCKED: dist contains unexpected files: ${distFiles.join(', ')}`);

console.log('Built approved V33 master.');
