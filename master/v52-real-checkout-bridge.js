/* MASTER V46 — V52 real command checkout bridge
   Additive functional fix. Preserves immutable V33 visual baseline.
   Flow: close command -> gateway ranking -> payment method/installments -> provider checkout.
*/
(function(){
'use strict';
const toast=m=>{try{if(typeof window.toast==='function')window.toast(m);else alert(m)}catch(_){}};
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rates={Asaas:{1:.0089,2:.0299,3:.0399,4:.0499,5:.0549,6:.0599,7:.0629,8:.0629,9:.0629,10:.0629,11:.0629,12:.0629}};
function currentCommand(){
 try{
  const c=[window.state?.currentCommand,window.state?.selectedCommand,window.data?.currentCommand,window.currentCommand,window.selectedCommand].find(Boolean);
  if(c)return c;
  for(const k of ['eddu_current_command_v46','eddu_current_command','eddu_command_draft']){const v=JSON.parse(localStorage.getItem(k)||'null');if(v)return v}
 }catch(_){}
 return null;
}
function amountOf(c){return Number(c?.net_amount??c?.netAmount??c?.total??c?.amount??c?.valor??c?.grandTotal??c?.finalTotal??0)||0}
function commandId(c){return c?.id||c?.commandId||c?.number||c?.codigo||'CMD-'+Date.now()}
function clientOf(c){
 const x=c?.client||c?.customer||c?.cliente||{};
 return typeof x==='string'?{name:x}:{id:x?.id||c?.client_id||c?.clientId,name:x?.name||x?.nome||c?.clientName||c?.client_name,email:x?.email||c?.clientEmail||c?.client_email,phone:x?.phone||x?.telefone||c?.clientPhone||c?.client_phone};
}
function open(route){return typeof window.openSheet==='function'?window.openSheet(route):typeof window.__masterOpenSheet==='function'?window.__masterOpenSheet(route):false}
function persistPending(p){try{localStorage.setItem('eddu_gateway_checkout_pending',JSON.stringify(p))}catch(_){}}
window.__edduOpenGatewayRanking=function(command){
 const c=command||currentCommand()||{},amount=amountOf(c),id=commandId(c),client=clientOf(c);
 window.__edduPendingPayment={commandId:id,amount,command:c,client};
 window.views=window.views||{};
 window.views.gatewayRanking=function(){
  return '<h2>Ranking Gateway</h2><p class="sub">Escolha o gateway disponível para gerar a cobrança.</p>'+
   '<div class="card"><div class="row"><span>Comanda</span><b>'+esc(id)+'</b></div><div class="row"><span>Cliente</span><b>'+esc(client.name||'Cliente')+'</b></div><div class="row"><span>Total</span><b>'+money(amount)+'</b></div></div>'+
   '<div class="card"><h3>Gateways</h3>'+
   '<button class="option gateway-choice" data-gateway="Asaas" type="button" style="width:100%;text-align:left;margin:8px 0"><span><b>1. Asaas</b><small>PIX, cartão e checkout oficial</small></span><strong>›</strong></button>'+
   '<div class="option" style="opacity:.6"><span><b>2. PagBank</b><small>Integração de checkout ainda não configurada</small></span></div>'+
   '<div class="option" style="opacity:.6"><span><b>3. Stripe</b><small>Integração de checkout ainda não configurada</small></span></div></div>'+
   '<button class="btn full" type="button" onclick="openSheet(\\'command\\')">← Voltar à comanda</button>';
 };
 open('gatewayRanking');
 setTimeout(()=>document.querySelectorAll('.gateway-choice').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();window.__edduSelectGateway(b.dataset.gateway)}),30);
 return true;
};
window.__edduSelectGateway=function(gateway){
 const p=window.__edduPendingPayment||{commandId:'',amount:0,client:{}};
 if(gateway!=='Asaas'){toast('Este gateway ainda não possui checkout conectado ao ambiente. Selecione Asaas.');return}
 p.gateway=gateway;window.__edduPendingPayment=p;persistPending(p);
 window.views=window.views||{};
 window.views.gatewayPayment=function(){
  return '<h2>Checkout · Asaas</h2><p class="sub">Defina a forma de pagamento e as parcelas. A confirmação abrirá o checkout oficial do Asaas.</p>'+
   '<div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Cliente</span><b>'+esc(p.client?.name||'Cliente')+'</b></div><div class="row"><span>Total</span><b>'+money(p.amount)+'</b></div></div>'+
   '<div class="card"><label>Forma de pagamento</label><select id="v52PayMethod"><option value="pix">PIX</option><option value="credit_card">Cartão de crédito</option><option value="boleto">Boleto</option></select>'+
   '<label>Parcelas</label><select id="v52Installments">'+[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>'<option value="'+n+'">'+n+'x</option>').join('')+'</select><div id="v52GatewayPreview" class="card"></div></div>'+
   '<button class="btn primary full" id="v52Checkout" type="button">✓ Gerar checkout e abrir Asaas</button>'+
   '<button class="btn full" type="button" onclick="openSheet(\\'gatewayRanking\\')">← Trocar gateway</button>';
 };
 open('gatewayPayment');
 setTimeout(()=>{
  const method=()=>document.getElementById('v52PayMethod')?.value||'pix';
  const calc=()=>{const n=Number(document.getElementById('v52Installments')?.value||1),fee=p.amount*(rates.Asaas[n]||rates.Asaas[12]),out=document.getElementById('v52GatewayPreview');if(out)out.innerHTML='<div class="row"><span>Taxa estimada</span><b>'+money(fee)+'</b></div><div class="row"><span>Líquido estimado</span><b>'+money(p.amount-fee)+'</b></div>'};
  document.getElementById('v52Installments')?.addEventListener('change',calc);calc();
  document.getElementById('v52Checkout')?.addEventListener('click',async()=>{
   const button=document.getElementById('v52Checkout');if(!button)return;
   button.disabled=true;button.textContent='Gerando checkout…';
   try{
    const m=method(),n=Number(document.getElementById('v52Installments')?.value||1);
    const idem='EDDU-'+p.commandId+'-'+m+'-'+n;
    const body={amount:Number(p.amount),customerId:p.client?.id||null,customerName:p.client?.name||'Cliente ED & DU',customerEmail:p.client?.email||'',customerPhone:p.client?.phone||'',billingType:m==='pix'?'PIX':m==='boleto'?'BOLETO':'CREDIT_CARD',installmentCount:n,externalReference:'EDDU-CMD-'+p.commandId,commandId:p.commandId,clientId:p.client?.id||null,description:'ED & DU | Comanda '+p.commandId};
    const res=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||!data.ok)throw new Error(data.error||'Não foi possível gerar a cobrança.');
    const checkout=data.checkoutUrl||data.provider?.invoiceUrl||data.provider?.bankSlipUrl;
    if(!checkout)throw new Error('O gateway criou a cobrança, mas não retornou a URL de checkout.');
    const record={...p,payment:data.payment,checkoutUrl:checkout,method:m,installments:n,status:'pending',createdAt:new Date().toISOString()};
    window.__edduPendingPayment=record;persistPending(record);
    try{const arr=JSON.parse(localStorage.getItem('eddu_master_gateway_payments_v51')||'[]');arr.unshift(record);localStorage.setItem('eddu_master_gateway_payments_v51',JSON.stringify(arr))}catch(_){}
    window.open(checkout,'_blank','noopener,noreferrer');
    toast('✓ Checkout Asaas aberto. O pagamento ficará pendente até a confirmação do gateway.');
    open('payments');
   }catch(err){toast('Não foi possível abrir o checkout: '+(err?.message||'erro desconhecido'));button.disabled=false;button.textContent='✓ Gerar checkout e abrir Asaas'}
  },{once:true});
 },40);
};
function isClose(el){
 if(!el)return false;
 const t=((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase().replace(/\\s+/g,' ');
 return /(fechar|finalizar|encerrar)\\s*(comanda|atendimento)|fechar\\s*comanda|finalizar\\s*comanda/.test(t)
}
document.addEventListener('click',e=>{
 const el=e.target?.closest?.('button,a,[role="button"],[onclick]');if(!isClose(el)||el.closest('.gateway-choice')||el.id==='v52Checkout')return;
 e.preventDefault();e.stopImmediatePropagation();window.__edduOpenGatewayRanking(currentCommand())
},true);
window.closeCommandAndOpenGateway=c=>window.__edduOpenGatewayRanking(c||currentCommand());
window.EDDU_MASTER_V52_REAL_CHECKOUT=true;
})();