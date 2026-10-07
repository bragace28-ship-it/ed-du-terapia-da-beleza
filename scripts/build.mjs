import {rm,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=process.cwd();
const dist=resolve(root,'dist');
const masterSource=resolve(root,'master','index.html');
const lock=JSON.parse(await readFile(resolve(root,'MASTER_APPROVED_LOCK.json'),'utf8'));
const html=await readFile(masterSource,'utf8');
const sourceBytes=Buffer.from(html,'utf8');
const sourceBlob=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length+'\0','utf8')).update(sourceBytes).digest('hex');
if(sourceBlob!==lock.master_index_git_blob_sha) throw new Error('MASTER APPROVED LOCK FAILED: master/index.html changed from the approved artifact.');
if(!html.includes('ED & DU')||!html.includes('Terapia da Beleza')) throw new Error('Required ED & DU branding missing.');
const stripEmbeddedDataImages=s=>s.replace(/data:image\\/[^;]+;base64,[A-Za-z0-9+/=]+/gi,'');
const legacyFree=stripEmbeddedDataImages(html);
if(/(?:V33|v33|fin33|eddu_v33)/i.test(legacyFree)) throw new Error('Legacy V33 reference found in Master source.');
if(/@supabase|VITE_SUPABASE|supabase\\.co/i.test(legacyFree)) throw new Error('Legacy Supabase reference found in Master UI.');

if(process.argv.includes('--check')){
  console.log('MASTER APPROVED LOCK: PASS');
  process.exit(0);
}

let output=html;
const runtimeFiles=[
  'master/runtime-functional-hotfix.js',
  'master/runtime-homologation.js',
  'master/runtime-hardening.js',
  'master/runtime-fixes.js',
  'master/runtime-navigation-hardening.js',
  'master/runtime-navigation-bridge.js',
  'master/runtime-command-gateway.js',
  'master/runtime-real-checkout.js',
  'master/neon-live-bridge.js'
];
for(const file of runtimeFiles){
  const code=await readFile(resolve(root,file),'utf8');
  if(/(?:V33|v33|fin33|eddu_v33)/i.test(stripEmbeddedDataImages(code))) throw new Error('Legacy V33 reference found in '+file);
  if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(code)) throw new Error('Legacy Supabase reference found in '+file);
  output=output.replace('</body>','<script>'+code+'\n</script></body>');
}
const authClient=await readFile(resolve(root,'master','neon-auth-client.js'),'utf8');
output=output.replace('</body>','<script type="module">'+authClient+'\n</script></body>');

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await writeFile(resolve(dist,'index.html'),output,'utf8');

const built=await readFile(resolve(dist,'index.html'),'utf8');
const builtBytes=Buffer.from(built,'utf8');
const builtSha=createHash('sha256').update(builtBytes).digest('hex');
if(builtBytes.length<3000000) throw new Error('MASTER build output is unexpectedly small.');
await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\n');
await writeFile(resolve(dist,'_routes.json'),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await writeFile(resolve(dist,'version.json'),JSON.stringify({
  version:lock.canonical_release,
  name:'ED & DU | Terapia da Beleza',
  runtimeAuthority:'MASTER_ONLY',
  artifact:'MASTER',
  sourceGitBlobSha:sourceBlob,
  builtSha256:builtSha,
  legacyRuntime:'DISABLED'
},null,2));
const distFiles=await readdir(dist);
const allowed=new Set(['index.html','_redirects','_routes.json','version.json']);
if(distFiles.length!==4||distFiles.some(x=>!allowed.has(x))) throw new Error('Unexpected dist files: '+distFiles.join(','));
console.log('Built canonical Master only.');
