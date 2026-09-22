import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};
globalThis.window = {
  dispatchEvent: () => true
};

const source = await readFile('runtime/v33-entry.js','utf8');
assert.match(source, /v33-auth-pin\.js/);
assert.match(source, /v33-block03-comandas\.js/);
assert.match(source, /v33-block04-gateways\.js/);
assert.match(source, /v33-block06-08-agenda-financeiro\.js/);
assert.match(source, /v33-block09-17-platform-core\.js/);

await import('../runtime/v33-entry.js');

const auth = globalThis.window.EDDU_AUTH;
assert.equal(typeof auth.homologation, 'boolean');
if (auth.homologation) {
  assert.equal(auth.pinRequired(), false);
  assert.equal((await auth.getProfile()).full_name, 'Mariana');
} else {
  assert.equal(auth.pinRequired(), true);
}

const commands = globalThis.window.EDDU_COMMANDS;
const gateways = globalThis.window.EDDU_GATEWAYS;
const agenda = globalThis.window.EDDU_AGENDA_FINANCE;
const platform = globalThis.window.EDDU_PLATFORM;

const cmd = commands.addCommand({clientId:'c1', professionalId:'p1'});
commands.addItem(cmd.id, {serviceId:'s1', description:'Serviço', quantity:1, unitPrice:200, date:'2026-09-22'});
commands.closeCommand(cmd.id);
commands.addPayment(cmd.id, {method:'pix', amount:200, externalId:'pay-1'});
assert.equal(commands.getCommand(cmd.id).status, 'paid');

const event1 = gateways.ingestEvent({provider:'PagBank', eventId:'evt-1', status:'paid', amount:200});
const event2 = gateways.ingestEvent({provider:'PagBank', eventId:'evt-1', status:'paid', amount:200});
assert.equal(event1.duplicate, false);
assert.equal(event2.duplicate, true);

const appt = agenda.createAppointment({
  professionalId:'p1', clientId:'c1', serviceId:'s1',
  startAt:'2026-09-22T14:00:00-03:00', endAt:'2026-09-22T15:00:00-03:00'
});
assert.equal(appt.status, 'scheduled');

agenda.createPayable({supplier:'Fornecedor', amount:100, dueDate:'2026-09-25'});
agenda.createReceivable({clientId:'c1', commandId:cmd.id, amount:200, dueDate:'2026-09-25'});
assert.deepEqual(agenda.financialSummary(), {payableOpen:100, receivableOpen:200, netOpen:100});

const commission = platform.createCommission({professionalId:'p1', sale:1000, rate:30});
assert.equal(commission.amount, 300);
platform.settleCommission(commission.id, 300);
const quote = platform.createQuote({clientId:'c1', subtotal:500, discount:50});
assert.equal(quote.total, 450);
const gift = platform.createGiftCard({code:'EDDU-HOMOLOG-001', value:150});
assert.equal(gift.status, 'active');
const document = platform.createDocument({clientId:'c1'});
assert.equal(platform.acceptDocument(document.id).status, 'accepted');
assert.equal(platform.createDeepLink({path:'/pagamento'}).path, '/pagamento');
assert.equal(platform.placesQuery({query:'salão'}).requiresServerKey, true);

console.log('BLOCK 18 HOMOLOGATION: PASS — V33 functional layer, auth/PIN bypass, command, gateway idempotency, agenda/finance, platform core and cross-module smoke test verified');
