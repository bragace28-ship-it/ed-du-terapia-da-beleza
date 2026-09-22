const EVENT_KEY = 'eddu_v33_gateway_events';

function readEvents() {
  try { return JSON.parse(localStorage.getItem(EVENT_KEY) || '[]'); } catch { return []; }
}

function writeEvents(events) {
  localStorage.setItem(EVENT_KEY, JSON.stringify(events));
  return events;
}

function gatewayName(provider) {
  const p = String(provider || '').toLowerCase();
  if (p.includes('pagbank')) return 'pagbank';
  if (p.includes('asaas')) return 'asaas';
  if (p.includes('picpay')) return 'picpay';
  if (p.includes('stripe')) return 'stripe';
  return p || 'unknown';
}

function normalizeEvent(input = {}) {
  const provider = gatewayName(input.provider);
  const externalId = String(input.externalId || input.eventId || input.id || '');
  if (!provider || provider === 'unknown') throw new Error('gateway_unknown');
  if (!externalId) throw new Error('gateway_event_id_required');
  return {
    idempotencyKey: provider + ':' + externalId,
    provider,
    externalId,
    type: String(input.type || 'payment.updated'),
    status: String(input.status || 'pending'),
    amount: Number(input.amount || 0),
    currency: String(input.currency || 'BRL').toUpperCase(),
    commandId: String(input.commandId || ''),
    receivedAt: new Date().toISOString()
  };
}

function ingestEvent(input) {
  const event = normalizeEvent(input);
  const events = readEvents();
  const existing = events.find(x => x.idempotencyKey === event.idempotencyKey);
  if (existing) return { duplicate: true, event: existing };
  events.push(event);
  writeEvents(events);
  return { duplicate: false, event };
}

function listEvents() {
  return readEvents().slice().reverse();
}

function resetEvents() {
  writeEvents([]);
}

function adapter(provider) {
  const name = gatewayName(provider);
  return Object.freeze({
    provider: name,
    createCheckout: async payload => ({ provider: name, mode: 'homologation', payload }),
    verifyWebhook: payload => normalizeEvent({ ...payload, provider: name }),
    ingestWebhook: payload => ingestEvent({ ...payload, provider: name })
  });
}

window.EDDU_GATEWAYS = Object.freeze({
  homologation: true,
  adapter,
  normalizeEvent,
  ingestEvent,
  listEvents,
  resetEvents
});
