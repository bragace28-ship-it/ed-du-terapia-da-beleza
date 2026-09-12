/* V22 — operational reconciliation: appointment/professional/command/payment consistency. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined')fn();else if(n<120)setTimeout(()=>wait(fn,n+1),250)};
  const pros=()=>window.__EDDU_PROS||[];
  const profByName=name=>pros().find(p=>String(p.name).toLowerCase()===String(name||'').toLowerCase())||null;
  const localParts=iso=>{const d=new Date(iso);const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);const x={};f.forEach(p=>x[p.type]=p.value);return {date:`${x.year}-${x.month}-${x.day}`,time:`${x.hour}:${x.minute}`}};
  async function reconcile(){
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();if(!sb||!u)return;
    try{
      const c=(db.clients||[]).find(x=>String(x.user_id)===String(u.id));
      if(!c)return;
      const [ar,cr]=await Promise.all([
        sb.from('appointments').select('id,client_id,professional_id,starts_at,ends_at,status').eq('client_id',c.id).order('starts_at',{ascending:false}),
        sb.from('commands').select('id,client_id,appointment_id,professional_id,status,total,closed_at').eq('client_id',c.id).order('created_at',{ascending:false})
      ]);
      if(ar.error)throw ar.error;
      for(const a of (ar.data||[])){
        const local=(db.requests||[]).find(r=>String(r.id)===String(a.id));
        const expected=local?.prof?profByName(local.prof):null;
        if(!a.professional_id&&expected){await sb.from('appointments').update({professional_id:expected.id}).eq('id',a.id);a.professional_id=expected.id}
      }
      for(const o of (cr.data||[])){
        const local=(db.orders||[]).find(x=>String(x.id)===String(o.id));
        const expected=local?.prof?profByName(local.prof):null;
        if(!o.professional_id&&expected){await sb.from('commands').update({professional_id:expected.id}).eq('id',o.id);o.professional_id=expected.id}
      }
      window.dispatchEvent(new Event('eddu:refresh-data'));
    }catch(e){console.warn('EDDU operational reconciliation',e)}
  }
  function wrap(name){
    const original=window[name];
    if(typeof original!=='function'||original.__v22)return;
    const w=function(){const r=original.apply(this,arguments);Promise.resolve(r).finally(()=>setTimeout(reconcile,900));return r};
    w.__v22=true;window[name]=w;
  }
  wait(()=>{reconcile();['submitBooking','startReq','startFromAgenda','closeOrder','confirmOrderPayment'].forEach(wrap);setInterval(reconcile,30000)});
  window.EDDU_OPERATIONAL_SYNC={reconcile};
})();
