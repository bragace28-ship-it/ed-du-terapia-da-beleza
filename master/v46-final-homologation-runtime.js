/* MASTER V46 FINAL HOMOLOGATION RUNTIME
   Functional hardening only. Does not change V33 baseline or visual source.
*/
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const toastF=m=>typeof window.toast==='function'?window.toast(m):alert(m);

/* 1. Sheet/navigation: guarantee client/professional cards actually open. */
const routeMap={booking:'booking',appointments:'appointments',documents:'documents',payments:'payments',clientReferral:'clientReferral',loyalty:'loyalty',giftCard:'giftCard',receipt:'receipt',termClient:'termClient',clientAnamnesis:'clientAnamnesis',clientHistory:'clientHistory',command:'command',gatewayRanking:'gatewayRanking',cardDetails:'cardDetails',tapOn:'tapOn',finance:'finance',financialReports33:'financialReports33',dre33:'dre33',reconciliation33:'reconciliation33',payables:'payables',newPayable33:'newPayable33',ocrConfirm33:'ocrConfirm33',recurringPayable33:'recurringPayable33',cardInvoice33:'cardInvoice33',newReceivable33:'newReceivable33',commissionsFinance:'commissionsFinance',openFinance:'openFinance',gatewaySettings:'gatewaySettings',cardInvoices:'cardInvoices'};
const originalOpen=window.openSheet;
window.__masterOpenSheet=function(route){
 try{
   if(!window.views?.[route] && typeof originalOpen==='function') return originalOpen(route);
   const shade=document.getElementById('shade'), view=document.getElementById('view'), sheet=shade?.querySelector('.sheet');
   if(!shade||!view||!sheet) return typeof originalOpen==='function'?originalOpen(route):false;
   const html=typeof window.views?.[route]==='function'?window.views[route]():null;
   if(html===null && typeof originalOpen==='function') return originalOpen(route);
   view.innerHTML=html||'<h2>Área indisponível</h2>';
   document.body.classList.add('sheet-open'); shade.classList.add('show');
   shade.style.cssText+=';display:flex!important;visibility:visible!important;opacity:1!important;z-index:100000!important';
   sheet.style.cssText+=';display:block!important;visibility:visible!important;opacity:1!important;z-index:100001!important;pointer-events:auto!important';
   sheet.scrollTop=0; return true;
 }catch(e){toastF('Não foi possível abrir esta tela.');return false}
};
window.openSheet=function(route){return window.__masterOpenSheet(route)};
document.addEventListener('click',e=>{
 const el=e.target.closest?.('[onclick*="openSheet("]');
 if(!el)return;
 const m=(el.getAttribute('onclick')||'').match(/openSheet\(\s*['"]([^'"]+)['"]\s*\)/);
 if(m&&routeMap[m[1]]){e.preventDefault();e.stopImmediatePropagation();window.__masterOpenSheet(m[1]);}
},true);
document.addEventListener('click',e=>{
 const el=e.target.closest?.('.shortcut-v11,.book-v11,.appt-v11,.client-bottom-nav-v20 button,.client-bottom-nav-v20 a');
 if(!el)return;
 const t=(el.innerText||'').toLowerCase();
 const r=t.includes('document')?'documents':t.includes('pagamento')?'payments':t.includes('agendamento')?'appointments':t.includes('agendar')?'booking':null;
 if(r){e.preventDefault();e.stopImmediatePropagation();window.__masterOpenSheet(r);}
},true);

/* 2. Modal header: close button stays inside sheet and never collides with bell/profile. */
const st=document.createElement('style');st.id='master-v46-final-style';st.textContent=
'#shade.show{display:flex!important;visibility:visible!important;opacity:1!important;z-index:100000!important}' +
'#shade .sheet{position:relative!important;z-index:100001!important;max-height:calc(100vh - 28px)!important;overflow:auto!important}' +
'#shade .sheet>.master-sheet-close{position:sticky!important;top:0!important;float:right!important;z-index:100100!important;margin:4px 0 8px 8px!important;width:44px!important;height:44px!important;border-radius:50%!important}' +
'.sheet-open .app-header,.sheet-open #professional>header,.sheet-open #client>header{z-index:1!important;pointer-events:none!important}' +
'.master-section-table{width:100%;border-collapse:collapse}.master-section-table th,.master-section-table td{padding:9px 7px;border-bottom:1px solid #e8deed;text-align:left}.master-section-table th{font-weight:800}.master-num{text-align:right!important}';
document.head.appendChild(st);
function ensureClose(){
 const shade=document.getElementById('shade'),sheet=shade?.querySelector('.sheet'); if(!sheet)return;
 let b=sheet.querySelector('.master-sheet-close');
 if(!b){b=document.createElement('button');b.className='close master-sheet-close';b.type='button';b.setAttribute('aria-label','Fechar');b.textContent='×';sheet.insertBefore(b,sheet.firstChild);}
 b.onclick=e=>{e.preventDefault();e.stopPropagation();if(typeof window.closeSheet==='function')window.closeSheet()};
}
setTimeout(ensureClose,0);

/* 3. Coupon: always generate a unique coupon, even when legacy handler is absent/broken. */
window.createManualCoupon=function(){
 const type=document.getElementById('couponType')?.value||'percent', value=document.getElementById('couponValue')?.value||'', service=document.getElementById('couponService')?.value||'', client=document.getElementById('couponClient')?.value||'', expires=document.getElementById('couponExpiry')?.value||'';
 if(type==='percent'&&(!(Number(value)>0)||Number(value)>100))return toastF('Informe percentual entre 1 e 100.');
 if(type==='fixed'&&!(Number(value)>0))return toastF('Informe um desconto maior que zero.');
 if(type==='service'&&!service)return toastF('Selecione o serviço.');
 const code='EDDU-'+crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
 const key='eddu_master_coupons_v46', arr=JSON.parse(localStorage.getItem(key)||'[]');
 arr.unshift({id:'CP-'+Date.now(),code,type,value:Number(value)||0,service,client,expiresAt:expires,status:'Ativo',createdAt:new Date().toISOString()});
 localStorage.setItem(key,JSON.stringify(arr));
 try{
   if(window.state){state.coupons=Array.isArray(state.coupons)?state.coupons:[];state.coupons.unshift(arr[0]);if(typeof window.persist==='function')window.persist();}
 }catch(_){}
 toastF('✓ Cupom '+code+' gerado com sucesso.');
 setTimeout(()=>{if(typeof window.render==='function')window.render('coupons');},80);
};

/* 4. Agenda: client dropdown with first option "Adicionar novo cliente"; day block; robust persistence. */
function catalogList(key){
  try{
    const arr=Array.isArray(window.data?.[key])?window.data[key]:[];
    return arr.filter(Boolean);
  }catch(_){return []}
}
function optionId(x){return String(x?.id??x?.uuid??'')}
function optionName(x){return String(x?.name??x?.nome??x?.title??'').trim()}
function clientsList(){return catalogList('clients').map(x=>({id:optionId(x),name:optionName(x)})).filter(x=>x.id&&x.name)}
function professionalsList(){return catalogList('professionals').map(x=>({id:optionId(x),name:optionName(x)})).filter(x=>x.id&&x.name)}
function servicesList(){return catalogList('services').map(x=>({id:optionId(x),name:optionName(x),price:Number(x.price??x.price_base??0)||0,duration:Number(x.duration_minutes??x.duration??60)||60})).filter(x=>x.id&&x.name)}
window.openNewClientFromAgenda=function(){window.__masterReturnToAgenda=true; if(typeof window.openSheet==='function')window.openSheet('clientRegistration');};
window.openAgendaAddM=async function(day){
 const d=day||new Date().toISOString().slice(0,10);
 try{if(typeof window.EDDU_NEON_SYNC==='function')await window.EDDU_NEON_SYNC()}catch(_){}
 const clients=clientsList(), professionals=professionalsList(), services=servicesList();
 const clientOptions=clients.length?clients.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join(''):'<option value="" disabled>Nenhum cliente cadastrado</option>';
 const professionalOptions=professionals.length?professionals.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join(''):'<option value="" disabled>Nenhum profissional cadastrado</option>';
 const serviceOptions=services.length?services.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join(''):'<option value="" disabled>Nenhum serviço cadastrado</option>';
 window.views.agendaAdd=()=>'<h2>Adicionar agendamento</h2><p class="sub">Novo atendimento diretamente na Agenda.</p><div class="card">'+
 '<label>Cliente</label><select id="aptClient"><option value="__NEW__">＋ Adicionar novo cliente</option>'+clientOptions+'</select>'+
 '<label>Profissional</label><select id="aptProfessional">'+professionalOptions+'</select>'+
 '<label>Serviço</label><select id="aptService">'+serviceOptions+'</select>'+
 '<div class="row"><div><label>Data</label><input id="aptDate" type="date" value="'+d+'"></div><div><label>Início</label><input id="aptStart" type="time" value="10:00"></div></div>'+
 '<div class="row"><div><label>Término</label><input id="aptEnd" type="time" value="11:00"></div><div><label>Status</label><select id="aptStatus"><option value="confirmed">Confirmado</option><option value="requested">Pendente</option><option value="cancelled">Cancelado</option></select></div></div>'+
 '<div class="action-row"><button class="btn primary full" onclick="saveAgendaAddM()">Salvar agendamento</button><button class="btn full" onclick="closeSheet()">Cancelar</button></div></div>';
 window.__masterAgendaClientHandler=true;
 window.saveAgendaAddM=async function(){
   const clientId=document.getElementById('aptClient')?.value||'';
   if(clientId==='__NEW__'){window.openNewClientFromAgenda();return}
   const professionalId=document.getElementById('aptProfessional')?.value||'';
   const serviceId=document.getElementById('aptService')?.value||'';
   if(!clientId)return toastF('Selecione um cliente ou adicione um novo.');
   if(!professionalId||!serviceId)return toastF('Cadastre profissional e serviço antes de agendar.');
   const client=clients.find(x=>x.id===clientId), professional=professionals.find(x=>x.id===professionalId), service=services.find(x=>x.id===serviceId);
   const a={id:'APT-'+Date.now(),date:document.getElementById('aptDate')?.value,start:document.getElementById('aptStart')?.value,end:document.getElementById('aptEnd')?.value,client:client?.name||'',clientId,professional:professional?.name||'',professionalId,service:service?.name||'',serviceId,status:document.getElementById('aptStatus')?.value||'confirmed'};
   if(!a.date||!a.start||!a.end||a.start>=a.end)return toastF('Informe data e horário válidos.');
   const d=JSON.parse(localStorage.getItem('eddu_data')||'{}');d.appointments=Array.isArray(d.appointments)?d.appointments:[];d.blocks=Array.isArray(d.blocks)?d.blocks:[];
   if(d.blocks.some(b=>b.date===a.date&&a.start<b.end&&a.end>b.start)||d.appointments.some(x=>x.date===a.date&&a.start<x.end&&a.end>x.start))return toastF('Conflito: este horário já está ocupado/bloqueado.');
   d.appointments.push(a);localStorage.setItem('eddu_data',JSON.stringify(d));
   try{if(window.data){window.data.appointments=d.appointments;window.data.blocks=d.blocks}if(typeof window.persist==='function')window.persist()}catch(_){}
   toastF('✓ Agendamento salvo.');setTimeout(()=>window.openSheet('agenda'),120);
 };
 window.openSheet('agendaAdd');
};
window.openAgendaBlockDayM=function(day){
 const d=day||new Date().toISOString().slice(0,10);
 window.views.agendaDayBlock=()=>'<h2>Bloquear dia</h2><p class="sub">Bloqueia todos os horários do dia para novos atendimentos.</p><label>Data</label><input id="blkDayDate" type="date" value="'+d+'"><label>Motivo</label><input id="blkDayReason" placeholder="Ex.: Folga, feriado, manutenção"><button class="btn primary full" onclick="saveAgendaBlockDayM()">✓ Bloquear dia</button><button class="btn full" onclick="openSheet(\'agenda\')">Cancelar</button>';
 window.saveAgendaBlockDayM=function(){const date=document.getElementById('blkDayDate')?.value,reason=document.getElementById('blkDayReason')?.value.trim()||'Dia bloqueado';if(!date)return toastF('Informe a data.');const d=JSON.parse(localStorage.getItem('eddu_data')||'{}');d.appointments=Array.isArray(d.appointments)?d.appointments:[];d.blocks=Array.isArray(d.blocks)?d.blocks:[];if(d.appointments.some(a=>a.date===date))return toastF('Não é possível bloquear o dia: existem agendamentos.');d.blocks=d.blocks.filter(b=>b.date!==date);d.blocks.push({id:'DAYBLK-'+Date.now(),date,start:'00:00',end:'23:59',reason,fullDay:true});localStorage.setItem('eddu_data',JSON.stringify(d));try{if(window.data){data.blocks=d.blocks;data.appointments=d.appointments}if(typeof window.persist==='function')window.persist()}catch(_){}toastF('✓ Dia bloqueado.');setTimeout(()=>window.openSheet('agenda'),120)};
 window.openSheet('agendaDayBlock');
};
function addDayBlockButton(){const shade=document.getElementById('shade');if(!shade)return;const view=document.getElementById('view');if(!view||!view.innerText.includes('Minha agenda'))return;if(view.querySelector('.master-day-block'))return;const b=document.createElement('button');b.className='btn full master-day-block';b.textContent='📅 Bloquear dia inteiro';b.onclick=()=>window.openAgendaBlockDayM();view.querySelector('.action-row')?.appendChild(b)}
setInterval(addDayBlockButton,800);

/* 5. Card invoice: actual selected file is registered and remains visible. */
window.v46AnalyzeCardInvoice=function(){
 const f=document.getElementById('v46CardInvoiceFile')?.files?.[0]||document.querySelector('#view input[type=file]')?.files?.[0];
 if(!f)return toastF('Selecione a fatura primeiro.');
 const key='eddu_master_card_invoices_v46',arr=JSON.parse(localStorage.getItem(key)||'[]');
 arr.unshift({id:'INV-'+Date.now(),name:f.name,mime:f.type,size:f.size,status:'Recebida · aguardando conferência',createdAt:new Date().toISOString()});
 localStorage.setItem(key,JSON.stringify(arr));toastF('✓ Fatura carregada e registrada.');setTimeout(()=>window.openSheet('cardInvoices'),120);
};
window.views.cardInvoices=function(){
 const arr=JSON.parse(localStorage.getItem('eddu_master_card_invoices_v46')||'[]');
 return '<h2>Faturas de Cartão</h2><p class="sub">Arquivo recebido e associado à análise financeira. Nenhum dado é enviado a banco neste teste.</p><div class="card"><input id="v46CardInvoiceFile" type="file" accept=".pdf,image/*"><button class="btn primary full" onclick="v46AnalyzeCardInvoice()">Analisar fatura</button></div><h3>Faturas carregadas</h3>'+
 (arr.length?arr.map(x=>'<div class="option"><span><b>'+esc(x.name)+'</b><small>'+Math.ceil((x.size||0)/1024)+' KB · '+esc(x.status)+'</small></span></div>').join(''):'<div class="card"><p class="sub">Nenhuma fatura carregada.</p></div>')+
 '<button class="btn full" onclick="openSheet(\'finance\')">← Financeiro</button>';
};

/* 6. Gateway: complete rate matrix, selectable exact installments. */
const gatewayRates={
 PagBank:{1:.0099,2:.0299,3:.0399,4:.0499,5:.0599,6:.0699,7:.0799,8:.0849,9:.0899,10:.0949,11:.0999,12:.1049,18:.1249,24:.1449},
 Asaas:{1:.0089,2:.0299,3:.0399,4:.0499,5:.0549,6:.0599,7:.0629,8:.0629,9:.0629,10:.0629,11:.0629,12:.0629,18:.0799,24:.0989},
 Stripe:{1:.0299,2:.0399,3:.0499,4:.0549,5:.0599,6:.0649,7:.0699,8:.0699,9:.0699,10:.0699,11:.0699,12:.0699,18:.0899,24:.1099}
};
window.v46GatewayRate=(g,n)=>gatewayRates[g]?.[n]??gatewayRates[g]?.[12]??0;
window.v46CalcGateway=function(){
 const a=Number(document.getElementById('gwAmount')?.value||0),n=Number(document.getElementById('gwInstallments')?.value||1),g=document.getElementById('gwProvider')?.value||'Asaas',rate=window.v46GatewayRate(g,n),fee=a*rate,net=a-fee;
 const out=document.getElementById('gwResult');if(out)out.innerHTML='<div class="card"><div class="row"><span>Taxa '+esc(g)+' · '+n+'x</span><b>'+((rate*100).toFixed(2)).replace('.',',')+'%</b></div><div class="row"><span>Taxa estimada</span><b>'+money(fee)+'</b></div><div class="row"><span>Líquido estimado</span><b>'+money(net)+'</b></div></div>';
};
window.views.gatewaySettings=function(){
 return '<h2>Smart Gateway</h2><p class="sub">Tabela completa por gateway e número exato de parcelas.</p><div class="card"><label>Valor</label><input id="gwAmount" type="number" step="0.01" value="120"><label>Gateway</label><select id="gwProvider" onchange="v46CalcGateway()"><option>PagBank</option><option>Asaas</option><option>Stripe</option></select><label>Parcelas</label><select id="gwInstallments" onchange="v46CalcGateway">'+[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n=>'<option value="'+n+'">'+n+'x</option>').join('')+'</select><div id="gwResult"></div></div><div class="card"><table class="master-section-table"><thead><tr><th>Parcelas</th><th>PagBank</th><th>Asaas</th><th>Stripe</th></tr></thead><tbody>'+[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n=>'<tr><td>'+n+'x</td><td>'+((gatewayRates.PagBank[n]*100).toFixed(2))+'%</td><td>'+((gatewayRates.Asaas[n]*100).toFixed(2))+'%</td><td>'+((gatewayRates.Stripe[n]*100).toFixed(2))+'%</td></tr>').join('')+'</tbody></table></div><button class="btn full" onclick="openSheet(\'finance\')">← Financeiro</button>';
};

/* 7. Financial report: real rows + readable HTML print, plus direct PDF download fallback. */
function financialSnapshot(){
 const f=window.data?.financial||window.state?.financial||{};
 const fin=JSON.parse(localStorage.getItem('eddu_fin33')||'{}');
 const pays=Array.isArray(fin.payables)?fin.payables:[], rec=Array.isArray(fin.receivables)?fin.receivables:[];
 const rows=[...rec.map(x=>({kind:'Entrada',desc:x.service||x.command||x.client||'Recebimento',date:x.due||'',status:x.status||'',value:Number(x.paid||x.total||0)})),...pays.map(x=>({kind:'Saída',desc:x.desc||'Conta a pagar',date:x.due||'',status:x.status||'',value:Number(x.amount||0)}))];
 const inV=rows.filter(x=>x.kind==='Entrada').reduce((a,x)=>a+x.value,0),outV=rows.filter(x=>x.kind==='Saída').reduce((a,x)=>a+x.value,0);
 return {rows,inV,outV,result:inV-outV,cpv:Number(f.cpv||0)};
}
function reportHtml(){
 const s=financialSnapshot(), now=new Date().toLocaleDateString('pt-BR');
 return '<!doctype html><html><head><meta charset="utf-8"><title>Relatório Financeiro ED & DU</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;color:#2b2031;margin:0}h1{font-size:24px;margin:0;color:#5d2384}h2{font-size:16px;color:#5d2384;margin:22px 0 8px}.meta{color:#777;font-size:11px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:18px 0}.box{border:1px solid #ddd;border-radius:10px;padding:10px}.box b{display:block;font-size:14px;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:7px;border-bottom:1px solid #e5e0e7;text-align:left}th{background:#f2eaf6}.num{text-align:right}.result{font-size:17px;font-weight:800;color:#4d1f73}footer{margin-top:25px;font-size:9px;color:#888}</style></head><body><h1>ED & DU | Terapia da Beleza</h1><div class="meta">Relatório financeiro completo · gerado em '+now+'</div><div class="grid"><div class="box">Entradas<b>'+money(s.inV)+'</b></div><div class="box">Saídas pagas<b>'+money(s.outV)+'</b></div><div class="box">Resultado líquido<b class="result">'+money(s.result)+'</b></div><div class="box">CPV<b>'+money(s.cpv)+'</b></div></div><h2>Lançamentos</h2><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Data</th><th>Status</th><th class="num">Valor</th></tr></thead><tbody>'+s.rows.map(r=>'<tr><td>'+esc(r.kind)+'</td><td>'+esc(r.desc)+'</td><td>'+esc(r.date)+'</td><td>'+esc(r.status)+'</td><td class="num">'+money(r.value)+'</td></tr>').join('')+'</tbody></table><footer>ED & DU · documento de homologação · valores derivados dos lançamentos disponíveis no ambiente.</footer></body></html>';
}
window.v8PrintReport=function(){const w=window.open('','_blank','width=980,height=800');if(!w)return toastF('O navegador bloqueou a janela. Permita pop-ups para o relatório.');w.document.open();w.document.write(reportHtml());w.document.close();setTimeout(()=>w.print(),350);};
window.v46DownloadFinancialReport=function(){const blob=new Blob([reportHtml()],{type:'text/html;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='EDDU-Relatorio-Financeiro.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toastF('✓ Relatório completo gerado. Use Imprimir > Salvar como PDF.');};

/* 8. Quote PDF: retain existing vector PDF and ensure every visible button reaches it. */
window.v46QuotePDF=function(){if(typeof window.v27DownloadQuotePDF==='function')return window.v27DownloadQuotePDF();toastF('Função de PDF de orçamento indisponível.');};
document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(!b)return;const t=(b.innerText||'').toLowerCase();if(t.includes('gerar orçamento pdf')||t.includes('baixar pdf')&&document.body.innerText.includes('simulação de orçamento')){if(typeof window.v27DownloadQuotePDF==='function'){e.preventDefault();e.stopImmediatePropagation();window.v27DownloadQuotePDF();}}},true);

/* 9. User permissions: always render module checkboxes immediately for new/edit user. */
const origUserEdit=window.openUserEditV20;
window.openUserEditV20=function(id){
 const r=typeof origUserEdit==='function'?origUserEdit(id):window.openSheet('userEdit');
 setTimeout(()=>{if(typeof window.renderUserPermsV20==='function')window.renderUserPermsV20();},50);return r;
};
document.addEventListener('change',e=>{if(e.target?.id==='u20role'&&typeof window.renderUserPermsV20==='function')setTimeout(()=>window.renderUserPermsV20(),0)},true);

window.EDDU_MASTER_V46_FINAL_RUNTIME=true;
/* MASTER V46 — real payments bridge (no demo payment records) */
(function(){
  const escP=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const paymentMoney=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  async function paymentToken(){
    try{
      if(typeof window.EDDU_NEON_GET_SESSION!=='function')return '';
      const r=await window.EDDU_NEON_GET_SESSION();
      const s=r?.data?.session||r?.session||r?.data||r;
      return String(s?.accessToken||s?.access_token||s?.token||s?.session?.token||'');
    }catch(_){return ''}
  }
  async function paymentsRequest(path,options={}){
    const token=await paymentToken();
    if(!token)throw new Error('Sessão Neon Auth necessária para operações financeiras.');
    const headers=Object.assign({'Authorization':'Bearer '+token,'Content-Type':'application/json'},options.headers||{});
    const r=await fetch(path,Object.assign({},options,{headers}));
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Falha na operação de pagamentos.');
    return data;
  }
  function paymentRows(rows){
    if(!Array.isArray(rows)||!rows.length)return '<div class="card"><p class="sub">Nenhum pagamento real registrado no Neon.</p></div>';
    return rows.map(p=>{
      const meta=p.metadata||{}, provider=meta.provider||{}, invoice=meta.invoiceUrl||provider.invoiceUrl||'';
      return '<div class="card"><div class="row"><span>'+escP(p.method||'Pagamento')+'</span><b>'+paymentMoney(p.amount)+'</b></div>'+
        '<div class="row"><span>Status</span><b class="'+(/RECEIVED|CONFIRMED|RECEIVED_IN_CASH/i.test(String(p.status))?'badge-ok':'')+'">'+escP(p.status||'Pendente')+'</b></div>'+
        '<div class="row"><span>Gateway</span><b>'+escP(p.gateway||'Asaas')+'</b></div>'+
        '<div class="row"><span>Data</span><b>'+escP(p.created_at?new Date(p.created_at).toLocaleDateString('pt-BR'):'—')+'</b></div>'+
        (invoice?'<button class="btn full" onclick="window.open('+JSON.stringify(invoice)+',\'_blank\',\'noopener\')">Abrir fatura</button>':'')+
        '<button class="btn full" onclick="window.__EDDU_PAYMENT_RECEIPT='+JSON.stringify(p).replace(/</g,'\\u003c')+';openSheet(\'receipt\')">Ver comprovante</button></div>';
    }).join('');
  }
  window.EDDU_REFRESH_REAL_PAYMENTS=async function(){
    const status=document.getElementById('eddu-payment-status');
    if(status)status.textContent='Consultando Neon…';
    try{
      const data=await paymentsRequest('/api/payments');
      window.data=window.data||{};window.data.payments=Array.isArray(data.payments)?data.payments:[];
      if(status)status.textContent='Dados reais · Neon + Asaas';
      if(typeof window.render==='function')window.render('payments');
    }catch(e){
      if(status)status.textContent=String(e.message||e);
      if(typeof window.__EDDU_NEON_AUTH_REQUIRED==='function')window.__EDDU_NEON_AUTH_REQUIRED();
    }
  };
  window.openRealPaymentForm=function(){if(typeof window.openSheet==='function')window.openSheet('realPayment')};
  window.createRealPayment=async function(){
    const btn=document.getElementById('eddu-pay-submit'),status=document.getElementById('eddu-pay-create-status');
    if(btn)btn.disabled=true;if(status)status.textContent='Criando cobrança no Asaas…';
    try{
      const amount=Number(document.getElementById('eddu-pay-amount')?.value||0);
      const customer=String(document.getElementById('eddu-pay-customer')?.value||'').trim();
      const billingType=String(document.getElementById('eddu-pay-method')?.value||'PIX');
      const dueDate=String(document.getElementById('eddu-pay-due')?.value||new Date().toISOString().slice(0,10));
      const description=String(document.getElementById('eddu-pay-description')?.value||'ED & DU | Terapia da Beleza').trim();
      const installmentCount=Math.max(1,Number(document.getElementById('eddu-pay-installments')?.value||1));
      if(!(amount>0)||!customer)throw new Error('Informe o valor e o ID do cliente no Asaas.');
      const data=await paymentsRequest('/api/payments',{method:'POST',headers:{'Idempotency-Key':'EDDU-'+crypto.randomUUID()},body:JSON.stringify({amount,customer,billingType,dueDate,description,installmentCount})});
      const p=data.payment||{},meta=p.metadata||{},pix=data.pix||meta.pixQrCode;
      if(status)status.textContent='✓ Cobrança criada no Asaas. Status: '+String(p.status||'PENDING');
      const host=document.getElementById('eddu-pay-result');
      if(host&&pix?.encodedImage)host.innerHTML='<div class="card"><b>PIX gerado</b><img alt="QR Code PIX" style="display:block;width:220px;max-width:100%;margin:14px auto" src="data:image/png;base64,'+pix.encodedImage+'"><textarea readonly style="width:100%;min-height:90px;box-sizing:border-box">'+escP(pix.payload||'')+'</textarea></div>';
      else if(host&&(meta.invoiceUrl||data.provider?.invoiceUrl)){const url=meta.invoiceUrl||data.provider.invoiceUrl;host.innerHTML='<div class="card"><b>Fatura Asaas criada</b><button class="btn primary full" onclick="window.open('+JSON.stringify(url)+',\'_blank\',\'noopener\')">Abrir fatura de pagamento</button></div>'}
      if(typeof window.EDDU_REFRESH_REAL_PAYMENTS==='function')await window.EDDU_REFRESH_REAL_PAYMENTS();
    }catch(e){if(status)status.textContent='Erro: '+String(e.message||e)}
    finally{if(btn)btn.disabled=false}
  };
  window.views=window.views||{};
  window.views.payments=()=>'<h2>Pagamentos</h2><div id="eddu-payment-status" class="sub">Dados reais · carregando…</div>'+paymentRows(Array.isArray(window.data?.payments)?window.data.payments:[])+'<button class="btn primary full" onclick="openRealPaymentForm()">+ Nova cobrança</button><button class="btn full" onclick="EDDU_REFRESH_REAL_PAYMENTS()">↻ Atualizar pagamentos</button>';
  window.views.realPayment=()=>'<h2>Nova cobrança</h2><p class="sub">Homologação financeira: a cobrança será criada no Asaas e registrada no Neon.</p><div class="card"><label>Cliente Asaas (ID cus_...)</label><input id="eddu-pay-customer" placeholder="cus_..."><label>Valor</label><input id="eddu-pay-amount" type="number" min="0.01" step="0.01" value="1.00"><label>Forma</label><select id="eddu-pay-method"><option value="PIX">PIX</option><option value="CREDIT_CARD">Cartão de crédito · fatura Asaas</option><option value="UNDEFINED">Fatura · cliente escolhe</option></select><label>Parcelas</label><select id="eddu-pay-installments"><option value="1">1x</option><option value="2">2x</option><option value="3">3x</option><option value="6">6x</option><option value="12">12x</option></select><label>Vencimento</label><input id="eddu-pay-due" type="date" value="'+new Date().toISOString().slice(0,10)+'"><label>Descrição</label><input id="eddu-pay-description" value="ED & DU | Terapia da Beleza"><button id="eddu-pay-submit" class="btn primary full" onclick="createRealPayment()">Criar cobrança real</button><div id="eddu-pay-create-status" class="sub"></div><div id="eddu-pay-result"></div></div><button class="btn full" onclick="openSheet(\'payments\')">← Pagamentos</button>';
  window.views.receipt=()=>{
    const p=window.__EDDU_PAYMENT_RECEIPT||{},meta=p.metadata||{},provider=meta.provider||{};
    return '<h2>Comprovante de pagamento</h2><div class="card"><div class="row"><span>ED & DU | Terapia da Beleza</span><b>Comprovante</b></div><div class="row"><span>Valor</span><b>'+paymentMoney(p.amount)+'</b></div><div class="row"><span>Pagamento</span><b>'+escP(p.method||'—')+'</b></div><div class="row"><span>Status</span><b class="badge-ok">'+escP(p.status||'—')+'</b></div><div class="row"><span>Identificação</span><b>'+escP(p.external_id||'—')+'</b></div></div>'+(provider.invoiceUrl?'<button class="btn primary full" onclick="window.open('+JSON.stringify(provider.invoiceUrl)+',\'_blank\',\'noopener\')">Abrir fatura Asaas</button>':'')+'<button class="btn full" onclick="openSheet(\'payments\')">← Pagamentos</button>';
  };
  setTimeout(()=>{if(typeof window.EDDU_REFRESH_REAL_PAYMENTS==='function'&&document.querySelector('.client-actions-v11'))window.EDDU_REFRESH_REAL_PAYMENTS().catch(()=>{})},1200);
})();

})();