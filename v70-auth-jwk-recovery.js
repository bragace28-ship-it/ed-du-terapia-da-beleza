/* V70.1 — Production auth/JWK recovery guard. Rebuilds Neon client and returns to stable auth. */
(function(){
  'use strict';
  let recovering=false;
  let installed=false;
  const isJwk=e=>/jwk|jwks|key.*not found|not found.*key/i.test(String(e?.message||e||''));
  function clearAuthStorage(){
    try{
      const keys=[];
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i)||'';
        if(/neon|supabase|^sb-|eddu.*auth|auth.*eddu/i.test(k))keys.push(k);
      }
      keys.forEach(k=>localStorage.removeItem(k));
    }catch(e){}
    try{sessionStorage.removeItem('EDDU_AUTH_RECOVERY')}catch(e){}
  }
  function closeCommandCenter(){
    try{document.getElementById('v46')?.classList.remove('on')}catch(e){}
    try{document.getElementById('v46modal')?.classList.remove('on')}catch(e){}
  }
  async function recover(error){
    if(!isJwk(error)||recovering)return false;
    recovering=true;
    try{sessionStorage.setItem('EDDU_AUTH_RECOVERY','jwk')}catch(e){}
    closeCommandCenter();
    try{window.dispatchEvent(new CustomEvent('eddu-auth-reset',{detail:{reason:'jwk',source:'v70.1'}}))}catch(e){}
    try{await window.__EDDU_NEON_CLIENT?.auth?.signOut?.()}catch(e){}
    clearAuthStorage();
    try{window.__EDDU_SB=null}catch(e){}
    try{window.__EDDU_NEON_CLIENT=null}catch(e){}
    try{window.__EDDU_NEON_ERROR=error}catch(e){}
    try{
      if(typeof window.__EDDU_RESET_NEON==='function')await window.__EDDU_RESET_NEON();
      else if(window.EDDU_AUTH?.bootUser)await window.EDDU_AUTH.bootUser(false);
    }catch(e){
      try{window.EDDU_AUTH?.bootUser?.(false)}catch(x){}
    }
    recovering=false;
    return true;
  }
  function patchClient(client){
    if(!client||client.__EDDU_V70_PATCHED)return;
    try{
      if(client.rpc){
        const original=client.rpc.bind(client);
        client.rpc=async function(name,args){
          try{const r=await original(name,args);if(r?.error&&isJwk(r.error))await recover(r.error);return r}catch(e){await recover(e);throw e}
        };
      }
      if(client.auth){
        for(const method of ['getSession','getUser']){
          if(typeof client.auth[method]!=='function')continue;
          const original=client.auth[method].bind(client.auth);
          client.auth[method]=async function(...args){try{return await original(...args)}catch(e){await recover(e);throw e}};
        }
      }
      client.__EDDU_V70_PATCHED=true;
      installed=true;
    }catch(e){console.warn('[EDDU V70] patch failed',e)}
  }
  function install(){
    patchClient(window.__EDDU_NEON_CLIENT||window.__EDDU_SB);
    if(window.__EDDU_NEON_READY&&typeof window.__EDDU_NEON_READY.then==='function')window.__EDDU_NEON_READY.then(patchClient).catch(recover);
    const observer=new MutationObserver(()=>{
      if(!installed)patchClient(window.__EDDU_NEON_CLIENT||window.__EDDU_SB);
      const v46=document.getElementById('v46');
      if(v46&&/jwk\s+not\s+found/i.test(v46.textContent||''))recover(new Error('jwk not found'));
    });
    observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
    window.__EDDU_AUTH_V70={version:'V70.1',recover};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('unhandledrejection',e=>{if(isJwk(e.reason))recover(e.reason)});
  window.addEventListener('error',e=>{if(isJwk(e.error||e.message))recover(e.error||e.message)});
})();