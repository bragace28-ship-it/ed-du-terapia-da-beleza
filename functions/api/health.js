const DATA_API_URL='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';

export async function onRequestGet(){
  const started=Date.now();
  try{
    const upstream=await fetch(DATA_API_URL+'/clients?select=id&limit=1',{method:'GET',headers:{'Accept':'application/json'},redirect:'follow'});
    const reachable=upstream.status<500;
    return Response.json({
      ok:reachable,
      service:'neon',
      transport:'data-api',
      status:upstream.status,
      reachable,
      latencyMs:Date.now()-started
    },{status:reachable?200:503,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    return Response.json({ok:false,service:'neon',transport:'data-api',error:'data api unreachable',detail:String(error?.message||error)},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}