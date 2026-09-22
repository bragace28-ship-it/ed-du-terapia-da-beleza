import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const html = await readFile('index.html','utf8');

for (const token of ['ED & DU','Terapia da Beleza','eddu-production-boot']) {
  if (!html.includes(token)) throw new Error('Required production marker missing: '+token);
}

const forbidden = [
  /\.vercel\.app/i,
  /Aprovar pagamento de teste/i,
  /Pagamento em modo de teste/i,
  /approvePaymentV31/i,
  /Atendimento iniciado no modo de teste/i,
  /8 Atendimentos hoje/i,
  /4 Confirmados/i,
  /sk_live_[A-Za-z0-9_-]+/,
  /sk_test_[A-Za-z0-9_-]+/,
  /STRIPE_SECRET_KEY/i,
  /PAGBANK_TOKEN/i,
  /ASAAS_API_KEY/i,
  /ASAAS_WEBHOOK_TOKEN/i,
  /PICPAY_CLIENT_SECRET/i,
  /STRIPE_WEBHOOK_SECRET/i
];
for (const pattern of forbidden) {
  if (pattern.test(html)) throw new Error('Forbidden production source pattern: '+pattern);
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
