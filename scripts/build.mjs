import {rm,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const dist=resolve(root,'dist');
const masterSource=resolve(root,'master','index.html');
const lock=JSON.parse(await readFile(resolve(root,'MASTER_APPROVED_LOCK.json'),'utf8'));
const html=await readFile(masterSource,'utf8');
const sourceBytes=Buffer.from(html,'utf8');
const sourceBlob=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length+'\0','utf8')).update(sourceBytes).digest('hex');
if(sourceBlob!==lock.master_index_git_blob_sha) throw new Error('MASTER APPROVED LOCK FAILED: master/index.html changed from the approved artifact.');
if(!html.includes('ED & DU')||!html.includes('Terapia da Beleza')) throw new Error('Required ED & DU branding missing.');
const stripEmbeddedDataImages=s=>s.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi,'');
const legacyFree=stripEmbeddedDataImages(html);
if(/(?:V33|v33|fin33|eddu_v33)/i.test(legacyFree)) throw new Error('Legacy version reference found in Master source.');
if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(legacyFree)) throw new Error('Legacy Supabase reference found in Master UI.');

const validationFiles=[
  'master/runtime-navigation-hardening.js',
  'master/runtime-real-checkout.js',
  'master/runtime-production-guard.js',
  'master/neon-live-bridge.js',
  'master/runtime-neon-persistence.js',
  'master/runtime-client-registration.js',
  'master/runtime-agenda-sync.js',
  'master/runtime-command-operations.js',
  'master/neon-auth-sdk-entry.js',
  'functions/api/data/[entity].js',
  'functions/api/payments.js',
  'functions/api/client/commands.js',
  'functions/api/_lib/payment-settlement.js',
  'functions/api/webhooks/asaas.js',
  'functions/api/webhooks/pagbank.js',
  'functions/api/webhooks/picpay.js',
  'functions/api/webhooks/stripe.js'
];
for(const file of validationFiles){
  const source=await readFile(resolve(root,file),'utf8');
  if(!source.trim()) throw new Error('Required production module is empty: '+file);
  const check=spawnSync(process.execPath,['--check',resolve(root,file)],{encoding:'utf8'});
  if(check.status!==0) throw new Error('JavaScript syntax validation failed for '+file+': '+(check.stderr||check.stdout||'unknown syntax error'));
}
if(!html.toLowerCase().includes('</body>')) throw new Error('MASTER HTML injection point unavailable.');

if(process.argv.includes('--check')){
  console.log('MASTER APPROVED LOCK: PASS');
  process.exit(0);
}

let output=html;
const localTitle=new RegExp('<title>[^<]*Teste Local[^<]*</title>','i');
if(!localTitle.test(output)) throw new Error('Expected local-test title marker not found; refusing ambiguous production build.');
output=output.replace(localTitle,'<title>ED & DU | Terapia da Beleza — Master 46.0.0</title>');
const viewRegistryMarker='const views={';
if(output.split(viewRegistryMarker).length!==2) throw new Error('Expected exactly one canonical Master views registry.');
output=output.replace(viewRegistryMarker,'const views=window.views={');
const stateRegistryMarker='const state={';
if(output.split(stateRegistryMarker).length!==2) throw new Error('Expected exactly one canonical Master state registry.');
output=output.replace(stateRegistryMarker,'const state=window.state={');
const localDataMarker='let testState=load(KEY,{}), data=load(DATA,{payments:[],commands:[],receivables:[],payables:[],commissions:[],logs:[],blocks:[],accounts:[],quotes:[],notifications:[],users:[],referrals:[],giftCards:[],services:[]});';
if(output.split(localDataMarker).length!==2) throw new Error('Expected exactly one Master local data bootstrap.');
output=output.replace(localDataMarker,"let testState=load(KEY,{}), data=(window.__EDDU_MASTER_LOCAL_DATA=window.data={payments:[],commands:[],receivables:[],payables:[],commissions:[],logs:[],blocks:[],accounts:[],quotes:[],notifications:[],users:[],referrals:[],giftCards:[],services:[],appointments:[],clients:[],professionals:[],products:[],financialTransactions:[]});");
output=output.replace(/Pagamento\s+em\s+modo\s+de\s+teste\s*,?\s*sem\s+cobrança\s+real/gi,'Cobrança processada pelo gateway selecionado.');
output=output.replace(/Nenhuma cobrança real é criada nesta tela\.?/gi,'As cobranças são criadas no gateway real selecionado.');

const demoAppointmentSeed=/if\s*\(!data\.appointments\.length\)\s*\{[\s\S]*?persist\(\);\s*\}/;
if(!demoAppointmentSeed.test(output)) throw new Error('Master demo appointment seed not found; refusing local fixture production.');
output=output.replace(demoAppointmentSeed,'');
const demoCommandSeed=/state\.commands=Array\.isArray\(state\.commands\)\?state\.commands:\[\];\s*if\(!state\.commands\.length\)\s*\{\s*state\.commands=\[[\s\S]*?\];\s*\}\s*state\.activeCommandId=state\.activeCommandId\|\|'CMD-001';/;
if(!demoCommandSeed.test(output)) throw new Error('Master demo command seed not found; refusing local fixture production.');
output=output.replace(demoCommandSeed,'state.commands=[]; state.activeCommandId=state.activeCommandId||null;');
if(output.includes('APT-DEMO-1')||output.includes('APT-DEMO-2')) throw new Error('Demo appointments remain in production artifact.');
const injectBeforeClosingBody=(document,markup)=>{
  const index=document.toLowerCase().lastIndexOf('</body>');
  if(index<0) throw new Error('MASTER build has no closing body tag.');
  return document.slice(0,index)+markup+document.slice(index);
};
const runtimeFiles=[
  'master/neon-live-bridge.js',
  'master/runtime-neon-persistence.js',
  'master/runtime-real-checkout.js',
  'master/runtime-production-guard.js',
  'master/runtime-navigation-hardening.js',
  'master/runtime-agenda-sync.js',
  'master/runtime-client-registration.js',
  'master/runtime-command-operations.js'
];
const runtimeBlocks=[];
for(const file of runtimeFiles){
  const code=await readFile(resolve(root,file),'utf8');
  if(/(?:V33|v33|fin33|eddu_v33)/i.test(stripEmbeddedDataImages(code))) throw new Error('Legacy version reference found in '+file);
  if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(code)) throw new Error('Legacy Supabase reference found in '+file);
  runtimeBlocks.push('<script>\n'+code+'\n</script>');
}
output=injectBeforeClosingBody(output,runtimeBlocks.join('\n'));
const authClient=await readFile(resolve(root,'master','neon-auth-client.js'),'utf8');
output=injectBeforeClosingBody(output,'<script type="module">'+authClient+'\n</script>');

await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
const sdkBuild=spawnSync('npx',['--no-install','esbuild','master/neon-auth-sdk-entry.js','--bundle','--format=esm','--platform=browser','--target=es2022','--outfile=dist/neon-auth-sdk.bundle.js'],{encoding:'utf8'});
if(sdkBuild.status!==0) throw new Error('Neon Auth SDK local bundle failed: '+(sdkBuild.stderr||sdkBuild.stdout||'unknown error'));
const sdkBundle=await readFile(resolve(dist,'neon-auth-sdk.bundle.js'),'utf8');
if(sdkBundle.length<10000 || !sdkBundle.includes('createClient')) throw new Error('Neon Auth SDK bundle is missing or incomplete.');
await writeFile(resolve(dist,'index.html'),output,'utf8');

const built=await readFile(resolve(dist,'index.html'),'utf8');
if(/Pagamento\s+em\s+modo\s+de\s+teste\s*,?\s*sem\s+cobrança\s+real/i.test(built)) throw new Error('Legacy test-payment screen remains in production artifact.');
if(!built.includes('EDDU_LIVE_PAYMENT_GUARD')) throw new Error('Production payment guard missing from built artifact.');

const inlineScripts=[...built.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
let checkedScripts=0;
for(const match of inlineScripts){
  const code=match[1];
  if(!code.trim()) continue;
  const isModule=/^<script\s+type=["']module/i.test(match[0]);
  const check=spawnSync(process.execPath,isModule?['--check','--input-type=module']:['--check'],{input:code,encoding:'utf8'});
  if(check.status!==0) throw new Error('Built inline script syntax failed (#'+(checkedScripts+1)+'): '+(check.stderr||check.stdout||'unknown syntax error'));
  checkedScripts++;
}
console.log('Built inline script syntax: PASS ('+checkedScripts+')');
const builtBytes=Buffer.from(built,'utf8');
const builtSha=createHash('sha256').update(builtBytes).digest('hex');
if(builtBytes.length<3000000) throw new Error('MASTER build output is unexpectedly small.');
await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\n');
await writeFile(resolve(dist,'_headers'),[
  '/',
  '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
  '  Pragma: no-cache',
  '/index.html',
  '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
  '  Pragma: no-cache',
  '/version.json',
  '  Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
  '  Pragma: no-cache',
  ''
].join('\n'));
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
const allowed=new Set(['index.html','_redirects','_headers','_routes.json','version.json','neon-auth-sdk.bundle.js']);
if(distFiles.length!==6||distFiles.some(x=>!allowed.has(x))) throw new Error('Unexpected dist files: '+distFiles.join(','));
console.log('Built canonical Master only.');
