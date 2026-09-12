/* V55 — Production hardening: immutable auth role, real DB client CRUD, UUID-safe actions, resilient calculations. */
(function(){
  'use strict';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const sb=()=>window.__EDDU_SB;
  const auth=()=>window.EDDU_AUTH;
  const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));
  const js=v=>JSON.stringify(String(v));
  const safeName=v=>String(v??'').trim();
  const escV=v=>typeof window.esc==='function'?window.esc(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const toastV=m=>typeof window.toast==='function'?window.toast(m):console.warn(m);

  function currentRole(){
    const p=auth()?.getProfile?.();
    if(!p||p.active===false)return null;
    if(p.role==='admin'||p.role==='professional')return 'pro';
    if(p.role==='client')return 'client';
    return null;
  }

  function lockRole(){
    const real=currentRole();
    if(real) window.app.role=real;
    const originalSetRole=window.setRole;
    window.setRole=function(requested){
      const r=currentRole();
      if(!r){ toastV('Sessão sem perfil válido. Faça login novamente.'); return; }
      if(requested!==r){ toastV('Acesso separado: esta conta não pode trocar de área.'); return; }
      window.app.role=r;
      window.app.page=r==='pro'?'dashboard':'home';
      window.render();
    };
    window.setRole.__edduWrapped=true;

    const originalGo=window.go;
    window.go=function(page){
      const r=currentRole();
      const clientPages=new Set(['home','book','appointments','payments','docs']);
      const proPages=new Set(['dashboard','requests','agenda','clients','orders','finance']);
      if(r==='client' && !clientPages.has(page)){ toastV('Área exclusiva para profissionais.'); return; }
      if(r==='pro' && !proPages.has(page)){ toastV('Área exclusiva para clientes.'); return; }
      if(r){ window.app.role=r; window.app.page=page; }
      return originalGo?.(page);
    };
  }

  function patchHeader(){
    window.header=function(){
      const r=currentRole();
      const label=r==='pro'?'Área profissional':'Área do cliente';
      return `<header class="appbar"><div class="brand"><div class="brandmark">E</div><div class="brandtext"><b>ED & DU</b><span>Terapia da Beleza</span></div></div><div class="role"><span class="badge ok">${label}</span><button class="btn outline" onclick="EDDU_AUTH.signOut()">Sair</button></div></header>`;
    };
  }

  function patchOrderCalc(){
    window.orderCalc=function(o){
      const items=Array.isArray(o?.items)?o.items:[];
      let sub=0,cost=0;
      for(const i of items){
        const s=typeof window.svc==='function'?window.svc(i.serviceId):null;
        const qty=Math.max(1,Number(i.quantity||1));
        const price=s?Number(i.length==='long'?s.long:s.base||0):Number(i.unit_price||i.unitPrice||0);
        const unitCost=s?Number(s.cost||0):Number(i.unit_cost||i.unitCost||0);
        sub+=price*qty;
        cost+=unitCost*qty;
      }
      const discount=Math.max(0,Math.min(Number(o?.discount||0),sub));
      const net=Math.max(0,sub-discount);
      const commission=net*Number(o?.commission_percent||o?.commissionPercent||0.30);
      const profit=net-cost-commission;
      return {sub,discount,net,cost,commission,profit};
    };
  }

  function mapClient(c){
    return {id:c.id,user_id:c.user_id||null,name:c.name||'',phone:c.phone||'',email:c.email||'',points:Number(c.loyalty_points||0),term:Boolean(c.term||false),anam:c.notes||'',history:Array.isArray(c.history)?c.history:[],anams:Array.isArray(c.anams)?c.anams:[]};
  }

  async function refreshClients(){
    const S=sb();
    if(!S||currentRole()!=='pro')return;
    const r=await S.from('clients').select('*').order('name');
    if(r.error){console.error('EDDU clients refresh',r.error);toastV('Não foi possível atualizar os clientes.');return;}
    window.db.clients=(r.data||[]).map(mapClient);
  }

  function clientFormHard(c,mode){
    const id=js(c?.id||'');
    return `<div class="two"><div class="field"><label>Nome completo</label><input id="cn" value="${escV(c?.name||'')}"></div><div class="field"><label>Telefone / WhatsApp</label><input id="cp" value="${escV(c?.phone||'')}"></div></div><div class="field"><label>E-mail</label><input id="ce" type="email" value="${escV(c?.email||'')}"></div><div class="actions"><button class="btn outline" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="${mode==='create'?'createClient()':'updateClient('+id+')'}">${mode==='create'?'Cadastrar':'Salvar alterações'}</button></div>`;
  }

  function clientCardListHard(list){
    return (list||[]).map(c=>{
      const initials=safeName(c.name).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'?';
      const id=js(c.id);
      const search=escV((c.name+' '+c.phone+' '+c.email).toLowerCase());
      return `<article class="client-card" data-client-search="${search}" data-term="${c.term?'signed':'pending'}"><div class="client-card-head"><div class="client-main"><div class="client-avatar">${initials}</div><div><h3 style="margin:0">${escV(c.name)}</h3><p class="muted" style="margin:3px 0">${escV(c.phone||'Sem telefone')}</p><small class="muted">${escV(c.email||'Sem e-mail')}</small></div></div><span class="badge ${c.term?'ok':'warn'}">${c.term?'Termo ok':'Termo pendente'}</span></div><div class="summary" style="margin-top:14px"><div class="summary-row"><span>Fidelidade</span><b>${Number(c.points||0)} pts</b></div><div class="summary-row"><span>Procedimentos</span><b>${Array.isArray(c.history)?c.history.length:0}</b></div></div><div class="client-actions"><button class="btn" onclick="editClient(${id})">Editar</button><button class="btn" onclick="wa(${js(c.phone||'')},${js('Olá '+c.name+', aqui é da ED & DU | Terapia da Beleza.')})">WhatsApp</button><button class="btn primary" onclick="openClientFile(${id})">Abrir ficha</button></div></article>`;
    }).join('')||'<div class="empty">Nenhum cliente encontrado.</div>';
  }

  function patchClientUI(){
    window.clientForm=clientFormHard;
    window.clientCardList=clientCardListHard;
    window.clients=function(){
      if(currentRole()!=='pro')return '<div class="content"><div class="card"><h2>Acesso restrito</h2><p>Esta área está disponível somente para profissionais.</p></div></div>';
      return `<div class="content"><div class="page-head"><div><h1>Clientes</h1><p>Cadastro, relacionamento, ficha, anamnese e documentos.</p></div><button class="btn primary" onclick="newClient()">+ Novo cliente</button></div><div class="filters"><input placeholder="Buscar cliente..." oninput="filterClientCards(this.value)"><select onchange="filterClientCards('',this.value)"><option value="all">Todos</option><option value="signed">Termo assinado</option><option value="pending">Termo pendente</option></select></div><div id="clientCards" class="client-cards">${clientCardListHard(window.db.clients)}</div></div>`;
    };

    window.editClient=function(id){
      if(currentRole()!=='pro')return toastV('Acesso exclusivo para profissionais.');
      const c=window.db.clients.find(x=>String(x.id)===String(id));
      if(!c)return toastV('Cliente não encontrado.');
      showModal('Editar dados cadastrais',clientFormHard(c,'edit'));
    };

    window.createClient=async function(){
      if(currentRole()!=='pro')return toastV('Acesso exclusivo para profissionais.');
      const name=safeName(document.getElementById('cn')?.value),phone=safeName(document.getElementById('cp')?.value),email=safeName(document.getElementById('ce')?.value);
      if(!name||!phone){toastV('Nome e telefone são obrigatórios.');return;}
      const S=sb();
      if(!S){toastV('Conexão com o banco indisponível.');return;}
      const r=await S.from('clients').insert({name,phone,email:email||null,loyalty_points:0,active:true,user_id:null}).select('*').single();
      if(r.error){console.error(r.error);toastV('Não foi possível cadastrar o cliente: '+r.error.message);return;}
      window.db.clients.push(mapClient(r.data));
      closeModal();toastV('Cliente cadastrado com sucesso.');window.render();
    };

    window.updateClient=async function(id){
      if(currentRole()!=='pro')return toastV('Acesso exclusivo para profissionais.');
      const c=window.db.clients.find(x=>String(x.id)===String(id));
      if(!c)return toastV('Cliente não encontrado.');
      const name=safeName(document.getElementById('cn')?.value)||c.name,phone=safeName(document.getElementById('cp')?.value),email=safeName(document.getElementById('ce')?.value);
      const S=sb();if(!S)return toastV('Conexão com o banco indisponível.');
      const r=await S.from('clients').update({name,phone:phone||null,email:email||null}).eq('id',c.id).select('*').single();
      if(r.error){console.error(r.error);toastV('Não foi possível atualizar: '+r.error.message);return;}
      Object.assign(c,mapClient(r.data));
      closeModal();toastV('Cadastro atualizado.');window.render();
    };

    window.openClientFile=function(id){
      if(currentRole()!=='pro')return toastV('Acesso exclusivo para profissionais.');
      const c=window.db.clients.find(x=>String(x.id)===String(id));
      if(!c)return toastV('Cliente não encontrado.');
      window.app.selectedClient=c.id;
      const cid=js(c.id);
      showModal('Ficha do Cliente',`<div class="actions"><button class="btn" onclick="editClient(${cid})">Editar cadastro</button><button class="btn" onclick="wa(${js(c.phone||'')},${js('Olá '+c.name+', tudo bem? Aqui é da ED & DU | Terapia da Beleza.')})">WhatsApp</button><button class="btn primary" onclick="sendTerm(${cid})">Enviar Termo de Responsabilidade</button></div><br><div class="grid2"><div class="card"><h3>Dados pessoais</h3><p><b>${escV(c.name)}</b><br>${escV(c.phone||'Sem telefone')}<br>${escV(c.email||'Sem e-mail')}</p><span class="badge ok">${Number(c.points||0)} pontos</span></div><div class="card"><h3>Termo de Responsabilidade</h3><span class="badge ${c.term?'ok':'warn'}">${c.term?'Assinado digitalmente':'Pendente de assinatura'}</span><p class="muted">O aceite ficará associado ao cadastro do cliente.</p></div></div><br><div class="card"><h3>Anamnese detalhada</h3><div class="two"><div class="field"><label>Data</label><input id="ad" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Hora</label><input id="at" type="time" value="${new Date().toTimeString().slice(0,5)}"></div></div><div class="field"><label>Descrição do procedimento / observações</label><textarea id="ax" rows="5" placeholder="Alergias, sensibilidade, produtos, técnica, resultado e orientações."></textarea></div><div class="field"><label>Fotos do procedimento</label><input id="af" type="file" accept="image/*" multiple></div><button class="btn primary" onclick="saveAnam(${cid})">Salvar anamnese</button>${(c.anams||[]).map(a=>`<div class="summary" style="margin-top:10px"><b>${escV(a.date)} às ${escV(a.time)}</b><p>${escV(a.desc)}</p><span class="muted">${Number(a.photos||0)} foto(s) anexada(s)</span></div>`).join('')}</div><br><div class="card"><h3>Histórico de procedimentos</h3><ul>${(c.history||[]).length?(c.history||[]).map(h=>`<li>${escV(h)}</li>`).join(''):'<li class="muted">Sem procedimentos registrados.</li>'}</ul></div>`);
    };

    window.saveAnam=async function(id){
      if(currentRole()!=='pro')return toastV('Acesso exclusivo para profissionais.');
      const c=window.db.clients.find(x=>String(x.id)===String(id));if(!c)return toastV('Cliente não encontrado.');
      const d=document.getElementById('ad')?.value,t=document.getElementById('at')?.value,x=safeName(document.getElementById('ax')?.value),photos=document.getElementById('af')?.files?.length||0;
      if(!d||!t||!x){toastV('Preencha data, hora e descrição.');return;}
      c.anams=c.anams||[];c.anams.unshift({date:d,time:t,desc:x,photos});c.anam=x;
      closeModal();toastV('Anamnese registrada no cadastro.');window.render();
    };
  }

  function patchClientData(){
    const real=currentRole();
    if(real!=='client')return;
    const uid=auth()?.getUser?.()?.id;
    if(!uid)return;
    const own=window.db.clients.find(c=>String(c.user_id)===String(uid));
    if(own)window.db.clients=[own];
    window.app.selectedClient=own?.id||null;
    window.clientHome=function(){
      const c=window.db.clients.find(x=>String(x.user_id)===String(uid))||window.db.clients[0];
      if(!c)return '<main><div class="client-shell"><div class="card"><h2>Cadastro não localizado</h2><p>Esta conta ainda não possui um cadastro de cliente vinculado.</p></div></div></main>';
      return `${window.header()}<main><div class="client-shell"><section class="client-welcome"><h1>${escV(c.name)}</h1><p class="muted">Bem-vinda à sua área exclusiva.</p><div class="loyalty-card"><div class="loyalty-points-label"><span>Pontos fidelidade</span><span aria-hidden="true">✦</span></div><strong>${Number(c.points||0)}</strong><small>Seu saldo de benefícios no ED & DU</small></div></section><div class="client-nav"><button class="btn primary" onclick="cgo('book')">+ Agendar</button><button class="btn" onclick="cgo('appointments')">Meus agendamentos</button><button class="btn" onclick="cgo('payments')">Pagamentos</button><button class="btn" onclick="cgo('docs')">Documentos</button></div></div></main>${clientBottom()}`;
    };
  }

  function patchClientCommandViews(){
    if(currentRole()!=='client')return;
    const uid=auth()?.getUser?.()?.id;
    const own=window.db.clients.find(c=>String(c.user_id)===String(uid))||window.db.clients[0];
    if(!own)return;
    const cid=String(own.id);
    window.clientAppointments=function(){
      const r=(window.db.requests||[]).find(x=>String(x.clientId)===cid)||null;
      return `${window.header()}<main><div class="client-shell"><div class="page-head"><div><h1>Meus agendamentos</h1><p>Acompanhe seus atendimentos.</p></div></div><div class="card">${r?`<h2>${escV(r.client||own.name)}</h2><p>${escV(r.prof||'Profissional a definir')} • ${escV(r.date||'')} • ${escV(r.time||'')}</p><div class="service-chips">${(r.services||[{name:r.service}]).map(s=>`<span class="badge">${escV(s.name||s.n)}</span>`).join(' ')}</div><br><span class="badge ${r.status==='Aprovado'?'ok':'warn'}">${escV(r.status||'Pendente')}</span><br><br><div class="actions"><button class="btn" onclick="cgo('book')">Alterar agendamento</button></div>`:'<p class="muted">Nenhum agendamento encontrado.</p>'}</div></div></main>${clientBottom()}`;
    };
    window.clientPayments=function(){
      const list=(window.db.orders||[]).filter(o=>String(o.clientId)===cid&&!o.open);
      return `${window.header()}<main><div class="client-shell"><div class="page-head"><div><h1>Pagamentos</h1><p>Confira suas comandas e pague quando o salão liberar.</p></div></div>${list.length?list.map(o=>{const x=window.orderCalc(o),id=js(o.id);return `<div class="card payment-card" style="margin-bottom:12px"><div class="payment-hero"><small>Total da comanda</small><strong>${moneyV(x.net)}</strong></div><p class="muted">${(o.items||[]).map(i=>{const s=window.svc(i.serviceId);return s?.n||i.description||'Serviço'}).join(' • ')}</p><span class="badge ${o.payment==='paid'?'ok':'warn'}">${o.payment==='paid'?'Pago':'Aguardando pagamento'}</span><div class="command-actions"><button class="btn outline" onclick="viewClientOrder(${id})">Ver comanda</button>${o.payment!=='paid'?`<button class="btn primary" onclick="clientPayOrder(${id})">Pagar agora</button>`:''}</div></div>`}).join(''):'<div class="card"><p class="muted">Nenhuma comanda fechada disponível para pagamento.</p></div>'}</div></main>${clientBottom()}`;
    };
  }

  function moneyV(n){return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}

  function patchRender(){
    const oldRender=window.render;
    if(typeof oldRender!=='function'||oldRender.__v55)return;
    const wrapped=function(){
      try{
        const r=currentRole();
        if(!r){ oldRender(); return; }
        window.app.role=r;
        if(r==='client'){
          const blocked=['dashboard','requests','agenda','clients','orders','finance'];
          if(blocked.includes(window.app.page))window.app.clientPage='home';
        }
        if(r==='pro' && !window.app.page)window.app.page='dashboard';
        oldRender();
      }catch(e){
        console.error('EDDU V55 render',e);
        const root=document.getElementById('root');
        if(root)root.innerHTML='<div style="padding:28px;font-family:system-ui"><h2>ED & DU</h2><p>Não foi possível carregar esta tela. Os dados permanecem protegidos. Tente novamente.</p><button class="btn primary" onclick="location.reload()">Recarregar</button></div>';
      }
    };
    wrapped.__v55=true;window.render=wrapped;
  }

  async function boot(){
    for(let i=0;i<120;i++){
      if(window.__EDDU_SB&&window.EDDU_AUTH&&window.app&&window.db&&typeof window.render==='function')break;
      await sleep(100);
    }
    if(!window.__EDDU_SB||!window.EDDU_AUTH)return;
    lockRole();patchHeader();patchOrderCalc();patchClientUI();patchClientData();patchClientCommandViews();patchRender();
    const r=currentRole();
    if(!r){
      const root=document.getElementById('root');if(root)root.innerHTML='<div style="padding:28px;font-family:system-ui"><h2>Acesso não autorizado</h2><p>Esta conta não possui um perfil válido.</p><button class="btn primary" onclick="EDDU_AUTH.signOut()">Sair</button></div>';
      return;
    }
    if(r==='pro')await refreshClients();
    window.__EDDU_V55_READY=true;
    window.render();
  }
  boot();
})();
