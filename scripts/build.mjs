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
const visiblePart=s=>s.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'');
const v33Bytes=Buffer.from(v33,'utf8');
const v33Blob=createHash('sha1').update(Buffer.from('blob '+v33Bytes.length+'\0','utf8')).update(v33Bytes).digest('hex');
const v33Sha=createHash('sha256').update(v33Bytes).digest('hex');
if(v33Bytes.length!==lock.byteLength||v33Blob!==lock.gitBlobSha||v33Sha!==lock.sha256) throw new Error('V33 VISUAL LOCK FAILED: immutable baseline changed.');
if(!html.includes('ED & DU')||!html.includes('Terapia da Beleza')) throw new Error('Required ED & DU branding missing.');

if(deployMaster){
  const v48Start=html.indexOf('<script id="v48-final-functional-fixes">');
  const v48End=v48Start>=0?html.lastIndexOf('</script>'):-1;
  if(v48Start>=0&&v48End>v48Start) html=html.slice(0,v48Start)+html.slice(v48End+'<\\/script>'.length);
  const bodyEnd=html.toLowerCase().lastIndexOf('</body>');
  const htmlEnd=html.toLowerCase().lastIndexOf('</html>');
  if(bodyEnd>=0&&htmlEnd>bodyEnd){
    const between=html.slice(bodyEnd+7,htmlEnd);
    if(/(?:window\.|function\s*\(|const\s+|=>|v8PrintReport|v46DownloadFinancialReport)/.test(between)) html=html.slice(0,bodyEnd+7)+'\n</html>';
  }
  const end=html.toLowerCase().lastIndexOf('</html>');
  if(end>=0 && /(?:window\.|function\s*\(|const\s+|=>|v8PrintReport|v46DownloadFinancialReport)/.test(html.slice(end+7))) html=html.slice(0,end+7);
  if(/(?:window\.(?:v8PrintReport|v46DownloadFinancialReport|EDDU_MASTER_V46_FINAL_RUNTIME)\s*=|document\.addEventListener\([^)]*=>|function\s+renderMaster\s*\(|function\s+masterMessage\s*\(|document\.close\(\)|pass\(id,)/.test(visiblePart(html))) throw new Error('MASTER source still contains visible JavaScript text; refusing malformed build.');
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
  // Homologation must never ship the V33 demo commercial metrics as if they were real.
  // Keep the approved markup/layout intact; replace only the seeded display values.
  output=output.replace(/R\\$ 1\\.280([\\s\\S]{0,800}?)18%([\\s\\S]{0,800}?)R\\$ 7\\.000([\\s\\S]{0,800}?)R\\$ 5\\.720 para atingir a meta 🎯 · toque para abrir o painel comercial/u,
    'R$ 0,00$10%$2R$ 0,00$3Meta mensal não configurada · toque para abrir o painel comercial');
  const runtimeFiles=['master/v49-final-functional-hotfix.js','master/v46-final-homologation-runtime.js','master/v46-final-hardening.js','master/v46-runtime-fixes.js','master/v48-navigation-hardening.js','master/v50-navigation-final-bridge.js','master/neon-live-bridge.js'];
  const runtimeTags=[];
  const utf8Eval=(encoded)=>'(function(){try{const b=atob('+JSON.stringify(encoded)+');const bytes=Uint8Array.from(b,c=>c.charCodeAt(0));const code=new TextDecoder("utf-8").decode(bytes);(0,eval)(code);}catch(e){console.error("EDDU Master runtime load failed:",e);}})();';
  for(const file of runtimeFiles){
    const code=await readFile(resolve(root,file),'utf8');
    if(/@supabase|VITE_SUPABASE|supabase\.co/i.test(code)) throw new Error('Legacy Supabase reference found in '+file);
    const encoded=Buffer.from(code,'utf8').toString('base64');
    runtimeTags.push('<script>'+utf8Eval(encoded)+'</script>');
  }
  const authClient=await readFile(resolve(root,'master','neon-auth-client.js'),'utf8');
  const authEncoded=Buffer.from(authClient,'utf8').toString('base64');
  runtimeTags.push('<script>'+utf8Eval(authEncoded).replace('EDDU Master runtime load failed','EDDU Neon Auth client load failed')+'</script>');
  // IMPORTANT: the Master source contains literal </body> inside a PDF/HTML string.
  // Never use String.replace('</body>', ...) because it would inject runtime code inside that JS string.
  // HTML parsers terminate script elements on a literal </script> even when it appears inside a JS string.
  // Escape that token inside existing script blocks before deployment so source strings cannot leak into the page.
  output=output.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(m,open,code,close)=>open+code.replace(/<\/script>/gi,'<\\/script>')+close);
  const bodyMarker='</body>';
  const bodyPos=output.toLowerCase().lastIndexOf(bodyMarker);
  if(bodyPos<0) throw new Error('MASTER source has no final </body> marker.');
  output=output.slice(0,bodyPos)+runtimeTags.join('')+output.slice(bodyPos);
  // The generated runtime tags are safe because they contain base64-decoded code and no literal closing-script tokens.
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
if(deployMaster && /(?:window\.(?:v8PrintReport|v46DownloadFinancialReport|EDDU_MASTER_V46_FINAL_RUNTIME)\s*=|document\.addEventListener\([^)]*=>|function\s+renderMaster\s*\(|function\s+masterMessage\s*\(|document\.close\(\)|pass\(id,)/.test(visiblePart(built))) throw new Error('MASTER build contains visible JavaScript outside script tags.');
await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\n');
await writeFile(resolve(dist,'_routes.json'),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await writeFile(resolve(dist,'version.json'),JSON.stringify({version:deployMaster?'46.0.0':lock.version,name:'ED & DU | Terapia da Beleza',visualBaseline:'IMMUTABLE-V33',runtimeArtifact:deployMaster?'MASTER-V46':'V33',sourceSha256:deployMaster?createHash('sha256').update(Buffer.from(html,'utf8')).digest('hex'):lock.sha256,builtSha256:builtSha,v33GitBlobSha:lock.gitBlobSha,v33Sha256:lock.sha256},null,2));
const distFiles=await readdir(dist);
const allowed=new Set(['index.html','_redirects','_routes.json','version.json']);
if(distFiles.length!==4||distFiles.some(x=>!allowed.has(x))) throw new Error('Unexpected dist files: '+distFiles.join(','));
console.log(deployMaster?'Built Master V46 with Neon bridge.':'Built approved V33.');