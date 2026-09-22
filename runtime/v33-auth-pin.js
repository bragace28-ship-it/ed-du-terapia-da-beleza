import { createAuthClient } from '@neondatabase/auth';

const AUTH_URL = 'https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const DATA_API_URL = 'https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

const auth = createAuthClient(AUTH_URL);

async function getSession() {
  const result = await auth.getSession();
  return result?.data ?? result ?? null;
}

async function getJwt() {
  if (typeof auth.getJWTToken !== 'function') return null;
  return auth.getJWTToken();
}

async function getProfile() {
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
  return role === 'admin' || role === 'professional';
}

window.EDDU_AUTH = Object.freeze({
  getSession,
  getJwt,
  getProfile,
  signIn: (email, password) => auth.signIn.email({ email, password }),
  signOut: () => auth.signOut(),
  normalizeRole,
  financeModuleAllowed
});

window.dispatchEvent(new CustomEvent('eddu:auth-ready'));
