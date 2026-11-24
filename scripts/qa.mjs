import {readFile} from 'node:fs/promises';

const html = await readFile('dist/index.html','utf8');
const release = JSON.parse(await readFile('dist/version.json','utf8'));
const legacyFree=html.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi,'');
const commandApiSource = await readFile('functions/api/commands.js','utf8');
const clientCommandApiSource = await readFile('functions/api/client/commands.js','utf8');
const agendaWorkflowSource = await readFile('master/runtime-agenda-workflow.js','utf8');
const agendaSyncSource = await readFile('master/runtime-agenda-sync.js','utf8');
const commandRuntimeSource = await readFile('master/runtime-command-operations.js','utf8');
const authRuntimeSource = await readFile('master/neon-auth-client.js','utf8');
const neonBridgeSource = await readFile('master/neon-live-bridge.js','utf8');
const dataApiSource = await readFile('functions/api/data/[entity].js','utf8');
const commandApiSource = await readFile('functions/api/commands.js','utf8');
const wranglerSource = await readFile('wrangler.toml','utf8');

if (!authRuntimeSource.includes('PUBLIC_DEV_MODE = true') || !authRuntimeSource.includes('publicDevelopment:true'))
  throw new Error('Public development mode must bypass the login overlay without fabricating a JWT.');
if (!neonBridgeSource.includes('window.EDDU_PUBLIC_DEV_MODE === true'))
  throw new Error('Neon bridge must support public development requests without a bearer token.');
if (!dataApiSource.includes("env.EDDU_PUBLIC_DEV_MODE === 'true'") || !commandApiSource.includes("env.EDDU_PUBLIC_DEV_MODE==='true'") || !wranglerSource.includes('EDDU_PUBLIC_DEV_MODE = "true"'))
  throw new Error('Public development mode must be explicitly enabled for both Neon APIs and Cloudflare Pages.');

if (!agendaSyncSource.includes('async function requireSession()') || !agendaSyncSource.includes('await requireSession();'))
  throw new Error('Agenda writes must refresh the Neon session instead of trusting a stale session flag.');
if (!commandRuntimeSource.includes('await window.EDDU_NEON_REFRESH_SESSION()'))
  throw new Error('Command operations must refresh the Neon session before checking sync state.');

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
if (!html.includes('window.__EDDU_MASTER_LOCAL_DATA=window.data=') || html.includes('APT-DEMO-1')) throw new Error('Master agenda still contains local demo business data.');
if (!html.includes("operation:'delete'") || !html.includes('eddu_masterFinance') || !html.includes('commandItems')) throw new Error('Neon DELETE, command item or finance bridge is missing.');
console.log('Master shared state, command items, Neon delete and finance QA: PASS');
if (!html.includes('const views=window.views={'))
  throw new Error('Master view registry is not shared with the checkout runtime.');
if (!html.includes('window.__EDDU_MASTER_LOCAL_DATA=window.data=') || html.includes('APT-DEMO-1') || html.includes('APT-DEMO-2'))
  throw new Error('Master agenda still contains local/demo business data.');
if (!html.includes('eddu_master_data_v1') || !html.includes("operation:'delete'"))
  throw new Error('Neon write-through or DELETE synchronization is missing.');
console.log('Master shared state, demo-data removal and Neon DELETE QA: PASS');
if (!html.includes('EDDU_AGENDA_RUNTIME_READY') || !html.includes('clientAppointmentsView') || !html.includes('edduSaveAppointment')) throw new Error('Agenda create/close/client visibility runtime is missing.');
console.log('Master Agenda save, modal controls and client view QA: PASS');
if (!html.includes('openAgendaProfessionalCreateM') || !html.includes('saveAgendaProfessionalM') || !html.includes('openAgendaServiceCreateM') || !html.includes('saveAgendaServiceM'))
  throw new Error('Agenda professional/service registration flow is missing from production artifact.');
if (html.includes('Vincule o mesmo e-mail usado no acesso do cliente antes de agendar.'))
  throw new Error('Client email must not block professional-side appointment creation.');
console.log('Agenda professional/service registration and optional client email QA: PASS');
if (!html.includes('EDDU_COMMANDS_RUNTIME_READY') || !html.includes('edduCreateCommand') || !html.includes('edduCancelCommand') || !html.includes('edduSendCommandToPayment'))
  throw new Error('Real Neon command create/cancel/payment actions are missing from production artifact.');
if (!html.includes('Lançar comanda no Neon') || !html.includes('Cancelar comanda') || !html.includes('Enviar para pagamento'))
  throw new Error('Command lifecycle UI controls are missing from production artifact.');
console.log('Neon command lifecycle create, cancel and checkout QA: PASS');
for (const token of ['Comandas em aberto','Adicionar item','Cupom de desconto','Editar comanda','Excluir comanda','add-draft-item','edduClientPendingCommands','/api/client/commands','Pagar agora'])
  if (!html.includes(token)) throw new Error('Command multi-item, coupon, edit/delete or client checkout flow is missing: '+token);
console.log('Command workspace multi-item, coupons, CRUD and client-app payment QA: PASS');
for (const token of ['/api/commands','saveCommandTransaction','edduCreateCommandFromAppointment','edduCommandError'])
  if (!html.includes(token)) throw new Error('Atomic command save integration is missing: '+token);
for (const token of ['Iniciar atendimento','Cancelar atendimento','Reagendar atendimento','eddu-agenda-save-reschedule','in_progress','rescheduled'])
  if (!html.includes(token)) throw new Error('Agenda lifecycle controls are missing: '+token);
console.log('Atomic Neon command transaction and agenda lifecycle QA: PASS');
if (!commandApiSource.includes("match(/^Bearer\\s+(.+)$/i)")) throw new Error('Atomic command API bearer token parser is invalid.');
if (!commandApiSource.includes('${auth.id})') || commandApiSource.includes('${user.id})')) throw new Error('Command creator must use Neon Auth user ID to satisfy commands.created_by foreign key.');
if (!clientCommandApiSource.includes('!/^Bearer\\s+\\S+/i.test(authorization)')) throw new Error('Client command API bearer token parser is invalid.');
if (!agendaWorkflowSource.includes("button.closest('.option,.card,article")) throw new Error('Agenda lifecycle controls are not attached to each appointment card.');
if (!agendaWorkflowSource.includes('window.__EDDU_SELECTED_DAY')) throw new Error('Agenda lifecycle does not track the selected calendar day.');
console.log('Persistent command authentication and per-appointment lifecycle regression QA: PASS');
const clientAgendaSource = agendaSyncSource.slice(agendaSyncSource.indexOf('function clientAppointmentsView'),agendaSyncSource.indexOf("window.addEventListener('eddu-neon-data-loaded'"));
for (const token of ['apt-service-checkbox','aptServicesSummary','for (const selected of selectedServices)','appointment_services','price_base','service_names'])
  if (!agendaSyncSource.includes(token)) throw new Error('Professional multi-service booking or pricing is missing: '+token);
if (/money\(|unit_price|price_base|R\$/i.test(clientAgendaSource))
  throw new Error('Professional service prices leaked into the client appointment view.');
if (!agendaWorkflowSource.includes('await window.edduCreateCommandFromAppointment') || !agendaWorkflowSource.includes('await window.edduSaveCommandDraft()') || !agendaWorkflowSource.includes('window.edduOpenCommandForEdit') || !agendaWorkflowSource.includes('const existing=rows(\'commands\')'))
  throw new Error('Starting an appointment must persist, open and reuse its linked command.');
if (!commandRuntimeSource.includes('window.edduSaveCommandDraft=saveDraft') || !commandRuntimeSource.includes('window.edduOpenCommandForEdit=function(id)'))
  throw new Error('Appointment command save/reopen actions are not exposed.');
if (!commandRuntimeSource.includes("credentials:'include'") || !commandRuntimeSource.includes("saved.status||'').toLowerCase()!=='cancelled'"))
  throw new Error('Command save authentication or cancellation confirmation is missing.');
if (!commandApiSource.includes('unit_price,total,professional_id'))
  throw new Error('Command item totals are not persisted in Neon.');
console.log('Professional multi-service pricing, client price privacy, appointment command launch and command lifecycle QA: PASS');
