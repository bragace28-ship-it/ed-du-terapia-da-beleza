import {readFile} from 'node:fs/promises';

const html = await readFile('dist/index.html','utf8');
const release = JSON.parse(await readFile('dist/version.json','utf8'));
const legacyFree=html.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi,'');

if (/(?:V33|v33|fin33|eddu_v33)/i.test(legacyFree))
  throw new Error('Legacy version reference found in built Master artifact.');

for (const token of ['ED & DU','Terapia da Beleza']) {
  if (!html.includes(token)) throw new Error('Required Master marker missing: '+token);
}
if (release.runtimeAuthority !== 'MASTER_ONLY' || release.artifact !== 'MASTER')
  throw new Error('Release identity is not canonical Master.');
if (/sk_(?:live|test)_[A-Za-z0-9_-]{12,}/i.test(html))
  throw new Error('Stripe secret-like credential found in executable frontend code.');
if (/\$aact_(?:prod|hmlg)_[A-Za-z0-9_-]{12,}/i.test(html))
  throw new Error('Asaas secret-like credential found in executable frontend code.');
if (Buffer.byteLength(html) < 3000000)
  throw new Error('Canonical Master build is unexpectedly small.');

console.log('ED&DU Master static QA: PASS');
console.log('Canonical artifact:', release.artifact);
console.log('Runtime authority:', release.runtimeAuthority);
