/* V18 — real online payment bridge. Stripe is authoritative; UI never marks payment paid by itself. */
(function(){
  const SUPABASE_URL='https://cwdpwfzsasdsetthmpoa.supabase.co';
  const SUPABASE_KEY='sb_publishable_sPtr9cgaWgTAK4ooUkNpxg_5qI2erGj';
  async function createCheckout(commandId){
    const sb=window.__EDDU_SB;
    if(!sb)throw new Error('Conexão segura indisponível');
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente.');
    const r=await fetch(SUPABASE_URL+'/functions/v1/create-stripe-checkout',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({command_id:commandId})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Não foi possível iniciar o pagamento online');
    return j;
  }
  async function paymentStatus(sessionId){
    if(!sessionId||!window.__EDDU_SB)return null;
    const r=await window.__EDDU_SB.from('payment_sessions').select('id,command_id,status,amount,currency,paid_at,provider_session_id').eq('provider_session_id',sessionId).maybeSingle();
    return r.data||null;
  }
  async function checkReturn(){
    const p=new URLSearchParams(location.search);const sessionId=p.get('session_id');
    if(p.get('payment')!=='success'||!sessionId)return;
    let tries=0;
    const poll=async()=>{
      tries++;const s=await paymentStatus(sessionId);
      if(s?.status==='paid'){
        if(typeof toast==='function')toast('Pagamento confirmado. Comanda quitada.');
        if(typeof safeRender==='function')safeRender();
        return;
      }
      if(tries<12)setTimeout(poll,2500);
      else if(typeof toast==='function')toast('Pagamento recebido. A confirmação bancária ainda está sendo processada.');
    };
    poll();
  }
  function wrapClientPayment(){
    const original=window.finishClientPayment;
    if(typeof original!=='function'||original.__v18RealPayment)return;
    const w=async function(){
      if(app?.role!=='client')return original.apply(this,arguments);
      const order=db?.orders?.find(x=>x.id===app?.editingOrder)||db?.orders?.find(x=>x.open);
      if(!order?.id){if(typeof toast==='function')toast('Comanda ainda não sincronizada.');return;}
      try{
        const checkout=await createCheckout(order.id);
        if(!checkout?.checkout_url)throw new Error('Stripe não retornou o checkout');
        window.location.href=checkout.checkout_url;
      }catch(e){
        console.warn('EDDU real payment',e);
        if(typeof toast==='function')toast(e.message||'Não foi possível iniciar o pagamento');
      }
    };
    w.__v18RealPayment=true;window.finishClientPayment=w;
  }
  function boot(){wrapClientPayment();checkReturn();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  setTimeout(boot,1000);
  window.EDDU_REAL_PAYMENT={createCheckout,paymentStatus};
})();
