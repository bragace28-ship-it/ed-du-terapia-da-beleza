/* ED & DU MASTER 46.0.0 — Neon Auth. No local-only access path. */
(function () {
  'use strict';
  const AUTH_URL = 'https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
  const DATA_API_URL = 'https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
  const PUBLIC_DEV_MODE = true;
  window.EDDU_PUBLIC_DEV_MODE = PUBLIC_DEV_MODE;

  const dispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const waitForBody = () => document.body ? Promise.resolve() : new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));

  async function start() {
    if (PUBLIC_DEV_MODE) {
      window.__EDDU_NEON_READY = true;
      window.__EDDU_NEON_SESSION = true;
      window.__EDDU_NEON_SESSION_DATA = { publicDevelopment:true, user:{ email:'public-development@eddu.local' } };
      window.EDDU_NEON_REFRESH_SESSION = async () => window.__EDDU_NEON_SESSION_DATA;
      window.EDDU_NEON_GET_SESSION = window.EDDU_NEON_REFRESH_SESSION;
      window.EDDU_NEON_SIGNIN = async () => { throw new Error('Login desativado durante o desenvolvimento público.'); };
      window.EDDU_NEON_SIGNOUT = async () => ({ data:{ session:null } });
      dispatch('eddu-neon-ready', { authenticated:true, publicDevelopment:true });
      return;
    }
    try {
      const mod = await import('/neon-auth-sdk.bundle.js');
      const client = mod.createClient({ auth: { url: AUTH_URL }, dataApi: { url: DATA_API_URL } });
      window.__EDDU_NEON_CLIENT = client;
      window.__EDDU_NEON_AUTH_URL = AUTH_URL;
      window.__EDDU_NEON_DATA_API_URL = DATA_API_URL;
      window.__EDDU_NEON_READY = true;
      window.EDDU_NEON_GET_SESSION = () => client.auth.getSession();
      window.EDDU_NEON_SIGNIN = async (email, password) => {
        const result = await client.auth.signIn.email({ email: String(email).trim(), password });
        if (result?.error) throw new Error(result.error.message || 'Falha na autenticação.');
        return result;
      };
      window.EDDU_NEON_SIGNOUT = async () => {
        const result = await client.auth.signOut();
        if (result?.error) throw new Error(result.error.message || 'Falha ao sair.');
        window.__EDDU_NEON_SESSION = false;
        dispatch('eddu-neon-session-changed', { authenticated: false });
        return result;
      };

      async function sessionState() {
        const result = await client.auth.getSession();
        if (result?.error) throw new Error(result.error.message || 'Não foi possível validar a sessão.');
        const session = result?.data?.session || null;
        window.__EDDU_NEON_SESSION = !!session;
        window.__EDDU_NEON_SESSION_DATA = session;
        dispatch('eddu-neon-session-changed', { authenticated: !!session });
        return session;
      }

      window.EDDU_NEON_REFRESH_SESSION = sessionState;
      const session = await sessionState();
      dispatch('eddu-neon-ready', { authenticated: !!session });
      if (!session) {
        await waitForBody();
        showLogin();
      }
    } catch (error) {
      window.__EDDU_NEON_READY = false;
      window.__EDDU_NEON_LAST_ERROR = String(error?.message || error);
      dispatch('eddu-neon-ready', { authenticated: false, error: window.__EDDU_NEON_LAST_ERROR });
      console.error('[EDDU] Neon Auth initialization failed:', error);
    }
  }

  function showLogin() {
    if (document.getElementById('eddu-neon-auth-overlay')) return;
    const style = document.createElement('style');
    style.id = 'eddu-neon-auth-style';
    style.textContent = '#eddu-neon-auth-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(20,15,24,.68);display:flex;align-items:center;justify-content:center;padding:18px}#eddu-neon-auth-card{width:min(420px,100%);background:#fff;color:#242027;border-radius:20px;padding:26px;box-shadow:0 20px 70px rgba(0,0,0,.3);font-family:inherit}#eddu-neon-auth-card h2{margin:0 0 8px}#eddu-neon-auth-card p{margin:0 0 18px;color:#6d6870}.eddu-auth-field{display:grid;gap:6px;margin:12px 0}.eddu-auth-field input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #d9d4dc;border-radius:10px}.eddu-auth-actions{display:grid;gap:10px;margin-top:18px}.eddu-auth-actions button{padding:13px;border:0;border-radius:10px;background:#6d3a86;color:white;font-weight:700;cursor:pointer}.eddu-auth-actions button:disabled{opacity:.6;cursor:wait}.eddu-auth-error{min-height:20px;color:#b42318;font-size:13px}';
    document.head.appendChild(style);
    const overlay = document.createElement('div');
    overlay.id = 'eddu-neon-auth-overlay';
    overlay.innerHTML = '<section id="eddu-neon-auth-card" role="dialog" aria-modal="true" aria-labelledby="eddu-neon-auth-title"><h2 id="eddu-neon-auth-title">Entrar no ED & DU</h2><p>Entre com sua conta para acessar os dados sincronizados.</p><form id="eddu-neon-auth-form"><div class="eddu-auth-field"><label for="eddu-neon-email">E-mail</label><input id="eddu-neon-email" type="email" autocomplete="username" required></div><div class="eddu-auth-field"><label for="eddu-neon-password">Senha</label><input id="eddu-neon-password" type="password" autocomplete="current-password" required></div><div id="eddu-neon-auth-error" class="eddu-auth-error" role="alert"></div><div class="eddu-auth-actions"><button id="eddu-neon-login" type="submit">Entrar e sincronizar</button></div></form></section>';
    document.body.appendChild(overlay);
    overlay.querySelector('#eddu-neon-auth-form').addEventListener('submit', async event => {
      event.preventDefault();
      const button = overlay.querySelector('#eddu-neon-login');
      const errorNode = overlay.querySelector('#eddu-neon-auth-error');
      const email = overlay.querySelector('#eddu-neon-email').value.trim();
      const password = overlay.querySelector('#eddu-neon-password').value;
      button.disabled = true;
      button.textContent = 'Validando acesso…';
      errorNode.textContent = '';
      try {
        await window.EDDU_NEON_SIGNIN(email, password);
        const session = await window.EDDU_NEON_REFRESH_SESSION();
        if (!session) throw new Error('A autenticação não retornou uma sessão válida.');
        overlay.remove();
        dispatch('eddu-neon-authenticated', { authenticated: true });
        if (typeof window.EDDU_NEON_SYNC === 'function') await window.EDDU_NEON_SYNC();
      } catch (error) {
        errorNode.textContent = String(error?.message || error);
        button.disabled = false;
        button.textContent = 'Entrar e sincronizar';
      }
    });
  }

  window.__EDDU_NEON_AUTH_REQUIRED = showLogin;
  start();
})();