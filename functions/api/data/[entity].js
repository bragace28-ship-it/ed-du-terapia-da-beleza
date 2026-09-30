import { neon } from '@neondatabase/serverless';

const TABLES={
  clients:['name','email','phone','cpf','birth_date','notes','loyalty_points','active'],
  appointments:['client_id','professional_id','starts_at','ends_at','status','notes','created_by'],
  commands:['client_id','professional_id','appointment_id','status','discount','discount_reason','subtotal','total','created_by','total_cost','commission','profit','payment_gateway','payment_card_brand','payment_installments','payment_estimated_fee','payment_estimated_net','payment_installment_amount','payment_link'],
  command_items:['command_id','item_type','service_id','product_id','description','quantity','unit_price','total','professional_id','unit_cost','commission_percent'],
  financial_transactions:['type','direction','command_id','client_id','description','amount','due_date','paid_at','status','category','metadata','created_by'],
  agenda_blocks:['professional_id','starts_at','ends_at','reason'],
  coupons:['code','type','value','service_id','active','starts_at','expires_at','usage_limit','usage_count','metadata'],
  payments:['command_id','client_id','amount','method','gateway','brand','installments','status','external_id','idempotency_key','paid_at','metadata'],
  receivables:['client_id','command_id','description','total_amount','paid_amount','due_at','status','method','metadata'],
  receivable_installments:['receivable_id','installment_no','amount','due_at','paid_at','status'],
  payables:['description','supplier','amount','due_at','paid_at','status','category','card_invoice','metadata'],
  card_invoices:['card_name','amount','due_at','category','status','metadata'],
  commissions:['professional_id','command_id','base_amount','commission_rate','commission_amount','paid_amount','status'],
  quotes:['client_id','professional_id','total_amount','status','payload'],
  referrals:['referrer_client_id','referred_name','referred_phone','gift_card_id','status','points_awarded'],
  gift_cards:['code','title','value','status','metadata'],
  notifications:['user_id','title','body','type','read_at','payload'],
  terms:['client_id','status','sent_at','signed_at','payload'],
  anamneses:['client_id','objective','analysis','private_formula','private_notes','files'],
  before_after_gallery:['client_id','title','caption','before_ref','after_ref','collage_ref'],
  open_finance_connections:['provider','status','external_account_ref','metadata'],
  loyalty_accounts:['client_id','points_balance'],
  loyalty_transactions:['loyalty_account_id','points','reason','referral_id'],
  credit_accounts:['client_id','credit_limit','balance','status'],
  credit_alerts:['client_id','type','message','status','resolved_at'],
  recurring_payments:['client_id','provider','external_id','amount','interval','status','metadata'],
  ocr_documents:['payable_id','filename','mime_type','storage_ref','extracted_data','status'],
  account_actions:['user_id','action','entity','entity_id','payload']
};
const json=(d,s=200,h={})=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store',...h}});
const previewWrite=(request,env)=>{
  const host=new URL(request.url).hostname;
  return env.EDDU_HOMOLOGATION_MODE==='1' && host.includes('.pages.dev') && host.includes('master-v46-final-homologation');
};
function cleanPayload(table,body){
  const allowed=new Set(TABLES[table]||[]);
  const out={};
  for(const k of Object.keys(body||{})) if(allowed.has(k)) out[k]=body[k];
  if(table==='clients' && !out.name) throw new Error('name is required');
  if(table==='appointments' && (!out.starts_at||!out.ends_at)) throw new Error('starts_at and ends_at are required');
  if(table==='commands' && out.total==null) out.total=0;
  if(table==='financial_transactions'){
    if(!['in','out'].includes(out.direction)) throw new Error('direction must be in or out');
    if(!out.type) throw new Error('type is required');
    if(out.amount==null) throw new Error('amount is required');
  }
  return out;
}
function buildInsert(table,row){
  const keys=Object.keys(row);
  if(!keys.length) throw new Error('empty payload');
  const cols=keys.join(',');
  const marks=keys.map((_,i)=>'$'+(i+1)).join(',');
  return {q:`insert into public.${table} (${cols}) values (${marks}) returning *`,v:keys.map(k=>row[k])};
}
function buildUpdate(table,id,row){
  const keys=Object.keys(row);
  if(!keys.length) throw new Error('empty payload');
  return {q:`update public.${table} set ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')}, updated_at=now() where id=$${keys.length+1} returning *`,v:[...keys.map(k=>row[k]),id]};
}
async function handler({request,env,params}){
  const table=params.entity;
  if(!TABLES[table]) return json({ok:false,error:'entity_not_allowed'},404);
  if(!env.NEON_DATABASE_URL) return json({ok:false,error:'NEON_DATABASE_URL not configured'},503);
  if(request.method!=='GET'&&!previewWrite(request,env)) return json({ok:false,error:'writes_require_homologation_preview'},403);
  try{
    const sql=neon(env.NEON_DATABASE_URL);
    if(request.method==='GET'){
      const url=new URL(request.url),limit=Math.min(Math.max(Number(url.searchParams.get('limit')||200),1),1000);
      const id=url.searchParams.get('id');
      let rows;
      if(id) rows=await sql.query(`select * from public.${table} where id=$1 limit 1`,[id]);
      else rows=await sql.query(`select * from public.${table} order by created_at desc nulls last limit ${limit}`,[]);
      return json({ok:true,entity:table,data:rows});
    }
    const body=await request.json();
    if(request.method==='POST'){
      const row=cleanPayload(table,body),ins=buildInsert(table,row),rows=await sql.query(ins.q,ins.v);
      return json({ok:true,entity:table,data:rows[0]},201);
    }
    if(request.method==='PATCH'){
      if(!body?.id)return json({ok:false,error:'id_required'},400);
      const row=cleanPayload(table,body),u=buildUpdate(table,body.id,row),rows=await sql.query(u.q,u.v);
      if(!rows.length)return json({ok:false,error:'not_found'},404);
      return json({ok:true,entity:table,data:rows[0]});
    }
    if(request.method==='DELETE'){
      const id=body?.id||new URL(request.url).searchParams.get('id');
      if(!id)return json({ok:false,error:'id_required'},400);
      const rows=await sql.query(`delete from public.${table} where id=$1 returning id`,[id]);
      return rows.length?json({ok:true,entity:table,id:rows[0].id}):json({ok:false,error:'not_found'},404);
    }
    return json({ok:false,error:'method_not_allowed'},405);
  }catch(error){
    return json({ok:false,error:'database_operation_failed',detail:String(error?.message||error)},500);
  }
}
export const onRequest=handler;