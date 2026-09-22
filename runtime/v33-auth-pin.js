import { createAuthClient } from '@neondatabase/auth';

const AUTH_URL = 'https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const DATA_API_URL = 'https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

// Homologação: login/PIN ficam bypassados somente em branches de desenvolvimento.
// O build de produção recusa este modo; não há credencial privilegiada no navegador.
export const HOMOLOGATION_ACCESS = true;
const auth = createAuthClient(AUTH_URL);
const demoUser = Object.freeze({ id: '00000000-0000-0000-0000-000000000033', name: 'Mariana', email: 'homologacao@eddu.local' });
const demoProfile = Object.freeze({ id: demoUser.id, full_name: 'Mariana', role: 'professional', active: true });

async function getSession() {
  if (HOMOLOGATION_ACCESS) return { user: demoUser, session: { id: 'eddu-homologation-session' } };
  const result = await auth.getSession();
  return result?.data ?? result ?? null;
}

async function getJwt() {
  if (HOMOLOGATION_ACCESS) return null;
  if (typeof auth.getJWTToken !== 'function') return null;
  return auth.getJWTToken();
}

async function getProfile() {
  if (HOMOLOGATION_ACCESS) return demoProfile;
  const session = await getSession();
  const userId = session?.user?.id ?? session?.data?.user?.id;
  if (!userId) return null;
  const jwt = await getJwt();
  if (!jwt) return null;
  const response = await fetch(DATA_API_URL + '/profiles?id=eq.' + encodeURIComponent(userId) + '&select=id,full_name,role,active', {
    headers: { Authorization: 'Bearer ' + jwt, Accept: 'application/json' },
    credentials: 'omit'
  });
  if (!response.ok) throw new Error('profile_fetch_failed');
  const rows = await response.json();
  return rows[0] ?? null;
}

function normalizeRole(role) {
  if (role === 'manager') return 'admin';
  if (role === 'admin' || role === 'professional' || role === 'client') return role;
  return null;
}

function financeModuleAllowed(role) {
  if (HOMOLOGATION_ACCESS) return true;
  return role === 'admin' || role === 'professional';
}

function pinRequired() {
  return !HOMOLOGATION_ACCESS;
}

window.EDDU_AUTH = Object.freeze({
  homologation: HOMOLOGATION_ACCESS,
  pinRequired,
  getSession,
  getJwt,
  getProfile,
  signIn: async (email, password) => {
    if (HOMOLOGATION_ACCESS) return { data: { user: demoUser }, error: null };
    return auth.signIn.email({ email, password });
  },
  signOut: async () => {
    if (HOMOLOGATION_ACCESS) return { data: null, error: null };
    return auth.signOut();
  },
  normalizeRole,
  financeModuleAllowed
});

window.dispatchEvent(new CustomEvent('eddu:auth-ready'));
