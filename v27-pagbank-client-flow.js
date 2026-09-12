/* V27 — PagBank client payment flow. Real provider status only. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.())fn();else if(n<160)setTimeout(()=>wait(fn,n+1),250)};
  const toastMsg=m=>{if(typeof toast==='function')toast(m);else alert(m)};
  async function checkout(commandId){
    const sb=window.__EDDU_SB;if(!sb)throw new Error('Conexão segura indisponível.');
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente.');
    const base=(sb.supabaseUrl||'').replace(/\/$/,'');
    const r=await fetch(base+'/functions/v1/create-pix-charge',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:session.access_token,'Content-Type':'application/json'},body:JSON.stringify({command_id:String(commandId)})});
    const body=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(body.error||'Não foi possível iniciar o pagamento PagBank.');
    if(!body.checkout_url)throw new Error('O PagBank não retornou o link de pagamento.');
    sessionStorage.setItem('EDDU_PAGBANK_COMMAND',String(commandId));
    window.location.href=body.checkout_url;
  }
  async function status(commandId){
    const sb=window.__EDDU_SB;if(!sb)return null;
    const {data:cmd}=await sb.from('commands').select('id,status,total').eq('id',commandId).maybeSingle();
    const {data:payments}=await sb.from('command_payments').select('amount,paid_at,transaction_reference').eq('command_id',commandId);
    const received=(payments||[]).reduce((s,p)=>s+Number(p.amount||0),0);
    return {command:cmd,payments:payments||[],received,paid:cmd?.status==='closed'||received+0.009>=Number(cmd?.total||0)};
  }
  async function handleReturn(){
    const p=new URLSearchParams(location.search);if(p.get('pagbank')!=='return')return;
    const id=p.get('command_id')||sessionStorage.getItem('EDDU_PAGBANK_COMMAND');if(!id)return;
    let tries=0;
    const poll=async()=>{
      tries++;
      try{const s=await status(id);if(s?.paid){sessionStorage.removeItem('EDDU_PAGBANK_COMMAND');toastMsg('Pagamento confirmado pelo PagBank. Comanda quitada.');if(typeof safeRender==='function')safeRender();return;}}
      catch(e){console.warn('PagBank return',e)}
      if(tries<20)setTimeout(poll,2500);else toastMsg('Pagamento enviado. Aguardando a confirmação do PagBank.');
    };
    poll();
  }
  function bind(){
    const original=window.clientPayOrder;
    const wrapped=async function(commandId){
      try{await checkout(commandId)}catch(e){console.warn('EDDU PagBank',e);toastMsg(e.message||'Não foi possível iniciar o pagamento.')}
    };
    wrapped.__v27=true;
    if(typeof original!=='function'||!original.__v27)window.clientPayOrder=wrapped;
    window.EDDU_PAGBANK_CLIENT={checkout,status};
    handleReturn();
    window.dispatchEvent(new CustomEvent('eddu:pagbank-client-ready'));
  }
  wait(bind);
})();
