/* V16.3 — data hydration/persistence layer. Keeps V13.1/V15 UI untouched. */
(function(){
  const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser()){fn()}else setTimeout(()=>wait(fn),250)};
  const isoLocal=(d,t)=>{const x=new Date((d||'1970-01-01')+'T'+(t||'00:00')+':00');return x.toISOString()};
  const svcByDb=id=>SERVICES.find(s=>s.dbId===id);
  async function ensureClient(){
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH.getUser();if(!u)return null;
    let r=await sb.from('clients').select('*').eq('user_id',u.id).maybeSingle();
    if(r.data)return r.data;
    const p=window.EDDU_AUTH.getProfile()||{};
    const ins=await sb.from('clients').insert({user_id:u.id,name:p.full_name||u.email?.split('@')[0]||'Cliente',email:u.email||null,phone:p.phone||null,loyalty_points:0,active:true}).select('*').single();
    return ins.data||null;
  }
  async function hydrate(){
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH.getUser();if(!u)return;
    const role=window.EDDU_AUTH.getProfile()?.role==='client'?'client':'staff';
    const client=role==='client'?await ensureClient():null;
    const [ar,cr,ir,fr]=await Promise.all([
      sb.from('appointments').select('*, appointment_services(*, services(name))').order('starts_at'),
      sb.from('commands').select('*, command_items(*)').order('created_at'),
      sb.from('command_payments').select('*, payment_methods(name)').order('paid_at'),
      role==='staff'?sb.from('financial_transactions').select('*').order('due_date'):Promise.resolve({data:[],error:null})
    ]);
    if(!ar.error&&Array.isArray(ar.data)) db.requests=ar.data.map(a=>{const d=new Date(a.starts_at),items=(a.appointment_services||[]).map(x=>{const s=svcByDb(x.service_id);return {serviceId:s?.id||x.service_id,length:(s&&Number(x.price)===Number(s.long))?'long':'base'}});const c=db.clients.find(x=>String(x.id)===String(a.client_id));return{id:a.id,clientId:a.client_id,client:c?.name||'Cliente',serviceId:items[0]?.serviceId,services:items,status:String(a.status||'Pendente').replace('_',' '),date:d.toISOString().slice(0,10),time:d.toTimeString().slice(0,5),prof:''}});
    if(!cr.error&&Array.isArray(cr.data)) db.orders=cr.data.map(o=>{const c=db.clients.find(x=>String(x.id)===String(o.client_id));const items=(o.command_items||[]).map(i=>{const s=svcByDb(i.service_id);return{serviceId:s?.id||i.service_id,length:(s&&Number(i.unit_price)===Number(s.long))?'long':'base'}});return{id:o.id,clientId:o.client_id,client:c?.name||'Cliente',prof:'',items,discount:Number(o.discount||0),discountReason:'',open:o.status==='open',payment:o.status==='paid'?'paid':'',paidAt:null,__dbItemsSynced:true}});
    if(!fr.error&&Array.isArray(fr.data)){
      db.payables=fr.data.filter(x=>x.type==='expense').map(x=>({id:x.id,supplier:x.description,description:x.description,value:Number(x.amount||0),dueDate:x.due_date,method:'Pix',category:'Operacional',status:x.status||'pending',note:''}));
      db.receivables=fr.data.filter(x=>x.type==='income').map(x=>({id:x.id,client:db.clients.find(c=>String(c.id)===String(x.client_id))?.name||'Cliente',description:x.description,value:Number(x.amount||0),dueDate:x.due_date,method:'Pix',category:'Serviços',status:x.status||'pending',note:''}));
    }
    db.requests=db.requests||[];db.orders=db.orders||[];save();if(typeof safeRender==='function')safeRender();
  }
  async function pushAppointment(r){
    const sb=window.__EDDU_SB,client=await ensureClient();if(!client||!r)return;
    const items=r.services?.length?r.services:[{serviceId:r.serviceId,length:'base'}];
    const mins=items.reduce((a,i)=>a+Number(svc(i.serviceId)?.time||60),0);const start=new Date((r.date||'1970-01-01')+'T'+(r.time||'00:00')+':00');const end=new Date(start.getTime()+mins*60000);
    const row={client_id:client.id,professional_id:null,starts_at:start.toISOString(),ends_at:end.toISOString(),status:'pending',notes:null,created_by:window.EDDU_AUTH.getUser().id};
    const q=await sb.from('appointments').insert(row).select('id').single();if(q.error)return;
    r.id=q.data.id;const lines=items.map(i=>{const s=svc(i.serviceId);return s?.dbId?{appointment_id:r.id,service_id:s.dbId,price:Number(i.length==='long'?s.long:s.base),duration_minutes:Number(s.time||60)}:null}).filter(Boolean);if(lines.length)await sb.from('appointment_services').insert(lines);save();
  }
  function hook(name,fn){const o=window[name];if(typeof o!=='function'||o.__v163)return;const w=function(){const r=o.apply(this,arguments);Promise.resolve(r).then(()=>fn()).catch(console.error);return r};w.__v163=true;window[name]=w}
  wait(()=>{hook('submitBooking',async()=>{const r=db.requests?.find(x=>!x.__dbSynced)||db.requests?.[0];if(r&&!r.__dbSynced){await pushAppointment(r);r.__dbSynced=true}});hydrate()});
})();