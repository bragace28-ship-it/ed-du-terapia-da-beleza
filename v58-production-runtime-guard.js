/* V58 — Final production runtime guard: real-data gate, no demo fallback, safe runtime recovery. */
(function(){
  'use strict';
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const root=()=>document.getElementById('root');
  const auth=()=>window.EDDU_AUTH;
  const profile=()=>auth()?.getProfile?.();
  const user=()=>auth()?.getUser?.();
  const realReady=()=>window.__EDDU_PRODUCTION_AUTHORITY===true && !!window.db && !!user() && !!profile() && profile()?.active!==false;
  let released=false;
  let observer=null;
  let bootFinished=false;
  function hide(){const r=root();if(!r)return;r.style.visibility='hidden';r.style.opacity='0';r.dataset.edduRuntime='blocked'}
  function release(){const r=root();if(!r)return;r.style.visibility='visible';r.style.opacity='1';r.dataset.edduRuntime='ready';released=true}
  function errorScreen(message){
    const r=root();if(!r)return;
    r.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f2ee;color:#242321;font:14px/1.5 system-ui,sans-serif"><section style="width:min(560px,100%);background:#fff;border:1px solid #e6e1d9;border-radius:20px;padding:26px;box-shadow:0 12px 40px #231e1910"><div style="font-weight:800;font-size:18px">ED & DU | Terapia da Beleza</div><h1 style="font-size:24px;margin:12px 0 8px">Não foi possível sincronizar os dados</h1><p style="color:#77736c;margin:0 0 18px">O aplicativo não exibirá dados demonstrativos. Verifique sua conexão e tente novamente.</p><div style="background:#f8f6f2;border-radius:12px;padding:12px;color:#5d5952">'+String(message||'Banco de dados indisponível.').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]))+'</div><div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap"><button id="eddu-runtime-retry" style="border:0;border-radius:11px;padding:11px 15px;background:#242321;color:#fff;font-weight:700">Tentar novamente</button><button id="eddu-runtime-signout" style="border:0;border-radius:11px;padding:11px 15px;background:#eeeae4;color:#242321">Sair</button></div></section></main>';
    r.style.visibility='visible';r.style.opacity='1';r.dataset.edduRuntime='error';released=false;
    document.getElementById('eddu-runtime-retry')?.addEventListener('click',()=>location.reload(),{once:true});
    document.getElementById('eddu-runtime-signout')?.addEventListener('click',()=>auth()?.signOut?.(),{once:true});
  }
  function safeRender(){
    if(!realReady())return false;
    try{
      if(typeof window.safeRender==='function')window.safeRender();
      else if(typeof window.render==='function')window.render();
      else return false;
    }catch(e){console.error('[EDDU V58] render',e);errorScreen('Falha ao renderizar os dados reais.');return false}
    release();return true;
  }
  function installClickGuard(){
    document.addEventListener('click',function(e){
      const el=e.target?.closest?.('button,a');if(!el)return;
      if(el.dataset?.edduRuntimeSafe==='1')return;
      if(!realReady()&&!el.closest('#v16-auth')){e.preventDefault();e.stopPropagation();hide();}
    },true);
  }
  async function boot(){
    hide();installClickGuard();
    for(let i=0;i<160;i++){
      if(!user()&&!profile()){await wait(100);continue}
      if(realReady()){safeRender();bootFinished=true;return}
      await wait(100);
    }
    bootFinished=true;
    if(!realReady()){
      const p=profile();
      if(!p||p.active===false){
        if(!document.getElementById('v16-auth')){try{await auth()?.signOut?.()}catch(e){console.error('[EDDU V58] signout',e)}}
      }else errorScreen('O Supabase não confirmou a carga de produção dentro do tempo esperado.');
    }
  }
  observer=new MutationObserver(()=>{
    if(realReady()&&!released)safeRender();
    else if(!realReady()&&released){released=false;hide()}
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('error',e=>console.error('[EDDU V58]',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>console.error('[EDDU V58] unhandled rejection',e.reason));
  window.addEventListener('pagehide',()=>{if(observer){observer.disconnect();observer=null}} ,{once:true});
  boot();
})();
