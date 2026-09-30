import {rm,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';

const root=process.cwd();
const dist=resolve(root,'dist');
const v33Source=resolve(root,'index.html');
const masterSource=resolve(root,'master','index.html');
const lock=JSON.parse(await readFile(resolve(root,'V33_VISUAL_LOCK.json'),'utf8'));
const deployMaster=process.env.MASTER_DEPLOY==='1';
const source=deployMaster?masterSource:v33Source;

const v33=await readFile(v33Source,'utf8');
const html=await readFile(source,'utf8');
const v33Bytes=Buffer.from(v33,'utf8');
const v33Blob=createHash('sha1').update(Buffer.from('blob '+v33Bytes.length+'\0','utf8')).update(v33Bytes).digest('hex');
const v33Sha=createHash('sha256').update(v33Bytes).digest('hex');

if(v33Bytes.length!==lock.byteLength||v33Blob!==lock.gitBlobSha||v33Sha!==lock.sha256)
  throw new Error('V33 VISUAL LOCK FAILED: immutable baseline changed.');

if(!html.includes('ED & DU')||!html.includes('Terapia da Beleza'))
  throw new Error('Required ED & DU branding missing.');

if(deployMaster){
  // Repair the legacy Master V46 artifact's duplicated script/body bridge before browser parsing.
  // The first IIFE already closes before this bridge; everything through the legacy report assignment is stale glue.
  const bridgeAt=html.indexOf('</script>',html.indexOf('<script id="v48-final-functional-fixes">'));
  const bridgeEnd=html.indexOf('window.v8PrintReport=window.v47PrintFinancialReport;',bridgeAt);
  if(bridgeAt>=0 && bridgeEnd>bridgeAt){
    html=html.slice(0,bridgeAt)+'\\n'+html.slice(bridgeEnd+'window.v8PrintReport=window.v47PrintFinancialReport;'.length);
  }
}

if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(html))
  throw new Error('Legacy Supabase reference found.');

if(!deployMaster){
  const sourceBytes=Buffer.from(html,'utf8');
  const sourceBlob=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length+'\0','utf8')).update(sourceBytes).digest('hex');
  if(sourceBlob!==lock.gitBlobSha) throw new Error('V33 build source is not the immutable baseline.');
}

if(process.argv.includes('--check')){
  console.log('V33 VISUAL LOCK: PASS');
  process.exit(0);
}

let output=html;
if(deployMaster){
  const runtimeFiles=[
    'master/v49-final-functional-hotfix.js',
    'master/v46-final-homologation-runtime.js',
    'master/v46-final-hardening.js',
    'master/v46-runtime-fixes.js',
    'master/v48-navigation-hardening.js'
  ];
  for(const file of runtimeFiles){
    const code=await readFile(resolve(root,file),'utf8');
    if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(code))
      throw new Error('Legacy Supabase reference found in '+file);
    output=output.replace('</body>','<script>'+code+'\n</script></body>');
  }
}

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await writeFile(resolve(dist,'index.html'),output,'utf8');

const built=await readFile(resolve(dist,'index.html'),'utf8');
const builtBytes=Buffer.from(built,'utf8');
const builtBlob=createHash('sha1').update(Buffer.from('blob '+builtBytes.length+'\0','utf8')).update(builtBytes).digest('hex');
const builtSha=createHash('sha256').update(builtBytes).digest('hex');

if(!deployMaster&&(builtBytes.length!==lock.byteLength||builtBlob!==lock.gitBlobSha))
  throw new Error('V33 build output does not match immutable baseline.');

if(deployMaster&&(builtBytes.length<3000000||builtBlob===lock.gitBlobSha))
  throw new Error('MASTER deployment output is not a distinct V46 artifact.');

await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\n');
await writeFile(resolve(dist,'version.json'),JSON.stringify({
  version:deployMaster?'46.0.0':lock.version,
  name:'ED & DU | Terapia da Beleza',
  visualBaseline:'IMMUTABLE-V33',
  runtimeArtifact:deployMaster?'MASTER-V46':'V33',
  sourceSha256:deployMaster?createHash('sha256').update(Buffer.from(html,'utf8')).digest('hex'):lock.sha256,
  builtSha256:builtSha,
  v33GitBlobSha:lock.gitBlobSha,
  v33Sha256:lock.sha256
},null,2));

const distFiles=await readdir(dist);
const allowed=new Set(['index.html','_redirects','version.json']);
if(distFiles.length!==3||distFiles.some(x=>!allowed.has(x)))
  throw new Error('Unexpected dist files: '+distFiles.join(','));

console.log(deployMaster?'Built Master V46.':'Built approved V33.');
