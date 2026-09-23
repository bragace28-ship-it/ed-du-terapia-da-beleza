const STORAGE_KEY = 'eddu_v33_block03_comandas';

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { commands: [], events: [] };
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function commandTotal(command) {
  return money((command.items || []).reduce((sum, item) => sum + money(item.unitPrice) * Math.max(0, Number(item.quantity) || 0), 0));
}

function fingerprint(input) {
  return [
    input.clientId || '',
    input.appointmentId || '',
    input.serviceId || '',
    Number(input.quantity) || 0,
    money(input.unitPrice),
    input.date || ''
  ].join('|');
}

function addCommand(input = {}) {
  const state = readState();
  const now = new Date().toISOString();
  const idempotencyKey = String(input.idempotencyKey || [
    input.clientId || '',
    input.appointmentId || '',
    input.professionalId || '',
    input.date || ''
  ].join('|'));
  if (idempotencyKey && state.commands.some(x => x.idempotencyKey === idempotencyKey)) {
    throw new Error('duplicate_command');
  }
  const id = input.id || 'cmd-' + Date.now().toString(36);
  const command = {
    id,
    idempotencyKey,
    clientId: String(input.clientId || ''),
    appointmentId: String(input.appointmentId || ''),
    professionalId: String(input.professionalId || ''),
    status: 'open',
    notes: String(input.notes || ''),
    items: [],
    payments: [],
    createdAt: now,
    updatedAt: now
  };
  state.commands.push(command);
  state.events.push({ type: 'command_created', commandId: id, at: now });
  writeState(state);
  return command;
}

function addItem(commandId, input = {}) {
  const state = readState();
  const command = state.commands.find(x => x.id === commandId);
  if (!command) throw new Error('command_not_found');
  if (command.status === 'paid' || command.status === 'cancelled') throw new Error('command_not_editable');
  const item = {
    id: input.id || 'item-' + Date.now().toString(36),
    serviceId: String(input.serviceId || ''),
    description: String(input.description || 'Serviço'),
    size: String(input.size || ''),
    quantity: Math.max(1, Number(input.quantity) || 1),
    unitPrice: money(input.unitPrice),
    fingerprint: fingerprint(input)
  };
  if (command.items.some(x => x.fingerprint === item.fingerprint)) {
    throw new Error('duplicate_command_item');
  }
  command.items.push(item);
  command.updatedAt = new Date().toISOString();
  command.total = commandTotal(command);
  state.events.push({ type: 'command_item_added', commandId, itemId: item.id, at: command.updatedAt });
  writeState(state);
  return item;
}

function removeItem(commandId, itemId) {
  const state = readState();
  const command = state.commands.find(x => x.id === commandId);
  if (!command) throw new Error('command_not_found');
  command.items = command.items.filter(x => x.id !== itemId);
  command.total = commandTotal(command);
  command.updatedAt = new Date().toISOString();
  state.events.push({ type: 'command_item_removed', commandId, itemId, at: command.updatedAt });
  writeState(state);
  return command;
}

function closeCommand(commandId) {
  const state = readState();
  const command = state.commands.find(x => x.id === commandId);
  if (!command) throw new Error('command_not_found');
  if (!command.items.length) throw new Error('empty_command');
  if (command.status === 'cancelled' || command.status === 'paid') throw new Error('command_not_closable');
  command.total = commandTotal(command);
  command.status = 'awaiting_payment';
  command.updatedAt = new Date().toISOString();
  state.events.push({ type: 'command_ready_for_payment', commandId, total: command.total, at: command.updatedAt });
  writeState(state);
  return command;
}

function addPayment(commandId, input = {}) {
  const state = readState();
  const command = state.commands.find(x => x.id === commandId);
  if (!command) throw new Error('command_not_found');
  if (command.status === 'paid') throw new Error('command_already_paid');
  if (command.status !== 'awaiting_payment' && command.status !== 'partially_paid') throw new Error('command_not_payable');
  const amount = money(input.amount);
  if (amount <= 0) throw new Error('payment_amount_invalid');
  const payment = {
    id: input.id || 'pay-' + Date.now().toString(36),
    method: String(input.method || 'pix'),
    amount,
    externalId: String(input.externalId || ''),
    createdAt: new Date().toISOString()
  };
  const already = command.payments.some(x => x.externalId && payment.externalId && x.externalId === payment.externalId);
  if (already) throw new Error('duplicate_payment');
  const paidBefore = money(command.payments.reduce((sum, x) => sum + x.amount, 0));
  const remainingBefore = money(command.total - paidBefore);
  if (amount > remainingBefore) throw new Error('payment_exceeds_remaining');
  command.payments.push(payment);
  const paid = money(command.payments.reduce((sum, x) => sum + x.amount, 0));
  command.total = commandTotal(command);
  if (paid >= command.total) command.status = 'paid';
  else command.status = 'partially_paid';
  command.updatedAt = payment.createdAt;
  state.events.push({ type: 'payment_registered', commandId, paymentId: payment.id, method: payment.method, amount: payment.amount, at: payment.createdAt });
  writeState(state);
  return command;
}

function getCommand(commandId) {
  return readState().commands.find(x => x.id === commandId) || null;
}

function listCommands() {
  return readState().commands.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function listEvents() {
  return readState().events.slice();
}

function resetHomologationData() {
  writeState({ commands: [], events: [] });
}

window.EDDU_COMMANDS = Object.freeze({
  homologation: true,
  addCommand,
  addItem,
  removeItem,
  closeCommand,
  addPayment,
  getCommand,
  listCommands,
  listEvents,
  resetHomologationData,
  commandTotal
});


function uuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return '00000000-0000-4000-8000-' + String(Date.now()).padStart(12, '0');
}

async function createCommandNeon(input = {}) {
  if (!window.EDDU_NEON) throw new Error('neon_bridge_unavailable');
  const row = {
    id: input.id || uuid(),
    client_id: String(input.clientId || ''),
    professional_id: String(input.professionalId || ''),
    appointment_id: input.appointmentId ? String(input.appointmentId) : null,
    status: 'open',
    notes: String(input.notes || ''),
    total: 0
  };
  const result = await window.EDDU_NEON.insert('commands', row);
  return Array.isArray(result) ? result[0] : result;
}

async function addCommandItemNeon(commandId, input = {}) {
  if (!window.EDDU_NEON) throw new Error('neon_bridge_unavailable');
  const quantity = Math.max(1, Number(input.quantity) || 1);
  const unitPrice = money(input.unitPrice);
  const row = {
    id: input.id || uuid(),
    command_id: commandId,
    service_id: input.serviceId ? String(input.serviceId) : null,
    description: String(input.description || 'Serviço'),
    size: String(input.size || ''),
    quantity,
    unit_price: unitPrice,
    total: money(quantity * unitPrice)
  };
  const result = await window.EDDU_NEON.insert('command_items', row);
  return Array.isArray(result) ? result[0] : result;
}

async function refreshCommandTotalNeon(commandId) {
  const items = await window.EDDU_NEON.select('command_items', '?select=quantity,unit_price&command_id=eq.' + encodeURIComponent(commandId));
  const total = money((Array.isArray(items) ? items : []).reduce((sum, item) => sum + money(item.unit_price) * Math.max(0, Number(item.quantity) || 0), 0));
  const result = await window.EDDU_NEON.update('commands', '?id=eq.' + encodeURIComponent(commandId), { total });
  return Array.isArray(result) ? result[0] : result;
}

async function closeCommandNeon(commandId) {
  const result = await window.EDDU_NEON.update('commands', '?id=eq.' + encodeURIComponent(commandId), { status:'awaiting_payment' });
  return Array.isArray(result) ? result[0] : result;
}

async function addPaymentNeon(commandId, input = {}) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new Error('payment_amount_invalid');
  const row = {
    id: input.id || uuid(),
    command_id: commandId,
    amount,
    payment_method_id: input.paymentMethodId ? String(input.paymentMethodId) : null,
    status: 'pending',
    external_id: input.externalId ? String(input.externalId) : null
  };
  const result = await window.EDDU_NEON.insert('command_payments', row);
  return Array.isArray(result) ? result[0] : result;
}

function installCommandTestUi() {
  if (typeof document === 'undefined' || document.querySelector('[data-eddu-fn-command-ui]')) return;
  const anchor = [...document.querySelectorAll('button,a')].find(el => /Central de Comandas/i.test((el.textContent || '').trim()));
  if (!anchor?.parentElement) return;

  const trigger = document.createElement('button');
  trigger.type='button';
  trigger.className='eddu-fn-agenda-trigger';
  trigger.textContent='＋ Nova comanda (Neon)';
  trigger.setAttribute('data-eddu-fn-command-ui','trigger');

  const panel=document.createElement('section');
  panel.className='eddu-fn-agenda-panel';
  panel.setAttribute('data-eddu-fn-command-ui','panel');
  const title=document.createElement('h2'); title.textContent='Comanda — teste Neon'; panel.appendChild(title);
  const fields={};
  [['clientId','Cliente','Juliana'],['professionalId','Profissional','Mariana'],['serviceId','Serviço','Spa Capilar'],['unitPrice','Valor','150']].forEach(([key,labelText,placeholder])=>{
    const label=document.createElement('label'); label.className='eddu-fn-label'; label.textContent=labelText;
    const input=document.createElement('input'); input.className='eddu-fn-field'; input.placeholder=placeholder; input.name=key; input.required=true; fields[key]=input; label.appendChild(input); panel.appendChild(label);
  });
  const result=document.createElement('div'); result.className='eddu-fn-error'; result.setAttribute('aria-live','polite'); panel.appendChild(result);
  const save=document.createElement('button'); save.type='button'; save.className='eddu-fn-primary'; save.textContent='Criar comanda no Neon'; panel.appendChild(save);
  save.addEventListener('click',async()=>{
    result.textContent='Salvando no Neon…';
    try{
      const command=await createCommandNeon({clientId:fields.clientId.value.trim(),professionalId:fields.professionalId.value.trim()});
      await addCommandItemNeon(command.id,{description:fields.serviceId.value.trim(),unitPrice:Number(fields.unitPrice.value),quantity:1});
      await refreshCommandTotalNeon(command.id);
      await closeCommandNeon(command.id);
      result.textContent='Comanda criada e fechada para pagamento. ID: '+command.id;
    }catch(error){
      result.textContent='Neon: '+(error?.body?.message || error?.message || 'erro de persistência');
      console.error(error);
    }
  });
  anchor.parentElement.insertBefore(trigger,anchor);
  anchor.parentElement.insertBefore(panel,anchor);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installCommandTestUi, {once:true});
  else installCommandTestUi();
}
