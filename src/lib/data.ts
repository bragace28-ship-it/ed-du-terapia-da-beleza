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
export async function getFinancial(limit=100){const table='financial_transactions';const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data??[]}

async function getCurrentStaffContext(){
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError)throw authError
  if(!user)throw new Error('Sessão expirada. Entre novamente para criar a comanda.')
  const {data:profile,error:profileError}=await supabase.from('profiles').select('id,role,active').eq('id',user.id).single()
  if(profileError)throw profileError
  if(!profile?.active||!['admin','professional'].includes(profile.role))throw new Error('Seu perfil não possui permissão para criar comandas.')
  const {data:professional,error:professionalError}=await supabase.from('professionals').select('id').eq('user_id',user.id).maybeSingle()
  if(professionalError)throw professionalError
  return {user,profile,professional}
}

export async function createCommand(input:{client_id:string;professional_id?:string|null;appointment_id?:string|null}){
  const {user,professional}=await getCurrentStaffContext()
  const payload={...input,professional_id:input.professional_id??professional?.id??null,created_by:user.id,status:'open',subtotal:0,discount:0,total:0,total_cost:0,commission:0,profit:0,payment_installments:1,payment_estimated_fee:0,payment_estimated_net:0,payment_installment_amount:0}
  const {data,error}=await supabase.from('commands').insert(payload).select().single()
  if(error)throw error
  return data
}

export async function addCommandItem(input:{command_id:string;service_id?:string|null;product_id?:string|null;professional_id?:string|null;description:string;quantity:number;unit_price:number;unit_cost?:number;commission_percent?:number}){
  const {professional}=await getCurrentStaffContext()
  const isService=!!input.service_id&&!input.product_id
  const payload={command_id:input.command_id,item_type:isService?'service':'product',service_id:isService?input.service_id:null,product_id:isService?null:input.product_id??null,professional_id:input.professional_id??professional?.id??null,description:input.description,quantity:Math.max(1,input.quantity),unit_price:Math.max(0,input.unit_price),unit_cost:Math.max(0,input.unit_cost??0),commission_percent:Math.max(0,input.commission_percent??0)}
  const {data,error}=await supabase.from('command_items').insert(payload).select().single()
  if(error)throw error
  return data
}

export async function recalculateCommand(id:string){
  const {data:items,error:itemError}=await supabase.from('command_items').select('quantity,unit_price,unit_cost,commission_percent').eq('command_id',id)
  if(itemError)throw itemError
  const subtotal=(items??[]).reduce((s:number,i:any)=>s+Number(i.quantity)*Number(i.unit_price),0)
  const cost=(items??[]).reduce((s:number,i:any)=>s+Number(i.quantity)*Number(i.unit_cost??0),0)
  const commission=(items??[]).reduce((s:number,i:any)=>s+Number(i.quantity)*Number(i.unit_price)*Number(i.commission_percent??0)/100,0)
  const {data,error}=await supabase.from('commands').update({subtotal,total:Math.max(0,subtotal),total_cost:cost,commission,profit:subtotal-cost-commission,updated_at:new Date().toISOString()}).eq('id',id).select().single()
  if(error)throw error
  return data
}

export async function closeCommandOnline(id:string,gatewayId:string,fee:number,net:number,installments:number){
  const {error:updateError}=await supabase.from('commands').update({payment_gateway:gatewayId,payment_estimated_fee:Math.max(0,fee),payment_estimated_net:Math.max(0,net),payment_installments:Math.max(1,installments),status:'payment_pending',updated_at:new Date().toISOString()}).eq('id',id)
  if(updateError)throw updateError
  return {id,status:'payment_pending'}
}

export async function markCommandPaidPdv(id:string,method:string,reference:string,amount:number){
  const {data:{user}}=await supabase.auth.getUser()
  if(!user)throw new Error('Sessão expirada.')
  const payment={command_id:id,payment_method_id:method,gateway:'PDV',gross_amount:amount,fee_amount:0,net_amount:amount,installments:1,external_transaction_id:reference,status:'paid',paid_at:new Date().toISOString(),amount,created_by:user.id,updated_at:new Date().toISOString()}
  const {data,error:paymentError}=await supabase.from('command_payments').insert(payment).select().single()
  if(paymentError)throw paymentError
  const {data:command,error}=await supabase.from('commands').update({status:'paid',closed_at:new Date().toISOString(),payment_estimated_fee:0,payment_estimated_net:amount,payment_installments:1,payment_installment_amount:amount,updated_at:new Date().toISOString()}).eq('id',id).select().single()
  if(error)throw error
  return {command,payment}
}
