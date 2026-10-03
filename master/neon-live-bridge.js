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
const normalizeAppointment=x=>({client_id:stateMap.clients?.[x.clientId||x.client_id]||null,professional_id:stateMap.professionals?.[x.professionalId||x.professional_id]||null,starts_at:x.starts_at||x.startsAt||((x.date||'')+'T'+(x.start||'00:00')+':00'),ends_at:x.ends_at||x.endsAt||((x.date||'')+'T'+(x.end||'01:00')+':00'),status:String(x.status||'confirmed').toLowerCase().replace('confirmado','confirmed').replace('pendente','requested'),notes:x.notes||null});
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
  const data=window.data||read('eddu_data',{}),items=Array.isArray(data[localProp])?data[localProp]:[];stateMap[entity]=stateMap[entity]||{};
  for(const item of items){const local=String(item?.id||item?.code||item?.name||'');if(!local||stateMap[entity][local])continue;const payload=genericPayload(entity,item);if(!Object.keys(payload).length)continue;try{const r=await api(entity,'POST',payload);if(r.data?.id)stateMap[entity][local]=r.data.id}catch(e){window.__EDDU_NEON_LAST_ERROR=String(e.message||e)}}
  write(mapKey,stateMap);
}
async function pushGenericEntities(){
  for(const [prop,entity] of Object.entries(GENERIC_MAP))await pushGenericEntity(entity,prop);
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
    window.__EDDU_NEON_CONNECTED=true;
    write(KEY,{connectedAt:new Date().toISOString(),scope:['clients','professionals','services','products','appointments','commands','financial_transactions','agenda_blocks']});
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