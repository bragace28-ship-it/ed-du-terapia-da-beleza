/* V25 — PIX real bridge + reconciliation. Never fabricates QR/Pix data. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&typeof db!=='undefined')fn();else if(n<120)setTimeout(()=>wait(fn,n+1),250)};
  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  let state={intents:[],bankMatches:[],configured:false};
  async function load(){
    const sb=window.__EDDU_SB;if(!sb)return state;
    try{
      const [i,b]=await Promise.all([
        sb.from('pix_payment_intents').select('id,command_id,client_id,provider,provider_payment_id,txid,e2e_id,amount,status,copy_paste,expires_at,paid_at,created_at').order('created_at',{ascending:false}).limit(200),
        sb.from('bank_transactions').select('id,external_transaction_id,occurred_at,amount,direction,description,end_to_end_id,reconciliation_status,matched_command_payment_id').order('occurred_at',{ascending:false}).limit(500)
      ]);
      if(i.error && i.error.code!=='42P01') throw i.error;
      if(b.error && b.error.code!=='42P01') throw b.error;
      state={intents:i.data||[],bankMatches:b.data||[],configured:!(i.error?.code==='42P01')};
      window.EDDU_PIX_RECONCILIATION.state=state;
      window.dispatchEvent(new CustomEvent('eddu:pix-reconciliation',{detail:state}));
      return state;
    }catch(e){console.warn('EDDU V25 PIX',e);return state}
  }
  async function createPix(commandId){
    const sb=window.__EDDU_SB;if(!sb)throw new Error('Supabase indisponível.');
    const token=(await sb.auth.getSession()).data?.session?.access_token;
    if(!token)throw new Error('Sessão expirada.');
    const r=await fetch((sb.supabaseUrl||'').replace(/\/$/,'')+'/functions/v1/create-pix-charge',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({command_id:commandId})});
    let body={};try{body=await r.json()}catch{}
    if(!r.ok) throw new Error(body.error||'Provedor PIX não configurado ou indisponível.');
    await load(); return body;
  }
  async function status(intentId){
    const sb=window.__EDDU_SB;if(!sb)throw new Error('Supabase indisponível.');
    const {data,error}=await sb.from('pix_payment_intents').select('*').eq('id',intentId).single();
    if(error)throw error; return data;
  }
  function card(commandId){
    const intents=state.intents.filter(x=>String(x.command_id)===String(commandId));
    const active=intents[0];
    if(!active)return `<section class="eddu-pix-card" style="margin-top:12px;padding:14px;border:1px solid rgba(127,127,127,.22);border-radius:14px"><strong>PIX</strong><div style="font-size:12px;opacity:.7;margin:5px 0 10px">Cobrança PIX real — o QR Code só aparece após confirmação do provedor.</div><button type="button" onclick="window.EDDU_PIX_RECONCILIATION.createPix('${esc(commandId)}').catch(e=>alert(e.message))">Gerar cobrança PIX</button></section>`;
    return `<section class="eddu-pix-card" style="margin-top:12px;padding:14px;border:1px solid rgba(127,127,127,.22);border-radius:14px"><strong>PIX · ${esc(String(active.status||'pending').toUpperCase())}</strong><div style="font-size:12px;margin-top:6px">${brl(active.amount)}${active.txid?' · TXID '+esc(active.txid):''}</div>${active.copy_paste?`<textarea readonly style="width:100%;margin-top:10px;min-height:70px">${esc(active.copy_paste)}</textarea><button type="button" onclick="navigator.clipboard?.writeText(${JSON.stringify(active.copy_paste)})">Copiar PIX Copia e Cola</button>`:'<div style="font-size:12px;opacity:.7;margin-top:8px">Aguardando payload PIX do provedor.</div>'}</section>`;
  }
  window.EDDU_PIX_RECONCILIATION={state,load,refresh:load,createPix,status,card};
  wait(()=>{load();setInterval(load,30000);});
})();
