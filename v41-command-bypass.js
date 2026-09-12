/* V41 — command/payment bypass. Uses Supabase directly and blocks legacy renderers only on protected screens. */
(function(){
 const wait=(fn,n=0)=>{if(window.__EDDU_SB&&typeof app!=='undefined'&&document.getElementById('root'))fn();else if(n<300)setTimeout(()=>wait(fn,n+1),200)};
 const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
 const id=v=>JSON.stringify(String(v));
 const isPro=()=>app.role==='pro';
 const protectedPage=()=>isPro()?app.page==='orders':app.clientPage==='payments';
 const serviceName=(item,services)=>item?.description||services.find(s=>String(s.id)===String(item?.service_id))?.name||'Serviço';
 async function data(){
  const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.(); if(!sb||!u) return null;
  const [c,i,s,p,m]=await Promise.all([
   sb.from('commands').select('*').order('created_at',{ascending:false}),
   sb.from('command_items').select('*'),
   sb.from('services').select('id,name,price_base,price_long').eq('active',true),
   sb.from('clients').select('id,user_id,name,email,phone'),
   sb.from('professionals').select('id,name').eq('active',true)
  ]);
  if(c.error) throw c.error;
  return {commands:c.data||[],items:i.data||[],services:s.data||[],clients:p.data||[],pros:m.data||[],user:u};
 }
 function commandHtml(d){
  const rows=d.commands.map(o=>{const items=d.items.filter(x=>String(x.command_id)===String(o.id)); if(!items.length)return ''; const client=d.clients.find(c=>String(c.id)===String(o.client_id)); const pro=d.pros.find(p=>String(p.id)===String(o.professional_id)); const total=Number(o.total??o.subtotal??0); return `<div class="card" style="margin:12px 0"><div class="page-head"><div><h3>${esc(client?.name||'Cliente')}</h3><span class="muted">${esc(pro?.name||'Profissional não definido')}</span></div><strong class="money">${money(total)}</strong></div><div style="margin:8px 0 14px">${items.map(x=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)"><span>${esc(serviceName(x,d.services))} × ${Number(x.quantity||1)}</span><b>${money(Number(x.unit_price||0)*Number(x.quantity||1))}</b></div>`).join('')}</div><div class="summary"><div class="summary-row"><span>Status</span><b>${o.status==='open'?'EM ABERTO':o.status==='closed'?'FECHADA':esc(o.status)}</b></div><div class="summary-row"><span>Total</span><b>${money(total)}</b></div></div></div>`}).join('');
  return `<div class="content"><div class="page-head"><div><h1>Comandas</h1><p>Atendimentos registrados no banco de dados.</p></div></div><div class="grid3"><div class="card"><div class="eyebrow">Total</div><strong style="font-size:28px">${d.commands.filter(o=>d.items.some(x=>String(x.command_id)===String(o.id))).length}</strong></div><div class="card"><div class="eyebrow">Em aberto</div><strong style="font-size:28px">${d.commands.filter(o=>o.status==='open'&&d.items.some(x=>String(x.command_id)===String(o.id))).length}</strong></div><div class="card"><div class="eyebrow">Fechadas</div><strong style="font-size:28px">${d.commands.filter(o=>o.status!=='open'&&d.items.some(x=>String(x.command_id)===String(o.id))).length}</strong></div></div><br><div class="card"><h2>COMANDAS REGISTRADAS</h2>${rows||'<div class="empty">Nenhuma comanda encontrada.</div>'}</div></div>`;
 }
 function clientHtml(d){const c=d.clients.find(x=>String(x.user_id)===String(d.user.id));const list=d.commands.filter(o=>c&&String(o.client_id)===String(c.id)&&d.items.some(x=>String(x.command_id)===String(o.id)));return `${typeof header==='function'?header():''}<main><div class="client-shell"><div class="page-head"><div><h1>Pagamentos</h1><p>Suas comandas e respectivos valores.</p></div></div>${list.map(o=>{const its=d.items.filter(x=>String(x.command_id)===String(o.id));return `<div class="card" style="margin:12px 0"><div class="page-head"><div><h2>Comanda</h2><span class="badge ${o.status==='open'?'warn':'ok'}">${o.status==='open'?'Em aberto':'Fechada'}</span></div><strong class="money" style="font-size:24px">${money(o.total??o.subtotal)}</strong></div><p>${its.map(x=>esc(serviceName(x,d.services))).join(' • ')}</p></div>`}).join('')||'<div class="card"><p class="muted">Nenhuma comanda encontrada para este cliente.</p></div>'}</div></main>${typeof clientBottom==='function'?clientBottom():''}`}
 async function renderPro(){try{const d=await data();if(!d)return;app.role='pro';app.page='orders';document.getElementById('root').innerHTML=typeof header==='function'?header()+`<div class="layout"><aside class="sidebar"><div class="side-title">Gestão do salão</div><button class="nav-item active">▤ Comandas</button></aside><main>${commandHtml(d)}</main></div>`:commandHtml(d)}catch(e){console.error('EDDU V41',e)}}
 async function renderClient(){try{const d=await data();if(!d)return;app.clientPage='payments';document.getElementById('root').innerHTML=clientHtml(d)}catch(e){console.error('EDDU V41',e)}}
 wait(()=>{
  const oldRender=window.render,oldSafe=window.safeRender,oldGo=window.go,oldCgo=window.cgo;
  window.EDDU_COMMAND_BYPASS={renderPro,renderClient,data};
  window.render=function(){if(protectedPage())return;return typeof oldRender==='function'?oldRender.apply(this,arguments):undefined};
  if(typeof oldSafe==='function')window.safeRender=function(){if(protectedPage())return;return oldSafe.apply(this,arguments)};
  window.go=function(p){if(p==='orders'){app.page='orders';renderPro();return} if(typeof oldGo==='function')return oldGo.apply(this,arguments)};
  window.cgo=function(p){if(p==='payments'){app.clientPage='payments';renderClient();return} if(typeof oldCgo==='function')return oldCgo.apply(this,arguments)};
  document.addEventListener('click',ev=>{const b=ev.target?.closest?.('button');if(!b)return;const t=(b.textContent||'').trim().toLowerCase();if(isPro()&&t.includes('comandas')){ev.preventDefault();ev.stopImmediatePropagation();app.page='orders';renderPro()}else if(!isPro()&&(t==='pagamentos'||t==='meus pagamentos')){ev.preventDefault();ev.stopImmediatePropagation();app.clientPage='payments';renderClient()}},true);
  const mo=new MutationObserver(()=>{if(!protectedPage())return;const r=document.getElementById('root');if(!r)return;const good=isPro()?r.querySelector('h1')?.textContent?.trim()==='Comandas':r.querySelector('h1')?.textContent?.trim()==='Pagamentos';if(!good){if(isPro())renderPro();else renderClient()}});mo.observe(document.getElementById('root'),{childList:true,subtree:true});
  setTimeout(()=>{if(isPro()&&app.page==='orders')renderPro();if(!isPro()&&app.clientPage==='payments')renderClient()},300);
 });
})();
