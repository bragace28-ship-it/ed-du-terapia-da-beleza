/* MASTER V46 — gateway/comanda flow correction
   Additive only. V33 visual baseline remains immutable.
   Flow: comanda -> forma de pagamento -> cartão/PIX details -> Smart Gateway -> pagamento -> conciliação.
   Closing a command must never route directly to the financial report.
*/
(function(){
  'use strict';
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const toastF=m=>{try{if(typeof window.toast==='function')window.toast(m);else alert(m)}catch(_){}};
  const stateOf=()=>window.state||{};
  const persistState=()=>{try{if(typeof window.persist==='function')window.persist();}catch(_){}};

  const rates={
    PagBank:{1:.0099,2:.0299,3:.0399,4:.0499,5:.0599,6:.0699,7:.0799,8:.0849,9:.0899,10:.0949,11:.0999,12:.1049,18:.1249,24:.1449},
    Asaas:{1:.0089,2:.0299,3:.0399,4:.0499,5:.0549,6:.0599,7:.0629,8:.0629,9:.0629,10:.0629,11:.0629,12:.0629,18:.0799,24:.0989},
    Stripe:{1:.0299,2:.0399,3:.0499,4:.0549,5:.0599,6:.0649,7:.0699,8:.0699,9:.0699,10:.0699,11:.0699,12:.0699,18:.0899,24:.1099}
  };
  const providers=Object.keys(rates);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  window.__EDDU_GATEWAY_FLOW_V51=true;

  window.v51OpenGateway=function(){
    const s=stateOf(),c=s.command||{};
    if(!c.method){
      toastF('Selecione a forma de pagamento antes de fechar a comanda.');
      return;
    }
    if(c.method==='Cartão' && !c.installments)c.installments=1;
    if((c.method==='Cartão'||c.method==='Pix') && !c.gateway){
      openSheet('gatewayRanking');
      return;
    }
    window.v51PrepareCommandPayment();
  };

  window.v51PrepareCommandPayment=function(){
    const s=stateOf(),c=s.command||{};
    if(!c.client||!(Number(c.netAmount??c.amount??c.grossAmount)>0)){
      toastF('Comanda sem cliente ou valor válido.');
      return;
    }
    c.status='Aguardando pagamento';
    c.paymentStatus='PENDING';
    c.paymentFlow='gateway';
    c.gateway=c.gateway||null;
    persistState();
    if(typeof window.openSheet==='function')window.openSheet('commandPaymentV32');
  };

  window.finalizeCommand=function(){
    const s=stateOf();
    s.command=s.command||{};
    if(typeof window.commandTotals==='function')window.commandTotals();
    if(!s.command.method){
      toastF('Selecione Pix, Cartão, Tap On ou Outro para continuar.');
      return;
    }
    if((s.command.method==='Cartão'||s.command.method==='Pix')&&!s.command.gateway){
      window.v51OpenGateway();
      return;
    }
    window.v51PrepareCommandPayment();
  };

  window.selectGateway=function(g){
    const s=stateOf();s.command=s.command||{};
    if(!providers.includes(g)){
      toastF('Gateway indisponível.');
      return;
    }
    s.command.gateway=g;
    s.command.gatewaySelectedAt=new Date().toISOString();
    s.command.gatewayRate=rates[g][Number(s.command.installments||1)]??rates[g][1];
    s.command.gatewayFee=Number(s.command.netAmount||s.command.amount||s.command.grossAmount||0)*s.command.gatewayRate;
    persistState();
    toastF('Gateway selecionado: '+g);
    setTimeout(()=>window.openSheet('command'),120);
  };

  window.views=window.views||{};
  window.views.gatewayRanking=function(){
    const s=stateOf(),c=s.command||{};
    const amount=Number(c.netAmount||c.amount||c.grossAmount||0);
    const n=Math.max(1,Number(c.installments||1));
    const method=c.method||'—';
    return '<h2>Smart Gateway — análise</h2>'+
      '<p class="sub">Forma: <b>'+esc(method)+'</b> · Parcelas: <b>'+n+'x</b> · Valor: <b>'+money(amount)+'</b></p>'+
      providers.map(g=>{
        const rate=rates[g][n]??rates[g][1],fee=amount*rate,net=amount-fee;
        return '<button class="option" type="button" onclick="selectGateway('+JSON.stringify(g)+')">'+
          '<span><b>'+esc(g)+'</b><small>Taxa '+(rate*100).toFixed(2).replace('.',',')+'% · líquido estimado</small></span>'+
          '<b>'+money(net)+'</b></button>';
      }).join('')+
      '<button class="btn full" type="button" onclick="openSheet(\'command\')">← Voltar à comanda</button>';
  };

  // The payment approval remains the homologation boundary: only after approval is the
  // command marked paid/closed and the flow goes to reconciliation.
  const oldApprove=window.approvePaymentV32;
  window.approvePaymentV32=function(){
    if(typeof oldApprove==='function')return oldApprove.apply(this,arguments);
    const s=stateOf(),c=s.command||{};
    c.status='Pago';c.paymentStatus='PAID';c.closed=true;c.paidAt=new Date().toISOString();persistState();
    if(typeof window.openSheet==='function')window.openSheet('reconciliation33');
  };
})();