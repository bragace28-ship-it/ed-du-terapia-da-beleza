/* ED & DU — real command lifecycle. All writes go through the authenticated Neon API. */
(function () {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  const data = () => window.data || (window.data = {});
  const rows = key => Array.isArray(data()[key]) ? data()[key] : [];
  const api = async () => {
    if (!window.EDDU_NEON_API) throw new Error('A conexão de gravação do Neon não foi carregada.');
    if (window.__EDDU_NEON_READY !== true || window.__EDDU_NEON_SESSION !== true)
      throw new Error('Aguarde a autenticação do Neon antes de operar uma comanda.');
    if (window.__EDDU_NEON_CONNECTED !== true) {
      if (window.__EDDU_NEON_SYNCING) {
        await new Promise((resolve, reject) => {
          const finish = () => { clearTimeout(timer); window.removeEventListener('eddu-neon-sync-complete', finish); resolve(); };
          const timer = setTimeout(() => { window.removeEventListener('eddu-neon-sync-complete', finish); reject(new Error('Tempo esgotado aguardando sincronização das comandas.')); }, 15000);
          window.addEventListener('eddu-neon-sync-complete', finish, { once:true });
        });
      } else if (typeof window.EDDU_NEON_SYNC === 'function') {
        await window.EDDU_NEON_SYNC();
      }
    }
    if (window.__EDDU_NEON_CONNECTED !== true) {
      const details = (window.__EDDU_NEON_CORE_SYNC_ERRORS || []).map(x => x.entity + ': ' + x.error).join('; ');
      throw new Error('Não foi possível sincronizar os dados essenciais da comanda.' + (details ? ' ' + details : ''));
    }
    return window.EDDU_NEON_API;
  };
  const active = () => {
    const list = Array.isArray(window.state?.commands) ? window.state.commands : rows('commands');
    return list.find(command => command.id === window.state?.activeCommandId) || null;
  };
  const refresh = () => {
    if (typeof window.render === 'function') window.render('command');
    else if (typeof window.openSheet === 'function') window.openSheet('command');
  };
  const statusLabel = status => ({open:'Aberta',awaiting_payment:'Aguardando pagamento',paid:'Paga',closed:'Fechada',cancelled:'Cancelada',refunded:'Estornada'})[String(status||'open').toLowerCase()] || status || 'Aberta';
  function commandCard(command) {
    const items = Array.isArray(command.items) ? command.items : [];
    const canCancel = !['paid','closed','cancelled','refunded'].includes(String(command.status||'').toLowerCase());
    const amount = Number(command.total ?? command.netAmount ?? command.subtotal ?? 0);
    return '<article class="card" style="margin:10px 0"><div class="row"><b>Comanda '+esc(String(command.id).slice(0,8))+'</b><b>'+esc(statusLabel(command.status))+'</b></div>'+
      '<div class="row"><span>Cliente</span><b>'+esc((typeof command.client==='string'?command.client:command.client?.name) || command.client_name || 'Cliente')+'</b></div>'+
      '<div class="row"><span>Profissional</span><b>'+esc((typeof command.professional==='string'?command.professional:command.professional?.name) || 'Profissional')+'</b></div>'+
      '<div class="row"><span>Itens</span><b>'+items.length+'</b></div>'+
      (items.length?'<div style="margin:8px 0">'+items.map(item=>'<div class="row"><span>'+esc(item.description||item.service||'Item')+' × '+esc(item.quantity||item.qty||1)+'</span><b>'+money(item.total??Number(item.unit_price||item.price||0)*Number(item.quantity||item.qty||1))+'</b></div>').join('')+'</div>':'')+
      '<div class="row"><span>Total</span><b>'+money(amount)+'</b></div>'+
      '<div class="grid2" style="margin-top:10px">'+
      '<button type="button" class="btn primary" data-eddu-command-action="select" data-command-id="'+esc(command.id)+'">Abrir comanda</button>'+
      (canCancel?'<button type="button" class="btn" data-eddu-command-action="cancel" data-command-id="'+esc(command.id)+'">Cancelar comanda</button>':'')+
      (canCancel && amount>0 && items.length?'<button type="button" class="btn primary full" data-eddu-command-action="payment" data-command-id="'+esc(command.id)+'">Enviar para pagamento</button>':'')+
      '</div></article>';
  }
  window.views = window.views || {};
  window.views.command = function () {
    const clients = rows('clients'), professionals = rows('professionals'), services = rows('services'), products = rows('products');
    const appointments = rows('appointments').filter(x=>!['cancelled','canceled','cancelado','no_show'].includes(String(x.status||'').toLowerCase()));
    const items = rows('commandItems');
    const commands = (Array.isArray(window.state?.commands) ? window.state.commands : rows('commands')).map(command=>({
      ...command,
      items: items.filter(item=>item.command_id===command.id),
      client: clients.find(x=>x.id===command.client_id) || command.client,
      professional: professionals.find(x=>x.id===command.professional_id) || command.professional
    }));
    const selected = commands.find(command=>command.id===window.state?.activeCommandId) || null;
    const openCommands = commands.filter(x=>['open','awaiting_payment'].includes(String(x.status||'open').toLowerCase()));
    const historyCommands = commands.filter(x=>!['open','awaiting_payment'].includes(String(x.status||'open').toLowerCase()));
    const serviceOptions = services.map(x=>'<option value="service:'+esc(x.id)+'">'+esc(x.name)+' — '+money(x.price_base ?? x.price ?? 0)+'</option>').join('');
    const productOptions = products.map(x=>'<option value="product:'+esc(x.id)+'">'+esc(x.name)+' — '+money(x.sale_price ?? 0)+'</option>').join('');
    const appointmentOptions = appointments.map(a=>{
      const client=clients.find(x=>x.id===a.client_id), professional=professionals.find(x=>x.id===a.professional_id);
      const date=new Date(a.starts_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
      return '<option value="'+esc(a.id)+'" data-client="'+esc(a.client_id||'')+'" data-professional="'+esc(a.professional_id||'')+'">'+esc((client?.name||'Cliente')+' · '+(professional?.name||'Profissional')+' · '+date)+'</option>';
    }).join('');
    const emptyForm = !clients.length || !professionals.length;
    const newCommandForm = '<div class="card"><div class="row"><b>Nova comanda</b><span>'+clients.length+' clientes · '+professionals.length+' profissionais</span></div>'+
      (emptyForm
        ? '<p role="alert">Para abrir uma comanda, cadastre ao menos um cliente e um profissional.</p><div class="grid2"><button type="button" class="btn" onclick="window.__EDDU_CLIENT_RETURN={route:\'command\'};openSheet(\'newClient\')">Cadastrar cliente</button><button type="button" class="btn" data-eddu-command-action="professional">Cadastrar profissional</button></div>'
        : '<label>Vincular agendamento (opcional)</label><select id="edduCommandAppointment" onchange="window.edduPrefillCommandFromAppointment(this)"><option value="">Comanda sem agendamento</option>'+appointmentOptions+'</select>'+
          '<label>Cliente *</label><select id="edduCommandClient"><option value="">Selecione o cliente</option>'+clients.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select>'+
          '<label>Profissional *</label><select id="edduCommandProfessional"><option value="">Selecione o profissional</option>'+professionals.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select>'+
          '<label>Serviço ou produto inicial *</label><select id="edduCommandItem"><option value="">Selecione o item</option>'+serviceOptions+productOptions+'</select>'+
          '<label>Quantidade</label><input id="edduCommandQty" type="number" min="1" step="1" value="1">'+
          '<button type="button" class="btn primary full" style="margin-top:12px" data-eddu-command-action="create">＋ Abrir comanda no Neon</button>')+
      '</div>';
    const selectedPanel = selected ? '<h3>Comanda em atendimento</h3>'+commandCard(selected)+
      (['open','awaiting_payment'].includes(String(selected.status||'open').toLowerCase())
        ? '<div class="card"><b>Adicionar serviço ou produto</b><label>Item</label><select id="edduAddItemSelect"><option value="">Selecione o item</option>'+serviceOptions+productOptions+'</select><label>Quantidade</label><input id="edduAddItemQty" type="number" min="1" step="1" value="1"><button type="button" class="btn primary full" data-eddu-command-action="add-item" data-command-id="'+esc(selected.id)+'">＋ Adicionar à comanda aberta</button></div>'
        : '') : '';
    return '<h2>Central de Comandas</h2><p class="sub">Gerencie comandas abertas, itens, pagamentos e histórico. Todos os registros são persistidos no Neon.</p>'+
      newCommandForm+
      '<h3>Comandas abertas ('+openCommands.length+')</h3>'+
      (openCommands.length ? openCommands.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(commandCard).join('') : '<p class="sub">Nenhuma comanda aberta no momento. As novas comandas aparecerão aqui após serem lançadas.</p>')+
      selectedPanel+
      '<h3>Histórico de comandas ('+historyCommands.length+')</h3>'+
      (historyCommands.length ? historyCommands.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(commandCard).join('') : '<p class="sub">Ainda não há comandas finalizadas ou canceladas.</p>');
  };
  window.edduPrefillCommandFromAppointment = function(select) {
    const option=select?.selectedOptions?.[0];
    if(!option?.value)return;
    const client=$('edduCommandClient'), professional=$('edduCommandProfessional');
    if(client)client.value=option.dataset.client||'';
    if(professional)professional.value=option.dataset.professional||'';
  };
  window.edduSelectCommand = function(id) {
    const command=(Array.isArray(window.state?.commands)?window.state.commands:rows('commands')).find(x=>x.id===id);
    if(!command) return window.toast?.('Comanda não encontrada no Neon.');
    window.state.activeCommandId=id;
    refresh();
  };
  window.edduCreateCommand = async function () {
    const clientId=$('edduCommandClient')?.value, professionalId=$('edduCommandProfessional')?.value, itemValue=$('edduCommandItem')?.value;
    const quantity=Number($('edduCommandQty')?.value||1);
    if(!clientId||!professionalId||!itemValue) return window.toast?.('Selecione cliente, profissional e serviço ou produto.');
    if(!Number.isInteger(quantity)||quantity<1) return window.toast?.('Informe uma quantidade válida.');
    const [kind,itemId]=itemValue.split(':');
    const itemList=kind==='product'?rows('products'):rows('services');
    const item=itemList.find(x=>x.id===itemId);
    const client=rows('clients').find(x=>x.id===clientId);
    const professional=rows('professionals').find(x=>x.id===professionalId);
    if(!UUID.test(clientId)||!UUID.test(professionalId)||!item||!client||!professional) return window.toast?.('Os dados selecionados não correspondem a registros válidos do Neon.');
    const unitPrice=Number(kind==='product'?(item.sale_price??0):(item.price_base??item.price??0));
    if(!Number.isFinite(unitPrice)||unitPrice<0) return window.toast?.('O item possui preço inválido.');
    const total=unitPrice*quantity;
    let command=null;
    try {
      const db=await api();
      command=await db.insert('commands',{client_id:clientId,professional_id:professionalId,appointment_id:$('edduCommandAppointment')?.value||null,status:'open',subtotal:total,total,discount:0});
      if(!command?.id||!UUID.test(command.id)) throw new Error('O Neon não confirmou o identificador da comanda.');
      const line=await db.insert('command_items',{command_id:command.id,item_type:kind,service_id:kind==='service'?itemId:null,product_id:kind==='product'?itemId:null,description:item.name,quantity,unit_price:unitPrice,total,professional_id:professionalId,unit_cost:Number(item.service_cost??item.cost_price??0),commission_percent:Number(professional.commission_rate||0)});
      if(!line?.id) throw new Error('O Neon não confirmou o item da comanda.');
      command.items=[line]; command.client=client; command.professional=professional; command.grossAmount=total; command.netAmount=total;
      data().commands=[command,...rows('commands').filter(x=>x.id!==command.id)];
      data().commandItems=[line,...rows('commandItems').filter(x=>x.id!==line.id)];
      window.state=window.state||{}; window.state.commands=data().commands; window.state.activeCommandId=command.id;
      window.toast?.('Comanda e item gravados no Neon.');
      refresh();
    } catch(error) {
      if(command?.id) try { await window.EDDU_NEON_API?.delete('commands',command.id); } catch(rollbackError) { console.error('[EDDU] command rollback failed',rollbackError); }
      console.error('[EDDU] command creation failed',error);
      window.toast?.('Não foi possível lançar a comanda: '+String(error?.message||error));
    }
  };
  window.edduAddCommandItem = async function(id) {
    const command=(Array.isArray(window.state?.commands)?window.state.commands:rows('commands')).find(x=>x.id===id);
    const itemValue=$('edduAddItemSelect')?.value, quantity=Number($('edduAddItemQty')?.value||1);
    if(!command)return window.toast?.('Comanda não encontrada.');
    if(!['open','awaiting_payment'].includes(String(command.status||'open').toLowerCase()))return window.toast?.('Esta comanda não está aberta para alterações.');
    if(!itemValue)return window.toast?.('Selecione um serviço ou produto.');
    if(!Number.isInteger(quantity)||quantity<1)return window.toast?.('Informe uma quantidade válida.');
    const [kind,itemId]=itemValue.split(':');
    const item=(kind==='product'?rows('products'):rows('services')).find(x=>x.id===itemId);
    if(!item)return window.toast?.('O item selecionado não existe no Neon.');
    const professional=rows('professionals').find(x=>x.id===command.professional_id);
    const unitPrice=Number(kind==='product'?(item.sale_price??0):(item.price_base??item.price??0));
    const lineTotal=unitPrice*quantity;
    if(!Number.isFinite(lineTotal)||lineTotal<0)return window.toast?.('Preço inválido.');
    try {
      const db=await api();
      const line=await db.insert('command_items',{command_id:id,item_type:kind,service_id:kind==='service'?itemId:null,product_id:kind==='product'?itemId:null,description:item.name,quantity,unit_price:unitPrice,total:lineTotal,professional_id:command.professional_id||null,unit_cost:Number(item.service_cost??item.cost_price??0),commission_percent:Number(professional?.commission_rate||0)});
      if(!line?.id)throw new Error('O Neon não confirmou o novo item.');
      const nextTotal=Number(command.total??command.subtotal??0)+lineTotal;
      const saved=await db.update('commands',id,{subtotal:Number(command.subtotal??command.total??0)+lineTotal,total:nextTotal});
      Object.assign(command,saved||{subtotal:nextTotal,total:nextTotal});
      data().commandItems=[line,...rows('commandItems').filter(x=>x.id!==line.id)];
      command.items=[...rows('commandItems').filter(x=>x.command_id===id)];
      window.state.commands=rows('commands');
      window.state.activeCommandId=id;
      window.toast?.('Item adicionado e comanda atualizada no Neon.');
      refresh();
    } catch(error) {
      console.error('[EDDU] add command item failed',error);
      window.toast?.('Não foi possível adicionar o item: '+String(error?.message||error));
    }
  };
  window.edduCancelCommand = async function(id) {
    const command=(Array.isArray(window.state?.commands)?window.state.commands:rows('commands')).find(x=>x.id===id);
    if(!command) return window.toast?.('Comanda não encontrada.');
    if(['paid','closed','refunded'].includes(String(command.status||'').toLowerCase())) return window.toast?.('Uma comanda paga ou fechada não pode ser cancelada por esta ação.');
    try {
      const db=await api();
      const saved=await db.update('commands',id,{status:'cancelled'});
      Object.assign(command,saved||{status:'cancelled'});
      if(window.state) window.state.commands=rows('commands');
      if(window.state?.activeCommandId===id) window.state.activeCommandId=null;
      window.toast?.('Comanda cancelada no Neon.');
      refresh();
    } catch(error) {
      console.error('[EDDU] command cancellation failed',error);
      window.toast?.('Não foi possível cancelar a comanda: '+String(error?.message||error));
    }
  };
  window.edduSendCommandToPayment = async function(id) {
    const command=(Array.isArray(window.state?.commands)?window.state.commands:rows('commands')).find(x=>x.id===id);
    if(!command) return window.toast?.('Comanda não encontrada no Neon.');
    if(['paid','closed','cancelled','refunded'].includes(String(command.status||'').toLowerCase())) return window.toast?.('Esta comanda não está disponível para pagamento.');
    const items=rows('commandItems').filter(x=>x.command_id===id);
    command.items=items; command.client=rows('clients').find(x=>x.id===command.client_id)||command.client;
    command.professional=rows('professionals').find(x=>x.id===command.professional_id)||command.professional;
    command.total=Number(command.total??items.reduce((sum,x)=>sum+Number(x.total||0),0));
    if(!command.client_id||!items.length||!(command.total>0)) return window.toast?.('A comanda precisa ter cliente, itens e total válido antes do pagamento.');
    window.state.activeCommandId=id;
    if(typeof window.__edduOpenGatewayRanking!=='function') return window.toast?.('O módulo de pagamento não foi carregado. Atualize o aplicativo.');
    await window.__edduOpenGatewayRanking(command);
  };
  document.addEventListener('click', function(event) {
    const button = event.target?.closest?.('[data-eddu-command-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.getAttribute('data-eddu-command-action');
    const id = button.getAttribute('data-command-id');
    if (action === 'professional') window.openAgendaProfessionalCreateM?.(undefined, 'command');
    else if (action === 'create') window.edduCreateCommand();
    else if (action === 'add-item' && id) window.edduAddCommandItem(id);
    else if (action === 'select' && id) window.edduSelectCommand(id);
    else if (action === 'cancel' && id) window.edduCancelCommand(id);
    else if (action === 'payment' && id) window.edduSendCommandToPayment(id);
  }, true);
  window.addEventListener('eddu-neon-sync-complete', function() {
    const shade=document.getElementById('shade'), view=document.getElementById('view');
    if(shade?.classList.contains('show') && view?.querySelector('h2')?.textContent?.trim()==='Central de Comandas') refresh();
  });
  window.addEventListener('eddu-neon-data-changed', function(event) {
    if(!['clients','professionals','services','products','commands','command_items'].includes(event.detail?.entity))return;
    const shade=document.getElementById('shade'), view=document.getElementById('view');
    if(shade?.classList.contains('show') && view?.querySelector('h2')?.textContent?.trim()==='Central de Comandas') refresh();
  });
  window.EDDU_COMMANDS_RUNTIME_READY=true;
})();
