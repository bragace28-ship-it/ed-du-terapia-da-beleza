/* V41 — standalone command center. It does not use db.orders or legacy command renderers. */
(function(){
'use strict';
const wait=(fn,n=0)=>{if(window.__EDDU_SB&&document.getElementById('root'))fn();else if(n<240)setTimeout(()=>wait(fn,n+1),250)};
const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
const id=v=>String(v??'');
let data={commands:[],items:[],clients:[],pros:[],services:[],payments:[],methods:[]};
let screen=null;
async function load(){
 const sb=window.__EDDU_SB;if(!sb)return false;
 const u=(await sb.auth.getUser()).data?.user;if(!u)return false;
 const qs=await Promise.all([
  sb.from('commands').select('*').order('created_at',{ascending:false}),
  sb.from('command_items').select('*'),
  sb.from('clients').select('id,user_id,name,email,phone'),
  sb.from('professionals').select('id,user_id,name').eq('active',true),
  sb.from('services').select('id,name,price_base,price_long').eq('active',true),
  sb.from('command_payments').select('*').order('paid_at',{ascending:false}),
  sb.from('payment_methods').select('id,name').eq('active',true)
 ]);
 const bad=qs.find(x=>x.error);if(bad)throw bad.error;
 data={commands:qs[0].data||[],items:qs[1].data||[],clients:qs[2].data||[],pros:qs[3].data||[],services:qs[4].data||[],payments:qs[5].data||[],methods:qs[6].data||[]};
 const me=data.pros.find(p=>id(p.user_id)===id(u.id));
 app.role=me?'pro':(app.role||'client');
 window.__EDDU_STANDALONE_DATA=data;
 return true;
}
function serviceName(i){return i.description||data.services.find(s=>id(s.id)===id(i.service_id))?.name||'Serviço'}
function commandItems(c){return data.items.filter(i=>id(i.command_id)===id(c.id))}
function clientName(c){return data.clients.find(x=>id(x.id)===id(c.client_id))?.name||'Cliente'}
function proName(c){return data.pros.find(x=>id(x.id)===id(c.professional_id))?.name||'—'}
function paid(c){return data.payments.some(p=>id(p.command_id)===id(c.id))}
function card(c){const its=commandItems(c);return `<div class="card" style="margin:12px 0"><div class="page-head"><div><h3>${esc(clientName(c))}</h3><span class="muted">Profissional: ${esc(proName(c))}</span></div><strong class="money">${money(c.total)}</strong></div><div class="muted">${its.length?its.map(serviceName).join(' • '):'Sem itens'}</div><div style="margin:12px 0"><span class="badge ${c.status==='open'?'warn':paid(c)?'ok':'warn'}">${c.status==='open'?'EM ABERTO':paid(c)?'PAGO':'AGUARDANDO PAGAMENTO'}</span></div><button class="btn primary" onclick="EDDU_V41.open('${esc(c.id)}')">Visualizar comanda</button></div>`}
function proScreen(){const all=data.commands.filter(c=>commandItems(c).length);const op=all.filter(c=>c.status==='open').length;const pend=all.filter(c=>c.status!=='open'&&!paid(c)).length;const pg=all.filter(c=>paid(c)).length;return `<div class="layout"><aside class="sidebar"><div class="side-title">Gestão do salão</div><button class="nav active">▤ Comandas</button><button class="nav" onclick="EDDU_V41.leave('dashboard')">⌂ Início</button><button class="nav" onclick="EDDU_V41.leave('agenda')">▣ Agenda</button><button class="nav" onclick="EDDU_V41.leave('clients')">♙ Clientes</button><button class="nav" onclick="EDDU_V41.leave('finance')">◔ Financeiro</button></aside><main><div class="content"><div class="page-head"><div><h1>Comandas</h1><p>Central de comandas do salão</p></div></div><div class="grid3"><div class="card"><div class="eyebrow">Em aberto</div><strong style="font-size:28px">${op}</strong></div><div class="card"><div class="eyebrow">Aguardando pagamento</div><strong style="font-size:28px">${pend}</strong></div><div class="card"><div class="eyebrow">Pagas</div><strong style="font-size:28px">${pg}</strong></div></div><br><div class="card"><h2>COMANDAS REGISTRADAS</h2>${all.length?all.map(card).join(''):'<div class="empty">Nenhuma comanda encontrada.</div>'}</div></div></main></div>`}
function clientScreen(){const u=window.EDDU_AUTH?.getUser?.();const c=data.clients.find(x=>id(x.user_id)===id(u?.id));const all=data.commands.filter(x=>c&&id(x.client_id)===id(c.id)&&commandItems(x).length);return `<main><div class="client-shell"><div class="page-head"><div><h1>Meus Pagamentos</h1><p>Suas comandas e pagamentos</p></div></div>${all.length?all.map(card).join(''):'<div class="card">Nenhuma comanda encontrada.</div>'}</div></main>`}
function render(){const root=document.getElementById('root');if(!root)return;root.innerHTML=typeof header==='function'?header()+(app.role==='pro'?proScreen():clientScreen()):(app.role==='pro'?proScreen():clientScreen());screen=app.role==='pro'?'pro':'client';}
function open(cid){const c=data.commands.find(x=>id(x.id)===id(cid));if(!c)return;const its=commandItems(c);const old=document.getElementById('eddu-v41-modal');if(old)old.remove();const m=document.createElement('div');m.id='eddu-v41-modal';m.style='position:fixed;inset:0;background:#0008;z-index:999999;display:flex;align-items:center;justify-content:center;padding:18px';m.innerHTML=`<div class="card" style="width:min(650px,100%);max-height:90vh;overflow:auto;background:#fff"><div class="page-head"><div><h2>Comanda</h2><p>${esc(clientName(c))} · ${esc(proName(c))}</p></div><button class="btn" onclick="this.closest('#eddu-v41-modal').remove()">Fechar</button></div><hr><h3>Serviços</h3>${its.map(i=>`<p>${esc(serviceName(i))} — ${money(i.unit_price)} × ${Number(i.quantity||1)}</p>`).join('')||'<p>Sem itens</p>'}<div class="summary"><div class="summary-row"><span>Subtotal</span><b>${money(c.subtotal)}</b></div><div class="summary-row"><span>Desconto</span><b>${money(c.discount)}</b></div><div class="summary-row"><span>Total</span><b>${money(c.total)}</b></div></div></div>`;document.body.appendChild(m)}
function go(p){if(p==='orders'||p==='payments'){app.page=p;load().then(render);return}screen=null;if(typeof window.go==='function'&&window.go!==go)window.go(p)}
wait(()=>{window.EDDU_V41={load,render,open,leave:go};const oldGo=window.go,oldCgo=window.cgo;window.go=function(p){if(p==='orders'){app.page=p;load().then(render)}else if(oldGo)oldGo.call(this,p)};window.cgo=function(p){if(p==='payments'){app.clientPage=p;load().then(render)}else if(oldCgo)oldCgo.call(this,p)};document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;const t=(b.textContent||'').trim().toLowerCase();if(app.role==='pro'&&t.includes('comandas')){e.preventDefault();e.stopImmediatePropagation();app.page='orders';load().then(render)}if(app.role==='client'&&(t==='pagamentos'||t==='meus pagamentos')){e.preventDefault();e.stopImmediatePropagation();app.clientPage='payments';load().then(render)}},true);load().then(()=>{if(app.role==='pro'&&app.page==='orders')render();if(app.role==='client'&&app.clientPage==='payments')render()}).catch(e=>console.error('EDDU V41',e));});
})();
