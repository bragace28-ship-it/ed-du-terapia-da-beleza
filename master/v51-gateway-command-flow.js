/* MASTER V46 — gateway/comanda flow correction
   Additive only. V33 visual baseline remains immutable.

   Approved operational flow:
   comanda -> forma de pagamento -> cartão/PIX details -> Smart Gateway
   -> pagamento -> conciliação.

   Important:
   - "Fechar comanda" never marks a command paid/closed.
   - It opens the payment flow.
   - Gateway selection happens before the payment approval screen.
   - Financial reconciliation is reached only after payment approval.
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

  function activeCommand(){
    const s=stateOf();
    if(!s.activeCommandId || !Array.isArray(s.commands)) return null;
    return s.commands.find(c=>c.id===s.activeCommandId)||null;
  }

  function syncLegacyFromActive(){
    const s=stateOf(),c=activeCommand();
    if(!c) return null;
    s.command=s.command||{};
    Object.assign(s.command,{
      client:c.client||'',
      service:c.service||'',
      amount:Number(c.netAmount??c.amount??c.grossAmount??0),
      grossAmount:Number(c.grossAmount??c.amount??0),
      netAmount:Number(c.netAmount??c.amount??c.grossAmount??0),
      method:c.method||'',
      brand:c.brand||'',
      installments:Number(c.installments||1),
      gateway:c.gateway||'',
      closed:false
    });
    return c;
  }

  function syncActiveFromLegacy(){
    const s=stateOf(),c=activeCommand();
    if(!c)return null;
    const legacy=s.command||{};
    c.method=legacy.method||c.method||'';
    c.brand=legacy.brand||c.brand||'';
    c.installments=Number(legacy.installments||c.installments||1);
    c.gateway=legacy.gateway||c.gateway||'';
    c.gatewayRate=legacy.gatewayRate??c.gatewayRate;
    c.gatewayFee=legacy.gatewayFee??c.gatewayFee;
    c.status='Aguardando pagamento';
    c.paymentStatus='PENDING';
    c.paymentFlow='gateway';
    c.isDraft=false;
    return c;
  }

  function amountOf(c){
    return Number(c?.netAmount??c?.amount??c?.grossAmount??0);
  }

  function openPaymentMethod(){
    const s=stateOf(),c=syncLegacyFromActive();
    if(!c || !(amountOf(c)>0)){
      toastF('Comanda sem valor válido para pagamento.');
      return;
    }
    s.command.status='Aguardando pagamento';
    s.command.paymentStatus='PENDING';
    s.command.paymentFlow='gateway';
    persistState();
    if(typeof window.openSheet==='function')window.openSheet('commandPaymentMethodV51');
  }

  function choosePayment(method){
    const s=stateOf(),c=syncLegacyFromActive();
    if(!c)return;
    s.command.method=method;
    c.method=method;
    if(method==='Cartão'){
      s.command.installments=Number(c.installments||1);
      syncActiveFromLegacy();
      persistState();
      if(typeof window.openSheet==='function')window.openSheet('cardDetails');
      return;
    }
    if(method==='Pix'){
      s.command.brand='Pix';
      s.command.installments=1;
      c.brand='Pix';
      c.installments=1;
      syncActiveFromLegacy();
      persistState();
      if(typeof window.openSheet==='function')window.openSheet('gatewayRanking');
      return;
    }
    if(method==='Tap On'){
      c.method='Tap On';
      s.command.method='Tap On';
      syncActiveFromLegacy();
      persistState();
      if(typeof window.openSheet==='function')window.openSheet('tapOn');
      return;
    }
    syncActiveFromLegacy();
    persistState();
    if(typeof window.openSheet==='function')window.openSheet('commandPaymentV32');
  }

  window.v51OpenGateway=function(){
    const s=stateOf(),c=syncLegacyFromActive()||s.command||{};
    if(!c.method){
      openPaymentMethod();
      return;
    }
    if(c.method==='Cartão' && !Number(c.installments))c.installments=1;
    if((c.method==='Cartão'||c.method==='Pix')&&!c.gateway){
      if(c.method==='Pix'){
        c.brand='Pix';c.installments=1;
      }
      persistState();
      openSheet('gatewayRanking');
      return;
    }
    window.v51PrepareCommandPayment();
  };

  window.v51PrepareCommandPayment=function(){
    const s=stateOf(),c=syncLegacyFromActive()||s.command||{};
    if(!c.client || !(amountOf(c)>0)){
      toastF('Comanda sem cliente ou valor válido.');
      return;
    }
    c.status='Aguardando pagamento';
    c.paymentStatus='PENDING';
    c.paymentFlow='gateway';
    persistState();
    if(typeof window.openSheet==='function')window.openSheet('commandPaymentV32');
  };

  window.finalizeCommand=function(){
    const s=stateOf(),c=syncLegacyFromActive()||s.command||{};
    if(typeof window.commandTotals==='function')window.commandTotals();
    if(!c.method){
      openPaymentMethod();
      return;
    }
    if((c.method==='Cartão'||c.method==='Pix')&&!c.gateway){
      window.v51OpenGateway();
      return;
    }
    window.v51PrepareCommandPayment();
  };

  // Both command implementations (V31 and V32) use these handlers in the
  // approved UI. Closing is therefore intercepted at the single functional
  // boundary instead of editing the immutable V33 markup.
  function interceptCloseCommand(){
    const c=syncLegacyFromActive();
    if(!c)return;
    if(typeof window.commandTotals==='function')window.commandTotals();
    if(!(amountOf(c)>0)){
      toastF('Adicione pelo menos um serviço com valor antes de fechar a comanda.');
      return;
    }
    openPaymentMethod();
  }

  window.closeCommandV31=interceptCloseCommand;
  window.closeCommandV32=interceptCloseCommand;

  window.choosePay=function(method){
    choosePayment(method);
  };

  window.v51ChoosePayment=choosePayment;

  window.selectGateway=function(g){
    const s=stateOf(),c=syncLegacyFromActive();
    if(!c)return;
    if(!providers.includes(g)){
      toastF('Gateway indisponível.');
      return;
    }
    const n=Math.max(1,Number(c.installments||1));
    const amount=amountOf(c);
    s.command.gateway=g;
    s.command.gatewaySelectedAt=new Date().toISOString();
    s.command.gatewayRate=rates[g][n]??rates[g][1];
    s.command.gatewayFee=amount*s.command.gatewayRate;
    c.gateway=g;
    c.gatewayRate=s.command.gatewayRate;
    c.gatewayFee=s.command.gatewayFee;
    c.gatewaySelectedAt=s.command.gatewaySelectedAt;
    c.status='Aguardando pagamento';
    c.paymentStatus='PENDING';
    c.paymentFlow='gateway';
    persistState();
    toastF('Gateway selecionado: '+g);
    setTimeout(()=>window.openSheet('commandPaymentV32'),120);
  };

  window.views=window.views||{};

  window.views.commandPaymentMethodV51=function(){
    const s=stateOf(),c=syncLegacyFromActive();
    if(!c)return '<h2>Comanda não encontrada</h2>';
    const amount=amountOf(c);
    return '<h2>Forma de pagamento</h2>'+
      '<p class="sub">Escolha como o cliente vai pagar. Para Pix e Cartão, o próximo passo é a análise do Smart Gateway.</p>'+
      '<div class="card"><div class="row"><span>Cliente</span><b>'+esc(c.client)+'</b></div>'+
      '<div class="row"><span>Total a pagar</span><b class="money-good">'+money(amount)+'</b></div></div>'+
      '<div class="grid2">'+
      '<button class="btn" type="button" onclick="v51ChoosePayment(\'Pix\')">Pix</button>'+
      '<button class="btn" type="button" onclick="v51ChoosePayment(\'Cartão\')">Cartão</button>'+
      '<button class="btn" type="button" onclick="v51ChoosePayment(\'Tap On\')">Tap On</button>'+
      '<button class="btn" type="button" onclick="v51ChoosePayment(\'Outro\')">Outro</button>'+
      '</div>'+
      '<button class="btn full" type="button" onclick="openSheet(\'commandEdit\')">← Voltar à comanda</button>';
  };

  window.views.gatewayRanking=function(){
    const s=stateOf(),c=syncLegacyFromActive()||s.command||{};
    const amount=amountOf(c);
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
      '<button class="btn full" type="button" onclick="openSheet(\'commandPaymentMethodV51\')">← Forma de pagamento</button>';
  };

  // The existing V31/V32 approval handlers are kept as the homologation payment
  // boundary. They are reached only after gateway selection.
  const oldApproveV31=window.approvePaymentV31;
  const oldApproveV32=window.approvePaymentV32;
  window.approvePaymentV31=function(){
    const c=syncActiveFromLegacy();
    if(c){c.gateway=c.gateway||stateOf().command?.gateway||'';c.status='Aguardando pagamento';}
    if(typeof oldApproveV31==='function')return oldApproveV31.apply(this,arguments);
    if(c){
      c.status='Pago';c.paymentStatus='PAID';c.closed=true;c.paidAt=new Date().toISOString();
      persistState();openSheet('financialReconciliation');
    }
  };
  window.approvePaymentV32=function(){
    const c=syncActiveFromLegacy();
    if(c){c.gateway=c.gateway||stateOf().command?.gateway||'';c.status='Aguardando pagamento';}
    if(typeof oldApproveV32==='function')return oldApproveV32.apply(this,arguments);
    if(c){
      c.status='Pago';c.paymentStatus='PAID';c.closed=true;c.paidAt=new Date().toISOString();
      persistState();openSheet('financialReconciliation');
    }
  };
  /* V51.1 — final checkout boundary.
     The approved interaction is:
     Fechar comanda -> Smart Gateway ranking -> select gateway -> payment.
     This boundary intentionally bypasses the financial report and payment-method
     screen until the gateway has been selected. */
  function openGatewayRankingDirect(){
    const s=stateOf();
    const c=syncLegacyFromActive()||s.command||null;
    if(!c){
      toastF('Nenhuma comanda ativa para fechamento.');
      return false;
    }
    if(typeof window.commandTotals==='function'){
      try{window.commandTotals()}catch(_){}
    }
    const fresh=syncLegacyFromActive()||c;
    if(!(amountOf(fresh)>0)){
      toastF('Adicione pelo menos um serviço com valor antes de fechar a comanda.');
      return false;
    }
    s.command=s.command||{};
    s.command.status='Aguardando pagamento';
    s.command.paymentStatus='PENDING';
    s.command.paymentFlow='gateway';
    persistState();
    if(typeof window.openSheet==='function'){
      window.openSheet('gatewayRanking');
      return true;
    }
    return false;
  }

  window.v51CloseCommandToGateway=openGatewayRankingDirect;
  window.closeCommandV31=openGatewayRankingDirect;
  window.closeCommandV32=openGatewayRankingDirect;
  window.closeCommand=openGatewayRankingDirect;
  window.finishCommand=openGatewayRankingDirect;
  window.finalizeCommand=openGatewayRankingDirect;
  window.fecharComanda=openGatewayRankingDirect;
  window.finalizarComanda=openGatewayRankingDirect;

  /* Ensure the route exists even if a later legacy layer replaced views. */
  if(!window.views.gatewayRanking){
    window.views.gatewayRanking=window.views.gatewayRankingV46||function(){
      return '<h2>Smart Gateway</h2><p class="sub">Selecione o gateway para continuar a cobrança.</p>';
    };
  }

  /* Capture every known close-command control before legacy onclick handlers.
     Text, id, data-action and inline handler are all accepted because the V33
     baseline contains more than one command implementation. */
  document.addEventListener('click',function(e){
    const el=e.target&&e.target.closest?e.target.closest('button,a,[role="button"],[onclick],[data-action],div'):null;
    if(!el)return;
    const raw=String(el.getAttribute&&el.getAttribute('onclick')||'').toLowerCase();
    const id=String(el.id||'').toLowerCase();
    const action=String(el.getAttribute&&el.getAttribute('data-action')||'').toLowerCase();
    const txt=String(el.textContent||'').replace(/\\s+/g,' ').trim().toLowerCase();
    const hook=/(closecommand|finishcommand|finalizecommand|fecharcomanda|finalizarcomanda)\\s*\\(/.test(raw) ||
      /(closecommand|finishcommand|finalizecommand|fecharcomanda|finalizarcomanda)/.test(id+' '+action);
    const label=((txt.includes('fechar')||txt.includes('finalizar'))&&txt.includes('comanda'));
    if(!hook&&!label)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openGatewayRankingDirect();
  },true);

})();