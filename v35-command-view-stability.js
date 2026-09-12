/* V35.1 — stable Comandas/Pagamentos without blocking normal page rendering. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined'&&typeof app!=='undefined')fn();else if(n<240)setTimeout(()=>wait(fn,n+1),250)};
  wait(()=>{
    const original=window.safeRender;
    if(typeof original!=='function'||original.__edduV351)return;
    let rendering=false;
    const stable=function(){
      if(rendering)return;
      rendering=true;
      try{return original.apply(this,arguments)}finally{setTimeout(()=>{rendering=false},0)}
    };
    stable.__edduV351=true;
    window.safeRender=stable;
    window.EDDU_COMMAND_VIEW_STABILITY={active:true};
  });
})();
