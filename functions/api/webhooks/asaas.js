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
    const providerStatus=String(p.status||eventName);
    const paid=['RECEIVED','CONFIRMED'].includes(providerStatus);
    await sql`update payments set status=${providerStatus},paid_at=case when ${paid} then coalesce(paid_at,now()) else paid_at end,metadata=coalesce(metadata,'{}'::jsonb)||${JSON.stringify(event)}::jsonb,updated_at=now() where external_id=${String(p.id)}`;
    if(paid){
      const rows=await sql`select command_id from payments where external_id=${String(p.id)} and command_id is not null limit 1`;
      const commandId=rows[0]?.command_id;
      if(commandId){
        const sums=await sql`select coalesce(sum(amount),0) total from payments where command_id=${commandId} and upper(status) in ('RECEIVED','CONFIRMED','PAID')`;
        const commands=await sql`select id,net_amount from commands where id=${commandId} limit 1`;
        if(commands[0]&&Number(sums[0]?.total||0)+0.009>=Number(commands[0].net_amount||0)){
          await sql`update commands set status='Fechada',updated_at=now() where id=${commandId} and status<>'Fechada'`;
        }
      }
    }
  }
  if(event.checkout?.id){
    const checkoutId=String(event.checkout.id);
    const status=eventName==='CHECKOUT_PAID'?'RECEIVED':eventName==='CHECKOUT_CANCELED'?'CANCELLED':eventName==='CHECKOUT_EXPIRED'?'EXPIRED':String(event.checkout.status||eventName);
    const paid=eventName==='CHECKOUT_PAID';
    await sql`update payments set status=${status},paid_at=case when ${paid} then coalesce(paid_at,now()) else paid_at end,metadata=coalesce(metadata,'{}'::jsonb)||${JSON.stringify({...event,_webhookEventId:eventId})}::jsonb,updated_at=now() where external_id=${checkoutId} or metadata->>'checkoutId'=${checkoutId}`;
    if(paid){
      const rows=await sql`select command_id from payments where (external_id=${checkoutId} or metadata->>'checkoutId'=${checkoutId}) and command_id is not null limit 1`;
      const commandId=rows[0]?.command_id;
      if(commandId){
        const sums=await sql`select coalesce(sum(amount),0) total from payments where command_id=${commandId} and upper(status) in ('RECEIVED','CONFIRMED','PAID')`;
        const commands=await sql`select id,net_amount from commands where id=${commandId} limit 1`;
        if(commands[0]&&Number(sums[0]?.total||0)+0.009>=Number(commands[0].net_amount||0)){
          await sql`update commands set status='Fechada',updated_at=now() where id=${commandId} and status<>'Fechada'`;
        }
      }
    }
  }
  return Response.json({ok:true});
}