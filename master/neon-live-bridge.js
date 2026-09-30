/* ED & DU MASTER — Neon live bridge (additive; V33 visual remains untouched) */
(function(){
'use strict';
const KEY='eddu_neon_bridge_v1';
const mapKey='eddu_neon_id_map_v1';
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const stateMap=read(mapKey,{});
const api=async(entity,method='GET',body)=>{
  const r=await fetch('/api/data/'+encodeURIComponent(entity),{method,headers:{'Content-Type':'application/json'},body:body==null?undefined:JSON.stringify(body),credentials:'same-origin'});
  const j=await r.json().catch(()=>({ok:false,error:'invalid_json'}));
  if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
  return j;
};
const normalizeClient=x=>({name:String(x.name||x.fullName||'').trim(),email:x.email||null,phone:x.phone||null,cpf:x.cpf||null,birth_date:x.birth_date||x.birthDate||null,notes:x.notes||null,loyalty_points:Number(x.loyalty_points??x.loyaltyPoints??0)||0,active:x.active!==false});
const normalizeAppointment=x=>({client_id:stateMap.clients?.[x.clientId||x.client_id]||null,professional_id:stateMap.professionals?.[x.professionalId||x.professional_id]||null,starts_at:x.starts_at||x.startsAt||((x.date||'')+'T'+(x.start||'00:00')+':00'),ends_at:x.ends_at||x.endsAt||((x.date||'')+'T'+(x.end||'01:00')+':00'),status:String(x.status||'confirmed').toLowerCase().replace('confirmado','confirmed').replace('pendente','requested'),notes:x.notes||null});
async function load(entity){
  try{
    const r=await api(entity);
    if(!r.ok)return;
    const d=r.data||[];
    const data=window.data||{};
    if(entity==='clients')data.clients=d;
    if(entity==='appointments')data.appointments=d;
    if(entity==='commands')data.commands=d;
    if(entity==='financial_transactions')data.financialTransactions=d;
    if(entity==='agenda_blocks')data.blocks=d;
    window.data=data;
    write('eddu_neon_'+entity,d);
  }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}
}
async function pushNewClients(){
  const data=window.data||read('eddu_data',{});
  const clients=Array.isArray(data.clients)?data.clients:[];
  stateMap.clients=stateMap.clients||{};
  for(const c of clients){
    const local=String(c.id||c.name||'');
    if(!local||stateMap.clients[local])continue;
    if(!c.name)continue;
    try{
      const r=await api('clients','POST',normalizeClient(c));
      if(r.data?.id)stateMap.clients[local]=r.data.id;
    }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}
  }
  write(mapKey,stateMap);
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
    await pushNewAppointments();
    await load('clients');
    await load('appointments');
    await load('commands');
    await load('financial_transactions');
    await load('agenda_blocks');
    window.__EDDU_NEON_CONNECTED=true;
    write(KEY,{connectedAt:new Date().toISOString()});
  }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}
  finally{window.__EDDU_NEON_SYNCING=false}
}
const originalPersist=window.persist;
if(typeof originalPersist==='function'&&!window.__EDDU_NEON_PERSIST_WRAPPED){
  window.persist=function(){const r=originalPersist.apply(this,arguments);setTimeout(sync,0);return r};
  window.__EDDU_NEON_PERSIST_WRAPPED=true;
}
window.EDDU_NEON_SYNC=sync;
setTimeout(sync,900);
})();