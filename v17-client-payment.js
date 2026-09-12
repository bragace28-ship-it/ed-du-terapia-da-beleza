/* V17.3 — client payment bridge. Client never calls staff-only finalize_command. */
(function(){
 const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
 async function pay(order,method,amount,reference){
  const sb=window.__EDDU_SB;if(!sb||!order?.id)throw new Error('Comanda não sincronizada');
  if(!method)throw new Error('Selecione a forma de pagamento');
  const pm=await sb.from('payment_methods').select('id,name').eq('active',true).eq('name',method).maybeSingle();
  if(pm.error||!pm.data)throw(pm.error||new Error('Forma de pagamento não liberada'));
  const r=await sb.rpc('pay_command_as_client',{p_command_id:order.id,p_payment_method_id:pm.data.id,p_amount:Number(amount||0),p_reference:reference||null});
  if(r.error)throw r.error;
  window.EDDU_CLIENT_PAYMENT=r.data;return r.data;
 }
 window.EDDU_CLIENT_PAYMENT_API={pay};
 wait(()=>{
  const original=window.finishClientPayment;
  if(typeof original!=='function'||original.__v173)return;
  const w=async function(){
   if(app?.role!=='client')return original.apply(this,arguments);
   const order=db?.orders?.find(x=>x.id===app?.editingOrder);
   if(!order)return original.apply(this,arguments);
   const method=order.paymentMethod||order.method;
   const total=typeof orderCalc==='function'?(orderCalc(order).net||order.total||0):(order.total||0);
   try{
    await pay(order,method,total,null);
    if(typeof safeRender==='function')safeRender();
    return;
   }catch(e){
    console.warn('EDDU client payment',e);
    if(typeof toast==='function')toast(e.message||'Não foi possível registrar o pagamento');
    return;
   }
  };
  w.__v173=true;window.finishClientPayment=w;
 });

 /* V19 client profile/records fixes. */
 const currentClient=()=>{const u=window.EDDU_AUTH?.getUser?.();return (db?.clients||[]).find(c=>u&&c.user_id===u.id)||db?.clients?.[0]||null};
 window.clientHome=function(){const c=currentClient()||{name:'Cliente',points:0};return `${header()}<main><div class=client-shell><section class=client-welcome><img class=client-logo src="${SALON_LOGO}" alt="ED & DU Terapia da Beleza"><h1>${esc(c.name||'Cliente')}</h1><p class=muted>Bem-vinda à sua área exclusiva.</p><div class=loyalty-card><div class=loyalty-points-label><span>Pontos fidelidade</span><span aria-hidden=true>✦</span></div><strong>${Number(c.points||0)}</strong><div class=points-progress><i></i></div><small>Seu saldo de benefícios no ED & DU</small></div></section><div class=client-nav><button class="btn primary" onclick="cgo('book')">+ Agendar</button><button class=btn onclick="cgo('appointments')">Meus agendamentos</button><button class=btn onclick="cgo('payments')">Pagamentos</button><button class=btn onclick="cgo('docs')">Documentos</button></div><div class=card><h2>Agende seu próximo momento</h2><p class=muted>Você pode combinar vários serviços no mesmo atendimento.</p><div class=service-grid>${SERVICES.map(s=>`<div class=service-card onclick="addBookingService(${s.id})"><div class=service-art>${s.icon}</div><div class=service-body><b>${s.n}</b><small>A partir de ${money(s.base)}</small></div></div>`).join('')}</div></div></div></main>${clientBottom()}`};
 window.clientDocs=function(){const c=currentClient()||{term:false};return `${header()}<main><div class=client-shell><div class=page-head><div><h1>Documentos</h1><p>Leia e registre seu aceite antes de procedimentos de risco.</p></div></div><div class=card><h2>Termo de responsabilidade</h2><p class=muted>Termo de Avaliação Técnica e Ciência de Risco Procedimental.</p><div class=summary><b>${c.term?'✓ Termo já aceito':'Aceite pendente'}</b>${c.termAcceptedAt?`<div class=muted>Aceito em ${esc(c.termAcceptedAt)}</div>`:''}</div><br><button class=btn onclick="openTerm()">Ler termo completo</button><br><br><label><input type=checkbox id=termcheck> Li e estou de acordo</label><br><br><button class="btn primary" onclick="acceptTerm()">Dar meu acordo</button></div></div></main>${clientBottom()}`};
 window.clientAppointments=function(){const c=currentClient(),r=(db.requests||[]).filter(x=>!c||String(x.clientId)===String(c.id)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0]||null;return `${header()}<main><div class=client-shell><div class=page-head><div><h1>Meus agendamentos</h1><p>Acompanhe seu atendimento.</p></div></div><div class=card>${r?`<h2>${esc(r.client)}</h2><p>${esc(r.prof||'')} • ${esc(r.date||'').split('-').reverse().join('/')} • ${esc(r.time||'')}</p><div class=service-chips>${(r.services||[{name:r.service}]).map(s=>`<span class=badge>${esc(s.name||s.service||'Serviço')}</span>`).join(' ')}</div><br><span class="badge ${r.status==='Aprovado'?'ok':'warn'}">${esc(r.status||'Pendente')}</span><br><br><div class=actions><button class=btn onclick="cgo('book')">Alterar agendamento</button><button class="btn danger" onclick="toast('Solicitação de cancelamento registrada.')">Solicitar cancelamento</button></div>`:'<p class=muted>Nenhum agendamento encontrado.</p>'}</div></div></main>${clientBottom()}`};
 window.clientPayments=function(){const c=currentClient(),list=(db.orders||[]).filter(o=>!c||String(o.clientId)===String(c.id));return `${header()}<main><div class=client-shell><div class=page-head><div><h1>Pagamentos</h1><p>Confira suas comandas e pague quando o salão liberar o pagamento.</p></div></div>${list.length?list.map(o=>{const x=orderCalc(o),status=o.payment==='paid'?'Pago':o.payment==='pending'?'Aguardando pagamento':'Em aberto';return `<div class="card payment-card" style="margin-bottom:12px"><div class=payment-hero><small>Total da comanda</small><strong>${money(x.net)}</strong></div><br><div class=page-head style="margin-bottom:8px"><div><h2>${esc(o.client||'Atendimento')}</h2><span class="badge ${o.payment==='paid'?'ok':'warn'}">${status}</span></div></div><p class=muted>${(o.items||[]).map(i=>svc(i.serviceId)?.n).filter(Boolean).join(' • ')||'Serviços não informados'}</p><div class=summary><div class=summary-row><span>Desconto</span><b>${money(x.discount)}</b></div><div class=summary-row><span>Fidelidade</span><b>${Math.floor(x.net/10)} pts</b></div></div><br><div class=command-actions><button class="btn outline" onclick="viewClientOrder(${JSON.stringify(String(o.id))})">Ver comanda</button>${o.payment!=='paid'&&o.status!=='open'?'<button class="btn primary" onclick="clientPayOrder('+JSON.stringify(String(o.id))+')">Pagar agora</button>':''}</div></div>`}).join(''):'<div class=card><p class=muted>Nenhuma comanda disponível para pagamento.</p></div>'}</div></main>${clientBottom()}`};
 const originalSubmit=window.submitBooking;
 window.submitBooking=function(){if(!booking.items?.length||!booking.prof||!booking.date||!booking.time){toast('Adicione serviços e complete profissional, data e hora.');return}const c=currentClient();if(!c){toast('Seu cadastro ainda não foi sincronizado.');return}const first=svc(booking.items[0].serviceId);db.requests.unshift({id:Date.now(),clientId:c.id,client:c.name,serviceId:first.id,service:first.n,services:booking.items.map(i=>({...i,name:svc(i.serviceId).n})),prof:booking.prof,date:booking.date,time:booking.time,status:'Pendente'});save();toast('Solicitação enviada com todos os serviços.');app.clientPage='appointments';render();};
})();