/* V56.1 — role safety without auth-page reloads. */
(function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const auth=()=>window.EDDU_AUTH;
const profile=()=>auth()?.getProfile?.();
const role=()=>{const p=profile();if(!p||p.active===false)return null;return p.role==='client'?'client':(['professional','admin','manager','staff'].includes(p.role)?'pro':null)};
const uid=()=>auth()?.getUser?.()?.id||null;
const toast=m=>window.toast?.(m);
async function boot(){
  /* Nunca derruba a página nem recarrega enquanto o usuário está na tela de login. */
  for(let i=0;i<120;i++){
    if(role()) break;
    await wait(250);
  }
  const real=role();
  if(!real) return;
  hardRole();
  hardClientHome();
  guardRender();
}
function hardRole(){
  const originalSet=window.setRole;
  window.setRole=function(requested){
    const real=role();
    if(!real)return toast('Sessão sem perfil válido. Faça login novamente.');
    if(requested!==real)return toast('Esta conta não pode trocar de área.');
    window.app.role=real;
    window.app.page=real==='pro'?'dashboard':'home';
    window.render?.();
  };
  window.setRole.__edduV56=true;
  const originalGo=window.go;
  window.go=function(page){
    const real=role();
    const clientPages=new Set(['home','book','appointments','payments','docs']);
    const proPages=new Set(['dashboard','requests','agenda','clients','orders','finance']);
    if(real==='client'&&!clientPages.has(page))return toast('Área exclusiva para profissionais.');
    if(real==='pro'&&!proPages.has(page))return toast('Área exclusiva para clientes.');
    if(real){window.app.role=real;window.app.page=page;}
    return originalGo?.(page);
  };
}
function hardClientHome(){
  if(role()!=='client'||!window.clientHome)return;
  const id=uid(),original=window.clientHome;
  window.clientHome=function(){
    const own=(window.db?.clients||[]).find(c=>String(c.user_id||'')===String(id));
    if(!own)return '<main><div class="client-shell"><div class="card"><h2>Cadastro não localizado</h2><p>Esta conta está autenticada, mas não possui um cadastro de cliente vinculado.</p><button class="btn primary" onclick="EDDU_AUTH.signOut()">Sair</button></div></div></main>';
    window.db.clients=[own];
    window.app.selectedClient=own.id;
    return original();
  };
}
function guardRender(){
  const original=window.render;
  if(typeof original!=='function'||original.__edduV56)return;
  const wrapped=function(){
    const real=role();
    if(!real)return;
    if(real==='client'&&!['home','book','appointments','payments','docs'].includes(window.app.page))window.app.page='home';
    if(real==='pro'&&!['dashboard','requests','agenda','clients','orders','finance'].includes(window.app.page))window.app.page='dashboard';
    window.app.role=real;
    return original.apply(this,arguments);
  };
  wrapped.__edduV56=true;
  window.render=wrapped;
}
boot();

/* Delegated recovery for legacy client action buttons. */
(function(){
  const text=e=>String(e?.innerText||e?.textContent||e?.getAttribute?.('aria-label')||e?.title||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const idOf=e=>{for(let n=e,i=0;n&&i<6;i++,n=n.parentElement){const h=n.getAttribute?.('onclick')||'';const m=h.match(/(?:editClient|openClient|openClientRecord)\s*\(\s*['\"]([^'\"]+)['\"]/i);if(m)return m[1];const d=n.dataset?.clientId||n.dataset?.id;if(d)return d}return ''};
  const clientOf=id=>(window.db?.clients||[]).find(c=>String(c.id)===String(id));
  const phoneOf=(e,id)=>{const c=clientOf(id);if(c?.phone||c?.whatsapp)return c.phone||c.whatsapp;for(let n=e,i=0;n&&i<6;i++,n=n.parentElement){const h=n.getAttribute?.('onclick')||'';const m=h.match(/(?:wa|whatsapp)\s*\(\s*['\"]([^'\"]+)['\"]/i);if(m)return m[1];const m2=String(n.innerText||'').match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-.\s]?\d{4}/);if(m2)return m2[0]}return ''};
  const whatsapp=p=>{let n=String(p||'').replace(/\D/g,'');if(!n)return false;if(n.length===10||n.length===11)n='55'+n;window.open('https://wa.me/'+n,'_blank','noopener,noreferrer');return true};
  document.addEventListener('click',e=>{
    const el=e.target?.closest?.('button,a,[role="button"]');
    if(!el||!window.__EDDU_PRODUCTION_AUTHORITY)return;
    const t=text(el),edit=t==='editar'||t==='editar cliente'||t.includes('editar cliente'),wa=t==='wa'||t.includes('whatsapp');
    if(!edit&&!wa)return;
    const id=idOf(el);
    try{
      if(edit&&id&&typeof window.editClient==='function'){e.preventDefault();e.stopImmediatePropagation();window.editClient(id);return}
      if(edit&&id&&typeof window.openClient==='function'){e.preventDefault();e.stopImmediatePropagation();window.openClient(id);return}
      if(wa){const p=phoneOf(el,id);if(p){e.preventDefault();e.stopImmediatePropagation();whatsapp(p);return}window.toast?.('Cliente sem WhatsApp cadastrado.')}}
    catch(err){console.error('[EDDU V56]',err);window.toast?.(edit?'Não foi possível abrir a edição do cliente.':'Não foi possível abrir o WhatsApp.')}
  },true);
  window.EDDU_CLIENT_ACTIONS_READY=true;
})();
})();