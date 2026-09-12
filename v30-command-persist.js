/* V30.2 — command editor persistence. Resolves UI service labels against the real Supabase service catalog. */
(function(){
 const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined')fn();else if(n<240)setTimeout(()=>wait(fn,n+1),250)};
 const num=v=>{let s=String(v??'').trim().replace(/[^0-9,.-]/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const x=Number(s);return Number.isFinite(x)?x:0};
 const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ');
 const localService=n=>{const a=window.SERVICES||[];return a.find(s=>norm(s.n??s.name)===norm(n))||null};
 const clientByName=n=>(db.clients||[]).find(c=>norm(c.name)===norm(n))||null;
 async function resolveService(sb,select){
   const name=select?.selectedOptions?.[0]?.textContent?.trim()||''; const value=String(select?.value||'');
   const local=localService(name)||((typeof svc==='function')?svc(value):null);
   if(local?.dbId)return {dbId:local.dbId,local,name};
   const aliases={
     'corte feminino':'corte fem',
     'corte fem':'corte feminino',
     'corte masculino':'corte masc',
     'corte masc':'corte masculino',
     'escova com textura':'escova com text',
     'escova com text':'escova com textura'
   };
   const names=[name,aliases[norm(name)]].filter(Boolean);
   for(const candidate of names){
     const q=await sb.from('services').select('id,name,price_base,price_long,service_cost,duration_minutes').eq('active',true).ilike('name',candidate).limit(1).maybeSingle();
     if(q.data)return {dbId:q.data.id,local:local||q.data,name:q.data.name,db:q.data};
   }
   const q=await sb.from('services').select('id,name,price_base,price_long,service_cost,duration_minutes').eq('active',true).order('name');
   if(!q.error){const target=norm(name);const hit=(q.data||[]).find(s=>norm(s.name)===target||norm(s.name).replace(/\s+/g,'')===target.replace(/\s+/g,''));if(hit)return {dbId:hit.id,local:local||hit,name:hit.name,db:hit};}
   throw new Error('Serviço "'+name+'" não foi encontrado no cadastro de serviços.');
 }
 async function saveModal(modal){
  const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();if(!sb||!u)throw Error('Sessão não disponível. Faça login novamente.');
  const h=modal.querySelector('.modal-head h2')?.textContent||'';const m=h.match(/Editar comanda\s*[•·]\s*(.+)$/i);const clientName=(m?m[1]:h).trim();const client=clientByName(clientName);if(!client)throw Error('Cliente "'+clientName+'" não encontrado.');
  const lines=[...modal.querySelectorAll('.order-line')];const items=[];
  for(const line of lines){const sels=line.querySelectorAll('select');const ins=line.querySelectorAll('input');if(!sels.length)continue;const resolved=await resolveService(sb,sels[0]);const local=resolved.local||{},length=(sels[1]?.value||sels[1]?.selectedOptions?.[0]?.textContent||'base').toLowerCase().includes('long')?'long':'base';const dbsvc=resolved.db;const defaultPrice=Number(length==='long'?(dbsvc?.price_long??local.long):(dbsvc?.price_base??local.base)??0);const defaultCost=Number(dbsvc?.service_cost??local.cost??0);const price=ins[0]?num(ins[0].value):defaultPrice;const cost=ins[1]?num(ins[1].value):defaultCost;items.push({service_id:resolved.dbId,description:dbsvc?.name||local.n||local.name||resolved.name,quantity:1,unit_price:price,unit_cost:cost,commission_percent:30});}
  if(!items.length)throw Error('Adicione pelo menos um serviço.');
  const labels=[...modal.querySelectorAll('label')];const dl=labels.find(x=>norm(x.textContent).includes('desconto'));const discount=num(dl?.parentElement?.querySelector('input')?.value||0);const subtotal=items.reduce((a,i)=>a+i.unit_price*i.quantity,0);const total=Math.max(0,subtotal-discount);const cost=items.reduce((a,i)=>a+i.unit_cost*i.quantity,0);const commission=total*.30;const profit=total-cost-commission;
  const localOrder=(db.orders||[]).find(o=>String(o.clientId)===String(client.id));const row={client_id:client.id,professional_id:localOrder?.professionalId||null,status:localOrder?.open===false?'closed':'open',subtotal,discount,total,total_cost:cost,commission,profit,created_by:u.id};let q;if(localOrder?.id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(localOrder.id)))q=await sb.from('commands').update(row).eq('id',localOrder.id).select('id').single();else q=await sb.from('commands').insert({...row,opened_at:new Date().toISOString()}).select('id').single();if(q.error)throw q.error;const commandId=q.data.id;
  const del=await sb.from('command_items').delete().eq('command_id',commandId);if(del.error)throw del.error;const ins=await sb.from('command_items').insert(items.map(i=>({...i,command_id:commandId,professional_id:row.professional_id})));if(ins.error)throw ins.error;
  const order={id:commandId,clientId:client.id,client:client.name,professionalId:row.professional_id,items:items.map(i=>{const s=(window.SERVICES||[]).find(x=>String(x.dbId)===String(i.service_id));return{serviceId:s?.id||i.service_id,dbServiceId:i.service_id,length:i.unit_price===Number(s?.long)?'long':'base',unitPrice:i.unit_price,unitCost:i.unit_cost}}),discount,discountReason:'',open:row.status==='open',__dbItemsSynced:true,subtotal,total,cost,commission,profit};const idx=(db.orders||[]).findIndex(o=>String(o.id)===String(localOrder?.id));if(idx>=0)db.orders[idx]=order;else db.orders.push(order);if(typeof save==='function')save();window.dispatchEvent(new Event('eddu:refresh-data'));return{commandId,total,items:items.length};
 }
 function toast2(t,ok){const x=document.createElement('div');x.textContent=t;x.style.cssText='position:fixed;right:20px;bottom:20px;z-index:1000000;background:'+(ok?'#242321':'#8b3d3d')+';color:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 15px 35px #0004;max-width:420px';document.body.appendChild(x);setTimeout(()=>x.remove(),4200)}
 function bind(){if(window.__EDDU_V30)return;document.addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b||!norm(b.textContent).includes('salvar alteracoes'))return;const modal=b.closest('.modal');if(!modal)return;ev.preventDefault();ev.stopImmediatePropagation();if(b.dataset.v30busy)return;b.dataset.v30busy='1';const old=b.textContent;b.textContent='Salvando...';try{const r=await saveModal(modal);toast2('Comanda salva no servidor · '+brl(r.total),true);if(typeof safeRender==='function')setTimeout(()=>safeRender(),500)}catch(e){console.error('EDDU V30.2',e);toast2('Não foi possível salvar: '+(e.message||e),false)}finally{b.dataset.v30busy='';b.textContent=old}},true);window.__EDDU_V30=true}
 wait(bind);window.EDDU_COMMAND_PERSIST={saveModal};
})();
