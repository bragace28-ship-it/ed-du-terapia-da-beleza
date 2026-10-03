import { neon } from '@neondatabase/serverless';

function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}

const DATA_API_FALLBACK='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
const PAYMENT_ROLES=new Set(['admin','manager','receptionist','finance']);

async function requireStaff(request,env){
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer\\s+\\S+$/i.test(auth)) return {ok:false,status:401,error:'Authentication required'};
  const base=String(env.NEON_DATA_API_URL||DATA_API_FALLBACK).replace(/\/$/,'');
  const r=await fetch(base+'/profiles?select=id,role,active&limit=1',{
    headers:{Authorization:auth,Accept:'application/json'}
  });
  if(!r.ok) return {ok:false,status:401,error:'Invalid or expired Neon Auth session'};
  const rows=await r.json().catch(()=>[]);
  const profile=Array.isArray(rows)?rows[0]:null;
  if(!profile?.id||profile.active===false||!PAYMENT_ROLES.has(String(profile.role||'')))
    return {ok:false,status:403,error:'Payment operation requires an authorized staff role'};
  return {ok:true,profile};
}

export async function onRequestGet({request,env}) {
  if(!env.NEON_DATABASE_URL) return json({ok:false,error:'Payment integration not configured'},503);
  const auth=await requireStaff(request,env);
  if(!auth.ok) return json({ok:false,error:auth.error},auth.status);
  const sql=neon(env.NEON_DATABASE_URL);
  const rows=await sql`
    select id,command_id,client_id,amount,method,gateway,brand,installments,status,external_id,idempotency_key,paid_at,metadata,created_at,updated_at
      from payments
     order by created_at desc
     limit 100
  `;
  return json({ok:true,payments:rows});
}

export async function onRequestPost({request,env}) {
  if(!env.NEON_DATABASE_URL || !env.ASAAS_API_KEY) return json({ok:false,error:'Payment integration not configured'},503);
  const auth=await requireStaff(request,env);
  if(!auth.ok) return json({ok:false,error:auth.error},auth.status);
  let body;
  try { body=await request.json(); } catch { return json({ok:false,error:'Invalid JSON'},400); }

  const amount=Number(body.amount);
  const customer=String(body.customer||body.asaasCustomerId||'').trim();
  const billingType=String(body.billingType||'UNDEFINED').toUpperCase();
  const dueDate=String(body.dueDate||new Date().toISOString().slice(0,10));
  const installments=Math.max(1,Math.min(24,Number(body.installmentCount||1)||1));
  const clientId=body.clientId?String(body.clientId):null;
  const commandId=body.commandId?String(body.commandId):null;

  if(!(amount>0) || !customer || !['UNDEFINED','BOLETO','CREDIT_CARD','PIX'].includes(billingType))
    return json({ok:false,error:'amount, Asaas customer and valid billingType are required'},400);
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(dueDate))
    return json({ok:false,error:'dueDate must be YYYY-MM-DD'},400);

  const base=String(env.ASAAS_BASE_URL||'https://api-sandbox.asaas.com/v3').replace(/\\/$/,'');
  const externalReference=String(body.externalReference||('EDDU-'+crypto.randomUUID()));
  const idem=String(request.headers.get('Idempotency-Key')||externalReference);
  const sql=neon(env.NEON_DATABASE_URL);

  const [existing]=await sql`select id,external_id,status,metadata from payments where idempotency_key=${idem} limit 1`;
  if(existing) return json({ok:true,replayed:true,payment:existing},200);

  const payload={
    customer,
    billingType,
    value:amount,
    dueDate,
    description:String(body.description||'ED & DU | Terapia da Beleza').slice(0,500),
    externalReference
  };
  if(installments>1){
    payload.installmentCount=installments;
    payload.totalValue=amount;
  }

  const upstream=await fetch(base+'/payments',{
    method:'POST',
    headers:{'Content-Type':'application/json','access_token':env.ASAAS_API_KEY},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(30000)
  });
  const data=await upstream.json().catch(()=>({}));
  if(!upstream.ok) return json({ok:false,error:'Asaas rejected payment',details:data},upstream.status);

  let pix=null;
  if(billingType==='PIX' && data.id){
    const qr=await fetch(base+'/payments/'+encodeURIComponent(String(data.id))+'/pixQrCode',{
      headers:{'access_token':env.ASAAS_API_KEY},
      signal:AbortSignal.timeout(15000)
    });
    if(qr.ok) pix=await qr.json().catch(()=>null);
  }

  const metadata={
    asaasCustomerId:customer,
    invoiceUrl:data.invoiceUrl||null,
    bankSlipUrl:data.bankSlipUrl||null,
    pixQrCode:pix||null,
    provider:data
  };

  const [row]=await sql`
    insert into payments(command_id,client_id,amount,method,gateway,installments,status,external_id,idempotency_key,metadata)
    values(${commandId},${clientId},${amount},${billingType},'Asaas',${installments},${String(data.status||'PENDING')},${String(data.id||'')},${idem},${JSON.stringify(metadata)}::jsonb)
    returning id,command_id,client_id,amount,method,gateway,installments,status,external_id,idempotency_key,metadata,created_at
  `;
  return json({ok:true,payment:row,provider:data,pix},201);
}
