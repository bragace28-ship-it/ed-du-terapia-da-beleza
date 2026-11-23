/* ED & DU MASTER 46.0.0 — API bridge. Browser storage is never treated as the database. */
(function () {
  'use strict';
  const TABLES = {
    clients: 'clients',
    professionals: 'professionals',
    services: 'services',
    products: 'products',
    appointments: 'appointments',
    appointment_services: 'appointment_services',
    commands: 'commands',
    command_items: 'command_items',
    financial_transactions: 'financial_transactions',
    agenda_blocks: 'agenda_blocks',
    coupons: 'coupons',
    payments: 'payments',
    receivables: 'receivables',
    receivable_installments: 'receivable_installments',
    payables: 'payables',
    card_invoices: 'card_invoices',
    commissions: 'commissions',
    quotes: 'quotes',
    referrals: 'referrals',
    gift_cards: 'gift_cards',
    notifications: 'notifications',
    terms: 'terms',
    anamneses: 'anamneses',
    before_after_gallery: 'before_after_gallery',
    open_finance_connections: 'open_finance_connections',
    loyalty_accounts: 'loyalty_accounts',
    loyalty_transactions: 'loyalty_transactions',
    credit_accounts: 'credit_accounts',
    credit_alerts: 'credit_alerts',
    recurring_payments: 'recurring_payments',
    ocr_documents: 'ocr_documents',
    account_actions: 'account_actions'
  };
  const DATA_KEYS = {
    clients: 'clients', professionals: 'professionals', services: 'services', products: 'products',
    appointments: 'appointments', appointment_services: 'appointmentServices', commands: 'commands', financial_transactions: 'financialTransactions',
    agenda_blocks: 'blocks', payments: 'payments', payables: 'payables', receivables: 'receivables',
    commissions: 'commissions', anamneses: 'anamneses', terms: 'terms', coupons: 'coupons',
    gift_cards: 'giftCards', referrals: 'referrals', card_invoices: 'cardInvoices',
    receivable_installments: 'receivableInstallments', command_items: 'commandItems',
    notifications: 'notifications', quotes: 'quotes', loyalty_accounts: 'loyaltyAccounts',
    loyalty_transactions: 'loyaltyTransactions', credit_accounts: 'creditAccounts',
    credit_alerts: 'creditAlerts', recurring_payments: 'recurringPayments',
    ocr_documents: 'ocrDocuments', before_after_gallery: 'beforeAfterGallery',
    open_finance_connections: 'openFinanceConnections', account_actions: 'accountActions'
  };
  const state = () => window.data && typeof window.data === 'object' ? window.data : (window.data = {});
  const waitReady = async () => {
    if (window.__EDDU_NEON_READY === true) return;
    if (window.__EDDU_NEON_READY === false) throw new Error(window.__EDDU_NEON_LAST_ERROR || 'Neon indisponível.');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tempo esgotado aguardando Neon Auth.')), 12000);
      window.addEventListener('eddu-neon-ready', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    if (window.__EDDU_NEON_READY !== true) throw new Error(window.__EDDU_NEON_LAST_ERROR || 'Neon indisponível.');
  };
  async function api(entity, method, body, query) {
    if (!TABLES[entity]) throw new Error('Entidade não autorizada: ' + entity);
    await waitReady();
    const session = await window.EDDU_NEON_REFRESH_SESSION?.();
    if (!session) {
      window.__EDDU_NEON_AUTH_REQUIRED?.();
      throw new Error('AUTH_REQUIRED');
    }
    const url = new URL('/api/data/' + encodeURIComponent(entity), location.origin);
    if (query?.id) url.searchParams.set('id', query.id);
    if (query?.limit) url.searchParams.set('limit', String(query.limit));
    const authToken = session?.session?.token || session?.token || session?.accessToken || session?.session?.accessToken;
    if (!authToken) throw new Error('NEON_SESSION_TOKEN_UNAVAILABLE');
    const response = await fetch(url.toString(), {
      method: method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer ' + authToken,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      if (response.status === 401) window.__EDDU_NEON_AUTH_REQUIRED?.();
      throw new Error(result.error || ('Falha na API Neon (' + response.status + ').'));
    }
    return result;
  }
  function applyRows(entity, rows) {
    const key = DATA_KEYS[entity];
    if (!key) return;
    state()[key] = Array.isArray(rows) ? rows : [];
    window.dispatchEvent(new CustomEvent('eddu-neon-data-loaded', { detail: { entity, key, rows: state()[key] } }));
  }
  function hydrateCommands() {
    if (!window.state) return;
    const commands = Array.isArray(state().commands) ? state().commands : [];
    const items = Array.isArray(state().commandItems) ? state().commandItems : [];
    const clients = Array.isArray(state().clients) ? state().clients : [];
    for (const command of commands) {
      command.items = items.filter(item => item.command_id === command.id).map(item => ({ ...item, service:item.description, qty:Number(item.quantity || 1), price:Number(item.unit_price || 0) }));
      command.grossAmount = Number(command.grossAmount ?? command.subtotal ?? command.total ?? 0);
      command.netAmount = Number(command.netAmount ?? command.total ?? 0);
      command.discount = Number(command.discount || 0);
      if (!command.client && command.client_id) command.client = clients.find(client => client.id === command.client_id)?.name || '';
      if (!command.service && command.items.length) command.service = command.items[0].description;
    }
    window.state.commands = commands;
    if (!commands.some(command => command.id === window.state.activeCommandId)) window.state.activeCommandId = commands[0]?.id || null;
  }
  async function load(entity, options) {
    const result = await api(entity, 'GET', undefined, options);
    applyRows(entity, result.data || []);
    return result.data || [];
  }
  async function create(entity, payload) {
    const result = await api(entity, 'POST', payload);
    const row = result.data;
    if (row) {
      const key = DATA_KEYS[entity];
      if (key) state()[key] = [row, ...(Array.isArray(state()[key]) ? state()[key].filter(item => item.id !== row.id) : [])];
      if (entity === 'commands') hydrateCommands();
      window.dispatchEvent(new CustomEvent('eddu-neon-data-changed', { detail: { operation: 'insert', entity, row } }));
    }
    return row;
  }
  async function update(entity, id, patch) {
    if (!id) throw new Error('ID_REQUIRED');
    const result = await api(entity, 'PATCH', { ...patch, id });
    const row = result.data;
    const key = DATA_KEYS[entity];
    if (row && key) state()[key] = (state()[key] || []).map(item => item.id === id ? row : item);
    if (entity === 'commands') hydrateCommands();
    window.dispatchEvent(new CustomEvent('eddu-neon-data-changed', { detail: { operation: 'update', entity, row } }));
    return row;
  }
  async function remove(entity, id) {
    if (!id) throw new Error('ID_REQUIRED');
    const result = await api(entity, 'DELETE', undefined, { id });
    const key = DATA_KEYS[entity];
    if (key) state()[key] = (state()[key] || []).filter(item => item.id !== id);
    if (entity === 'commands') hydrateCommands();
    window.dispatchEvent(new CustomEvent('eddu-neon-data-changed', { detail: { operation: 'delete', entity, id } }));
    return result;
  }
  async function sync() {
    if (window.__EDDU_NEON_SYNCING) return;
    window.__EDDU_NEON_SYNCING = true;
    try {
      await waitReady();
      const session = await window.EDDU_NEON_REFRESH_SESSION?.();
      if (!session) {
        window.__EDDU_NEON_CONNECTED = false;
        window.__EDDU_NEON_AUTH_REQUIRED?.();
        return false;
      }
      const entities = Object.keys(TABLES);
      const results = await Promise.allSettled(entities.map(entity => load(entity, { limit: 500 })));
      const failed = results.map((result, index) => result.status === 'rejected' ? { entity: entities[index], error: String(result.reason?.message || result.reason) } : null).filter(Boolean);
      hydrateCommands();
      window.__EDDU_NEON_CONNECTED = failed.length === 0;
      window.__EDDU_NEON_SYNC_ERRORS = failed;
      if (failed.length) console.error('[EDDU] Neon synchronization errors:', failed);
      window.dispatchEvent(new CustomEvent('eddu-neon-sync-complete', { detail: { connected: failed.length === 0, errors: failed } }));
      return failed.length === 0;
    } finally {
      window.__EDDU_NEON_SYNCING = false;
    }
  }
  window.EDDU_NEON_API = Object.freeze({ get: load, insert: create, update, delete: remove, sync, entities: Object.freeze(Object.keys(TABLES)) });
  window.EDDU_NEON_SYNC = sync;
  window.addEventListener('eddu-neon-authenticated', sync);
  window.addEventListener('eddu-neon-session-changed', event => {
    if (event.detail?.authenticated) sync();
    else window.__EDDU_NEON_CONNECTED = false;
  });
  window.addEventListener('online', () => { if (window.__EDDU_NEON_SESSION) sync(); });
  window.addEventListener('eddu-neon-ready', () => { if (window.__EDDU_NEON_SESSION) sync(); });
  setTimeout(() => { if (window.__EDDU_NEON_SESSION) sync(); }, 1200);
})();