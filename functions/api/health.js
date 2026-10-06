import { neon } from '@neondatabase/serverless';

export async function onRequestGet({env}){
  const started=Date.now();
  const gateways={
    Asaas:Boolean(env?.ASAAS_API_KEY),
    PagBank:Boolean(env?.PAGBANK_TOKEN),
    Stripe:Boolean(env?.STRIPE_SECRET_KEY),
    PicPay:Boolean(env?.PICPAY_CLIENT_ID&&env?.PICPAY_CLIENT_SECRET),
    Nubank:Boolean(env?.NUPAY_MERCHANT_KEY&&env?.NUPAY_MERCHANT_TOKEN)
  };
  if(!env?.NEON_DATABASE_URL){
    return Response.json({ok:false,service:'neon',transport:'serverless',status:503,reachable:false,latencyMs:Date.now()-started,error:'NEON_DATABASE_URL não configurada',gatewayConfiguration:gateways},{status:503,headers:{'Cache-Control':'no-store'}});
  }
  try{
    const sql=neon(env.NEON_DATABASE_URL);
    await sql`select 1 as ok`;
    return Response.json({ok:true,service:'neon',transport:'serverless',status:200,reachable:true,latencyMs:Date.now()-started,gatewayConfiguration:gateways},{status:200,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({ok:false,service:'neon',transport:'serverless',status:503,reachable:false,latencyMs:Date.now()-started,error:'Neon database unreachable',detail:String(error?.message||error),gatewayConfiguration:gateways},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}