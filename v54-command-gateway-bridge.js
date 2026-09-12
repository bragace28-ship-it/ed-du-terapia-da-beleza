/* V54 — Command bridge: the main comanda screen must use the Smart Gateway on close. */
(function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function init(){
 for(let i=0;i<120;i++){
  if(window.EDDU_V46&&typeof window.EDDU_V46.closeCommand==='function'){
   const smartClose=window.EDDU_V46.closeCommand;
   if(typeof window.closeOrder==='function'&&!window.closeOrder.__v54){
    const legacyClose=window.closeOrder;
    const f=function(id){
      const o=typeof db!=='undefined'?(db.orders||[]).find(x=>String(x.id)===String(id)):null;
      if(o&&!o.items?.length){if(typeof toast==='function')toast('Adicione pelo menos um serviço antes de fechar.');if(typeof openOrder==='function')openOrder(id);return;}
      return smartClose(id);
    };
    f.__v54=true;f.__legacy=legacyClose;window.closeOrder=f;closeOrder=f;
   }
   return;
  }
  await wait(100);
 }
}
init();
})();
