/* V17.5 — professional command finalization. Preserves V13.1/V15 UI. */
(function(){
 const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
 async function finalize(order,method,amount,reference){
  const sb=window.__EDDU_SB;if(!sb||!order?.id)return null;
  const pm=await sb.from('payment_methods').select('id,name').eq('active',true).ilike('name',method||'').maybeSingle();
  if(pm.error||!pm.data)throw(pm.error||new Error('Forma de pagamento não liberada'));
  const r=await sb.rpc('finalize_command',{p_command_id:order.id,p_payment_method_id:pm.data.id,p_amount:Number(amount||0),p_reference:reference||null});
  if(r.error)throw r.error;
  window.EDDU_FINALIZED=r.data;return r.data;
 }
 window.EDDU_FINALIZE={finalize};
 wait(()=>{
  const original=window.confirmOrderPayment;
  if(typeof original!=='function'||original.__v175)return;
  const w=async function(){
   if(app?.role==='client')return original.apply(this,arguments);
   const result=original.apply(this,arguments);
   try{
    await Promise.resolve(result);
    const order=db?.orders?.find(x=>x.id===app?.editingOrder);
    if(!order)return result;
    const method=order.paymentMethod||order.method;
    if(!method)throw new Error('Selecione a forma de pagamento');
    const total=typeof orderCalc==='function'?(orderCalc(order).net||order.total||0):(order.total||0);
    await finalize(order,method,total,null);
    if(typeof safeRender==='function')safeRender();
   }catch(e){console.warn('EDDU finalize',e)}
   return result;
  };
  w.__v175=true;window.confirmOrderPayment=w;
 });
})();