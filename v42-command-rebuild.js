/* V42 — definitive command screen rebuild. Auth-aware, Supabase-direct, no legacy renderer dependency. */
(function(){
  'use strict';
  const MAX=180;
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
  let installed=false, rendering=false;

  async function getUser(){
    const sb=window.__EDDU_SB;
    if(!sb?.auth)return null;
    try{const r=await sb.auth.getSession();return r?.data?.session?.user||null}catch(e){return null}
  }
  async function waitReady(n=0){
    while(n<MAX){
      if(window.__EDDU_SB&&typeof window.app!=='undefined'&&document.getElementById('root')){
        const u=await getUser(); if(u)return u;
      }
      await sleep(250);n++;
    }
    return null;
  }
  async function fetchData(){
    const sb=window.__EDDU_SB,u=await getUser();
    if(!sb||!u)throw new Error('Sessão Supabase ainda não disponível.');
    const results=await Promise.all([
      sb.from('commands').select('id,client_id,professional_id,status,opened_at,closed_at,subtotal,discount,total,total_cost,commission,profit,created_at,updated_at').order('created_at',{ascending:false}),
      sb.from('command_items').select('id,command_id,service_id,description,quantity,unit_price,unit_cost,commission'),
      sb.from('clients').select('id,user_id,name,email,phone'),
      sb.from('services').select('id,name,price_base,price_long').eq('active',true),
      sb.from('professionals').select('id,user_id,name').eq('active',true)
    ]);
    const [commands,items,clients,services,pros]=results;
    if(commands.error)throw new Error('Comandas: '+commands.error.message);
    if(items.error)throw new Error('Itens das comandas: '+items.error.message);
    return {user:u,commands:commands.data||[],items:items.data||[],clients:clients.data||[],services:services.data||[],pros:pros.data||[]};
  }
  function valid(d,o){return d.items.some(i=>String(i.command_id)===String(o.id))}
  function itemName(d,i){return i.description||d.services.find(s=>String(s.id)===String(i.service_id))?.name||'Serviço'}
  function commandCard(d,o){
    const c=d.clients.find(x=>String(x.id)===String(o.client_id));
    const p=d.pros.find(x=>String(x.id)===String(o.professional_id));
    const its=d.items.filter(x=>String(x.command_id)===String(o.id));
    const total=Number(o.total??o.subtotal??0);
    return `<article class="card" style="margin:12px 0;border:1px solid var(--line)">
      <div class="page-head" style="margin-bottom:10px"><div><h3 style="margin:0">${esc(c?.name||'Cliente')}</h3><span class="muted">${esc(p?.name||'Profissional não definido')}</span></div><strong class="money" style="font-size:20px">${money(total)}</strong></div>
      <div>${its.map(i=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)"><span>${esc(itemName(d,i))} × ${Number(i.quantity||1)}</span><b>${money(Number(i.unit_price||0)*Number(i.quantity||1))}</b></div>`).join('')}</div>
      <div class="summary" style="margin-top:12px"><div class="summary-row"><span>Status</span><b>${o.status==='open'?'EM ABERTO':o.status==='closed'?'FECHADA':esc(o.status||'—')}</b></div><div class="summary-row"><span>Total</span><b>${money(total)}</b></div></div>
    </article>`;
  }
  function proHtml(d){
    const rows=d.commands.filter(o=>valid(d,o));
    const open=rows.filter(o=>o.status==='open').length;
    const closed=rows.filter(o=>o.status!=='open').length;
    return `<div class="content" data-eddu-screen="commands-v42"><div class="page-head"><div><h1>Comandas</h1><p>Comandas recuperadas diretamente do banco de dados.</p></div><span class="badge ok">${rows.length} registrada(s)</span></div><div class="grid3"><div class="card"><div class="eyebrow">Total</div><strong style="font-size:28px">${rows.length}</strong></div><div class="card"><div class="eyebrow">Em aberto</div><strong style="font-size:28px">${open}</strong></div><div class="card"><div class="eyebrow">Fechadas</div><strong style="font-size:28px">${closed}</strong></div></div><br><div class="card"><h2>COMANDAS</h2>${rows.map(o=>commandCard(d,o)).join('')||'<div class="empty">Nenhuma comanda com itens foi encontrada.</div>'}</div></div>`;
  }
  function clientHtml(d){
    const c=d.clients.find(x=>String(x.user_id)===String(d.user.id));
    const rows=d.commands.filter(o=>c&&String(o.client_id)===String(c.id)&&valid(d,o));
    return `<main data-eddu-screen="payments-v42"><div class="client-shell"><div class="page-head"><div><h1>Pagamentos</h1><p>Suas comandas recuperadas diretamente do banco de dados.</p></div></div>${rows.map(o=>commandCard(d,o)).join('')||'<div class="card"><p class="muted">Nenhuma comanda encontrada para este cliente.</p></div>'}</div></main>`;
  }
  async function renderPro(){
    if(rendering)return;rendering=true;
    try{const d=await fetchData();window.app.role='pro';window.app.page='orders';const root=document.getElementById('root');if(root)root.innerHTML=`${typeof header==='function'?header():''}<div class="layout"><aside class="sidebar"><div class="side-title">Gestão do salão</div><button class="nav-item active" data-eddu-v42="orders">▤ Comandas</button></aside><main>${proHtml(d)}</main></div>`}
    catch(e){console.error(e);const root=document.getElementById('root');if(root)root.innerHTML=`<div class="content"><div class="card"><h1>Comandas</h1><p>Não foi possível carregar as comandas.</p><p class="muted">${esc(e.message)}</p><button class="btn primary" onclick="EDDU_V42.retry()">Tentar novamente</button></div></div>`}
    finally{rendering=false}
  }
  async function renderClient(){
    if(rendering)return;rendering=true;
    try{const d=await fetchData();window.app.clientPage='payments';const root=document.getElementById('root');if(root)root.innerHTML=`${typeof header==='function'?header():''}${clientHtml(d)}${typeof clientBottom==='function'?clientBottom():''}`}
    catch(e){console.error(e)} finally{rendering=false}
  }
  function install(){
    if(installed)return;installed=true;
    const oldGo=window.go,oldCgo=window.cgo,oldRender=window.render,oldSafe=window.safeRender;
    window.EDDU_V42={renderPro,renderClient,retry:()=>renderPro(),fetchData};
    window.go=function(p){if(p==='orders'){renderPro();return}return typeof oldGo==='function'?oldGo.apply(this,arguments):undefined};
    window.cgo=function(p){if(p==='payments'){renderClient();return}return typeof oldCgo==='function'?oldCgo.apply(this,arguments):undefined};
    window.render=function(){if(window.app?.page==='orders'){renderPro();return}if(window.app?.clientPage==='payments'&&window.app?.role==='client'){renderClient();return}return typeof oldRender==='function'?oldRender.apply(this,arguments):undefined};
    if(typeof oldSafe==='function')window.safeRender=function(){if(window.app?.page==='orders'||(window.app?.clientPage==='payments'&&window.app?.role==='client'))return;return oldSafe.apply(this,arguments)};
    document.addEventListener('click',ev=>{
      const b=ev.target?.closest?.('button');if(!b)return;
      const t=(b.textContent||'').trim().toLowerCase();
      if(t.includes('comandas')){ev.preventDefault();ev.stopImmediatePropagation();renderPro()}
      else if(t==='pagamentos'||t==='meus pagamentos'){ev.preventDefault();ev.stopImmediatePropagation();renderClient()}
    },true);
  }
  (async()=>{
    const u=await waitReady();
    if(!u){console.error('EDDU V42: aplicação não ficou pronta');return}
    install();
    if(window.app.page==='orders')renderPro();
    if(window.app.clientPage==='payments'&&window.app.role==='client')renderClient();
  })();
})();
