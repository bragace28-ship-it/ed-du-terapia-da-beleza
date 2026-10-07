/* MASTER navigation hardening — canonical runtime only.
   Functional bridge for the approved Master artifact. No legacy UI/source dependency.
*/
(function(){
  'use strict';
  const CLIENT_ROUTES=new Set(['agenda','booking','appointments','documents','payments','clientReferral','loyalty','giftCard','receipt','termClient','clientAnamnesis','clientHistory','command','gatewayRanking','cardDetails','tapOn']);
  const FINANCE_ROUTES=new Set(['finance','financialReports33','dre33','reconciliation33','payables','receivables','newPayable33','ocrConfirm33','recurringPayable33','cardInvoice33','newReceivable33','commissionsFinance','openFinance','gatewaySettings','cardInvoices']);

  function getView(route){
    try{
      if(typeof window.views==='object' && typeof window.views[route]==='function') return window.views[route];
      if(typeof views!=='undefined' && views && typeof views[route]==='function') return views[route];
    }catch(_){}
    return null;
  }

  function ensureSheet(){
    let shade=document.getElementById('shade');
    if(!shade){
      shade=document.createElement('div');
      shade.id='shade';
      shade.innerHTML='<section class="sheet"><div class="handle"></div><button class="close" type="button" aria-label="Fechar">×</button><div id="view"></div></section>';
      document.body.appendChild(shade);
    }
    let sheet=shade.querySelector('.sheet'),view=document.getElementById('view');
    if(!sheet){
      sheet=document.createElement('section');
      sheet.className='sheet';
      shade.appendChild(sheet);
    }
    if(!view){
      view=document.createElement('div');
      view.id='view';
      sheet.appendChild(view);
    }
    const close=shade.querySelector('.close');
    if(close)close.onclick=e=>{e.preventDefault();e.stopPropagation();window.closeSheet()};
    shade.onclick=e=>{if(e.target===shade)window.closeSheet()};
    return{shade,sheet,view};
  }

  window.__edduSafeOpen=function(route){
    try{
      if(!route)return false;
      if(FINANCE_ROUTES.has(route)&&!CLIENT_ROUTES.has(route)&&typeof window.openSheet==='function'){
        window.openSheet(route);
        return true;
      }
      const ui=ensureSheet();
      const renderer=getView(route);
      if(typeof renderer==='function'){
        ui.view.innerHTML=renderer();
      }else if(typeof window.openSheet==='function'){
        window.openSheet(route);
        return true;
      }else{
        ui.view.innerHTML='<h2>Área indisponível</h2><p class="sub">Esta tela ainda não foi registrada.</p>';
      }
      document.body.classList.add('sheet-open');
      ui.shade.classList.add('show');
      ui.shade.style.display='flex';
      ui.shade.style.visibility='visible';
      ui.shade.style.opacity='1';
      ui.shade.style.zIndex='100000';
      ui.sheet.style.display='block';
      ui.sheet.style.visibility='visible';
      ui.sheet.style.opacity='1';
      ui.sheet.style.position='relative';
      ui.sheet.style.zIndex='100001';
      ui.sheet.style.pointerEvents='auto';
      ui.sheet.scrollTop=0;
      return true;
    }catch(e){
      try{window.toast('Não foi possível abrir esta tela: '+e.message)}catch(_){}
      return false;
    }
  };

  document.addEventListener('click',e=>{
    const el=e.target?.closest?.('[onclick*="openSheet("]');
    if(!el)return;
    const raw=el.getAttribute('onclick')||'';
    const m=raw.match(/openSheet\(\s*['"]([^'"]+)['"]\s*\)/);
    if(!m||!CLIENT_ROUTES.has(m[1]))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.__edduSafeOpen(m[1]);
  },true);

  document.addEventListener('click',e=>{
    const el=e.target?.closest?.('.shortcut-v11,.book-v11,.appt-v11');
    if(!el)return;
    const t=(el.innerText||'').toLowerCase();
    const r=t.includes('agenda')?'agenda':t.includes('document')?'documents':t.includes('pagamento')?'payments':t.includes('agendamento')?'appointments':t.includes('agendar')?'booking':null;
    if(!r)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.__edduSafeOpen(r);
  },true);

  const style=document.createElement('style');
  style.id='master-navigation-hardening-style';
  style.textContent='#shade.show{display:flex!important;visibility:visible!important;opacity:1!important;z-index:100000!important}#shade.show>.sheet{display:block!important;visibility:visible!important;opacity:1!important;z-index:100001!important;position:relative!important;pointer-events:auto!important}.sheet-open #client{pointer-events:none}.sheet-open #shade,.sheet-open #shade *{pointer-events:auto!important}';
  document.head.appendChild(style);
})();
