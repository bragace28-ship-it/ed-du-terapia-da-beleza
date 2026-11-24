/* ED & DU — agenda create/close/client visibility bridge.
   Additive runtime: preserves the approved Master V46 visual artifact. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = message => { try { if (typeof window.toast === 'function') window.toast(message); else alert(message); } catch (_) {} };
  const api = () => window.EDDU_NEON_API;
  async function requireSession() {
    if (window.__EDDU_NEON_READY !== true) throw new Error(window.__EDDU_NEON_LAST_ERROR || 'O serviço Neon ainda está inicializando.');
    if (typeof window.EDDU_NEON_REFRESH_SESSION !== 'function') throw new Error('O serviço de sessão do Neon não foi inicializado.');
    const session = await window.EDDU_NEON_REFRESH_SESSION();
    window.__EDDU_NEON_SESSION = !!session;
    window.__EDDU_NEON_SESSION_DATA = session || null;
    if (!session) { window.__EDDU_NEON_AUTH_REQUIRED?.(); throw new Error('AUTH_REQUIRED'); }
    if (!api()) throw new Error('A conexão de dados do Neon não foi inicializada.');
    return session;
  }
  const rows = key => Array.isArray(window.data?.[key]) ? window.data[key] : [];
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
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
    const serviceLinks = rows('appointmentServices').filter(x => x.appointment_id === row.id);
    const linkedServices = serviceLinks.map(link => rows('services').find(x => x.id === link.service_id)).filter(Boolean);
    const serviceNames = linkedServices.map(x => x.name);
    const service = linkedServices[0] || rows('services').find(x => x.id === row.service_id);
    return {
      ...row,
      date: row.date || localDate(row.starts_at),
      start: row.start || localTime(row.starts_at),
      end: row.end || localTime(row.ends_at),
      client: row.client || client?.name || '',
      professional: row.professional || professional?.name || '',
      service: serviceNames.join(' + ') || row.service || service?.name || '',
      service_name: serviceNames.join(' + ') || row.service_name || service?.name || '',
      service_names: serviceNames.length ? serviceNames : (service?.name ? [service.name] : []),
      service_ids: serviceLinks.map(x => x.service_id),
      service_id: row.service_id || serviceLinks[0]?.service_id || service?.id || null,
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
    const clients = rows('clients').filter(x => x.active !== false && String(x.status || 'Ativo').toLowerCase() !== 'inativo');
    const professionals = rows('professionals').filter(x => x.active !== false && String(x.status || 'Ativo').toLowerCase() !== 'inativo');
    const services = rows('services').filter(x => x.active !== false && String(x.status || 'Ativo').toLowerCase() !== 'inativo');
    const clientField = '<select id="aptClientId" required>'+selectOptions(clients, window.__EDDU_PENDING_CLIENT_ID || '', 'Selecione o cliente')+'<option value="__NEW__">＋ Cadastrar novo cliente</option></select>'+
      (clients.length ? '' : '<p class="sub">Ainda não há clientes cadastrados. Use “Cadastrar novo cliente” para incluir o primeiro.</p>');
    const professionalSelected = window.__EDDU_PENDING_PROFESSIONAL_ID || '';
    const pendingServiceIds = Array.isArray(window.__EDDU_PENDING_SERVICE_IDS) ? window.__EDDU_PENDING_SERVICE_IDS : (window.__EDDU_PENDING_SERVICE_ID ? [window.__EDDU_PENDING_SERVICE_ID] : []);
    const professionalField = professionals.length
      ? '<select id="aptProfessionalId" required>'+selectOptions(professionals, professionalSelected, 'Selecione o profissional')+'</select><button type="button" class="btn full" onclick="window.openAgendaProfessionalCreateM()">＋ Cadastrar novo profissional</button>'
      : '<p class="sub">Nenhum profissional cadastrado no Neon. Cadastre agora para liberar a Agenda.</p><button type="button" class="btn full" onclick="window.openAgendaProfessionalCreateM()">＋ Cadastrar novo profissional</button><select id="aptProfessionalId" required disabled><option value="">Profissional indisponível</option></select>';
    const serviceField = services.length
      ? '<div id="aptServicesList" style="display:grid;gap:8px">'+services.map(item=>'<label class="row" style="align-items:flex-start;gap:10px;padding:9px;border:1px solid var(--border,#ddd);border-radius:10px"><input class="apt-service-checkbox" type="checkbox" value="'+escapeHtml(item.id)+'" data-price="'+Number(item.price_base ?? item.price ?? 0)+'" data-duration="'+Number(item.duration_minutes || 60)+'" '+(pendingServiceIds.includes(item.id)?'checked':'')+'><span style="flex:1"><b>'+escapeHtml(item.name)+'</b><small style="display:block">Base: '+money(item.price_base ?? item.price ?? 0)+(Number(item.price_long ?? item.price_base ?? item.price ?? 0)!==Number(item.price_base ?? item.price ?? 0)?' · Cabelo longo: '+money(item.price_long):'')+' · '+Number(item.duration_minutes || 60)+' min</small></span></label>').join('')+'</div><div id="aptServicesSummary" class="card" style="margin-top:10px"><b>Selecione um ou mais serviços</b></div>'
      : '<p class="sub">Nenhum serviço cadastrado no Neon. Cadastre agora para liberar a Agenda.</p><button type="button" class="btn full" onclick="window.openAgendaServiceCreateM()">＋ Cadastrar serviço</button>';
    window.__EDDU_PENDING_PROFESSIONAL_ID = null;
    window.__EDDU_PENDING_SERVICE_ID = null;
    window.__EDDU_PENDING_SERVICE_IDS = null;
    const pendingClientId = window.__EDDU_PENDING_CLIENT_ID || '';
    window.__EDDU_PENDING_CLIENT_ID = null;
    window.views.agendaAdd = () =>
      '<h2>Adicionar agendamento</h2><p class="sub">Novo atendimento diretamente na Agenda.</p>'+
      '<div class="card"><label>Cliente</label>'+clientField+
      '<label>Profissional</label>'+professionalField+
      '<label>Serviços do atendimento</label><p class="sub">Selecione quantos procedimentos forem necessários. Os valores aparecem somente nesta tela profissional.</p>'+serviceField+
      '<div class="row"><div><label>Data</label><input id="aptDate" type="date" value="'+escapeHtml(date)+'" required></div><div><label>Início</label><input id="aptStart" type="time" value="10:00" required></div></div>'+
      '<div class="row"><div><label>Término</label><input id="aptEnd" type="time" value="11:00" required></div><div><label>Status</label><select id="aptStatus"><option value="Confirmado">Confirmado</option><option value="Pendente">Pendente</option></select></div></div>'+
      '<div class="action-row"><button id="edduSaveAppointment" type="button" class="btn primary full">Salvar agendamento</button><button id="edduCancelAppointment" type="button" class="btn full">Cancelar</button></div></div>';
    window.openSheet('agendaAdd');
  }
  window.openAgendaProfessionalCreateM = function (requestedDate, requestedReturnRoute) {
    const returnRoute = requestedReturnRoute === 'command' ? 'command' : 'agenda';
    window.__EDDU_PROFESSIONAL_RETURN_ROUTE = returnRoute;
    window.__EDDU_PENDING_PROFESSIONAL_ID = $('aptProfessionalId')?.value || window.__EDDU_PENDING_PROFESSIONAL_ID || '';
    const date = requestedDate || $('aptDate')?.value || window.selectedDayM || localDate(new Date());
    window.views.agendaProfessionalCreate = () =>
      '<h2>Novo profissional</h2><p class="sub">Cadastre quem realizará os atendimentos. O registro será salvo no Neon.</p>'+
      '<label>Nome completo *</label><input id="aptNewProfessionalName" maxlength="160" placeholder="Nome do profissional" required>'+
      '<label>WhatsApp</label><input id="aptNewProfessionalPhone" maxlength="30" placeholder="(11) 99999-9999">'+
      '<label>E-mail</label><input id="aptNewProfessionalEmail" type="email" maxlength="254" placeholder="profissional@email.com">'+
      '<label>Especialidade</label><input id="aptNewProfessionalSpecialty" maxlength="160" placeholder="Ex.: Terapeuta capilar">'+
      '<label>Comissão (%)</label><input id="aptNewProfessionalCommission" type="number" min="0" max="100" step="0.01" value="30">'+
      '<div id="aptProfessionalError" role="alert" style="display:none;color:#b42318;margin:10px 0"></div>'+
      '<div class="action-row"><button type="button" class="btn primary full" onclick="window.saveAgendaProfessionalM(\''+escapeHtml(date)+'\')">Salvar profissional</button>'+
      '<button type="button" class="btn full" onclick="window.openAgendaAddM(\''+escapeHtml(date)+'\')">Voltar</button></div>';
    window.openSheet('agendaProfessionalCreate');
  };
  window.saveAgendaProfessionalM = async function (date) {
    const name = String($('aptNewProfessionalName')?.value || '').trim().replace(/\s+/g,' ');
    const phone = String($('aptNewProfessionalPhone')?.value || '').trim();
    const email = String($('aptNewProfessionalEmail')?.value || '').trim().toLowerCase();
    const specialty = String($('aptNewProfessionalSpecialty')?.value || '').trim();
    const commission = Number($('aptNewProfessionalCommission')?.value || 0);
    const error = $('aptProfessionalError');
    const fail = message => { if(error){error.textContent=message;error.style.display='block';} toast(message); };
    try {
      if(name.length<2) throw new Error('Informe o nome do profissional.');
      if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido ou deixe o campo vazio.');
      if(!Number.isFinite(commission)||commission<0||commission>100) throw new Error('A comissão deve estar entre 0 e 100%.');
      await requireSession();
      const saved=await api().insert('professionals',{name,phone:phone||null,email:email||null,specialty:specialty||null,commission_rate:commission,active:true});
      if(!saved?.id) throw new Error('O Neon não confirmou o cadastro do profissional.');
      window.data.professionals=[saved,...rows('professionals').filter(x=>x.id!==saved.id)];
      window.__EDDU_PENDING_PROFESSIONAL_ID=saved.id;
      toast('Profissional cadastrado no Neon.');
      const returnRoute=window.__EDDU_PROFESSIONAL_RETURN_ROUTE || 'agenda';
      window.__EDDU_PROFESSIONAL_RETURN_ROUTE=null;
      if(returnRoute==='command'){
        try { if(typeof window.EDDU_NEON_SYNC==='function') await window.EDDU_NEON_SYNC(); } catch(syncError) { console.error('[EDDU] professional post-save sync failed',syncError); }
        if(typeof window.render==='function') window.render('command'); else window.openSheet('command');
      } else openAdd(date);
    } catch(e) { console.error('[EDDU] professional create failed',e); fail('Não foi possível cadastrar o profissional: '+String(e?.message||e)); }
  };
  window.openAgendaServiceCreateM = function () {
    const date = $('aptDate')?.value || window.selectedDayM || localDate(new Date());
    window.views.agendaServiceCreate = () =>
      '<h2>Novo serviço</h2><p class="sub">Cadastre o procedimento e sua duração. O registro será salvo no Neon.</p>'+
      '<label>Nome do serviço *</label><input id="aptNewServiceName" maxlength="160" placeholder="Ex.: Terapia capilar" required>'+
      '<label>Descrição</label><textarea id="aptNewServiceDescription" rows="2" maxlength="1000" placeholder="Descrição do procedimento"></textarea>'+
      '<label>Preço (R$) *</label><input id="aptNewServicePrice" type="number" min="0" step="0.01" value="0" required>'+
      '<label>Duração (minutos) *</label><input id="aptNewServiceDuration" type="number" min="1" step="1" value="60" required>'+
      '<label>Preço cabelo longo (R$)</label><input id="aptNewServiceLongPrice" type="number" min="0" step="0.01" placeholder="Opcional">'+
      '<label>Custo do serviço (R$)</label><input id="aptNewServiceCost" type="number" min="0" step="0.01" value="0">'+
      '<div id="aptServiceError" role="alert" style="display:none;color:#b42318;margin:10px 0"></div>'+
      '<div class="action-row"><button type="button" class="btn primary full" onclick="window.saveAgendaServiceM(\''+escapeHtml(date)+'\')">Salvar serviço</button>'+
      '<button type="button" class="btn full" onclick="window.openAgendaAddM(\''+escapeHtml(date)+'\')">Voltar</button></div>';
    window.openSheet('agendaServiceCreate');
  };
  window.saveAgendaServiceM = async function (date) {
    const name=String($('aptNewServiceName')?.value||'').trim().replace(/\s+/g,' ');
    const description=String($('aptNewServiceDescription')?.value||'').trim();
    const price=Number($('aptNewServicePrice')?.value);
    const duration=Number($('aptNewServiceDuration')?.value);
    const longRaw=$('aptNewServiceLongPrice')?.value;
    const longPrice=longRaw===''||longRaw==null?price:Number(longRaw);
    const cost=Number($('aptNewServiceCost')?.value||0);
    const error=$('aptServiceError');
    const fail=message=>{if(error){error.textContent=message;error.style.display='block';}toast(message);};
    try {
      if(name.length<2) throw new Error('Informe o nome do serviço.');
      if(!Number.isFinite(price)||price<0||!Number.isFinite(longPrice)||longPrice<0||!Number.isFinite(cost)||cost<0) throw new Error('Confira os valores do serviço. Não use valores negativos.');
      if(!Number.isInteger(duration)||duration<1) throw new Error('A duração deve ser de pelo menos 1 minuto.');
      await requireSession();
      const saved=await api().insert('services',{name,description:description||null,price,price_base:price,price_long:longPrice,service_cost:cost,duration_minutes:duration,active:true});
      if(!saved?.id) throw new Error('O Neon não confirmou o cadastro do serviço.');
      window.data.services=[saved,...rows('services').filter(x=>x.id!==saved.id)];
      window.__EDDU_PENDING_SERVICE_ID=saved.id;
      toast('Serviço cadastrado no Neon.');
      openAdd(date);
    } catch(e) { console.error('[EDDU] service create failed',e); fail('Não foi possível cadastrar o serviço: '+String(e?.message||e)); }
  };

  let saving = false;
  async function saveAdd() {
    if (saving) return;
    const date = $('aptDate')?.value, start = $('aptStart')?.value, end = $('aptEnd')?.value;
    const clientId = $('aptClientId')?.value || null;
    const professionalId = $('aptProfessionalId')?.value || null;
    const selectedServices = Array.from(document.querySelectorAll('.apt-service-checkbox:checked')).map(input => rows('services').find(x => x.id === input.value)).filter(Boolean);
    const client = clientId ? rows('clients').find(x => x.id === clientId) : null;
    const professional = professionalId ? rows('professionals').find(x => x.id === professionalId) : null;
    const service = selectedServices[0] || null;
    const clientName = client?.name || '';
    const professionalName = professional?.name || '';
    const serviceName = selectedServices.map(x => x.name).join(' + ');
    if (!date || !start || !end || !clientId || !professionalId || !clientName || !professionalName || !selectedServices.length) return toast('Selecione cliente, profissional e pelo menos um serviço, além de data e horários.');
    // Client email is optional for an in-salon booking. When present, the client portal can match it to the signed-in account; it must never block the salon from saving an appointment.
    if (end <= start) return toast('O término deve ser posterior ao início.');
    try { await requireSession(); } catch (sessionError) { return toast(String(sessionError?.message || sessionError)); }
    const startDate = new Date(date+'T'+start+':00');
    const endDate = new Date(date+'T'+end+':00');
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return toast('Data ou horário inválido.');
    if (rows('blocks').some(b => b.date === date && start < b.end && end > b.start)) return toast('Este horário está bloqueado na Agenda.');
    if (rows('appointments').map(hydrateAppointment).some(a => a.date === date && a.professional_id === professionalId && !['cancelled','canceled','cancelado'].includes(String(a.status).toLowerCase()) && start < a.end && end > a.start)) return toast('Já existe atendimento nesse intervalo.');
    saving = true;
    const button = $('edduSaveAppointment');
    if (button) { button.disabled = true; button.textContent = 'Salvando…'; }
    try {
      const payload = {
        client_id: clientId,
        professional_id: professionalId,
        starts_at: startDate.toISOString(),
        ends_at: endDate.toISOString(),
        status: $('aptStatus')?.value === 'Pendente' ? 'requested' : 'confirmed',
        notes: null
      };
      const saved = await api().insert('appointments', payload);
      if (!saved?.id) throw new Error('O Neon não retornou o identificador do agendamento.');
      const serviceLinks = [];
      try {
        for (const selected of selectedServices) {
          const link = await api().insert('appointment_services', { appointment_id:saved.id, service_id:selected.id, price:Number(selected.price_base ?? selected.price ?? 0), duration_minutes:Number(selected.duration_minutes || 60) });
          if (!link?.id) throw new Error('O Neon não confirmou o vínculo do serviço: '+selected.name+'.');
          serviceLinks.push(link);
        }
      } catch (linkError) {
        for (const link of serviceLinks) { try { await api().delete('appointment_services', link.id); } catch (rollbackError) { console.error('[EDDU] service link rollback failed', rollbackError); } }
        try { await api().delete('appointments', saved.id); } catch (rollbackError) { console.error('[EDDU] appointment rollback failed', rollbackError); }
        throw linkError;
      }
      window.data.appointmentServices = [...serviceLinks, ...rows('appointmentServices').filter(x => x.appointment_id !== saved.id)];
      const hydrated = hydrateAppointment({ ...saved, service:serviceName, client:clientName, professional:professionalName });
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
  document.addEventListener('change', event => {
    if (!event.target?.matches?.('.apt-service-checkbox')) return;
    const selected = Array.from(document.querySelectorAll('.apt-service-checkbox:checked'));
    const total = selected.reduce((sum,input)=>sum+Number(input.dataset.price||0),0);
    const duration = selected.reduce((sum,input)=>sum+Number(input.dataset.duration||0),0);
    const summary = $('aptServicesSummary');
    if (summary) summary.innerHTML = selected.length ? '<div class="row"><span>Serviços selecionados</span><b>'+selected.length+'</b></div><div class="row"><span>Duração total estimada</span><b>'+duration+' min</b></div><div class="row"><b>Total previsto</b><b>'+money(total)+'</b></div>' : '<b>Selecione um ou mais serviços</b>';
  }, true);
  document.addEventListener('click', event => {
    const close = event.target?.closest?.('#shade .close,#shade [data-eddu-close],#shade .sheet-close,#shade [aria-label="Fechar"],#shade button[title="Fechar"]');
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
      '<div class="card"><b>'+escapeHtml((item.service_names || [item.service || 'Atendimento']).join(' + '))+'</b>'+
      '<p class="sub">'+escapeHtml(new Date(item.starts_at).toLocaleString('pt-BR'))+' · '+escapeHtml(item.professional || 'Profissional')+'</p>'+
      '<div class="row"><span>Status</span><b>'+escapeHtml(({confirmed:'Confirmado',requested:'Pendente',rescheduled:'Reagendado',in_progress:'Em andamento',completed:'Concluído',cancelled:'Cancelado',no_show:'Não compareceu'})[item.status] || item.status)+'</b></div></div>'
    ).join('');
  }
  window.addEventListener('eddu-neon-data-loaded', event => {
    if (event.detail?.entity === 'appointments' || event.detail?.entity === 'appointment_services' || event.detail?.entity === 'clients' || event.detail?.entity === 'professionals' || event.detail?.entity === 'services') refreshLocalAppointments();
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
