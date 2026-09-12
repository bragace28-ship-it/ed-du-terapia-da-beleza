/* V17.1 — financial bridge. DB is source of truth; command_id/type are unique. */
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
  const hook=name=>{const o=window[name];if(typeof o!=='function'||o.__v171)return;
   const w=function(){const r=o.apply(this,arguments);Promise.resolve(r).then(()=>{const id=app?.editingOrder;const order=db?.orders?.find(x=>x.id===id);if(order)syncFinancial(order)}).catch(console.warn);return r};w.__v171=true;window[name]=w};
  ['confirmOrderPayment','finishClientPayment'].forEach(hook);
 });
})();
