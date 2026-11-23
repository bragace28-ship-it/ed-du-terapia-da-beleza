/* ED & DU — command workspace. All business records are persisted in Neon. */
(function () {
  'use strict';
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const data=()=>window.data||(window.data={});
  const rows=k=>Array.isArray(data()[k])?data()[k]:[];
  const terminal=['paid','closed','cancelled','refunded'];
  const openStatuses=['open','awaiting_payment','payment_pending'];
  const api=async()=>{
    if(!window.EDDU_NEON_API||window.__EDDU_NEON_READY!==true||window.__EDDU_NEON_SESSION!==true)throw new Error('Aguarde a autenticação do Neon.');
    if(window.__EDDU_NEON_CONNECTED!==true&&typeof window.EDDU_NEON_SYNC==='function')await window.EDDU_NEON_SYNC();
    if(window.__EDDU_NEON_CONNECTED!==true)throw new Error('Não foi possível sincronizar clientes, profissionais, serviços e comandas com o Neon.');
    return window.EDDU_NEON_API;
  };
  const refresh=()=>{if(typeof window.render==='function')window.render('command');else window.openSheet?.('command');};
  const statusLabel=s=>({open:'Aberta',awaiting_payment:'Aguardando gateway',payment_pending:'Aguardando pagamento',paid:'Paga',closed:'Finalizada',cancelled:'Cancelada',refunded:'Estornada'})[String(s||'open').toLowerCase()]||s||'Aberta';
  const activeCommands=()=> (Array.isArray(window.state?.commands)?window.state.commands:rows('commands')).map(c=>({...c,items:rows('commandItems').filter(i=>i.command_id===c.id),client:rows('clients').find(x=>x.id===c.client_id)||c.client,professional:rows('professionals').find(x=>x.id===c.professional_id)||c.professional}));
  const totals=d=>{const subtotal=d.items.reduce((n,x)=>n+Number(x.total||0),0);let discount=0;if(d.coupon){const v=Number(d.coupon.value||0),type=String(d.coupon.type||'').toLowerCase();discount=['percent','percentage','percentual','porcentagem'].includes(type)?subtotal*v/100:v;}discount=Math.min(subtotal,Math.max(0,discount));return {subtotal,discount,total:Math.max(0,subtotal-discount)};};
  function draftNew(){window.__EDDU_COMMAND_DRAFT={id:null,clientId:'',professionalId:'',appointmentId:'',items:[],coupon:null,couponCode:'',couponId:null};window.__EDDU_COMMAND_MODE='form';refresh();}
  function draftFromCommand(c){window.__EDDU_COMMAND_DRAFT={id:c.id,clientId:c.client_id||'',professionalId:c.professional_id||'',appointmentId:c.appointment_id||'',items:c.items.map(i=>({id:i.id,item_type:i.item_type,service_id:i.service_id,product_id:i.product_id,description:i.description,quantity:Number(i.quantity||1),unit_price:Number(i.unit_price||0),total:Number(i.total??Number(i.quantity||1)*Number(i.unit_price||0)),professional_id:i.professional_id||c.professional_id,unit_cost:Number(i.unit_cost||0),commission_percent:Number(i.commission_percent||0)})),coupon:null,couponCode:c.discount_reason||'',couponId:null,existingDiscount:Number(c.discount||0)};window.__EDDU_COMMAND_MODE='form';window.state.activeCommandId=c.id;refresh();}
  function options(list,placeholder,selected){return '<option value="">'+esc(placeholder)+'</option>'+list.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===selected?'selected':'')+'>'+esc(x.name)+'</option>').join('');}
  function itemOptions(){return rows('services').filter(x=>x.active!==false).map(x=>'<option value="service:'+esc(x.id)+'">Serviço · '+esc(x.name)+' — '+money(x.price_base??x.price??0)+'</option>').join('')+rows('products').filter(x=>x.active!==false).map(x=>'<option value="product:'+esc(x.id)+'">Produto · '+esc(x.name)+' — '+money(x.sale_price??x.price??0)+'</option>').join('');}
  function itemPrice(kind,item){return Number(kind==='product'?(item.sale_price??item.price??0):(item.price_base??item.price??0));}
  function commandCard(c){
    const items=c.items||[],total=Number(c.total??c.subtotal??0),isOpen=openStatuses.includes(String(c.status||'open').toLowerCase()),isPaid=terminal.includes(String(c.status||'').toLowerCase());
    const client=typeof c.client==='string'?c.client:c.client?.name||'Cliente',professional=typeof c.professional==='string'?c.professional:c.professional?.name||'Profissional',status=String(c.status||'open').toLowerCase(),hasPendingPayment=rows('payments').some(p=>p.command_id===c.id&&['CHECKOUT_PENDING','PENDING','AWAITING_PAYMENT'].includes(String(p.status||'').toUpperCase()));
    return '<article class="card" style="margin:10px 0"><div class="row"><b>Comanda '+esc(String(c.id).slice(0,8))+'</b><b>'+esc(statusLabel(c.status))+'</b></div>'+
      '<div class="row"><span>Cliente</span><b>'+esc(client)+'</b></div><div class="row"><span>Profissional</span><b>'+esc(professional)+'</b></div>'+
      '<div style="margin:8px 0">'+(items.length?items.map(i=>'<div class="row"><span>'+esc(i.description)+' × '+esc(i.quantity||1)+'</span><b>'+money(i.total??Number(i.quantity||1)*Number(i.unit_price||0))+'</b></div>').join(''):'<span class="sub">Sem itens</span>')+'</div>'+
      (Number(c.discount||0)>0?'<div class="row"><span>Desconto '+esc(c.discount_reason||'')+'</span><b>− '+money(c.discount)+'</b></div>':'')+
      '<div class="row"><span>Total</span><b>'+money(total)+'</b></div><div class="grid2" style="margin-top:10px">'+
      (isOpen?(status==='open'?'<button type="button" class="btn" data-eddu-command-action="edit" data-command-id="'+esc(c.id)+'">Editar comanda</button><button type="button" class="btn" data-eddu-command-action="delete" data-command-id="'+esc(c.id)+'">Excluir comanda</button><button type="button" class="btn" data-eddu-command-action="cancel" data-command-id="'+esc(c.id)+'">Cancelar comanda</button>':'')+(!hasPendingPayment&&status!=='payment_pending'?'<button type="button" class="btn primary full" data-eddu-command-action="payment" data-command-id="'+esc(c.id)+'">Enviar para pagamento</button>':'<p class="sub">Link de pagamento enviado ao aplicativo do cliente. Aguardando confirmação do gateway.</p>'):'')+
      (isPaid?'<span class="sub">Registro encerrado</span>':'')+'</div></article>';
  }
  function renderList(){
    const commands=activeCommands(),opened=commands.filter(c=>openStatuses.includes(String(c.status||'open').toLowerCase())),history=commands.filter(c=>!openStatuses.includes(String(c.status||'open').toLowerCase()));
    return '<h2>Central de Comandas</h2><p class="sub">Acompanhe atendimentos em aberto, lançamentos e pagamentos.</p>'+
      '<div class="grid2"><button type="button" class="btn primary" data-eddu-command-action="new">＋ Lançar comanda no Neon</button><button type="button" class="btn" data-eddu-command-action="reload">Atualizar comandas</button></div>'+
      '<h3>Comandas em aberto ('+opened.length+')</h3>'+(opened.length?opened.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(commandCard).join(''):'<p class="sub">Nenhuma comanda em aberto.</p>')+
      '<h3>Histórico ('+history.length+')</h3>'+(history.length?history.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(commandCard).join(''):'<p class="sub">Nenhuma comanda finalizada ou cancelada.</p>');
  }
  function renderForm(){
    const d=window.__EDDU_COMMAND_DRAFT||{id:null,clientId:'',professionalId:'',appointmentId:'',items:[],coupon:null,couponCode:''};
    const clients=rows('clients').filter(x=>x.active!==false),professionals=rows('professionals').filter(x=>x.active!==false),appointments=rows('appointments').filter(x=>!['cancelled','canceled','cancelado','no_show'].includes(String(x.status||'').toLowerCase()));
    const sum=totals(d);
    const appointmentOptions=appointments.map(a=>{const c=clients.find(x=>x.id===a.client_id),p=professionals.find(x=>x.id===a.professional_id);return '<option value="'+esc(a.id)+'" data-client="'+esc(a.client_id||'')+'" data-professional="'+esc(a.professional_id||'')+'" '+(d.appointmentId===a.id?'selected':'')+'>'+esc((c?.name||'Cliente')+' · '+(p?.name||'Profissional')+' · '+new Date(a.starts_at).toLocaleString('pt-BR'))+'</option>';}).join('');
    const itemRows=d.items.map((i,n)=>'<div class="row" style="padding:8px 0;border-bottom:1px solid #eee"><span>'+esc(i.description)+'<small style="display:block">'+esc(i.quantity)+' × '+money(i.unit_price)+'</small></span><b>'+money(i.total)+'</b><button type="button" class="btn" data-eddu-command-action="remove-item" data-item-index="'+n+'">Remover</button></div>').join('');
    return '<h2>'+(d.id?'Editar comanda':'Lançar nova comanda')+'</h2><p class="sub">Selecione o cliente e profissional e adicione quantos serviços e produtos forem necessários.</p>'+
      '<label>Vincular agendamento (opcional)</label><select id="edduCommandAppointment"><option value="">Sem agendamento</option>'+appointmentOptions+'</select>'+
      '<label>Cliente *</label><select id="edduCommandClient">'+options(clients,'Selecione o cliente',d.clientId)+'</select>'+
      '<label>Profissional *</label><select id="edduCommandProfessional">'+options(professionals,'Selecione o profissional',d.professionalId)+'</select>'+
      '<div class="card"><b>Serviços e produtos</b><label>Adicionar item</label><select id="edduCommandItem"><option value="">Selecione serviço ou produto</option>'+itemOptions()+'</select><div class="row"><div style="flex:1"><label>Quantidade</label><input id="edduCommandQty" type="number" min="1" step="1" value="1"></div><div style="flex:1;align-self:end"><button type="button" class="btn primary full" data-eddu-command-action="add-draft-item">＋ Adicionar item</button></div></div>'+
      (itemRows||'<p class="sub">Nenhum serviço ou produto adicionado.</p>')+'</div>'+
      '<div class="card"><b>Cupom de desconto</b><div class="row"><div style="flex:1"><input id="edduCommandCoupon" value="'+esc(d.couponCode||'')+'" placeholder="Digite o código do cupom"></div><button type="button" class="btn" data-eddu-command-action="coupon">Aplicar</button></div>'+
      (d.coupon?'<p>Aplicado: <b>'+esc(d.coupon.code)+'</b> · − '+money(sum.discount)+' <button type="button" class="btn" data-eddu-command-action="remove-coupon">Remover cupom</button></p>':'<p class="sub">O desconto será validado com os cupons ativos cadastrados no Neon.</p>')+'</div>'+
      '<div class="card"><div class="row"><span>Subtotal</span><b>'+money(sum.subtotal)+'</b></div><div class="row"><span>Desconto</span><b>− '+money(sum.discount)+'</b></div><div class="row"><b>Total da comanda</b><b>'+money(sum.total)+'</b></div></div>'+
      '<div class="grid2"><button type="button" class="btn primary" data-eddu-command-action="save">Salvar comanda</button><button type="button" class="btn" data-eddu-command-action="back">Cancelar</button></div>';
  }
  window.views=window.views||{};
  window.views.command=function(){return window.__EDDU_COMMAND_MODE==='form'?renderForm():renderList();};
  window.edduPrefillCommandFromAppointment=function(sel){const o=sel?.selectedOptions?.[0],d=window.__EDDU_COMMAND_DRAFT;if(!o?.value||!d)return;d.appointmentId=o.value;d.clientId=o.dataset.client||d.clientId;d.professionalId=o.dataset.professional||d.professionalId;refresh();};
  async function saveDraft(){
    const d=window.__EDDU_COMMAND_DRAFT;if(!d)throw new Error('Rascunho da comanda não encontrado.');
    d.clientId=$('edduCommandClient')?.value||d.clientId;d.professionalId=$('edduCommandProfessional')?.value||d.professionalId;d.appointmentId=$('edduCommandAppointment')?.value||null;
    if(!UUID.test(d.clientId)||!UUID.test(d.professionalId))throw new Error('Selecione cliente e profissional cadastrados no Neon.');
    if(!d.items.length)throw new Error('Adicione pelo menos um serviço ou produto.');
    const db=await api(),sum=totals(d),professional=rows('professionals').find(x=>x.id===d.professionalId);
    if(!(sum.total>=0)||sum.subtotal<=0)throw new Error('O total da comanda precisa ser maior que zero.');
    const payload={client_id:d.clientId,professional_id:d.professionalId,appointment_id:d.appointmentId||null,status:'open',subtotal:sum.subtotal,total:sum.total,discount:sum.discount,discount_reason:d.coupon?.code||null};
    let command;
    if(d.id){command=await db.update('commands',d.id,payload);if(!command?.id)throw new Error('O Neon não confirmou a atualização da comanda.');}
    else{command=await db.insert('commands',payload);if(!command?.id)throw new Error('O Neon não confirmou a criação da comanda.');}
    const existing=rows('commandItems').filter(x=>x.command_id===command.id),saved=[];
    try{
      for(const item of d.items){
        const rowPayload={command_id:command.id,item_type:item.item_type,service_id:item.service_id||null,product_id:item.product_id||null,description:item.description,quantity:item.quantity,unit_price:item.unit_price,total:item.total,professional_id:d.professionalId,unit_cost:Number(item.unit_cost||0),commission_percent:Number(item.commission_percent??professional?.commission_rate??0)};
        let row;
        if(item.id){row=await db.update('command_items',item.id,rowPayload);}
        else row=await db.insert('command_items',rowPayload);
        if(!row?.id)throw new Error('O Neon não confirmou um item da comanda.');
        saved.push(row);
      }
      for(const prior of existing)if(!saved.some(x=>x.id===prior.id))await db.delete('command_items',prior.id);
      data().commandItems=[...rows('commandItems').filter(x=>x.command_id!==command.id),...saved];
      data().commands=[command,...rows('commands').filter(x=>x.id!==command.id)];
      window.state=window.state||{};window.state.commands=data().commands;window.state.activeCommandId=command.id;
      if(d.coupon?.id&&!d.id){try{const coupon=rows('coupons').find(x=>x.id===d.coupon.id);if(coupon)await db.update('coupons',coupon.id,{usage_count:Number(coupon.usage_count||0)+1});}catch(e){console.error('[EDDU] coupon usage counter update failed',e);}}
      window.__EDDU_COMMAND_DRAFT=null;window.__EDDU_COMMAND_MODE='list';window.toast?.(d.id?'Comanda atualizada no Neon.':'Comanda lançada no Neon.');refresh();
    }catch(error){
      console.error('[EDDU] command item persistence failed',error);
      throw new Error('A comanda foi criada/atualizada, mas houve falha ao gravar todos os itens: '+String(error?.message||error));
    }
  }
  async function applyCoupon(){
    const d=window.__EDDU_COMMAND_DRAFT,code=String($('edduCommandCoupon')?.value||'').trim().toUpperCase();
    if(!d||!code)throw new Error('Digite o código do cupom.');
    const c=rows('coupons').find(x=>String(x.code||'').trim().toUpperCase()===code);
    if(!c||c.active!==true)throw new Error('Cupom inexistente ou inativo.');
    const now=Date.now();if(c.starts_at&&new Date(c.starts_at).getTime()>now)throw new Error('Este cupom ainda não está vigente.');
    if(c.expires_at&&new Date(c.expires_at).getTime()<now)throw new Error('Este cupom está expirado.');
    if(c.usage_limit!=null&&Number(c.usage_count||0)>=Number(c.usage_limit))throw new Error('Este cupom atingiu o limite de utilizações.');
    if(c.service_id&&!d.items.some(i=>i.service_id===c.service_id))throw new Error('Este cupom só pode ser usado no serviço correspondente.');
    const type=String(c.type||'').toLowerCase();if(!['percent','percentage','percentual','porcentagem','fixed','amount','valor','fixed_amount'].includes(type))throw new Error('Tipo de desconto do cupom não reconhecido: '+c.type);
    d.coupon={id:c.id,code:c.code,type:c.type,value:Number(c.value)};d.couponCode=c.code;refresh();
  }
  async function cancelCommand(id){if(rows('payments').some(p=>p.command_id===id&&['CHECKOUT_PENDING','PENDING','AWAITING_PAYMENT'].includes(String(p.status||'').toUpperCase())))throw new Error('Esta comanda já possui cobrança pendente. Cancele a cobrança no gateway antes de cancelar a comanda.');const db=await api();const saved=await db.update('commands',id,{status:'cancelled'});if(!saved?.id)throw new Error('O Neon não confirmou o cancelamento.');data().commands=[saved,...rows('commands').filter(x=>x.id!==id)];window.state.commands=data().commands;window.toast?.('Comanda cancelada no Neon.');refresh();}
  window.edduCancelCommand=cancelCommand;
  window.edduCreateCommand=async()=>{window.__EDDU_COMMAND_MODE='form';await saveDraft();};
  window.edduSendCommandToPayment=sendPayment;
  async function removeCommand(id){
    const c=activeCommands().find(x=>x.id===id);if(!c)throw new Error('Comanda não encontrada.');
    if(String(c.status||'open').toLowerCase()!=='open')throw new Error('Só é possível excluir definitivamente comandas ainda não enviadas para pagamento. Para pagamentos pendentes, use o cancelamento.');
    const db=await api(),items=rows('commandItems').filter(x=>x.command_id===id);
    for(const item of items)await db.delete('command_items',item.id);
    await db.delete('commands',id);
    data().commandItems=rows('commandItems').filter(x=>x.command_id!==id);data().commands=rows('commands').filter(x=>x.id!==id);window.state.commands=data().commands;
    if(window.state.activeCommandId===id)window.state.activeCommandId=null;
    window.toast?.('Comanda excluída do Neon.');refresh();
  }
  async function sendPayment(id){
    const c=activeCommands().find(x=>x.id===id);if(!c)throw new Error('Comanda não encontrada.');
    if(terminal.includes(String(c.status||'').toLowerCase()))throw new Error('Esta comanda já foi encerrada.');
    if(String(c.status||'').toLowerCase()==='payment_pending')throw new Error('Esta comanda já foi enviada ao aplicativo do cliente e aguarda pagamento.');
    if(rows('payments').some(p=>p.command_id===id&&['CHECKOUT_PENDING','PENDING','AWAITING_PAYMENT'].includes(String(p.status||'').toUpperCase())))throw new Error('Esta comanda já foi enviada ao cliente e possui cobrança pendente. Consulte o aplicativo do cliente antes de gerar outra cobrança.');
    if(!c.client_id||!c.items.length||!(Number(c.total)>0))throw new Error('A comanda precisa ter cliente, itens e total válido.');
    window.state=window.state||{};window.state.activeCommandId=id;
    if(typeof window.__edduOpenGatewayRanking!=='function')throw new Error('O ranking de gateways não foi carregado.');
    await window.__edduOpenGatewayRanking(c);
  }
  document.addEventListener('click',async event=>{
    const b=event.target?.closest?.('[data-eddu-command-action]');if(!b)return;
    event.preventDefault();event.stopPropagation();if(b.dataset.busy==='1')return;b.dataset.busy='1';
    const action=b.dataset.edduCommandAction,id=b.dataset.commandId;
    try{
      if(action==='new')draftNew();
      else if(action==='reload'){await api();await window.EDDU_NEON_SYNC?.();window.__EDDU_COMMAND_MODE='list';refresh();}
      else if(action==='back'){window.__EDDU_COMMAND_DRAFT=null;window.__EDDU_COMMAND_MODE='list';refresh();}
      else if(action==='edit'){const c=activeCommands().find(x=>x.id===id);if(!c)throw new Error('Comanda não encontrada.');draftFromCommand(c);}
      else if(action==='add-draft-item'){
        const d=window.__EDDU_COMMAND_DRAFT,raw=$('edduCommandItem')?.value,qty=Number($('edduCommandQty')?.value||1);if(!raw)throw new Error('Selecione um serviço ou produto.');if(!Number.isInteger(qty)||qty<1)throw new Error('Quantidade inválida.');
        const [kind,itemId]=raw.split(':'),item=(kind==='product'?rows('products'):rows('services')).find(x=>x.id===itemId);if(!item)throw new Error('Item não encontrado no Neon.');
        const unit=itemPrice(kind,item);if(!Number.isFinite(unit)||unit<0)throw new Error('Preço inválido.');
        d.items.push({item_type:kind,service_id:kind==='service'?itemId:null,product_id:kind==='product'?itemId:null,description:item.name,quantity:qty,unit_price:unit,total:unit*qty,unit_cost:Number(item.service_cost??item.cost_price??0)});
        refresh();
      }else if(action==='remove-item'){const d=window.__EDDU_COMMAND_DRAFT;d.items.splice(Number(b.dataset.itemIndex),1);refresh();}
      else if(action==='coupon')await applyCoupon();
      else if(action==='remove-coupon'){const d=window.__EDDU_COMMAND_DRAFT;d.coupon=null;d.couponCode='';refresh();}
      else if(action==='save')await saveDraft();
      else if(action==='delete'){if(!confirm('Excluir definitivamente esta comanda aberta e seus itens?'))return;await removeCommand(id);}
      else if(action==='cancel'){if(!confirm('Cancelar esta comanda?'))return;await cancelCommand(id);}
      else if(action==='payment')await sendPayment(id);
    }catch(error){console.error('[EDDU] command action failed',error);window.toast?.(String(error?.message||error));}
    finally{b.dataset.busy='0';}
  },true);
  window.addEventListener('eddu-neon-sync-complete',()=>{const shade=$('shade'),view=$('view');if(shade?.classList.contains('show')&&view?.querySelector('h2')?.textContent?.includes('Central de Comandas'))refresh();});
  window.addEventListener('eddu-neon-data-changed',e=>{if(!['clients','professionals','services','products','commands','command_items','coupons'].includes(e.detail?.entity))return;const shade=$('shade'),view=$('view');if(shade?.classList.contains('show')&&view?.querySelector('h2')?.textContent?.includes('Central de Comandas')&&window.__EDDU_COMMAND_MODE!=='form')refresh();});
  window.EDDU_COMMANDS_RUNTIME_READY=true;
})();