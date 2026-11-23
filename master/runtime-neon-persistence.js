/* ED & DU — Neon write-through persistence. Neon PostgreSQL is the only source of truth. */
(function () {
  'use strict';
  const TABLES = {
    clients:'clients', professionals:'professionals', services:'services', products:'products',
    appointments:'appointments', appointmentServices:'appointment_services', commands:'commands', commandItems:'command_items',
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
  function dataClientId(name) {
    if (!name || !Array.isArray(window.data?.clients)) return null;
    const match = window.data.clients.find(client => String(client.name || client.nome || '').trim().toLowerCase() === String(name).trim().toLowerCase());
    return match?.id || null;
  }
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
      row.client_id = row.client_id || row.clientId || dataClientId(row.client);
      row.professional_id = row.professional_id || row.professionalId;
      row.appointment_id = row.appointment_id || row.appointmentId;
      row.subtotal = row.subtotal ?? row.grossAmount ?? row.total;
      row.total = row.total ?? row.netAmount ?? row.amount ?? row.subtotal ?? 0;
      row.discount = row.discount ?? row.discountAmount ?? 0;
    } else if (entity === 'command_items') {
      row.command_id = row.command_id || row.commandId;
      row.service_id = row.service_id || row.serviceId;
      row.product_id = row.product_id || row.productId;
      row.professional_id = row.professional_id || row.professionalId;
      row.item_type = row.item_type || 'service';
      row.description = row.description || row.service || row.name || 'Item da comanda';
      row.quantity = row.quantity ?? row.qty ?? 1;
      row.unit_price = row.unit_price ?? row.price ?? 0;
      row.total = row.total ?? Number(row.quantity) * Number(row.unit_price);
      row.commission_percent = row.commission_percent ?? row.commissionPercent ?? 0;
      delete row.__sourceIndex;
    } else if (entity === 'financial_transactions') {
      row.client_id = row.client_id || row.clientId;
      row.command_id = row.command_id || row.commandId;
      row.direction = row.direction || (row.type === 'expense' ? 'out' : row.type === 'income' ? 'in' : undefined);
      row.description = row.description || row.name;
    } else if (entity === 'payments' || entity === 'payables' || entity === 'receivables') {
      row.client_id = row.client_id || row.clientId;
      row.command_id = row.command_id || row.commandId;
      row.due_at = row.due_at || row.due_date || row.dueDate || row.due;
      if (entity === 'payables') {
        row.description = row.description || row.desc || row.name;
        row.supplier = row.supplier || row.origin || null;
        row.category = row.category || row.cat || null;
        row.metadata = row.metadata || { document:row.doc || null, note:row.note || null };
      }
      if (entity === 'receivables') {
        row.description = row.description || row.service || row.command || 'Recebível';
        row.total_amount = row.total_amount ?? row.total ?? row.amount;
        row.paid_amount = row.paid_amount ?? row.paid ?? 0;
        row.metadata = row.metadata || { client:row.client || null, command:row.command || null };
        if (row.command_id && !UUID.test(String(row.command_id))) delete row.command_id;
      }
    } else if (entity === 'anamneses') {
      row.client_id = row.client_id || row.clientId || dataClientId(row.client);
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
    } else if (entity === 'before_after_gallery') {
      row.client_id = row.client_id || row.clientId || dataClientId(row.client);
      row.before_ref = row.before_ref || row.beforeRef || row.before || null;
      row.after_ref = row.after_ref || row.afterRef || row.after || null;
      row.collage_ref = row.collage_ref || row.collageRef || row.collage || null;
    }
    return row;
  }
  let persistedIds = null;
  function capturePersistedIds() {
    const data = window.data && typeof window.data === 'object' ? window.data : {};
    persistedIds = {};
    for (const [key, entity] of Object.entries(TABLES)) persistedIds[entity] = new Set((Array.isArray(data[key]) ? data[key] : []).map(row => String(row?.id || '')).filter(id => UUID.test(id)));
  }
  window.addEventListener('eddu-neon-sync-complete', event => { if (event.detail?.connected) capturePersistedIds(); });
  async function persistSnapshot() {
    if (!window.EDDU_NEON_API) throw new Error('NEON_API_NOT_READY');
    if (window.__EDDU_NEON_READY !== true) throw new Error('NEON_NOT_READY');
    if (window.__EDDU_NEON_CONNECTED !== true) throw new Error('NEON_SYNC_NOT_READY');
    const data = window.data && typeof window.data === 'object' ? window.data : {};
    if (!persistedIds) capturePersistedIds();
    const report = [];
    for (const [key, entity] of Object.entries(TABLES)) {
      const rows = Array.isArray(data[key]) ? data[key] : [];
      const currentIds = new Set(rows.map(row => String(row?.id || '')).filter(id => UUID.test(id)));
      for (const oldId of persistedIds[entity] || []) if (!currentIds.has(oldId)) { await window.EDDU_NEON_API.delete(entity, oldId); report.push({ entity, id:oldId, operation:'delete' }); }
      for (let index = 0; index < rows.length; index++) {
        const source = rows[index];
        if (!source || typeof source !== 'object') continue;
        const payload = normalize(entity, source);
        if (entity === 'appointments' && (!payload.starts_at || !payload.ends_at)) continue;
        if (entity === 'agenda_blocks' && (!payload.starts_at || !payload.ends_at)) continue;
        if (entity === 'financial_transactions' && (!payload.type || !payload.direction || payload.amount == null || !payload.description)) continue;
        const previousId = source.id;
        const saved = UUID.test(String(source.id || ''))
          ? await window.EDDU_NEON_API.update(entity, source.id, payload)
          : await window.EDDU_NEON_API.insert(entity, payload);
        if (!saved?.id) throw new Error('NEON_WRITE_DID_NOT_RETURN_ID:' + entity);
        source.id = saved.id;
        if (entity === 'commands' && window.state?.activeCommandId === previousId) window.state.activeCommandId = saved.id;
        report.push({ entity, id:saved.id, operation:'upsert' });
        if (entity === 'command_items' && Number.isInteger(source.__sourceIndex)) {
          const command = (data.commands || []).find(item => item.id === source.command_id);
          if (command?.items?.[source.__sourceIndex]) command.items[source.__sourceIndex].id = saved.id;
        }
      }
      if (entity === 'commands') {
        if (!Array.isArray(data.commandItems)) data.commandItems = [];
        for (const command of rows) {
          if (!Array.isArray(command.items)) continue;
          const items = command.items;
          for (let index=0; index<items.length; index++) {
            const item=items[index] || {};
            let row=item.id ? data.commandItems.find(x=>x.id===item.id) : null;
            if(!row) row=data.commandItems.find(x=>x.command_id===command.id && !x.id && x.__sourceIndex===index);
            if(!row){row={command_id:command.id};data.commandItems.push(row);}
            const quantity=Number(item.quantity ?? item.qty ?? 1), unitPrice=Number(item.unit_price ?? item.price ?? 0);
            Object.assign(row,{command_id:command.id,item_type:item.item_type||'service',service_id:item.service_id||item.serviceId||null,product_id:item.product_id||item.productId||null,description:item.description||item.service||command.service||'Item da comanda',quantity,unit_price:unitPrice,total:Number(item.total ?? quantity*unitPrice),professional_id:item.professional_id||item.professionalId||command.professional_id||null,unit_cost:Number(item.unit_cost??item.cost??0),commission_percent:Number(item.commission_percent??item.commissionPercent??0),__sourceIndex:index});
          }
          data.commandItems=data.commandItems.filter(row=>row.command_id!==command.id || (row.id ? items.some(item=>item.id===row.id) : items.some((item,index)=>!item.id && row.__sourceIndex===index)));
        }
      }
      persistedIds[entity] = new Set(rows.map(row => String(row?.id || '')).filter(id => UUID.test(id)));
    }
    if (window.state && Array.isArray(data.commands)) {
      for (const command of data.commands) {
        command.items = (Array.isArray(data.commandItems) ? data.commandItems : []).filter(item => item.command_id === command.id).map(item => ({ ...item, service:item.description, qty:Number(item.quantity || 1), price:Number(item.unit_price || 0) }));
      }
      window.state.commands = data.commands;
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
  const nativeGetItem = Storage.prototype.getItem;
  const nativeRemoveItem = Storage.prototype.removeItem;
  const guardedKeys = new Set([
    'eddu_data','eddu_finance','eddu_state','eddu_master_data_v1','eddu_masterFinance',
    'eddu_v46_manual_coupons','eddu_master_coupons_v46',
    'eddu_v46_card_invoices','eddu_master_card_invoices_v46',
    'eddu_last_anamnesis','eddu_before_after_gallery','eddu_catalogo_servicos_v16'
  ]);
  Storage.prototype.getItem = function (key) {
    if (String(key) === 'eddu_masterFinance') {
      const data = window.data && typeof window.data === 'object' ? window.data : {};
      const payables = (Array.isArray(data.payables) ? data.payables : []).map(row => ({ ...row, desc:row.desc || row.description || '', origin:row.origin || row.supplier || '', cat:row.cat || row.category || '', due:row.due || row.due_at || '' }));
      const receivables = (Array.isArray(data.receivables) ? data.receivables : []).map(row => ({ ...row, client:row.client || row.metadata?.client || '', service:row.service || row.description || '', command:row.command || row.metadata?.command || '', total:row.total ?? row.total_amount ?? 0, paid:row.paid ?? row.paid_amount ?? 0, due:row.due || row.due_at || '' }));
      const commissions = Array.isArray(data.commissions) ? data.commissions : [];
      const sales = commissions.reduce((sum,row) => sum + Number(row.base_amount || 0), 0);
      const generated = commissions.reduce((sum,row) => sum + Number(row.commission_amount || 0), 0);
      const paid = commissions.reduce((sum,row) => sum + Number(row.paid_amount || 0), 0);
      return JSON.stringify({ payables, receivables, commissions:{ sales, rate:sales ? generated / sales * 100 : 0, proDue:Math.max(0,generated-paid), ed:Math.max(0,generated-paid), du:0 }, accounts:[] });
    }
    return nativeGetItem.call(this, key);
  };
  Storage.prototype.setItem = function (key, value) {
    if (guardedKeys.has(String(key))) {
      let parsed;
      try { parsed = JSON.parse(String(value)); } catch (_) { throw new Error('NEON_ONLY_INVALID_JSON:' + key); }
      if (!window.data || typeof window.data !== 'object') window.data = {};
      if (key === 'eddu_data') Object.assign(window.data, parsed);
      if (key === 'eddu_master_data_v1') {
        for (const field of Object.keys(window.data)) delete window.data[field];
        Object.assign(window.data, parsed);
      }
      if (key === 'eddu_masterFinance') {
        if (Array.isArray(parsed.payables)) window.data.payables = parsed.payables;
        if (Array.isArray(parsed.receivables)) window.data.receivables = parsed.receivables;
        if (Array.isArray(parsed.commissions)) window.data.commissions = parsed.commissions;
      }
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
      if (key === 'eddu_last_anamnesis') {
        const current = Array.isArray(window.data.anamneses) ? window.data.anamneses : [];
        window.data.anamneses = [parsed, ...current.filter(item => item.id !== parsed.id)];
      }
      if (key === 'eddu_before_after_gallery') window.data.beforeAfterGallery = Array.isArray(parsed) ? parsed : [];
      if (key === 'eddu_catalogo_servicos_v16') window.data.services = Array.isArray(parsed) ? parsed : [];
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
