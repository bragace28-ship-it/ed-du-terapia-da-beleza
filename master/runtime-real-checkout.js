/* MASTER V46 — unified gateway ranking/checkout bridge
   Functional-only layer. the approved Master UI remains immutable.
*/
(function(){
'use strict';
const toast=m=>{try{if(typeof window.toast==='function')window.toast(m);else alert(m)}catch(_){}};
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gateways=['PagBank','Asaas','Stripe'];
function currentCommand(){try{const active=window.state?.commands?.find(x=>x.id===window.state?.activeCommandId);const c=[active,window.state?.currentCommand,window.state?.selectedCommand,window.data?.currentCommand,window.currentCommand,window.selectedCommand,window.state?.command].find(Boolean);if(c)return c;for(const k of ['eddu_current_command_v46','eddu_current_command','eddu_command_draft']){const v=JSON.parse(localStorage.getItem(k)||'null');if(v)return v}}catch(_){}return null}
function amountOf(c){return Number(c?.total??c?.amount??c?.valor??c?.grandTotal??c?.finalTotal??c?.net_amount??c?.netAmount??0)||0}
function commandId(c){return c?.id||c?.commandId||c?.number||c?.codigo||'CMD-'+Date.now()}
function clientOf(c){const x=c?.client||c?.customer||c?.cliente||{};return typeof x==='string'?{id:c?.client_id||c?.clientId||null,name:x,email:c?.clientEmail||c?.client_email||'',phone:c?.clientPhone||c?.client_phone||'',document:c?.clientCpf||c?.cpf||''}:{id:x?.id||c?.client_id||c?.clientId,name:x?.name||x?.nome||c?.clientName||c?.client_name,email:x?.email||c?.clientEmail||c?.client_email,phone:x?.phone||x?.telefone||c?.clientPhone||c?.client_phone,document:x?.cpf||x?.document||c?.clientCpf||c?.cpf}}
function open(route){return typeof window.openSheet==='function'?window.openSheet(route):typeof window.__masterOpenSheet==='function'?window.__masterOpenSheet(route):false}
function persist(p){try{localStorage.setItem('eddu_gateway_checkout_pending',JSON.stringify(p))}catch(_){}}
function providerLabel(g){return g}
async function sessionHeaders(){
 try{const result=await window.EDDU_NEON_GET_SESSION?.();const session=result?.data?.session||result?.session||result;
  const token=session?.token||session?.accessToken||session?.access_token;
  return token?{'Authorization':'Bearer '+token}:{};
 }catch(_){return {}}
}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function byIdOrName(list,id,name){return (Array.isArray(list)?list:[]).find(x=>(id&&x.id===id)||(!id&&name&&String(x.name||'').trim().toLowerCase()===String(name).trim().toLowerCase()))||null}
async function persistCommandBeforeCheckout(command){
 const c=command||currentCommand();
 if(!c||typeof c!=='object')throw new Error('Não encontrei a comanda atual. Abra a comanda e tente novamente.');
 const data=window.data||(window.data={});
 const commands=Array.isArray(window.state?.commands)?window.state.commands:(Array.isArray(data.commands)?data.commands:[]);
 if(!commands.includes(c))commands.unshift(c);
 data.commands=commands;
 const client=clientOf(c),clients=Array.isArray(data.clients)?data.clients:[];
 const clientRow=byIdOrName(clients,client.id,client.name||c.client);
 c.client_id=c.client_id||c.clientId||clientRow?.id||null;
 if(!UUID.test(String(c.client_id||'')))throw new Error('Selecione um cliente cadastrado no Neon antes de salvar a comanda.');
 const professional=c.professional&&typeof c.professional==='object'?c.professional:{};
 const professionalRow=byIdOrName(data.professionals,c.professional_id||c.professionalId,professional.name||c.professional);
 c.professional_id=c.professional_id||c.professionalId||professionalRow?.id||null;
 const amount=amountOf(c);
 if(!(amount>0))throw new Error('A comanda está sem valor total. Confira os serviços e produtos lançados.');
 c.subtotal=Number(c.subtotal??c.grossAmount??amount);
 c.total=amount;
 c.discount=Number(c.discount||0);
 if(!['paid','closed','cancelled','refunded'].includes(String(c.status||'').toLowerCase()))c.status='awaiting_payment';
 const sourceItems=Array.isArray(c.items)?c.items:(Array.isArray(c.services)?c.services:[]);
 if(!sourceItems.length)throw new Error('A comanda não possui serviços ou produtos vinculados. Adicione ao menos um item antes de enviar para pagamento.');
 c.items=sourceItems.map(item=>{
  const product=!!(item.product_id||item.productId||item.item_type==='product');
  const list=product?data.products:data.services;
  const found=byIdOrName(list,product?(item.product_id||item.productId):(item.service_id||item.serviceId),item.description||item.service||item.name);
  const id=product?(item.product_id||item.productId||found?.id):(item.service_id||item.serviceId||found?.id);
  if(!UUID.test(String(id||'')))throw new Error('O item "'+String(item.description||item.service||item.name||'sem nome')+'" não está vinculado a um '+(product?'produto':'serviço')+' cadastrado no Neon.');
  const quantity=Number(item.quantity??item.qty??1),unitPrice=Number(item.unit_price??item.price??item.unitPrice??0);
  if(!(quantity>0)||unitPrice<0||!Number.isFinite(unitPrice))throw new Error('Confira a quantidade e o valor dos itens da comanda.');
  return {...item,item_type:product?'product':'service',service_id:product?null:id,product_id:product?id:null,description:item.description||item.service||item.name||found?.name||'Item da comanda',quantity,unit_price:unitPrice,total:Number(item.total??quantity*unitPrice),professional_id:item.professional_id||item.professionalId||c.professional_id||null};
 });
 const itemsToSave=c.items.slice();
 if(!window.EDDU_NEON_API)throw new Error('A API de gravação do Neon não foi carregada. Recarregue o aplicativo.');
 if(window.__EDDU_NEON_READY!==true||window.__EDDU_NEON_SESSION!==true||window.__EDDU_NEON_CONNECTED!==true)throw new Error('Aguarde a autenticação e a sincronização das comandas no Neon.');
 const api=window.EDDU_NEON_API;
 const commandPayload={client_id:c.client_id,professional_id:c.professional_id||null,status:'open',subtotal:c.subtotal,total:c.total,discount:c.discount};
 const originalCommandId=c.id;
 let savedCommand;
 if(UUID.test(String(c.id||''))){
  try{savedCommand=await api.update('commands',c.id,commandPayload)}
  catch(error){if(!/NOT_FOUND/.test(String(error?.message||error)))throw error;savedCommand=await api.insert('commands',commandPayload)}
 }else savedCommand=await api.insert('commands',commandPayload);
 if(!savedCommand?.id||!UUID.test(savedCommand.id))throw new Error('O Neon não confirmou a gravação da comanda.');
 Object.assign(c,savedCommand);
 const priorItems=Array.isArray(data.commandItems)?data.commandItems.filter(x=>x.command_id===c.id||x.command_id===originalCommandId):[];
 const savedItems=[];
 for(let index=0;index<itemsToSave.length;index++){
  const item=itemsToSave[index], prior=priorItems.find(x=>x.id===item.id)||priorItems[index]||null;
  const itemPayload={command_id:c.id,item_type:item.item_type,service_id:item.service_id||null,product_id:item.product_id||null,description:item.description,quantity:item.quantity,unit_price:item.unit_price,total:item.total,professional_id:item.professional_id||c.professional_id||null,unit_cost:Number(item.unit_cost||0),commission_percent:Number(item.commission_percent||0)};
  const itemId=item.id||prior?.id;
  let savedItem;
  if(UUID.test(String(itemId||''))){
   try{savedItem=await api.update('command_items',itemId,itemPayload)}
   catch(error){if(!/NOT_FOUND/.test(String(error?.message||error)))throw error;savedItem=await api.insert('command_items',itemPayload)}
  }else savedItem=await api.insert('command_items',itemPayload);
  if(!savedItem?.id)throw new Error('O Neon não confirmou um dos itens da comanda.');
  savedItems.push(savedItem);
 }
 const confirmed=await api.update('commands',c.id,{status:'awaiting_payment',subtotal:c.subtotal,total:c.total,discount:c.discount});
 if(!confirmed?.id)throw new Error('O Neon não confirmou a preparação da comanda para pagamento.');
 Object.assign(c,confirmed,{items:savedItems});
 data.commands=[c,...(Array.isArray(data.commands)?data.commands.filter(x=>x.id!==c.id):[])];
 data.commandItems=[...(Array.isArray(data.commandItems)?data.commandItems.filter(x=>x.command_id!==c.id):[]),...savedItems];
 window.state=window.state||{};window.state.commands=data.commands;window.state.activeCommandId=c.id;
 if(!(data.commands||[]).some(x=>x.id===c.id)||savedItems.length!==itemsToSave.length)throw new Error('A confirmação da comanda e de seus itens ficou incompleta.');
 window.__EDDU_NEON_LAST_COMMAND_SAVE={at:new Date().toISOString(),commandId:c.id,itemCount:savedItems.length,status:confirmed.status};
 return c;
}
window.__edduOpenGatewayRanking=async function(command){
 let c;
 try{c=await persistCommandBeforeCheckout(command||currentCommand())}catch(error){toast('Não foi possível salvar a comanda no Neon: '+String(error?.message||error));return false}
 const id=commandId(c);
 if(!UUID.test(String(id||''))){toast('O identificador da comanda não é válido no Neon.');return false}
 const p={commandId:id,amount:amountOf(c),command:c,client:clientOf(c)};window.__edduPendingPayment=p;
 window.views=window.views||{};
 window.views.gatewayRanking=function(){return '<h2>Ranking Gateway</h2><p class="sub">O sistema consulta os gateways conectados e compara as condições disponíveis.</p><div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Cliente</span><b>'+esc(p.client.name||'Cliente')+'</b></div><div class="row"><span>Total</span><b>'+money(p.amount)+'</b></div></div><div class="card"><h3>Forma de pagamento</h3><select id="v52Method"><option value="pix">PIX</option><option value="card">Cartão de crédito</option><option value="pdv">PDV presencial</option></select><select id="v52RankInstallments" style="display:none;margin-top:10px"><option value="1">1x</option><option value="12">12x</option></select><div id="v52RankBox" style="margin-top:12px">Consultando gateways…</div></div><button class="btn full" type="button" onclick="openSheet(\'command\')">← Voltar à comanda</button>'};
 open('gatewayRanking');
 setTimeout(async()=>{
  const methodEl=document.getElementById('v52Method'),installmentsEl=document.getElementById('v52RankInstallments'),box=document.getElementById('v52RankBox');
  const render=async()=>{const method=methodEl?.value||'pix',installments=method==='card'?Number(installmentsEl?.value||1):1;if(installmentsEl)installmentsEl.style.display=method==='card'?'block':'none';if(method==='pdv'){box.innerHTML='<div class="option"><span><b>PDV presencial</b><small>Registrar pagamento feito na máquina/PDV.</small></span><strong>›</strong></div><button class="btn primary full" id="v52Pdv" type="button">Registrar pagamento no PDV</button>';document.getElementById('v52Pdv')?.addEventListener('click',()=>window.__edduSelectGateway('PDV'));return}
   try{const u='/api/payments?mode=rank&amount='+encodeURIComponent(p.amount)+'&method='+method+'&installments='+installments;const r=await fetch(u,{credentials:'include',headers:await sessionHeaders()});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Falha ao consultar ranking');const rows=d.ranking||[];box.innerHTML=rows.length?rows.map(x=>'<button class="option gateway-choice" data-gateway="'+esc(x.gateway)+'" style="width:100%;text-align:left;margin:7px 0" type="button"><span><b>'+esc(x.position)+'. '+esc(providerLabel(x.gateway))+'</b><small>'+(x.fee_known?('Líquido estimado: '+money(x.net_amount)+' · taxa '+Number(x.fee_percent).toFixed(2)+'%'):'Conectado · taxa a confirmar')+'</small></span><strong>›</strong></button>').join(''):'<p>Nenhum gateway com credencial disponível no ambiente.</p>';
    box.querySelectorAll('.gateway-choice').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();window.__edduSelectGateway(b.dataset.gateway,method,installments)}));
   }catch(e){box.innerHTML='<p>Não foi possível consultar o ranking: '+esc(e.message)+'</p>'}
  };
  methodEl?.addEventListener('change',render);installmentsEl?.addEventListener('change',render);render();
 },30);
 return true
};
window.__edduSelectGateway=function(gateway,method,installments){
 const p=window.__edduPendingPayment||{};
 p.gateway=gateway;p.method=method||'pix';p.installments=p.method==='card'?Number(installments||1):1;
 window.__edduPendingPayment=p;persist(p);
 if(gateway==='PDV'){toast('Fluxo PDV selecionado. Registre o pagamento presencial para lançar a quitação.');open('payments');return}
 const n=p.installments;
  window.views=window.views||{};
 window.views.gatewayPayment=function(){return '<h2>Pagamento enviado ao cliente</h2><p class="sub">Criando a cobrança no gateway escolhido. O checkout ficará disponível na área do cliente; a comanda só será quitada após a confirmação do provedor.</p><div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Gateway</span><b>'+esc(providerLabel(gateway))+'</b></div><div class="row"><span>Forma</span><b>'+(p.method==='card'?'Cartão de crédito':'PIX')+'</b></div><div class="row"><span>Parcelas</span><b>'+n+'x</b></div><div class="row"><span>Total</span><b>'+money(p.amount)+'</b></div><p id="v52CheckoutInfo">Conectando ao provedor…</p></div><button class="btn full" type="button" onclick="openSheet(\'gatewayRanking\')">← Voltar ao ranking</button>'};
 open('gatewayPayment');
 (async()=>{
  try{
   const body={commandId:p.commandId,clientId:p.client?.id||null,amount:p.amount,gateway,method:p.method,installments:n,customerName:p.client?.name||'Cliente ED & DU',customerEmail:p.client?.email||'',customerPhone:p.client?.phone||'',customerDocument:p.client?.document||'',description:'Comanda '+p.commandId};
   const idem='EDDU-'+p.commandId+'-'+gateway+'-'+p.method+'-'+n;
   const r=await fetch('/api/payments',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':idem,...await sessionHeaders()},body:JSON.stringify(body)});
   const d=await r.json().catch(()=>({}));
   if(!r.ok||!d.ok)throw new Error(d.error||'Não foi possível gerar a cobrança.');
   const record={...p,payment:d.payment,checkoutUrl:d.checkoutUrl||null,qrCode:d.qrCode||null,qrCodeBase64:d.qrCodeBase64||null,status:'CHECKOUT_PENDING',createdAt:new Date().toISOString()};
   persist(record);window.__edduPendingPayment=record;
   const localCommand=window.state?.commands?.find(x=>x.id===p.commandId);if(localCommand){localCommand.status='payment_pending';localCommand.payment_link=d.checkoutUrl||null;}
   if(window.data){window.data.payments=[d.payment,...(Array.isArray(window.data.payments)?window.data.payments.filter(x=>x.id!==d.payment?.id):[])];}
   window.dispatchEvent(new CustomEvent('eddu-neon-data-changed',{detail:{operation:'update',entity:'commands',row:localCommand||null}}));
   if(d.checkoutUrl){
    const info=document.getElementById('v52CheckoutInfo');if(info)info.textContent='Cobrança criada. O cliente já pode abrir o checkout pelo aplicativo ED & DU. Aguardando confirmação do pagamento.';
    toast('Cobrança criada e disponibilizada para o cliente no aplicativo.');
   }else if(d.qrCode||d.qrCodeBase64){
    const info=document.getElementById('v52CheckoutInfo');
    if(info)info.innerHTML=(d.qrCodeBase64?'<img alt="QR Code Pix" style="width:min(260px,100%);display:block;margin:12px auto" src="data:image/png;base64,'+esc(d.qrCodeBase64)+'">':'')+(d.qrCode?'<textarea readonly style="width:100%;min-height:90px">'+esc(d.qrCode)+'</textarea>':'')+'<p>Pagamento aguardando confirmação automática do gateway.</p>';
    toast('Cobrança PIX criada e disponibilizada para o cliente. Aguardando confirmação do gateway.');
   }else{
    const info=document.getElementById('v52CheckoutInfo');if(info)info.textContent='Cobrança criada e aguardando confirmação do gateway.';
    toast('Cobrança criada. Aguardando confirmação do gateway.');
   }
  }catch(error){
   const info=document.getElementById('v52CheckoutInfo');if(info)info.textContent='Falha ao criar cobrança: '+String(error?.message||error);
   toast('Não foi possível gerar a cobrança: '+String(error?.message||error));
  }
 })();
};
function isClose(el){if(!el)return false;const t=((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase().replace(/\s+/g,' ');return /(fechar|finalizar|encerrar)\s*(comanda|atendimento)|fechar\s*comanda|finalizar\s*comanda/.test(t)}
document.addEventListener('click',e=>{const el=e.target?.closest?.('button,a,[role="button"],[onclick]');if(!isClose(el)||el.closest('.gateway-choice')||el.id==='v52Checkout')return;e.preventDefault();e.stopImmediatePropagation();window.__edduOpenGatewayRanking(currentCommand())},true);
window.closeCommandAndOpenGateway=c=>window.__edduOpenGatewayRanking(c||currentCommand());
document.addEventListener('click',function(event){
 const button=event.target?.closest?.('button,a,[role="button"],[onclick]');
 if(!button)return;
 if(button.matches?.('[data-eddu-command-action]')||/edduSendCommandToPayment|edduCreateCommand|edduCancelCommand/.test(button.getAttribute('onclick')||''))return;
 const label=String(button.innerText||button.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
 if(/salvar e enviar para pagamento|enviar para pagamento|escolher gateway e gerar cobrança real|aprovar pagamento de teste/.test(label)){
  event.preventDefault();event.stopImmediatePropagation();
  window.__edduOpenGatewayRanking(currentCommand());
  return;
 }
 if(/^💾?\s*salvar comanda$/.test(label)){
  event.preventDefault();event.stopImmediatePropagation();
  persistCommandBeforeCheckout(currentCommand()).then(()=>toast('Comanda salva no Neon.')).catch(error=>toast('Não foi possível salvar a comanda: '+String(error?.message||error)));
 }
},true);

/* Client-side payment inbox: a signed-in client only receives commands linked to their own client record. */
(function(){
 const original=window.views?.payments;
 const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
 async function load(){
  const node=document.getElementById('edduClientPendingCommands');if(!node)return;
  node.innerHTML='<p class="sub">Consultando cobranças vinculadas à sua conta…</p>';
  try{
   const result=await fetch('/api/client/commands',{credentials:'include',headers:await sessionHeaders()});
   const data=await result.json().catch(()=>({}));
   if(!result.ok||!data.ok)throw new Error(data.error||'Não foi possível consultar as cobranças.');
   const list=data.commands||[];
   node.innerHTML='<h3>Comandas aguardando pagamento</h3>'+(list.length?list.map(c=>{
    const items=Array.isArray(c.items)?c.items:[];
    return '<article class="card" style="margin:10px 0"><div class="row"><b>Comanda '+escHtml(String(c.command_id).slice(0,8))+'</b><b>'+brl(c.total)+'</b></div>'+
     '<p>'+items.map(i=>escHtml(i.description)+' × '+escHtml(i.quantity)).join(' · ')+'</p>'+
     (Number(c.discount||0)>0?'<p>Desconto: − '+brl(c.discount)+' '+escHtml(c.discount_reason||'')+'</p>':'')+
     '<p class="sub">Gateway: '+escHtml(c.gateway||'')+' · '+escHtml(c.method||'')+'</p>'+
     (c.checkout_url?'<button type="button" class="btn primary full" data-eddu-client-pay="'+escHtml(c.checkout_url)+'">Pagar agora</button>':
      (c.qr_code_base64?'<img alt="QR Code PIX" style="width:min(260px,100%);display:block;margin:12px auto" src="data:image/png;base64,'+escHtml(c.qr_code_base64)+'">':'')+
      (c.qr_code?'<textarea readonly style="width:100%;min-height:90px">'+escHtml(c.qr_code)+'</textarea>':'<p class="sub">Aguardando link do gateway.</p>'))+
     '</article>';
   }).join(''):'<p class="sub">Você não possui cobranças pendentes.</p>');
  }catch(error){node.innerHTML='<p class="sub">Não foi possível carregar as cobranças: '+escHtml(error.message)+'</p>';}
 }
 if(window.views){
  window.views.payments=function(){
   const base=typeof original==='function'?original():'<h2>Pagamentos</h2>';
   setTimeout(load,0);
   return base+'<section id="edduClientPendingCommands" style="margin-top:18px"><p class="sub">Carregando cobranças do cliente…</p></section>';
  };
 }
 document.addEventListener('click',event=>{
  const button=event.target?.closest?.('[data-eddu-client-pay]');if(!button)return;
  const url=button.getAttribute('data-eddu-client-pay')||'';
  if(!/^https:\/\//i.test(url)){toast('Link de pagamento inválido.');return;}
  event.preventDefault();window.open(url,'_blank','noopener');
 });
})();

window.EDDU_MASTER_V53_UNIFIED_GATEWAYS=true;
})();