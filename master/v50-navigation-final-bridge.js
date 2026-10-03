/* MASTER V46 — V50 navigation + agenda final bridge
   Additive only. The immutable V33 visual source is never changed.
*/
(function(){
  'use strict';

  const CLIENT_ROUTES=new Set([
    'booking','appointments','documents','payments','clientReferral','loyalty',
    'giftCard','receipt','termClient','clientAnamnesis','clientHistory',
    'gatewayRanking','cardDetails','tapOn'
  ]);

  function show(route){
    try{
      if(!route) return false;
      if(typeof window.views==='undefined' || typeof window.views[route]!=='function'){
        if(typeof window.toast==='function') window.toast('Esta tela ainda não está disponível: '+route);
        return false;
      }
      let shade=document.getElementById('shade');
      if(!shade && typeof window.openSheet==='function'){
        window.openSheet(route);
        return true;
      }
      if(shade){
        const view=document.getElementById('view');
        if(view) view.innerHTML=window.views[route]();
        document.body.classList.add('sheet-open');
        shade.classList.add('show');
        shade.style.display='flex';
        shade.style.visibility='visible';
        shade.style.opacity='1';
        shade.style.zIndex='100000';
        const sheet=shade.querySelector('.sheet');
        if(sheet){
          sheet.style.display='block';
          sheet.style.visibility='visible';
          sheet.style.opacity='1';
          sheet.style.zIndex='100001';
          sheet.scrollTop=0;
        }
        return true;
      }
      return false;
    }catch(e){
      try{window.toast('Não foi possível abrir a tela: '+e.message)}catch(_){}
      return false;
    }
  }

  /* Command checkout: the approved flow is COMANDA -> GATEWAY RANKING -> gateway choice.\n     Some legacy builds had no concrete gatewayRanking view, so the click guard\n     could intercept correctly but had nowhere to render. This bridge supplies\n     the missing functional route without touching the V33 visual baseline. */\n  const gatewayRankRates={\n    PagBank:{pix:0.0099,card:0.0299},\n    Asaas:{pix:0.0089,card:0.0299},\n    Stripe:{pix:0,card:0.0299}\n  };\n  function ensureGatewayRankingView(){\n    if(typeof window.views==='undefined') window.views={};\n    if(typeof window.views.gatewayRanking==='function') return;\n    window.views.gatewayRanking=function(){\n      let amount=Number(window.__EDDU_COMMAND_CHECKOUT_AMOUNT||0);\n      if(!(amount>0)){\n        const text=String(document.getElementById('view')?.innerText||'');\n        const m=text.match(/(?:total|valor)\\s*[:\\-]?\\s*R?\\$?\\s*([0-9.]+,[0-9]{2}|[0-9]+(?:\\.[0-9]+)?)/i);\n        if(m) amount=Number(String(m[1]).replace(/\\./g,'').replace(',','.'))||0;\n      }\n      const saved=(()=>{try{return JSON.parse(localStorage.getItem('eddu_v46_gateway_choice')||'{}')}catch(_){return {}}})();\n      if(!(amount>0)&&Number(saved.amount)>0) amount=Number(saved.amount);\n      window.__EDDU_COMMAND_CHECKOUT_AMOUNT=amount;\n      const rows=Object.keys(gatewayRankRates).map(function(provider){\n        const r=gatewayRankRates[provider], pix=r.pix, card=r.card;\n        const fee=amount>0?amount*card:0, net=amount>0?amount-fee:0;\n        return '<div class="card" data-gateway-provider="'+provider+'">'+\n          '<div class="row"><span><b>'+provider+'</b></span><b>'+((card*100).toFixed(2)).replace('.',',')+'% cartão</b></div>'+\n          '<div class="row"><span>PIX</span><b>'+((pix*100).toFixed(2)).replace('.',',')+'%</b></div>'+\n          (amount>0?'<div class="row"><span>Líquido estimado</span><b>'+net.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</b></div>':'')+\n          '<button class="btn primary full" type="button" data-select-gateway="'+provider+'">Selecionar '+provider+'</button>'+\n        '</div>';\n      }).join('');\n      return '<h2>Ranking de Gateway</h2><p class="sub">Escolha por qual gateway a cobrança desta comanda será realizada.</p>'+\n        (amount>0?'<div class="card"><div class="row"><span>Total da comanda</span><b>'+amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})+'</b></div></div>':'<div class="card"><p class="sub">Valor da comanda será usado na etapa de cobrança.</p></div>')+\n        rows+\n        '<button class="btn full" type="button" onclick="closeSheet()">Cancelar</button>';\n    };\n  }\n  window.__edduSelectGateway=function(provider){\n    const amount=Number(window.__EDDU_COMMAND_CHECKOUT_AMOUNT||0);\n    const rate=gatewayRankRates[provider]?.card||0;\n    try{localStorage.setItem('eddu_v46_gateway_choice',JSON.stringify({provider,installments:1,amount,rate,fee:amount*rate,net:amount-(amount*rate),source:'command-checkout',at:new Date().toISOString()}));}catch(_){}\n    window.__EDDU_SELECTED_GATEWAY=provider;\n    if(typeof window.toast==='function')window.toast('✓ Gateway selecionado: '+provider);\n    if(typeof window.views?.cardDetails==='function') show('cardDetails');\n  };\n  document.addEventListener('click',function(e){\n    const b=e.target&&e.target.closest?e.target.closest('[data-select-gateway]'):null;\n    if(!b)return;\n    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();\n    window.__edduSelectGateway(b.getAttribute('data-select-gateway')||'');\n  },true);\n  ensureGatewayRankingView();\n\n  /* Final client navigation bridge. It runs after the previous hardening layers. */
  window.__edduMasterOpenClient=function(route){ return show(route); };

  document.addEventListener('click',function(e){
    const el=e.target&&e.target.closest?e.target.closest('[onclick*="openSheet("]'):null;
    if(!el)return;
    const raw=el.getAttribute('onclick')||'';
    const m=raw.match(/openSheet\(\s*['"]([^'"]+)['"]\s*\)/);
    if(!m || !CLIENT_ROUTES.has(m[1]))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    show(m[1]);
  },true);

  /* Agenda: the first selector item explicitly means "new client". */
  const originalAgendaAdd=window.openAgendaAddM;
  window.openAgendaAddM=function(day){
    if(typeof originalAgendaAdd!=='function') return;
    originalAgendaAdd(day);
    setTimeout(function(){
      const s=document.getElementById('aptClientSelect');
      if(!s)return;
      if(!Array.from(s.options).some(o=>o.value==='__NEW__')){
        const first=s.options[0];
        if(first){
          first.value='__NEW__';
          first.textContent='＋ Adicionar novo cliente';
        }
      }
      s.onchange=function(){
        if(this.value==='__NEW__'){
          if(typeof window.openSheet==='function') window.openSheet('newClient');
          return;
        }
        const hidden=document.getElementById('aptClient');
        if(hidden) hidden.value=this.value;
      };
    },0);
  };

  window.EDDU_MASTER_V50_NAVIGATION=true;
})();