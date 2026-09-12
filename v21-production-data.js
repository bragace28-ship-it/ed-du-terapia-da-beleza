/* V21 — real shared data hydration: Supabase is the source of truth. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined'&&typeof SERVICES!=='undefined')fn();else if(n<120)setTimeout(()=>wait(fn,n+1),250)};
  const statusMap={requested:'Pendente',confirmed:'Aprovado',rescheduled:'Reagendado',in_progress:'Em atendimento',completed:'Concluído',cancelled:'Cancelado',no_show:'No show'};
  const localServiceByDbId=id=>SERVICES.find(s=>String(s.dbId)===String(id));
  const profName=id=>window.__EDDU_PROS?.find(p=>String(p.id)===String(id))?.name||'';
  async function hydrate(){
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH.getUser(); if(!sb||!u)return;
    try{
      const [cl,ps,ap,ai,cmd,ci,cp,pm]=await Promise.all([
        sb.from('clients').select('*').order('name'),
        sb.from('professionals').select('*').eq('active',true).in('name',['ED','DU']).order('name'),
        sb.from('appointments').select('*').order('starts_at'),
        sb.from('appointment_services').select('*'),
        sb.from('commands').select('*').order('created_at',{ascending:false}),
        sb.from('command_items').select('*'),
        sb.from('command_payments').select('*').order('paid_at',{ascending:false}),
        sb.from('payment_methods').select('id,name').eq('active',true).order('name')
      ]);
      if(cl.error)throw cl.error;
      db.clients=(cl.data||[]).map(c=>({id:c.id,user_id:c.user_id,name:c.name||'',phone:c.phone||'',email:c.email||'',points:Number(c.loyalty_points||0),term:false,anam:c.notes||'',history:[],anams:[]}));
      window.__EDDU_PROS=ps.error?[]:(ps.data||[]);
      window.PROFESSIONALS=window.__EDDU_PROS.map(p=>({id:p.id,name:p.name,phone:p.phone||'',email:p.email||'',specialty:p.specialty||'Terapia da Beleza',commission_percent:Number(p.commission_percent||0),active:p.active!==false}));
      db.requests=(ap.data||[]).map(a=>{const c=db.clients.find(x=>String(x.id)===String(a.client_id));const lines=(ai.data||[]).filter(x=>String(x.appointment_id)===String(a.id));return {id:a.id,clientId:a.client_id,client:c?.name||'',prof:profName(a.professional_id),professionalId:a.professional_id,date:a.starts_at?new Date(a.starts_at).toISOString().slice(0,10):'',time:a.starts_at?new Date(a.starts_at).toISOString().slice(11,16):'',status:statusMap[a.status]||a.status||'Pendente',serviceId:localServiceByDbId(lines[0]?.service_id)?.id,service:localServiceByDbId(lines[0]?.service_id)?.n||'',services:lines.map(x=>{const s=localServiceByDbId(x.service_id);return {serviceId:s?.id,dbServiceId:x.service_id,name:s?.n||'',length:'base',price:Number(x.price||0)}})};});
      db.orders=(cmd.data||[]).map(o=>{const lines=(ci.data||[]).filter(x=>String(x.command_id)===String(o.id));const paid=(cp.data||[]).filter(x=>String(x.command_id)===String(o.id));return {id:o.id,clientId:o.client_id,client:db.clients.find(c=>String(c.id)===String(o.client_id))?.name||'',professionalId:o.professional_id,prof:profName(o.professional_id),status:o.status,open:o.status==='open',openedAt:o.opened_at,closedAt:o.closed_at,discount:Number(o.discount||0),payment:paid.length?'paid':(o.status==='open'?'pending':'pending'),paymentMethod:'',items:lines.map(x=>{const s=localServiceByDbId(x.service_id);return {serviceId:s?.id,dbServiceId:x.service_id,length:'base',qty:Number(x.quantity||1),unitPrice:Number(x.unit_price||0),unitCost:Number(x.unit_cost||0),description:x.description||s?.n||''}}),subtotal:Number(o.subtotal||0),total:Number(o.total||0),cost:Number(o.total_cost||0),commission:Number(o.commission||0),profit:Number(o.profit||0),__real:true};});
      if(pm.data?.length)db.settings.paymentMethods=pm.data.map(x=>x.name);
      app.selectedClient=db.clients.find(c=>String(c.user_id)===String(u.id))?.id||null;
      app.__edduRealData=true;
      if(typeof save==='function'&&app.role==='client')save();
      if(typeof safeRender==='function')safeRender();
    }catch(e){console.warn('EDDU real data hydration',e)}
  }
  wait(()=>{let running=false;const run=async()=>{if(running)return;running=true;await hydrate();running=false};run();window.addEventListener('eddu:refresh-data',run);setInterval(run,30000)});
})();
