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
 if(!window.EDDU_NEON_API||typeof window.persist!=='function')throw new Error('A persistência do Neon não foi carregada. Recarregue o aplicativo.');
 if(window.__EDDU_NEON_READY!==true||window.__EDDU_NEON_CONNECTED!==true)throw new Error('Aguarde a conexão autenticada com o Neon antes de enviar a comanda.');
 await window.persist();
 if(!UUID.test(String(c.id||'')))throw new Error('O Neon não confirmou o identificador da comanda.');
 if(!(data.commands||[]).some(x=>x.id===c.id))throw new Error('A comanda não foi confirmada na lista persistida do Neon.');
 return c;
}
window.__edduOpenGatewayRanking=async function(command){
 let c;
 try{c=await persistCommandBeforeCheckout(command||currentCommand())}catch(error){toast('Não foi possível salvar a comanda no Neon: '+String(error?.message||error));return false}
 const id=commandId(c);
 if(!UUID.test(String(id||''))){toast('O identificador da comanda não é válido no Neon.');return false}
 const p={commandId:id,amount:amountOf(c),command:c,client:clientOf(c)};window.__edduPendingPayment=p;
 window.views=window.views||{};
 window.views.gatewayRanking=function(){return '<h2>Ranking Gateway</h2><p class="sub">O sistema consulta os gateways conectados e compara as condições disponíveis.</p><div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Cliente</span><b>'+esc(p.client.name||'Cliente')+'</b></div><div class="row"><span>Total</span><b>'+money(p.amount)+'</b></div></div><div class="card"><h3>Forma de pagamento</h3><select id="v52Method"><option value="pix">PIX</option><option value="card">Cartão de crédito</option><option value="pdv">PDV presencial</option></select><div id="v52RankBox" style="margin-top:12px">Consultando gateways…</div></div><button class="btn full" type="button" onclick="openSheet(\'command\')">← Voltar à comanda</button>'};
 open('gatewayRanking');
 setTimeout(async()=>{
  const methodEl=document.getElementById('v52Method'),box=document.getElementById('v52RankBox');
  const render=async()=>{const method=methodEl?.value||'pix';if(method==='pdv'){box.innerHTML='<div class="option"><span><b>PDV presencial</b><small>Registrar pagamento feito na máquina/PDV.</small></span><strong>›</strong></div><button class="btn primary full" id="v52Pdv" type="button">Registrar pagamento no PDV</button>';document.getElementById('v52Pdv')?.addEventListener('click',()=>window.__edduSelectGateway('PDV'));return}
   try{const u='/api/payments?mode=rank&amount='+encodeURIComponent(p.amount)+'&method='+method+'&installments=1';const r=await fetch(u,{credentials:'include',headers:await sessionHeaders()});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Falha ao consultar ranking');const rows=d.ranking||[];box.innerHTML=rows.length?rows.map(x=>'<button class="option gateway-choice" data-gateway="'+esc(x.gateway)+'" style="width:100%;text-align:left;margin:7px 0" type="button"><span><b>'+esc(x.position)+'. '+esc(providerLabel(x.gateway))+'</b><small>'+(x.fee_known?('Líquido estimado: '+money(x.net_amount)+' · taxa '+Number(x.fee_percent).toFixed(2)+'%'):'Conectado · taxa a confirmar')+'</small></span><strong>›</strong></button>').join(''):'<p>Nenhum gateway com credencial disponível no ambiente.</p>';
    box.querySelectorAll('.gateway-choice').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();window.__edduSelectGateway(b.dataset.gateway,method)}));
   }catch(e){box.innerHTML='<p>Não foi possível consultar o ranking: '+esc(e.message)+'</p>'}
  };
  methodEl?.addEventListener('change',render);render();
 },30);
 return true
};
window.__edduSelectGateway=function(gateway,method){
 const p=window.__edduPendingPayment||{};p.gateway=gateway;p.method=method||'pix';window.__edduPendingPayment=p;persist(p);
 if(gateway==='PDV'){toast('Fluxo PDV selecionado. Registre o pagamento presencial para lançar a quitação.');open('payments');return}
 window.views=window.views||{};
 window.views.gatewayPayment=function(){return '<h2>Checkout · '+esc(providerLabel(gateway))+'</h2><p class="sub">A cobrança será criada no provedor selecionado. A comanda permanece aguardando confirmação.</p><div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Gateway</span><b>'+esc(providerLabel(gateway))+'</b></div><div class="row"><span>Total</span><b>'+money(p.amount)+'</b></div></div><div class="card"><label>Forma de pagamento</label><select id="v52PayMethod">'+'<option value="'+esc(p.method==='card'?'card':'pix')+'">'+(p.method==='card'?'Cartão de crédito':'PIX')+'</option>'+'</select><label>Parcelas</label><select id="v52Installments">'+[1,12].map(n=>'<option value="'+n+'">'+n+'x</option>').join('')+'</select><div id="v52CheckoutInfo" class="card" style="margin-top:10px"></div></div><button class="btn primary full" id="v52Checkout" type="button">✓ Gerar cobrança</button><button class="btn full" type="button" onclick="openSheet(\'gatewayRanking\')">← Trocar gateway</button>'};
 open('gatewayPayment');
 setTimeout(()=>{
  const methodEl=document.getElementById('v52PayMethod'),inst=document.getElementById('v52Installments'),info=document.getElementById('v52CheckoutInfo');
  const sync=()=>{const card=methodEl?.value==='card',stripeOnly=gateway==='Stripe';if(inst){inst.disabled=!card||stripeOnly;if(!card||stripeOnly)inst.value='1';}if(info)info.innerHTML=card?'<div class="row"><span>Parcelamento</span><b>'+inst?.value+'x</b></div>':'<div class="row"><span>Valor</span><b>'+money(p.amount)+'</b></div>'};methodEl?.addEventListener('change',sync);inst?.addEventListener('change',sync);sync();
  document.getElementById('v52Checkout')?.addEventListener('click',async()=>{
   const b=document.getElementById('v52Checkout');b.disabled=true;b.textContent='Gerando cobrança…';
   let checkoutTab=null;
   try{
    checkoutTab=window.open('about:blank','_blank');
    const m=methodEl?.value||p.method||'pix',n=m==='card'?Number(inst?.value||1):1;
    const body={commandId:p.commandId,clientId:p.client?.id||null,amount:p.amount,gateway,method:m,installments:n,customerName:p.client?.name||'Cliente ED & DU',customerEmail:p.client?.email||'',customerPhone:p.client?.phone||'',customerDocument:p.client?.document||'',description:'Comanda '+p.commandId};
    const idem='EDDU-'+p.commandId+'-'+gateway+'-'+m+'-'+n;const r=await fetch('/api/payments',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':idem,...await sessionHeaders()},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'Não foi possível gerar a cobrança.');
    const record={...p,method:m,installments:n,payment:d.payment,checkoutUrl:d.checkoutUrl||null,qrCode:d.qrCode||null,status:'CHECKOUT_PENDING',createdAt:new Date().toISOString()};persist(record);window.__edduPendingPayment=record;
    if(d.checkoutUrl){if(checkoutTab&&!checkoutTab.closed)checkoutTab.location.replace(d.checkoutUrl);else window.location.assign(d.checkoutUrl);toast('✓ Checkout '+providerLabel(gateway)+' aberto. A comanda só será quitada após a confirmação do gateway.');}
    else if(d.qrCode){info.innerHTML='<p><b>QR/PIX '+esc(providerLabel(gateway))+' gerado.</b></p><textarea readonly style="width:100%;min-height:90px">'+esc(d.qrCode)+'</textarea><p>Não marque a comanda como paga. A baixa ocorrerá após a confirmação do gateway.</p>';toast('✓ Cobrança '+providerLabel(gateway)+' criada.');return;}
    else {toast('✓ Cobrança criada; aguardando confirmação do gateway.');open('payments');}
   }catch(e){try{if(checkoutTab&&!checkoutTab.closed)checkoutTab.close()}catch(_){}toast('Não foi possível gerar a cobrança: '+e.message);b.disabled=false;b.textContent='✓ Gerar cobrança'}
  },{once:true});
 },40);
};
function isClose(el){if(!el)return false;const t=((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase().replace(/\s+/g,' ');return /(fechar|finalizar|encerrar)\s*(comanda|atendimento)|fechar\s*comanda|finalizar\s*comanda/.test(t)}
document.addEventListener('click',e=>{const el=e.target?.closest?.('button,a,[role="button"],[onclick]');if(!isClose(el)||el.closest('.gateway-choice')||el.id==='v52Checkout')return;e.preventDefault();e.stopImmediatePropagation();window.__edduOpenGatewayRanking(currentCommand())},true);
window.closeCommandAndOpenGateway=c=>window.__edduOpenGatewayRanking(c||currentCommand());
window.EDDU_MASTER_V53_UNIFIED_GATEWAYS=true;
})();