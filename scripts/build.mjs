import {rm,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=process.cwd();
const dist=resolve(root,'dist');
const v33Source=resolve(root,'index.html');
const masterSource=resolve(root,'master','index.html');
const lock=JSON.parse(await readFile(resolve(root,'V33_VISUAL_LOCK.json'),'utf8'));
const deployMaster=process.env.MASTER_DEPLOY==='1';
const source=deployMaster?masterSource:v33Source;
const v33=await readFile(v33Source,'utf8');
let html=await readFile(source,'utf8');
const v33Bytes=Buffer.from(v33,'utf8');
const v33Blob=createHash('sha1').update(Buffer.from('blob '+v33Bytes.length+'\0','utf8')).update(v33Bytes).digest('hex');
const v33Sha=createHash('sha256').update(v33Bytes).digest('hex');
if(v33Bytes.length!==lock.byteLength||v33Blob!==lock.gitBlobSha||v33Sha!==lock.sha256) throw new Error('V33 VISUAL LOCK FAILED: immutable baseline changed.');
if(!html.includes('ED & DU')||!html.includes('Terapia da Beleza')) throw new Error('Required ED & DU branding missing.');
if(deployMaster){
  const v48Start=html.indexOf('<script id="v48-final-functional-fixes">');
  const v48End=v48Start>=0?html.lastIndexOf('</script>'):-1;
  if(v48Start>=0&&v48End>v48Start) html=html.slice(0,v48Start)+html.slice(v48End+'<\\/script>'.length);
}
if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(html)) throw new Error('Legacy Supabase reference found.');
if(!deployMaster){
  const sourceBytes=Buffer.from(html,'utf8');
  const sourceBlob=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length+'\0','utf8')).update(sourceBytes).digest('hex');
  if(sourceBlob!==lock.gitBlobSha) throw new Error('V33 build source is not the immutable baseline.');
}
if(process.argv.includes('--check')){console.log('V33 VISUAL LOCK: PASS');process.exit(0);}
let output=html;
if(deployMaster){
  const runtimeFiles=[
    'master/v49-final-functional-hotfix.js',
    'master/v46-final-homologation-runtime.js',
    'master/v46-final-hardening.js',
    'master/v46-runtime-fixes.js',
    'master/v48-navigation-hardening.js',
    'master/v50-navigation-final-bridge.js',
    'master/v51-command-close-gateway-bridge.js',
    'master/v52-real-checkout-bridge.js',
    'master/neon-live-bridge.js'
  ];
  for(const file of runtimeFiles){
    const code=await readFile(resolve(root,file),'utf8');
    if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(code)) throw new Error('Legacy Supabase reference found in '+file);
    output=output.replace('</body>','<script>'+code+'\n</script></body>');
  }
  const authClient=await readFile(resolve(root,'master','neon-auth-client.js'),'utf8');
  output=output.replace('</body>','<script type="module">'+authClient+'\n</script></body>');
}
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await writeFile(resolve(dist,'index.html'),output,'utf8');
const built=await readFile(resolve(dist,'index.html'),'utf8');
const builtBytes=Buffer.from(built,'utf8');
const builtBlob=createHash('sha1').update(Buffer.from('blob '+builtBytes.length+'\0','utf8')).update(builtBytes).digest('hex');
const builtSha=createHash('sha256').update(builtBytes).digest('hex');
if(!deployMaster&&(builtBytes.length!==lock.byteLength||builtBlob!==lock.gitBlobSha)) throw new Error('V33 build output does not match immutable baseline.');
if(deployMaster&&(builtBytes.length<3000000||builtBlob===lock.gitBlobSha)) throw new Error('MASTER deployment output is not a distinct V46 artifact.');
await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\n');
await writeFile(resolve(dist,'_routes.json'),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await writeFile(resolve(dist,'version.json'),JSON.stringify({version:deployMaster?'46.0.0':lock.version,name:'ED & DU | Terapia da Beleza',visualBaseline:'IMMUTABLE-V33',runtimeArtifact:deployMaster?'MASTER-V46':'V33',sourceSha256:deployMaster?createHash('sha256').update(Buffer.from(html,'utf8')).digest('hex'):lock.sha256,builtSha256:builtSha,v33GitBlobSha:lock.gitBlobSha,v33Sha256:lock.sha256},null,2));
const distFiles=await readdir(dist);
const allowed=new Set(['index.html','_redirects','_routes.json','version.json']);
if(distFiles.length!==4||distFiles.some(x=>!allowed.has(x))) throw new Error('Unexpected dist files: '+distFiles.join(','));
console.log(deployMaster?'Built Master V46 with Neon bridge.':'Built approved V33.');