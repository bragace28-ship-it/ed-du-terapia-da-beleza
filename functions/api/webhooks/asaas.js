import { settlePayment } from '../_lib/payment-settlement.js';

export async function onRequestPost({request,env}) {
  if(!env.NEON_DATABASE_URL) return Response.json({ok:false,error:'NEON_DATABASE_URL not configured'},{status:503});
  const token=request.headers.get('asaas-access-token')||'';
  if(!env.ASAAS_WEBHOOK_TOKEN || token!==env.ASAAS_WEBHOOK_TOKEN) return Response.json({ok:false,error:'Unauthorized'},{status:401});
  const event=await request.json().catch(()=>null);
  if(!event?.event) return Response.json({ok:true,ignored:true});
  const p=event.payment||{},checkout=event.checkout||{};
  const providerStatus=String(p.status||checkout.status||event.event).toUpperCase();
  const paid=['RECEIVED','CONFIRMED','CHECKOUT_PAID','PAID'].includes(providerStatus)||event.event==='PAYMENT_RECEIVED'||event.event==='PAYMENT_CONFIRMED';
  const external=[p.id,checkout.id].filter(Boolean).map(String);
  const result=await settlePayment({env,provider:'Asaas',eventId:event.id||event.event+'-'+(p.id||checkout.id||''),eventType:event.event,payload:event,externalIds:external,reference:p.externalReference||checkout.externalReference||'',paid,status:paid?'PAID':providerStatus});
  return Response.json({ok:true,...result});
}
