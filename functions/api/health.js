import { neon } from '@neondatabase/serverless';

export async function onRequestGet({ env }) {
  const started = Date.now();
  if (!env.NEON_DATABASE_URL) {
    return Response.json({ ok:false, service:'neon', error:'NEON_DATABASE_URL not configured' }, { status:503 });
  }
  try {
    const sql = neon(env.NEON_DATABASE_URL);
    const [row] = await sql`select current_database() as database_name, now() as server_time`;
    return Response.json({
      ok:true,
      service:'neon',
      database:row.database_name,
      serverTime:row.server_time,
      latencyMs:Date.now()-started
    }, { headers:{'Cache-Control':'no-store'} });
  } catch (error) {
    return Response.json({ ok:false, service:'neon', error:'database connection failed' }, { status:503 });
  }
}
