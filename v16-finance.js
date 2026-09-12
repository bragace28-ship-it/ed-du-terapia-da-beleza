/* V17.4 — financial bridge. DB is source of truth. */
(function(){
 const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
 async function syncFinancial(o){
  if(!o?.id)return null;
  const sb=window.__EDDU_SB,u=window.EDDU_AUTH.getUser();if(!sb||!u)return null;
  const r=await sb.rpc('sync_command_financials',{p_command_id:o.id});
  if(r.error)console.warn('EDDU finance',r.error);
  return r.data||null;
 }
 window.EDDU_FINANCE={syncFinancial};
 wait(()=>{
  const original=window.confirmOrderPayment;
  if(typeof original!=='function'||original.__v174)return;
  const w=function(){
   const result=original.apply(this,arguments);
   if(app?.role==='client')return result;
   Promise.resolve(result).then(()=>{
    const order=db?.orders?.find(x=>x.id===app?.editingOrder);
    if(order)syncFinancial(order);
   }).catch(console.warn);
   return result;
  };
  w.__v174=true;window.confirmOrderPayment=w;
 });
})();