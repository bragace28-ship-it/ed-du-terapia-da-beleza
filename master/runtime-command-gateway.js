/* MASTER V46 — V51 command-close -> gateway ranking bridge
   Additive only. Preserves immutable the approved Master UI.
*/
(function(){
  'use strict';

  const toast=m=>{try{if(typeof window.toast==='function')window.toast(m);else alert(m)}catch(_){}};
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const providers=[
    {id:'Asaas',label:'Asaas',detail:'PIX, cartão e cobrança integrada'},
    {id:'PagBank',label:'PagBank',detail:'Cartão e meios digitais'},
    {id:'Stripe',label:'Stripe',detail:'Cartão e checkout'}
  ];
  const rates={Asaas:{1:.0089,2:.0299,3:.0399,4:.0499,5:.0549,6:.0599,7:.0629,8:.0629,9:.0629,10:.0629,11:.0629,12:.0629},
    PagBank:{1:.0099,2:.0299,3:.0399,4:.0499,5:.0599,6:.0699,7:.0799,8:.0849,9:.0899,10:.0949,11:.0999,12:.1049},
    Stripe:{1:.0299,2:.0399,3:.0499,4:.0549,5:.0599,6:.0649,7:.0699,8:.0699,9:.0699,10:.0699,11:.0699,12:.0699}};

  function currentCommand(){
    try{
      const candidates=[
        window.state?.currentCommand,window.state?.selectedCommand,window.data?.currentCommand,
        window.currentCommand,window.selectedCommand
      ].filter(Boolean);
      if(candidates[0]) return candidates[0];
      for(const k of ['eddu_current_command_v46','eddu_current_command','eddu_command_draft']){
        const v=JSON.parse(localStorage.getItem(k)||'null'); if(v)return v;
      }
    }catch(_){}
    return null;
  }
  function amountOf(c){
    return Number(c?.total??c?.amount??c?.valor??c?.grandTotal??c?.finalTotal??0)||0;
  }
  function commandId(c){
    return c?.id||c?.commandId||c?.number||c?.codigo||'CMD-'+Date.now();
  }

  function open(route){
    if(typeof window.openSheet==='function') return window.openSheet(route);
    if(typeof window.__masterOpenSheet==='function') return window.__masterOpenSheet(route);
    return false;
  }

  window.__edduOpenGatewayRanking=function(command){
    const c=command||currentCommand()||{};
    const amount=amountOf(c);
    window.__edduPendingPayment={commandId:commandId(c),amount,command:c};
    window.views=window.views||{};
    window.views.gatewayRanking=function(){
      return '<h2>Ranking Gateway</h2>'+
        '<p class="sub">Escolha por qual gateway deseja cobrar esta comanda.</p>'+
        '<div class="card"><div class="row"><span>Comanda</span><b>'+esc(commandId(c))+'</b></div>'+
        '<div class="row"><span>Total</span><b>'+money(amount)+'</b></div></div>'+
        '<div class="card"><h3>Gateways disponíveis</h3>'+
        providers.map((p,i)=>'<button class="option gateway-choice" data-gateway="'+p.id+'" type="button" style="width:100%;text-align:left;margin:8px 0">'+
          '<span><b>'+(i+1)+'. '+p.label+'</b><small>'+p.detail+'</small></span><strong>›</strong></button>').join('')+
        '</div>'+
        '<button class="btn full" onclick="openSheet(\\'command\\')">← Voltar à comanda</button>';
    };
    open('gatewayRanking');
    setTimeout(function(){
      document.querySelectorAll('.gateway-choice').forEach(function(b){
        b.onclick=function(e){
          e.preventDefault();e.stopPropagation();
          window.__edduSelectGateway(this.dataset.gateway);
        };
      });
    },30);
    return true;
  };

  window.__edduSelectGateway=function(gateway){
    const p=window.__edduPendingPayment||{commandId:'',amount:0};
    window.__edduPendingPayment={...p,gateway};
    window.views=window.views||{};
    window.views.gatewayPayment=function(){
      const amount=Number(p.amount)||0;
      const provider=gateway;
      const r=rates[provider]||rates.Asaas;
      return '<h2>Cobrança · '+esc(provider)+'</h2>'+
        '<p class="sub">Defina a forma e as parcelas antes de confirmar a cobrança.</p>'+
        '<div class="card"><div class="row"><span>Comanda</span><b>'+esc(p.commandId)+'</b></div><div class="row"><span>Total</span><b>'+money(amount)+'</b></div></div>'+
        '<div class="card"><label>Forma de pagamento</label><select id="v51PayMethod">'+
        '<option value="credit_card">Cartão de crédito</option><option value="debit_card">Cartão de débito</option><option value="pix">PIX</option></select>'+
        '<label>Parcelas</label><select id="v51Installments">'+
        [1,2,3,4,5,6,7,8,9,10,11,12].map(n=>'<option value="'+n+'">'+n+'x</option>').join('')+
        '</select><div id="v51GatewayPreview" class="card"></div></div>'+
        '<button class="btn primary full" id="v51ConfirmPayment" type="button">✓ Confirmar cobrança</button>'+
        '<button class="btn full" type="button" onclick="openSheet(\\'gatewayRanking\\')">← Trocar gateway</button>';
    };
    open('gatewayPayment');
    setTimeout(function(){
      const calc=function(){
        const n=Number(document.getElementById('v51Installments')?.value||1);
        const fee=amount*(r[n]||0),net=amount-fee;
        const out=document.getElementById('v51GatewayPreview');
        if(out)out.innerHTML='<div class="row"><span>Taxa estimada</span><b>'+money(fee)+'</b></div><div class="row"><span>Líquido estimado</span><b>'+money(net)+'</b></div>';
      };
      document.getElementById('v51Installments')?.addEventListener('change',calc);
      calc();
      document.getElementById('v51ConfirmPayment')?.addEventListener('click',function(){
        const method=document.getElementById('v51PayMethod')?.value||'credit_card';
        const installments=Number(document.getElementById('v51Installments')?.value||1);
        const payment={id:'PAY-'+Date.now(),commandId:p.commandId,amount, gateway:provider,method,installments,status:'pending',createdAt:new Date().toISOString()};
        try{
          const key='eddu_master_gateway_payments_v51';
          const arr=JSON.parse(localStorage.getItem(key)||'[]');arr.unshift(payment);localStorage.setItem(key,JSON.stringify(arr));
          if(window.state){state.lastGatewayPayment=payment;if(typeof window.persist==='function')window.persist();}
        }catch(_){}
        window.__edduPendingPayment={...p,gateway:provider,payment};
        toast('✓ Cobrança preparada. Pagamento registrado para confirmação.');
        open('payments');
      });
    },40);
  };

  function isCloseCommandElement(el){
    if(!el)return false;
    const text=((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase().replace(/\\s+/g,' ');
    return /(fechar|finalizar|encerrar)\\s*(comanda|atendimento)|fechar\\s*comanda|finalizar\\s*comanda/.test(text);
  }

  document.addEventListener('click',function(e){
    const el=e.target?.closest?.('button,a,[role="button"],[onclick]');
    if(!isCloseCommandElement(el))return;
    if(el.closest('.gateway-choice')||el.id==='v51ConfirmPayment')return;
    e.preventDefault();e.stopImmediatePropagation();
    window.__edduOpenGatewayRanking(currentCommand());
  },true);

  /* If legacy handlers invoke close routines programmatically, expose an explicit safe entry point. */
  window.closeCommandAndOpenGateway=function(command){
    return window.__edduOpenGatewayRanking(command||currentCommand());
  };

  window.EDDU_MASTER_V51_GATEWAY_BRIDGE=true;
})();