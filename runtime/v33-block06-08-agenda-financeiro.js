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
    id: input.id || 'apt-' + Date.now().toString(36),
    professionalId: String(input.professionalId || ''),
    clientId: String(input.clientId || ''),
    serviceId: String(input.serviceId || ''),
    startAt: String(input.startAt || ''),
    endAt: String(input.endAt || ''),
    status: 'scheduled'
  };
  if (!item.startAt || !item.endAt) throw new Error('appointment_time_required');
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
    amount: Math.abs(Number(input.amount) || 0),
    dueDate: String(input.dueDate || ''),
    status: 'open',
    recurring: Boolean(input.recurring),
    source: String(input.source || 'manual')
  };
  if (!item.amount || !item.dueDate) throw new Error('payable_invalid');
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
    amount: Math.abs(Number(input.amount) || 0),
    dueDate: String(input.dueDate || ''),
    status: 'open',
    installments: Math.max(1, Number(input.installments) || 1)
  };
  if (!item.amount || !item.dueDate) throw new Error('receivable_invalid');
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
