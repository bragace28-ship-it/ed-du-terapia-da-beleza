import { createRemoteJWKSet, jwtVerify } from 'jose';
import { bearer } from './db';

const JWKS_URL = 'https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth/.well-known/jwks.json';
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

export async function requireUser(request: Request, sql: any) {
  const token = bearer(request);
  if (!token) throw new Error('Sessão não encontrada.');
  const { payload } = await jwtVerify(token, jwks, { algorithms: ['RS256'] });
  const userId = String(payload.sub || '');
  if (!userId) throw new Error('Token sem usuário.');
  const rows = await sql`select id, full_name, role, active from public.profiles where id = ${userId} limit 1`;
  const profile = rows[0];
  if (!profile || profile.active === false) throw new Error('Usuário sem perfil ativo.');
  return { userId, profile, payload };
}

export function requireRole(profile: any, roles: string[]) {
  if (!roles.includes(String(profile?.role || ''))) throw new Error('Perfil sem permissão para esta operação.');
}
