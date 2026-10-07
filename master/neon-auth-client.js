/* ED & DU MASTER — Neon Auth + Data API client
   Public configuration only. No database secret is shipped to the browser.
*/
const EDDU_NEON_AUTH_URL='https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const EDDU_NEON_DATA_API_URL='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

(async()=>{
  try{
    const mod=await import('https://esm.sh/@neondatabase/neon-js@0.1.0?bundle');
    const client=mod.createClient({
      auth:{url:EDDU_NEON_AUTH_URL},
      dataApi:{url:EDDU_NEON_DATA_API_URL}
    });
    window.__EDDU_NEON_CLIENT=client;
    window.__EDDU_NEON_AUTH_URL=EDDU_NEON_AUTH_URL;
    window.__EDDU_NEON_DATA_API_URL=EDDU_NEON_DATA_API_URL;
    window.__EDDU_NEON_READY=true;

    window.EDDU_NEON_GET_SESSION=async()=>client.auth.getSession();

    window.EDDU_NEON_SIGNIN=async(email,password)=>{
      const result=await client.auth.signIn.email({email,password});
      if(result?.error) throw new Error(result.error.message||'Falha no login');
      return result;
    };
    window.EDDU_NEON_SIGNUP=async(email,password,name)=>{const result=await client.auth.signUp.email({email,password,name});if(result?.error)throw new Error(result.error.message||'Falha no cadastro');return result;};
    window.EDDU_NEON_SIGNOUT=async()=>client.auth.signOut();

    window.__EDDU_NEON_AUTH_REQUIRED=()=>{
      if(document.getElementById('eddu-neon-auth-overlay')) return;
      const style=document.createElement('style');
      style.id='eddu-neon-auth-style';
      style.textContent='#eddu-neon-auth-overlay{position:fixed;inset:0;z-index:200000;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:18px}#eddu-neon-auth-card{width:min(430px,100%);background:#fff;border-radius:22px;padding:24px;box-shadow:0 20px 70px rgba(0,0,0,.25);font-family:inherit}#eddu-neon-auth-card h2{margin:0 0 8px}#eddu-neon-auth-card p{margin:0 0 18px;color:#666}.eddu-neon-auth-field{display:grid;gap:6px;margin:10px 0}.eddu-neon-auth-field input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:10px}.eddu-neon-auth-actions{display:grid;gap:10px;margin-top:16px}.eddu-neon-auth-actions button{padding:12px;border:0;border-radius:10px;cursor:pointer;font-weight:700}.eddu-neon-auth-primary{background:#6d3a86;color:#fff}.eddu-neon-auth-secondary{background:#f2edf5;color:#4b2a5d}.eddu-neon-auth-error{min-height:20px;color:#b42318;font-size:13px}';
      document.head.appendChild(style);
      const wrap=document.createElement('div');wrap.id='eddu-neon-auth-overlay';
      wrap.innerHTML='<div id="eddu-neon-auth-card"><h2>Acesso aos dados Master</h2><p>Use uma conta do Neon Auth para sincronizar os testes com o banco.</p><div class="eddu-neon-auth-field"><label>Nome (somente no cadastro)</label><input id="eddu-neon-auth-name" type="text" autocomplete="name" placeholder="Nome"></div><div class="eddu-neon-auth-field"><label>E-mail</label><input id="eddu-neon-auth-email" type="email" autocomplete="username" placeholder="seu e-mail"></div><div class="eddu-neon-auth-field"><label>Senha</label><input id="eddu-neon-auth-password" type="password" autocomplete="current-password" placeholder="sua senha"></div><div id="eddu-neon-auth-error" class="eddu-neon-auth-error"></div><div class="eddu-neon-auth-actions"><button class="eddu-neon-auth-primary" id="eddu-neon-auth-login">Entrar e sincronizar</button><button class="eddu-neon-auth-secondary" id="eddu-neon-auth-signup">Criar conta de homologação</button><button class="eddu-neon-auth-secondary" id="eddu-neon-auth-cancel">Continuar somente local</button></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelector('#eddu-neon-auth-cancel').onclick=()=>wrap.remove();
      wrap.querySelector('#eddu-neon-auth-signup').onclick=async()=>{
        const name=wrap.querySelector('#eddu-neon-auth-name').value.trim()||'ED DU Homologação';
        const email=wrap.querySelector('#eddu-neon-auth-email').value.trim();
        const password=wrap.querySelector('#eddu-neon-auth-password').value;
        const err=wrap.querySelector('#eddu-neon-auth-error');err.textContent='';
        if(!email||!password){err.textContent='Informe e-mail e senha para criar a conta.';return}
        if(password.length<8){err.textContent='Use uma senha com pelo menos 8 caracteres.';return}
        const btn=wrap.querySelector('#eddu-neon-auth-signup');btn.disabled=true;btn.textContent='Criando...';
        try{await window.EDDU_NEON_SIGNUP(email,password,name);await window.EDDU_NEON_SIGNIN(email,password);wrap.remove();if(typeof window.EDDU_NEON_SYNC==='function')window.EDDU_NEON_SYNC();}
        catch(e){err.textContent=String(e?.message||e);btn.disabled=false;btn.textContent='Criar conta de homologação'}
      };
      wrap.querySelector('#eddu-neon-auth-login').onclick=async()=>{
        const email=wrap.querySelector('#eddu-neon-auth-email').value.trim();
        const password=wrap.querySelector('#eddu-neon-auth-password').value;
        const err=wrap.querySelector('#eddu-neon-auth-error');
        err.textContent='';
        if(!email||!password){err.textContent='Informe e-mail e senha.';return}
        const btn=wrap.querySelector('#eddu-neon-auth-login');btn.disabled=true;btn.textContent='Entrando...';
        try{
          await window.EDDU_NEON_SIGNIN(email,password);
          wrap.remove();
          if(typeof window.EDDU_NEON_SYNC==='function') window.EDDU_NEON_SYNC();
        }catch(e){err.textContent=String(e?.message||e);btn.disabled=false;btn.textContent='Entrar e sincronizar'}
      };
    };

    try{
      const s=await client.auth.getSession();
      window.__EDDU_NEON_SESSION=!!s?.data?.session;
    }catch(_){window.__EDDU_NEON_SESSION=false}
    window.dispatchEvent(new CustomEvent('eddu-neon-ready'));
  }catch(e){
    window.__EDDU_NEON_LAST_ERROR=String(e?.message||e);
    window.__EDDU_NEON_READY=false;
  }
})();
if(location.hash==='#e2e-agenda'){
  queueMicrotask(()=>{
    try{window.switchRole?.('professional');window.openSheet?.('agenda');}
    catch(err){document.documentElement.dataset.edduE2EError=String(err?.message||err)}
  });
}
