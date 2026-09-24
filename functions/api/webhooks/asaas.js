import { neon } from '@neondatabase/serverless';

export async function onRequestPost({request,env}) {
  if(!env.NEON_DATABASE_URL) return Response.json({ok:false,error:'NEON_DATABASE_URL not configured'},{status:503});
  const token=request.headers.get('asaas-access-token')||'';
  if(!env.ASAAS_WEBHOOK_TOKEN || token!==env.ASAAS_WEBHOOK_TOKEN)
    return Response.json({ok:false,error:'Unauthorized'},{status:401});
  const event=await request.json().catch(()=>null);
  if(!event?.payment?.id) return Response.json({ok:true,ignored:true});
  const sql=neon(env.NEON_DATABASE_URL);
  const p=event.payment;
  await sql`
    update payments
       set status=${String(p.status||event.event||'UNKNOWN')},
           paid_at=case when ${String(p.status||'')} in ('RECEIVED','CONFIRMED') then coalesce(paid_at,now()) else paid_at end,
           metadata=coalesce(metadata,'{}'::jsonb) || ${JSON.stringify(event)}::jsonb,
           updated_at=now()
     where external_id=${String(p.id)}
  `;
  return Response.json({ok:true});
}
