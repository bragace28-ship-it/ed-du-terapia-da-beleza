import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};
globalThis.window = {};
await import('../runtime/v33-block06-08-agenda-financeiro.js');

const A = globalThis.window.EDDU_AGENDA_FINANCE;
assert.ok(A, 'Agenda API must exist');

const normalRule = A.agendaNormalRule('2026-09-23', '08:00', '10:00');
assert.equal(normalRule.exceptional, false);

const sundayRule = A.agendaNormalRule('2026-09-27', '10:00', '11:00');
assert.equal(sundayRule.exceptional, true);

const long17 = A.agendaNormalRule('2026-09-23', '17:00', '19:00');
assert.equal(long17.exceptional, false);
assert.equal(long17.ok, false);
assert.equal(long17.reason, 'long_procedure_last_normal_17');

const exceptional18 = A.agendaNormalRule('2026-09-23', '18:00', '20:00');
assert.equal(exceptional18.exceptional, true);

const a = A.createAppointment({
  professionalId: 'pro-1',
  clientId: 'c-1',
  serviceId: 's-1',
  startAt: '2026-09-23T10:00:00',
  endAt: '2026-09-23T11:00:00',
  observations: 'Cliente pediu atenção especial.'
});
assert.equal(a.status, 'scheduled');
assert.equal(a.exceptional, false);
assert.equal(a.observations, 'Cliente pediu atenção especial.');

assert.throws(() => A.createAppointment({
  professionalId: 'pro-1', clientId: 'c-9', serviceId: 's-9',
  startAt: '2026-09-23T10:30:00', endAt: '2026-09-23T11:30:00'
}), /professional_schedule_conflict/);

const block = A.blockSchedule({
  professionalId: 'pro-2',
  startAt: '2026-09-23T13:00:00',
  endAt: '2026-09-23T14:00:00',
  reason: 'Intervalo'
});
assert.equal(A.blocksForDay('2026-09-23').length, 1);
assert.throws(() => A.createAppointment({
  professionalId: 'pro-2', clientId: 'c-2', serviceId: 's-2',
  startAt: '2026-09-23T13:15:00', endAt: '2026-09-23T13:45:00'
}), /schedule_blocked/);
A.unblockSchedule(block.id);
assert.equal(A.blocksForDay('2026-09-23').length, 0);

const exceptional = A.createAppointment({
  professionalId: 'pro-3', clientId: 'c-3', serviceId: 's-3',
  startAt: '2026-09-27T10:00:00', endAt: '2026-09-27T11:00:00'
});
assert.equal(exceptional.exceptional, true);
assert.equal(exceptional.scheduleType, 'exceptional_pending');

A.createPayable({supplier:'Fornecedor',amount:120,dueDate:'2026-09-25'});
assert.throws(() => A.createPayable({supplier:'Fornecedor',amount:-1,dueDate:'2026-09-25'}), /payable_invalid/);
A.createReceivable({clientId:'c-1',commandId:'cmd-1',amount:300,dueDate:'2026-09-25',installments:3});
assert.throws(() => A.createReceivable({clientId:'c-1',amount:0,dueDate:'2026-09-25'}), /receivable_invalid/);
const summary = A.financialSummary();
assert.equal(summary.payableOpen, 120);
assert.equal(summary.receivableOpen, 300);
assert.equal(summary.netOpen, 180);

const ocr = A.applyOcr('Vencimento 25/09/2026 Valor R$ 1.234,56');
assert.equal(ocr.amount, 1234.56);
assert.equal(ocr.dueDate, '2026-09-25');
assert.equal(ocr.requiresConfirmation, true);

console.log('BLOCK 06-08 TESTS: PASS');
