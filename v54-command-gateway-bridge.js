/* V54 — Final bridge for the MAIN comanda close button. */
(function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function hasItems(o){return !!o && Array.isArray(o.items) && o.items.length>0}
async function install(){
  for(let i=0;i<240;i++){
    const v46=window.EDDU_V46;
    const smartReady=typeof window.EDDU_V50Pay==='function';
    if(v46&&typeof v46.closeCommand==='function'&&smartReady){
      // IMPORTANT: resolve the close handler only AFTER V50 is ready.
      // Earlier bridges may have captured the legacy closeCommand.
      const smartClose=v46.closeCommand;
      const existing=window.closeOrder;
      if(typeof existing!=='function'||existing.__edduSmartClose!==true){
        const f=function(id){
          const o=typeof db!=='undefined'?(db.orders||[]).find(x=>String(x.id)===String(id)):null;
          if(o&&!hasItems(o)){
            if(typeof toast==='function')toast('Adicione pelo menos um serviço antes de fechar.');
            if(typeof openOrder==='function')openOrder(id);
            return;
          }
          return smartClose(id);
        };
        f.__edduSmartClose=true;
        f.__v54=true;
        f.__legacy=existing;
        window.closeOrder=f;
        try{closeOrder=f}catch(e){}
      }
      window.__EDDU_V54_READY=true;
      return true;
    }
    await wait(250);
  }
  console.error('[EDDU V54] Smart Gateway não ficou disponível.');
  return false;
}
install();
})();
