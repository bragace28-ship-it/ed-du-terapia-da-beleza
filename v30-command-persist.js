/* V31 — command persistence: save server-side, then reload cleanly; do not trigger legacy render handlers. */
(function(){
 const wait=(fn,n=0)=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser?.()&&typeof db!=='undefined')fn();else if(n<240)setTimeout(()=>wait(fn,n+1),250)};
 const num=v=>{let s=String(v??'').trim().replace(/[^0-9,.-]/g,'');if(!s)return 0;if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const x=Number(s);return Number.isFinite(x)?x:0};
 const brl=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const compact=v=>norm(v).replace(/\s+/g,'');
 const aliases={'corte feminino':['corte fem'],'corte fem':['corte feminino'],'corte masculino':['corte masc'],'corte masc':['corte masculino'],'escova com textura':['escova com text'],'escova com text':['escova com textura']};
 const localService=n=>{const a=window.SERVICES||[];const target=norm(n);return a.find(s=>norm(s.n??s.name)===target)||null};
 const clientByName=n=>(db.clients||[]).find(c=>norm(c.name)===norm(n))||null;
 async function resolveService(sb,select){
   let label=select?.selectedOptions?.[0]?.textContent?.trim()||'';
   label=label.replace(/\s*[|–—-]\s*(R\$|Base|Long|Custo).*$/i,'').trim();
   const local=localService(label)||((typeof svc==='function')?svc(String(select?.value||'')):null);
   if(local?.dbId)return{dbId:local.dbId,local,name:label};
   const q=await sb.from('services').select('id,name,price_base,price_long,service_cost,duration_minutes').eq('active',true).order('name');
   if(q.error)throw new Error('Não foi possível consultar o cadastro de serviços: '+q.error.message);
   const rows=q.data||[],targets=[label,...(aliases[norm(label)]||[])];
   let hit=rows.find(s=>targets.some(t=>norm(s.name)===norm(t)));
   if(!hit){const c=compact(label);hit=rows.find(s=>{const x=compact(s.name);return x===c||x.startsWith(c)||c.startsWith(x)});}
   if(!hit){const tokens=norm(label).split(' ').filter(Boolean);hit=rows.find(s=>{const x=norm(s.name);return tokens.length>=2&&tokens.every(t=>x.includes(t)||t==='feminino'&&x.includes('fem')||t==='masculino'&&x.includes('masc'))});}
   if(hit)return{dbId:hit.id,local:local||hit,name:hit.name,db:hit};
   throw new Error('Serviço "'+label+'" não foi encontrado no cadastro de serviços.');
 }
 async function saveModal(modal){
  const sb=window.__EDDU_SB,u=window.EDDU_AUTH?.getUser?.();if(!sb||!u)throw Error('Sessão não disponível. Faça login novamente.');
  const h=modal.querySelector('.modal-head h2')?.textContent||'';const m=h.match(/Editar comanda\s*[•·]\s*(.+)$/i);const clientName=(m?m[1]:h).trim();const client=clientByName(clientName);if(!client)throw Error('Cliente "'+clientName+'" não encontrado.');
  const lines=[...modal.querySelectorAll('.order-line')];const items=[];
  for(const line of lines){const sels=line.querySelectorAll('select');const ins=line.querySelectorAll('input');if(!sels.length)continue;const resolved=await resolveService(sb,sels[0]);const local=resolved.local||{},length=norm(sels[1]?.value||sels[1]?.selectedOptions?.[0]?.textContent||'base').includes('long')?'long':'base',dbsvc=resolved.db;const defaultPrice=Number(length==='long'?(dbsvc?.price_long??local.long):(dbsvc?.price_base??local.base)??0),defaultCost=Number(dbsvc?.service_cost??local.cost??0),price=ins[0]?num(ins[0].value):defaultPrice,cost=ins[1]?num(ins[1].value):defaultCost;items.push({service_id:resolved.dbId,description:dbsvc?.name||local.n||local.name||resolved.name,quantity:1,unit_price:price,unit_cost:cost,commission_percent:30});}
  if(!items.length)throw Error('Adicione pelo menos um serviço.');
  const discountInput=[...modal.querySelectorAll('input')].find(i=>{const p=i.previousElementSibling?.textContent||i.parentElement?.querySelector('label')?.textContent||'';return norm(p).includes('desconto')});const discount=num(discountInput?.value||0);const subtotal=items.reduce((a,i)=>a+i.unit_price*i.quantity,0),total=Math.max(0,subtotal-discount),cost=items.reduce((a,i)=>a+i.unit_cost*i.quantity,0),commission=total*.30,profit=total-cost-commission;
  const localOrder=(db.orders||[]).find(o=>String(o.clientId)===String(client.id));const row={client_id:client.id,professional_id:localOrder?.professionalId||null,status:localOrder?.open===false?'closed':'open',subtotal,discount,total,total_cost:cost,commission,profit,created_by:u.id};let q;if(localOrder?.id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(localOrder.id)))q=await sb.from('commands').update(row).eq('id',localOrder.id).select('id').single();else q=await sb.from('commands').insert({...row,opened_at:new Date().toISOString()}).select('id').single();if(q.error)throw q.error;const commandId=q.data.id;
  const del=await sb.from('command_items').delete().eq('command_id',commandId);if(del.error)throw del.error;const ins=await sb.from('command_items').insert(items.map(i=>({...i,command_id:commandId,professional_id:row.professional_id})));if(ins.error)throw ins.error;
  return{commandId,total,items:items.length};
 }
 function toast2(t,ok){const x=document.createElement('div');x.textContent=t;x.style.cssText='position:fixed;right:20px;bottom:20px;z-index:1000000;background:'+(ok?'#242321':'#8b3d3d')+';color:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 15px 35px #0004;max-width:420px';document.body.appendChild(x);setTimeout(()=>x.remove(),4200)}
 function bind(){if(window.__EDDU_V31)return;document.addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b||!norm(b.textContent).includes('salvar alteracoes'))return;const modal=b.closest('.modal');if(!modal)return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();if(b.dataset.v31busy)return;b.dataset.v31busy='1';const old=b.textContent;b.textContent='Salvando...';try{const r=await saveModal(modal);toast2('Comanda salva no servidor · '+brl(r.total),true);setTimeout(()=>location.reload(),700)}catch(e){console.error('EDDU V31',e);toast2('Não foi possível salvar: '+(e.message||e),false);b.dataset.v31busy='';b.textContent=old}},true);window.__EDDU_V31=true}
 wait(bind);window.EDDU_COMMAND_PERSIST={saveModal};
})();
