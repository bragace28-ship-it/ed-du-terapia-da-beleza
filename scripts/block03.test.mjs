import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build.mjs', '--check'], { stdio: 'inherit' });

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};
globalThis.window = {};
await import('../runtime/v33-block03-comandas.js');

const C = globalThis.window.EDDU_COMMANDS;
assert.equal(C.homologation, true);

const command = C.addCommand({ clientId: 'client-1', professionalId: 'pro-1' });
assert.equal(command.status, 'open');

C.addItem(command.id, { serviceId: 'svc-1', description: 'Corte', quantity: 2, unitPrice: 80, date: '2026-09-22' });
assert.equal(C.getCommand(command.id).total, 160);

assert.throws(
  () => C.addItem(command.id, { serviceId: 'svc-1', description: 'Corte', quantity: 2, unitPrice: 80, date: '2026-09-22' }),
  /duplicate_command_item/
);

C.closeCommand(command.id);
assert.equal(C.getCommand(command.id).status, 'awaiting_payment');

C.addPayment(command.id, { method: 'pix', amount: 100, externalId: 'evt-1' });
assert.equal(C.getCommand(command.id).status, 'partially_paid');

C.addPayment(command.id, { method: 'pix', amount: 60, externalId: 'evt-2' });
assert.equal(C.getCommand(command.id).status, 'paid');

assert.throws(
  () => C.addPayment(command.id, { method: 'pix', amount: 1, externalId: 'evt-2' }),
  /command_already_paid/
);

assert.equal(C.listCommands().length, 1);
console.log('BLOCK 03 TESTS: PASS');
