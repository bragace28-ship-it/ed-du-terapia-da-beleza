/* V27 — PagBank Checkout integration for client payment flow. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&typeof db!=='undefined')fn();else if(n<160)setTimeout(()=>wait(fn,n+1),250)};
  async function create(commandId){
    const sb=window.__EDDU_SB;if(!sb)throw new Error('Supabase indisponível.');
    const token=(await sb.auth.getSession()).data?.session?.access_token;if(!token)throw new Error('Sessão expirada.');
    const r=await fetch((sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/create-pix-charge',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({command_id:commandId})});
    const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'Não foi possível criar o Checkout PagBank.');
    const href=body.checkout_url||body.intent?.checkout_url;if(href){window.location.href=href;return body;}
    throw new Error('PagBank não retornou o link de Checkout.');
  }
  async function status(commandId){
    const sb=window.__EDDU_SB;if(!sb||!commandId)return null;
    const [cmd,payments]=await Promise.all([sb.from('commands').select('id,status,total,closed_at').eq('id',commandId).maybeSingle(),sb.from('command_payments').select('id,amount,paid_at,transaction_reference').eq('command_id',commandId).order('paid_at',{ascending:false})]);
    const total=Number(cmd.data?.total||0),paid=(payments.data||[]).reduce((a,p)=>a+Number(p.amount||0),0);
    return {command:cmd.data,payments:payments.data||[],total,paid,settled:cmd.data?.status==='closed'||paid+0.009>=total};
  }
  function checkReturn(){
    const p=new URLSearchParams(location.search),commandId=p.get('command_id');if(p.get('pagbank')!=='return'||!commandId)return;
    let tries=0;const poll=async()=>{tries++;const s=await status(commandId);if(s?.settled){const order=(db.orders||[]).find(o=>String(o.id)===String(commandId));if(order){order.payment='paid';order.paymentConfirmed=true;order.status='closed';order.paidAt=s.payments[0]?.paid_at||new Date().toISOString();if(typeof save==='function')save();}if(typeof toast==='function')toast('Pagamento confirmado pelo PagBank. Comanda quitada.');if(typeof safeRender==='function')safeRender();return;}if(tries<20)setTimeout(poll,2000);else if(typeof toast==='function')toast('Voltamos do PagBank. A confirmação ainda está sendo processada.');};poll();
  }
  function patchClientPayment(){
    const original=window.clientPayOrder;if(typeof original!=='function'||original.__v27PagBank)return;
    const w=async function(commandId){try{await create(commandId);}catch(e){console.warn('EDDU PagBank',e);if(typeof toast==='function')toast(e.message||'Não foi possível iniciar o pagamento PagBank');}};w.__v27PagBank=true;window.clientPayOrder=w;
  }
  function card(commandId){return '<section class="eddu-pagbank-card" style="margin-top:12px;padding:16px;border:1px solid rgba(127,127,127,.22);border-radius:14px"><strong>Pagamento online</strong><div style="font-size:12px;opacity:.7;margin:6px 0 12px">PagBank Checkout · Pix ou cartão</div><button type="button" class="btn primary" onclick="window.EDDU_PAGBANK_CHECKOUT.create(\''+String(commandId).replace(/'/g,"\\'")+'\').catch(e=>(typeof toast===\'function\'?toast(e.message):alert(e.message)))">Pagar agora</button></section>'}
  window.EDDU_PAGBANK_CHECKOUT={create,status,checkReturn,card};
  wait(()=>{patchClientPayment();checkReturn();window.dispatchEvent(new CustomEvent('eddu:pagbank-ready'));});
})();
