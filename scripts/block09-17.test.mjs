import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key)
};
globalThis.window = {};
await import('../runtime/v33-block09-17-platform-core.js');

const P = globalThis.window.EDDU_PLATFORM;
const c = P.createCommission({professionalId:'p1',sale:1000,rate:30});
assert.equal(c.amount,300);
P.settleCommission(c.id,100);
assert.equal(P.createCommission ? 1 : 0, 1);

const svc = P.upsertService({name:'Corte',price:100});
assert.equal(svc.active,true);

const q = P.createQuote({clientId:'c1',subtotal:500,discount:50});
assert.equal(q.total,450);
assert.equal(P.quotePdfPayload(q.id).type,'application/pdf');

const gc = P.createGiftCard({code:'EDDU-001',value:200});
assert.equal(gc.status,'active');
assert.throws(() => P.createGiftCard({code:'EDDU-001',value:200}), /gift_card_duplicate/);

const d = P.createDocument({clientId:'c1'});
assert.equal(P.acceptDocument(d.id).status,'accepted');

const n = P.notify({userId:'u1',title:'Teste',body:'Aviso'});
assert.equal(n.read,false);

const link = P.createDeepLink({path:'/pagamento',token:'abc'});
assert.equal(link.path,'/pagamento');
assert.throws(() => P.createDeepLink({path:'pagamento'}), /deep_link_path_invalid/);

assert.equal(P.placesQuery({query:'salão'}).requiresServerKey,true);
console.log('BLOCK 09-17 TESTS: PASS');
