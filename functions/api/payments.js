const DATA_API_FALLBACK='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
const PAYMENT_ROLES=new Set(['admin','manager','receptionist','finance']);

function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}

async function requireStaff(request,env){
  const auth=request.headers.get('authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(auth)) return {ok:false,status:401,error:'Authentication required'};
  const base=String(env.NEON_DATA_API_URL||DATA_API_FALLBACK).replace(/\/$/,'');
  const r=await fetch(base+'/profiles?select=id,role,active&limit=1',{headers:{Authorization:auth,Accept:'application/json'}});
  if(!r.ok) return {ok:false,status:401,error:'Invalid or expired Neon Auth session'};
  const rows=await r.json().catch(()=>[]);
  const profile=Array.isArray(rows)?rows[0]:null;
  if(!profile?.id||profile.active===false||!PAYMENT_ROLES.has(String(profile.role||'')))
    return {ok:false,status:403,error:'Payment operation requires an authorized staff role'};
  return {ok:true,profile,auth};
}

async function dataApi(request,env,auth,path,options={}){
  const base=String(env.NEON_DATA_API_URL||DATA_API_FALLBACK).replace(/\/$/,'');
  const headers=Object.assign({Authorization:auth,Accept:'application/json'},options.headers||{});
  const r=await fetch(base+path,Object.assign({},options,{headers}));
  const data=await r.json().catch(()=>[]);
  if(!r.ok) throw new Error(data?.message||data?.hint||'Neon Data API request failed');
  return data;
}

export async function onRequestGet({request,env}) {
  const auth=await requireStaff(request,env);
  if(!auth.ok) return json({ok:false,error:auth.error},auth.status);
  try{
    const rows=await dataApi(request,env,auth.auth,'/payments?select=id,command_id,client_id,amount,method,gateway,brand,installments,status,external_id,idempotency_key,paid_at,metadata,created_at,updated_at&order=created_at.desc&limit=100');
    return json({ok:true,payments:Array.isArray(rows)?rows:[]});
  }catch(e){return json({ok:false,error:String(e.message||e)},502)}
}

export async function onRequestPost({request,env}) {
  if(!env.ASAAS_API_KEY) return json({ok:false,error:'ASAAS_API_KEY is not configured in Cloudflare'},503);
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
  if(!(amount>0)||!customer||!['UNDEFINED','BOLETO','CREDIT_CARD','PIX'].includes(billingType))
    return json({ok:false,error:'amount, Asaas customer and valid billingType are required'},400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    return json({ok:false,error:'dueDate must be YYYY-MM-DD'},400);

  const base=String(env.ASAAS_BASE_URL||'https://api-sandbox.asaas.com/v3').replace(/\/$/,'');
  const externalReference=String(body.externalReference||('EDDU-'+crypto.randomUUID()));
  const idem=String(request.headers.get('Idempotency-Key')||externalReference);
  const existingRows=await dataApi(request,env,auth.auth,'/payments?select=id,external_id,status,metadata&idempotency_key=eq.'+encodeURIComponent(idem)+'&limit=1');
  if(Array.isArray(existingRows)&&existingRows[0])return json({ok:true,replayed:true,payment:existingRows[0]},200);

  const payload={customer,billingType,value:amount,dueDate,description:String(body.description||'ED & DU | Terapia da Beleza').slice(0,500),externalReference};
  if(installments>1){payload.installmentCount=installments;payload.totalValue=amount;}

  const upstream=await fetch(base+'/payments',{method:'POST',headers:{'Content-Type':'application/json','access_token':env.ASAAS_API_KEY},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
  const provider=await upstream.json().catch(()=>({}));
  if(!upstream.ok)return json({ok:false,error:'Asaas rejected payment',details:provider},upstream.status);

  let pix=null;
  if(billingType==='PIX'&&provider.id){
    const qr=await fetch(base+'/payments/'+encodeURIComponent(String(provider.id))+'/pixQrCode',{headers:{'access_token':env.ASAAS_API_KEY},signal:AbortSignal.timeout(15000)});
    if(qr.ok)pix=await qr.json().catch(()=>null);
  }

  const metadata={asaasCustomerId:customer,invoiceUrl:provider.invoiceUrl||null,bankSlipUrl:provider.bankSlipUrl||null,pixQrCode:pix||null,provider};
  const inserted=await dataApi(request,env,auth.auth,'/payments',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({command_id:commandId,client_id:clientId,amount,method:billingType,gateway:'Asaas',installments,status:String(provider.status||'PENDING'),external_id:String(provider.id||''),idempotency_key:idem,metadata})});
  const row=Array.isArray(inserted)?inserted[0]:inserted;
  return json({ok:true,payment:row,provider,pix},201);
}
