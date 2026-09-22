import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const html = await readFile('index.html','utf8');

for (const token of ['ED & DU','Terapia da Beleza']) {
  if (!html.includes(token)) throw new Error('Required production marker missing: '+token);
}

const scripts = [];
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
while ((match = re.exec(html))) {
  const attrs = match[1] || '';
  const body = match[2] || '';
  if (/type\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(attrs)) continue;
  if (!body.trim()) continue;
  scripts.push(body);
}
if (!scripts.length) throw new Error('No executable inline script found.');

const visible = html
  .replace(/<script\b[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[\s\S]*?<\/style>/gi,'')
  .replace(/<!--[\s\S]*?-->/g,'')
  .replace(/<[^>]+>/g,' ')
  .replace(/\s+/g,' ');

for (const phrase of [
  'Aprovar pagamento de teste',
  'Pagamento em modo de teste',
  'approvePaymentV31',
  'Atendimento iniciado no modo de teste',
  '8 Atendimentos hoje',
  '4 Confirmados'
]) {
  if (visible.toLowerCase().includes(phrase.toLowerCase()))
    throw new Error('Legacy/demo text visible in production UI: '+phrase);
}

if (/https?:\/\/[^"'\s]*\.vercel\.app/i.test(html))
  throw new Error('Vercel publication URL found in approved production source.');

for (const body of scripts) {
  if (/sk_(?:live|test)_[A-Za-z0-9_-]{12,}/i.test(body))
    throw new Error('Stripe secret-like credential found in executable frontend code.');
  if (/\$aact_(?:prod|hmlg)_[A-Za-z0-9_-]{12,}/i.test(body))
    throw new Error('Asaas secret-like credential found in executable frontend code.');
}

const dir = await mkdtemp(join(tmpdir(), 'eddu-qa-'));
try {
  for (let i=0;i<scripts.length;i++) {
    const file = join(dir, 'script-'+i+'.js');
    await writeFile(file, scripts[i], 'utf8');
    const result = spawnSync(process.execPath, ['--check', file], {encoding:'utf8'});
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      throw new Error('Inline JavaScript syntax failure in script '+i);
    }
  }
} finally {
  await rm(dir,{recursive:true,force:true});
}

console.log('ED&DU static QA: PASS');
console.log('Inline executable scripts checked:', scripts.length);
