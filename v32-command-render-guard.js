/* V32 — command render guard. */
(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const serviceFor=item=>{
    if(!item||typeof SERVICES==='undefined')return null;
    const id=String(item.dbServiceId||item.serviceId||'');
    const byId=SERVICES.find(s=>String(s.id)===id||String(s.dbId||'')===id);
    if(byId)return byId;
    const name=norm(item.description||item.name||'');
    return name?SERVICES.find(s=>{const n=norm(s.n||s.name||'');return n===name||(name.includes('corte feminino')&&n.includes('corte fem'))||(name.includes('corte fem')&&n.includes('corte feminino'))}):null;
  };
  function normalize(){try{if(typeof db==='undefined'||!Array.isArray(db.orders))return;db.orders=db.orders.map(o=>{if(!o||!Array.isArray(o.items))return o;const items=o.items.map(i=>{const s=serviceFor(i);return s?Object.assign({},i,{serviceId:s.id,dbServiceId:s.dbId||i.dbServiceId,description:i.description||s.n}):null}).filter(Boolean);return Object.assign({},o,{items})}).filter(o=>o&&o.items&&o.items.length)}catch(e){console.warn('EDDU V32 normalize',e)}}
  function install(){normalize();const fn=window.safeRender;if(typeof fn!=='function'||fn.__v32)return;}
  function wrap(){normalize();const fn=window.safeRender;if(typeof fn!=='function'||fn.__v32)return;const w=function(){normalize();try{return fn.apply(this,arguments)}catch(e){console.error('EDDU V32 render error',e);normalize();try{return fn.apply(this,arguments)}catch(e2){console.error('EDDU V32 retry failed',e2);return null}}};w.__v32=true;window.safeRender=w;}
  let n=0;const t=setInterval(()=>{n++;normalize();if(typeof window.safeRender==='function'&&!window.safeRender.__v32)wrap();if(n>300)clearInterval(t)},100);
  window.addEventListener('eddu:refresh-data',()=>setTimeout(wrap,0));
})();
