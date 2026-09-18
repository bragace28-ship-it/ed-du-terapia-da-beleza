import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=process.cwd();
const dist=resolve(root,'dist');
const source=resolve(root,'index.html');
const lockPath=resolve(root,'V33_VISUAL_LOCK.json');

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

if(/https?:\\/\\/[^"'\\s]*supabase|@supabase|VITE_SUPABASE|supabase\\.co/i.test(html))
  throw new Error('Legacy Supabase reference found.');

if(process.argv.includes('--check')) {
  console.log('V33 VISUAL LOCK: PASS');
  console.log(`Baseline: ${lock.version} | blob ${lock.gitBlobSha}`);
  process.exit(0);
}

await mkdir(dist,{recursive:true});
await cp(source,resolve(dist,'index.html'));
await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\n');
await writeFile(resolve(dist,'version.json'),JSON.stringify({
  version:lock.version,
  name:'ED & DU | Terapia da Beleza',
  visualBaseline:'IMMUTABLE-V33'
}));

console.log('Built approved V33 master.');
