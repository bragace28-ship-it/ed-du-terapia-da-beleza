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

  /* Final client navigation bridge. It runs after the previous hardening layers. */
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