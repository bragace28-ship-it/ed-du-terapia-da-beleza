import { getSql, json } from '../_lib/db';

export async function onRequestGet({ env }: any) {
  try {
    const sql = getSql(env);
    const rows = await sql`select now() as database_time`;
    return json({ ok: true, service: 'ed-du-api', authority: 'neon', database: true, database_time: rows[0]?.database_time ?? null });
  } catch (error: any) {
    return json({ ok: false, service: 'ed-du-api', authority: 'neon', database: false, error: error?.message || 'healthcheck failed' }, 503);
  }
}
