/* V29 — persistent command save/edit bridge. Writes commands + command_items to Supabase. */
(function(){
  const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined')fn();else if(n<160)setTimeout(()=>wait(fn,n+1),250)};
  async function persist(order){
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();
    if(!sb||!u||!order)throw new Error('Sessão não disponível');
    const client=db.clients?.find(c=>String(c.id)===String(order.clientId));
    if(!client)throw new Error('Cliente da comanda não encontrado');
    const p=await sb.from('professionals').select('id').eq('user_id',u.id).maybeSingle();
    const prof=p.data?.id||null;
    const calc=typeof orderCalc==='function'?orderCalc(order):{sub:0,discount:0,net:0,cost:0,commission:0,profit:0};
    const row={client_id:client.id,appointment_id:null,professional_id:prof,status:order.open?'open':'closed',subtotal:Number(calc.sub||0),discount:Number(calc.discount||0),total:Number(calc.net||0),total_cost:Number(calc.cost||0),commission:Number(calc.commission||0),profit:Number(calc.profit||0),opened_at:order.openedAt?new Date(order.openedAt).toISOString():new Date().toISOString(),closed_at:order.open?null:new Date().toISOString(),created_by:u.id};
    let q;
    if(order.id&&String(order.id).includes('-')) q=await sb.from('commands').update(row).eq('id',order.id).select('id').single();
    else q=await sb.from('commands').insert(row).select('id').single();
    if(q.error)throw q.error;
    order.id=q.data.id;
    const del=await sb.from('command_items').delete().eq('command_id',order.id);if(del.error)throw del.error;
    const lines=(order.items||[]).map(i=>{const s=svc(i.serviceId)||{};return{command_id:order.id,service_id:s.dbId||null,professional_id:prof,description:s.n||'',quantity:1,unit_price:Number(i.length==='long'?s.long:s.base||0),unit_cost:Number(s.cost||0),commission_percent:30}}).filter(x=>x.service_id);
    if(lines.length){const ins=await sb.from('command_items').insert(lines);if(ins.error)throw ins.error;}
    order.__dbItemsSynced=true;return order;
  }
  function wrap(){
    const original=window.applyOrderChanges;
    if(typeof original!=='function'||original.__v29)return;
    const w=function(id){
      const order=db.orders?.find(x=>String(x.id)===String(id));
      const result=original.apply(this,arguments);
      Promise.resolve().then(async()=>{if(order){await persist(order);window.dispatchEvent(new Event('eddu:refresh-data'));}}).catch(e=>{console.error('EDDU V29 command save',e);toast?.('Erro ao salvar a comanda no servidor: '+(e.message||'erro'));});
      return result;
    };
    w.__v29=true;window.applyOrderChanges=w;
  }
  wait(()=>{wrap();setInterval(wrap,500)});
  window.EDDU_COMMAND_SAVE={persist};
})();
