import { neon } from '@neondatabase/serverless';

function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestPost({request,env}) {
  if(!env.NEON_DATABASE_URL || !env.ASAAS_API_KEY) return json({ok:false,error:'Payment integration not configured'},503);
  let body; try { body=await request.json(); } catch { return json({ok:false,error:'Invalid JSON'},400); }
  const amount=Number(body.amount), billingType=String(body.billingType||'PIX');
  if(!(amount>0)||!['PIX','CREDIT_CARD'].includes(billingType)) return json({ok:false,error:'amount and supported checkout billingType are required'},400);
  const commandId=String(body.commandId||''), clientId=String(body.clientId||'');
  const customerName=String(body.customerName||'Cliente ED & DU').trim().slice(0,100);
  const customerEmail=String(body.customerEmail||'').trim().slice(0,120);
  const customerPhone=String(body.customerPhone||'').replace(/[^0-9+]/g,'').slice(0,20);
  const installmentCount=Math.max(1,Math.min(21,Number(body.installmentCount)||1));
  const externalReference=String(body.externalReference||('EDDU-'+crypto.randomUUID())).slice(0,200);
  const idem=String(request.headers.get('Idempotency-Key')||externalReference);
  const sql=neon(env.NEON_DATABASE_URL);
  const [existing]=await sql`select id,external_id,status,metadata from payments where idempotency_key=${idem} limit 1`;
  if(existing){const checkoutUrl=existing?.metadata?.checkoutUrl||existing?.metadata?.link||null;return json({ok:true,replayed:true,payment:existing,checkoutUrl},200);}
  const base=env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3';
  const origin=new URL(request.url).origin;
  const callback={successUrl:origin+'/?payment=success&command='+encodeURIComponent(commandId),cancelUrl:origin+'/?payment=cancelled&command='+encodeURIComponent(commandId),expiredUrl:origin+'/?payment=expired&command='+encodeURIComponent(commandId)};
  const checkoutPayload={billingTypes:[billingType],chargeTypes:billingType==='CREDIT_CARD'&&installmentCount>1?['INSTALLMENT']:['DETACHED'],minutesToExpire:60,externalReference,callback,items:[{externalReference:commandId||externalReference,name:'ED & DU | Terapia da Beleza',description:String(body.description||('Comanda '+commandId)).slice(0,500),quantity:1,value:amount}],customerData:{name:customerName,...(customerEmail?{email:customerEmail}:{}),...(customerPhone?{phone:customerPhone}:{})}};
  if(checkoutPayload.chargeTypes[0]==='INSTALLMENT') checkoutPayload.installment={maxInstallmentCount:installmentCount};
  const upstream=await fetch(base+'/checkouts',{method:'POST',headers:{'Content-Type':'application/json','access_token':env.ASAAS_API_KEY},body:JSON.stringify(checkoutPayload)});
  const data=await upstream.json().catch(()=>({}));
  if(!upstream.ok) return json({ok:false,error:'Asaas rejected checkout',details:data},upstream.status);
  const checkoutId=String(data.id||'');
  const checkoutUrl=String(data.link||((base.includes('sandbox')?'https://sandbox.asaas.com':'https://asaas.com')+'/checkoutSession/show?id='+encodeURIComponent(checkoutId)));
  if(!checkoutId) return json({ok:false,error:'Asaas did not return a checkout id'},502);
  const validCommand=UUID.test(commandId),validClient=UUID.test(clientId);
  const [row]=await sql`insert into payments(command_id,client_id,amount,method,gateway,installments,status,external_id,idempotency_key,metadata) values(${validCommand?commandId:null},${validClient?clientId:null},${amount},${billingType},'Asaas',${checkoutPayload.chargeTypes[0]==='INSTALLMENT'?installmentCount:1},'CHECKOUT_PENDING',${checkoutId},${idem},${JSON.stringify({checkoutId,checkoutUrl,externalReference,checkoutStatus:data.status||'ACTIVE',billingType})}::jsonb) returning id,status,external_id,command_id,client_id,amount,method,gateway,installments`;
  if(validCommand) await sql`update commands set status='Aguardando pagamento',updated_at=now() where id=${commandId} and status<>'Fechada'`;
  return json({ok:true,payment:row,checkoutId,checkoutUrl,provider:data},201);
}