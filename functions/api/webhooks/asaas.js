import { neon } from '@neondatabase/serverless';

export async function onRequestPost({request,env}) {
  if(!env.NEON_DATABASE_URL) return Response.json({ok:false,error:'NEON_DATABASE_URL not configured'},{status:503});
  const token=request.headers.get('asaas-access-token')||'';
  if(!env.ASAAS_WEBHOOK_TOKEN || token!==env.ASAAS_WEBHOOK_TOKEN) return Response.json({ok:false,error:'Unauthorized'},{status:401});
  const event=await request.json().catch(()=>null);
  if(!event?.event) return Response.json({ok:true,ignored:true});
  const sql=neon(env.NEON_DATABASE_URL);
  const eventName=String(event.event), eventId=String(event.id||'');
  if(event.payment?.id){
    const p=event.payment;
    await sql`update payments set status=${String(p.status||eventName)},paid_at=case when ${String(p.status||'')} in ('RECEIVED','CONFIRMED') then coalesce(paid_at,now()) else paid_at end,metadata=coalesce(metadata,'{}'::jsonb)||${JSON.stringify(event)}::jsonb,updated_at=now() where external_id=${String(p.id)}`;
  }
  if(event.checkout?.id){
    const checkoutId=String(event.checkout.id);
    const status=eventName==='CHECKOUT_PAID'?'RECEIVED':eventName==='CHECKOUT_CANCELED'?'CANCELLED':eventName==='CHECKOUT_EXPIRED'?'EXPIRED':String(event.checkout.status||eventName);
    const paid=eventName==='CHECKOUT_PAID';
    await sql`update payments set status=${status},paid_at=case when ${paid} then coalesce(paid_at,now()) else paid_at end,metadata=coalesce(metadata,'{}'::jsonb)||${JSON.stringify({...event,_webhookEventId:eventId})}::jsonb,updated_at=now() where external_id=${checkoutId} or metadata->>'checkoutId'=${checkoutId}`;
    if(paid) await sql`update commands set status='Fechada',updated_at=now() where id in (select command_id from payments where external_id=${checkoutId} or metadata->>'checkoutId'=${checkoutId})`;
  }
  return Response.json({ok:true});
}