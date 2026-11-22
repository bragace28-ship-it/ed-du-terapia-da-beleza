/* Master gateway entry point. The unified checkout module is loaded immediately after this adapter. */
(function(){
 'use strict';
 function currentCommand(){
  try{
   const c=[window.state?.currentCommand,window.state?.selectedCommand,window.data?.currentCommand,window.currentCommand,window.selectedCommand].find(Boolean);
   if(c)return c;
   for(const k of ['eddu_current_command_v46','eddu_current_command','eddu_command_draft']){const v=JSON.parse(localStorage.getItem(k)||'null');if(v)return v;}
  }catch(_){}
  return null;
 }
 function isClose(el){
  if(!el)return false;
  const t=((el.innerText||el.textContent||'')+' '+(el.getAttribute('aria-label')||'')).toLowerCase().replace(/\s+/g,' ');
  return /(fechar|finalizar|encerrar)\s*(comanda|atendimento)|fechar\s*comanda|finalizar\s*comanda/.test(t);
 }
 window.__edduOpenGatewayRanking=window.__edduOpenGatewayRanking||function(){return false;};
 window.closeCommandAndOpenGateway=function(command){return window.__edduOpenGatewayRanking(command||currentCommand());};
 document.addEventListener('click',function(e){
  const el=e.target?.closest?.('button,a,[role="button"],[onclick]');
  if(!isClose(el)||el.closest('.gateway-choice')||el.id==='v52Checkout'||el.id==='v51ConfirmPayment')return;
  e.preventDefault();e.stopImmediatePropagation();
  window.__edduOpenGatewayRanking(currentCommand());
 },true);
 window.EDDU_MASTER_GATEWAY_ENTRY=true;
})();
