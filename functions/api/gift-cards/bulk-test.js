import { neon } from '@neondatabase/serverless';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const clean=v=>String(v??'').trim();
const email=v=>clean(v).toLowerCase();
const money=v=>Math.round(Number(v)*100)/100;
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
async function codeFor(batchId,recipient){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(batchId+'|'+recipient));
 return 'TEST-'+hex(new Uint8Array(digest)).slice(0,20).toUpperCase();
}
function sandboxUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname.includes('sandbox')||u.hostname.includes('staging')||u.hostname.endsWith('.test'))}
 catch{return false}
}
export async function onRequestPost({request,env}){
 if(env.GIFT_CARD_ENV!=='sandbox')return json({ok:false,error:'Envio em massa permitido somente com GIFT_CARD_ENV=sandbox.'},403);
 const access=clean(env.GIFT_CARD_BULK_TEST_TOKEN);
 if(!access)return json({ok:false,error:'GIFT_CARD_BULK_TEST_TOKEN não configurado.'},503);
 if((request.headers.get('authorization')||'')!=='Bearer '+access)return json({ok:false,error:'Não autorizado.'},401);
 if(!env.NEON_DATABASE_URL)return json({ok:false,error:'NEON_DATABASE_URL não configurada.'},503);
 const deliveryUrl=clean(env.GIFT_CARD_TEST_DELIVERY_URL),deliveryToken=clean(env.GIFT_CARD_TEST_DELIVERY_TOKEN);
 if(!sandboxUrl(deliveryUrl)||!deliveryToken)return json({ok:false,error:'Configure endpoint HTTPS de sandbox/staging e token do serviço de entrega de testes.'},503);
 const allowed=new Set(clean(env.GIFT_CARD_TEST_RECIPIENTS).split(',').map(email).filter(Boolean));
 if(!allowed.size)return json({ok:false,error:'Lista GIFT_CARD_TEST_RECIPIENTS vazia; nenhum destinatário permitido.'},503);
 let body;try{body=await request.json()}catch{return json({ok:false,error:'JSON inválido.'},400)}
 const batchId=clean(body?.batchId),recipients=body?.recipients;
 if(!/^[A-Za-z0-9_-]{8,80}$/.test(batchId))return json({ok:false,error:'batchId inválido.'},400);
 if(!Array.isArray(recipients)||!recipients.length||recipients.length>50)return json({ok:false,error:'Informe de 1 a 50 destinatários de teste por lote.'},400);
 const seen=new Set();
 for(const r of recipients){
  const addr=email(r?.email);
  if(!addr||!allowed.has(addr))return json({ok:false,error:'Destinatário fora da lista de teste. Nenhum envio foi iniciado.'},403);
  if(seen.has(addr))return json({ok:false,error:'Destinatário duplicado no lote: '+addr},400);
  seen.add(addr);
  if(!(money(r?.value)>0)||money(r?.value)>10000)return json({ok:false,error:'Valor do gift card inválido para '+addr},400);
 }
 const sql=neon(env.NEON_DATABASE_URL),results=[];
 for(const recipient of recipients){
  const addr=email(recipient.email),code=await codeFor(batchId,addr);
  let card;
  try{
   const existing=await sql.query('select id,code,status,metadata from gift_cards where code=$1 limit 1',[code]);
   if(existing[0]&&existing[0].metadata?.batchId!==batchId)return json({ok:false,error:'Colisão de código do gift card.'},409);
   if(existing[0]&&['sent','failed'].includes(String(existing[0].metadata?.deliveryStatus||''))){
    results.push({email:addr,cardId:existing[0].id,code:existing[0].code,status:existing[0].metadata.deliveryStatus,replayed:true});continue;
   }
   if(existing[0])card=existing[0];
   else{
    const metadata={environment:'sandbox',batchId,recipientEmail:addr,deliveryStatus:'pending',attempts:0,source:'bulk-test'};
    const inserted=await sql.query("insert into gift_cards(code,title,value,status,metadata) values($1,$2,$3,'Pendente de envio',$4::jsonb) returning id,code,status,metadata",[code,clean(recipient.title)||'Gift Card de Teste',money(recipient.value),JSON.stringify(metadata)]);
    card=inserted[0];
   }
   if(!card?.id)throw new Error('Neon não confirmou o gift card.');
   try{
    const response=await fetch(deliveryUrl,{method:'POST',headers:{Authorization:'Bearer '+deliveryToken,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({environment:'sandbox',batchId,recipient:{email:addr,name:clean(recipient.name)||'Destinatário de teste'},giftCard:{id:card.id,code:card.code,value:money(recipient.value),title:clean(recipient.title)||'Gift Card de Teste'}})});
    const responseBody=await response.json().catch(()=>({}));
    if(!response.ok||responseBody?.ok===false)throw new Error(clean(responseBody?.error)||'Serviço de entrega de teste respondeu HTTP '+response.status);
    const meta={...(card.metadata||{}),environment:'sandbox',batchId,recipientEmail:addr,deliveryStatus:'sent',attempts:Number(card.metadata?.attempts||0)+1,deliveredAt:new Date().toISOString(),deliveryResponse:{status:response.status,reference:responseBody?.reference||null}};
    await sql.query("update gift_cards set status='Enviado (teste)',metadata=$1::jsonb,updated_at=now() where id=$2",[JSON.stringify(meta),card.id]);
    results.push({email:addr,cardId:card.id,code:card.code,status:'sent'});
   }catch(deliveryError){
    const meta={...(card.metadata||{}),environment:'sandbox',batchId,recipientEmail:addr,deliveryStatus:'failed',attempts:Number(card.metadata?.attempts||0)+1,lastError:clean(deliveryError?.message)||'Falha de entrega',failedAt:new Date().toISOString()};
    await sql.query("update gift_cards set status='Falha no envio (teste)',metadata=$1::jsonb,updated_at=now() where id=$2",[JSON.stringify(meta),card.id]);
    results.push({email:addr,cardId:card.id,code:card.code,status:'failed',error:meta.lastError});
   }
  }catch(error){
   results.push({email:addr,status:'failed',error:clean(error?.message)||'Falha de persistência no Neon'});
  }
 }
 const sent=results.filter(x=>x.status==='sent').length,failed=results.filter(x=>x.status==='failed').length;
 return json({ok:failed===0,batchId,environment:'sandbox',total:results.length,sent,failed,results},failed?207:200);
}
