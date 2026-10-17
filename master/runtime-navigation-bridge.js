/* MASTER V46 — V50 navigation + agenda final bridge
   Additive only. The immutable approved Master UI is never changed.
*/
(function(){
  'use strict';

  const CLIENT_ROUTES=new Set([
    'agenda','booking','appointments','documents','payments','clientReferral','loyalty',
    'giftCard','receipt','termClient','clientAnamnesis','clientHistory',
    'gatewayRanking','cardDetails','tapOn','newClient'
  ]);

  function notify(message){
    try{ if(typeof window.toast==='function') window.toast(message); }catch(_){}
  }
  function show(route){
    try{
      if(typeof route!=='string'||!route.trim()){
        notify('Não foi possível abrir esta tela: rota inválida. Tente novamente.');
        return false;
      }
      route=route.trim();
      const renderer=window.views&&window.views[route];
      if(typeof renderer!=='function'){
        notify('Esta tela ainda não está disponível: '+route);
        return false;
      }
      let shade=document.getElementById('shade');
      if(!shade && typeof window.openSheet==='function'){
        window.openSheet(route);
        return true;
      }
      if(shade){
        const view=document.getElementById('view');
        if(view) view.innerHTML=renderer();
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
      notify('Não foi possível abrir esta tela. '+String(e&&e.message||'Erro interno'));
      return false;
    }
  }
  window.__edduMasterOpenClient=function(route){ return show(route); };

  function inferRoute(el){
    const raw=(el.getAttribute('onclick')||'');
    const match=raw.match(/openSheet\(\s*['"]([^'"]+)['"]\s*\)/);
    if(match && match[1] && match[1]!=='undefined' && match[1]!=='null') return match[1];
    const text=((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
    if(/agenda|calendario|horario/.test(text)) return 'agenda';
    if(/agendar|novo atendimento|marcar atendimento/.test(text)) return 'booking';
    if(/agendamento|atendimento/.test(text)) return 'appointments';
    if(/cliente/.test(text)) return 'clientHistory';
    if(/pagamento|cobranca|fatura/.test(text)) return 'payments';
    if(/documento|termo/.test(text)) return 'documents';
    if(/gateway/.test(text)) return 'gatewayRanking';
    if(/comanda/.test(text)) return 'command';
    return null;
  }

  /* Catch malformed navigation calls (including openSheet(undefined)) before they create an empty sheet. */
  document.addEventListener('click',function(e){
    const el=e.target&&e.target.closest?e.target.closest('[onclick*="openSheet("]'):null;
    if(!el)return;
    const raw=el.getAttribute('onclick')||'';
    const match=raw.match(/openSheet\(\s*['"]([^'"]+)['"]\s*\)/);
    if(match && CLIENT_ROUTES.has(match[1])) {
      e.preventDefault(); e.stopImmediatePropagation(); show(match[1]); return;
    }
    if(/openSheet\(\s*(?:undefined|null)?\s*\)/.test(raw) || !match || !match[1] || match[1]==='undefined' || match[1]==='null'){
      const route=inferRoute(el);
      e.preventDefault(); e.stopImmediatePropagation();
      if(route) show(route);
      else notify('Este botão está sem destino configurado. A ação foi interrompida para evitar uma tela vazia.');
    }
  },true);

  /* Agenda: the first selector item explicitly means "new client". */
  const originalAgendaAdd=window.openAgendaAddM;
  window.openAgendaAddM=function(day){
    if(typeof originalAgendaAdd!=='function'){notify('Função de agendamento indisponível.');return false;}
    originalAgendaAdd(day);
    setTimeout(function(){
      const s=document.getElementById('aptClientSelect');
      if(!s)return;
      if(!Array.from(s.options).some(o=>o.value==='__NEW__')){
        const first=s.options[0];
        if(first){first.value='__NEW__';first.textContent='＋ Adicionar novo cliente';}
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

  window.EDDU_MASTER_V51_NAVIGATION=true;
})();