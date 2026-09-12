/* V23 — payment reconciliation. Bank is optional; provider-confirmed payments are authoritative. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&typeof db!=='undefined')fn();else if(n<120)setTimeout(()=>wait(fn,n+1),250)};
  const money=v=>Number(v||0);
  const brl=v=>money(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let cache={rows:[],summary:{expected:0,received:0,difference:0,paid:0,partial:0,pending:0,divergent:0},bankConnected:false,updatedAt:null};
  async function load(){
    const sb=window.__EDDU_SB;if(!sb)return cache;
    try{
      const [cmd,cp,ps,pm,ft]=await Promise.all([
        sb.from('commands').select('id,client_id,professional_id,status,total,created_at,closed_at').order('created_at',{ascending:false}).limit(500),
        sb.from('command_payments').select('id,command_id,payment_method_id,amount,paid_at,transaction_reference,created_at').order('created_at',{ascending:false}).limit(1000),
        sb.from('payment_sessions').select('id,command_id,client_id,provider,provider_session_id,amount,currency,status,checkout_url,paid_at,created_at').order('created_at',{ascending:false}).limit(500),
        sb.from('payment_methods').select('id,name,active'),
        sb.from('financial_transactions').select('id,command_id,type,amount,status,paid_at,description').order('created_at',{ascending:false}).limit(1000)
      ]);
      if(cmd.error)throw cmd.error;if(cp.error)throw cp.error;if(ps.error)throw ps.error;if(pm.error)throw pm.error;if(ft.error)throw ft.error;
      const commands=cmd.data||[], payments=cp.data||[], sessions=ps.data||[], methods=pm.data||[], tx=ft.data||[];
      const methodById=new Map(methods.map(x=>[x.id,x.name]));
      const paysBy=new Map();for(const p of payments){const a=paysBy.get(p.command_id)||[];a.push(p);paysBy.set(p.command_id,a)}
      const sessBy=new Map();for(const s of sessions){const a=sessBy.get(s.command_id)||[];a.push(s);sessBy.set(s.command_id,a)}
      const rows=commands.map(c=>{
        const ps0=paysBy.get(c.id)||[], ss=sessBy.get(c.id)||[];
        const received=ps0.reduce((n,p)=>n+money(p.amount),0);
        const paidOnline=ss.some(s=>s.status==='paid');
        const expected=money(c.total);
        const diff=Math.max(0,expected-received);
        let status='pending';if(received>0&&diff>0.009)status='partial';if(diff<=0.009&&expected>0)status='paid';if(paidOnline&&!received)status='paid';if(received>expected+0.009)status='divergent';
        const latest=ps0[0]||null, online=ss[0]||null;
        return {id:c.id,expected,received,difference:expected-received,status,paymentMethod:latest?methodById.get(latest.payment_method_id)||'Pagamento':(online?.provider||''),reference:latest?.transaction_reference||online?.provider_session_id||'',paidAt:latest?.paid_at||online?.paid_at||null};
      });
      const summary=rows.reduce((a,r)=>{a.expected+=r.expected;a.received+=r.received;a.difference+=r.difference;if(r.status==='paid')a.paid++;if(r.status==='partial')a.partial++;if(r.status==='pending')a.pending++;if(r.status==='divergent')a.divergent++;return a},{expected:0,received:0,difference:0,paid:0,partial:0,pending:0,divergent:0});
      cache={rows,summary,bankConnected:false,updatedAt:new Date().toISOString()};
      if(typeof db!=='undefined'){
        db.orders=(db.orders||[]).map(o=>{const r=rows.find(x=>String(x.id)===String(o.id));return r?{...o,payment:r.status==='paid'?'paid':(r.received>0?'partial':'pending'),paymentMethod:r.paymentMethod||'',transactionReference:r.reference||''}:o});
      }
      window.EDDU_RECONCILIATION.cache=cache;
      window.dispatchEvent(new CustomEvent('eddu:reconciliation',{detail:cache}));
      return cache;
    }catch(e){console.warn('EDDU V23 reconciliation',e);return cache}
  }
  function panel(){const s=cache.summary||{};const issue=s.partial+s.pending+s.divergent;return `<section class="eddu-reconciliation" style="margin-top:18px;padding:18px;border:1px solid rgba(127,127,127,.22);border-radius:16px;background:var(--card-bg,#fff)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><strong>Conciliação de pagamentos</strong><div style="font-size:12px;opacity:.65;margin-top:4px">Confirmação baseada nos registros reais de pagamento. Banco ainda não conectado.</div></div><span style="font-size:12px;padding:6px 10px;border-radius:999px;background:${issue?'rgba(245,158,11,.14)':'rgba(34,197,94,.14)'}">${issue?issue+' pendência(s)':'Tudo conciliado'}</span></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px"><div><small>Previsto</small><div>${brl(s.expected)}</div></div><div><small>Recebido</small><div>${brl(s.received)}</div></div><div><small>Diferença</small><div>${brl(s.difference)}</div></div></div><div style="font-size:12px;opacity:.7;margin-top:12px">Pagos: ${s.paid||0} · Parciais: ${s.partial||0} · Pendentes: ${s.pending||0} · Divergentes: ${s.divergent||0}</div><button type="button" onclick="window.EDDU_RECONCILIATION.refresh()" style="margin-top:12px">Atualizar conciliação</button></section>`}
  function patchFinance(){
    const name=['productionFinanceOverview','renderFinance','showFinance'].find(n=>typeof window[n]==='function');if(!name||window[name].__v23)return;
    const orig=window[name];const w=function(){const out=orig.apply(this,arguments);if(typeof out==='string'&&!out.includes('eddu-reconciliation'))return out+panel();return out};w.__v23=true;window[name]=w;
  }
  wait(()=>{window.EDDU_RECONCILIATION={load,refresh:load,getSummary:()=>cache.summary,getRows:()=>cache.rows,panel:()=>panel()};load();patchFinance();setInterval(load,30000);window.addEventListener('eddu:refresh-data',load);});
})();
