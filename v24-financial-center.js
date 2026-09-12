/* V24 — Financial Center: real cashflow view + bank connection readiness. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&typeof db!=='undefined')fn();else if(n<120)setTimeout(()=>wait(fn,n+1),250)};
  const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  let state={revenue:0,paid:0,pending:0,expenses:0,net:0,bankConnected:false};
  async function load(){
    const sb=window.__EDDU_SB;if(!sb)return state;
    try{
      const [cp,ft,ba]=await Promise.all([
        sb.from('command_payments').select('amount,paid_at,command_id').order('paid_at',{ascending:false}).limit(5000),
        sb.from('financial_transactions').select('amount,type,status,paid_at').order('created_at',{ascending:false}).limit(5000),
        sb.from('bank_accounts').select('id,status').eq('status','connected').limit(1)
      ]);
      if(cp.error)throw cp.error;if(ft.error)throw ft.error;if(ba.error)throw ba.error;
      const payments=cp.data||[], tx=ft.data||[];
      const revenue=payments.reduce((n,p)=>n+Number(p.amount||0),0);
      const expenses=tx.filter(t=>['fixed_cost','variable_cost','commission','payable'].includes(t.type)&&t.status!=='cancelled').reduce((n,t)=>n+Number(t.amount||0),0);
      state={revenue,paid:payments.length,pending:(tx.filter(t=>t.status==='pending').length),expenses,net:revenue-expenses,bankConnected:(ba.data||[]).length>0};
      window.EDDU_FINANCIAL_CENTER.state=state;
      window.dispatchEvent(new CustomEvent('eddu:financial-center',{detail:state}));
      return state;
    }catch(e){console.warn('EDDU V24 financial center',e);return state}
  }
  function card(){return `<section class="eddu-financial-center" style="margin-top:18px;padding:18px;border:1px solid rgba(127,127,127,.22);border-radius:16px;background:var(--card-bg,#fff)"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><strong>Central financeira</strong><div style="font-size:12px;opacity:.65;margin-top:4px">Dados calculados a partir das movimentações reais do sistema.</div></div><span style="font-size:12px">Banco: ${state.bankConnected?'conectado':'não conectado'}</span></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px"><div><small>Recebido</small><div>${brl(state.revenue)}</div></div><div><small>Despesas</small><div>${brl(state.expenses)}</div></div><div><small>Resultado</small><div>${brl(state.net)}</div></div></div><div style="font-size:12px;opacity:.7;margin-top:12px">${state.paid} pagamento(s) registrado(s) · ${state.pending} pendência(s) financeira(s)</div><button type="button" onclick="window.EDDU_FINANCIAL_CENTER.refresh()" style="margin-top:12px">Atualizar financeiro</button></section>`}
  function patch(){
    const names=['productionFinanceOverview','renderFinance','showFinance'];for(const name of names){const fn=window[name];if(typeof fn!=='function'||fn.__v24)continue;const w=function(){const out=fn.apply(this,arguments);return typeof out==='string'&&!out.includes('eddu-financial-center')?out+card():out};w.__v24=true;window[name]=w;return}
  }
  wait(()=>{window.EDDU_FINANCIAL_CENTER={load,refresh:load,getState:()=>state,card};load();patch();setInterval(load,30000);});
})();
