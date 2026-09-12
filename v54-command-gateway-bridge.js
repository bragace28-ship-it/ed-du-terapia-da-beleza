/* V54 — FINAL production bridge: the MAIN "Fechar comanda" must always enter Smart Gateway. */
(function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const hasItems=o=>!!o&&Array.isArray(o.items)&&o.items.length>0;
async function install(){
  for(let i=0;i<300;i++){
    const v46=window.EDDU_V46;
    const smartReady=typeof window.EDDU_V50Pay==='function';
    if(v46&&typeof v46.closeCommand==='function'&&smartReady){
      const smartClose=v46.closeCommand;
      const bridge=function(id){
        try{
          const orders=typeof db!=='undefined'?(db.orders||[]):[];
          const o=orders.find(x=>String(x.id)===String(id));
          if(o&&!hasItems(o)){
            if(typeof toast==='function')toast('Adicione pelo menos um serviço antes de fechar.');
            if(typeof openOrder==='function')openOrder(id);
            return;
          }
          return smartClose(id);
        }catch(e){
          console.error('[EDDU V54] Smart Gateway bridge error',e);
          if(typeof toast==='function')toast(e?.message||'Não foi possível abrir o Smart Gateway.');
        }
      };
      bridge.__edduSmartClose=true;
      bridge.__v54=true;
      bridge.__smartTarget=smartClose;
      window.closeOrder=bridge;
      try{closeOrder=bridge}catch(e){}
      // V46 buttons call this property directly, so patch it too.
      v46.closeCommand=bridge;
      v46.closeCommand.__edduSmartClose=true;
      window.__EDDU_V54_READY=true;
      window.__EDDU_MAIN_CLOSE_USES_SMART=true;
      return true;
    }
    await wait(200);
  }
  console.error('[EDDU V54] Smart Gateway did not initialize within timeout.');
  return false;
}
install();
})();
