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
const pageTitle=(html.match(new RegExp('<title>([^<]*)</title>','i'))||[])[1]||'';
if (/Teste Local/i.test(pageTitle)) throw new Error('Production title still says Teste Local.');
if (/sk_(?:live|test)_[A-Za-z0-9_-]{12,}/i.test(html))
  throw new Error('Stripe secret-like credential found in executable frontend code.');
if (/\$aact_(?:prod|hmlg)_[A-Za-z0-9_-]{12,}/i.test(html))
  throw new Error('Asaas secret-like credential found in executable frontend code.');
if (Buffer.byteLength(html) < 3000000)
  throw new Error('Canonical Master build is unexpectedly small.');

console.log('ED&DU Master static QA: PASS');
console.log('Canonical artifact:', release.artifact);
console.log('Runtime authority:', release.runtimeAuthority);

if (!html.includes("Authorization: 'Bearer ' + authToken"))
  throw new Error('Neon API bridge is missing authenticated Bearer forwarding.');
if (!html.includes('EDDU_NEON_PERSIST_SNAPSHOT') || !html.includes('NEON_ONLY_INVALID_JSON'))
  throw new Error('Neon write-through persistence guard is missing from production artifact.');
console.log('Neon authenticated write-through QA: PASS');

if (!html.includes('window.__edduOpenGatewayRanking') || !html.includes('v52Checkout'))
  throw new Error('MASTER V46 real gateway ranking/checkout bridge is missing from production artifact.');
if (!html.includes('EDDU_NEON_API') || !html.includes('appointments'))
  throw new Error('MASTER V46 Neon data bridge is missing from production artifact.');
if (html.includes('Seção temporariamente indisponível'))
  throw new Error('Legacy render fallback is present in the production artifact.');
if (html.includes('v46AddTestPayment') || html.includes('eddu_master_clients_v1'))
  throw new Error('Legacy test-payment or demo-client runtime is present in the production artifact.');
console.log('MASTER V46 isolated runtime and real checkout QA: PASS');
if (!html.includes('const views=window.views={') || !html.includes('const state=window.state={')) throw new Error('Master view/state registries are not shared with functional runtimes.');
if (!html.includes('window.__EDDU_MASTER_LOCAL_DATA=window.data=') || html.includes('APT-DEMO-1') || html.includes('CMD-001')) throw new Error('Master agenda/commands still contain local demo business data.');
if (!html.includes("operation:'delete'") || !html.includes('eddu_masterFinance') || !html.includes('commandItems')) throw new Error('Neon DELETE, command item or finance bridge is missing.');
console.log('Master shared state, command items, Neon delete and finance QA: PASS');
if (!html.includes('const views=window.views={'))
  throw new Error('Master view registry is not shared with the checkout runtime.');
if (!html.includes('window.__EDDU_MASTER_LOCAL_DATA=window.data=') || html.includes('APT-DEMO-1') || html.includes('APT-DEMO-2'))
  throw new Error('Master agenda still contains local/demo business data.');
if (!html.includes('eddu_master_data_v1') || !html.includes("operation:'delete'"))
  throw new Error('Neon write-through or DELETE synchronization is missing.');
console.log('Master shared state, demo-data removal and Neon DELETE QA: PASS');
