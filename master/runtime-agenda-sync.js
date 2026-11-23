/* ED & DU — agenda create/close/client visibility bridge.
   Additive runtime: preserves the approved Master V46 visual artifact. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = message => { try { if (typeof window.toast === 'function') window.toast(message); else alert(message); } catch (_) {} };
  const api = () => window.EDDU_NEON_API;
  const rows = key => Array.isArray(window.data?.[key]) ? window.data[key] : [];
  const localDate = value => {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  };
  const localTime = value => {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return '';
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  };
  function hydrateAppointment(row) {
    const client = rows('clients').find(x => x.id === row.client_id);
    const professional = rows('professionals').find(x => x.id === row.professional_id);
    const service = rows('services').find(x => x.id === row.service_id);
    return {
      ...row,
      date: row.date || localDate(row.starts_at),
      start: row.start || localTime(row.starts_at),
      end: row.end || localTime(row.ends_at),
      client: row.client || client?.name || '',
      professional: row.professional || professional?.name || '',
      service: row.service || service?.name || '',
      status: row.status || 'Confirmado'
    };
  }
  function refreshLocalAppointments() {
    window.data.appointments = rows('appointments').map(hydrateAppointment);
    try { if (typeof window.syncAgendaCalendarM === 'function') window.syncAgendaCalendarM(); } catch (_) {}
  }
  function resolveByName(list, name) {
    const needle = String(name || '').trim().toLocaleLowerCase('pt-BR');
    return list.find(x => String(x.name || '').trim().toLocaleLowerCase('pt-BR') === needle) || null;
  }
  function selectOptions(list, selected, placeholder) {
    return '<option value="">'+escapeHtml(placeholder)+'</option>'+list.map(item =>
      '<option value="'+escapeHtml(item.id)+'" '+(item.id===selected?'selected':'')+'>'+escapeHtml(item.name)+'</option>'
    ).join('');
  }
  function openAdd(day) {
    const date = day || localDate(new Date());
    const clients = rows('clients').filter(x => String(x.status || 'Ativo').toLowerCase() !== 'inativo');
    const professionals = rows('professionals').filter(x => String(x.status || 'Ativo').toLowerCase() !== 'inativo');
    const services = rows('services').filter(x => x.active !== false && String(x.status || 'Ativo').toLowerCase() !== 'inativo');
    const clientField = clients.length
      ? '<select id="aptClientId" required>'+selectOptions(clients, '', 'Selecione o cliente')+'</select>'
      : '<input id="aptClientName" placeholder="Nome do cliente" required>';
    const professionalField = professionals.length
      ? '<select id="aptProfessionalId" required>'+selectOptions(professionals, '', 'Selecione o profissional')+'</select>'
      : '<input id="aptProfessionalName" placeholder="Profissional" required>';
    const serviceField = services.length
      ? '<select id="aptServiceId" required>'+selectOptions(services, '', 'Selecione o serviço')+'</select>'
      : '<input id="aptServiceName" placeholder="Serviço" required>';
    window.views.agendaAdd = () =>
      '<h2>Adicionar agendamento</h2><p class="sub">Novo atendimento diretamente na Agenda.</p>'+
      '<div class="card"><label>Cliente</label>'+clientField+
      '<label>Profissional</label>'+professionalField+
      '<label>Serviço</label>'+serviceField+
      '<div class="row"><div><label>Data</label><input id="aptDate" type="date" value="'+escapeHtml(date)+'" required></div><div><label>Início</label><input id="aptStart" type="time" value="10:00" required></div></div>'+
      '<div class="row"><div><label>Término</label><input id="aptEnd" type="time" value="11:00" required></div><div><label>Status</label><select id="aptStatus"><option value="Confirmado">Confirmado</option><option value="Pendente">Pendente</option></select></div></div>'+
      '<div class="action-row"><button id="edduSaveAppointment" type="button" class="btn primary full">Salvar agendamento</button><button id="edduCancelAppointment" type="button" class="btn full">Cancelar</button></div></div>';
    window.openSheet('agendaAdd');
  }
  let saving = false;
  async function saveAdd() {
    if (saving) return;
    const date = $('aptDate')?.value, start = $('aptStart')?.value, end = $('aptEnd')?.value;
    const clientId = $('aptClientId')?.value || null;
    const professionalId = $('aptProfessionalId')?.value || null;
    const serviceId = $('aptServiceId')?.value || null;
    const client = clientId ? rows('clients').find(x => x.id === clientId) : null;
    const professional = professionalId ? rows('professionals').find(x => x.id === professionalId) : null;
    const service = serviceId ? rows('services').find(x => x.id === serviceId) : null;
    const clientName = client?.name || $('aptClientName')?.value.trim() || '';
    const professionalName = professional?.name || $('aptProfessionalName')?.value.trim() || '';
    const serviceName = service?.name || $('aptServiceName')?.value.trim() || '';
    if (!date || !start || !end || !clientName || !professionalName || !serviceName) return toast('Preencha cliente, profissional, serviço, data e horários.');
    if (end <= start) return toast('O término deve ser posterior ao início.');
    if (!api() || window.__EDDU_NEON_READY !== true || window.__EDDU_NEON_CONNECTED !== true) return toast('Aguarde a conexão autenticada com o Neon antes de salvar.');
    const startDate = new Date(date+'T'+start+':00');
    const endDate = new Date(date+'T'+end+':00');
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return toast('Data ou horário inválido.');
    const candidate = { date, start, end };
    if (rows('blocks').some(b => b.date === date && start < b.end && end > b.start)) return toast('Este horário está bloqueado na Agenda.');
    if (rows('appointments').map(hydrateAppointment).some(a => a.date === date && !['Cancelado','Cancelled','canceled'].includes(String(a.status).toLowerCase()) && start < a.end && end > a.start)) return toast('Já existe atendimento nesse intervalo.');
    saving = true;
    const button = $('edduSaveAppointment');
    if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    try {
      const payload = {
        client_id: clientId,
        professional_id: professionalId,
        service_id: serviceId,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        status: $('aptStatus')?.value || 'Confirmado',
        source: 'professional_app',
        notes: null
      };
      const saved = await api().insert('appointments', payload);
      if (!saved?.id) throw new Error('O Neon não retornou o identificador do agendamento.');
      const hydrated = hydrateAppointment({ ...saved, client:clientName, professional:professionalName, service:serviceName });
      window.data.appointments = [hydrated, ...rows('appointments').filter(x => x.id !== saved.id)];
      try { if (typeof window.syncAgendaCalendarM === 'function') window.syncAgendaCalendarM(); } catch (_) {}
      try { if (typeof window.EDDU_NEON_SYNC === 'function') await window.EDDU_NEON_SYNC(); } catch (syncError) { console.error('[EDDU] post-appointment refresh failed', syncError); }
      refreshLocalAppointments();
      window.selectedDayM = date;
      toast('Agendamento salvo no Neon e sincronizado com a agenda do cliente.');
      window.closeSheet();
      if (typeof window.render === 'function') window.render('agenda');
      else window.openSheet('agenda');
    } catch (error) {
      console.error('[EDDU] appointment create failed', error);
      toast('Não foi possível salvar: '+String(error?.message || error));
    } finally {
      saving = false;
      const current = $('edduSaveAppointment');
      if (current) { current.disabled = false; current.textContent = 'Salvar agendamento'; }
    }
  }
  function closeModal() {
    try { window.closeSheet(); } catch (_) {}
    document.body.classList.remove('sheet-open');
    const shade = $('shade');
    if (shade) { shade.classList.remove('show'); shade.style.display='none'; }
  }
  document.addEventListener('click', event => {
    const close = event.target?.closest?.('.close,[data-eddu-close]');
    if (close) {
      event.preventDefault(); event.stopImmediatePropagation(); closeModal(); return;
    }
    const save = event.target?.closest?.('#edduSaveAppointment');
    if (save) {
      event.preventDefault(); event.stopImmediatePropagation(); saveAdd(); return;
    }
    const cancel = event.target?.closest?.('#edduCancelAppointment');
    if (cancel) {
      event.preventDefault(); event.stopImmediatePropagation(); closeModal(); return;
    }
  }, true);
  window.openAgendaAddM = openAdd;
  window.saveAgendaAddM = saveAdd;

  function currentClientEmail() {
    const session = window.__EDDU_NEON_SESSION_DATA || {};
    const user = session.user || session.data?.user || {};
    return String(user.email || '').trim().toLowerCase();
  }
  function clientAppointmentsView() {
    refreshLocalAppointments();
    const email = currentClientEmail();
    const client = email ? rows('clients').find(x => String(x.email || '').trim().toLowerCase() === email) : null;
    if (!client) return '<h2>Meus agendamentos</h2><p class="sub">Não foi possível vincular este acesso a um cadastro de cliente. Solicite ao salão a associação do e-mail da sua conta ao cadastro.</p>';
    const items = rows('appointments').map(hydrateAppointment).filter(x => x.client_id === client.id).sort((a,b) => String(a.starts_at).localeCompare(String(b.starts_at)));
    if (!items.length) return '<h2>Meus agendamentos</h2><p class="sub">Você ainda não possui agendamentos.</p>';
    return '<h2>Meus agendamentos</h2>'+items.map(item =>
      '<div class="card"><b>'+escapeHtml(item.service || 'Atendimento')+'</b>'+
      '<p class="sub">'+escapeHtml(new Date(item.starts_at).toLocaleString('pt-BR'))+' · '+escapeHtml(item.professional || 'Profissional')+'</p>'+
      '<div class="row"><span>Status</span><b>'+escapeHtml(item.status)+'</b></div></div>'
    ).join('');
  }
  window.addEventListener('eddu-neon-data-loaded', event => {
    if (event.detail?.entity === 'appointments' || event.detail?.entity === 'clients' || event.detail?.entity === 'professionals' || event.detail?.entity === 'services') refreshLocalAppointments();
  });
  window.addEventListener('eddu-neon-sync-complete', refreshLocalAppointments);
  const priorAppointmentsView = window.views?.appointments;
  if (window.views) window.views.appointments = clientAppointmentsView;
  window.addEventListener('eddu-neon-session-changed', () => {
    if (window.views && priorAppointmentsView && window.views.appointments === clientAppointmentsView) window.views.appointments = clientAppointmentsView;
  });
  document.addEventListener('click', event => {
    const el = event.target?.closest?.('[onclick*="openAgendaAddM"]');
    if (!el) return;
    event.preventDefault(); event.stopImmediatePropagation();
    window.openAgendaAddM(window.selectedDayM);
  }, true);
  refreshLocalAppointments();
  window.EDDU_AGENDA_RUNTIME_READY = true;
})();
