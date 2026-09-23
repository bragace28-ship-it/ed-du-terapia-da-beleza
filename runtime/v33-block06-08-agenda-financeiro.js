const KEY = 'eddu_v33_blocks06_08';

function state() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{"appointments":[],"payables":[],"receivables":[]}'); }
  catch { return { appointments: [], payables: [], receivables: [] }; }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); return s; }
function overlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(bStart).getTime() < new Date(aEnd).getTime();
}

function createAppointment(input = {}) {
  const s = state();
  const item = {
    id: input.id || 'apt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    professionalId: String(input.professionalId || ''),
    clientId: String(input.clientId || ''),
    serviceId: String(input.serviceId || ''),
    startAt: String(input.startAt || ''),
    endAt: String(input.endAt || ''),
    status: 'scheduled'
  };
  if (!item.startAt || !item.endAt) throw new Error('appointment_time_required');
  const startMs = new Date(item.startAt).getTime();
  const endMs = new Date(item.endAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) throw new Error('appointment_time_invalid');
  if (s.appointments.some(x => x.id === item.id)) throw new Error('appointment_duplicate');
  const conflict = s.appointments.find(x =>
    x.professionalId === item.professionalId &&
    x.status !== 'cancelled' &&
    overlap(x.startAt, x.endAt, item.startAt, item.endAt)
  );
  if (conflict) throw new Error('professional_schedule_conflict');
  s.appointments.push(item);
  save(s);
  return item;
}

function cancelAppointment(id) {
  const s = state();
  const item = s.appointments.find(x => x.id === id);
  if (!item) throw new Error('appointment_not_found');
  item.status = 'cancelled';
  save(s);
  return item;
}

function createPayable(input = {}) {
  const s = state();
  const item = {
    id: input.id || 'pay-' + Date.now().toString(36),
    supplier: String(input.supplier || ''),
    description: String(input.description || ''),
    amount: Number(input.amount),
    dueDate: String(input.dueDate || ''),
    status: 'open',
    recurring: Boolean(input.recurring),
    source: String(input.source || 'manual')
  };
  if (!Number.isFinite(item.amount) || item.amount <= 0 || !item.dueDate) throw new Error('payable_invalid');
  s.payables.push(item);
  save(s);
  return item;
}

function createReceivable(input = {}) {
  const s = state();
  const item = {
    id: input.id || 'rec-' + Date.now().toString(36),
    clientId: String(input.clientId || ''),
    commandId: String(input.commandId || ''),
    amount: Number(input.amount),
    dueDate: String(input.dueDate || ''),
    status: 'open',
    installments: Math.max(1, Number(input.installments) || 1)
  };
  if (!Number.isFinite(item.amount) || item.amount <= 0 || !item.dueDate) throw new Error('receivable_invalid');
  s.receivables.push(item);
  save(s);
  return item;
}

function applyOcr(text = '') {
  const source = String(text);
  const amountMatch = source.match(/(?:R\$\s*)?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:\.[0-9]{2}))/);
  const dateMatch = source.match(/([0-3][0-9])\/(0[1-9]|1[0-2])\/((?:20)\d{2})/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/\./g,'').replace(',','.')) : 0;
  const dueDate = dateMatch ? dateMatch[3] + '-' + dateMatch[2] + '-' + dateMatch[1] : '';
  return { amount, dueDate, confidence: amount && dueDate ? 0.92 : amount ? 0.61 : 0.2, requiresConfirmation: true };
}

function financialSummary() {
  const s = state();
  const payableOpen = s.payables.filter(x => x.status === 'open').reduce((a,x) => a + x.amount, 0);
  const receivableOpen = s.receivables.filter(x => x.status === 'open').reduce((a,x) => a + x.amount, 0);
  return { payableOpen, receivableOpen, netOpen: receivableOpen - payableOpen };
}

window.EDDU_AGENDA_FINANCE = Object.freeze({
  homologation: true,
  createAppointment,
  cancelAppointment,
  createPayable,
  createReceivable,
  applyOcr,
  financialSummary,
  reset: () => save({ appointments: [], payables: [], receivables: [] })
});


function initAgendaUi() {
  if (typeof document === 'undefined' || !window.EDDU_AGENDA_FINANCE) return;
  const pageText = document.body?.textContent || '';
  const isAgenda = /Central de Comandas/i.test(pageText) && /(segunda|terça|quarta|quinta|sexta|sábado|domingo)/i.test(pageText);
  if (!isAgenda || document.querySelector('[data-eddu-fn-agenda-ui]')) return;

  const centralButton = [...document.querySelectorAll('button, a')].find(el => /Central de Comandas/i.test((el.textContent || '').trim()));
  const anchor = centralButton || [...document.querySelectorAll('h1,h2,h3,section,div')].find(el => /Central de Comandas/i.test((el.textContent || '').trim()) && el.children.length < 4);
  if (!anchor?.parentElement) return;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'eddu-fn-agenda-trigger';
  trigger.textContent = '＋ Novo agendamento';
  trigger.setAttribute('data-eddu-fn-agenda-ui', 'trigger');

  const panel = document.createElement('section');
  panel.className = 'eddu-fn-agenda-panel';
  panel.setAttribute('data-eddu-fn-agenda-ui', 'panel');

  const title = document.createElement('h2');
  title.textContent = 'Agendamentos adicionados';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.className = 'eddu-fn-agenda-list';
  panel.appendChild(list);

  const overlay = document.createElement('div');
  overlay.className = 'eddu-fn-overlay';
  overlay.setAttribute('data-eddu-fn-agenda-ui', 'overlay');

  const dialog = document.createElement('div');
  dialog.className = 'eddu-fn-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  const h = document.createElement('h2');
  h.textContent = 'Novo agendamento';
  dialog.appendChild(h);
  const help = document.createElement('p');
  help.textContent = 'Adicione o atendimento diretamente à agenda. O horário fica salvo neste dispositivo durante a homologação.';
  dialog.appendChild(help);

  const fields = {};
  const defs = [
    ['clientId', 'Cliente', 'text', 'Juliana'],
    ['professionalId', 'Profissional', 'text', 'Mariana'],
    ['serviceId', 'Serviço', 'text', 'Spa Capilar'],
    ['date', 'Data', 'date', ''],
    ['start', 'Início', 'time', ''],
    ['end', 'Fim', 'time', '']
  ];
  defs.forEach(([key, labelText, type, placeholder]) => {
    const label = document.createElement('label');
    label.textContent = labelText;
    label.className = 'eddu-fn-label';
    const input = document.createElement('input');
    input.className = 'eddu-fn-field';
    input.type = type;
    input.placeholder = placeholder;
    input.required = true;
    input.name = key;
    fields[key] = input;
    label.appendChild(input);
    dialog.appendChild(label);
  });

  const error = document.createElement('div');
  error.className = 'eddu-fn-error';
  error.setAttribute('aria-live', 'polite');
  dialog.appendChild(error);

  const actions = document.createElement('div');
  actions.className = 'eddu-fn-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'eddu-fn-secondary';
  cancel.textContent = 'Cancelar';
  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'eddu-fn-primary';
  saveButton.textContent = 'Salvar agendamento';
  actions.append(cancel, saveButton);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);

  const today = new Date();
  fields.date.value = today.toISOString().slice(0, 10);
  fields.start.value = '09:00';
  fields.end.value = '10:00';

  function close() {
    overlay.classList.remove('is-open');
    error.textContent = '';
  }

  function render() {
    while (list.firstChild) list.removeChild(list.firstChild);
    const items = state().appointments.filter(x => x.status !== 'cancelled').sort((a,b) => a.startAt.localeCompare(b.startAt));
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'eddu-fn-agenda-empty';
      empty.textContent = 'Nenhum novo agendamento cadastrado ainda.';
      list.appendChild(empty);
      return;
    }
    items.forEach(item => {
      const card = document.createElement('article');
      card.className = 'eddu-fn-agenda-card';
      const when = document.createElement('strong');
      const start = new Date(item.startAt);
      const end = new Date(item.endAt);
      when.textContent = start.toLocaleDateString('pt-BR') + ' · ' + start.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'}) + '–' + end.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
      const who = document.createElement('span');
      who.textContent = item.clientId + ' · ' + item.serviceId;
      card.append(when, who);
      list.appendChild(card);
    });
  }

  trigger.addEventListener('click', () => {
    error.textContent = '';
    overlay.classList.add('is-open');
    fields.clientId.focus();
  });
  cancel.addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  saveButton.addEventListener('click', async () => {
    error.textContent = '';
    if (dialog.querySelector('input:invalid')) {
      error.textContent = 'Preencha todos os campos.';
      return;
    }
    try {
      const startAt = fields.date.value + 'T' + fields.start.value;
      const endAt = fields.date.value + 'T' + fields.end.value;
      if (window.EDDU_AGENDA_FINANCE_NEON?.createAppointmentNeon) {
        await window.EDDU_AGENDA_FINANCE_NEON.createAppointmentNeon({
          clientId: fields.clientId.value.trim(),
          professionalId: fields.professionalId.value.trim(),
          serviceId: fields.serviceId.value.trim(),
          startAt,
          endAt
        });
      } else {
        window.EDDU_AGENDA_FINANCE.createAppointment({
          clientId: fields.clientId.value.trim(),
          professionalId: fields.professionalId.value.trim(),
          serviceId: fields.serviceId.value.trim(),
          startAt,
          endAt
        });
      }
      render();
      close();
    } catch (err) {
      const messages = {
        appointment_time_invalid: 'Confira a data e os horários.',
        professional_schedule_conflict: 'Esse profissional já possui atendimento nesse horário.',
        appointment_duplicate: 'Este agendamento já existe.'
      };
      error.textContent = messages[err?.message] || 'Neon: ' + (err?.body?.message || err?.message || 'não foi possível salvar o agendamento.');
    }
  });

  if (centralButton) {
    centralButton.parentElement.insertBefore(trigger, centralButton);
    centralButton.parentElement.insertBefore(panel, centralButton);
  } else {
    anchor.parentElement.insertBefore(trigger, anchor);
    anchor.parentElement.insertBefore(panel, anchor);
  }
  document.body.appendChild(overlay);
  render();
}

if (typeof document !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAgendaUi, { once: true });
} else if (typeof document !== 'undefined') {
  initAgendaUi();
}


function uuidAgenda() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + String(Date.now()).padStart(12, '0');
}

async function createAppointmentNeon(input = {}) {
  if (!window.EDDU_NEON) throw new Error('neon_bridge_unavailable');
  const startMs = new Date(input.startAt || '').getTime();
  const endMs = new Date(input.endAt || '').getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) throw new Error('appointment_time_invalid');
  const existing = await window.EDDU_NEON.select('appointments',
    '?select=id&professional_id=eq.' + encodeURIComponent(String(input.professionalId || '')) +
    '&start_at=lt.' + encodeURIComponent(String(input.endAt || '')) +
    '&end_at=gt.' + encodeURIComponent(String(input.startAt || '')) +
    '&status=neq.cancelled&limit=1'
  );
  if (Array.isArray(existing) && existing.length) throw new Error('professional_schedule_conflict');
  const row = {
    id: input.id || uuidAgenda(),
    professional_id: String(input.professionalId || ''),
    client_id: String(input.clientId || ''),
    service_id: String(input.serviceId || ''),
    start_at: String(input.startAt || ''),
    end_at: String(input.endAt || ''),
    status: 'scheduled'
  };
  const result = await window.EDDU_NEON.insert('appointments', row);
  return Array.isArray(result) ? result[0] : result;
}

async function createPayableNeon(input = {}) {
  if (!window.EDDU_NEON) throw new Error('neon_bridge_unavailable');
  const amount=Number(input.amount);
  if (!Number.isFinite(amount) || amount<=0 || !input.dueDate) throw new Error('payable_invalid');
  const row={id:input.id||uuidAgenda(),supplier:String(input.supplier||''),description:String(input.description||''),amount,due_date:String(input.dueDate),status:'open',recurring:Boolean(input.recurring),source:String(input.source||'manual')};
  const result=await window.EDDU_NEON.insert('financial_transactions',row);
  return Array.isArray(result)?result[0]:result;
}

async function createReceivableNeon(input = {}) {
  if (!window.EDDU_NEON) throw new Error('neon_bridge_unavailable');
  const amount=Number(input.amount);
  if (!Number.isFinite(amount) || amount<=0 || !input.dueDate) throw new Error('receivable_invalid');
  const row={id:input.id||uuidAgenda(),client_id:input.clientId?String(input.clientId):null,command_id:input.commandId?String(input.commandId):null,amount,due_date:String(input.dueDate),status:'open',type:'receivable'};
  const result=await window.EDDU_NEON.insert('financial_transactions',row);
  return Array.isArray(result)?result[0]:result;
}

window.EDDU_AGENDA_FINANCE_NEON=Object.freeze({createAppointmentNeon,createPayableNeon,createReceivableNeon});
