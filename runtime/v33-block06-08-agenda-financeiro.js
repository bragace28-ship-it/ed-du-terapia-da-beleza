const KEY = 'eddu_v33_blocks06_08';

function state() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      payables: Array.isArray(parsed.payables) ? parsed.payables : [],
      receivables: Array.isArray(parsed.receivables) ? parsed.receivables : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : []
    };
  } catch {
    return { appointments: [], payables: [], receivables: [], blocks: [] };
  }
}
function save(s) {
  if (!Array.isArray(s.blocks)) s.blocks = [];
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function overlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(bStart).getTime() < new Date(aEnd).getTime();
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



function agendaDayKey(value) {
  return String(value || '').slice(0, 10);
}
function agendaMinutes(value) {
  const m = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
function agendaDayOfWeek(dateValue) {
  const d = new Date(String(dateValue || '') + 'T12:00:00');
  return Number.isFinite(d.getTime()) ? d.getDay() : NaN;
}
function agendaDurationHours(start, end) {
  const a = agendaMinutes(start), b = agendaMinutes(end);
  return Number.isFinite(a) && Number.isFinite(b) ? (b - a) / 60 : NaN;
}
function agendaNormalRule(dateValue, start, end) {
  const sm = agendaMinutes(start), em = agendaMinutes(end);
  const duration = agendaDurationHours(start, end);
  if (!Number.isFinite(sm) || !Number.isFinite(em) || !Number.isFinite(duration) || em <= sm) {
    return { ok: false, exceptional: false, reason: 'appointment_time_invalid' };
  }
  const dow = agendaDayOfWeek(dateValue);
  if (dow === 0 || dow === 1) {
    return { ok: true, exceptional: true, reason: 'exceptional_day' };
  }
  if (sm < 480 || em > 1080) {
    return { ok: false, exceptional: false, reason: 'outside_normal_hours' };
  }
  if (duration >= 2 && sm > 1020) {
    if (sm === 1080) return { ok: true, exceptional: true, reason: 'exceptional_18_for_long_procedure' };
    return { ok: false, exceptional: false, reason: 'long_procedure_last_normal_17' };
  }
  return { ok: true, exceptional: false, reason: 'normal' };
}
function agendaStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      payables: Array.isArray(parsed.payables) ? parsed.payables : [],
      receivables: Array.isArray(parsed.receivables) ? parsed.receivables : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : []
    };
  } catch {
    return { appointments: [], payables: [], receivables: [], blocks: [] };
  }
}
function saveAgendaStorage(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}
function appointmentOverlapsBlock(item, block) {
  return item.startAt < block.endAt && block.startAt < item.endAt;
}
function createAppointment(input = {}) {
  const s = agendaStorage();
  const item = {
    id: input.id || 'apt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    professionalId: String(input.professionalId || '').trim(),
    clientId: String(input.clientId || '').trim(),
    serviceId: String(input.serviceId || '').trim(),
    startAt: String(input.startAt || ''),
    endAt: String(input.endAt || ''),
    observations: String(input.observations || '').trim(),
    status: String(input.status || 'scheduled')
  };
  if (!item.clientId || !item.professionalId || !item.serviceId) throw new Error('appointment_fields_required');
  if (!item.startAt || !item.endAt) throw new Error('appointment_time_required');
  const startMs = new Date(item.startAt).getTime();
  const endMs = new Date(item.endAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) throw new Error('appointment_time_invalid');
  const dateValue = agendaDayKey(item.startAt);
  const start = item.startAt.slice(11, 16);
  const end = item.endAt.slice(11, 16);
  const rule = agendaNormalRule(dateValue, start, end);
  if (!rule.ok) throw new Error(rule.reason);
  if (s.appointments.some(x => x.id === item.id)) throw new Error('appointment_duplicate');
  const conflict = s.appointments.find(x =>
    x.professionalId === item.professionalId &&
    x.status !== 'cancelled' &&
    overlap(x.startAt, x.endAt, item.startAt, item.endAt)
  );
  if (conflict) throw new Error('professional_schedule_conflict');
  const blocked = s.blocks.find(x => x.professionalId === item.professionalId && appointmentOverlapsBlock(item, x));
  if (blocked) throw new Error('schedule_blocked');
  item.exceptional = rule.exceptional;
  item.scheduleType = rule.exceptional ? 'exceptional_pending' : 'normal';
  s.appointments.push(item);
  saveAgendaStorage(s);
  return item;
}
function cancelAppointment(id) {
  const s = agendaStorage();
  const item = s.appointments.find(x => x.id === id);
  if (!item) throw new Error('appointment_not_found');
  item.status = 'cancelled';
  saveAgendaStorage(s);
  return item;
}
function blockSchedule(input = {}) {
  const s = agendaStorage();
  const startAt = String(input.startAt || '');
  const endAt = String(input.endAt || '');
  const item = {
    id: input.id || 'blk-' + Date.now().toString(36),
    professionalId: String(input.professionalId || '').trim(),
    reason: String(input.reason || '').trim(),
    startAt,
    endAt
  };
  if (!item.professionalId || !item.startAt || !item.endAt || !item.reason) throw new Error('block_fields_required');
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) throw new Error('block_time_invalid');
  if (s.blocks.some(x => x.id === item.id)) throw new Error('block_duplicate');
  const conflict = s.appointments.find(x => x.professionalId === item.professionalId && x.status !== 'cancelled' && appointmentOverlapsBlock(item, x));
  if (conflict) throw new Error('block_has_appointment');
  s.blocks.push(item);
  saveAgendaStorage(s);
  return item;
}
function unblockSchedule(id) {
  const s = agendaStorage();
  const index = s.blocks.findIndex(x => x.id === id);
  if (index < 0) throw new Error('block_not_found');
  const removed = s.blocks.splice(index, 1)[0];
  saveAgendaStorage(s);
  return removed;
}
function appointmentsForDay(dateValue) {
  const key = agendaDayKey(dateValue);
  return agendaStorage().appointments
    .filter(x => x.status !== 'cancelled' && agendaDayKey(x.startAt) === key)
    .sort((a,b) => a.startAt.localeCompare(b.startAt));
}
function blocksForDay(dateValue) {
  const key = agendaDayKey(dateValue);
  return agendaStorage().blocks
    .filter(x => agendaDayKey(x.startAt) === key)
    .sort((a,b) => a.startAt.localeCompare(b.startAt));
}

window.EDDU_AGENDA_FINANCE = Object.freeze({
  homologation: true,
  createAppointment,
  cancelAppointment,
  blockSchedule,
  unblockSchedule,
  appointmentsForDay,
  blocksForDay,
  agendaNormalRule,
  createPayable,
  createReceivable,
  applyOcr,
  financialSummary,
  reset: () => saveAgendaStorage({ appointments: [], payables: [], receivables: [], blocks: [] })
});

function agendaEl(tag, className, textValue) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textValue !== undefined) el.textContent = textValue;
  return el;
}
function agendaInput(labelText, type, name, value) {
  const label = agendaEl('label', 'eddu-fn-label', labelText);
  const input = agendaEl('input', 'eddu-fn-field');
  input.type = type;
  input.name = name;
  input.required = true;
  if (value !== undefined) input.value = value;
  label.appendChild(input);
  return { label, input };
}
function agendaCalendarData(cursor) {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const start = (first.getDay() + 6) % 7;
  const out = [];
  for (let i = 0; i < start; i++) out.push(null);
  for (let d = 1; d <= days; d++) out.push(new Date(y, m, d));
  return out;
}
function initAgendaUi() {
  if (typeof document === 'undefined' || !window.EDDU_AGENDA_FINANCE) return;
  if (window.__EDDU_AGENDA_V33_READY) return;
  const originalOpenSheet = window.openSheet;
  if (typeof originalOpenSheet !== 'function') return;
  window.__EDDU_AGENDA_V33_READY = true;

  let cursor = new Date();
  cursor.setDate(1);
  let selectedDay = new Date().toISOString().slice(0, 10);

  function showError(node, code) {
    const messages = {
      appointment_fields_required: 'Preencha cliente, profissional e serviço.',
      appointment_time_required: 'Informe data, início e término.',
      appointment_time_invalid: 'Confira a data e os horários.',
      outside_normal_hours: 'O atendimento normal é de 08:00 a 18:00.',
      long_procedure_last_normal_17: 'Procedimentos com 2 horas ou mais têm último horário normal às 17:00. Às 18:00 somente como solicitação excepcional.',
      professional_schedule_conflict: 'Esse profissional já possui atendimento nesse horário.',
      schedule_blocked: 'Este horário está bloqueado na agenda.',
      appointment_duplicate: 'Este agendamento já existe.',
      block_fields_required: 'Informe profissional, início, término e motivo.',
      block_time_invalid: 'Confira o período do bloqueio.',
      block_has_appointment: 'Não é possível bloquear um horário que já possui atendimento.',
      block_duplicate: 'Este bloqueio já existe.'
    };
    node.textContent = messages[code] || 'Não foi possível concluir a operação.';
  }

  function renderAgenda() {
    const view = document.getElementById('view');
    if (!view) return;
    while (view.firstChild) view.removeChild(view.firstChild);

    const title = agendaEl('h2', '', 'Minha agenda');
    view.appendChild(title);

    const items = window.EDDU_AGENDA_FINANCE.appointmentsForDay(selectedDay);
    const blocks = window.EDDU_AGENDA_FINANCE.blocksForDay(selectedDay);
    const kpis = agendaEl('div', 'kpis');
    const kpi1 = agendaEl('div', 'kpi');
    kpi1.appendChild(agendaEl('b', '', String(items.length)));
    kpi1.appendChild(agendaEl('small', '', 'Atendimentos no dia'));
    const kpi2 = agendaEl('div', 'kpi');
    kpi2.appendChild(agendaEl('b', '', String(items.filter(x => x.status === 'scheduled').length)));
    kpi2.appendChild(agendaEl('small', '', 'Confirmados'));
    kpis.append(kpi1, kpi2);
    view.appendChild(kpis);

    const toolbar = agendaEl('div', 'eddu-fn-agenda-toolbar');
    const add = agendaEl('button', 'btn primary', '＋ Novo agendamento');
    add.type = 'button';
    const block = agendaEl('button', 'btn', '▣ Bloquear horário');
    block.type = 'button';
    toolbar.append(add, block);
    view.appendChild(toolbar);

    const calendar = agendaEl('section', 'eddu-fn-calendar');
    const head = agendaEl('div', 'eddu-fn-calendar-head');
    const prev = agendaEl('button', 'eddu-fn-calendar-nav', '‹');
    const month = agendaEl('div', 'eddu-fn-calendar-title', cursor.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}));
    const next = agendaEl('button', 'eddu-fn-calendar-nav', '›');
    prev.type = next.type = 'button';
    head.append(prev, month, next);
    calendar.appendChild(head);

    const week = agendaEl('div', 'eddu-fn-calendar-week');
    ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].forEach(x => week.appendChild(agendaEl('span', '', x)));
    calendar.appendChild(week);

    const grid = agendaEl('div', 'eddu-fn-calendar-grid');
    agendaCalendarData(cursor).forEach(day => {
      if (!day) { grid.appendChild(agendaEl('div', 'eddu-fn-day empty')); return; }
      const key = day.toISOString().slice(0,10);
      const hasItems = window.EDDU_AGENDA_FINANCE.appointmentsForDay(key).length > 0;
      const hasBlocks = window.EDDU_AGENDA_FINANCE.blocksForDay(key).length > 0;
      const btn = agendaEl('button', 'eddu-fn-day ' + (hasItems || hasBlocks ? 'busy' : 'free') + (key === selectedDay ? ' selected' : ''));
      btn.type = 'button';
      btn.appendChild(agendaEl('b', '', String(day.getDate())));
      btn.appendChild(agendaEl('small', '', hasItems ? '● agenda' : hasBlocks ? '● bloqueado' : 'livre'));
      btn.addEventListener('click', () => { selectedDay = key; renderAgenda(); });
      grid.appendChild(btn);
    });
    calendar.appendChild(grid);
    const legend = agendaEl('div', 'eddu-fn-calendar-legend');
    legend.appendChild(agendaEl('span', 'busy-dot', '● Dia com agenda/bloqueio'));
    legend.appendChild(agendaEl('span', 'free-dot', '● Dia sem cliente'));
    calendar.appendChild(legend);
    view.appendChild(calendar);

    const dayTitleDate = new Date(selectedDay + 'T12:00:00');
    const dayTitle = dayTitleDate.toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long'});
    view.appendChild(agendaEl('h3', 'eddu-fn-day-title', dayTitle.charAt(0).toUpperCase() + dayTitle.slice(1)));

    const rule = window.EDDU_AGENDA_FINANCE.agendaNormalRule(selectedDay, '08:00', '10:00');
    if (rule.exceptional) {
      const warning = agendaEl('div', 'eddu-fn-agenda-warning', '⚠️ Domingo e segunda-feira não têm atendimento normal. Solicitações excepcionais ficam pendentes de confirmação do profissional.');
      view.appendChild(warning);
    }

    const list = agendaEl('div', 'eddu-fn-agenda-list');
    items.forEach(item => {
      const card = agendaEl('article', 'eddu-fn-agenda-card');
      const top = agendaEl('div', 'eddu-fn-agenda-card-top');
      top.appendChild(agendaEl('strong', '', item.startAt.slice(11,16) + '–' + item.endAt.slice(11,16)));
      top.appendChild(agendaEl('span', item.exceptional ? 'eddu-fn-exceptional' : 'eddu-fn-confirmed', item.exceptional ? 'Solicitação excepcional' : 'Confirmado'));
      card.appendChild(top);
      card.appendChild(agendaEl('div', '', item.clientId + ' · ' + item.serviceId));
      card.appendChild(agendaEl('small', '', 'Profissional: ' + item.professionalId));
      if (item.observations) card.appendChild(agendaEl('p', 'eddu-fn-observation', 'Observações: ' + item.observations));
      const cancel = agendaEl('button', 'btn', 'Cancelar atendimento');
      cancel.type = 'button';
      cancel.addEventListener('click', () => {
        window.EDDU_AGENDA_FINANCE.cancelAppointment(item.id);
        renderAgenda();
      });
      card.appendChild(cancel);
      list.appendChild(card);
    });
    blocks.forEach(item => {
      const card = agendaEl('article', 'eddu-fn-agenda-card eddu-fn-block-card');
      card.appendChild(agendaEl('strong', '', 'Bloqueio · ' + item.startAt.slice(11,16) + '–' + item.endAt.slice(11,16)));
      card.appendChild(agendaEl('small', '', 'Profissional: ' + item.professionalId));
      card.appendChild(agendaEl('p', 'eddu-fn-observation', 'Motivo: ' + item.reason));
      const unblock = agendaEl('button', 'btn', 'Liberar horário');
      unblock.type = 'button';
      unblock.addEventListener('click', () => { window.EDDU_AGENDA_FINANCE.unblockSchedule(item.id); renderAgenda(); });
      card.appendChild(unblock);
      list.appendChild(card);
    });
    if (!items.length && !blocks.length) {
      list.appendChild(agendaEl('div', 'card', 'Nenhum cliente ou bloqueio cadastrado neste dia.'));
    }
    view.appendChild(list);

    add.addEventListener('click', () => openAppointmentForm());
    block.addEventListener('click', () => openBlockForm());
    prev.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); renderAgenda(); });
    next.addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); renderAgenda(); });
  }

  function openAppointmentForm() {
    const view = document.getElementById('view');
    if (!view) return;
    while (view.firstChild) view.removeChild(view.firstChild);
    view.appendChild(agendaEl('h2', '', 'Novo agendamento'));
    view.appendChild(agendaEl('p', 'sub', 'Cadastre o atendimento diretamente na Minha Agenda. O horário é validado antes de salvar.'));
    const form = agendaEl('div', 'eddu-fn-form');
    const fields = {};
    [['Cliente','text','clientId',''],['Profissional','text','professionalId',''],['Serviço','text','serviceId',''],['Data','date','date',selectedDay],['Início','time','start','09:00'],['Término','time','end','10:00']].forEach(d => {
      const x = agendaInput(d[0], d[1], d[2], d[3]); fields[d[2]] = x.input; form.appendChild(x.label);
    });
    const obsLabel = agendaEl('label', 'eddu-fn-label', 'Observações ao profissional');
    const obs = agendaEl('textarea', 'eddu-fn-field', '');
    obs.name = 'observations';
    obs.rows = 3;
    obs.placeholder = 'Escreva uma observação para o profissional';
    obsLabel.appendChild(obs);
    form.appendChild(obsLabel);
    const note = agendaEl('div', 'eddu-fn-form-note', 'Horário normal: 08:00–18:00. Procedimentos com 2 horas ou mais: último horário normal às 17:00; às 18:00 apenas como solicitação excepcional. Domingo e segunda-feira: somente solicitação excepcional.');
    form.appendChild(note);
    const error = agendaEl('div', 'eddu-fn-error', '');
    form.appendChild(error);
    const actions = agendaEl('div', 'eddu-fn-actions');
    const cancel = agendaEl('button', 'btn', '← Voltar à agenda');
    const save = agendaEl('button', 'btn primary', 'Salvar agendamento');
    cancel.type = save.type = 'button';
    actions.append(cancel, save);
    form.appendChild(actions);
    view.appendChild(form);
    cancel.addEventListener('click', renderAgenda);
    save.addEventListener('click', () => {
      try {
        const date = fields.date.value;
        const start = fields.start.value;
        const end = fields.end.value;
        const result = window.EDDU_AGENDA_FINANCE.createAppointment({
          clientId: fields.clientId.value,
          professionalId: fields.professionalId.value,
          serviceId: fields.serviceId.value,
          startAt: date + 'T' + start,
          endAt: date + 'T' + end,
          observations: obs.value
        });
        selectedDay = date;
        renderAgenda();
        const message = result.exceptional ? 'Solicitação excepcional registrada para confirmação do profissional.' : 'Agendamento salvo na agenda.';
        if (typeof window.toast === 'function') window.toast(message);
      } catch (e) {
        showError(error, e && e.message);
      }
    });
  }

  function openBlockForm() {
    const view = document.getElementById('view');
    if (!view) return;
    while (view.firstChild) view.removeChild(view.firstChild);
    view.appendChild(agendaEl('h2', '', 'Bloquear horário'));
    view.appendChild(agendaEl('p', 'sub', 'Bloqueie um período da agenda de um profissional. O bloqueio impede novos atendimentos no intervalo.'));
    const form = agendaEl('div', 'eddu-fn-form');
    const fields = {};
    [['Profissional','text','professionalId',''],['Data','date','date',selectedDay],['Início','time','start','08:00'],['Término','time','end','09:00'],['Motivo','text','reason','']].forEach(d => {
      const x = agendaInput(d[0], d[1], d[2], d[3]); fields[d[2]] = x.input; form.appendChild(x.label);
    });
    const error = agendaEl('div', 'eddu-fn-error', '');
    form.appendChild(error);
    const actions = agendaEl('div', 'eddu-fn-actions');
    const cancel = agendaEl('button', 'btn', '← Voltar à agenda');
    const save = agendaEl('button', 'btn primary', 'Bloquear horário');
    cancel.type = save.type = 'button';
    actions.append(cancel, save);
    form.appendChild(actions);
    view.appendChild(form);
    cancel.addEventListener('click', renderAgenda);
    save.addEventListener('click', () => {
      try {
        window.EDDU_AGENDA_FINANCE.blockSchedule({
          professionalId: fields.professionalId.value,
          startAt: fields.date.value + 'T' + fields.start.value,
          endAt: fields.date.value + 'T' + fields.end.value,
          reason: fields.reason.value
        });
        selectedDay = fields.date.value;
        renderAgenda();
        if (typeof window.toast === 'function') window.toast('Horário bloqueado na agenda.');
      } catch (e) {
        showError(error, e && e.message);
      }
    });
  }

  const originalAgendaOpen = window.openSheet;
  window.openSheet = function(key) {
    if (key === 'agenda') {
      document.body.classList.add('sheet-open');
      const shade = document.getElementById('shade');
      if (shade) shade.classList.add('show');
      renderAgenda();
      return;
    }
    originalAgendaOpen(key);
    const shade = document.querySelector('.sheet');
    if (shade) shade.scrollTop = 0;
  };

  window.EDDU_AGENDA_V33 = Object.freeze({
    render: renderAgenda,
    openAppointmentForm,
    openBlockForm
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {}, { once: true });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAgendaUi, { once: true });
  else initAgendaUi();
}
