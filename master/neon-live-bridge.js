/* ED & DU MASTER — Neon live bridge (additive; V33 visual remains untouched) */
(function(){
'use strict';
const KEY='eddu_neon_bridge_v1';
const mapKey='eddu_neon_id_map_v1';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const stateMap=read(mapKey,{});
const waitClient=async()=>{
  if(window.__EDDU_NEON_CLIENT)return window.__EDDU_NEON_CLIENT;
  if(window.__EDDU_NEON_READY===false)throw new Error(window.__EDDU_NEON_LAST_ERROR||'Neon client unavailable');
  await new Promise(resolve=>window.addEventListener('eddu-neon-ready',resolve,{once:true}));
  if(!window.__EDDU_NEON_CLIENT)throw new Error('Neon Auth client unavailable');
  return window.__EDDU_NEON_CLIENT;
};
const api=async(entity,method='GET',body)=>{
  const client=await waitClient();
  let q=client.from(entity);
  let result;
  if(method==='GET'){
    const id=new URLSearchParams(location.search).get('id');
    result=id?await q.select('*').eq('id',id).limit(1):await q.select('*').limit(200);
  }else if(method==='POST'){
    result=await q.insert(body).select('*').limit(1);
  }else if(method==='PATCH'){
    if(!body?.id)throw new Error('id_required');
    const {id,...patch}=body;
    result=await q.update(patch).eq('id',id).select('*').limit(1);
  }else if(method==='DELETE'){
    const id=body?.id||new URLSearchParams(location.search).get('id');
    if(!id)throw new Error('id_required');
    result=await q.delete().eq('id',id).select('id').limit(1);
  }else throw new Error('method_not_allowed');
  if(result?.error){
    const msg=String(result.error.message||result.error.code||'Neon Data API error');
    if(/auth|required|jwt|token|unauthor/i.test(msg)&&typeof window.__EDDU_NEON_AUTH_REQUIRED==='function')window.__EDDU_NEON_AUTH_REQUIRED();
    throw new Error(msg);
  }
  return {ok:true,entity:entity,data:result?.data||[]};
};
const normalizeClient=x=>({name:String(x.name||x.fullName||'').trim(),email:x.email||null,phone:x.phone||null,cpf:x.cpf||null,birth_date:x.birth_date||x.birthDate||null,notes:x.notes||null,loyalty_points:Number(x.loyalty_points??x.loyaltyPoints??0)||0,active:x.active!==false});
const normalizeProfessional=x=>({user_id:x.user_id||x.userId||null,name:String(x.name||x.nome||'').trim(),email:x.email||null,phone:x.phone||null,specialty:x.specialty||x.especialidade||null,commission_rate:Number(x.commission_rate??x.commissionRate??x.commission??0)||0,active:x.active!==false});
const normalizeService=x=>({category_id:x.category_id||x.categoryId||null,name:String(x.name||x.nome||x.service||'').trim(),description:x.description||null,price:Number(x.price??x.valor??x.value??0)||0,duration_minutes:Number(x.duration_minutes??x.duration??60)||60,active:x.active!==false,price_base:Number(x.price_base??x.priceBase??x.price??0)||0,price_long:Number(x.price_long??x.priceLong??x.price??0)||0,service_cost:Number(x.service_cost??x.serviceCost??x.cost??0)||0});
const normalizeProduct=x=>({category_id:x.category_id||x.categoryId||null,sku:x.sku||null,name:String(x.name||x.nome||x.product||'').trim(),description:x.description||null,sale_price:Number(x.sale_price??x.salePrice??x.price??0)||0,cost_price:Number(x.cost_price??x.costPrice??x.cost??0)||0,stock:Number(x.stock??0)||0,minimum_stock:Number(x.minimum_stock??x.minimumStock??0)||0,active:x.active!==false});
const normalizeAppointment=x=>({client_id:x.client_id||x.clientId||stateMap.clients?.[x.clientId]||null,professional_id:x.professional_id||x.professionalId||stateMap.professionals?.[x.professionalId]||null,service_id:x.service_id||x.serviceId||stateMap.services?.[x.serviceId]||null,starts_at:x.starts_at||x.startsAt||((x.date||'')+'T'+(x.start||'00:00')+':00'),ends_at:x.ends_at||x.endsAt||((x.date||'')+'T'+(x.end||'01:00')+':00'),status:String(x.status||'confirmed').toLowerCase().replace('confirmado','confirmed').replace('pendente','requested').replace('cancelado','cancelled'),notes:x.notes||null});
async function load(entity){
  try{
    const r=await api(entity);
    const d=r.data||[];
    const data=window.data||{};
    if(entity==='clients')data.clients=d;
    if(entity==='professionals')data.professionals=d;
    if(entity==='services')data.services=d;
    if(entity==='products')data.products=d;
    if(entity==='appointments')data.appointments=d;
    if(entity==='commands')data.commands=d;
    if(entity==='financial_transactions')data.financialTransactions=d;
    if(entity==='payments')data.payments=d;
    if(entity==='agenda_blocks')data.blocks=d;
    window.data=data;
    write('eddu_neon_'+entity,d);
  }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}
}
async function pushMapped(entity,items,normalizer){
  if(!Array.isArray(items))return;
  stateMap[entity]=stateMap[entity]||{};
  for(const item of items){
    const local=String(item?.id||item?.name||'');
    if(!local||stateMap[entity][local])continue;
    const payload=normalizer(item);
    if(!payload.name)continue;
    try{
      const r=await api(entity,'POST',payload);
      if(r.data?.id)stateMap[entity][local]=r.data.id;
    }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}
  }
  write(mapKey,stateMap);
}
async function pushNewClients(){
  const data=window.data||read('eddu_data',{});
  await pushMapped('clients',Array.isArray(data.clients)?data.clients:[],normalizeClient);
}
async function pushNewProfessionals(){
  const data=window.data||read('eddu_data',{});
  await pushMapped('professionals',Array.isArray(data.professionals)?data.professionals:[],normalizeProfessional);
}
async function pushNewServices(){
  const data=window.data||read('eddu_data',{});
  await pushMapped('services',Array.isArray(data.services)?data.services:[],normalizeService);
}
async function pushNewProducts(){
  const data=window.data||read('eddu_data',{});
  await pushMapped('products',Array.isArray(data.products)?data.products:[],normalizeProduct);
}
async function pushNewAppointments(){
  const data=window.data||read('eddu_data',{});
  const apps=Array.isArray(data.appointments)?data.appointments:[];
  stateMap.appointments=stateMap.appointments||{};
  for(const a of apps){
    const local=String(a.id||((a.date||'')+'|'+(a.start||'')+'|'+(a.client||a.clientName||'')));
    if(!local||stateMap.appointments[local])continue;
    const payload=normalizeAppointment(a);
    if(!payload.starts_at||!payload.ends_at)continue;
    try{
      const r=await api('appointments','POST',payload);
      if(r.data?.id)stateMap.appointments[local]=r.data.id;
    }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}
  }
  write(mapKey,stateMap);
}
async function sync(){
  if(window.__EDDU_NEON_SYNCING)return;
  window.__EDDU_NEON_SYNCING=true;
  try{
    await pushNewClients();
    await pushNewProfessionals();
    await pushNewServices();
    await pushNewProducts();
    await pushNewAppointments();
    await load('clients');
    await load('professionals');
    await load('services');
    await load('products');
    await load('appointments');
    await load('commands');
    await load('financial_transactions');
    await load('payments');
    await load('agenda_blocks');
    window.__EDDU_NEON_CONNECTED=true;
    write(KEY,{connectedAt:new Date().toISOString(),scope:['clients','professionals','services','products','appointments','commands','financial_transactions','payments','agenda_blocks']});
  }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}
  finally{window.__EDDU_NEON_SYNCING=false}
}
function refreshCommercialMetrics(){
  try{
    const box=document.querySelector('.performance-card-overlay');
    if(!box)return;
    const month=new Date().toISOString().slice(0,7);
    const tx=Array.isArray(window.data?.financialTransactions)?window.data.financialTransactions:[];
    const paid=Array.isArray(window.data?.payments)?window.data.payments:[];
    const revenue=[...tx.map(x=>({amount:Number(x.amount||0),direction:x.direction,date:x.paid_at||x.created_at||x.date,status:String(x.status||'')})),...paid.map(x=>({amount:Number(x.amount||0),direction:'in',date:x.paid_at||x.created_at,status:String(x.status||'')}))]
      .filter(x=>x.direction==='in'&&x.date&&String(x.date).slice(0,7)===month&&!/cancel|void/i.test(x.status))
      .reduce((s,x)=>s+x.amount,0);
    const target=Number(window.data?.settings?.monthlyTarget??localStorage.getItem('eddu_monthly_target')??0)||0;
    const pct=target>0?Math.min(100,(revenue/target)*100):0;
    const remain=Math.max(0,target-revenue);
    const nums=box.querySelectorAll('.pc-grid .pc-k b');
    if(nums[0])nums[0].textContent=money(revenue);
    if(nums[1])nums[1].textContent=Math.round(pct)+'%';
    if(nums[2])nums[2].textContent=money(target);
    const bar=box.querySelector('.pc-bar i');if(bar)bar.style.width=pct+'%';
    const goal=box.querySelector('.pc-goal');
    if(goal)goal.textContent=target>0?(remain>0?money(remain)+' para atingir a meta 🎯 · toque para abrir o painel comercial':'Meta mensal atingida 🎯 · toque para abrir o painel comercial'):'Meta mensal não configurada · toque para abrir o painel comercial';
  }catch(_){}
}
setInterval(refreshCommercialMetrics,1000);
setTimeout(refreshCommercialMetrics,0);

const originalPersist=window.persist;
if(typeof originalPersist==='function'&&!window.__EDDU_NEON_PERSIST_WRAPPED){
  window.persist=function(){const r=originalPersist.apply(this,arguments);setTimeout(sync,0);return r};
  window.__EDDU_NEON_PERSIST_WRAPPED=true;
}
window.EDDU_NEON_SYNC=sync;
setTimeout(sync,900);
})();