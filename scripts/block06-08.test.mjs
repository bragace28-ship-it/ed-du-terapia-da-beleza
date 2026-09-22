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
const a = A.createAppointment({
  professionalId: 'pro-1', clientId: 'c-1', serviceId: 's-1',
  startAt: '2026-09-22T10:00:00-03:00', endAt: '2026-09-22T11:00:00-03:00'
});
assert.equal(a.status, 'scheduled');
assert.throws(() => A.createAppointment({
  id: a.id, professionalId: 'pro-1', clientId: 'c-9', serviceId: 's-9',
  startAt: '2026-09-22T12:00:00-03:00', endAt: '2026-09-22T13:00:00-03:00'
}), /appointment_duplicate/);
assert.throws(() => A.createAppointment({
  professionalId: 'pro-1', clientId: 'c-9', serviceId: 's-9',
  startAt: '2026-09-22T13:00:00-03:00', endAt: '2026-09-22T12:00:00-03:00'
}), /appointment_time_invalid/);
assert.throws(() => A.createAppointment({
  professionalId: 'pro-1', clientId: 'c-2', serviceId: 's-2',
  startAt: '2026-09-22T10:30:00-03:00', endAt: '2026-09-22T11:30:00-03:00'
}), /professional_schedule_conflict/);

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
