/* V30 — command editor persistence. Captures the actual Save Changes button and persists its form to Supabase. */
(function(){
 const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined')fn();else if(n<200)setTimeout(()=>wait(fn,n+1),250)};
 const num=v=>{v=String(v??'').replace(/[^0-9,.-]/g,'').replace(/\.(?=.*\.)/g,'');v=v.replace(',','.');const x=Number(v);return Number.isFinite(x)?x:0};
 const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const serviceByName=n=>{const a=window.SERVICES||[];return a.find(s=>String(s.n??s.name??'').trim().toLowerCase()===String(n||'').trim().toLowerCase())||null};
 const clientByName=n=>(db.clients||[]).find(c=>String(c.name||'').trim().toLowerCase()===String(n||'').trim().toLowerCase())||null;
 async function saveModal(modal){
  const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();if(!sb||!u)throw Error('Sessão não disponível. Faça login novamente.');
  const h=modal.querySelector('.modal-head h2')?.textContent||'';const m=h.match(/Editar comanda\s*[•·]\s*(.+)$/i);const clientName=(m?m[1]:h).trim();
  const client=clientByName(clientName);if(!client)throw Error('Cliente "'+clientName+'" não encontrado.');
  const lines=[...modal.querySelectorAll('.order-line')];const items=[];
  for(const line of lines){const sels=line.querySelectorAll('select');const ins=line.querySelectorAll('input');if(!sels.length)continue;const serviceName=sels[0]?.selectedOptions?.[0]?.textContent?.trim();const length=(sels[1]?.value||sels[1]?.selectedOptions?.[0]?.textContent||'base').toLowerCase().includes('long')?'long':'base';const s=serviceByName(serviceName)||((typeof svc==='function')?svc(sels[0].value):null);if(!s?.dbId)throw Error('Serviço "'+serviceName+'" não possui vínculo com o cadastro de serviços.');const price=ins[0]?num(ins[0].value):Number(length==='long'?s.long:s.base||0);const cost=ins[1]?num(ins[1].value):Number(s.cost||0);items.push({service_id:s.dbId,description:s.n||s.name||serviceName,quantity:1,unit_price:price,unit_cost:cost,commission_percent:30});}
  if(!items.length)throw Error('Adicione pelo menos um serviço.');
  const labels=[...modal.querySelectorAll('label')];const dl=labels.find(x=>x.textContent.toLowerCase().includes('desconto'));const discount=num(dl?.parentElement?.querySelector('input')?.value||0);
  const subtotal=items.reduce((a,i)=>a+i.unit_price*i.quantity,0),total=Math.max(0,subtotal-discount),cost=items.reduce((a,i)=>a+i.unit_cost*i.quantity,0),commission=total*.30,profit=total-cost-commission;
  const local=(db.orders||[]).find(o=>String(o.clientId)===String(client.id)||String(o.client||'').toLowerCase()===String(clientName).toLowerCase());
  const row={client_id:client.id,professional_id:null,status:local?.open===false?'closed':'open',subtotal,discount,total,total_cost:cost,commission,profit,created_by:u.id};
  let q;
  if(local?.id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(local.id)))q=await sb.from('commands').update(row).eq('id',local.id).select('id').single();
  else q=await sb.from('commands').insert({...row,opened_at:new Date().toISOString()}).select('id').single();
  if(q.error)throw q.error;const commandId=q.data.id;
  const del=await sb.from('command_items').delete().eq('command_id',commandId);if(del.error)throw del.error;
  const ins=await sb.from('command_items').insert(items.map(i=>({...i,command_id:commandId})));
  if(ins.error)throw ins.error;
  const order={id:commandId,clientId:client.id,client:client.name,items:items.map(i=>{const s=(window.SERVICES||[]).find(x=>x.dbId===i.service_id);return{serviceId:s?.id||i.service_id,length:i.unit_price===Number(s?.long)?'long':'base'}}),discount,discountReason:'',open:row.status==='open',__dbItemsSynced:true};
  const idx=(db.orders||[]).findIndex(o=>String(o.id)===String(local?.id));if(idx>=0)db.orders[idx]=order;else db.orders.push(order);if(typeof save==='function')save();
  return {commandId,total,items:items.length};
 }
 function toast2(t,ok){const x=document.createElement('div');x.textContent=t;x.style.cssText='position:fixed;right:20px;bottom:20px;z-index:1000000;background:'+(ok?'#242321':'#8b3d3d')+';color:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 15px 35px #0004;max-width:380px';document.body.appendChild(x);setTimeout(()=>x.remove(),4200)}
 function bind(){if(window.__EDDU_V30)return;document.addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b||!b.textContent.trim().toLowerCase().includes('salvar alterações'))return;const modal=b.closest('.modal');if(!modal)return;ev.preventDefault();ev.stopImmediatePropagation();if(b.dataset.v30busy)return;b.dataset.v30busy='1';const old=b.textContent;b.textContent='Salvando...';try{const r=await saveModal(modal);toast2('Comanda salva no servidor · '+brl(r.total),true);if(typeof safeRender==='function')setTimeout(()=>safeRender(),300)}catch(e){console.error('EDDU V30',e);toast2('Não foi possível salvar: '+(e.message||e),false)}finally{b.dataset.v30busy='';b.textContent=old}},true);window.__EDDU_V30=true}
 wait(bind);window.EDDU_COMMAND_PERSIST={saveModal};
})();
