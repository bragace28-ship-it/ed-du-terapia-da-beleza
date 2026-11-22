import { neon } from '@neondatabase/serverless';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Cookie, Authorization'}});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean=v=>String(v??'').trim();
const digits=v=>clean(v).replace(/\D/g,'');
const money=v=>Math.round(Number(v||0)*100)/100;
const DEFAULT_AUTH_URL='https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
async function validateSession(request,env){
 const cookie=request.headers.get('Cookie')||'',authorization=request.headers.get('Authorization')||'';
 if(!cookie&&!/^Bearer\s+\S+/i.test(authorization))return null;
 const headers=new Headers({Accept:'application/json'});if(cookie)headers.set('Cookie',cookie);if(authorization)headers.set('Authorization',authorization);
 const r=await fetch(String(env.NEON_AUTH_URL||DEFAULT_AUTH_URL).replace(/\/+$/,'')+'/get-session',{headers,signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!r.ok)return null;const p=await r.json();if(!p?.user?.id||!p?.session)return null;
 if(p.session.expiresAt&&new Date(p.session.expiresAt).getTime()<=Date.now())return null;
 return {id:String(p.user.id),email:String(p.user.email||'').trim().toLowerCase()};
}
async function applicationUser(sql,auth){
 const rows=await sql`SELECT id,auth_user_id,name,email,role,status,permissions FROM public.app_users WHERE auth_user_id=${auth.id} OR lower(email)=${auth.email} ORDER BY CASE WHEN auth_user_id=${auth.id} THEN 0 ELSE 1 END LIMIT 2`;
 if(rows.length!==1)return null;let u=rows[0];
 if(!['active','ativo'].includes(String(u.status||'').toLowerCase())||(u.auth_user_id&&String(u.auth_user_id)!==auth.id))return null;
 if(!u.auth_user_id){const linked=await sql`UPDATE public.app_users SET auth_user_id=${auth.id},updated_at=now() WHERE id=${u.id} AND auth_user_id IS NULL RETURNING id,auth_user_id,name,email,role,status,permissions`;if(linked.length!==1)return null;u=linked[0];}
 return u;
}
function canCharge(u){
 if(['admin','owner','super_admin','administrator'].includes(String(u.role||'').toLowerCase()))return true;
 const p=u.permissions;if(Array.isArray(p))return p.includes('*')||p.includes('commands')||p.includes('finance')||p.includes('commands.create')||p.includes('finance.create');
 return !!(p&&typeof p==='object'&&(p['*']===true||p.commands===true||p.finance===true||p['commands.create']===true||p['finance.create']===true));
}
/* Rates recovered from the approved V46 hardening commit (2026-09-30).
   Only explicitly verified installment points are used; missing points remain unknown.
   No fixed fee was recorded in that approved table. */
const VERIFIED_GATEWAY_RATES={
 PagBank:{pix:0.99,credit:{1:2.99,12:8.49,24:14.49}},
 Asaas:{pix:0.89,credit:{1:2.99,12:6.29,24:9.89}},
 Stripe:{credit:{1:2.99,12:6.99}},
 PicPay:{}
};
function enabled(env,g){
 if(g==='PagBank')return !!env.PAGBANK_TOKEN;
 if(g==='Stripe')return !!env.STRIPE_SECRET_KEY;
 if(g==='Asaas')return !!env.ASAAS_API_KEY;
 return false; // PicPay remained hidden in the last validated production flow pending card tokenization.
}
function estimate(amount,gateway,method,installments,env){
 const prefix={PagBank:'PAGBANK',Asaas:'ASAAS',Stripe:'STRIPE'}[gateway];
 if(!prefix)return {fee_known:false,fee_percent:null,fee_amount:null,net_amount:null,fee_source:'not_verified'};
 const kind=method==='pix'?'PIX':method==='debit_card'?'DEBIT':installments===1?'CREDIT':'CREDIT_INSTALLMENT';
 const configured=env[prefix+'_FEE_'+kind+'_PERCENT'];
 const fixedConfigured=env[prefix+'_FEE_'+kind+'_FIXED'];
 const table=VERIFIED_GATEWAY_RATES[gateway]||{};
 const verified=method==='pix'?table.pix:method==='debit_card'?null:table.credit?.[installments];
 const pct=configured!==undefined&&String(configured).trim()!==''?Number(configured):verified;
 const fixed=fixedConfigured!==undefined&&String(fixedConfigured).trim()!==''?Number(fixedConfigured):0;
 if(pct==null||!Number.isFinite(pct)||pct<0||!Number.isFinite(fixed)||fixed<0)return {fee_known:false,fee_percent:null,fee_amount:null,net_amount:null,fee_source:'not_verified_for_method_or_installment'};
 const fee=money(amount*pct/100+fixed);
 return {fee_known:true,fee_percent:pct,fee_amount:fee,net_amount:money(amount-fee),fixed_fee_amount:fixed,fee_source:configured!==undefined&&String(configured).trim()!==''?'cloudflare_environment':'historically_verified_rate'};
}
async function createPagBank({env,origin,commandId,amount,method,installments,customer,reference}){
  const token=env.PAGBANK_TOKEN,base=String(env.PAGBANK_API_BASE||'https://api.pagseguro.com').replace(/\/$/,'');
  if(!token||!base)throw new Error('PagBank não configurado no servidor.');
  const notificationUrl=origin+'/api/webhooks/pagbank';
  const payload={reference_id:reference,expiration_date:new Date(Date.now()+60*60*1000).toISOString(),customer_modifiable:true,items:[{reference_id:commandId||reference,name:'ED & DU | Terapia da Beleza',quantity:1,unit_amount:Math.round(amount*100)}],payment_methods:[{type:method==='pix'?'PIX':method==='debit_card'?'DEBIT_CARD':'CREDIT_CARD'}],payment_methods_configs:method==='card'?[{type:'CREDIT_CARD',config_options:[{option:'INSTALLMENTS_LIMIT',value:String(Math.max(1,Math.min(12,installments||1)))}]}]:[],soft_descriptor:'EDDU BELEZA',redirect_url:origin+'/?payment=return&command='+encodeURIComponent(commandId),return_url:origin+'/?payment=return&command='+encodeURIComponent(commandId),notification_urls:[notificationUrl],payment_notification_urls:[notificationUrl]};
  const r=await fetch(base+'/checkouts',{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json','x-idempotency-key':reference},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.message||'PagBank recusou o Checkout.');
  const url=data?.links?.find(x=>x.rel==='PAY')?.href||'';if(!url)throw new Error('PagBank não retornou o link de pagamento.');
  return {checkoutUrl:url,externalId:String(data.id||''),providerData:data};
}
async function createStripe({env,origin,commandId,amount,installments,description,reference}){
  const key=env.STRIPE_SECRET_KEY;if(!key)throw new Error('Stripe não configurado no servidor.');
  const p=new URLSearchParams();p.set('mode','payment');p.set('success_url',origin+'/?payment=success&command='+encodeURIComponent(commandId));p.set('cancel_url',origin+'/?payment=cancelled&command='+encodeURIComponent(commandId));p.set('client_reference_id',commandId||reference);p.set('line_items[0][price_data][currency]','brl');p.set('line_items[0][price_data][product_data][name]','ED & DU | Comanda');p.set('line_items[0][price_data][product_data][description]',description);p.set('line_items[0][price_data][unit_amount]',String(Math.round(amount*100)));p.set('line_items[0][quantity]','1');p.set('payment_method_types[0]','card');p.set('metadata[command_id]',commandId||'');
  const r=await fetch('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':reference},body:p.toString()});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error?.message||'Stripe recusou o Checkout.');if(!data?.url)throw new Error('Stripe não retornou o Checkout URL.');
  return {checkoutUrl:data.url,externalId:String(data.id||''),providerData:data};
}
async function createAsaas({env,origin,commandId,amount,method,installments,customer,reference}){
  const key=env.ASAAS_API_KEY;if(!key)throw new Error('Asaas não configurado no servidor.');
  const base=String(env.ASAAS_BASE_URL||'https://api.asaas.com/v3').replace(/\/$/,'');
  const payload={billingTypes:[method==='pix'?'PIX':method==='wallet'?'WALLET':'CREDIT_CARD'],chargeTypes:[method==='card'&&installments>1?'INSTALLMENT':'DETACHED'],minutesToExpire:60,externalReference:reference,callback:{successUrl:origin+'/?payment=success&command='+encodeURIComponent(commandId),cancelUrl:origin+'/?payment=cancelled&command='+encodeURIComponent(commandId),expiredUrl:origin+'/?payment=expired&command='+encodeURIComponent(commandId)},items:[{externalReference:commandId||reference,name:'ED & DU | Terapia da Beleza',description:'Comanda '+commandId,quantity:1,value:amount}]};
  if(method==='card'&&installments>1)payload.installment={maxInstallmentCount:installments};
  if(customer.name||customer.email||customer.phone||customer.document)payload.customerData={...(customer.name?{name:customer.name}:{}),...(customer.email?{email:customer.email}:{}),...(customer.phone?{phone:customer.phone}:{}),...(customer.document?{cpfCnpj:digits(customer.document)}:{})};
  const r=await fetch(base+'/checkouts',{method:'POST',headers:{accept:'application/json','content-type':'application/json',access_token:key,'Idempotency-Key':reference},body:JSON.stringify(payload)});
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

export async function onRequestGet({request,env}){
 const u=new URL(request.url);if(u.searchParams.get('mode')!=='rank')return json({ok:false,error:'mode=rank required'},400);
 if(!env.NEON_DATABASE_URL)return json({ok:false,error:'NEON_DATABASE_URL não configurada'},503);
 const auth=await validateSession(request,env);if(!auth)return json({ok:false,error:'UNAUTHORIZED'},401);
 const sql=neon(env.NEON_DATABASE_URL),user=await applicationUser(sql,auth);if(!user||!canCharge(user))return json({ok:false,error:'FORBIDDEN'},403);
 const amount=money(u.searchParams.get('amount')),method=clean(u.searchParams.get('method')||'pix').toLowerCase(),installments=Math.max(1,Math.min(12,Number(u.searchParams.get('installments'))||1));
 if(!(amount>0)||!['pix','debit_card','card'].includes(method))return json({ok:false,error:'amount/method inválido'},400);
 const candidates=method==='debit_card'?[]:method==='pix'?['PagBank','Asaas']:installments>1?['PagBank','Asaas']:['PagBank','Asaas','Stripe'];
 const ranking=candidates.map(g=>({gateway:g,available:enabled(env,g),...estimate(amount,g,method,installments,env)})).filter(x=>x.available).sort((a,b)=>a.fee_known!==b.fee_known?(a.fee_known?-1:1):(a.net_amount??0)-(b.net_amount??0)).map((x,i)=>({...x,position:i+1}));
 return json({ok:true,method,installments,currency:'BRL',ranking,generated_at:new Date().toISOString()});
}
export async function onRequestPost({request,env}){
 if(!env.NEON_DATABASE_URL)return json({ok:false,error:'NEON_DATABASE_URL não configurada'},503);
 const auth=await validateSession(request,env);if(!auth)return json({ok:false,error:'UNAUTHORIZED'},401);
 let body;try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({ok:false,error:'INVALID_BODY'},400);
 const sql=neon(env.NEON_DATABASE_URL),user=await applicationUser(sql,auth);if(!user||!canCharge(user))return json({ok:false,error:'FORBIDDEN'},403);
 const amount=money(body.amount),gatewayName=clean(body.gateway).toLowerCase(),provider=({pagbank:'PagBank',asaas:'Asaas',stripe:'Stripe',picpay:'PicPay'})[gatewayName];
 const method=clean(body.method||'pix').toLowerCase(),installments=Math.max(1,Math.min(12,Number(body.installments)||1));
 const commandId=clean(body.commandId||body.command_id),idem=clean(request.headers.get('Idempotency-Key')||'EDDU-'+commandId+'-'+gatewayName+'-'+method+'-'+installments);
 if(!(amount>0)||!provider||!['pix','debit_card','card','wallet'].includes(method)||!commandId||idem.length>200)return json({ok:false,error:'Dados de cobrança inválidos'},400);
 if(method==='debit_card')return json({ok:false,error:'Débito online não possui tarifa homologada nem rota de checkout validada.'},400);
 if(provider==='PicPay')return json({ok:false,error:'PicPay permanece desabilitado até a conclusão da tokenização e homologação do checkout.'},409);
 if(method==='card'&&![1,12].includes(installments))return json({ok:false,error:'O Smart Gateway só libera parcelamentos com taxa homologada: 1x ou 12x.'},400);
 if(method==='wallet')return json({ok:false,error:'PicPay permanece desabilitado até a conclusão da tokenização e homologação do checkout.'},400);
 if(method==='pix'&&!['PagBank','Asaas'].includes(provider))return json({ok:false,error:'Gateway sem PIX habilitado.'},400);
 const [existing]=await sql`SELECT * FROM public.payments WHERE idempotency_key=${idem} LIMIT 1`;
 if(existing)return json({ok:true,replayed:true,payment:existing,checkoutUrl:existing.metadata?.checkoutUrl||null,qrCode:existing.metadata?.qrCode||null});
 if(!UUID.test(commandId))return json({ok:false,error:'COMMAND_ID_INVALID'},400);
 const [command]=await sql`SELECT id,client_id,professional_id,total,status FROM public.commands WHERE id=${commandId} LIMIT 1`;
 if(!command)return json({ok:false,error:'COMMAND_NOT_FOUND'},404);
 if(['paid','closed','cancelled','refunded'].includes(String(command.status).toLowerCase()))return json({ok:false,error:'COMMAND_NOT_PAYABLE'},409);
 if(Math.abs(Number(command.total)-amount)>0.009)return json({ok:false,error:'AMOUNT_MISMATCH'},409);
 const origin=new URL(request.url).origin,reference=('EDDU-'+commandId+'-'+gatewayName+'-'+method+'-'+installments).slice(0,64);
 const customer={name:clean(body.customerName||body.customer?.name||'Cliente ED & DU'),email:clean(body.customerEmail||body.customer?.email),phone:clean(body.customerPhone||body.customer?.phone),document:clean(body.customerDocument||body.customer?.document),temporary_card_token:clean(body.temporary_card_token)};
 let result;
 try{
  if(provider==='PagBank')result=await createPagBank({env,origin,commandId,amount,method,installments,customer,reference});
  else if(provider==='Stripe'){if(method!=='card'||installments!==1)return json({ok:false,error:'Stripe aceita cartão de crédito neste fluxo.'},400);result=await createStripe({env,origin,commandId,amount,installments,description:clean(body.description||'Comanda ED & DU'),reference});}
  else if(provider==='Asaas'){if(method==='wallet'||method==='debit_card')return json({ok:false,error:'Forma de pagamento não suportada pelo Asaas neste fluxo.'},400);result=await createAsaas({env,origin,commandId,amount,method,installments,customer,reference});}
  else result=await createPicPay({env,commandId,amount,method,installments,customer,reference});
 }catch(error){console.error('EDDU_GATEWAY_CREATE_ERROR',{provider,error:String(error?.message||error)});return json({ok:false,error:String(error?.message||'Falha ao criar cobrança no gateway')},502);}
 const est=estimate(amount,provider,method,installments,env);
 const metadata={checkoutUrl:result.checkoutUrl||null,qrCode:result.qrCode||null,qrCodeBase64:result.qrCodeBase64||null,reference,providerData:result.providerData||null,feeEstimate:est};
 const rows=await sql.query(`WITH ins AS (
  INSERT INTO public.payments(command_id,client_id,amount,method,gateway,installments,status,external_id,idempotency_key,metadata)
  VALUES ($1,$2,$3,$4,$5,$6,'CHECKOUT_PENDING',$7,$8,$9::jsonb)
  ON CONFLICT(idempotency_key) DO NOTHING RETURNING *
 ), cmd AS (
  UPDATE public.commands c SET status='payment_pending',payment_gateway=$5,payment_installments=$6,
   payment_estimated_fee=COALESCE($10,0),payment_estimated_net=COALESCE($11,0),payment_link=$12,updated_at=now()
  FROM ins WHERE c.id=ins.command_id RETURNING c.id
 ), fin AS (
  INSERT INTO public.financial_transactions(type,direction,command_id,client_id,description,amount,status,category,metadata,created_by)
  SELECT 'receivable','in',i.command_id,i.client_id,'Cobrança '||i.gateway||' — comanda '||i.command_id,
   i.amount,'pending','service_payment',jsonb_build_object('payment_id',i.id,'idempotency_key',$8,'gateway',i.gateway),$13
  FROM ins i WHERE NOT EXISTS(SELECT 1 FROM public.financial_transactions f WHERE f.metadata->>'payment_id'=i.id::text)
  RETURNING id
 ) SELECT * FROM ins`,[commandId,command.client_id,amount,method==='pix'?'PIX':method==='debit_card'?'DEBIT_CARD':'CREDIT_CARD',provider,installments,result.externalId||null,idem,JSON.stringify(metadata),est.fee_amount,est.net_amount,result.checkoutUrl||null,auth.id]);
 if(!rows.length){const [replay]=await sql`SELECT * FROM public.payments WHERE idempotency_key=${idem} LIMIT 1`;if(replay)return json({ok:true,replayed:true,payment:replay,checkoutUrl:replay.metadata?.checkoutUrl||null,qrCode:replay.metadata?.qrCode||null});return json({ok:false,error:'IDEMPOTENCY_CONFLICT'},409);}
 return json({ok:true,payment:rows[0],checkoutUrl:result.checkoutUrl||null,qrCode:result.qrCode||null,qrCodeBase64:result.qrCodeBase64||null,provider},201);
}
