/* V17 — transactional command/payment bridge. Preserves V13.1/V15 UI. */
(function(){
 const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
 const money=x=>Number(x||0).toFixed(2);
 async function finalize(order,method,amount,reference){
  const sb=window.__EDDU_SB;if(!sb||!order?.id)return null;
  const pm=await sb.from('payment_methods').select('id,name').eq('active',true).ilike('name',method||'').maybeSingle();
  if(pm.error||!pm.data) return {error:pm.error||new Error('Forma de pagamento não liberada')};
  const r=await sb.rpc('finalize_command',{p_command_id:order.id,p_payment_method_id:pm.data.id,p_amount:Number(amount||0),p_reference:reference||null});
  if(r.error)console.warn('EDDU finalize',r.error);else window.EDDU_FINALIZED=r.data;
  return r.data||r;
 }
 window.EDDU_FINALIZE={finalize};
 wait(()=>{
  const names=['confirmOrderPayment','finishClientPayment'];
  names.forEach(name=>{const o=window[name];if(typeof o!=='function'||o.__v17)return;const w=function(){const args=arguments;const result=o.apply(this,args);Promise.resolve(result).then(async()=>{const order=db.orders?.find(x=>x.id===app.editingOrder)||db.orders?.find(x=>x.payment==='paid');if(!order)return;const method=order.paymentMethod||order.method||'Pix';const total=typeof orderCalc==='function'?(orderCalc(order).net||order.total||0):(order.total||0);await finalize(order,method,total,null)}).catch(console.warn);return result};w.__v17=true;window[name]=w});
 });
})();
