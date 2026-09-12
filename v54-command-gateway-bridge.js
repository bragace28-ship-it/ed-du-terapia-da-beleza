/* V54 — Command bridge: main comanda MUST use Smart Gateway after V50 is ready. */
(function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function init(){
  for(let i=0;i<180;i++){
    const v46=window.EDDU_V46;
    const smartReady=typeof window.EDDU_V50Pay==='function';
    if(v46&&typeof v46.closeCommand==='function'&&smartReady){
      const smartClose=v46.closeCommand;
      const current=window.closeOrder;
      if(typeof current==='function'&&!current.__v54){
        const f=function(id){
          const o=typeof db!=='undefined'?(db.orders||[]).find(x=>String(x.id)===String(id)):null;
          if(o&&!Array.isArray(o.items)||o&&!o.items.length){
            if(typeof toast==='function')toast('Adicione pelo menos um serviço antes de fechar.');
            if(typeof openOrder==='function')openOrder(id);
            return;
          }
          return smartClose(id);
        };
        f.__v54=true;
        f.__legacy=current;
        window.closeOrder=f;
        try{closeOrder=f}catch(e){}
      }
      window.__EDDU_V54_READY=true;
      return;
    }
    await wait(250);
  }
  console.error('[V54] Smart Gateway não inicializou a tempo.');
}
init();
})();
