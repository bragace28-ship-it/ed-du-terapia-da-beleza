import { supabase } from './supabaseClient'
export type Role='admin'|'professional'|'client'
export type Profile={id:string;full_name:string|null;phone:string|null;role:Role;active:boolean;avatar_url:string|null}
export async function getProfile(id:string){const {data,error}=await supabase.from('profiles').select('*').eq('id',id).maybeSingle();if(error)throw error;return data as Profile|null}
export async function getClientByUser(id:string){const {data,error}=await supabase.from('clients').select('*').eq('user_id',id).maybeSingle();if(error)throw error;return data}
export async function getProfessionalByUser(id:string){const {data,error}=await supabase.from('professionals').select('*').eq('user_id',id).maybeSingle();if(error)throw error;return data}
export async function getServices(){const {data,error}=await supabase.from('services').select('*').eq('active',true).order('name');if(error)throw error;return data??[]}
export async function getProducts(){const {data,error}=await supabase.from('products').select('*').eq('active',true).order('name');if(error)throw error;return data??[]}
export async function getClients(){const {data,error}=await supabase.from('clients').select('*').eq('active',true).order('name');if(error)throw error;return data??[]}
export async function getAppointments(limit=100){const {data,error}=await supabase.from('appointments').select('*, clients(name,email), professionals(name), appointment_services(price,duration_minutes,services(name))').order('starts_at').limit(limit);if(error)throw error;return data??[]}
export async function getCommands(limit=100){const {data,error}=await supabase.from('commands').select('*, clients(name), professionals(name), command_items(*)').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data??[]}
export async function getFinancial(limit=100){const {data,error}=await supabase.from('financial_transactions').select('*').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data??[]}

async function getCurrentStaffContext(){
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError)throw authError
  if(!user)throw new Error('Sessão expirada. Entre novamente para criar a comanda.')
  const {data:profile,error:profileError}=await supabase.from('profiles').select('id,organization_id,role,active').eq('id',user.id).single()
  if(profileError)throw profileError
  if(!profile?.active||!['admin','professional'].includes(profile.role))throw new Error('Seu perfil não possui permissão para criar comandas.')
  if(!profile.organization_id)throw new Error('Sua sessão não possui uma organização ativa.')
  return {user,profile}
}

export async function createCommand(input:{client_id:string;professional_id?:string|null;appointment_id?:string|null}){
  const {user,profile}=await getCurrentStaffContext()
  const payload={...input,organization_id:profile.organization_id,created_by:user.id,status:'new',subtotal:0,discount:0,total:0}
  console.error('[commands] create payload', {client_id:payload.client_id,professional_id:payload.professional_id??null,appointment_id:payload.appointment_id??null,organization_id:payload.organization_id,created_by:payload.created_by})
  const {data,error}=await supabase.from('commands').insert(payload).select().single()
  if(error){console.error('[commands] create failed',error);throw error}
  return data
}

export async function addCommandItem(input:{command_id:string;service_id?:string|null;product_id?:string|null;professional_id?:string|null;description:string;quantity:number;unit_price:number;unit_cost?:number;commission_percent?:number}){
  const {profile}=await getCurrentStaffContext()
  const payload={...input,organization_id:profile.organization_id}
  const {data,error}=await supabase.from('command_items').insert(payload).select().single()
  if(error){console.error('[command_items] insert failed',error);throw error}
  return data
}
export async function recalculateCommand(id:string){const {data:items,error:itemError}=await supabase.from('command_items').select('quantity,unit_price,unit_cost,commission_percent').eq('command_id',id);if(itemError)throw itemError;const subtotal=(items??[]).reduce((s,i)=>s+Number(i.quantity)*Number(i.unit_price),0);const cost=(items??[]).reduce((s,i)=>s+Number(i.quantity)*Number(i.unit_cost??0),0);const commission=(items??[]).reduce((s,i)=>s+Number(i.quantity)*Number(i.unit_price)*Number(i.commission_percent??0)/100,0);const {data,error}=await supabase.from('commands').update({subtotal,total:Math.max(0,subtotal),total_cost:cost,commission,profit:subtotal-cost-commission}).eq('id',id).select().single();if(error)throw error;return data}
export async function closeCommandOnline(id:string,gatewayId:string,fee:number,net:number,installments:number){const {error:updateError}=await supabase.from('commands').update({payment_gateway:gatewayId,payment_estimated_fee:fee,payment_estimated_net:net,payment_installments:installments}).eq('id',id);if(updateError)throw updateError;const {data,error}=await supabase.rpc('transition_command_state',{p_command_id:id,p_next:'pending_payment'});if(error)throw error;return data}
export async function markCommandPaidPdv(id:string,method:string,reference:string,amount:number){const {data:payment,error:paymentError}=await supabase.from('command_payments').insert({command_id:id,payment_method_id:method,amount,transaction_reference:reference}).select().single();if(paymentError)throw paymentError;const {data,error}=await supabase.rpc('transition_command_state',{p_command_id:id,p_next:'paid'});if(error)throw error;return {command:data,payment}}
