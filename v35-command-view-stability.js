/* V35 — keep command/payment views stable while preserving real Supabase data. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined'&&typeof app!=='undefined')fn();else if(n<240)setTimeout(()=>wait(fn,n+1),250)};
  wait(()=>{
    const original=window.safeRender;
    if(typeof original!=='function')return;
    let lastView='';
    let modalOpen=false;
    const isProtected=()=>{
      const text=(document.body?.innerText||'').toLowerCase();
      return !!document.querySelector('[role="dialog"],.modal,.modal-overlay,.overlay') &&
        (text.includes('comanda')||text.includes('pagamento'));
    };
    window.safeRender=function(){
      const protectedNow=isProtected();
      const view=String(app.view||app.page||app.screen||'');
      if(protectedNow && modalOpen)return;
      if(protectedNow && view===lastView)return;
      lastView=view;
      return original.apply(this,arguments);
    };
    const syncModal=()=>{modalOpen=isProtected()};
    document.addEventListener('click',()=>setTimeout(syncModal,0),true);
    const mo=new MutationObserver(()=>{syncModal()});
    mo.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('eddu:refresh-data',()=>{modalOpen=isProtected()});
  });
})();
