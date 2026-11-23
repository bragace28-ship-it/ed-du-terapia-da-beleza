/* ED & DU — appointment lifecycle controls linked to Neon and command workflow. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),rows=k=>Array.isArray(window.data?.[k])?window.data[k]:[];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const toast=m=>window.toast?.(m)||console.warn('[EDDU agenda]',m);
 const api=()=>window.EDDU_NEON_API;
 const localDate=v=>{const d=new Date(v);if(!Number.isFinite(d.getTime()))return '';return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
 const localTime=v=>{const d=new Date(v);if(!Number.isFinite(d.getTime()))return '';return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
 const refresh=async()=>{try{await window.EDDU_NEON_SYNC?.();}catch(e){console.error('[EDDU] agenda refresh failed',e);}if(typeof window.render==='function')window.render('agenda');};
 const getAppointment=id=>rows('appointments').find(a=>a.id===id);
 function findCardAppointment(card,used){
  const text=String(card.innerText||card.textContent||'').replace(/\s+/g,' ').trim(),time=(text.match(/\b\d{1,2}:\d{2}\b/)||[])[0];
  const day=window.__EDDU_SELECTED_DAY||window.selectedDayM||localDate(new Date());
  const candidates=rows('appointments').filter(a=>localDate(a.starts_at)===day&&!used.has(a.id));
  const client=candidates.find(a=>{const name=rows('clients').find(x=>x.id===a.client_id)?.name;return name&&text.toLocaleLowerCase('pt-BR').includes(name.toLocaleLowerCase('pt-BR'))&&(!time||localTime(a.starts_at)===time);});
  if(client)return client;
  const service=candidates.find(a=>{const link=rows('appointmentServices').find(x=>x.appointment_id===a.id),name=rows('services').find(x=>x.id===link?.service_id)?.name;return name&&text.toLocaleLowerCase('pt-BR').includes(name.toLocaleLowerCase('pt-BR'))&&(!time||localTime(a.starts_at)===time);});
  return service||null;
 }
 function enhanceCards(){
  const root=$('view');if(!root)return;
  const used=new Set();
  root.querySelectorAll('button,a,[role="button"]').forEach(button=>{
   if(!/editar agendamento/i.test(button.textContent||''))return;
   const card=button.closest('.option,.card,article,[class*="appointment"],[class*="booking"]')||button.parentElement;if(!card||card.querySelector('.eddu-agenda-lifecycle'))return;
   const apt=findCardAppointment(card,used);if(!apt)return;used.add(apt.id);
   const status=String(apt.status||'confirmed').toLowerCase(),terminal=['cancelled','completed','no_show'].includes(status);
   const box=document.createElement('div');box.className='eddu-agenda-lifecycle';box.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px';
   const btn=(action,label,primary=false)=>{const b=document.createElement('button');b.type='button';b.className='btn'+(primary?' primary':'');b.textContent=label;b.dataset.edduAgendaAction=action;b.dataset.appointmentId=apt.id;return b;};
   if(!terminal&&status!=='in_progress')box.appendChild(btn('start','▶ Iniciar atendimento',true));
   if(!terminal)box.appendChild(btn('cancel','Cancelar atendimento'));
   if(!terminal)box.appendChild(btn('reschedule','Reagendar atendimento'));
   if(!apt.client_id||!apt.professional_id){const note=document.createElement('p');note.className='sub';note.style.gridColumn='1/-1';note.textContent='Cadastro incompleto: confira cliente e profissional antes de iniciar.';box.appendChild(note);}
   card.appendChild(box);
  });
 }
 function openReschedule(apt){
  const start=new Date(apt.starts_at),end=new Date(apt.ends_at),duration=Math.max(15,Math.round((end-start)/60000));
  window.views=window.views||{};
  window.views.agendaReschedule=()=>'<h2>Reagendar atendimento</h2><p class="sub">A alteração será salva na Agenda e refletida no aplicativo do cliente.</p>'+
   '<label>Nova data</label><input id="edduRescheduleDate" type="date" value="'+esc(localDate(apt.starts_at))+'">'+
   '<div class="row"><div style="flex:1"><label>Novo início</label><input id="edduRescheduleStart" type="time" value="'+esc(localTime(apt.starts_at))+'"></div><div style="flex:1"><label>Novo término</label><input id="edduRescheduleEnd" type="time" value="'+esc(localTime(apt.ends_at))+'"></div></div>'+
   '<p class="sub">Duração atual: '+duration+' minutos</p><div id="edduRescheduleError" role="alert" style="color:#b42318"></div>'+
   '<div class="grid2"><button type="button" class="btn primary" data-eddu-agenda-save-reschedule="'+esc(apt.id)+'">Salvar novo horário</button><button type="button" class="btn" data-eddu-agenda-close>Voltar</button></div>';
  window.openSheet('agendaReschedule');
 }
 async function reschedule(id){
  const apt=getAppointment(id);if(!apt)throw new Error('Agendamento não encontrado.');
  const date=$('edduRescheduleDate')?.value,start=$('edduRescheduleStart')?.value,end=$('edduRescheduleEnd')?.value;
  if(!date||!start||!end||end<=start)throw new Error('Informe uma data e horários válidos.');
  const starts=new Date(date+'T'+start+':00'),ends=new Date(date+'T'+end+':00');
  if(!Number.isFinite(starts.getTime())||!Number.isFinite(ends.getTime())||ends<=starts)throw new Error('Período inválido.');
  const conflict=rows('appointments').some(x=>x.id!==id&&x.professional_id===apt.professional_id&&localDate(x.starts_at)===date&&!['cancelled','completed','no_show'].includes(String(x.status).toLowerCase())&&starts<new Date(x.ends_at)&&ends>new Date(x.starts_at));
  if(conflict)throw new Error('O profissional já possui outro atendimento nesse intervalo.');
  const saved=await api().update('appointments',id,{starts_at:starts.toISOString(),ends_at:ends.toISOString(),status:'rescheduled'});
  if(!saved?.id)throw new Error('O Neon não confirmou o reagendamento.');
  window.closeSheet?.();window.selectedDayM=date;toast('Atendimento reagendado e sincronizado com o Neon.');await refresh();
 }
 async function startAppointment(id){
  const apt=getAppointment(id);if(!apt)throw new Error('Agendamento não encontrado.');
  if(!apt.client_id||!apt.professional_id)throw new Error('Este agendamento está incompleto. Corrija cliente e profissional antes de iniciar.');
  if(['cancelled','completed','no_show'].includes(String(apt.status).toLowerCase()))throw new Error('Este agendamento já foi encerrado.');
  const existing=rows('commands').find(c=>c.appointment_id===id&&!['cancelled','closed','paid','refunded'].includes(String(c.status||'').toLowerCase()));
  if(existing){
   window.__EDDU_COMMAND_MODE='list';window.__EDDU_COMMAND_DRAFT=null;window.state=window.state||{};window.state.activeCommandId=existing.id;
   if(typeof window.render==='function')window.render('command');else window.openSheet?.('command');
   toast('A comanda já vinculada a este agendamento foi aberta.');
   return;
  }
  const links=rows('appointmentServices').filter(x=>x.appointment_id===id);
  const items=links.map(link=>{const service=rows('services').find(x=>x.id===link.service_id);return service?{item_type:'service',service_id:service.id,product_id:null,description:service.name,quantity:1,unit_price:Number(link.price??service.price_base??service.price??0),total:Number(link.price??service.price_base??service.price??0),unit_cost:Number(service.service_cost||0),commission_percent:Number(rows('professionals').find(p=>p.id===apt.professional_id)?.commission_rate||0)}:null;}).filter(Boolean);
  if(!items.length)throw new Error('Este agendamento não possui serviços vinculados. Edite o agendamento e selecione pelo menos um serviço.');
  if(typeof window.edduCreateCommandFromAppointment!=='function')throw new Error('A tela de comandas não foi carregada. Atualize o aplicativo e tente novamente.');
  await window.edduCreateCommandFromAppointment(apt,items);
  if(!window.__EDDU_COMMAND_DRAFT||window.__EDDU_COMMAND_DRAFT.appointmentId!==id)throw new Error('Não foi possível preparar a comanda deste agendamento.');
  const saved=await api().update('appointments',id,{status:'in_progress'});
  if(!saved?.id)throw new Error('A comanda foi preparada, mas o Neon não confirmou o início do atendimento.');
  try{await window.EDDU_NEON_SYNC?.();}catch(e){console.error('[EDDU] start appointment sync failed',e);}
  if(typeof window.render==='function')window.render('command');else window.openSheet?.('command');
  toast('Comanda aberta com os serviços e valores do agendamento. Revise e salve para registrar no Neon.');
 }
 async function cancelAppointment(id){
  const apt=getAppointment(id);if(!apt)throw new Error('Agendamento não encontrado.');
  if(!confirm('Cancelar este atendimento? O cliente também verá o status atualizado.'))return;
  const saved=await api().update('appointments',id,{status:'cancelled'});if(!saved?.id)throw new Error('O Neon não confirmou o cancelamento.');
  toast('Atendimento cancelado e sincronizado com o aplicativo do cliente.');await refresh();
 }
 document.addEventListener('click',async event=>{
  const action=event.target?.closest?.('[data-eddu-agenda-action],[data-eddu-agenda-save-reschedule],[data-eddu-agenda-close]');if(!action)return;
  event.preventDefault();event.stopPropagation();if(action.dataset.busy==='1')return;action.dataset.busy='1';
  try{
   if(action.hasAttribute('data-eddu-agenda-close')){window.closeSheet?.();return;}
   if(action.hasAttribute('data-eddu-agenda-save-reschedule'))await reschedule(action.dataset.edduAgendaSaveReschedule);
   else{const id=action.dataset.appointmentId,apt=getAppointment(id);if(!apt)throw new Error('Agendamento não encontrado.');
    if(action.dataset.edduAgendaAction==='start')await startAppointment(id);
    if(action.dataset.edduAgendaAction==='cancel')await cancelAppointment(id);
    if(action.dataset.edduAgendaAction==='reschedule')openReschedule(apt);
   }
  }catch(error){console.error('[EDDU] appointment lifecycle failed',error);const n=$('edduRescheduleError');if(n)n.textContent=error.message;toast(error.message);}
  finally{action.dataset.busy='0';}
 },true);
 if(typeof window.masterAgendaSelectDay==='function'&&!window.__EDDU_AGENDA_DAY_WRAPPED){const originalSelectDay=window.masterAgendaSelectDay;window.masterAgendaSelectDay=function(day){window.__EDDU_SELECTED_DAY=day;return originalSelectDay.call(this,day);};window.__EDDU_AGENDA_DAY_WRAPPED=true;}
 window.__EDDU_SELECTED_DAY=window.__EDDU_SELECTED_DAY||localDate(new Date());
 const oldRender=window.render;
 if(typeof oldRender==='function')window.render=function(route,...args){const out=oldRender.call(this,route,...args);if(String(route||'').toLowerCase()==='agenda')setTimeout(enhanceCards,80);return out;};
 window.addEventListener('eddu-neon-sync-complete',()=>{if($('view')&&/agenda/i.test($('view').innerText.slice(0,300)))setTimeout(enhanceCards,50);});
 window.addEventListener('eddu-neon-data-changed',e=>{if(e.detail?.entity==='appointments')setTimeout(enhanceCards,50);});
 window.EDDU_AGENDA_LIFECYCLE_READY=true;
})();