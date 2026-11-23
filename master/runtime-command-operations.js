/* ED & DU — real command lifecycle. All writes go through the authenticated Neon API. */
(function () {
  'use strict';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  const data = () => window.data || (window.data = {});
  const rows = key => Array.isArray(data()[key]) ? data()[key] : [];
  const api = () => {
    if (!window.EDDU_NEON_API) throw new Error('A conexão de gravação do Neon não foi carregada.');
    if (window.__EDDU_NEON_READY !== true || window.__EDDU_NEON_SESSION !== true || window.__EDDU_NEON_CONNECTED !== true)
      throw new Error('Aguarde a autenticação e a sincronização do Neon antes de operar uma comanda.');
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
      '<div class="row"><span>Cliente</span><b>'+esc(command.client?.name || command.client_name || 'Cliente')+'</b></div>'+
      '<div class="row"><span>Itens</span><b>'+items.length+'</b></div>'+
      '<div class="row"><span>Total</span><b>'+money(amount)+'</b></div>'+
      '<div class="grid2" style="margin-top:10px">'+
      '<button type="button" class="btn primary" onclick="window.edduSelectCommand(\''+esc(command.id)+'\')">Abrir comanda</button>'+
      (canCancel?'<button type="button" class="btn" onclick="window.edduCancelCommand(\''+esc(command.id)+'\')">Cancelar comanda</button>':'')+
      (canCancel && amount>0 && items.length?'<button type="button" class="btn primary full" onclick="window.edduSendCommandToPayment(\''+esc(command.id)+'\')">Enviar para pagamento</button>':'')+
      '</div></article>';
  }
  window.views = window.views || {};
  window.views.command = function () {
    const clients = rows('clients'), professionals = rows('professionals'), services = rows('services'), products = rows('products');
    const commands = Array.isArray(window.state?.commands) ? window.state.commands : rows('commands');
    const selected = active();
    const serviceOptions = services.map(x=>'<option value="service:'+esc(x.id)+'">'+esc(x.name)+' — '+money(x.price_base ?? x.price ?? 0)+'</option>').join('');
    const productOptions = products.map(x=>'<option value="product:'+esc(x.id)+'">'+esc(x.name)+' — '+money(x.sale_price ?? 0)+'</option>').join('');
    return '<h2>Central de Comandas</h2><p class="sub">Comandas reais, vinculadas a clientes, profissionais, itens e pagamentos no Neon.</p>'+
      '<div class="card"><div class="row"><b>Nova comanda</b><span>'+clients.length+' clientes · '+professionals.length+' profissionais</span></div>'+
      (clients.length && professionals.length ? '<label>Cliente *</label><select id="edduCommandClient"><option value="">Selecione o cliente</option>'+clients.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select>'+
       '<label>Profissional *</label><select id="edduCommandProfessional"><option value="">Selecione o profissional</option>'+professionals.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('')+'</select>'+
       '<label>Serviço ou produto *</label><select id="edduCommandItem"><option value="">Selecione o item</option>'+serviceOptions+productOptions+'</select>'+
       '<label>Quantidade</label><input id="edduCommandQty" type="number" min="1" step="1" value="1">'+
       '<button type="button" class="btn primary full" style="margin-top:12px" onclick="window.edduCreateCommand()">＋ Lançar comanda no Neon</button>'
       : '<p role="alert">Para lançar uma comanda, primeiro cadastre ao menos um cliente e um profissional. Os cadastros são carregados diretamente do Neon.</p>'+
         '<div class="grid2"><button type="button" class="btn" onclick="openSheet(\'clients\')">Cadastrar cliente</button><button type="button" class="btn" onclick="openSheet(\'professionals\')">Cadastrar profissional</button></div>')+
      '</div>'+
      (selected ? '<h3>Comanda selecionada</h3>'+commandCard(selected) : '')+
      '<h3>Comandas registradas</h3>'+
      (commands.length ? commands.slice().sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(commandCard).join('') : '<p class="sub">Nenhuma comanda registrada no banco de dados.</p>');
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
      const db=api();
      command=await db.insert('commands',{client_id:clientId,professional_id:professionalId,status:'open',subtotal:total,total,discount:0});
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
  window.edduCancelCommand = async function(id) {
    const command=(Array.isArray(window.state?.commands)?window.state.commands:rows('commands')).find(x=>x.id===id);
    if(!command) return window.toast?.('Comanda não encontrada.');
    if(['paid','closed','refunded'].includes(String(command.status||'').toLowerCase())) return window.toast?.('Uma comanda paga ou fechada não pode ser cancelada por esta ação.');
    try {
      const saved=await api().update('commands',id,{status:'cancelled'});
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
  window.EDDU_COMMANDS_RUNTIME_READY=true;
})();
