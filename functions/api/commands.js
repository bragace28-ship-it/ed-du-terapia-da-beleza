import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const DEFAULT_AUTH_URL='https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Cookie, Authorization','X-Content-Type-Options':'nosniff'}});
const jwksCache=new Map();
function bearer(request){const m=String(request.headers.get('Authorization')||'').match(/^Bearer\\s+(.+)$/i);return m?.[1]||null;}
function authJwks(base){const url=String(base||DEFAULT_AUTH_URL).replace(/\/+$/,'');if(!jwksCache.has(url))jwksCache.set(url,createRemoteJWKSet(new URL(url+'/.well-known/jwks.json')));return {resolver:jwksCache.get(url),issuer:new URL(url).origin};}
async function authenticate(request,env){
 const token=bearer(request);if(!token)return null;
 try{const {resolver,issuer}=authJwks(env.NEON_AUTH_URL);const {payload}=await jwtVerify(token,resolver,{issuer});if(!payload?.sub)return null;return {id:String(payload.sub),email:String(payload.email||'').trim().toLowerCase()};}catch(e){console.warn('EDDU_COMMAND_AUTH_REJECTED',String(e?.code||e?.message||'JWT_INVALID'));return null;}
}
async function appUser(sql,auth){
 const rows=await sql`SELECT id,auth_user_id,name,email,role,status,permissions FROM public.app_users WHERE auth_user_id=${auth.id} OR lower(email)=${auth.email} ORDER BY CASE WHEN auth_user_id=${auth.id} THEN 0 ELSE 1 END LIMIT 2`;
 if(rows.length!==1)return null;const u=rows[0];
 if(!['active','ativo'].includes(String(u.status||'').toLowerCase()))return null;
 if(u.auth_user_id&&String(u.auth_user_id)!==auth.id)return null;
 if(!u.auth_user_id){const linked=await sql`UPDATE public.app_users SET auth_user_id=${auth.id},updated_at=now() WHERE id=${u.id} AND auth_user_id IS NULL RETURNING id,role,permissions,status`;if(linked.length!==1)return null;return linked[0];}
 return u;
}
function permitted(user){
 if(['admin','owner','super_admin','administrator'].includes(String(user.role||'').toLowerCase()))return true;
 const p=user.permissions;if(Array.isArray(p))return p.includes('*')||p.includes('commands')||p.includes('commands.create')||p.includes('commands.update');
 return !!(p&&typeof p==='object'&&(p['*']===true||p.commands===true||p['commands.create']===true||p['commands.update']===true));
}
function validUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''));}
function validate(body){
 if(!validUuid(body.client_id)||!validUuid(body.professional_id))throw new Error('Selecione um cliente e um profissional válidos.');
 if(body.appointment_id&&!validUuid(body.appointment_id))throw new Error('Agendamento inválido.');
 if(!Array.isArray(body.items)||!body.items.length)throw new Error('Adicione ao menos um serviço ou produto.');
 if(body.items.length>100)throw new Error('Limite de 100 itens por comanda.');
 const items=body.items.map((x)=>{
  if(!['service','product'].includes(x.item_type))throw new Error('Tipo de item inválido.');
  if(!String(x.description||'').trim())throw new Error('Descrição do item obrigatória.');
  const quantity=Number(x.quantity),unit_price=Number(x.unit_price),total=Number(x.total);
  if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(unit_price)||unit_price<0||!Number.isFinite(total)||total<0)throw new Error('Confira quantidades e preços dos itens.');
  if(x.service_id&&!validUuid(x.service_id))throw new Error('Serviço inválido.');
  if(x.product_id&&!validUuid(x.product_id))throw new Error('Produto inválido.');
  return {item_type:x.item_type,service_id:x.service_id||null,product_id:x.product_id||null,description:String(x.description).trim(),quantity,unit_price,total,professional_id:body.professional_id,unit_cost:Number(x.unit_cost||0),commission_percent:Number(x.commission_percent||0)};
 });
 const subtotal=items.reduce((n,x)=>n+x.total,0),discount=Math.min(subtotal,Math.max(0,Number(body.discount||0))),total=subtotal-discount;
 if(!Number.isFinite(subtotal)||subtotal<=0||Number(body.subtotal)!==subtotal||Math.abs(Number(body.total)-total)>0.01)throw new Error('Os totais da comanda não conferem. Atualize os itens e tente novamente.');
 return {items,subtotal,discount,total,discount_reason:body.discount_reason?String(body.discount_reason).slice(0,160):null};
}
export async function onRequest({request,env}){
 if(!env.NEON_DATABASE_URL)return json({ok:false,error:'DATABASE_NOT_CONFIGURED'},503);
 if(!['POST','PATCH'].includes(request.method))return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
 const origin=request.headers.get('Origin');try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return json({ok:false,error:'INVALID_ORIGIN'},403);}catch{return json({ok:false,error:'INVALID_ORIGIN'},403);}
 const auth=await authenticate(request,env);if(!auth)return json({ok:false,error:'UNAUTHORIZED'},401);
 try{
  const sql=neon(env.NEON_DATABASE_URL),user=await appUser(sql,auth);if(!user)return json({ok:false,error:'APPLICATION_USER_NOT_ACTIVE'},403);if(!permitted(user))return json({ok:false,error:'FORBIDDEN'},403);
  const body=await request.json(),v=validate(body);
  if(request.method==='POST'){
   const rows=await sql`
    WITH new_command AS (
     INSERT INTO public.commands(client_id,professional_id,appointment_id,status,subtotal,discount,discount_reason,total,created_by)
     VALUES(${body.client_id},${body.professional_id},${body.appointment_id||null},'open',${v.subtotal},${v.discount},${v.discount_reason},${v.total},${user.id})
     RETURNING *
    ), new_items AS (
     INSERT INTO public.command_items(command_id,item_type,service_id,product_id,description,quantity,unit_price,professional_id,unit_cost,commission_percent)
     SELECT c.id,x.item_type,x.service_id,x.product_id,x.description,x.quantity,x.unit_price,x.professional_id,x.unit_cost,x.commission_percent
     FROM new_command c CROSS JOIN jsonb_to_recordset(${JSON.stringify(v.items)}::jsonb) AS x(item_type text,service_id uuid,product_id uuid,description text,quantity numeric,unit_price numeric,professional_id uuid,unit_cost numeric,commission_percent numeric)
     RETURNING *
    )
    SELECT row_to_json(c) AS command,COALESCE((SELECT json_agg(i ORDER BY i.created_at) FROM new_items i),'[]'::json) AS items FROM new_command c
   `;
   if(rows.length!==1||!rows[0].command)return json({ok:false,error:'COMMAND_CREATE_FAILED'},500);
   return json({ok:true,command:rows[0].command,items:rows[0].items},201);
  }
  if(!validUuid(body.id))return json({ok:false,error:'ID_REQUIRED'},400);
  const rows=await sql`
   WITH changed_command AS (
    UPDATE public.commands SET client_id=${body.client_id},professional_id=${body.professional_id},appointment_id=${body.appointment_id||null},subtotal=${v.subtotal},discount=${v.discount},discount_reason=${v.discount_reason},total=${v.total},updated_at=now()
    WHERE id=${body.id} AND status='open' RETURNING *
   ), deleted_items AS (
    DELETE FROM public.command_items WHERE command_id IN (SELECT id FROM changed_command) RETURNING id
   ), new_items AS (
    INSERT INTO public.command_items(command_id,item_type,service_id,product_id,description,quantity,unit_price,professional_id,unit_cost,commission_percent)
    SELECT c.id,x.item_type,x.service_id,x.product_id,x.description,x.quantity,x.unit_price,x.professional_id,x.unit_cost,x.commission_percent
    FROM changed_command c CROSS JOIN (SELECT count(*) FROM deleted_items) gone CROSS JOIN jsonb_to_recordset(${JSON.stringify(v.items)}::jsonb) AS x(item_type text,service_id uuid,product_id uuid,description text,quantity numeric,unit_price numeric,professional_id uuid,unit_cost numeric,commission_percent numeric)
    RETURNING *
   )
   SELECT row_to_json(c) AS command,COALESCE((SELECT json_agg(i ORDER BY i.created_at) FROM new_items i),'[]'::json) AS items FROM changed_command c
  `;
  if(rows.length!==1||!rows[0].command)return json({ok:false,error:'COMMAND_NOT_FOUND_OR_NOT_OPEN'},409);
  return json({ok:true,command:rows[0].command,items:rows[0].items});
 }catch(error){const message=String(error?.message||error);console.error('EDDU_COMMAND_TRANSACTION_FAILED',message);return json({ok:false,error:message.startsWith('Selecione')||message.startsWith('Adicione')||message.startsWith('Limite')||message.startsWith('Tipo')||message.startsWith('Descrição')||message.startsWith('Confira')||message.startsWith('Serviço')||message.startsWith('Os totais')?'VALIDATION_FAILED':'COMMAND_TRANSACTION_FAILED',message},400);}
}
