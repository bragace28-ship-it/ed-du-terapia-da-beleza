import { createAuthClient } from '@neondatabase/auth';

const AUTH_URL = 'https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const DATA_API_URL = 'https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

const auth = createAuthClient(AUTH_URL, { allowAnonymous: true });

function apiError(status, body) {
  const message = body?.message || body?.error || ('neon_data_api_' + status);
  const error = new Error(message);
  error.status = status;
  error.body = body;
  return error;
}

async function token() {
  if (typeof auth.getJWTToken !== 'function') throw new Error('neon_auth_jwt_unavailable');
  const jwt = await auth.getJWTToken();
  if (!jwt) throw new Error('neon_anonymous_token_unavailable');
  return jwt;
}

async function request(table, { method='GET', query='', body, prefer='return=representation' }={}) {
  const jwt = await token();
  const response = await fetch(DATA_API_URL + '/' + encodeURIComponent(table) + query, {
    method,
    headers: {
      Authorization: 'Bearer ' + jwt,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: prefer
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'omit'
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw apiError(response.status, payload);
  return payload;
}

export const neonData = Object.freeze({
  auth,
  request,
  select: (table, query='?select=*') => request(table, { query }),
  insert: (table, row) => request(table, { method:'POST', body:row }),
  update: (table, query, row) => request(table, { method:'PATCH', query, body:row }),
  delete: (table, query) => request(table, { method:'DELETE', query, prefer:'return=representation' }),
  health: async () => {
    const result = await request('appointments', { query:'?select=id&limit=1' });
    return { ok:true, table:'appointments', sampleCount:Array.isArray(result) ? result.length : 0 };
  }
});

window.EDDU_NEON = neonData;
window.EDDU_NEON_TEST_MODE = true;
