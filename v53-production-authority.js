/* V53 — Production authority: Supabase is the only source for operational KPIs, appointments and commands. */
(function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
const statusMap={requested:'Pendente',confirmed:'Aprovado',rescheduled:'Reagendado',in_progress:'Em atendimento',completed:'Concluído',cancelled:'Cancelado',no_show:'No show'};
function hideDemo(){let r=document.getElementById('root');if(r){r.dataset.v53Hidden='1';r.style.visibility='hidden';r.style.opacity='0'}}
function showReal(){let r=document.getElementById('root');if(r){r.style.visibility='visible';r.style.opacity='1';r.dataset.v53Ready='1'}}
async function boot(){
  hideDemo();
  for(let i=0;i<120;i++){
    const sb=window.__EDDU_SB, auth=window.EDDU_AUTH, user=auth?.getUser?.();
    if(sb&&user&&typeof db!=='undefined'&&typeof SERVICES!=='undefined'){
      try{
        const {data:x,error}=await sb.rpc('get_command_center_v2');
        if(error) throw error;
        const d=x||{};
        const clients=Array.isArray(d.clients)?d.clients:[];
        const services=Array.isArray(d.services)?d.services:[];
        const pros=Array.isArray(d.professionals)?d.professionals:[];
        const commands=Array.isArray(d.commands)?d.commands:[];
        const items=Array.isArray(d.command_items)?d.command_items:[];
        const payments=Array.isArray(d.payments)?d.payments:[];
        db.clients=clients.map(c=>({id:c.id,user_id:c.user_id,name:c.name||'',phone:c.phone||'',email:c.email||'',points:Number(c.loyalty_points||0),term:false,anam:c.notes||'',history:[],anams:[]}));
        window.__EDDU_PROS=pros;
        window.PROFESSIONALS=pros.map(p=>({id:p.id,name:p.name,phone:p.phone||'',email:p.email||'',specialty:p.specialty||'Terapia da Beleza',commission_percent:Number(p.commission_percent||0),active:p.active!==false}));
        SERVICES.forEach(s=>{const x=services.find(v=>String(v.id)===String(s.dbId)||String(v.name||'').toLowerCase()===String(s.n||'').toLowerCase());if(x){s.dbId=x.id;s.base=Number(x.price_base||0);s.long=Number(x.price_long||0);s.cost=Number(x.service_cost||0);s.time=Number(x.duration_minutes||60)}});
        db.orders=commands.map(o=>{
          const lines=items.filter(i=>String(i.command_id)===String(o.id));
          const ps=payments.filter(p=>String(p.command_id)===String(o.id));
          const received=ps.reduce((a,p)=>a+Number(p.amount||0),0);
          const total=Number(o.total??o.subtotal??0);
          const paid=received+0.009>=total;
          return {id:o.id,clientId:o.client_id,client:db.clients.find(c=>String(c.id)===String(o.client_id))?.name||'',professionalId:o.professional_id,prof:pros.find(p=>String(p.id)===String(o.professional_id))?.name||'',status:o.status,open:o.status==='open',openedAt:o.opened_at,closedAt:o.closed_at,discount:Number(o.discount||0),payment:paid?'paid':'pending',paymentMethod:'',paidAt:ps[0]?.paid_at||null,paymentConfirmed:paid,items:lines.map(i=>({serviceId:SERVICES.find(s=>String(s.dbId)===String(i.service_id))?.id,dbServiceId:i.service_id,length:'base',qty:Number(i.quantity||1),quantity:Number(i.quantity||1),unitPrice:Number(i.unit_price||0),unit_price:Number(i.unit_price||0),unitCost:Number(i.unit_cost||0),description:i.description||SERVICES.find(s=>String(s.dbId)===String(i.service_id))?.n||'Serviço'})),subtotal:Number(o.subtotal||0),total,cost:Number(o.total_cost||0),commission:Number(o.commission||0),profit:Number(o.profit||0),payment_gateway:o.payment_gateway||null,payment_card_brand:o.payment_card_brand||null,payment_installments:o.payment_installments||1,payment_estimated_fee:Number(o.payment_estimated_fee||0),payment_estimated_net:Number(o.payment_estimated_net||0),payment_installment_amount:Number(o.payment_installment_amount||0),payment_link:o.payment_link||null,__real:true};
        });
        db.requests=(Array.isArray(d.commands)?[]:[]);
        const ap=await sb.from('appointments').select('*').order('starts_at');
        const ai=await sb.from('appointment_services').select('*');
        if(!ap.error){db.requests=(ap.data||[]).map(a=>{const lines=(ai.data||[]).filter(i=>String(i.appointment_id)===String(a.id));const first=lines[0];const svc=SERVICES.find(s=>String(s.dbId)===String(first?.service_id));return{id:a.id,clientId:a.client_id,client:db.clients.find(c=>String(c.id)===String(a.client_id))?.name||'',prof:pros.find(p=>String(p.id)===String(a.professional_id))?.name||'',professionalId:a.professional_id,date:a.starts_at?new Date(a.starts_at).toISOString().slice(0,10):'',time:a.starts_at?new Date(a.starts_at).toISOString().slice(11,16):'',status:statusMap[a.status]||a.status||'Pendente',serviceId:svc?.id,service:svc?.n||'',services:lines.map(i=>{const s=SERVICES.find(x=>String(x.dbId)===String(i.service_id));return{serviceId:s?.id,dbServiceId:i.service_id,name:s?.n||'',length:'base',price:Number(i.price||0)}})}})});
        }
        if(Array.isArray(d.payment_methods)&&d.payment_methods.length)db.settings.paymentMethods=d.payment_methods.map(x=>x.name);
        db.fixedCosts=0;
        db.revenue=db.orders.filter(o=>o.payment==='paid').reduce((a,o)=>a+Number(o.total||0),0);
        app.__edduRealData=true;
        app.__edduV53Ready=true;
        window.__EDDU_PRODUCTION_AUTHORITY=true;
        if(typeof save==='function'&&app.role==='client')save();
        if(typeof safeRender==='function')safeRender();else if(typeof render==='function')render();
        showReal();
        return;
      }catch(e){console.warn('EDDU V53 hydration',e)}
    }
    await wait(100);
  }
  showReal();
}
function patchDashboard(){
  if(typeof dashboard!=='function'||dashboard.__v53)return;
  const realDashboard=function(){
    const paid=(db.orders||[]).filter(o=>o.payment==='paid');
    const revenue=paid.reduce((a,o)=>a+Number(o.total||0),0);
    const variable=paid.reduce((a,o)=>a+Number(o.cost||0),0);
    const fixed=Number(db.fixedCosts||0);
    const costs=variable+fixed;
    const profit=revenue-costs;
    const open=(db.orders||[]).filter(o=>o.payment!=='paid'&&o.status==='open').length;
    const waiting=(db.orders||[]).filter(o=>o.payment!=='paid'&&o.status==='closed').length;
    return `<div class=content><div class=page-head><div><h1>Dashboard</h1><p>Visão real do salão, sincronizada com o banco de dados.</p></div><span class=badge ok>● Dados reais</span></div><div class=grid4><div class="card metric"><small>Faturamento recebido</small><strong>${money(revenue)}</strong><span class=muted>${paid.length} comanda(s) paga(s)</span></div><div class="card metric"><small>Custos registrados</small><strong>${money(costs)}</strong><span class=muted>custos das comandas + fixos cadastrados</span></div><div class="card metric"><small>Lucro registrado</small><strong>${money(profit)}</strong><span class=muted>receita menos custos registrados</span></div><div class="card metric"><small>Comandas pendentes</small><strong>${open+waiting}</strong><span class=muted>${open} em aberto • ${waiting} aguardando pagamento</span></div></div><br><div class=grid2><div class=card><h2>Comandas</h2><div class=summary><div class=summary-row><span>Em aberto</span><b>${open}</b></div><div class=summary-row><span>Aguardando pagamento</span><b>${waiting}</b></div><div class=summary-row><span>Pagas</span><b>${paid.length}</b></div><div class="summary-row total"><span>Total de comandas</span><b>${(db.orders||[]).length}</b></div></div><br><button class="btn primary" onclick="go('orders')">Abrir comandas</button></div><div class=card><h2>Próximos atendimentos</h2>${(db.requests||[]).filter(r=>r.status!=='Cancelado').slice(0,5).map(r=>`<div class=event><div><b>${esc(r.client||'Cliente')}</b><small>${esc(r.date||'')} • ${esc(r.time||'')} • ${esc(r.service||'Atendimento')}</small></div><span class=badge>${esc(r.status||'Pendente')}</span></div>`).join('')||'<div class=empty>Nenhum atendimento cadastrado.</div>'}</div></div></div>`;
  };
  realDashboard.__v53=true;dashboard=realDashboard;window.dashboard=realDashboard;
}
function patchFinance(){
  if(typeof financeOverview!=='function'||financeOverview.__v53)return;
  const realFinance=function(){const paid=(db.orders||[]).filter(o=>o.payment==='paid');const revenue=paid.reduce((a,o)=>a+Number(o.total||0),0);const variable=paid.reduce((a,o)=>a+Number(o.cost||0),0);const fixed=Number(db.fixedCosts||0);const cost=variable+fixed;const profit=revenue-cost;const p=db.payables||[],r=db.receivables||[];const pm=p.filter(x=>x.status!=='paid'&&monthKey(x.dueDate)===currentMonth()).reduce((a,x)=>a+Number(x.value||0),0);const rm=r.filter(x=>x.status!=='received'&&monthKey(x.dueDate)===currentMonth()).reduce((a,x)=>a+Number(x.value||0),0);return `<div class=mini-kpis><div class=mini-kpi><small>Faturamento recebido</small><b>${money(revenue)}</b></div><div class=mini-kpi><small>Custos registrados</small><b>${money(cost)}</b></div><div class=mini-kpi><small>A pagar — este mês</small><b>${money(pm)}</b></div><div class=mini-kpi><small>A receber — este mês</small><b>${money(rm)}</b></div></div><br><div class=grid2><div class=card><h2>Resultado real</h2><div class=summary><div class=summary-row><span>Faturamento</span><b>${money(revenue)}</b></div><div class=summary-row><span>Custos</span><b>${money(cost)}</b></div><div class="summary-row total"><span>Lucro registrado</span><b>${money(profit)}</b></div><div class=summary-row><span>Margem</span><b>${(profit/Math.max(1,revenue)*100).toFixed(1)}%</b></div></div></div><div class=card><h2>Contas</h2><p class=muted>Os lançamentos de contas permanecem disponíveis para cadastro, edição, conclusão, exclusão e exportação.</p><div class=actions><button class="btn" onclick="setFinanceTab('payables')">Contas a pagar</button><button class="btn primary" onclick="setFinanceTab('receivables')">Contas a receber</button></div></div></div>`};
  realFinance.__v53=true;financeOverview=realFinance;window.financeOverview=realFinance;
}
function patchMode(){const old=window.pro; if(typeof old==='function'&&!old.__v53){const original=old;const f=function(){const r=original.apply(this,arguments);document.querySelectorAll('.online').forEach(x=>x.innerHTML='<i class=dot></i>Dados sincronizados');return r};f.__v53=true;window.pro=f;pro=f}}
async function init(){for(let i=0;i<40;i++){if(typeof dashboard==='function'){patchDashboard();patchFinance();patchMode();break}await wait(100)}boot()}
init();
})();
