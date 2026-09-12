/* V40 — authoritative command data sync without automatic screen re-render. */
(function(){
 const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined'&&typeof SERVICES!=='undefined')fn();else if(n<240)setTimeout(()=>wait(fn,n+1),250)};
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 let lastSignature='';let syncing=false;
 function signature(cmd,ci,cp,pm){
  const a=(cmd.data||[]).map(x=>[x.id,x.status,x.total,x.updated_at,x.closed_at]).join('|');
  const b=(ci.data||[]).map(x=>[x.id,x.command_id,x.service_id,x.quantity,x.unit_price]).join('|');
  const c=(cp.data||[]).map(x=>[x.id,x.command_id,x.amount,x.paid_at,x.payment_method_id]).join('|');
  const d=(pm.data||[]).map(x=>[x.id,x.name]).join('|');return a+'#'+b+'#'+c+'#'+d;
 }
 async function sync(){
  if(syncing)return;const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();if(!sb||!u)return;syncing=true;
  try{
   const [cl,sv,cmd,ci,cp,pm,pr]=await Promise.all([
    sb.from('clients').select('*').order('name'),sb.from('services').select('id,name,price_base,price_long,service_cost,duration_minutes').eq('active',true).order('name'),sb.from('commands').select('*').order('created_at',{ascending:false}),sb.from('command_items').select('*'),sb.from('command_payments').select('*').order('paid_at',{ascending:false}),sb.from('payment_methods').select('id,name').eq('active',true),sb.from('professionals').select('id,name,phone,email,specialty,commission_percent').eq('active',true).in('name',['ED','DU'])
   ]);
   if(cmd.error)throw cmd.error;const sig=signature(cmd,ci,cp,pm);const clients=(cl.data||[]).map(c=>({id:c.id,user_id:c.user_id,name:c.name||'',phone:c.phone||'',email:c.email||'',points:Number(c.loyalty_points||0),term:false,anam:c.notes||'',history:[],anams:[]}));
   const local=window.SERVICES||[],serviceMap=new Map();
   (sv.data||[]).forEach(x=>{let s=local.find(a=>String(a.dbId||'')===String(x.id))||local.find(a=>norm(a.n||a.name)===norm(x.name));if(!s){const id='dbsvc_'+x.id;s=local.find(a=>String(a.id)===id);if(!s){s={id,dbId:x.id,n:x.name,name:x.name,base:Number(x.price_base||0),long:Number(x.price_long??x.price_base??0),cost:Number(x.service_cost||0),time:Number(x.duration_minutes||60)};local.push(s)}}s.dbId=x.id;s.base=Number(x.price_base??s.base??0);s.long=Number(x.price_long??s.long??s.base??0);s.cost=Number(x.service_cost??s.cost??0);s.time=Number(x.duration_minutes??s.time??60);serviceMap.set(String(x.id),s)});
   db.clients=clients;window.__EDDU_PROS=pr.error?[]:(pr.data||[]);window.PROFESSIONALS=window.__EDDU_PROS.map(p=>({id:p.id,name:p.name,phone:p.phone||'',email:p.email||'',specialty:p.specialty||'Terapia da Beleza',commission_percent:Number(p.commission_percent||0),active:true}));
   db.orders=(cmd.data||[]).map(o=>{const lines=(ci.data||[]).filter(x=>String(x.command_id)===String(o.id));const paid=(cp.data||[]).filter(x=>String(x.command_id)===String(o.id));const items=lines.map(x=>{const s=serviceMap.get(String(x.service_id));return{serviceId:s?.id||('dbsvc_'+x.service_id),dbServiceId:x.service_id,length:Number(x.unit_price||0)===Number(s?.long||0)&&Number(s?.long||0)>0?'long':'base',qty:Number(x.quantity||1),unitPrice:Number(x.unit_price||0),unitCost:Number(x.unit_cost||0),description:x.description||s?.n||'Serviço'}});return{id:o.id,clientId:o.client_id,client:clients.find(c=>String(c.id)===String(o.client_id))?.name||'Cliente',professionalId:o.professional_id,prof:window.__EDDU_PROS.find(p=>String(p.id)===String(o.professional_id))?.name||'',status:o.status,open:o.status==='open',openedAt:o.opened_at,closedAt:o.closed_at,discount:Number(o.discount||0),payment:paid.length?'paid':'pending',paymentMethod:paid[0]?((pm.data||[]).find(m=>String(m.id)===String(paid[0].payment_method_id))?.name||''):'',items,subtotal:Number(o.subtotal||0),total:Number(o.total||0),cost:Number(o.total_cost||0),commission:Number(o.commission||0),profit:Number(o.profit||0),__real:true,__dbItemsSynced:true}}).filter(o=>o.items.length>0);
   db.requests=db.requests||[];app.__edduRealData=true;if(pm.data?.length&&db.settings)db.settings.paymentMethods=pm.data.map(x=>x.name);lastSignature=sig;window.__EDDU_COMMAND_DATA_READY=true;
  }catch(e){console.error('EDDU V40 command sync',e)}finally{syncing=false}
 }
 wait(()=>{window.EDDU_COMMAND_LIST_SYNC={sync};sync()});
})();
