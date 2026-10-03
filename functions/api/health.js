const DATA_API_URL='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

export async function onRequestGet({env}){
  const started=Date.now();
  const gateways={
    Asaas:Boolean(env?.ASAAS_API_KEY),
    PagBank:Boolean(env?.PAGBANK_TOKEN),
    Stripe:Boolean(env?.STRIPE_SECRET_KEY),
    PicPay:Boolean(env?.PICPAY_CLIENT_ID&&env?.PICPAY_CLIENT_SECRET),
    Nubank:Boolean(env?.NUPAY_MERCHANT_KEY&&env?.NUPAY_MERCHANT_TOKEN)
  };
  try{
    const upstream=await fetch(DATA_API_URL+'/clients?select=id&limit=1',{method:'GET',headers:{'Accept':'application/json'},redirect:'follow'});
    const reachable=upstream.status<500;
    return Response.json({ok:reachable,service:'neon',transport:'data-api',status:upstream.status,reachable,latencyMs:Date.now()-started,gatewayConfiguration:gateways},{status:reachable?200:503,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({ok:false,service:'neon',transport:'data-api',error:'data api unreachable',detail:String(error?.message||error),gatewayConfiguration:gateways},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}