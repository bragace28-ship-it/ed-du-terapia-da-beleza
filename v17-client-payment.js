/* V17.2 — client payment bridge. Client never calls staff-only finalize_command. */
(function(){
 const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
 async function pay(order,method,amount,reference){
  const sb=window.__EDDU_SB;if(!sb||!order?.id)return null;
  const pm=await sb.from('payment_methods').select('id,name').eq('active',true).ilike('name',method||'').maybeSingle();
  if(pm.error||!pm.data)throw(pm.error||new Error('Forma de pagamento não liberada'));
  const r=await sb.rpc('pay_command_as_client',{p_command_id:order.id,p_payment_method_id:pm.data.id,p_amount:Number(amount||0),p_reference:reference||null});
  if(r.error)throw r.error;
  window.EDDU_CLIENT_PAYMENT=r.data;
  return r.data;
 }
 window.EDDU_CLIENT_PAYMENT_API={pay};
 wait(()=>{
  const original=window.finishClientPayment;
  if(typeof original!=='function'||original.__v172)return;
  const w=async function(){
   const order=db?.orders?.find(x=>x.id===app?.editingOrder)||db?.orders?.find(x=>x.payment!=='paid');
   if(order&&app?.role==='client'&&order.id&&String(order.id).includes('-')){
    const method=order.paymentMethod||order.method||'Pix';
    const total=typeof orderCalc==='function'?(orderCalc(order).net||order.total||0):(order.total||0);
    try{await pay(order,method,total,null)}catch(e){console.warn('EDDU client payment',e);return original.apply(this,arguments)}
    if(typeof safeRender==='function')safeRender();
    return;
   }
   return original.apply(this,arguments);
  };
  w.__v172=true;window.finishClientPayment=w;
 });
})();
