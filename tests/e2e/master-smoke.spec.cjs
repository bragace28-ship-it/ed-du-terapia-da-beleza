const { test, expect } = require('@playwright/test');

test('Master V46 production loads with the production data guard', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('requestfailed', request => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'request failed' });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const flags = await page.evaluate(() => ({
    production: window.__EDDU_PRODUCTION_BUILD__ === true,
    guard: window.__EDDU_PRODUCTION_GUARD_ACTIVE === true,
    views: Boolean(window.views)
  }));
  expect(flags).toEqual({ production: true, guard: true, views: true });

  const bodyText = await page.locator('body').innerText();
  expect(bodyText, 'The visible UI must not print the literal undefined').not.toMatch(/\bundefined\b/i);
  expect(await page.title()).toContain('ED & DU');
  if (bodyText.includes('Acesso aos dados Master')) {
    expect(bodyText, 'Unauthenticated UI must not expose sample revenue').not.toContain('R$ 1.280');
    expect(bodyText, 'Unauthenticated UI must not expose sample goal progress').not.toContain('R$ 5.720');
    expect(bodyText, 'Unauthenticated UI must not expose sample ticket').not.toContain('R$ 160');
    expect(bodyText, 'Unauthenticated UI must not expose sample occupancy').not.toContain('92%');
    expect(bodyText, 'Unauthenticated UI must not expose sample goal percentage').not.toContain('18%');
  }

  const buttons = page.locator('button:visible');
  expect(await buttons.count(), 'Expected visible interactive controls').toBeGreaterThan(0);
  expect(pageErrors, 'Unhandled JavaScript exceptions').toEqual([]);
  expect(consoleErrors, 'Browser console errors').toEqual([]);
  expect(failedRequests, 'Failed network requests').toEqual([]);
});

test('Production agenda does not expose demonstration appointments', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/#e2e-agenda', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).toContain('Nenhum agendamento sincronizado.');
  expect(bodyText).not.toMatch(/Mariana|Juliana|Camila|Limpeza de Pele|Amanhã/i);
});

test('visible buttons are not all inert placeholders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const buttons = page.locator('button:visible:not([disabled])');
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);

  let actionable = 0;
  for (let i = 0; i < Math.min(count, 30); i++) {
    const button = buttons.nth(i);
    const text = (await button.innerText().catch(() => '')).trim();
    const onclick = await button.getAttribute('onclick');
    const type = await button.getAttribute('type');
    const hasListenerHint = Boolean(onclick) || Boolean(text) || type === 'submit';
    if (hasListenerHint) actionable++;
  }
  expect(actionable, 'Visible buttons should expose a label or action hook').toBeGreaterThan(0);
});


test('Agenda appointment save sends a schema-valid Neon payload (mocked Data API)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.waitForFunction(() => window.__EDDU_NEON_SYNCING !== true, null, { timeout: 10000 }).catch(() => {});

  const result = await page.evaluate(async () => {
    const ids = {
      client: '11111111-1111-4111-8111-111111111111',
      professional: '22222222-2222-4222-8222-222222222222',
      service: '33333333-3333-4333-8333-333333333333'
    };
    const tables = {
      clients: [{ id: ids.client, name: 'Cliente QA', active: true }],
      professionals: [{ id: ids.professional, name: 'Profissional QA', active: true }],
      services: [{ id: ids.service, name: 'Serviço QA', active: true, duration_minutes: 60 }],
      appointments: [], agenda_blocks: [], products: [], commands: [], financial_transactions: []
    };
    const writes = [];
    const makeBuilder = entity => {
      let operation = 'select', payload = null, filters = [];
      const builder = {
        select() { return builder; },
        eq(key, value) { filters.push(['eq', key, value]); return builder; },
        lt() { return builder; },
        gt() { return builder; },
        not() { return builder; },
        insert(value) { operation = 'insert'; payload = value; return builder; },
        limit(limit) {
          if (operation === 'insert') {
            const row = { id: '44444444-4444-4444-8444-444444444444', ...payload };
            tables[entity] = tables[entity] || [];
            tables[entity].push(row);
            writes.push({ entity, payload });
            return Promise.resolve({ data: [row], error: null });
          }
          let rows = tables[entity] || [];
          for (const [kind, key, value] of filters) {
            if (kind === 'eq') rows = rows.filter(row => String(row[key]) === String(value));
          }
          return Promise.resolve({ data: rows.slice(0, limit), error: null });
        }
      };
      return builder;
    };

    window.__EDDU_NEON_CLIENT = {
      auth: { getSession: async () => ({ data: { session: { user: { id: '55555555-5555-4555-8555-555555555555' } } } }) },
      from: entity => makeBuilder(entity)
    };
    window.__EDDU_NEON_READY = true;
    window.__EDDU_NEON_SYNCING = false;
    window.__EDDU_NEON_SYNC_STATUS = 'idle';
    localStorage.setItem('eddu_master_data_v1', JSON.stringify({
      clients: [], professionals: [], services: [], products: [], appointments: [], blocks: []
    }));
    localStorage.setItem('eddu_neon_id_map_v1', '{}');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');
    const fields = {
      aptClient: ids.client, aptProfessional: ids.professional, aptService: ids.service,
      aptDate: date, aptStart: '10:00', aptEnd: '11:00', aptStatus: 'Agendado'
    };
    for (const [id, value] of Object.entries(fields)) {
      const el = document.createElement(id === 'aptStatus' ? 'select' : 'input');
      el.id = id;
      el.value = value;
      document.body.appendChild(el);
    }
    const save = document.createElement('button');
    save.id = 'saveAgendaReal';
    save.textContent = 'Salvar agendamento';
    document.body.appendChild(save);

    await window.saveAgendaAddM();
    return {
      syncStatus: window.__EDDU_NEON_SYNC_STATUS,
      lastError: window.__EDDU_NEON_LAST_ERROR,
      write: writes.find(item => item.entity === 'appointments') || null,
      savedCount: tables.appointments.length
    };
  });

  expect(result.syncStatus).toBe('confirmed');
  expect(result.lastError).toBeFalsy();
  expect(result.savedCount).toBe(1);
  expect(result.write.payload.status).toBe('confirmed');
  expect(result.write.payload.service_id).toBe('33333333-3333-4333-8333-333333333333');
  expect(result.write.payload).not.toHaveProperty('source');
});

test('Full-day agenda blocks are persisted and reloaded from Neon (mocked Data API)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.waitForFunction(() => window.__EDDU_NEON_SYNCING !== true, null, { timeout: 10000 }).catch(() => {});

  const result = await page.evaluate(async () => {
    const tables = { clients: [], professionals: [], services: [], products: [], appointments: [], agenda_blocks: [], commands: [], financial_transactions: [] };
    const writes = [];
    let sequence = 0;
    const makeBuilder = entity => {
      let operation = 'select', payload = null;
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        lt() { return builder; },
        gt() { return builder; },
        not() { return builder; },
        insert(value) { operation = 'insert'; payload = value; return builder; },
        limit(limit) {
          if (operation === 'insert') {
            const row = { id: '66666666-6666-4666-8666-' + String(++sequence).padStart(12, '0'), ...payload };
            tables[entity] = tables[entity] || [];
            tables[entity].push(row);
            writes.push({ entity, payload });
            return Promise.resolve({ data: [row], error: null });
          }
          return Promise.resolve({ data: (tables[entity] || []).slice(0, limit), error: null });
        }
      };
      return builder;
    };
    window.__EDDU_NEON_CLIENT = { from: entity => makeBuilder(entity) };
    window.__EDDU_NEON_READY = true;
    window.__EDDU_NEON_SYNCING = false;
    window.__EDDU_NEON_SYNC_STATUS = 'idle';
    localStorage.setItem('eddu_master_data_v1', JSON.stringify({
      clients: [], professionals: [], services: [], products: [], appointments: [], blocks: []
    }));
    localStorage.setItem('eddu_neon_id_map_v1', '{}');

    const dateAfter = days => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    };
    const addField = (id, value) => {
      const el = document.createElement('input');
      el.id = id;
      el.value = value;
      document.body.appendChild(el);
    };

    addField('dayBlkDate', dateAfter(1));
    addField('dayBlkReason', 'Teste QA bloqueio A');
    const first = await window.saveAgendaDayBlockM();

    addField('blkDayDate', dateAfter(2));
    addField('blkDayReason', 'Teste QA bloqueio B');
    const second = await window.saveAgendaBlockDayM();

    return {
      first, second,
      syncStatus: window.__EDDU_NEON_SYNC_STATUS,
      rows: tables.agenda_blocks,
      writes: writes.filter(item => item.entity === 'agenda_blocks'),
      localBlocks: JSON.parse(localStorage.getItem('eddu_master_data_v1') || '{}').blocks || []
    };
  });

  expect(result.first).toBe(true);
  expect(result.second).toBe(true);
  expect(result.syncStatus).toBe('confirmed');
  expect(result.rows).toHaveLength(2);
  expect(result.writes).toHaveLength(2);
  console.log('QA full-day agenda blocks:', JSON.stringify(result.rows.map(row => ({ starts_at: row.starts_at, ends_at: row.ends_at, duration_ms: new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime() }))));
  for (const row of result.rows) {
    expect(row.professional_id).toBeNull();
    expect(new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()).toBe(24 * 60 * 60 * 1000);
  }
  expect(result.localBlocks).toHaveLength(2);
});


test('Booking screen uses real Neon records instead of seeded demo values', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.waitForFunction(() => window.__EDDU_NEON_SYNCING !== true, null, { timeout: 10000 }).catch(() => {});

  const result = await page.evaluate(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');
    const client = { id: '77777777-7777-4777-8777-777777777777', name: 'Cliente QA Real', active: true };
    const professional = { id: '88888888-8888-4888-8888-888888888888', name: 'Profissional QA Real', active: true };
    const service = { id: '99999999-9999-4999-8999-999999999999', name: 'Serviço QA Real', active: true, duration_minutes: 60, price: 135 };
    window.data = { clients: [client], professionals: [professional], services: [service], appointments: [], blocks: [] };
    window.v46BookingDay = day;
    window.v46BookingClient = client.id;
    window.v46BookingProfessional = professional.id;
    window.v46BookingService = service.id;
    window.v46BookingTime = '10:00';
    const html = window.views?.booking?.();
    return { html: String(html || ''), hasConfirmHandler: typeof window.v46ConfirmBooking === 'function' };
  });

  expect(result.hasConfirmHandler).toBe(true);
  expect(result.html).toContain('Cliente QA Real');
  expect(result.html).toContain('Profissional QA Real');
  expect(result.html).toContain('Serviço QA Real');
  expect(result.html).toContain('10:00');
  expect(result.html).not.toContain('Mariana');
  expect(result.html).not.toContain('Limpeza de Pele');
  expect(result.html).not.toContain('Profissional ED');
});
