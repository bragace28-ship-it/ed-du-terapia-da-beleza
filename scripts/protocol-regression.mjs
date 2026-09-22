import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const index = await readFile('index.html','utf8');
const lock = JSON.parse(await readFile('V33_VISUAL_LOCK.json','utf8'));
const bytes = Buffer.from(index,'utf8');
const blob = createHash('sha1').update(Buffer.from('blob '+bytes.length+'\\0')).update(bytes).digest('hex');
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(blob, lock.gitBlobSha);
assert.equal(sha256, lock.sha256);
assert.doesNotMatch(index, /https?:\\/\\/[^"'\\s]*supabase|@supabase|VITE_SUPABASE|supabase\\.co/i);
assert.doesNotMatch(index, /vercel\.app/i);

const matrix = await readFile('docs/BLOCO_01_MATRIZ_V33.md','utf8');
const ids = [...matrix.matchAll(/^\|\s*(\d{3})\s*\|/gm)].map(m => m[1]);
assert.equal(new Set(ids).size, 86);
assert.deepEqual(ids, Array.from({length:86}, (_,i)=>String(i+1).padStart(3,'0')));

const runtime = await readFile('runtime/v33-entry.js','utf8');
for (const name of [
  'v33-auth-pin.js',
  'v33-block03-comandas.js',
  'v33-block04-gateways.js',
  'v33-block06-08-agenda-financeiro.js',
  'v33-block09-17-platform-core.js'
]) assert.ok(runtime.includes(name));

const sources = await Promise.all([
  'runtime/v33-auth-pin.js',
  'runtime/v33-block03-comandas.js',
  'runtime/v33-block04-gateways.js',
  'runtime/v33-block06-08-agenda-financeiro.js',
  'runtime/v33-block09-17-platform-core.js'
].map(p=>readFile(p,'utf8')));
const all = sources.join('\\n');
assert.doesNotMatch(all, /document\.write|innerHTML|outerHTML|insertAdjacentHTML|\.style\s*=|location\.replace/);
assert.match(all, /HOMOLOGATION_ACCESS\\s*=\\s*true/);

const build = await readFile('scripts/build.mjs','utf8');
assert.match(build, /cloudflare-production/);
assert.match(build, /homologation login\\/PIN bypass must be disabled/);

console.log('BLOCK 18 REGRESSION: PASS — 86/86 matrix ids, immutable V33, runtime firewall and production bypass gate verified');
