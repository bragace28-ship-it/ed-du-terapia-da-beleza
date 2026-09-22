const KEY = 'eddu_v33_blocks09_17';

function state() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{"commissions":[],"services":[],"quotes":[],"referrals":[],"giftCards":[],"documents":[],"notifications":[],"users":[],"push":[],"deepLinks":[]}');
  } catch {
    return { commissions: [], services: [], quotes: [], referrals: [], giftCards: [], documents: [], notifications: [], users: [], push: [], deepLinks: [] };
  }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); return s; }
function id(prefix) { return prefix + '-' + Date.now().toString(36); }

function createCommission(input = {}) {
  const s = state();
  const sale = Math.max(0, Number(input.sale) || 0);
  const rate = Math.max(0, Number(input.rate) || 0);
  const item = { id: input.id || id('com'), professionalId: String(input.professionalId || ''), sale, rate, amount: Math.round(sale * rate) / 100, status: 'pending' };
  s.commissions.push(item); save(s); return item;
}

function settleCommission(idValue, amount) {
  const s = state();
  const x = s.commissions.find(v => v.id === idValue);
  if (!x) throw new Error('commission_not_found');
  const paid = Math.min(x.amount, Math.max(0, Number(amount) || 0));
  x.paid = Math.round(((x.paid || 0) + paid) * 100) / 100;
  x.status = x.paid >= x.amount ? 'paid' : 'partial';
  save(s); return x;
}

function upsertService(input = {}) {
  const s = state();
  const item = { id: input.id || id('svc'), name: String(input.name || 'Serviço'), category: String(input.category || ''), price: Math.max(0, Number(input.price) || 0), active: input.active !== false };
  const i = s.services.findIndex(v => v.id === item.id);
  if (i >= 0) s.services[i] = item; else s.services.push(item);
  save(s); return item;
}

function createQuote(input = {}) {
  const s = state();
  const subtotal = Math.max(0, Number(input.subtotal) || 0);
  const discount = Math.min(subtotal, Math.max(0, Number(input.discount) || 0));
  const total = Math.round((subtotal - discount) * 100) / 100;
  const item = { id: input.id || id('quote'), clientId: String(input.clientId || ''), subtotal, discount, total, status: 'draft', createdAt: new Date().toISOString() };
  s.quotes.push(item); save(s); return item;
}

function quotePdfPayload(quoteId) {
  const s = state(); const q = s.quotes.find(v => v.id === quoteId);
  if (!q) throw new Error('quote_not_found');
  return { type: 'application/pdf', filename: 'orcamento-' + q.id + '.pdf', data: { quoteId: q.id, total: q.total } };
}

function createReferral(input = {}) {
  const s = state();
  const item = { id: input.id || id('ref'), referrerId: String(input.referrerId || ''), referredClientId: String(input.referredClientId || ''), points: Math.max(0, Number(input.points) || 0), status: 'pending' };
  s.referrals.push(item); save(s); return item;
}

function createGiftCard(input = {}) {
  const s = state();
  const code = String(input.code || id('gift')).toUpperCase();
  if (s.giftCards.some(v => v.code === code)) throw new Error('gift_card_duplicate');
  const item = { id: id('gc'), code, value: Math.max(0, Number(input.value) || 0), status: 'active' };
  s.giftCards.push(item); save(s); return item;
}

function createDocument(input = {}) {
  const s = state();
  const item = { id: input.id || id('doc'), clientId: String(input.clientId || ''), type: String(input.type || 'responsibility_term'), status: 'pending', acceptedAt: null };
  s.documents.push(item); save(s); return item;
}

function acceptDocument(idValue) {
  const s = state(); const d = s.documents.find(v => v.id === idValue);
  if (!d) throw new Error('document_not_found');
  d.status = 'accepted'; d.acceptedAt = new Date().toISOString(); save(s); return d;
}

function upsertUser(input = {}) {
  const s = state();
  const item = { id: input.id || id('usr'), name: String(input.name || ''), role: String(input.role || 'client'), active: input.active !== false };
  const i = s.users.findIndex(v => v.id === item.id);
  if (i >= 0) s.users[i] = item; else s.users.push(item);
  save(s); return item;
}

function notify(input = {}) {
  const s = state();
  const item = { id: input.id || id('ntf'), userId: String(input.userId || ''), type: String(input.type || 'in_app'), title: String(input.title || ''), body: String(input.body || ''), read: false, createdAt: new Date().toISOString() };
  s.notifications.push(item); save(s); return item;
}

function createDeepLink(input = {}) {
  const s = state();
  const path = String(input.path || '');
  if (!path.startsWith('/')) throw new Error('deep_link_path_invalid');
  const item = { id: id('link'), path, token: String(input.token || id('token')), expiresAt: input.expiresAt || null };
  s.deepLinks.push(item); save(s); return item;
}

function pushSubscription(input = {}) {
  const s = state();
  const item = { id: input.id || id('push'), userId: String(input.userId || ''), endpoint: String(input.endpoint || ''), enabled: input.enabled !== false };
  const i = s.push.findIndex(v => v.id === item.id);
  if (i >= 0) s.push[i] = item; else s.push.push(item);
  save(s); return item;
}

function placesQuery(input = {}) {
  return { provider: 'google-places', mode: 'adapter', query: String(input.query || ''), radius: Math.max(0, Number(input.radius) || 0), requiresServerKey: true };
}

window.EDDU_PLATFORM = Object.freeze({
  homologation: true,
  createCommission, settleCommission, upsertService, createQuote, quotePdfPayload,
  createReferral, createGiftCard, createDocument, acceptDocument,
  upsertUser, notify, createDeepLink, pushSubscription, placesQuery,
  reset: () => save({ commissions: [], services: [], quotes: [], referrals: [], giftCards: [], documents: [], notifications: [], users: [], push: [], deepLinks: [] })
});
