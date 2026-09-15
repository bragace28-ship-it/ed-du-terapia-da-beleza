import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}});
const norm=(v:unknown)=>String(v??"").trim();
const digits=(v:unknown)=>norm(v).replace(/\D/g,"");
function splitPhone(phone:string){const d=digits(phone);if(d.length<10)return null;const n=d.startsWith("55")&&d.length>=12?d.slice(2):d;return{countryCode:"55",areaCode:n.slice(0,2),number:n.slice(2),type:"MOBILE"};}
function cleanBase(v:string){const raw=(v||"https://ecommerce-api.svcp.picpay.com").replace(/\/+$/g,"");return raw.replace(/\/v1$/g,"");}

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}});
 if(req.method!=="POST")return json({error:"Method Not Allowed"},405);
 const auth=norm(req.headers.get("Authorization"));if(!auth.startsWith("Bearer "))return json({error:"Não autorizado"},401);
 const supabaseUrl=Deno.env.get("SUPABASE_URL"),anonKey=Deno.env.get("SUPABASE_ANON_KEY"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),clientId=Deno.env.get("PICPAY_CLIENT_ID"),clientSecret=Deno.env.get("PICPAY_CLIENT_SECRET");
 if(!supabaseUrl||!anonKey||!serviceKey||!clientId||!clientSecret)return json({error:"Integração PicPay não configurada no servidor"},503);
 const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});const admin=createClient(supabaseUrl,serviceKey);
 const {data:userData,error:userError}=await userClient.auth.getUser();if(userError||!userData.user)return json({error:"Sessão inválida"},401);
 try{
  const body=await req.json();const commandId=norm(body?.command_id);const requested=norm(body?.payment_type).toLowerCase();const type=requested==="credit"||requested==="credit_card"?"credit":requested==="pix"?"pix":requested==="wallet"||requested==="picpay"?"wallet":"";
  if(!commandId||!type)return json({error:"command_id e payment_type são obrigatórios"},400);
  const {data:profile}=await admin.from("profiles").select("id,role,active").eq("id",userData.user.id).single();
  const {data:command,error:ce}=await admin.from("commands").select("id,client_id,total,status,payment_gateway").eq("id",commandId).single();if(ce||!command)return json({error:"Comanda não encontrada"},404);
  const role=norm(profile?.role).toLowerCase();const isPro=profile?.active!==false&&["admin","professional","pro"].includes(role);
  let client:any=null;if(command.client_id){client=(await admin.from("clients").select("id,user_id,name,email,phone").eq("id",command.client_id).maybeSingle()).data||null;}
  const isOwner=!!client?.user_id&&client.user_id===userData.user.id;if(!isPro&&!isOwner)return json({error:"Sem permissão para iniciar este pagamento"},403);
  if(norm(command.payment_gateway).toLowerCase()!=="picpay")return json({error:"Selecione PicPay como gateway antes de iniciar o pagamento"},409);
  if(["closed","cancelled","canceled","paid"].includes(norm(command.status).toLowerCase()))return json({error:"Comanda não está disponível para pagamento"},409);
  const amount=Number(command.total);if(!Number.isFinite(amount)||amount<=0)return json({error:"Valor da comanda inválido"},400);
  const customer=body?.customer||{};const name=norm(customer.name)||norm(client?.name);const email=norm(customer.email)||norm(client?.email);const document=digits(customer.document);const phone=splitPhone(norm(customer.phone)||norm(client?.phone));if(!name||!email||!document||!phone)return json({error:"Para PicPay, informe nome, e-mail, CPF/CNPJ e telefone do cliente"},400);
  const documentType=document.length===14?"CNPJ":document.length===11?"CPF":"PASSPORT";const merchantChargeId=crypto.randomUUID();const apiBase=cleanBase(Deno.env.get("PICPAY_API_BASE")||"");
  const tokenResp=await fetch(`${apiBase}/oauth2/token`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({grant_type:"client_credentials",client_id:clientId,client_secret:clientSecret})});const tokenBody=await tokenResp.json().catch(()=>({}));if(!tokenResp.ok||!tokenBody?.access_token)return json({error:"Falha na autenticação com PicPay",provider_status:tokenBody?.message||tokenResp.status},502);
  const tx:any={paymentType:type==="credit"?"CREDIT":type==="wallet"?"WALLET":"PIX",amount:Math.round(amount*100)};
  if(type==="credit"){const temporary=norm(body?.temporary_card_token);if(!temporary)return json({error:"Token temporário do cartão PicPay não informado"},400);tx.credit={temporaryCardToken:temporary,installmentNumber:Math.max(1,Math.min(12,Number(body?.installments)||1)),installmentType:"MERCHANT"};}
  if(type==="pix")tx.pix={expiration:Math.max(300,Math.min(3600,Number(body?.pix_expiration)||900))};
  const payload={paymentSource:"GATEWAY",merchantChargeId,customer:{name,email,documentType,document,phone},transactions:[tx]};const endpoint=type==="credit"?"/v1/charge/authorization":type==="wallet"?"/v1/charge/wallet":"/v1/charge/pix";
  const chargeResp=await fetch(`${apiBase}${endpoint}`,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json",Authorization:`Bearer ${tokenBody.access_token}`},body:JSON.stringify(payload)});const charge=await chargeResp.json().catch(()=>({}));if(!chargeResp.ok)return json({error:"PicPay recusou a cobrança",provider_status:charge?.message||chargeResp.status},502);
  const t=Array.isArray(charge?.transactions)?charge.transactions[0]:null;const providerStatus=norm(charge?.chargeStatus||t?.transactionStatus||t?.status).toUpperCase()||"PENDING";const providerCheckoutId=norm(charge?.merchantChargeId||charge?.id||merchantChargeId);const providerSessionId=norm(charge?.id||t?.transactionId||merchantChargeId);
  const {data:session,error:se}=await admin.from("payment_sessions").insert({command_id:command.id,client_id:command.client_id,provider:"picpay",provider_session_id:providerSessionId,provider_checkout_id:providerCheckoutId,reference_id:merchantChargeId,amount,currency:"BRL",status:providerStatus==="PAID"?"paid":"pending",provider_status:providerStatus,raw_event:charge,webhook_verified:false,installments:type==="credit"?Math.max(1,Math.min(12,Number(body?.installments)||1)):1,card_brand:norm(body?.card_brand)||null}).select("id").single();if(se)throw se;
  return json({ok:true,session_id:session.id,provider:"picpay",payment_type:type,status:providerStatus,merchant_charge_id:merchantChargeId,provider_checkout_id:providerCheckoutId,transaction_id:norm(t?.transactionId)||null});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:"Erro interno"},500)}
});
