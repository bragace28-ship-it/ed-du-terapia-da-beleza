import { neon } from '@neondatabase/serverless';

const TABLES = {
  clients: ['name','email','phone','cpf','birth_date','notes','loyalty_points','active'],
  professionals: ['user_id','name','email','phone','specialty','commission_rate','active'],
  services: ['category_id','name','description','price','duration_minutes','active','price_base','price_long','service_cost'],
  products: ['category_id','sku','name','description','sale_price','cost_price','stock','minimum_stock','active'],
  appointments: ['client_id','professional_id','starts_at','ends_at','status','notes','created_by'],
  commands: ['client_id','professional_id','appointment_id','status','discount','discount_reason','subtotal','total','created_by','total_cost','commission','profit','payment_gateway','payment_card_brand','payment_installments','payment_estimated_fee','payment_estimated_net','payment_installment_amount','payment_link'],
  command_items: ['command_id','item_type','service_id','product_id','description','quantity','unit_price','total','professional_id','unit_cost','commission_percent'],
  financial_transactions: ['type','direction','command_id','client_id','description','amount','due_date','paid_at','status','category','metadata','created_by'],
  agenda_blocks: ['professional_id','starts_at','ends_at','reason'],
  coupons: ['code','type','value','service_id','active','starts_at','expires_at','usage_limit','usage_count','metadata'],
  payments: ['command_id','client_id','amount','method','gateway','brand','installments','status','external_id','idempotency_key','paid_at','metadata'],
  receivables: ['client_id','command_id','description','total_amount','paid_amount','due_at','status','method','metadata'],
  receivable_installments: ['receivable_id','installment_no','amount','due_at','paid_at','status'],
  payables: ['description','supplier','amount','due_at','paid_at','status','category','card_invoice','metadata'],
  card_invoices: ['card_name','amount','due_at','category','status','metadata'],
  commissions: ['professional_id','command_id','base_amount','commission_rate','commission_amount','paid_amount','status'],
  quotes: ['client_id','professional_id','total_amount','status','payload'],
  referrals: ['referrer_client_id','referred_name','referred_phone','gift_card_id','status','points_awarded'],
  gift_cards: ['code','title','value','status','metadata'],
  notifications: ['user_id','title','message','type','read_at','metadata'],
  terms: ['client_id','status','sent_at','signed_at','payload'],
  anamneses: ['client_id','objective','analysis','private_formula','private_notes','files'],
  before_after_gallery: ['client_id','title','caption','before_ref','after_ref','collage_ref'],
  open_finance_connections: ['provider','status','external_account_ref','metadata'],
  loyalty_accounts: ['client_id','points_balance'],
  loyalty_transactions: ['loyalty_account_id','points','reason','referral_id'],
  credit_accounts: ['client_id','credit_limit','balance','status'],
  credit_alerts: ['client_id','type','message','status','resolved_at'],
  recurring_payments: ['client_id','provider','external_id','amount','interval','status','metadata'],
  ocr_documents: ['payable_id','filename','mime_type','storage_ref','extracted_data','status'],
  account_actions: ['user_id','action','entity','entity_id','payload']
};
const PERMISSIONS = {
  clients:'clients', professionals:'professionals', services:'services', products:'products',
  appointments:'agenda', agenda_blocks:'agenda', commands:'commands', command_items:'commands',
  financial_transactions:'finance', payments:'finance', receivables:'finance',
  receivable_installments:'finance', payables:'finance', card_invoices:'finance',
  commissions:'finance', coupons:'marketing', quotes:'quotes', referrals:'loyalty',
  gift_cards:'loyalty', notifications:'notifications', terms:'clients', anamneses:'clinical',
  before_after_gallery:'clinical', open_finance_connections:'finance',
  loyalty_accounts:'loyalty', loyalty_transactions:'loyalty', credit_accounts:'finance',
  credit_alerts:'finance', recurring_payments:'finance', ocr_documents:'finance',
  account_actions:'admin'
};
const READ_ONLY = new Set(['audit_logs','webhook_events']);
const MAX_LIMIT = 500;
const DEFAULT_AUTH_URL = 'https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control':'no-store, private', 'X-Content-Type-Options':'nosniff', 'Vary':'Cookie, Authorization' } });

function bearer(request) {
  const value = request.headers.get('Authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
async function validateSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const token = bearer(request);
  if (!cookie && !token) return null;
  const headers = new Headers({ Accept:'application/json' });
  if (cookie) headers.set('Cookie', cookie);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const base = String(env.NEON_AUTH_URL || DEFAULT_AUTH_URL).replace(/\/+$/, '');
    const response = await fetch(base + '/get-session', { method:'GET', headers, signal:controller.signal, redirect:'error' });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.user?.id || !payload?.session) return null;
    if (payload.session.expiresAt && new Date(payload.session.expiresAt).getTime() <= Date.now()) return null;
    return { id:String(payload.user.id), email:String(payload.user.email || '').trim().toLowerCase() };
  } finally {
    clearTimeout(timer);
  }
}
function allowed(user, table, method) {
  if (['admin','owner','super_admin','administrator'].includes(String(user.role || '').toLowerCase())) return true;
  const key = PERMISSIONS[table];
  if (!key) return false;
  const action = ({GET:'read',POST:'create',PATCH:'update',DELETE:'delete'})[method];
  const p = user.permissions;
  if (Array.isArray(p)) return p.includes('*') || p.includes(key) || p.includes(key + '.' + action) || p.includes(key + ':*');
  if (!p || typeof p !== 'object') return false;
  return p['*'] === true || p[key] === true || p[key + '.' + action] === true || p[key]?.['*'] === true || p[key]?.[action] === true;
}
async function applicationUser(sql, authUser) {
  const rows = await sql`SELECT id, auth_user_id, name, email, role, status, permissions FROM public.app_users WHERE auth_user_id = ${authUser.id} OR lower(email) = ${authUser.email} ORDER BY CASE WHEN auth_user_id = ${authUser.id} THEN 0 ELSE 1 END LIMIT 2`;
  if (rows.length !== 1) return null;
  const user = rows[0];
  if (!['active','ativo'].includes(String(user.status || '').toLowerCase())) return null;
  if (user.auth_user_id && String(user.auth_user_id) !== authUser.id) return null;
  if (!user.auth_user_id) {
    const linked = await sql`UPDATE public.app_users SET auth_user_id = ${authUser.id}, updated_at = now() WHERE id = ${user.id} AND auth_user_id IS NULL RETURNING id, auth_user_id, name, email, role, status, permissions`;
    if (linked.length !== 1) return null;
    return linked[0];
  }
  return user;
}
function cleanPayload(table, body) {
  const allowedFields = new Set(TABLES[table] || []);
  const row = {};
  for (const [key, value] of Object.entries(body || {})) if (allowedFields.has(key)) row[key] = value;
  if (table === 'notifications') {
    if (row.message == null && body?.body != null) row.message = body.body;
    if (row.metadata == null && body?.payload != null) row.metadata = body.payload;
  }
  const required = { clients:['name'], professionals:['name'], services:['name'], products:['name'], appointments:['starts_at','ends_at'], financial_transactions:['type','direction','amount','description'] };
  for (const field of required[table] || []) if (row[field] == null || row[field] === '') throw new Error(field + '_required');
  if (table === 'financial_transactions' && !['in','out'].includes(row.direction)) throw new Error('INVALID_TRANSACTION_DIRECTION');
  if (table === 'appointments') {
    const start = new Date(row.starts_at).getTime(), end = new Date(row.ends_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('INVALID_APPOINTMENT_PERIOD');
  }
  if (['payments','payables'].includes(table) && row.amount != null && (!Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)) throw new Error('INVALID_AMOUNT');
  if (table === 'commands' && row.total == null) row.total = 0;
  return row;
}
function checkOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function handler({ request, env, params }) {
  const table = params.entity;
  const method = request.method.toUpperCase();
  if (!TABLES[table]) return json({ ok:false, error:'ENTITY_NOT_ALLOWED' }, 404);
  if (!['GET','POST','PATCH','DELETE'].includes(method)) return json({ ok:false, error:'METHOD_NOT_ALLOWED' }, 405);
  if (!env.NEON_DATABASE_URL) return json({ ok:false, error:'DATABASE_NOT_CONFIGURED' }, 503);
  if (method !== 'GET' && !checkOrigin(request)) return json({ ok:false, error:'INVALID_ORIGIN' }, 403);
  if (method !== 'GET' && READ_ONLY.has(table)) return json({ ok:false, error:'READ_ONLY_ENTITY' }, 403);
  try {
    const authUser = await validateSession(request, env);
    if (!authUser) return json({ ok:false, error:'UNAUTHORIZED' }, 401);
    const sql = neon(env.NEON_DATABASE_URL);
    const user = await applicationUser(sql, authUser);
    if (!user) return json({ ok:false, error:'APPLICATION_USER_NOT_ACTIVE' }, 403);
    if (!allowed(user, table, method)) return json({ ok:false, error:'FORBIDDEN' }, 403);

    if (method === 'GET') {
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), MAX_LIMIT);
      const hasCreatedAt = await sql`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} AND column_name='created_at' LIMIT 1`;
      const order = hasCreatedAt.length ? 'created_at DESC NULLS LAST' : 'id';
      const rows = id
        ? await sql.query(`SELECT * FROM public.${table} WHERE id = $1 LIMIT 1`, [id])
        : await sql.query(`SELECT * FROM public.${table} ORDER BY ${order} LIMIT ${limit}`, []);
      return json({ ok:true, entity:table, data:rows });
    }
    let body = {};
    if (method !== 'DELETE') {
      try { body = await request.json(); } catch { return json({ ok:false, error:'INVALID_BODY' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok:false, error:'INVALID_BODY' }, 400);
    } else {
      try { body = await request.json(); } catch { body = {}; }
    }
    if (method === 'POST') {
      const row = cleanPayload(table, body);
      const keys = Object.keys(row);
      if (!keys.length) return json({ ok:false, error:'EMPTY_PAYLOAD' }, 400);
      const columns = keys.join(', ');
      const marks = keys.map((_, index) => '$' + (index + 1)).join(', ');
      const rows = await sql.query(`INSERT INTO public.${table} (${columns}) VALUES (${marks}) RETURNING *`, keys.map(key => row[key]));
      return json({ ok:true, entity:table, data:rows[0] }, 201);
    }
    if (method === 'PATCH') {
      if (!body.id) return json({ ok:false, error:'ID_REQUIRED' }, 400);
      const row = cleanPayload(table, body);
      const keys = Object.keys(row);
      if (!keys.length) return json({ ok:false, error:'EMPTY_PAYLOAD' }, 400);
      const hasUpdatedAt = await sql`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} AND column_name='updated_at' LIMIT 1`;
      const assignments = keys.map((key, index) => key + ' = $' + (index + 1));
      if (hasUpdatedAt.length) assignments.push('updated_at = now()');
      const rows = await sql.query(`UPDATE public.${table} SET ${assignments.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`, [...keys.map(key => row[key]), body.id]);
      return rows.length ? json({ ok:true, entity:table, data:rows[0] }) : json({ ok:false, error:'NOT_FOUND' }, 404);
    }
    const id = body?.id || new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok:false, error:'ID_REQUIRED' }, 400);
    const rows = await sql.query(`DELETE FROM public.${table} WHERE id = $1 RETURNING id`, [id]);
    return rows.length ? json({ ok:true, entity:table, id:rows[0].id }) : json({ ok:false, error:'NOT_FOUND' }, 404);
  } catch (error) {
    if (error?.name === 'AbortError') return json({ ok:false, error:'AUTH_TIMEOUT' }, 504);
    const message = String(error?.message || '');
    if (message.endsWith('_required') || ['EMPTY_PAYLOAD','INVALID_TRANSACTION_DIRECTION','INVALID_APPOINTMENT_PERIOD','INVALID_AMOUNT'].includes(message)) return json({ ok:false, error:message }, 400);
    console.error('EDDU_DATA_API_ERROR', { entity:table, method, error:message });
    return json({ ok:false, error:'DATABASE_OPERATION_FAILED' }, 500);
  }
}
export const onRequest = handler;