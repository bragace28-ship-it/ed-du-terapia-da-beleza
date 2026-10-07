import { neon } from '@neondatabase/serverless';

const json=(x,s=200)=>Response.json(x,{status:s,headers:{'Cache-Control':'no-store'}});
const enc=new TextEncoder();

function hex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
function b64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
function unb64(value){const bin=atob(value);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
function eq(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}

async function legacySignature(token,raw){
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(token+'-'+raw));
  return hex(new Uint8Array(digest));
}

function pemFromBase64(base64){
  const normalized=String(base64||'').replace(/\s/g,'');
  if(!normalized)return '';
  return '-----BEGIN PUBLIC KEY-----\n'+normalized.match(/.{1,64}/g).join('\n')+'\n-----END PUBLIC KEY-----';
}

async function verifyEcdsa(raw,signatureHeader,publicKeyBase64){
  if(!signatureHeader||!publicKeyBase64)return false;
  const signatures=String(signatureHeader).split(',').map(x=>x.trim()).filter(Boolean);
  const key=await crypto.subtle.importKey('spki',unb64(String(publicKeyBase64).replace(/\s/g,'')),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const data=enc.encode(raw);
  for(const signature of signatures){
    try{
      const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(signature),data);
      if(ok)return true;
    }catch{}
  }
  return false;
}

async function resolvePublicKey(env){
  if(env.PAGBANK_WEBHOOK_PUBLIC_KEY)return String(env.PAGBANK_WEBHOOK_PUBLIC_KEY);
  if(!env.PAGBANK_TOKEN)return '';
  const base=String(env.PAGBANK_API_BASE||'https://sandbox.api.pagseguro.com').replace(/\/$/,'');
  try{
    const r=await fetch(base+'/public-keys/webhook',{headers:{Authorization:'Bearer '+env.PAGBANK_TOKEN,Accept:'application/json'}});
    const data=await r.json().catch(()=>({}));
    return String(data?.public_key||'');
  }catch{return '';}
}

async function verifyWebhook(raw,request,env){
  const modern=request.headers.get('x-payload-signature')||'';
  if(modern){
    const publicKey=await resolvePublicKey(env);
    if(!publicKey)return false;
    return verifyEcdsa(raw,modern,publicKey);
  }
  const legacy=request.headers.get('x-authenticity-token')||'';
  if(legacy&&env.PAGBANK_TOKEN){
    return eq(await legacySignature(env.PAGBANK_TOKEN,raw),legacy.toLowerCase());
  }
  return false;
}

export async function onRequestPost({request,env}){
  if(!env.NEON_DATABASE_URL)return json({ok:false,error:'NEON_DATABASE_URL não configurada'},503);
  const raw=await request.text();
  if(!(await verifyWebhook(raw,request,env)))return json({ok:false,error:'Assinatura PagBank inválida ou ausente'},401);
  let p;try{p=JSON.parse(raw)}catch{return json({ok:false,error:'JSON inválido'},400)};

  const checkoutId=String(p?.id||'');
  const charge=p?.charges?.[0]||{};
  const externalId=String(charge?.id||checkoutId);
  const reference=String(p?.reference_id||charge?.reference_id||'');
  const status=String(charge?.status||p?.status||'').toUpperCase();
  const paid=status==='PAID';

  const sql=neon(env.NEON_DATABASE_URL);
  const rows=externalId
    ? await sql`select * from payments where gateway='PagBank' and (external_id=${externalId} or external_id=${checkoutId} or metadata->>'reference'=${reference}) order by created_at desc limit 1`
    : await sql`select * from payments where gateway='PagBank' and metadata->>'reference'=${reference} order by created_at desc limit 1`;
  const pay=rows[0];
  if(!pay)return json({ok:true,matched:false});

  const meta={...(pay.metadata||{}),lastWebhook:p,webhookStatus:status,webhookReceivedAt:new Date().toISOString()};
  await sql`update payments set status=${paid?'PAID':status||'PENDING'},paid_at=case when ${paid} then coalesce(paid_at,now()) else paid_at end,metadata=${JSON.stringify(meta)}::jsonb,updated_at=now() where id=${pay.id}`;

  if(paid&&pay.command_id){
    const sums=await sql`select coalesce(sum(amount),0) total from payments where command_id=${pay.command_id} and status in ('PAID','RECEIVED','CONFIRMED')`;
    const cmd=await sql`select id,total,status from commands where id=${pay.command_id} limit 1`;
    const commandTotal=Number(cmd[0]?.total||0);
    if(cmd[0]&&Number(sums[0]?.total||0)+.009>=commandTotal){
      await sql`update commands set status='Fechada',updated_at=now() where id=${pay.command_id} and status<>'Fechada'`;
    }
  }
  return json({ok:true,paid,payment_id:pay.id});
}