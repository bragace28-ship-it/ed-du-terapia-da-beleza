import { neon } from '@neondatabase/serverless';

export function getSql(env: { DATABASE_URL?: string }) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL não configurada no Cloudflare.');
  return neon(env.DATABASE_URL);
}

export function json(data: unknown, status = 200, headers: Record<string,string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function bearer(request: Request) {
  const value = request.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}
