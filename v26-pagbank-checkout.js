/* V26 — PagBank Checkout UI bridge. Provider remains authoritative for payment status. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&typeof db!=='undefined')fn();else if(n<120)setTimeout(()=>wait(fn,n+1),250)};
  async function create(commandId){
    const sb=window.__EDDU_SB;if(!sb)throw new Error('Supabase indisponível.');
    const token=(await sb.auth.getSession()).data?.session?.access_token;if(!token)throw new Error('Sessão expirada.');
    const r=await fetch((sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/create-pix-charge',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({command_id:commandId})});
    const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'Não foi possível criar o Checkout PagBank.');
    if(body.checkout_url){window.location.href=body.checkout_url;return body;}
    throw new Error('PagBank não retornou o link de Checkout.');
  }
  function card(commandId){return `<section class="eddu-pagbank-card" style="margin-top:12px;padding:16px;border:1px solid rgba(127,127,127,.22);border-radius:14px"><strong>Pagamento online</strong><div style="font-size:12px;opacity:.7;margin:6px 0 12px">PagBank Checkout · Pix ou cartão</div><button type="button" onclick="window.EDDU_PAGBANK_CHECKOUT.create('${String(commandId).replace(/'/g,"\\'")}').catch(e=>alert(e.message))">Pagar agora</button></section>`}
  window.EDDU_PAGBANK_CHECKOUT={create,card};
  wait(()=>window.dispatchEvent(new CustomEvent('eddu:pagbank-ready')));
})();
