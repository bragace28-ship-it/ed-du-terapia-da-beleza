/* ED & DU — Neon write-through persistence. Neon PostgreSQL is the only source of truth. */
(function () {
  'use strict';
  const TABLES = {
    clients:'clients', professionals:'professionals', services:'services', products:'products',
    appointments:'appointments', commands:'commands', command_items:'command_items',
    financialTransactions:'financial_transactions', blocks:'agenda_blocks', payments:'payments',
    payables:'payables', receivables:'receivables', commissions:'commissions', coupons:'coupons',
    giftCards:'gift_cards', referrals:'referrals', cardInvoices:'card_invoices',
    receivableInstallments:'receivable_installments', notifications:'notifications', quotes:'quotes',
    loyaltyAccounts:'loyalty_accounts', loyaltyTransactions:'loyalty_transactions',
    creditAccounts:'credit_accounts', creditAlerts:'credit_alerts', recurringPayments:'recurring_payments',
    ocrDocuments:'ocr_documents', beforeAfterGallery:'before_after_gallery',
    openFinanceConnections:'open_finance_connections', accountActions:'account_actions',
    anamneses:'anamneses', terms:'terms'
  };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let running = Promise.resolve();
  const notify = message => {
    window.dispatchEvent(new CustomEvent('eddu-neon-persistence-error', { detail:{ message } }));
    try { if (typeof window.toast === 'function') window.toast('Neon: ' + message); } catch (_) {}
  };
  const iso = (date, time) => {
    if (!date) return null;
    const value = String(date);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
    return value.slice(0,10) + 'T' + String(time || '00:00').slice(0,5) + ':00';
  };
  function normalize(entity, source) {
    const row = { ...(source || {}) };
    delete row.id;
    if (entity === 'clients') {
      row.name = row.name || row.nome || row.client;
      row.birth_date = row.birth_date || row.birthDate;
    } else if (entity === 'professionals') {
      row.name = row.name || row.nome;
    } else if (entity === 'services') {
      row.name = row.name || row.nome;
      row.price = row.price ?? row.base ?? row.price_base ?? row.priceBase;
      row.price_base = row.price_base ?? row.base ?? row.price;
      row.price_long = row.price_long ?? row.long ?? row.priceLong;
      row.service_cost = row.service_cost ?? row.cost ?? row.serviceCost;
    } else if (entity === 'products') {
      row.name = row.name || row.nome;
      row.sale_price = row.sale_price ?? row.price ?? row.salePrice;
      row.cost_price = row.cost_price ?? row.cost ?? row.costPrice;
    } else if (entity === 'appointments') {
      row.client_id = row.client_id || row.clientId;
      row.professional_id = row.professional_id || row.professionalId;
      row.starts_at = row.starts_at || row.startsAt || iso(row.date, row.start);
      row.ends_at = row.ends_at || row.endsAt || iso(row.date, row.end);
    } else if (entity === 'agenda_blocks') {
      row.professional_id = row.professional_id || row.professionalId;
      row.starts_at = row.starts_at || row.startsAt || iso(row.date, row.start);
      row.ends_at = row.ends_at || row.endsAt || iso(row.date, row.end || '23:59');
    } else if (entity === 'commands') {
      row.client_id = row.client_id || row.clientId;
      row.professional_id = row.professional_id || row.professionalId;
      row.appointment_id = row.appointment_id || row.appointmentId;
    } else if (entity === 'command_items') {
      row.command_id = row.command_id || row.commandId;
      row.service_id = row.service_id || row.serviceId;
      row.product_id = row.product_id || row.productId;
      row.professional_id = row.professional_id || row.professionalId;
      row.unit_price = row.unit_price ?? row.price;
    } else if (entity === 'financial_transactions') {
      row.client_id = row.client_id || row.clientId;
      row.command_id = row.command_id || row.commandId;
      row.direction = row.direction || (row.type === 'expense' ? 'out' : row.type === 'income' ? 'in' : undefined);
      row.description = row.description || row.name;
    } else if (entity === 'payments' || entity === 'payables' || entity === 'receivables') {
      row.client_id = row.client_id || row.clientId;
      row.command_id = row.command_id || row.commandId;
      row.due_at = row.due_at || row.due_date || row.dueDate;
    } else if (entity === 'anamneses') {
      row.client_id = row.client_id || row.clientId;
      row.private_formula = row.private_formula || row.privateFormula;
      row.private_notes = row.private_notes || row.privateNotes;
    } else if (entity === 'coupons') {
      row.code = row.code || row.couponCode;
      row.service_id = row.service_id || row.serviceId;
      row.expires_at = row.expires_at || row.expiresAt;
      row.starts_at = row.starts_at || row.startsAt;
      row.active = row.active ?? !['used','expired','inactive'].includes(String(row.status || '').toLowerCase());
      row.metadata = row.metadata || { client:row.client || null, source:row.source || 'legacy-ui' };
    } else if (entity === 'card_invoices') {
      row.card_name = row.card_name || row.name || 'Fatura recebida';
      row.metadata = row.metadata || { filename:row.name || null, mime:row.mime || null, size:row.size || null, status:row.status || null };
    } else if (entity === 'terms') {
      row.client_id = row.client_id || row.clientId;
      row.signed_at = row.signed_at || row.signedAt;
      row.payload = row.payload || { status:row.status || null };
    }
    return row;
  }
  async function persistSnapshot() {
    if (!window.EDDU_NEON_API) throw new Error('NEON_API_NOT_READY');
    if (window.__EDDU_NEON_READY !== true) throw new Error('NEON_NOT_READY');
    const data = window.data && typeof window.data === 'object' ? window.data : {};
    const report = [];
    for (const [key, entity] of Object.entries(TABLES)) {
      const rows = data[key];
      if (!Array.isArray(rows) || !rows.length) continue;
      for (let index = 0; index < rows.length; index++) {
        const source = rows[index];
        if (!source || typeof source !== 'object') continue;
        const payload = normalize(entity, source);
        if (entity === 'appointments' && (!payload.starts_at || !payload.ends_at)) continue;
        if (entity === 'agenda_blocks' && (!payload.starts_at || !payload.ends_at)) continue;
        if (entity === 'financial_transactions' && (!payload.type || !payload.direction || payload.amount == null || !payload.description)) continue;
        const saved = UUID.test(String(source.id || ''))
          ? await window.EDDU_NEON_API.update(entity, source.id, payload)
          : await window.EDDU_NEON_API.insert(entity, payload);
        if (!saved?.id) throw new Error('NEON_WRITE_DID_NOT_RETURN_ID:' + entity);
        source.id = saved.id;
        report.push({ entity, id:saved.id });
      }
    }
    window.__EDDU_NEON_LAST_PERSIST = { at:new Date().toISOString(), writes:report.length, rows:report };
    window.dispatchEvent(new CustomEvent('eddu-neon-persist-complete', { detail:window.__EDDU_NEON_LAST_PERSIST }));
    return window.__EDDU_NEON_LAST_PERSIST;
  }
  function persist() {
    running = running.then(persistSnapshot).catch(error => {
      notify(String(error?.message || error));
      throw error;
    });
    return running;
  }
  window.EDDU_NEON_PERSIST_SNAPSHOT = persistSnapshot;
  window.persist = persist;

  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const guardedKeys = new Set([
    'eddu_data','eddu_finance','eddu_state',
    'eddu_v46_manual_coupons','eddu_master_coupons_v46',
    'eddu_v46_card_invoices','eddu_master_card_invoices_v46'
  ]);
  Storage.prototype.setItem = function (key, value) {
    if (guardedKeys.has(String(key))) {
      let parsed;
      try { parsed = JSON.parse(String(value)); } catch (_) { throw new Error('NEON_ONLY_INVALID_JSON:' + key); }
      if (!window.data || typeof window.data !== 'object') window.data = {};
      if (key === 'eddu_data') Object.assign(window.data, parsed);
      if (key === 'eddu_finance') {
        if (Array.isArray(parsed.payables)) window.data.payables = parsed.payables;
        if (Array.isArray(parsed.receivables)) window.data.receivables = parsed.receivables;
      }
      if (key === 'eddu_state') {
        if (Array.isArray(parsed.coupons)) window.data.coupons = parsed.coupons;
        if (Array.isArray(parsed.terms)) window.data.terms = parsed.terms;
      }
      if (key.includes('coupons')) window.data.coupons = Array.isArray(parsed) ? parsed : [];
      if (key.includes('card_invoices')) window.data.cardInvoices = Array.isArray(parsed) ? parsed : [];
      persist();
      return;
    }
    return nativeSetItem.call(this, key, value);
  };
  Storage.prototype.removeItem = function (key) {
    if (guardedKeys.has(String(key))) {
      notify('a remoção local foi bloqueada; use EDDU_NEON_API.delete(entity, id) para excluir no banco.');
      return;
    }
    return nativeRemoveItem.call(this, key);
  };
  window.EDDU_NEON_DELETE = async (entity, id) => window.EDDU_NEON_API.delete(entity, id);
  window.addEventListener('eddu-neon-persist-complete', event => {
    if (event.detail?.error) notify(String(event.detail.error));
  });
  window.addEventListener('eddu-neon-session-changed', event => {
    if (!event.detail?.authenticated) window.__EDDU_NEON_CONNECTED = false;
  });
})();
