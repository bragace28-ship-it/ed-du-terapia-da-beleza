import { neon } from '@neondatabase/serverless';

function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}

export async function onRequestPost({request,env}) {
  if(!env.NEON_DATABASE_URL || !env.ASAAS_API_KEY) return json({ok:false,error:'Payment integration not configured'},503);
  let body;
  try { body=await request.json(); } catch { return json({ok:false,error:'Invalid JSON'},400); }
  const amount=Number(body.amount);
  const customer=String(body.customer||'');
  const billingType=String(body.billingType||'UNDEFINED');
  const dueDate=String(body.dueDate||new Date().toISOString().slice(0,10));
  if(!(amount>0) || !customer || !['UNDEFINED','BOLETO','CREDIT_CARD','PIX'].includes(billingType))
    return json({ok:false,error:'amount, customer and billingType are required'},400);

  const base=env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';
  const externalReference=String(body.externalReference||('EDDU-'+crypto.randomUUID()));
  const idem=String(request.headers.get('Idempotency-Key')||externalReference);

  const sql=neon(env.NEON_DATABASE_URL);
  const [existing]=await sql`select id,external_id,status from payments where idempotency_key=${idem} limit 1`;
  if(existing) return json({ok:true,replayed:true,payment:existing},200);

  const payload={
    customer,
    billingType,
    value:amount,
    dueDate,
    description:String(body.description||'ED & DU | Terapia da Beleza'),
    externalReference
  };
  if(Number(body.installmentCount)>1){
    payload.installmentCount=Number(body.installmentCount);
    payload.totalValue=amount;
  }

  const upstream=await fetch(base+'/payments',{
    method:'POST',
    headers:{'Content-Type':'application/json','access_token':env.ASAAS_API_KEY},
    body:JSON.stringify(payload)
  });
  const data=await upstream.json().catch(()=>({}));
  if(!upstream.ok) return json({ok:false,error:'Asaas rejected payment',details:data},upstream.status);

  const [row]=await sql`
    insert into payments(amount,method,gateway,status,external_id,idempotency_key,metadata)
    values(${amount},${billingType},'Asaas',${String(data.status||'PENDING')},${String(data.id||'')},${idem},${JSON.stringify(data)}::jsonb)
    returning id,status,external_id
  `;
  return json({ok:true,payment:row,provider:data},201);
}
