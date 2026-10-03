/* MASTER V46 — unified gateway ranking/checkout bridge
   Functional-only layer. V33 visual baseline remains immutable.
*/
(function(){
'use strict';
const toast=m=>{try{if(typeof window.toast==='function')window.toast(m);else alert(m)}catch(_){}};
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gateways=['PagBank','Asaas','Stripe','PicPay','Nubank'];
function currentCommand(){try{const c=[window.state?.currentCommand,window.state?.selectedCommand,window.data?.currentCommand,window.currentCommand,window.selectedCommand].find(Boolean);if(c)return c;for(const k of ['eddu_current_command_v46','eddu_current_command','eddu_command_draft']){const v=JSON.parse(localStorage.getItem(k)||'null');if(v)return v}}catch(_){}return null}
function amountOf(c){return Number(c?.net_amount??c?.netAmount??c?.total??c?.amount??c?.valor??c?.grandTotal??c?.finalTotal??0)||0}
function commandId(c){return c?.id||c?.commandId||c?.number||c?.codigo||'CMD-'+Date.now()}
function clientOf(c){const x=c?.client||c?.customer||c?.cliente||{};return typeof x==='string'?{name:x}:{id:x?.id||c?.client_id||c?.clientId,name:x?.name||x?.nome||c?.clientName||c?.client_name,email:x?.email||c?.clientEmail||c?.client_email,phone:x?.phone||x?.telefone||c?.clientPhone||c?.client_phone,document:x?.cpf||x?.document||c?.clientCpf||c?.cpf}}
function open(route){return typeof window.openSheet==='function'?window.openSheet(route):typeof window.__masterOpenSheet==='function'?window.__masterOpenSheet(route):false}
function persist(p){try{localStorage.setItem('eddu_gateway_checkout_pending',JSON.stringify(p))}catch(_){}}
function providerLabel(g){return g==='Nubank'?'Nubank / NuPay':g}
window.__edduOpenGatewayRanking=async function(command){
 const c=command||currentCommand()||{},p={commandId:commandId(c),amount:amountOf(c),command:c,client:clientOf(c)};window.__edduPendingPayment=p;
 window.views=window.views||{};
 window.views.gatewayRanking=function(){return '<h2>Ranking Gateway</h2><p class="sub">O sistema consulta os gateways conectados e compara as condições disponíveis.</p><div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Cliente</span><b>'+esc(p.client.name||'Cliente')+'</b></div><div class="row"><span>Total</span><b>'+money(p.amount)+'</b></div></div><div class="card"><h3>Forma de pagamento</h3><select id="v52Method"><option value="pix">PIX</option><option value="card">Cartão de crédito</option><option value="pdv">PDV presencial</option></select><div id="v52RankBox" style="margin-top:12px">Consultando gateways…</div></div><button class="btn full" type="button" onclick="openSheet('command')">← Voltar à comanda</button>'};
 open('gatewayRanking');
 setTimeout(async()=>{
  const methodEl=document.getElementById('v52Method'),box=document.getElementById('v52RankBox');
  const render=async()=>{const method=methodEl?.value||'pix';if(method==='pdv'){box.innerHTML='<div class="option"><span><b>PDV presencial</b><small>Registrar pagamento feito na máquina/PDV.</small></span><strong>›</strong></div><button class="btn primary full" id="v52Pdv" type="button">Registrar pagamento no PDV</button>';document.getElementById('v52Pdv')?.addEventListener('click',()=>window.__edduSelectGateway('PDV'));return}
   try{const u='/api/payments?mode=rank&amount='+encodeURIComponent(p.amount)+'&method='+method+'&installments=1';const r=await fetch(u);const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Falha ao consultar ranking');const rows=d.ranking||[];box.innerHTML=rows.length?rows.map(x=>'<button class="option gateway-choice" data-gateway="'+esc(x.gateway)+'" style="width:100%;text-align:left;margin:7px 0" type="button"><span><b>'+esc(x.position)+'. '+esc(providerLabel(x.gateway))+'</b><small>'+(x.fee_known?('Líquido estimado: '+money(x.net_amount)+' · taxa '+Number(x.fee_percent).toFixed(2)+'%'):'Conectado · taxa a confirmar')+'</small></span><strong>›</strong></button>').join(''):'<p>Nenhum gateway com credencial disponível no ambiente.</p>';
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
 window.views.gatewayPayment=function(){return '<h2>Checkout · '+esc(providerLabel(gateway))+'</h2><p class="sub">A cobrança será criada no provedor selecionado. A comanda permanece aguardando confirmação.</p><div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Gateway</span><b>'+esc(providerLabel(gateway))+'</b></div><div class="row"><span>Total</span><b>'+money(p.amount)+'</b></div></div><div class="card"><label>Forma de pagamento</label><select id="v52PayMethod">'+(gateway==='PicPay'?'<option value="pix">PIX</option><option value="wallet">Carteira PicPay</option><option value="card">Cartão</option>':'<option value="'+esc(p.method==='card'?'card':'pix')+'">'+(p.method==='card'?'Cartão de crédito':'PIX')+'</option>')+'</select><label>Parcelas</label><select id="v52Installments">'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'x</option>').join('')+'</select><div id="v52CheckoutInfo" class="card" style="margin-top:10px"></div></div><button class="btn primary full" id="v52Checkout" type="button">✓ Gerar cobrança</button><button class="btn full" type="button" onclick="openSheet('gatewayRanking')">← Trocar gateway</button>'};
 open('gatewayPayment');
 setTimeout(()=>{
  const methodEl=document.getElementById('v52PayMethod'),inst=document.getElementById('v52Installments'),info=document.getElementById('v52CheckoutInfo');
  const sync=()=>{const card=methodEl?.value==='card';if(inst)inst.disabled=!card;if(!card&&inst)inst.value='1';if(info)info.innerHTML=card?'<div class="row"><span>Parcelamento</span><b>'+inst?.value+'x</b></div>':'<div class="row"><span>Valor</span><b>'+money(p.amount)+'</b></div>'};methodEl?.addEventListener('change',sync);inst?.addEventListener('change',sync);sync();
  document.getElementById('v52Checkout')?.addEventListener('click',async()=>{
   const b=document.getElementById('v52Checkout');b.disabled=true;b.textContent='Gerando cobrança…';
   try{
    const m=methodEl?.value||p.method||'pix',n=m==='card'?Number(inst?.value||1):1;
    const body={commandId:p.commandId,clientId:p.client?.id||null,amount:p.amount,gateway,method:m,installments:n,customerName:p.client?.name||'Cliente ED & DU',customerEmail:p.client?.email||'',customerPhone:p.client?.phone||'',customerDocument:p.client?.document||'',description:'Comanda '+p.commandId};
    const idem='EDDU-'+p.commandId+'-'+gateway+'-'+m+'-'+n;const r=await fetch('/api/payments',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':idem},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'Não foi possível gerar a cobrança.');
    const record={...p,method:m,installments:n,payment:d.payment,checkoutUrl:d.checkoutUrl||null,qrCode:d.qrCode||null,status:'CHECKOUT_PENDING',createdAt:new Date().toISOString()};persist(record);window.__edduPendingPayment=record;
    if(d.checkoutUrl){window.open(d.checkoutUrl,'_blank','noopener,noreferrer');toast('✓ Checkout '+providerLabel(gateway)+' aberto. A comanda só será quitada após a confirmação do gateway.');}
    else if(d.qrCode){info.innerHTML='<p><b>QR/PIX '+esc(providerLabel(gateway))+' gerado.</b></p><textarea readonly style="width:100%;min-height:90px">'+esc(d.qrCode)+'</textarea><p>Não marque a comanda como paga. A baixa ocorrerá após a confirmação do gateway.</p>';toast('✓ Cobrança '+providerLabel(gateway)+' criada.');return;}
    else {toast('✓ Cobrança criada; aguardando confirmação do gateway.');open('payments');}
   }catch(e){toast('Não foi possível gerar a cobrança: '+e.message);b.disabled=false;b.textContent='✓ Gerar cobrança'}
  },{once:true});
 },40);
};
function isClose(el){if(!el)return false;const t=((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase().replace(/\s+/g,' ');return /(fechar|finalizar|encerrar)\s*(comanda|atendimento)|fechar\s*comanda|finalizar\s*comanda/.test(t)}
document.addEventListener('click',e=>{const el=e.target?.closest?.('button,a,[role="button"],[onclick]');if(!isClose(el)||el.closest('.gateway-choice')||el.id==='v52Checkout')return;e.preventDefault();e.stopImmediatePropagation();window.__edduOpenGatewayRanking(currentCommand())},true);
window.closeCommandAndOpenGateway=c=>window.__edduOpenGatewayRanking(c||currentCommand());
setTimeout(async()=>{try{const u=new URL(location.href);if(u.searchParams.get('payment')!=='nupay_return')return;const sessionId=u.searchParams.get('sessionId');const commandId=u.searchParams.get('command');if(!sessionId)return;const r=await fetch('/api/payments?mode=nupay-status&sessionId='+encodeURIComponent(sessionId)+'&commandId='+encodeURIComponent(commandId||''));const d=await r.json().catch(()=>({}));if(d.status==='PAID'){toast('✓ NuPay confirmou o pagamento.');open('payments')}else if(d.status==='canceled'||d.status==='expired'){toast('NuPay encerrou a sessão sem pagamento.')}else if(d.status==='pending'||d.status==='approved'){toast('NuPay ainda está aguardando a conclusão do pagamento.')}}catch(e){console.warn('NuPay return handling',e)}},250);
window.EDDU_MASTER_V53_UNIFIED_GATEWAYS=true;
})();
/* E2E trigger branch 2026-10-03 */

/* E2E sync trigger 2026-10-03 13:15 UTC */
