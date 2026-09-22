import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};
globalThis.window = {};
await import('../runtime/v33-block04-gateways.js');

const G = globalThis.window.EDDU_GATEWAYS;
assert.equal(G.adapter('Stripe').provider, 'stripe');
assert.equal(G.adapter('PagBank').provider, 'pagbank');
assert.equal(G.adapter('Asaas').provider, 'asaas');
assert.equal(G.adapter('PicPay').provider, 'picpay');

const first = G.ingestEvent({ provider: 'stripe', eventId: 'evt-123', status: 'paid', amount: 150 });
assert.equal(first.duplicate, false);
const second = G.ingestEvent({ provider: 'stripe', eventId: 'evt-123', status: 'paid', amount: 150 });
assert.equal(second.duplicate, true);
assert.equal(G.listEvents().length, 1);

assert.throws(() => G.ingestEvent({ provider: 'stripe' }), /gateway_event_id_required/);
assert.throws(() => G.ingestEvent({ provider: 'unknown', eventId: '1' }), /gateway_unknown/);

console.log('BLOCK 04/05 TESTS: PASS');
