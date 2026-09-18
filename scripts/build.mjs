import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=process.cwd(), dist=resolve(root,'dist'), source=resolve(root,'index.html');
const html=await readFile(source,'utf8');
if(!html.includes('ED & DU') || !html.includes('Terapia da Beleza')) throw new Error('Approved V33 master not found.');
if(/https?:\\/\\/[^"'\\s]*supabase|@supabase|VITE_SUPABASE|supabase\\.co/i.test(html)) throw new Error('Legacy Supabase reference found.');
if(process.argv.includes('--check')) { console.log('Approved V33 master: PASS'); process.exit(0); }
await mkdir(dist,{recursive:true});
await cp(source,resolve(dist,'index.html'));
await writeFile(resolve(dist,'_redirects'),'/* /index.html 200\\n');
await writeFile(resolve(dist,'version.json'),JSON.stringify({version:'33.0.0',name:'ED & DU | Terapia da Beleza'}));
console.log('Built approved V33 master.');