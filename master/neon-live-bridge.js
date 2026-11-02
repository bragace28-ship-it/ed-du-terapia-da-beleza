/* ED & DU MASTER — Neon live bridge (additive; the approved Master UI remains untouched) */
(function(){
'use strict';
const KEY='eddu_neon_bridge_v1';
const mapKey='eddu_neon_id_map_v1';
const APP_DATA_KEY='eddu_master_data_v1';
const appData=()=>read(APP_DATA_KEY,{});
const saveAppData=d=>{if(!write(APP_DATA_KEY,d))throw new Error(window.__EDDU_NEON_LAST_ERROR||'Falha ao salvar dados locais');window.data=d;};
const rowOf=r=>Array.isArray(r?.data)?r.data[0]:(r?.data||null);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){window.__EDDU_NEON_LAST_ERROR='Falha ao gravar estado local: '+String(e?.message||e);return false}};
const stateMap=read(mapKey,{});
const waitClient=async(timeoutMs=10000)=>{
  if(window.__EDDU_NEON_CLIENT)return window.__EDDU_NEON_CLIENT;
  if(window.__EDDU_NEON_READY===false)throw new Error(window.__EDDU_NEON_LAST_ERROR||'Neon client unavailable');
  await new Promise((resolve,reject)=>{
    let done=false,timer;
    const finish=err=>{if(done)return;done=true;clearTimeout(timer);window.removeEventListener('eddu-neon-ready',ready);err?reject(err):resolve()};
    const ready=()=>finish();
    timer=setTimeout(()=>finish(new Error('Tempo limite aguardando conexão com Neon')),timeoutMs);
    window.addEventListener('eddu-neon-ready',ready,{once:true});
    if(window.__EDDU_NEON_CLIENT)finish();
  });
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
async function resolveRecordId(entity,value){
  const raw=String(value??'').trim();if(!raw)return null;
  if(UUID.test(raw))return raw;
  stateMap[entity]=stateMap[entity]||{};
  if(stateMap[entity][raw])return stateMap[entity][raw];
  const rows=(await api(entity)).data||[];
  const found=rows.find(x=>String(x.name||'').trim().toLowerCase()===raw.toLowerCase());
  if(found?.id){stateMap[entity][raw]=found.id;write(mapKey,stateMap);return found.id;}
  throw new Error('Registro "'+raw+'" não encontrado no Neon ('+entity+'). Cadastre o registro antes de continuar.');
}
async function normalizeAppointment(x){
  const clientValue=x.clientId||x.client_id||x.client||x.clientName;
  const professionalValue=x.professionalId||x.professional_id||x.professional;
  const serviceValue=x.serviceId||x.service_id||x.service;
  const starts=x.starts_at||x.startsAt||new Date((x.date||'')+'T'+(x.start||'00:00')).toISOString();
  const ends=x.ends_at||x.endsAt||new Date((x.date||'')+'T'+(x.end||'01:00')).toISOString();
  return {client_id:await resolveRecordId('clients',clientValue),professional_id:await resolveRecordId('professionals',professionalValue),service_id:await resolveRecordId('services',serviceValue),starts_at:starts,ends_at:ends,status:String(x.status||'confirmed').toLowerCase().replace('confirmado','confirmed').replace('pendente','requested'),notes:x.notes||null};
}
function dbAppointmentToUi(row,data){
 const local=Object.keys(stateMap.appointments||{}).find(k=>stateMap.appointments[k]===row.id)||row.id;
 const start=new Date(row.starts_at),end=new Date(row.ends_at);
 const clock=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
 const date=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const name=(table,id)=>((data[table]||[]).find(x=>x.id===id)?.name||'');
 return {id:local,serverId:row.id,clientId:row.client_id,professionalId:row.professional_id,serviceId:row.service_id,date:date(start),start:clock(start),end:clock(end),client:name('clients',row.client_id),professional:name('professionals',row.professional_id),service:name('services',row.service_id),status:String(row.status||'requested')==='confirmed'?'Confirmado':'Pendente',statusCode:String(row.status||'requested'),notes:row.notes||''};
}
function dbAgendaBlockToUi(row){
 const local=Object.keys(stateMap.agenda_blocks||{}).find(k=>stateMap.agenda_blocks[k]===row.id)||row.id;
 const start=new Date(row.starts_at),end=new Date(row.ends_at);
 const clock=d=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
 const date=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const startDate=date(start),endDate=date(end),startClock=clock(start);
 const fullDay=startClock==='00:00'&&((endDate!==startDate)||clock(end)==='23:59');
 return {id:local,serverId:row.id,professionalId:row.professional_id||null,date:startDate,start:startClock,end:fullDay?'23:59':clock(end),reason:row.reason||'',fullDay,wholeDay:fullDay};
}
async function load(entity){
  try{
    const r=await api(entity);
    const d=r.data||[];
    const data=appData();
    stateMap[entity]=stateMap[entity]||{};
    for(const row of d)if(row?.id)stateMap[entity][row.id]=row.id;
    write(mapKey,stateMap);
    if(entity==='clients')data.clients=d;
    if(entity==='professionals')data.professionals=d;
    if(entity==='services')data.services=d;
    if(entity==='products')data.products=d;
    if(entity==='appointments')data.appointments=d.map(row=>dbAppointmentToUi(row,data));
    if(entity==='clients'||entity==='professionals'||entity==='services'||entity==='products')data[entity]=d;
    if(entity==='commands')data.commands=d;
    if(entity==='financial_transactions')data.financialTransactions=d;
    if(entity==='agenda_blocks')data.blocks=d.map(dbAgendaBlockToUi);
    saveAppData(data);
    if(!write('eddu_neon_'+entity,d))throw new Error(window.__EDDU_NEON_LAST_ERROR||'Falha ao atualizar cache local');
    return {ok:true,entity,count:d.length};
  }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e);throw e}
}
async function pushMapped(entity,items,normalizer){
  if(!Array.isArray(items))throw new Error('Lista inválida para sincronizar: '+entity);
  stateMap[entity]=stateMap[entity]||{};
  for(const item of items){
    const local=String(item?.id||item?.name||'');
    if(!local||stateMap[entity][local])continue;
    const payload=normalizer(item);
    if(!payload.name)continue;
    try{
      const r=await api(entity,'POST',payload);
      const inserted=rowOf(r);if(inserted?.id)stateMap[entity][local]=inserted.id;
    }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e);throw new Error('Falha ao persistir '+entity+' ('+local+'): '+window.__EDDU_NEON_LAST_ERROR)}
  }
  if(!write(mapKey,stateMap))throw new Error(window.__EDDU_NEON_LAST_ERROR||'Falha ao gravar mapa de sincronização');
}
async function pushNewClients(){
  const data=appData();
  await pushMapped('clients',Array.isArray(data.clients)?data.clients:[],normalizeClient);
}
async function pushNewProfessionals(){
  const data=appData();
  await pushMapped('professionals',Array.isArray(data.professionals)?data.professionals:[],normalizeProfessional);
}
async function pushNewServices(){
  const data=appData();
  await pushMapped('services',Array.isArray(data.services)?data.services:[],normalizeService);
}
async function pushNewProducts(){
  const data=appData();
  await pushMapped('products',Array.isArray(data.products)?data.products:[],normalizeProduct);
}
async function pushNewAgendaBlocks(){
  const data=appData(),items=Array.isArray(data.blocks)?data.blocks:[];
  stateMap.agenda_blocks=stateMap.agenda_blocks||{};
  for(const block of items){
    const local=String(block?.id||((block?.date||'')+'|'+(block?.start||'00:00')+'|'+(block?.reason||'')));
    if(!local||stateMap.agenda_blocks[local])continue;
    const date=String(block.date||'').trim();
    let starts=block.starts_at||block.startsAt||'';
    let ends=block.ends_at||block.endsAt||'';
    const existingDuration=starts&&ends?new Date(ends).getTime()-new Date(starts).getTime():0;
    const fullDay=block.fullDay===true||block.wholeDay===true||(String(block.start||'').slice(0,5)==='00:00'&&String(block.end||'').slice(0,5)==='23:59')||existingDuration>=86340000;
    if(fullDay){
      if(!date)throw new Error('Bloqueio de dia inteiro '+local+' sem data válida.');
      const dayStart=new Date(date+'T00:00:00');
      const nextDay=new Date(dayStart);
      nextDay.setDate(nextDay.getDate()+1);
      starts=dayStart.toISOString();
      ends=nextDay.toISOString();
    }else{
      if(!starts){
        if(!date)throw new Error('Bloqueio local '+local+' sem data válida.');
        starts=new Date(date+'T'+(block.start||'00:00')+':00').toISOString();
      }
      if(!ends){
        if(!date)throw new Error('Bloqueio local '+local+' sem data válida.');
        ends=new Date(date+'T'+(block.end||'23:59')+':00').toISOString();
      }
    }
    if(!Number.isFinite(new Date(starts).getTime())||!Number.isFinite(new Date(ends).getTime())||new Date(ends)<=new Date(starts))
      throw new Error('Bloqueio local '+local+' possui intervalo inválido.');
    const professionalValue=block.professional_id||block.professionalId||block.professional||null;
    const professional_id=professionalValue?await resolveRecordId('professionals',professionalValue):null;
    const payload={professional_id,starts_at:starts,ends_at:ends,reason:String(block.reason||'Bloqueio de agenda')};
    try{
      const r=await api('agenda_blocks','POST',payload);
      const inserted=rowOf(r);
      if(!inserted?.id)throw new Error('Servidor não confirmou ID do bloqueio.');
      stateMap.agenda_blocks[local]=inserted.id;
    }catch(e){
      window.__EDDU_NEON_LAST_ERROR=String(e.message||e);
      throw new Error('Falha ao persistir agenda_blocks ('+local+'): '+window.__EDDU_NEON_LAST_ERROR);
    }
  }
  if(!write(mapKey,stateMap))throw new Error(window.__EDDU_NEON_LAST_ERROR||'Falha ao gravar mapa de bloqueios');
}

async function pushNewAppointments(){
  const data=appData();
  const apps=Array.isArray(data.appointments)?data.appointments:[];
  stateMap.appointments=stateMap.appointments||{};
  for(const a of apps){
    const local=String(a.id||((a.date||'')+'|'+(a.start||'')+'|'+(a.client||a.clientName||'')));
    if(!local||stateMap.appointments[local])continue;
    const payload=await normalizeAppointment(a);
    if(!payload.client_id||!payload.professional_id||!payload.service_id)throw new Error('Agendamento local '+local+' sem IDs reais de cliente, profissional ou serviço; não será sincronizado como válido.');
    if(!payload.starts_at||!payload.ends_at||new Date(payload.ends_at)<=new Date(payload.starts_at))throw new Error('Agendamento local '+local+' possui data/horário inválido.');
    try{
      const r=await api('appointments','POST',payload);
      const inserted=rowOf(r);if(inserted?.id)stateMap.appointments[local]=inserted.id;
    }catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e);throw new Error('Falha ao persistir appointments ('+local+'): '+window.__EDDU_NEON_LAST_ERROR)}
  }
  if(!write(mapKey,stateMap))throw new Error(window.__EDDU_NEON_LAST_ERROR||'Falha ao gravar mapa de agendamentos');
}

const GENERIC_MAP={
  coupons:'coupons',giftCards:'gift_cards',gift_cards:'gift_cards',referrals:'referrals',
  quotes:'quotes',receivables:'receivables',receivableInstallments:'receivable_installments',
  payables:'payables',cardInvoices:'card_invoices',commissions:'commissions',
  terms:'terms',anamneses:'anamneses',beforeAfterGallery:'before_after_gallery',
  openFinanceConnections:'open_finance_connections',loyaltyAccounts:'loyalty_accounts',
  loyaltyTransactions:'loyalty_transactions',creditAccounts:'credit_accounts',
  creditAlerts:'credit_alerts',recurringPayments:'recurring_payments',ocrDocuments:'ocr_documents',
  accountActions:'account_actions'
};
const FIELD_MAP={clientId:'client_id',professionalId:'professional_id',serviceId:'service_id',productId:'product_id',commandId:'command_id',appointmentId:'appointment_id',referrerClientId:'referrer_client_id',giftCardId:'gift_card_id',loyaltyAccountId:'loyalty_account_id',receivableId:'receivable_id',userId:'user_id',createdBy:'created_by',paidAt:'paid_at',dueAt:'due_at',startsAt:'starts_at',endsAt:'ends_at',beforeRef:'before_ref',afterRef:'after_ref',collageRef:'collage_ref',storageRef:'storage_ref',mimeType:'mime_type',extractedData:'extracted_data'};
function genericPayload(entity,item){
  const out={};const allowed=new Set({
    coupons:['code','type','value','service_id','active','starts_at','expires_at','usage_limit','usage_count','metadata'],
    gift_cards:['code','title','value','status','metadata'],referrals:['referrer_client_id','referred_name','referred_phone','gift_card_id','status','points_awarded'],
    quotes:['client_id','professional_id','total_amount','status','payload'],receivables:['client_id','command_id','description','total_amount','paid_amount','due_at','status','method','metadata'],
    receivable_installments:['receivable_id','installment_no','amount','due_at','paid_at','status'],payables:['description','supplier','amount','due_at','paid_at','status','category','card_invoice','metadata'],
    card_invoices:['card_name','amount','due_at','category','status','metadata'],commissions:['professional_id','command_id','base_amount','commission_rate','commission_amount','paid_amount','status'],
    terms:['client_id','status','sent_at','signed_at','payload'],anamneses:['client_id','objective','analysis','private_formula','private_notes','files'],
    before_after_gallery:['client_id','title','caption','before_ref','after_ref','collage_ref'],open_finance_connections:['provider','status','external_account_ref','metadata'],
    loyalty_accounts:['client_id','points_balance'],loyalty_transactions:['loyalty_account_id','points','reason','referral_id'],
    credit_accounts:['client_id','credit_limit','balance','status'],credit_alerts:['client_id','type','message','status','resolved_at'],
    recurring_payments:['client_id','provider','external_id','amount','interval','status','metadata'],ocr_documents:['payable_id','filename','mime_type','storage_ref','extracted_data','status'],
    account_actions:['user_id','action','entity','entity_id','payload']
  }[entity]||[]);
  for(const [k,v] of Object.entries(item||{})){const snake=FIELD_MAP[k]||k;if(allowed.has(snake))out[snake]=v}
  for(const k of ['client_id','professional_id','service_id','product_id','command_id','appointment_id','referrer_client_id','gift_card_id','loyalty_account_id','receivable_id','user_id','created_by']){if(out[k]&&stateMap[{client_id:'clients',professional_id:'professionals',service_id:'services',product_id:'products',command_id:'commands',appointment_id:'appointments',referrer_client_id:'clients',gift_card_id:'gift_cards',loyalty_account_id:'loyalty_accounts',receivable_id:'receivables',user_id:'users',created_by:'users'}[k]]?.[out[k]])out[k]=stateMap[{client_id:'clients',professional_id:'professionals',service_id:'services',product_id:'products',command_id:'commands',appointment_id:'appointments',referrer_client_id:'clients',gift_card_id:'gift_cards',loyalty_account_id:'loyalty_accounts',receivable_id:'receivables',user_id:'users',created_by:'users'}[k]][out[k]]}
  return out;
}
async function pushGenericEntity(entity,localProp){
  const data=appData(),items=Array.isArray(data[localProp])?data[localProp]:[];stateMap[entity]=stateMap[entity]||{};
  for(const item of items){const local=String(item?.id||item?.code||item?.name||'');if(!local||stateMap[entity][local])continue;const payload=genericPayload(entity,item);if(!Object.keys(payload).length)continue;try{const r=await api(entity,'POST',payload);const inserted=rowOf(r);if(!inserted?.id)throw new Error('Servidor não confirmou ID do registro');stateMap[entity][local]=inserted.id}catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e);throw new Error('Falha ao persistir '+entity+' ('+local+'): '+window.__EDDU_NEON_LAST_ERROR)}}
  if(!write(mapKey,stateMap))throw new Error(window.__EDDU_NEON_LAST_ERROR||'Falha ao gravar mapa de sincronização');
}
async function pushGenericEntities(){
  for(const [prop,entity] of Object.entries(GENERIC_MAP))await pushGenericEntity(entity,prop);
}

async function sync(){
  if(window.__EDDU_NEON_SYNCING)return;
  window.__EDDU_NEON_SYNCING=true;
  try{
    window.__EDDU_NEON_CONNECTED=false;
    window.__EDDU_NEON_SYNC_STATUS='syncing';
    window.dispatchEvent(new CustomEvent('eddu-neon-sync-status',{detail:{status:'syncing'}}));
    await pushNewClients();
    await pushNewProfessionals();
    await pushNewServices();
    await pushNewProducts();
    await pushNewAppointments();
    await pushNewAgendaBlocks();
    await pushGenericEntities();
    await load('clients');
    await load('professionals');
    await load('services');
    await load('products');
    await load('appointments');
    await load('commands');
    await load('financial_transactions');
    await load('agenda_blocks');
    for(const entity of Object.values(GENERIC_MAP)) await load(entity);
    if(!write(KEY,{connectedAt:new Date().toISOString(),scope:['clients','professionals','services','products','appointments','commands','financial_transactions','agenda_blocks'],status:'confirmed'}))throw new Error(window.__EDDU_NEON_LAST_ERROR||'Falha ao gravar estado confirmado');
    window.__EDDU_NEON_CONNECTED=true;
    window.__EDDU_NEON_SYNC_STATUS='confirmed';
    window.__EDDU_NEON_LAST_ERROR=null;
    window.dispatchEvent(new CustomEvent('eddu-neon-sync-status',{detail:{status:'confirmed'}}));
  }catch(e){
    window.__EDDU_NEON_CONNECTED=false;
    window.__EDDU_NEON_SYNC_STATUS='error';
    window.__EDDU_NEON_LAST_ERROR=String(e?.message||e);
    write(KEY,{status:'error',error:window.__EDDU_NEON_LAST_ERROR,at:new Date().toISOString()});
    window.dispatchEvent(new CustomEvent('eddu-neon-sync-status',{detail:{status:'error',error:window.__EDDU_NEON_LAST_ERROR}}));
    if(typeof window.toast==='function')window.toast('Não foi possível confirmar a sincronização com o servidor. '+window.__EDDU_NEON_LAST_ERROR);
  }finally{window.__EDDU_NEON_SYNCING=false}
}
async function waitForSyncCompletion(){
 if(!window.__EDDU_NEON_SYNCING)return;
 await new Promise(resolve=>{
  let done=false;
  const finish=()=>{if(done)return;done=true;window.removeEventListener('eddu-neon-sync-status',finish);resolve();};
  window.addEventListener('eddu-neon-sync-status',finish);
  if(!window.__EDDU_NEON_SYNCING)finish();
 });
}
function wrapMutation(name){
 const original=window[name];if(typeof original!=='function'||window['__EDDU_SYNC_WRAPPED_'+name])return;
 window[name]=async function(){
  const result=await original.apply(this,arguments);
  if(result===false||result?.ok===false)return result;
  await sync();
  await waitForSyncCompletion();
  if((name==='saveAgendaDayBlockM'||name==='saveAgendaBlockDayM')&&window.__EDDU_NEON_SYNC_STATUS==='confirmed'){
   if(typeof window.toast==='function')window.toast('Bloqueio de agenda confirmado no Neon.');
   if(typeof window.openSheet==='function')window.openSheet('agenda');
  }
  return result;
 };
 window['__EDDU_SYNC_WRAPPED_'+name]=true;
}
wrapMutation('saveAgendaAddM');
wrapMutation('saveAgendaEditM');
wrapMutation('saveAgendaDayBlockM');
wrapMutation('saveAgendaBlockDayM');
wrapMutation('saveAgendaBlockM');
const originalPersist=window.persist;
if(typeof originalPersist==='function'&&!window.__EDDU_NEON_PERSIST_WRAPPED){
  window.persist=function(){const r=originalPersist.apply(this,arguments);setTimeout(sync,0);return r};
  window.__EDDU_NEON_PERSIST_WRAPPED=true;
}
window.EDDU_NEON_SYNC=sync;
setTimeout(sync,900);
})();