/* ED & DU — real client registration and CRUD.
   Neon PostgreSQL is authoritative; no browser-storage fallback or demo clients. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const rows = key => Array.isArray(window.data?.[key]) ? window.data[key] : [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toast = message => { try { if (typeof window.toast === 'function') window.toast(message); else alert(message); } catch (_) {} };
  const api = () => window.EDDU_NEON_API;
  const activeClients = () => rows('clients').filter(c => c.active !== false && String(c.status || 'Ativo').toLowerCase() !== 'inativo');
  const dateText = value => value ? new Date(String(value).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR') : 'Não informado';
  const returnState = () => window.__EDDU_CLIENT_RETURN || { route:'clients' };
  // Avoid RegExp here: previous inline build double-escaped backslashes in this validator.
  function validOptionalEmail(value) {
    const valueText = String(value || '').normalize('NFKC').trim();
    if (!valueText) return true;
    const at = valueText.indexOf('@'), lastAt = valueText.lastIndexOf('@'), dot = valueText.lastIndexOf('.');
    if (at <= 0 || at !== lastAt || dot <= at + 1 || dot >= valueText.length - 1) return false;
    for (const char of valueText) if (char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) return false;
    return true;
  }

  async function ensureNeon() {
    if (!api()) throw new Error('A conexão de gravação do Neon não foi carregada. Recarregue o sistema.');
    if (window.__EDDU_NEON_READY === false) {
      throw new Error(window.__EDDU_NEON_LAST_ERROR || 'A inicialização do Neon Auth falhou antes do cadastro.');
    }
    if (window.__EDDU_NEON_READY !== true) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          window.removeEventListener('eddu-neon-ready', finish);
          if (window.__EDDU_NEON_READY === true) resolve();
          else reject(new Error(window.__EDDU_NEON_LAST_ERROR || 'A inicialização do Neon Auth falhou.'));
        };
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener('eddu-neon-ready', finish);
          reject(new Error('Tempo esgotado aguardando o Neon Auth. Verifique o carregamento do módulo de autenticação.'));
        }, 15000);
        window.addEventListener('eddu-neon-ready', finish, { once:true });
        // Recheck after subscribing so an already-completed initialization cannot be missed.
        if (window.__EDDU_NEON_READY !== undefined) finish();
      });
    }
    if (window.__EDDU_NEON_READY !== true) throw new Error(window.__EDDU_NEON_LAST_ERROR || 'Não foi possível inicializar o Neon Auth.');
    const session = typeof window.EDDU_NEON_REFRESH_SESSION === 'function'
      ? await window.EDDU_NEON_REFRESH_SESSION()
      : null;
    if (!session) {
      window.__EDDU_NEON_AUTH_REQUIRED?.();
      throw new Error('Sua sessão expirou. Entre novamente para salvar o cadastro.');
    }
    return true;
  }
  function clientsMarkup(list) {
    if (!list.length) return '<div class="card"><b>Nenhum cliente cadastrado.</b><p class="sub">Cadastre o primeiro cliente. O registro será salvo diretamente no Neon.</p></div>';
    return list.map(c => {
      const visits = rows('appointments').filter(a => a.client_id === c.id).length;
      return '<div class="option"><span><b>'+esc(c.name)+'</b><small>'+esc(c.phone || c.email || 'Sem contato')+' · '+visits+' agendamento(s)</small></span><button class="btn" onclick="clientFile(\''+esc(c.id)+'\')">Abrir ficha</button></div>';
    }).join('');
  }
  window.filterRegisteredClients = function (query) {
    const q = String(query || '').trim().toLocaleLowerCase('pt-BR');
    const list = activeClients().filter(c => [c.name,c.email,c.phone,c.cpf].some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(q)));
    const target = $('edduClientsList');
    if (target) target.innerHTML = clientsMarkup(list);
  };
  window.views = window.views || {};
  window.views.clients = function () {
    const list = activeClients().slice().sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''),'pt-BR'));
    return '<h2>Meus clientes</h2><p class="sub">Cadastro, histórico, anamnese, fotos e relacionamento.</p>'+
      '<input id="edduClientSearch" type="search" placeholder="Buscar por nome, telefone, e-mail ou CPF" oninput="filterRegisteredClients(this.value)">'+
      '<div id="edduClientsList">'+clientsMarkup(list)+'</div>'+
      '<button class="btn primary full" onclick="window.__EDDU_CLIENT_RETURN={route:\'clients\'};openSheet(\'newClient\')">＋ Novo cliente</button>';
  };
  window.views.newClient = function () {
    return '<h2>Novo cliente</h2><p class="sub">Preencha os dados. O cadastro será gravado no banco oficial do salão.</p>'+
      '<label>Nome completo *</label><input id="newClientName" autocomplete="name" maxlength="160" placeholder="Nome e sobrenome" required>'+
      '<label>WhatsApp</label><input id="newClientPhone" autocomplete="tel" inputmode="tel" maxlength="30" placeholder="(11) 99999-9999">'+
      '<label>E-mail</label><input id="newClientEmail" type="email" autocomplete="email" maxlength="254" placeholder="cliente@email.com">'+
      '<label>CPF</label><input id="newClientCpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00">'+
      '<label>Data de nascimento</label><input id="newClientBirthDate" type="date">'+
      '<label>Observações</label><textarea id="newClientNotes" rows="3" maxlength="3000" placeholder="Informações importantes sobre o cliente"></textarea>'+
      '<div id="edduClientSaveError" role="alert" aria-live="polite" style="display:none;color:#b42318;margin:10px 0"></div>'+
      '<div class="action-row"><button id="edduSaveNewClient" type="button" class="btn primary full">✓ Salvar cliente</button><button type="button" class="btn full" onclick="cancelNewClientRegistration()">Cancelar</button></div>';
  };

  window.cancelNewClientRegistration = function () {
    const back = returnState();
    window.__EDDU_CLIENT_RETURN = null;
    if (back.route === 'agenda') window.openAgendaAddM(back.date);
    else window.openSheet('clients');
  };
  let creating = false;
  window.saveNewClient = async function () {
    // Lock synchronously, before the first await. The old flow could enter twice
    // (capture listener + inline onclick) while Neon Auth was still resolving.
    if (creating) return;
    creating = true;
    const button = $('edduSaveNewClient');
    const errorNode = $('edduClientSaveError');
    const setError = message => {
      if (errorNode) {
        errorNode.textContent = message;
        errorNode.style.display = 'block';
      }
      toast(message);
    };
    if (errorNode) { errorNode.style.display='none'; errorNode.textContent=''; }
    if (button) { button.disabled = true; button.textContent = 'Validando e salvando…'; }

    // Snapshot the form before awaiting network/authentication.
    const name = String($('newClientName')?.value || '').trim().replace(/\s+/g,' ');
    const phone = String($('newClientPhone')?.value || '').trim();
    const email = String($('newClientEmail')?.value || '').normalize('NFKC').trim().toLowerCase();
    const cpf = String($('newClientCpf')?.value || '').replace(/\D/g,'');
    const birthDate = String($('newClientBirthDate')?.value || '').trim();
    const notes = String($('newClientNotes')?.value || '').trim();

    try {
      if (name.length < 2) throw new Error('Informe o nome completo do cliente.');
      if (!validOptionalEmail(email)) throw new Error('E-mail inválido. Confira o endereço digitado ou deixe o campo vazio.');
      if (cpf && cpf.length !== 11) throw new Error('O CPF deve conter 11 números.');
      if (email && rows('clients').some(c => c.active !== false && String(c.email || '').trim().toLowerCase() === email)) {
        throw new Error('Já existe um cliente ativo com este e-mail.');
      }
      await ensureNeon();
      if (!api() || typeof api().insert !== 'function') throw new Error('A função de gravação do Neon não está disponível.');

      if (button) button.textContent = 'Gravando no banco oficial…';
      const payload = {
        name,
        phone: phone || null,
        email: email || null,
        cpf: cpf || null,
        birth_date: birthDate || null,
        notes: notes || null,
        active: true
      };
      const saved = await api().insert('clients', payload);
      if (!saved?.id) throw new Error('A API não confirmou a gravação do cliente no Neon. Seus dados continuam nesta tela.');

      // Only transition away after the POST returned a persisted row with an ID.
      window.data.clients = [saved, ...rows('clients').filter(c => c.id !== saved.id)];
      window.dispatchEvent(new CustomEvent('eddu-client-created', { detail:{ client:saved } }));
      const back = returnState();
      window.__EDDU_CLIENT_RETURN = null;
      toast('Cliente gravado e confirmado no banco oficial.');
      if (back.route === 'agenda') {
        window.__EDDU_PENDING_CLIENT_ID = saved.id;
        window.selectedDayM = back.date || window.selectedDayM;
        if (typeof window.openAgendaAddM === 'function') window.openAgendaAddM(back.date);
        else window.openSheet('agenda');
      } else {
        window.openSheet('clients');
      }
    } catch (error) {
      console.error('[EDDU] client create failed', error);
      // Never close the form on validation, authentication, API, or DB errors.
      setError('Não foi possível salvar. O formulário foi mantido aberto. Motivo: ' + String(error?.message || error || 'Falha desconhecida.'));
    } finally {
      creating = false;
      const current = $('edduSaveNewClient');
      if (current) { current.disabled = false; current.textContent = '✓ Salvar cliente'; }
    }
  };

  function findClient(idOrName) {
    const value = String(idOrName || '');
    return rows('clients').find(c => String(c.id) === value) ||
      rows('clients').find(c => String(c.name || '').trim().toLocaleLowerCase('pt-BR') === value.trim().toLocaleLowerCase('pt-BR'));
  }
  window.clientFile = function (idOrName) {
    const client = findClient(idOrName);
    if (!client) { toast('Cliente não encontrado no Neon. Atualize a lista e tente novamente.'); return; }
    window.__EDDU_ACTIVE_CLIENT_ID = client.id;
    window.views.clientRecord = function () {
      const visits = rows('appointments').filter(a => a.client_id === client.id).slice().sort((a,b) => String(b.starts_at || '').localeCompare(String(a.starts_at || '')));
      return '<h2>Ficha — '+esc(client.name)+'</h2>'+
        '<div class="card"><div class="row"><span>WhatsApp</span><b>'+esc(client.phone || 'Não informado')+'</b></div>'+
        '<div class="row"><span>E-mail</span><b>'+esc(client.email || 'Não informado')+'</b></div>'+
        '<div class="row"><span>CPF</span><b>'+esc(client.cpf || 'Não informado')+'</b></div>'+
        '<div class="row"><span>Nascimento</span><b>'+esc(dateText(client.birth_date))+'</b></div>'+
        '<div class="row"><span>Status</span><b>'+(client.active === false ? 'Inativo' : 'Ativo')+'</b></div>'+
        '<p class="sub">'+esc(client.notes || 'Sem observações.')+'</p></div>'+
        '<h3>Histórico de agendamentos</h3>'+
        (visits.length ? visits.map(a => '<div class="card"><b>'+esc(a.service_name || a.service || 'Atendimento')+'</b><p class="sub">'+esc(a.starts_at ? new Date(a.starts_at).toLocaleString('pt-BR') : '')+' · '+esc(a.status || '')+'</p></div>').join('') : '<p class="sub">Nenhum agendamento registrado.</p>')+
        '<div class="action-row"><button class="btn primary" onclick="editRegisteredClient(\''+esc(client.id)+'\')">Editar cadastro</button>'+
        (client.active === false ? '' : '<button class="btn" onclick="deactivateRegisteredClient(\''+esc(client.id)+'\')">Inativar cliente</button>')+
        '<button class="btn full" onclick="openSheet(\'clients\')">Voltar</button></div>';
    };
    window.openSheet('clientRecord');
  };
  window.editRegisteredClient = function (id) {
    const c = findClient(id);
    if (!c) return toast('Cliente não encontrado.');
    window.views.clientEdit = () => '<h2>Editar cliente</h2>'+
      '<label>Nome completo *</label><input id="editClientName" value="'+esc(c.name)+'" maxlength="160" required>'+
      '<label>WhatsApp</label><input id="editClientPhone" value="'+esc(c.phone || '')+'" maxlength="30">'+
      '<label>E-mail</label><input id="editClientEmail" type="email" value="'+esc(c.email || '')+'" maxlength="254">'+
      '<label>CPF</label><input id="editClientCpf" value="'+esc(c.cpf || '')+'" maxlength="14">'+
      '<label>Data de nascimento</label><input id="editClientBirthDate" type="date" value="'+esc(c.birth_date ? String(c.birth_date).slice(0,10) : '')+'">'+
      '<label>Observações</label><textarea id="editClientNotes" rows="3">'+esc(c.notes || '')+'</textarea>'+
      '<button class="btn primary full" onclick="saveRegisteredClient(\''+esc(c.id)+'\')">Salvar alterações</button><button class="btn full" onclick="openSheet(\'clientRecord\')">Cancelar</button>';
    window.openSheet('clientEdit');
  };
  window.saveRegisteredClient = async function (id) {
    try { await ensureNeon(); } catch (error) { toast('Não foi possível autenticar: '+String(error?.message || error)); return; }
    const c = findClient(id);
    const name = String($('editClientName')?.value || '').trim();
    const email = String($('editClientEmail')?.value || '').normalize('NFKC').trim().toLowerCase();
    const cpf = String($('editClientCpf')?.value || '').replace(/\D/g,'');
    if (!c || name.length < 2) return toast('Informe o nome completo do cliente.');
    if (!validOptionalEmail(email)) return toast('E-mail inválido. Confira o endereço digitado ou deixe o campo vazio.');
    if (cpf && cpf.length !== 11) return toast('O CPF deve conter 11 números.');
    if (email && rows('clients').some(x => x.id !== id && x.active !== false && String(x.email || '').trim().toLowerCase() === email)) return toast('Este e-mail já está associado a outro cliente.');
    try {
      const saved = await api().update('clients', id, {
        name, email:email || null, phone:String($('editClientPhone')?.value || '').trim() || null,
        cpf:cpf || null, birth_date:String($('editClientBirthDate')?.value || '').trim() || null,
        notes:String($('editClientNotes')?.value || '').trim() || null
      });
      if (!saved?.id) throw new Error('O Neon não confirmou a atualização.');
      window.data.clients = rows('clients').map(x => x.id === id ? saved : x);
      toast('Cadastro atualizado no Neon.');
      window.clientFile(id);
    } catch (error) {
      console.error('[EDDU] client update failed', error);
      toast('Não foi possível atualizar: '+String(error?.message || error));
    }
  };
  window.deactivateRegisteredClient = async function (id) {
    try { await ensureNeon(); } catch (error) { toast('Não foi possível autenticar: '+String(error?.message || error)); return; }
    const c = findClient(id);
    if (!c || !confirm('Inativar '+c.name+'? O histórico será preservado.')) return;
    try {
      const saved = await api().update('clients', id, { active:false });
      if (!saved?.id) throw new Error('O Neon não confirmou a inativação.');
      window.data.clients = rows('clients').map(x => x.id === id ? saved : x);
      toast('Cliente inativado. O histórico foi preservado.');
      window.openSheet('clients');
    } catch (error) {
      console.error('[EDDU] client deactivate failed', error);
      toast('Não foi possível inativar: '+String(error?.message || error));
    }
  };

  document.addEventListener('change', event => {
    const select = event.target;
    if (select?.id !== 'aptClientId' || select.value !== '__NEW__') return;
    const date = $('aptDate')?.value || window.selectedDayM || '';
    window.__EDDU_CLIENT_RETURN = { route:'agenda', date };
    window.openSheet('newClient');
  }, true);
  window.addEventListener('eddu-neon-data-loaded', event => {
    if (event.detail?.entity === 'clients' && window.views) window.__EDDU_CLIENTS_READY = true;
  });
  // Capture-phase delegation keeps the save action working even if inline onclick
  // handlers are blocked by browser policy or replaced by another modal runtime.
  if (!window.__EDDU_CLIENT_SAVE_DELEGATED) {
    window.__EDDU_CLIENT_SAVE_DELEGATED = true;
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#edduSaveNewClient');
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof window.saveNewClient === 'function') window.saveNewClient();
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.target?.tagName === 'TEXTAREA') return;
      const formField = event.target?.closest?.('#shade');
      if (!formField || !document.getElementById('edduSaveNewClient')) return;
      if (event.target?.tagName === 'BUTTON') return;
      event.preventDefault();
      if (typeof window.saveNewClient === 'function') window.saveNewClient();
    }, true);
  }
  window.EDDU_CLIENT_REGISTRATION_READY = true;
})();