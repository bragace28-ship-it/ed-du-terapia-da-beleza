import { getSql, json } from '../../../_lib/db';

const b64=(value:string)=>{const s=value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=');const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0));};
const bytesEqual=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

async function verifyStripe(raw:string, signature:string, secret:string){
  const parts=Object.fromEntries(signature.split(',').map(x=>x.split('='))) as any;
  const ts=parts.t, sig=parts.v1;
  if(!ts||!sig||Math.abs(Date.now()/1000-Number(ts))>300)return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${raw}`)));
  return bytesEqual(mac,b64(sig));
}

async function verifyPagbank(raw:string, signature:string, env:any){
  if(!env.PAGBANK_ACCESS_TOKEN)return false;
  const keyResp=await fetch('https://api.pagseguro.com/public-keys?type=webhook',{headers:{accept:'application/json',Authorization:`Bearer ${env.PAGBANK_ACCESS_TOKEN}`}});
  const keyJson=await keyResp.json();
  if(!keyResp.ok||!keyJson.public_key)return false;
  const key=await crypto.subtle.importKey('spki',b64(keyJson.public_key),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const signatures=signature.split(',').map(s=>s.trim()).filter(Boolean);
  for(const item of signatures){const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,b64(item),new TextEncoder().encode(raw));if(ok)return true;}
  return false;
}

async function verifyAsaas(request:Request, env:any){
  const expected=String(env.ASAAS_WEBHOOK_TOKEN||'');
  return !!expected && request.headers.get('asaas-access-token')===expected;
}

function mapStatus(provider:string,payload:any){
  const event=String(payload?.type||payload?.event||payload?.status||payload?.data?.status||payload?.charges?.[0]?.status||'').toUpperCase();
  if(provider==='stripe'){
    if(event==='CHECKOUT.SESSION.COMPLETED' && String(payload?.data?.object?.payment_status||'').toLowerCase()==='paid')return 'PAID';
    if(event==='PAYMENT_INTENT.SUCCEEDED')return 'PAID';
    if(event.includes('FAILED'))return 'FAILED';
    if(event.includes('CANCELED')||event.includes('CANCELLED'))return 'CANCELLED';
  }
  if(provider==='asaas'){
    if(['CHECKOUT_PAID','PAYMENT_RECEIVED','PAYMENT_CONFIRMED'].includes(event))return 'PAID';
    if(['CHECKOUT_CANCELED','PAYMENT_DELETED'].includes(event))return 'CANCELLED';
    if(event.includes('OVERDUE')||event.includes('FAILED'))return 'FAILED';
  }
  if(provider==='pagbank'){
    if(['PAID','AUTHORIZED'].includes(event))return 'PAID';
    if(['DECLINED','CANCELED','CANCELLED'].includes(event))return event.startsWith('CANCEL')?'CANCELLED':'FAILED';
    if(['IN_ANALYSIS','WAITING'].includes(event))return 'PROCESSING';
  }
  return 'PROCESSING';
}

function commandId(provider:string,payload:any){
  if(provider==='stripe')return payload?.data?.object?.metadata?.command_id||payload?.data?.object?.client_reference_id||null;
  if(provider==='asaas')return payload?.payment?.externalReference||payload?.data?.externalReference||payload?.checkout?.externalReference||payload?.externalReference||null;
  return payload?.reference_id||payload?.checkout?.reference_id||payload?.order?.reference_id||null;
}

function externalId(provider:string,payload:any){
  if(provider==='stripe')return payload?.data?.object?.id||null;
  if(provider==='asaas')return payload?.payment?.id||payload?.data?.id||payload?.checkout?.id||payload?.id||null;
  return payload?.id||payload?.checkout?.id||payload?.order?.id||null;
}

export async function onRequestPost({request,env,params}:any){
  const provider=String(params?.provider||'').toLowerCase();
  if(!['stripe','asaas','pagbank'].includes(provider))return json({error:'Gateway inválido.'},404);
  const raw=await request.text();
  let signatureValid=false;
  if(provider==='stripe')signatureValid=await verifyStripe(raw,request.headers.get('stripe-signature')||'',env.STRIPE_WEBHOOK_SECRET||'');
  if(provider==='asaas')signatureValid=await verifyAsaas(request,env);
  if(provider==='pagbank')signatureValid=await verifyPagbank(raw,request.headers.get('x-payload-signature')||'',env);
  if(!signatureValid)return json({error:'Webhook não autenticado.'},401);
  let payload:any;try{payload=JSON.parse(raw)}catch{return json({error:'Payload inválido.'},400)}
  const eventId=String(payload?.id||request.headers.get('x-product-id')||externalId(provider,payload)||crypto.randomUUID());
  const eventType=String(payload?.type||payload?.event||payload?.status||payload?.data?.status||'UNKNOWN');
  const sql=getSql(env);
  try{
    const inserted=await sql`insert into public.webhook_events (provider,event_id,event_type,signature_valid,processed,payload) values (${provider},${eventId},${eventType},true,false,${JSON.stringify(payload)}::jsonb) on conflict (provider,event_id) do nothing returning id`;
    if(!inserted.length)return json({ok:true,duplicate:true});
    const cid=commandId(provider,payload);
    const ext=externalId(provider,payload);
    const status=mapStatus(provider,payload);
    if(cid){
      await sql`update public.payment_transactions set status=${status},raw_payload=${JSON.stringify(payload)}::jsonb where external_transaction_id=${ext||''} and gateway=${provider}`;
      if(status==='PAID'){
        await sql`update public.commands set status='PAGA', closed_at=null, updated_at=now() where id=${cid}`;
        const existing=await sql`select id from public.financial_transactions where command_id=${cid} and type='SALE' limit 1`;
        if(!existing.length){
          const cmd=await sql`select id,client_id,total,created_by from public.commands where id=${cid} limit 1`;
          if(cmd[0])await sql`insert into public.financial_transactions (type,direction,command_id,client_id,description,amount,paid_at,status,category,metadata,created_by) values ('SALE','INCOME',${cid},${cmd[0].client_id},${`Venda com ${provider}`},${Number(cmd[0].total)},now(),'PAID','Vendas',${JSON.stringify({gateway:provider,external_transaction_id:ext})}::jsonb,${cmd[0].created_by})`;
        }
      }
      if(['FAILED','CANCELLED'].includes(status))await sql`update public.commands set status='PAGAMENTO PENDENTE',updated_at=now() where id=${cid}`;
    }
    await sql`update public.webhook_events set processed=true,processed_at=now() where provider=${provider} and event_id=${eventId}`;
    return json({ok:true,status,command_id:cid});
  }catch(error:any){
    console.error('[EDDU webhook]',error);
    return json({error:error?.message||'Falha ao processar webhook.'},500);
  }
}
