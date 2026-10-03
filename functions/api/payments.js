import { neon } from '@neondatabase/serverless';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=v=>String(v??'').trim();
const digits=v=>clean(v).replace(/\D/g,'');
const money=v=>Math.round(Number(v||0)*100)/100;
const rates={
  PagBank:{pix:null,one:{pct:.0499,fixed:.40},installments:{pct:.0499,fixed:.40}},
  Stripe:{pix:null,one:{pct:.0399,fixed:.39},installments:{pct:.0399,fixed:.39}},
  Asaas:{pix:null,one:{pct:.0299,fixed:.49},installments:{pct:.0349,fixed:.49}},
  PicPay:{pix:null,one:{pct:.0519,fixed:0},installments:{pct:.0519,fixed:0}},
  Nubank:{pix:null,one:{pct:.0399,fixed:0},installments:{pct:.0599,fixed:0}}
};
function estimate(amount,gateway,method,installments){
  const r=method==='pix'?rates[gateway]?.pix:installments>1?rates[gateway]?.installments:rates[gateway]?.one;
  if(r==null)return {fee_known:false,fee_percent:null,fee_amount:null,net_amount:null};
  const fee=money(amount*(r.pct||0)+(r.fixed||0));return {fee_known:true,fee_percent:r.pct*100,fee_amount:fee,net_amount:money(amount-fee)};
}
function enabled(env,g){
  if(g==='PagBank')return !!env.PAGBANK_TOKEN;
  if(g==='Stripe')return !!env.STRIPE_SECRET_KEY;
  if(g==='Asaas')return !!env.ASAAS_API_KEY;
  if(g==='PicPay')return !!env.PICPAY_CLIENT_ID&&!!env.PICPAY_CLIENT_SECRET;
  if(g==='Nubank')return !!env.NUPAY_MERCHANT_KEY&&!!env.NUPAY_MERCHANT_TOKEN;
  return false;
}
async function createPagBank({env,origin,commandId,amount,method,customer,reference}){
  const token=env.PAGBANK_TOKEN,base=String(env.PAGBANK_API_BASE||'https://sandbox.api.pagseguro.com').replace(/\/$/,'');
  if(!token||!base)throw new Error('PagBank não configurado no servidor.');
  const notificationUrl=origin+'/api/webhooks/pagbank';
  const payload={reference_id:reference,expiration_date:new Date(Date.now()+60*60*1000).toISOString(),customer_modifiable:true,items:[{reference_id:commandId||reference,name:'ED & DU | Terapia da Beleza',quantity:1,unit_amount:Math.round(amount*100)}],payment_methods:[{type:method==='pix'?'PIX':method==='wallet'?'WALLET':'CREDIT_CARD'}],soft_descriptor:'EDDU BELEZA',redirect_url:origin+'/?payment=return&command='+encodeURIComponent(commandId),return_url:origin+'/?payment=return&command='+encodeURIComponent(commandId),notification_urls:[notificationUrl],payment_notification_urls:[notificationUrl]};
  const r=await fetch(base+'/checkouts',{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json','x-idempotency-key':reference},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||'PagBank recusou o Checkout.');
  const url=data?.links?.find(x=>x.rel==='PAY')?.href||'';if(!url)throw new Error('PagBank não retornou o link de pagamento.');
  return {checkoutUrl:url,externalId:String(data.id||''),providerData:data};
}
async function createStripe({env,origin,commandId,amount,installments,description,reference}){
  const key=env.STRIPE_SECRET_KEY;if(!key)throw new Error('Stripe não configurado no servidor.');
  const p=new URLSearchParams();p.set('mode','payment');p.set('success_url',origin+'/?payment=success&command='+encodeURIComponent(commandId));p.set('cancel_url',origin+'/?payment=cancelled&command='+encodeURIComponent(commandId));p.set('client_reference_id',commandId||reference);p.set('line_items[0][price_data][currency]','brl');p.set('line_items[0][price_data][product_data][name]','ED & DU | Comanda');p.set('line_items[0][price_data][product_data][description]',description);p.set('line_items[0][price_data][unit_amount]',String(Math.round(amount*100)));p.set('line_items[0][quantity]','1');p.set('payment_method_types[0]','card');p.set('metadata[command_id]',commandId||'');
  const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded'},body:p.toString()});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error?.message||'Stripe recusou o Checkout.');if(!data?.url)throw new Error('Stripe não retornou o Checkout URL.');
  return {checkoutUrl:data.url,externalId:String(data.id||''),providerData:data};
}
async function createAsaas({env,origin,commandId,amount,method,installments,customer,reference}){
  const key=env.ASAAS_API_KEY;if(!key)throw new Error('Asaas não configurado no servidor.');
  const base=String(env.ASAAS_BASE_URL||'https://api-sandbox.asaas.com/v3').replace(/\/$/,'');
  const payload={billingTypes:[method==='pix'?'PIX':'CREDIT_CARD'],chargeTypes:[method==='card'&&installments>1?'INSTALLMENT':'DETACHED'],minutesToExpire:60,externalReference:reference,callback:{successUrl:origin+'/?payment=success&command='+encodeURIComponent(commandId),cancelUrl:origin+'/?payment=cancelled&command='+encodeURIComponent(commandId),expiredUrl:origin+'/?payment=expired&command='+encodeURIComponent(commandId)},items:[{externalReference:commandId||reference,name:'ED & DU | Terapia da Beleza',description:'Comanda '+commandId,quantity:1,value:amount}]};
  if(method==='card'&&installments>1)payload.installment={maxInstallmentCount:installments};
  if(customer.name||customer.email||customer.phone||customer.document)payload.customerData={...(customer.name?{name:customer.name}:{}),...(customer.email?{email:customer.email}:{}),...(customer.phone?{phone:customer.phone}:{}),...(customer.document?{cpfCnpj:digits(customer.document)}:{})};
  const r=await fetch(base+'/checkouts',{method:'POST',headers:{accept:'application/json','content-type':'application/json',access_token:key},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.errors?.[0]?.description||'Asaas recusou o Checkout.');
  const url=String(data?.link||((base.includes('sandbox')?'https://sandbox.asaas.com':'https://asaas.com')+'/checkoutSession/show?id='+encodeURIComponent(data.id||'')));if(!data?.id)throw new Error('Asaas não retornou o checkout.');
  return {checkoutUrl:url,externalId:String(data.id),providerData:data};
}
async function createPicPay({env,commandId,amount,method,installments,customer,reference}){
  const id=env.PICPAY_CLIENT_ID,secret=env.PICPAY_CLIENT_SECRET;if(!id||!secret)throw new Error('PicPay não configurado no servidor.');
  const base=String(env.PICPAY_API_BASE||'https://ecommerce-api.svcp.picpay.com').replace(/\/$/,'');
  const tr=await fetch(base+'/oauth2/token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:id,client_secret:secret})});const tb=await tr.json().catch(()=>({}));if(!tr.ok||!tb?.access_token)throw new Error('Falha na autenticação com PicPay.');
  const merchantChargeId=reference;
  const phone=digits(customer.phone);const doc=digits(customer.document);if(!customer.name||!customer.email||!doc||phone.length<10)throw new Error('PicPay exige nome, e-mail, CPF/CNPJ e telefone do cliente.');
  const tx={paymentType:method==='pix'?'PIX':method==='wallet'?'WALLET':'CREDIT',amount:Math.round(amount*100)};
  if(method==='card'){const t=clean(customer.temporary_card_token);if(!t)throw new Error('Para cartão PicPay, o token temporário do cartão é obrigatório.');tx.credit={temporaryCardToken:t,installmentNumber:Math.max(1,Math.min(12,installments||1)),installmentType:'MERCHANT'};}
  if(method==='pix')tx.pix={expiration:900};
  const endpoint=method==='card'?'/v1/charge/authorization':method==='wallet'?'/v1/charge/wallet':'/v1/charge/pix';
  const payload={paymentSource:'GATEWAY',merchantChargeId,customer:{name:customer.name,email:customer.email,documentType:doc.length===14?'CNPJ':'CPF',document:doc,phone:{countryCode:'55',areaCode:phone.slice(-11,-9),number:phone.slice(-9),type:'MOBILE'}},transactions:[tx]};
  const r=await fetch(base+endpoint,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+tb.access_token},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||'PicPay recusou a cobrança.');
  const first=Array.isArray(data?.transactions)?data.transactions[0]:null;return {checkoutUrl:null,externalId:String(data?.id||first?.transactionId||merchantChargeId),providerData:data,qrCode:first?.pix?.qrCode||first?.wallet?.qrCode||null,qrCodeBase64:first?.pix?.qrCodeBase64||first?.wallet?.qrCodeBase64||null};
}
async function createNubank({env,origin,commandId,amount,customer,reference}){
  const key=env.NUPAY_MERCHANT_KEY,token=env.NUPAY_MERCHANT_TOKEN;if(!key||!token)throw new Error('Nubank/NuPay não configurado no servidor.');
  const base=String(env.NUPAY_API_BASE||'https://sandbox-api.spinpay.com.br').replace(/\/$/,'');
  const returnUrl=origin+'/?payment=nupay_return&command='+encodeURIComponent(commandId);
  const callbackUrl=origin+'/api/webhooks/nubank';
  const payload={currency:'BRL',reference,amount,returnUrl,callbackUrl,merchant:{displayName:'ED & DU | Terapia da Beleza'}};
  const doc=digits(customer.document);if(doc)payload.shopper={identification:{type:doc.length===14?'CNPJ':'CPF',value:doc}};
  const r=await fetch(base+'/v1/checkouts/sessions',{method:'POST',headers:{'X-Merchant-Key':key,'X-Merchant-Token':token,'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||'NuPay recusou a sessão.');
  return {checkoutUrl:data?.redirectUrl||null,externalId:String(data?.id||''),providerData:data};
}
export async function onRequestGet({request,env}){
  const u=new URL(request.url);if(u.searchParams.get('mode')!=='rank')return json({ok:false,error:'mode=rank required'},400);
  const amount=money(u.searchParams.get('amount')),method=clean(u.searchParams.get('method')).toLowerCase()==='pix'?'pix':'card',installments=Math.max(1,Math.min(12,Number(u.searchParams.get('installments'))||1));
  if(!(amount>0))return json({ok:false,error:'amount required'},400);
  const all=['PagBank','Asaas','Stripe','PicPay','Nubank'];
  const ranking=all.map(g=>({gateway:g,available:enabled(env,g),...estimate(amount,g,method,installments)})).filter(x=>x.available).sort((a,b)=>(b.net_amount??-Infinity)-(a.net_amount??-Infinity)).map((x,i)=>({...x,position:i+1}));
  return json({ok:true,method,installments,currency:'BRL',ranking,generated_at:new Date().toISOString()});
}
export async function onRequestPost({request,env}){
  if(!env.NEON_DATABASE_URL)return json({ok:false,error:'NEON_DATABASE_URL não configurada'},503);
  let body;try{body=await request.json()}catch{return json({ok:false,error:'Invalid JSON'},400);}
  const amount=money(body.amount);const rawMethod=clean(body.method||body.billingType).toLowerCase().replace('credit_card','card');const method=['pix','card','wallet'].includes(rawMethod)?rawMethod:'card';
  const gateway=clean(body.gateway||'').toLowerCase();const map={pagbank:'PagBank',stripe:'Stripe',asaas:'Asaas',picpay:'PicPay',nubank:'Nubank',nupay:'Nubank'};const provider=map[gateway];
  const installments=Math.max(1,Math.min(12,Number(body.installments||body.installmentCount)||1));const commandId=clean(body.commandId||body.command_id);const clientId=clean(body.clientId||body.client_id);const idem=clean(request.headers.get('Idempotency-Key')||('EDDU-'+commandId+'-'+provider+'-'+method+'-'+installments));if(!(amount>0)||!provider)return json({ok:false,error:'gateway e valor válidos são obrigatórios'},400);
  const sql=neon(env.NEON_DATABASE_URL);const [existing]=await sql\`select id,command_id,client_id,amount,method,gateway,installments,status,external_id,metadata from payments where idempotency_key=\${idem} limit 1\`;if(existing)return json({ok:true,replayed:true,payment:existing,checkoutUrl:existing?.metadata?.checkoutUrl||null,qrCode:existing?.metadata?.qrCode||null});
  const origin=new URL(request.url).origin;const reference=('EDDU-'+(commandId||crypto.randomUUID())).slice(0,64);const customer={name:clean(body.customerName||body.customer?.name||'Cliente ED & DU'),email:clean(body.customerEmail||body.customer?.email),phone:clean(body.customerPhone||body.customer?.phone),document:clean(body.customerDocument||body.customer?.document),temporary_card_token:clean(body.temporary_card_token)};
  let result;
  if(provider==='PagBank')result=await createPagBank({env,origin,commandId,amount,method,customer,reference});
  else if(provider==='Stripe')result=await createStripe({env,origin,commandId,amount,installments,description:clean(body.description||'Comanda ED & DU'),reference});
  else if(provider==='Asaas')result=await createAsaas({env,origin,commandId,amount,method,installments,customer,reference});
  else if(provider==='PicPay')result=await createPicPay({env,commandId,amount,method,installments,customer,reference});
  else result=await createNubank({env,origin,commandId,amount,customer,reference});
  const est=estimate(amount,provider,method,installments);
  const metadata={checkoutUrl:result.checkoutUrl||null,qrCode:result.qrCode||null,qrCodeBase64:result.qrCodeBase64||null,reference,providerData:result.providerData||null};
  const validCommand=UUID.test(commandId),validClient=UUID.test(clientId);
  const [row]=await sql\`insert into payments(command_id,client_id,amount,method,gateway,installments,status,external_id,idempotency_key,metadata) values(\${validCommand?commandId:null},\${validClient?clientId:null},\${amount},\${method==='pix'?'PIX':'CREDIT_CARD'},\${provider},\${installments},'CHECKOUT_PENDING',\${result.externalId||null},\${idem},\${JSON.stringify(metadata)}::jsonb) returning id,command_id,client_id,amount,method,gateway,installments,status,external_id,metadata\`;
  if(validCommand)await sql\`update commands set status='Aguardando pagamento',payment_gateway=\${provider},payment_installments=\${installments},payment_link=\${result.checkoutUrl||null},updated_at=now() where id=\${commandId} and status<>'Fechada'\`;
  return json({ok:true,payment:row,checkoutUrl:result.checkoutUrl||null,qrCode:result.qrCode||null,qrCodeBase64:result.qrCodeBase64||null,provider:provider},201);
}