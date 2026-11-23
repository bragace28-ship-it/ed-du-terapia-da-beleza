import { neon } from '@neondatabase/serverless';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','Vary':'Cookie, Authorization'}});
const DEFAULT_AUTH_URL='https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
async function validateSession(request,env){
 const cookie=request.headers.get('Cookie')||'',authorization=request.headers.get('Authorization')||'';
 if(!cookie&&!/^Bearer\s+\S+/i.test(authorization))return null;
 const headers=new Headers({Accept:'application/json'});if(cookie)headers.set('Cookie',cookie);if(authorization)headers.set('Authorization',authorization);
 const response=await fetch(String(env.NEON_AUTH_URL||DEFAULT_AUTH_URL).replace(/\/+$/,'')+'/get-session',{headers,signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!response.ok)return null;const payload=await response.json();if(!payload?.user?.id||!payload?.session)return null;
 if(payload.session.expiresAt&&new Date(payload.session.expiresAt).getTime()<=Date.now())return null;
 return {id:String(payload.user.id),email:String(payload.user.email||'').trim().toLowerCase()};
}
export async function onRequestGet({request,env}){
 if(!env.NEON_DATABASE_URL)return json({ok:false,error:'NEON_DATABASE_URL não configurada'},503);
 const auth=await validateSession(request,env);if(!auth)return json({ok:false,error:'UNAUTHORIZED'},401);
 if(!auth.email)return json({ok:false,error:'CLIENT_EMAIL_REQUIRED'},403);
 const sql=neon(env.NEON_DATABASE_URL);
 const result=await sql`
  SELECT c.id AS command_id,c.status AS command_status,c.total,c.subtotal,c.discount,c.discount_reason,c.created_at,
   COALESCE((SELECT json_agg(json_build_object('description',ci.description,'quantity',ci.quantity,'unit_price',ci.unit_price,'total',ci.total) ORDER BY ci.created_at)
    FROM public.command_items ci WHERE ci.command_id=c.id),'[]'::json) AS items,
   p.id AS payment_id,p.gateway,p.method,p.status AS payment_status,p.installments,
   p.metadata->>'checkoutUrl' AS checkout_url,p.metadata->>'qrCode' AS qr_code,p.metadata->>'qrCodeBase64' AS qr_code_base64
  FROM public.clients cl
  JOIN public.commands c ON c.client_id=cl.id
  JOIN LATERAL (SELECT pay.* FROM public.payments pay WHERE pay.command_id=c.id AND upper(pay.status) IN ('CHECKOUT_PENDING','PENDING','AWAITING_PAYMENT') ORDER BY pay.created_at DESC LIMIT 1) p ON true
  WHERE (lower(COALESCE(cl.email,''))=${auth.email} OR cl.user_id::text=${auth.id}) AND c.status IN ('payment_pending','awaiting_payment')
  ORDER BY c.created_at DESC
  LIMIT 50
 `;
 return json({ok:true,commands:result.map(row=>({...row,checkout_url:typeof row.checkout_url==='string'&&/^https:\/\//i.test(row.checkout_url)?row.checkout_url:null}))});
}
