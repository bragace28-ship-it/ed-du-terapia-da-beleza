/* V37 — runtime repair for Comandas. Reads the authenticated user's commands directly and forces the Comandas renderer to use the recovered list. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&typeof db!=='undefined'&&typeof app!=='undefined')fn();else if(n<240)setTimeout(()=>wait(fn,n+1),250)};
  const esc0=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const money0=v=>typeof window.money==='function'?window.money(Number(v||0)):('R$ '+Number(v||0).toFixed(2).replace('.',','));
  const idArg=id=>JSON.stringify(String(id));
  function serviceName(i){
    const id=String(i?.dbServiceId||i?.serviceId||'');
    const local=(window.SERVICES||[]).find(s=>String(s.dbId||'')===id||String(s.id||'')===id);
    return i?.description||local?.n||local?.name||'Serviço';
  }
  async function loadDirect(){
    const sb=window.__EDDU_SB;if(!sb)return false;
    const sess=await sb.auth.getSession();const u=sess?.data?.session?.user;if(!u)return false;
    const [cmd,ci,sv,cl,pr,cp,pm]=await Promise.all([
      sb.from('commands').select('*').order('created_at',{ascending:false}),
      sb.from('command_items').select('*'),
      sb.from('services').select('id,name,price_base,price_long,service_cost,duration_minutes').eq('active',true),
      sb.from('clients').select('id,user_id,name,email,phone'),
      sb.from('professionals').select('id,name').eq('active',true).in('name',['ED','DU']),
      sb.from('command_payments').select('*').order('paid_at',{ascending:false}),
      sb.from('payment_methods').select('id,name').eq('active',true)
    ]);
    if(cmd.error) throw cmd.error;
    const clients=cl.data||[];const pros=pr.data||[];const services=sv.data||[];const items=ci.data||[];const pays=cp.data||[];
    const visible=cmd.data||[];
    const serviceFor=id=>services.find(s=>String(s.id)===String(id));
    db.orders=visible.map(o=>{
      const lines=items.filter(x=>String(x.command_id)===String(o.id));
      const paid=pays.filter(x=>String(x.command_id)===String(o.id));
      return {id:o.id,clientId:o.client_id,client:clients.find(c=>String(c.id)===String(o.client_id))?.name||'Cliente',professionalId:o.professional_id,prof:pros.find(p=>String(p.id)===String(o.professional_id))?.name||'',status:o.status,open:o.status==='open',openedAt:o.opened_at,closedAt:o.closed_at,discount:Number(o.discount||0),payment:paid.length?'paid':'pending',paymentMethod:paid[0]?((pm.data||[]).find(m=>String(m.id)===String(paid[0].payment_method_id))?.name||''):'',items:lines.map(x=>{const s=serviceFor(x.service_id);return {serviceId:s?.id||x.service_id,dbServiceId:x.service_id,length:s&&Number(x.unit_price)===Number(s.price_long)?'long':'base',qty:Number(x.quantity||1),unitPrice:Number(x.unit_price||0),unitCost:Number(x.unit_cost||0),description:x.description||s?.name||'Serviço'}}),subtotal:Number(o.subtotal||0),total:Number(o.total||0),cost:Number(o.total_cost||0),commission:Number(o.commission||0),profit:Number(o.profit||0),__real:true,__dbItemsSynced:true};
    });
    app.__edduV37Loaded=true;
    window.__EDDU_V37_LAST_USER=u.id;
    if(typeof window.safeRender==='function') window.safeRender();
    return true;
  }
  function card(o){
    const total=Number(o.total||o.subtotal||0);const oid=idArg(o.id);
    return `<div class="card" style="margin:10px 0;background:#fbfaf8"><div class="page-head" style="margin-bottom:8px"><div><h3>${esc0(o.client||'Cliente')} <span class="badge ${o.open?'warn':o.payment==='paid'?'ok':'warn'}">${o.open?'EM ABERTO':o.payment==='paid'?'PAGO':'AGUARDANDO PAGAMENTO'}</span></h3><span class="muted">${esc0(o.prof||'')}</span></div><strong class="money">${money0(total)}</strong></div><div class="grid4"><div><small class="muted">Serviços</small><br><b>${(o.items||[]).map(serviceName).join(' • ')||'Serviço'}</b></div><div><small class="muted">Subtotal</small><br><b>${money0(o.subtotal)}</b></div><div><small class="muted">Custo</small><br><b>${money0(o.cost)}</b></div><div><small class="muted">Lucro</small><br><b>${money0(o.profit)}</b></div></div><br><div class="actions"><button class="btn" onclick="viewOrder(${oid})">Visualizar comanda</button><button class="btn" onclick="openOrder(${oid})">Editar comanda</button>${o.open?`<button class="btn primary" onclick="closeOrder(${oid})">Fechar comanda e escolher pagamento</button>`:o.payment!=='paid'?`<button class="btn warn" onclick="openPaymentModal(${oid})">Receber pagamento</button>`:''}</div></div>`;
  }
  function renderCommands(){
    const all=Array.isArray(db.orders)?db.orders.filter(o=>o&&o.id):[];const open=all.filter(o=>o.open),pending=all.filter(o=>!o.open&&o.payment!=='paid'),paid=all.filter(o=>!o.open&&o.payment==='paid');
    return `<div class="content"><div class="page-head"><div><h1>Comandas</h1><p>Comandas reais sincronizadas com o banco de dados.</p></div><button class="btn primary" onclick="newOrder()">+ Abrir comanda</button></div><div class="grid3"><div class="card"><div class="eyebrow">Em aberto</div><strong style="font-size:28px">${open.length}</strong><p class="muted">Atendimentos em andamento</p></div><div class="card"><div class="eyebrow">Aguardando pagamento</div><strong style="font-size:28px">${pending.length}</strong><p class="muted">Comandas fechadas</p></div><div class="card"><div class="eyebrow">Pagas</div><strong style="font-size:28px">${paid.length}</strong><p class="muted">Histórico concluído</p></div></div><br><div class="card"><h2>COMANDAS</h2>${all.length?all.map(card).join(''):'<div class="empty">Nenhuma comanda encontrada para esta conta.</div>'}</div></div>`;
  }
  wait(()=>{
    let originalRender=window.render;
    const install=()=>{
      if(typeof window.render==='function'&&!window.render.__edduV37){originalRender=window.render;const w=function(){if(app.page==='orders'){return renderCommands()}return originalRender.apply(this,arguments)};w.__edduV37=true;window.render=w;}
    };
    install();
    window.EDDU_COMMAND_RUNTIME_REPAIR={loadDirect,renderCommands};
    const run=async()=>{try{await loadDirect();install()}catch(e){console.error('EDDU V37 command runtime',e)}};
    run();
    setTimeout(run,1200);setTimeout(run,3500);setTimeout(7000&&run,7000);
  });
})();
