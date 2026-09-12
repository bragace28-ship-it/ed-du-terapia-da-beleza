/* V18 — real online payment bridge. Stripe is authoritative; UI never marks payment paid by itself. */
(function(){
  const SUPABASE_URL='https://cwdpwfzsasdsetthmpoa.supabase.co';
  const SUPABASE_KEY='sb_publishable_sPtr9cgaWgTAK4ooUkNpxg_5qI2erGj';
  async function createCheckout(commandId){
    const sb=window.__EDDU_SB;
    if(!sb)throw new Error('Conexão segura indisponível');
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Sessão expirada. Entre novamente.');
    const r=await fetch(SUPABASE_URL+'/functions/v1/create-stripe-checkout',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({command_id:commandId})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Não foi possível iniciar o pagamento online');
    return j;
  }
  async function paymentStatus(sessionId){
    if(!sessionId||!window.__EDDU_SB)return null;
    const r=await window.__EDDU_SB.from('payment_sessions').select('id,command_id,status,amount,currency,paid_at,provider_session_id').eq('provider_session_id',sessionId).maybeSingle();
    return r.data||null;
  }
  async function checkReturn(){
    const p=new URLSearchParams(location.search);const sessionId=p.get('session_id');
    if(p.get('payment')!=='success'||!sessionId)return;
    let tries=0;
    const poll=async()=>{
      tries++;const s=await paymentStatus(sessionId);
      if(s?.status==='paid'){
        if(typeof toast==='function')toast('Pagamento confirmado. Comanda quitada.');
        if(typeof safeRender==='function')safeRender();
        return;
      }
      if(tries<12)setTimeout(poll,2500);
      else if(typeof toast==='function')toast('Pagamento recebido. A confirmação bancária ainda está sendo processada.');
    };
    poll();
  }
  function wrapClientPayment(){
    const original=window.finishClientPayment;
    if(typeof original!=='function'||original.__v18RealPayment)return;
    const w=async function(){
      if(app?.role!=='client')return original.apply(this,arguments);
      const order=db?.orders?.find(x=>x.id===app?.editingOrder)||db?.orders?.find(x=>x.open);
      if(!order?.id){if(typeof toast==='function')toast('Comanda ainda não sincronizada.');return;}
      try{
        const checkout=await createCheckout(order.id);
        if(!checkout?.checkout_url)throw new Error('Stripe não retornou o checkout');
        window.location.href=checkout.checkout_url;
      }catch(e){
        console.warn('EDDU real payment',e);
        if(typeof toast==='function')toast(e.message||'Não foi possível iniciar o pagamento');
      }
    };
    w.__v18RealPayment=true;window.finishClientPayment=w;
  }

  /* V19 production fixes: real data only, robust UUID actions, ED/DU professionals and complete signup. */
  const PROD_PROS=['ED','DU'];
  const origin=()=>location.origin||'https://ed-du-terapia-da-belezaa.vercel.app';
  const safeId=id=>JSON.stringify(String(id));
  const clientForCurrentUser=()=>{const u=window.EDDU_AUTH?.getUser?.();return db?.clients?.find(c=>u&&c.user_id===u.id)||db?.clients?.find(c=>String(c.id)===String(app?.selectedClient))||db?.clients?.[0]||null};

  function productionDashboard(){
    const paid=(db.orders||[]).filter(o=>o.payment==='paid'||o.paymentConfirmed);
    const revenue=paid.reduce((a,o)=>a+Number(orderCalc(o).net||0),0);
    const serviceCost=paid.reduce((a,o)=>a+Number(orderCalc(o).cost||0),0);
    const commission=paid.reduce((a,o)=>a+Number(orderCalc(o).commission||0),0);
    const paidOperating=(db.payables||[]).filter(x=>x.status==='paid'&&x.costRecognized!==false).reduce((a,x)=>a+Number(x.value||0),0);
    const costs=serviceCost+commission+paidOperating;
    const profit=revenue-costs;
    const attendance=(db.requests||[]).filter(r=>['Concluído','completed'].includes(r.status)).length||paid.length;
    const ticket=attendance?revenue/attendance:0;
    const pct=revenue?Math.max(0,Math.min(100,profit/revenue*100)):0;
    const next=(db.requests||[]).filter(r=>r.status!=='Cancelado').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
    return `<div class=content><div class=page-head><div><h1>Dashboard</h1><p>Visão geral baseada exclusivamente nos dados reais do salão.</p></div><span class="badge ok">● Sistema operacional</span></div>
    <div class=grid4><div class="card metric"><small>Faturamento mensal</small><strong>${money(revenue)}</strong><span class=muted>dados pagos registrados</span></div>
    <div class="card metric"><small>Custos</small><strong>${money(costs)}</strong><span class=muted>custos e comissões registrados</span></div>
    <div class="card metric"><small>Lucro líquido</small><strong>${money(profit)}</strong><span class=muted>${pct.toFixed(1)}% margem</span></div>
    <div class="card metric"><small>Ticket médio</small><strong>${money(ticket)}</strong><span class=muted>${attendance} atendimento(s)</span></div></div><br>
    ${next?`<div class="card next-att"><div class=page-head><div><div class=eyebrow>PRÓXIMO ATENDIMENTO</div><h2 style="margin:5px 0">${esc(next.client||'Cliente')}</h2><p class=muted style="margin:0">${esc(String(next.date||'').split('-').reverse().join('/'))} • ${esc(next.time||'')} • ${esc(next.service||'Serviço')}</p></div><button class="btn primary" onclick="startFromAgenda(${safeId(next.id)})">▶ Iniciar atendimento</button></div></div><br>`:''}
    <div class=grid2><div class="card bars"><h2>Desempenho mensal</h2><p><span>Faturamento</span><span>${money(revenue)}</span></p><div class=bar><i style="width:${revenue?100:0}%"></i></div><p><span>Custos</span><span>${money(costs)}</span></p><div class=bar><i style="width:${revenue?Math.min(100,costs/revenue*100):0}%"></i></div><p><span>Lucro</span><span>${money(profit)}</span></p><div class=bar><i style="width:${pct}%"></i></div></div>
    <div class=card><h2>Resumo</h2><div style="font-size:40px;font-weight:800">${attendance}</div><div class=muted>atendimentos concluídos</div><br><span class="badge ${revenue?'ok':'warn'}">${revenue?'Dados financeiros registrados':'Ainda sem movimentação financeira'}</span></div></div><br>
    <div class=card><h2>Atalhos</h2><div class=quick><button class=btn onclick="go('requests')"><b>Solicitações</b><span>Ver pedidos pendentes</span></button><button class=btn onclick="go('agenda')"><b>Agenda</b><span>Atendimentos</span></button><button class=btn onclick="go('clients')"><b>Ficha de cliente</b><span>Cadastro e anamnese</span></button><button class=btn onclick="go('orders')"><b>Comandas</b><span>Pagamentos</span></button></div></div></div>`;
  }

  function productionFinanceOverview(){
    const mk=currentMonth(),nm=nextMonth();
    const p=(db.payables||[]).filter(x=>x.status!=='paid'),r=(db.receivables||[]).filter(x=>x.status!=='received');
    const pm=p.filter(x=>monthKey(x.dueDate)===mk).reduce((a,x)=>a+Number(x.value||0),0),pn=p.filter(x=>monthKey(x.dueDate)===nm).reduce((a,x)=>a+Number(x.value||0),0);
    const rm=r.filter(x=>monthKey(x.dueDate)===mk).reduce((a,x)=>a+Number(x.value||0),0),rn=r.filter(x=>monthKey(x.dueDate)===nm).reduce((a,x)=>a+Number(x.value||0),0);
    const paid=(db.orders||[]).filter(o=>o.payment==='paid'||o.paymentConfirmed);const rev=paid.reduce((a,o)=>a+Number(orderCalc(o).net||0),0);const cost=paid.reduce((a,o)=>a+Number(orderCalc(o).cost||0)+Number(orderCalc(o).commission||0),0);const profit=rev-cost;
    return `<div class=mini-kpis><div class=mini-kpi><small>A pagar — este mês</small><b>${money(pm)}</b></div><div class=mini-kpi><small>A receber — este mês</small><b>${money(rm)}</b></div><div class=mini-kpi><small>A pagar — próximo mês</small><b>${money(pn)}</b></div><div class=mini-kpi><small>A receber — próximo mês</small><b>${money(rn)}</b></div></div><br><div class=grid2><div class=card><div class=section-title><div><h2>Vencimentos deste mês</h2><span class=muted>Entradas e saídas previstas</span></div></div>${dueRows([...p.filter(x=>monthKey(x.dueDate)===mk).map(x=>({...x,_type:'pay'})),...r.filter(x=>monthKey(x.dueDate)===mk).map(x=>({...x,_type:'rec'}))].sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||'')),5)}</div><div class=card><h2>Resultado do mês</h2><div class=summary><div class=summary-row><span>Faturamento</span><b>${money(rev)}</b></div><div class=summary-row><span>Custos</span><b>${money(cost)}</b></div><div class=summary-row total><span>Lucro estimado</span><b>${money(profit)}</b></div><div class=summary-row><span>Margem</span><b>${rev?(profit/rev*100).toFixed(1):'0.0'}%</b></div></div></div></div><br>${paymentSettingsCard()}`;
  }

  function productionClientCardList(list){
    return (list||[]).map(c=>{const initials=String(c.name||'Cliente').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();return `<article class=client-card data-client-search="${esc((c.name+' '+c.phone+' '+c.email).toLowerCase())}" data-term="${c.term?'signed':'pending'}"><div class=client-card-head><div class=client-main><div class=client-avatar>${initials}</div><div><h3 style="margin:0">${esc(c.name||'Cliente')}</h3><p class=muted style="margin:3px 0">${esc(c.phone||'Sem WhatsApp')}</p><small class=muted>${esc(c.email||'Sem e-mail')}</small></div></div><span class="badge ${c.term?'ok':'warn'}">${c.term?'Termo ok':'Termo pendente'}</span></div><div class=summary style="margin-top:14px"><div class=summary-row><span>Fidelidade</span><b>${Number(c.points||0)} pts</b></div><div class=summary-row><span>Procedimentos</span><b>${(c.history||[]).length}</b></div></div><div class=client-actions><button class=btn onclick="editClient(${safeId(c.id)})">Editar</button><button class=btn onclick="wa(${JSON.stringify(String(c.phone||''))},${JSON.stringify('Olá '+String(c.name||'Cliente')+', aqui é da ED & DU | Terapia da Beleza.')})">WhatsApp</button><button class="btn primary" onclick="openClientFile(${safeId(c.id)})">Abrir ficha</button></div></article>`}).join('')||'<div class="empty">Nenhum cliente cadastrado.</div>';
  }

  async function productionUpdateClient(id){
    const c=db.clients.find(x=>String(x.id)===String(id));if(!c)return;
    const n=document.getElementById('cn')?.value.trim(),p=document.getElementById('cp')?.value.trim(),e=document.getElementById('ce')?.value.trim();
    if(!n||!p){toast('Nome e WhatsApp são obrigatórios.');return}
    c.name=n;c.phone=p;c.email=e;
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();
    if(sb&&u&&String(id).includes('-')){const r=await sb.from('clients').update({name:n,phone:p,email:e||null}).eq('id',id);if(r.error){toast('Não foi possível salvar no banco.');return}await sb.from('profiles').update({full_name:n,phone:p}).eq('id',c.user_id||u.id)}
    save();closeModal();toast('Cadastro atualizado.');safeRender();
  }

  function productionEditClient(id){const c=db.clients.find(x=>String(x.id)===String(id));if(!c){toast('Cliente não encontrado.');return}showModal('Editar dados cadastrais',clientForm(c,'edit').replace('updateClient('+c.id+')','productionUpdateClient('+JSON.stringify(String(c.id))+')'));}

  function productionClientFile(id){
    const c=db.clients.find(x=>String(x.id)===String(id));if(!c){toast('Cliente não encontrado.');return}app.selectedClient=id;
    showModal('Ficha do Cliente',`<div class=actions><button class=btn onclick="productionEditClient(${safeId(id)})">Editar cadastro</button><button class=btn onclick="wa(${JSON.stringify(String(c.phone||''))},${JSON.stringify('Olá '+String(c.name||'Cliente')+', tudo bem? Aqui é da ED & DU | Terapia da Beleza.')})">WhatsApp</button><button class="btn primary" onclick="sendTerm(${safeId(id)})">Enviar Termo de Responsabilidade</button></div><br><div class=grid2><div class=card><h3>Dados pessoais</h3><p><b>${esc(c.name||'Cliente')}</b><br>${esc(c.phone||'Sem WhatsApp')}<br>${esc(c.email||'Sem e-mail')}</p><span class="badge ok">${Number(c.points||0)} pontos</span></div><div class=card><h3>Termo de Responsabilidade</h3><span class="badge ${c.term?'ok':'warn'}">${c.term?'Assinado digitalmente':'Pendente de assinatura'}</span><p class=muted>O aceite ficará vinculado ao cadastro do cliente.</p></div></div><br><div class=card><h3>Anamnese detalhada</h3><div class=two><div class=field><label>Data</label><input id=ad type=date value="${new Date().toISOString().slice(0,10)}"></div><div class=field><label>Hora</label><input id=at type=time value="${new Date().toTimeString().slice(0,5)}"></div></div><div class=field><label>Descrição do procedimento / observações</label><textarea id=ax rows=5 placeholder="Alergias, sensibilidade, produtos, técnica, resultado e orientações."></textarea></div><div class=field><label>Fotos do procedimento</label><input id=af type=file accept="image/*" multiple></div><button class="btn primary" onclick="saveAnam(${safeId(id)})">Salvar anamnese</button>${(c.anams||[]).map(a=>`<div class=summary style="margin-top:10px"><b>${esc(a.date)} às ${esc(a.time)}</b><p>${esc(a.desc)}</p><span class=muted>${a.photos} foto(s) anexada(s)</span></div>`).join('')}</div><br><div class=card><h3>Histórico de procedimentos</h3><ul>${(c.history||[]).length?(c.history||[]).map(h=>`<li>${esc(h)}</li>`).join(''):'<li class=muted>Sem procedimentos registrados.</li>'}</ul></div>`);
  }

  function productionClientBook(){
    const b=booking;b.items=b.items||[];return `${header()}<main><div class=client-shell><div class=page-head><div><h1>Agendar atendimento</h1><p>Monte seu atendimento com quantos serviços precisar.</p></div></div><div class=card><div class=section-title><div><h2>1. Serviços</h2><span class=muted>Você pode combinar vários serviços no mesmo atendimento.</span></div><span class="badge ok">${b.items.length} ${b.items.length===1?'serviço':'serviços'}</span></div><div class=booking-lines>${b.items.map((it,i)=>{const s=svc(it.serviceId)||SERVICES[0];return `<div class=booking-line><div><b>${esc(s.n)}</b><small>${money(it.length==='long'?s.long:s.base)}</small></div><select onchange="booking.items[${i}].length=this.value;render()"><option value=base ${it.length!=='long'?'selected':''}>Base — curto/médio</option><option value=long ${it.length==='long'?'selected':''}>Longo</option></select><button class="btn danger" onclick="removeBookingService(${i})">Remover</button></div>`}).join('')||'<div class=empty>Nenhum serviço adicionado.</div>'}<button class=booking-add type=button onclick="openBookingServicePicker()">＋ Adicionar mais serviços</button></div><br><h2>2. Profissional</h2><div class=actions>${PROD_PROS.map(p=>`<button class="btn ${b.prof===p?'primary':''}" onclick="booking.prof=${JSON.stringify(p)};render()">${p}</button>`).join('')}</div><br><h2>3. Data e 4. Hora</h2><div class=two><div class=field><label>Data</label><input type=date value="${b.date||''}" onchange="booking.date=this.value"></div><div class=field><label>Hora</label><select onchange="booking.time=this.value"><option value="">Selecione</option>${['09:00','10:30','14:00','16:00','16:30','18:00'].map(t=>`<option ${t===b.time?'selected':''}>${t}</option>`).join('')}</select></div></div><div class=summary><h3>5. Confirmar atendimento</h3><p>${b.items.length?b.items.map(i=>svc(i.serviceId)?.n).filter(Boolean).join(' + '):'Adicione pelo menos um serviço'} • ${b.prof||'Escolha o profissional'} • ${b.date||'Escolha a data'} • ${b.time||'Escolha a hora'}</p><button class="btn primary" onclick="submitBooking()">Enviar solicitação</button></div></div></div></main>${clientBottom()}`;
  }

  function productionOrderEditor(o,x){return `<div class=two><div class=field><label>Cliente</label><select id=oc>${db.clients.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(o.clientId)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class=field><label>Profissional</label><select id=op>${PROD_PROS.map(p=>`<option ${p===o.prof?'selected':''}>${p}</option>`).join('')}</select></div></div><div class=section-title><div><h3>Serviços e produtos</h3><span class=muted>Edite os itens lançados no atendimento.</span></div><button class="btn" onclick="addOrderLine()">+ Adicionar serviço</button></div><div id=orderLines class=order-lines>${(o.items||[]).map((it,i)=>lineEditor(it,i)).join('')||'<div class=empty>Nenhum serviço lançado. Adicione pelo menos um serviço.</div>'}</div><br><div class=two><div class=field><label>Desconto (R$)</label><input id=od type=number min=0 step=.01 value="${Number(o.discount||0)}"></div><div class=field><label>Motivo do desconto</label><input id=odr value="${esc(o.discountReason||'')}" placeholder="Ex.: campanha, fidelização..."></div></div><div class=summary><div class=summary-row><span>Subtotal</span><b>${money(x.sub)}</b></div><div class=summary-row><span>Desconto</span><b>${money(x.discount)}</b></div><div class=summary-row total><span>Total cliente</span><b>${money(x.net)}</b></div><div class=summary-row><span>Custo</span><b>${money(x.cost)}</b></div><div class=summary-row><span>Comissão 30%</span><b>${money(x.commission)}</b></div><div class=summary-row><span>Lucro estimado</span><b>${money(x.profit)}</b></div></div><br><div class=actions><button class="btn outline" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="applyOrderChanges(${safeId(o.id)})">Salvar alterações</button></div>`}

  function productionNewOrder(){const c=db.clients?.[0];if(!c){toast('Cadastre um cliente antes de abrir uma comanda.');return}const o={id:Date.now(),clientId:c.id,client:c.name,prof:PROD_PROS[0],items:[],discount:0,discountReason:'',open:true,payment:'draft'};db.orders.unshift(o);save();openOrder(o.id)}

  function productionEditAgenda(id){const r=db.requests.find(x=>String(x.id)===String(id));if(!r)return;showModal('Editar agendamento',`<div class=two><div class=field><label>Data</label><input id=edate type=date value="${esc(r.date||'')}"></div><div class=field><label>Horário</label><select id=etime>${['09:00','10:30','14:00','16:00','16:30','18:00'].map(t=>`<option ${t===r.time?'selected':''}>${t}</option>`).join('')}</select></div></div><div class=field><label>Profissional</label><select id=eprof>${PROD_PROS.map(p=>`<option ${p===r.prof?'selected':''}>${p}</option>`).join('')}</select></div><div class=actions><button class="btn outline" onclick="closeModal()">Cancelar</button><button class="btn danger" onclick="cancelAgenda(${safeId(id)})">Cancelar agendamento</button><button class="btn primary" onclick="saveAgendaEdit(${safeId(id)})">Salvar</button></div>`)}

  async function productionSignup(){
    const full=document.getElementById('v16-full-name')?.value.trim()||'',phone=document.getElementById('v16-phone')?.value.trim()||'',email=document.getElementById('v16-email')?.value.trim()||'',password=document.getElementById('v16-pass')?.value||'';
    const msgEl=document.getElementById('v16-msg');const msg=t=>{if(msgEl)msgEl.textContent=t};
    if(!full||full.split(/\s+/).length<2){msg('Informe seu nome completo.');return}if(!phone){msg('Informe seu WhatsApp.');return}if(!email||password.length<6){msg('Informe e-mail e senha (mínimo de 6 caracteres).');return}
    msg('Criando sua conta...');
    const r=await window.__EDDU_SB.auth.signUp({email,password,options:{data:{full_name:full,phone},emailRedirectTo:origin()}});
    if(r.error){msg(r.error.message);return}
    localStorage.setItem('eddu_pending_profile',JSON.stringify({full_name:full,phone,email}));
    if(r.data?.session){await persistPendingProfile(r.data.session.user);await bootUser()}else msg('Conta criada. Verifique seu e-mail para confirmar o acesso. O link retornará automaticamente ao aplicativo.');
  }

  async function persistPendingProfile(user){
    const raw=localStorage.getItem('eddu_pending_profile');if(!raw||!window.__EDDU_SB||!user)return;
    let p;try{p=JSON.parse(raw)}catch(_){p=null}if(!p)return;
    try{
      await window.__EDDU_SB.from('profiles').upsert({id:user.id,full_name:p.full_name,phone:p.phone,role:'client',active:true},{onConflict:'id'});
      await window.__EDDU_SB.from('clients').upsert({user_id:user.id,name:p.full_name,email:p.email||user.email,phone:p.phone,active:true},{onConflict:'user_id'});
      localStorage.removeItem('eddu_pending_profile');
    }catch(e){console.warn('EDDU profile sync',e)}
  }

  function enhanceAuth(){
    const gate=document.getElementById('v16-auth');if(!gate)return;
    const card=gate.querySelector('.v16-auth-card');if(!card)return;
    const signup=gate.querySelector('#v16-signup');
    if(signup&&!document.getElementById('v16-full-name')){
      const name=document.createElement('input');name.id='v16-full-name';name.type='text';name.autocomplete='name';name.placeholder='Nome completo';
      const phone=document.createElement('input');phone.id='v16-phone';phone.type='tel';phone.autocomplete='tel';phone.placeholder='WhatsApp (com DDD)';
      card.insertBefore(name,gate.querySelector('#v16-email'));card.insertBefore(phone,gate.querySelector('#v16-pass'));
      signup.onclick=productionSignup;
      const google=document.createElement('button');google.id='v16-google';google.className='secondary';google.textContent='Continuar com Google';
      const apple=document.createElement('button');apple.id='v16-apple';apple.className='secondary';apple.textContent='Continuar com Apple';
      card.insertBefore(google,gate.querySelector('#v16-msg'));card.insertBefore(apple,gate.querySelector('#v16-msg'));
      google.onclick=()=>oauth('google');apple.onclick=()=>oauth('apple');
    }
  }
  async function oauth(provider){
    try{const r=await window.__EDDU_SB.auth.signInWithOAuth({provider,options:{redirectTo:origin()}});if(r.error)toast(r.error.message)}catch(e){toast(e.message||'Login social indisponível.')} 
  }

  async function syncRealData(){
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();if(!sb||!u||!db)return;
    await persistPendingProfile(u);
    const role=window.EDDU_AUTH?.getProfile?.()?.role==='client'?'client':'staff';
    const [cr,ar,or,fr]=await Promise.all([
      role==='client'?sb.from('clients').select('*').eq('user_id',u.id).order('name'):sb.from('clients').select('*').order('name'),
      role==='client'?sb.from('appointments').select('*, appointment_services(*, services(name)), professionals(name)').eq('created_by',u.id).order('starts_at'):sb.from('appointments').select('*, appointment_services(*, services(name)), professionals(name)').order('starts_at'),
      role==='client'?sb.from('commands').select('*, command_items(*)').eq('created_by',u.id).order('created_at'):sb.from('commands').select('*, command_items(*)').order('created_at'),
      role==='client'?Promise.resolve({data:[],error:null}):sb.from('financial_transactions').select('*').order('due_date')
    ]);
    if(!cr.error){db.clients=(cr.data||[]).map(c=>({id:c.id,user_id:c.user_id,name:c.name,phone:c.phone||'',email:c.email||'',points:c.loyalty_points||0,term:false,anam:c.notes||'',history:[],anams:[]}));app.selectedClient=db.clients.find(c=>c.user_id===u.id)?.id||db.clients[0]?.id||null}
    const svcMap={};(SERVICES||[]).forEach(s=>{if(s.dbId)svcMap[s.dbId]=s});
    if(!ar.error){db.requests=(ar.data||[]).map(a=>{const d=new Date(a.starts_at),items=(a.appointment_services||[]).map(x=>{const s=svcMap[x.service_id];return{serviceId:s?.id||x.service_id,length:(s&&Number(x.price)===Number(s.long))?'long':'base',name:s?.n||x.services?.name||'Serviço'}});return{id:a.id,clientId:a.client_id,client:db.clients.find(c=>String(c.id)===String(a.client_id))?.name||'Cliente',serviceId:items[0]?.serviceId,service:items[0]?.name||'Serviço',services:items,prof:a.professionals?.name||'',date:d.toISOString().slice(0,10),time:d.toTimeString().slice(0,5),status:{requested:'Pendente',confirmed:'Aprovado',rescheduled:'Reagendado',in_progress:'Em atendimento',completed:'Concluído',cancelled:'Cancelado',no_show:'No show'}[a.status]||a.status}})}
    if(!or.error){db.orders=(or.data||[]).map(o=>{const items=(o.command_items||[]).map(i=>{const s=svcMap[i.service_id];return{serviceId:s?.id||i.service_id,length:(s&&Number(i.unit_price)===Number(s.long))?'long':'base'}});return{id:o.id,clientId:o.client_id,client:db.clients.find(c=>String(c.id)===String(o.client_id))?.name||'Cliente',prof:o.professionals?.name||'',items,discount:Number(o.discount||0),discountReason:'',open:o.status==='open',payment:'',paidAt:null,__dbItemsSynced:true}})}
    if(!fr.error){db.payables=(fr.data||[]).filter(x=>['fixed_cost','variable_cost','commission','payable'].includes(x.type)).map(x=>({id:x.id,supplier:x.description,description:x.description,value:Number(x.amount||0),dueDate:x.due_date,method:'Pix',category:'Operacional',status:x.status||'pending',note:'',costRecognized:x.status==='paid'}));db.receivables=(fr.data||[]).filter(x=>x.type==='receivable').map(x=>({id:x.id,client:db.clients.find(c=>String(c.id)===String(x.client_id))?.name||'Cliente',description:x.description,value:Number(x.amount||0),dueDate:x.due_date,method:'Pix',category:'Serviços',status:x.status||'pending',note:''}))}
    save();if(typeof safeRender==='function')safeRender();
  }

  function installProductionOverrides(){
    window.dashboard=productionDashboard;
    window.financeOverview=productionFinanceOverview;
    window.clientCardList=productionClientCardList;
    window.editClient=productionEditClient;
    window.updateClient=productionUpdateClient;
    window.openClientFile=productionClientFile;
    window.clientBook=productionClientBook;
    window.newOrder=productionNewOrder;
    window.editAgenda=productionEditAgenda;
    setInterval(enhanceAuth,500);
    setInterval(async()=>{if(window.EDDU_AUTH?.getUser?.()&&window.__EDDU_SB&&!window.__EDDU_PROD_SYNC){window.__EDDU_PROD_SYNC=true;try{await syncRealData()}finally{window.__EDDU_PROD_SYNC=false}}},2500);
    setTimeout(enhanceAuth,300);setTimeout(enhanceAuth,1200);
  }

  function boot(){wrapClientPayment();checkReturn();installProductionOverrides();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  setTimeout(boot,1000);
  window.EDDU_REAL_PAYMENT={createCheckout,paymentStatus};
})();
