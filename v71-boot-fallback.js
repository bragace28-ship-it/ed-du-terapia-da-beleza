/* V71.1 — Emergency boot fallback. Never leaves production on a blank screen. */
(function(){
  'use strict';
  function css(){
    if(document.getElementById('v71-css'))return;
    const s=document.createElement('style');s.id='v71-css';
    s.textContent='.v71-fallback{position:fixed;inset:0;z-index:100000;background:#f4f2ee;display:grid;place-items:center;padding:20px}.v71-card{width:min(430px,100%);background:#fff;border:1px solid #e5e1da;border-radius:22px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.12)}.v71-card h1{margin:0 0 6px;font-size:24px}.v71-card p{color:#777;margin:0 0 20px}.v71-card input{width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid #ddd6ce;border-radius:10px;margin:6px 0 12px;font-size:16px}.v71-card button{width:100%;padding:13px;border:0;border-radius:10px;background:#171717;color:#fff;font-weight:700;font-size:15px;margin-top:4px}.v71-card .secondary{background:#f1efeb;color:#222;margin-top:10px}.v71-msg{min-height:22px;margin-top:12px;font-size:13px;color:#8a5b00}';document.head.appendChild(s);
  }
  function mount(){
    if(document.getElementById('v16-auth')||document.getElementById('v71-fallback'))return;
    css();
    const el=document.createElement('div');el.id='v71-fallback';el.className='v71-fallback';
    el.innerHTML='<div class="v71-card"><span>ED & DU • ACESSO SEGURO</span><h1>Entrar no aplicativo</h1><p>Acesse sua conta profissional ou de cliente.</p><input id="v71-email" type="email" autocomplete="email" placeholder="E-mail"><input id="v71-pass" type="password" autocomplete="current-password" placeholder="Senha"><button id="v71-login">Entrar</button><button id="v71-signup" class="secondary">Criar conta de cliente</button><div id="v71-msg" class="v71-msg"></div></div>';
    document.body.appendChild(el);
    const msg=t=>{const x=document.getElementById('v71-msg');if(x)x.textContent=t||''};
    document.getElementById('v71-login').onclick=()=>{
      const email=document.getElementById('v71-email')?.value||'',pass=document.getElementById('v71-pass')?.value||'';
      const e=document.getElementById('v16-email'),p=document.getElementById('v16-pass');if(e)e.value=email;if(p)p.value=pass;
      if(window.EDDU_AUTH?.login){msg('Entrando...');window.EDDU_AUTH.login().catch(err=>msg(String(err?.message||err||'Não foi possível entrar.')))}else msg('O aplicativo ainda está carregando. Tente novamente em alguns segundos.');
    };
    document.getElementById('v71-signup').onclick=()=>{
      const email=document.getElementById('v71-email')?.value||'',pass=document.getElementById('v71-pass')?.value||'';
      const e=document.getElementById('v16-email'),p=document.getElementById('v16-pass');if(e)e.value=email;if(p)p.value=pass;
      if(window.EDDU_AUTH?.signup){msg('Criando sua conta...');window.EDDU_AUTH.signup().catch(err=>msg(String(err?.message||err||'Não foi possível criar a conta.')))}else msg('O aplicativo ainda está carregando.');
    };
  }
  function hasRealApp(){const r=document.getElementById('root');return !!(r&&r.children&&r.children.length&&r.textContent.trim().length>20)}
  function sync(){const f=document.getElementById('v71-fallback');if(f&&document.getElementById('v16-auth'))f.remove();if(!document.getElementById('v16-auth')&&!hasRealApp())mount()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(sync,250),{once:true});else setTimeout(sync,250);
  setTimeout(sync,1000);setTimeout(sync,3000);setTimeout(sync,6000);setTimeout(sync,10000);
})();
