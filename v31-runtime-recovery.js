/* V31 — runtime recovery / command hydration hardening. */
(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const wait=(fn,n=0)=>{if(n>240)return;if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&Array.isArray(window.SERVICES))fn();else setTimeout(()=>wait(fn,n+1),250)};
  async function hydrateServiceCatalog(){
    const sb=window.__EDDU_SB;if(!sb)return;
    const r=await sb.from('services').select('id,name,price_base,price_long,service_cost,duration_minutes').eq('active',true);
    if(r.error)return;
    const list=window.SERVICES;
    for(const x of (r.data||[])){
      let s=list.find(a=>String(a.dbId||'')===String(x.id));
      if(!s)s=list.find(a=>norm(a.n||a.name)===norm(x.name)||((norm(a.n||a.name).includes('corte fem'))&&norm(x.name).includes('corte fem')));
      if(s){s.dbId=x.id;s.base=Number(x.price_base??s.base??0);s.long=Number(x.price_long??s.long??s.base??0);s.cost=Number(x.service_cost??s.cost??0);s.time=Number(x.duration_minutes??s.time??60);continue}
      const id='dbsvc_'+String(x.id);
      if(!list.some(a=>String(a.id)===id))list.push({id,dbId:x.id,n:x.name,name:x.name,base:Number(x.price_base||0),long:Number(x.price_long??x.price_base??0),cost:Number(x.service_cost||0),time:Number(x.duration_minutes||60)});
    }
  }
  function hardenRender(){
    const fn=window.safeRender;if(typeof fn!=='function'||fn.__v31)return;
    const w=function(){try{return fn.apply(this,arguments)}catch(e){console.error('EDDU safeRender recovered',e);window.__EDDU_LAST_RENDER_ERROR=String(e?.message||e);try{if(window.db&&Array.isArray(db.orders)){db.orders=db.orders.filter(o=>Array.isArray(o.items)&&o.items.every(i=>i&&i.serviceId));}}catch(_){}try{return fn.apply(this,arguments)}catch(_){return null}}};
    w.__v31=true;window.safeRender=w;
  }
  function boot(){
    hardenRender();
    hydrateServiceCatalog().then(()=>{try{if(typeof window.safeRender==='function')window.safeRender()}catch(e){console.warn('EDDU recovery render',e)}}).catch(e=>console.warn('EDDU service hydration',e));
  }
  wait(boot);
  let recovering=false;
  const recoverIfBlank=()=>{
    if(recovering||sessionStorage.getItem('eddu_runtime_recovered'))return;
    const text=(document.body?.innerText||'').trim();
    if(text.includes('O sistema encontrou um erro interno')||text.includes('Recarregue para continuar')){
      recovering=true;sessionStorage.setItem('eddu_runtime_recovered','1');
      try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)||'';if(!/^sb-|supabase/i.test(k))localStorage.removeItem(k)}}catch(e){}
      setTimeout(()=>location.reload(),100);
    }
  };
  setInterval(recoverIfBlank,500);
  window.addEventListener('error',e=>console.error('EDDU runtime',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>console.error('EDDU rejection',e.reason));
})();
