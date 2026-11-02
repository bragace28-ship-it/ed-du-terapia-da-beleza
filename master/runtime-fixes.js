(function(){
  'use strict';
  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(e){return d}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const escF=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brlF=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const toastF=window.toast||((m)=>alert(m));
  function blobFromStored(d){
    if(!d?.dataUrl)return null; const raw=String(d.dataUrl);
    try{if(raw.startsWith('data:')){const [head,payload]=raw.split(',',2);const mime=(head.match(/^data:([^;]+)/i)||[])[1]||d.mime||'application/octet-stream';if(/;base64/i.test(head)){const bin=atob(payload||'');const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime})}return new Blob([decodeURIComponent(payload||'')],{type:mime})}const bin=atob(raw.replace(/\s/g,''));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:d.mime||'application/octet-stream'})}catch(e){return null}
  }
  window.previewInternalDocV19=function(id){const docs=read('eddu_master_internal_docs_v19',[]),d=docs.find(x=>x.id===id);if(!d)return;const isImg=/^image\//.test(d.mime||''),isPdf=d.mime==='application/pdf'||/\.pdf$/i.test(d.name||''),blob=blobFromStored(d),url=blob?URL.createObjectURL(blob):'';window.__v46DocBlobUrl=url;views.internalDocPreview=()=>`<h2>${escF(d.title)}</h2><p class="sub">${escF(d.type)} · ${new Date(d.createdAt||Date.now()).toLocaleString('pt-BR')}</p>`+(isImg&&url?`<img src="${url}" alt="${escF(d.title)}" style="width:100%;border-radius:14px;max-height:420px;object-fit:contain">`:isPdf&&url?`<iframe src="${url}#toolbar=1" title="PDF ${escF(d.title)}" style="width:100%;height:520px;border:0;border-radius:14px;background:#fff"></iframe>`:`<div class="card"><b>Arquivo: ${escF(d.name)}</b><p class="sub">Não foi possível gerar uma prévia segura deste formato.</p></div>`)+`<div class="card"><b>Observações</b><p class="sub">${escF(d.notes||'Sem observações.')}</p></div><button class="btn primary full" onclick="downloadInternalDocV46('${escF(d.id)}')">↓ Baixar documento</button><button class="btn full" onclick="openSheet('internalDocs')">← Voltar</button>`;openSheet('internalDocPreview');setTimeout(()=>{if(window.__v46DocBlobUrl)URL.revokeObjectURL(window.__v46DocBlobUrl)},60000)};
  window.downloadInternalDocV46=function(id){const d=read('eddu_master_internal_docs_v19',[]).find(x=>x.id===id);if(!d)return;const blob=blobFromStored(d);if(!blob){toastF('Arquivo inválido ou corrompido.');return}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=d.name||'documento';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000)};
  const Fget=()=>read('eddu_masterFinance',{}),Fset=o=>write('eddu_masterFinance',o);
  window.savePayable33=async function(){const d=document.getElementById('fpdesc')?.value.trim(),a=Number(document.getElementById('fpamount')?.value),due=document.getElementById('fpdue')?.value;if(!d||!(a>0)||!due){toastF('Preencha descrição, valor e vencimento');return}const f=Fget();f.payables=Array.isArray(f.payables)?f.payables:[];const file=document.getElementById('fpfile')?.files?.[0];f.payables.unshift({id:'p'+Date.now(),desc:d,origin:document.getElementById('fporigin')?.value||'Operação',cat:document.getElementById('fpcat')?.value||'Outros',amount:a,due,status:'Aberta',doc:file?file.name:'',note:document.getElementById('fpnote')?.value||'',createdAt:new Date().toISOString()});Fset(f);toastF('✓ Conta a pagar cadastrada e persistida');openSheet('payables')};
  window.v46AddTestPayment=function(){const f=Fget();f.receivables=Array.isArray(f.receivables)?f.receivables:[];const id='R46-'+Date.now();f.receivables.unshift({id,client:'Mariana',command:'CMD-TEST-'+Date.now(),service:'Serviço de teste',method:'Pix',total:120,paid:0,status:'Em aberto',due:new Date().toISOString().slice(0,10)});Fset(f);toastF('Pagamento de teste criado');openSheet('reconciliation33')};
  const gateways={PagBank:{one:.0299,install:.0849},Asaas:{one:.0299,install:.0629},Stripe:{one:.0299,install:.0699}};
  window.v46CalcGateway=function(){const a=Number(document.getElementById('gwAmount')?.value||0),n=Math.max(1,Number(document.getElementById('gwInstallments')?.value||1)),g=document.getElementById('gwProvider')?.value||'Asaas',cfg=gateways[g]||gateways.Asaas,rate=n===1?cfg.one:cfg.install,fee=a*rate,net=a-fee,out=document.getElementById('gwResult');if(out)out.innerHTML=`<div class="card"><div class="row"><span>Taxa ${g}</span><b>${(rate*100).toFixed(2).replace('.',',')}%</b></div><div class="row"><span>Taxa estimada</span><b>${brlF(fee)}</b></div><div class="row"><span>Líquido estimado</span><b class="money-good">${brlF(net)}</b></div></div>`;write('eddu_v46_gateway_choice',{provider:g,installments:n,amount:a,rate,fee,net,at:new Date().toISOString()})};
  views.gatewaySettings=()=>`<h2>Smart Gateway</h2><p class="sub">Homologação local: cálculo de taxa e persistência da escolha. Nenhuma cobrança real é criada nesta tela.</p><div class="card"><label>Valor</label><input id="gwAmount" type="number" step="0.01" value="120"><label>Gateway</label><select id="gwProvider"><option>Asaas</option><option>PagBank</option><option>Stripe</option></select><label>Parcelas</label><select id="gwInstallments"><option>1</option><option>2</option><option>3</option><option>6</option><option>12</option><option>24</option></select><button class="btn primary full" onclick="v46CalcGateway()">Calcular taxa e líquido</button><div id="gwResult"></div></div><button class="btn full" onclick="openSheet('finance')">← Financeiro</button>`;
  window.v46AnalyzeCardInvoice=async function(){const input=document.getElementById('v46CardInvoiceFile'),file=input?.files?.[0];if(!file){toastF('Selecione uma fatura primeiro');return}const list=read('eddu_v46_card_invoices',[]);list.unshift({id:'INV-'+Date.now(),name:file.name,mime:file.type,size:file.size,status:'Aguardando conferência humana',createdAt:new Date().toISOString()});write('eddu_v46_card_invoices',list);toastF('✓ Fatura registrada para conferência');openSheet('cardInvoices')};
  views.cardInvoices=()=>{const list=read('eddu_v46_card_invoices',[]);return `<h2>Faturas de Cartão</h2><p class="sub">A fatura é registrada no APP para conferência. O teste não envia o arquivo a banco ou gateway.</p><div class="card"><input id="v46CardInvoiceFile" type="file" accept=".pdf,image/*"><button class="btn primary full" onclick="v46AnalyzeCardInvoice()">Analisar fatura</button></div><h3>Faturas registradas</h3>${list.length?list.map(x=>`<div class="option"><span><b>${escF(x.name)}</b><small>${Math.max(1,Math.ceil(x.size/1024))} KB · ${escF(x.status)}</small></span></div>`).join(''):'<div class="card"><b>Nenhuma fatura registrada.</b></div>'}<button class="btn full" onclick="openSheet('finance')">← Financeiro</button>`};
  const oldCreate=window.createManualCoupon;
  window.createManualCoupon=function(){const t=document.getElementById('couponType')?.value||'percent',v=document.getElementById('couponValue')?.value||'',s=document.getElementById('couponService')?.value||'',c=document.getElementById('couponClient')?.value.trim()||'',e=document.getElementById('couponExpiry')?.value||'';if(t==='percent'&&(!(Number(v)>0)||Number(v)>100))return toastF('Informe percentual entre 1 e 100');if(t==='fixed'&&!(Number(v)>0))return toastF('Informe um valor de desconto maior que zero');if(t==='service'&&!s)return toastF('Selecione o serviço');if(typeof oldCreate==='function'){oldCreate();setTimeout(()=>{const arr=read('eddu_v46_coupon_audit',[]);arr.unshift({type:t,value:v,service:s,client:c,expires:e,at:new Date().toISOString()});write('eddu_v46_coupon_audit',arr)},0)}else toastF('Gerador de cupom indisponível')};
  window.v46BookingDay=window.v46BookingDay||new Date().toISOString().slice(0,10);
  window.v46BookingTime=window.v46BookingTime||'';
  window.v46BookingClient=window.v46BookingClient||'';
  window.v46BookingProfessional=window.v46BookingProfessional||'';
  window.v46BookingService=window.v46BookingService||'';
  const bookingRows=key=>(Array.isArray(window.data?.[key])?window.data[key]:[]).filter(x=>x&&x.id&&x.active!==false);
  const bookingMinute=value=>{const p=String(value||'').slice(0,5).split(':').map(Number);return Number.isFinite(p[0])?p[0]*60+(p[1]||0):0};
  const bookingClock=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
  const bookingAvailability=day=>{
    const clients=bookingRows('clients'),professionals=bookingRows('professionals'),services=bookingRows('services');
    const professional=professionals.find(x=>x.id===window.v46BookingProfessional);
    const service=services.find(x=>x.id===window.v46BookingService);
    if(!professional||!service||!clients.some(x=>x.id===window.v46BookingClient))return [];
    const duration=Math.max(1,Number(service.duration_minutes)||60);
    const apps=Array.isArray(window.data?.appointments)?window.data.appointments:[];
    const blocks=Array.isArray(window.data?.blocks)?window.data.blocks:[];
    return ['09:00','10:00','11:00','13:00','14:00','15:00','16:00','17:00'].filter(time=>{
      const start=bookingMinute(time),end=start+duration;
      if(end>1440)return false;
      const conflict=apps.some(a=>{
        if(a.date!==day||['cancelado','cancelled','canceled','no_show'].includes(String(a.statusCode||a.status||'').toLowerCase()))return false;
        const prof=a.professionalId||a.professional_id;
        if(prof&&prof!==professional.id)return false;
        return bookingMinute(a.start)<end&&bookingMinute(a.end)>start;
      });
      const blocked=blocks.some(b=>{
        if(b.date!==day)return false;
        const prof=b.professionalId||b.professional_id;
        if(prof&&prof!==professional.id)return false;
        const blockStart=bookingMinute(b.start||'00:00');
        const blockEnd=b.fullDay||b.wholeDay?1440:bookingMinute(b.end||'23:59');
        return blockStart<end&&blockEnd>start;
      });
      return !conflict&&!blocked;
    });
  };
  window.v46SelectBookingDay=d=>{window.v46BookingDay=d;window.v46BookingTime='';render('booking')};
  window.v46SelectBookingTime=t=>{window.v46BookingTime=t;render('booking')};
  window.v46SelectBookingClient=id=>{window.v46BookingClient=id;window.v46BookingTime='';render('booking')};
  window.v46SelectBookingProfessional=id=>{window.v46BookingProfessional=id;window.v46BookingTime='';render('booking')};
  window.v46SelectBookingService=id=>{window.v46BookingService=id;window.v46BookingTime='';render('booking')};
  window.v46ConfirmBooking=async function(){
    const clients=bookingRows('clients'),professionals=bookingRows('professionals'),services=bookingRows('services');
    const client=clients.find(x=>x.id===window.v46BookingClient),professional=professionals.find(x=>x.id===window.v46BookingProfessional),service=services.find(x=>x.id===window.v46BookingService);
    const day=window.v46BookingDay,time=window.v46BookingTime;
    if(!client||!professional||!service)return toastF('Selecione um cliente, profissional e serviço cadastrados.');
    if(!day||!time)return toastF('Escolha uma data e um horário disponível.');
    const duration=Math.max(1,Number(service.duration_minutes)||60),start=bookingMinute(time),end=start+duration;
    if(end>1440)return toastF('O atendimento ultrapassa o horário permitido.');
    const values={aptClient:client.id,aptProfessional:professional.id,aptService:service.id,aptDate:day,aptStart:time,aptEnd:bookingClock(end),aptStatus:'Pendente'};
    for(const [id,value] of Object.entries(values)){
      let el=document.getElementById(id);
      if(!el){el=document.createElement('input');el.type='hidden';el.id=id;document.body.appendChild(el);}
      el.value=value;
    }
    let button=document.getElementById('saveAgendaReal');
    if(!button){button=document.createElement('button');button.id='saveAgendaReal';button.type='button';button.style.display='none';document.body.appendChild(button);}
    button.disabled=false;
    if(typeof window.saveAgendaAddM!=='function')return toastF('A gravação segura da Agenda não está disponível.');
    await window.saveAgendaAddM();
  };
  views.booking=()=>{
    const clients=bookingRows('clients'),professionals=bookingRows('professionals'),services=bookingRows('services');
    if(!clients.some(x=>x.id===window.v46BookingClient))window.v46BookingClient=clients[0]?.id||'';
    if(!professionals.some(x=>x.id===window.v46BookingProfessional))window.v46BookingProfessional=professionals[0]?.id||'';
    if(!services.some(x=>x.id===window.v46BookingService))window.v46BookingService=services[0]?.id||'';
    const d=new Date(window.v46BookingDay+'T12:00:00'),y=d.getFullYear(),mo=d.getMonth(),days=new Date(y,mo+1,0).getDate(),first=new Date(y,mo,1),start=(first.getDay()+6)%7,sel=window.v46BookingDay;
    const localDate=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
    let cal='';
    for(let i=0;i<start;i++)cal+='<button class="cal-day muted" disabled></button>';
    for(let n=1;n<=days;n++){const k=y+'-'+String(mo+1).padStart(2,'0')+'-'+String(n).padStart(2,'0');cal+=`<button class="cal-day ${k===sel?'selected':''}" onclick="v46SelectBookingDay('${k}')"><span>${n}</span></button>`;}
    const selectedService=services.find(x=>x.id===window.v46BookingService);
    const available=bookingAvailability(sel);
    const optionList=(rows,value,placeholder)=>'<option value="">'+escF(placeholder)+'</option>'+rows.map(x=>'<option value="'+escF(x.id)+'" '+(x.id===value?'selected':'')+'>'+escF(x.name)+'</option>').join('');
    const missing=[];
    if(!clients.length)missing.push('clientes');
    if(!professionals.length)missing.push('profissionais');
    if(!services.length)missing.push('serviços');
    return `<h2>Agendar atendimento</h2><p class="sub">Selecione registros reais. A solicitação só será confirmada após gravação no Neon.</p>
      ${missing.length?'<p role="alert">Cadastre primeiro: '+escF(missing.join(', '))+'. Não há dados de demonstração nesta tela.</p>':''}
      <div class="card"><label>Cliente</label><select onchange="v46SelectBookingClient(this.value)">${optionList(clients,window.v46BookingClient,'Selecione o cliente')}</select>
      <label>Profissional</label><select onchange="v46SelectBookingProfessional(this.value)">${optionList(professionals,window.v46BookingProfessional,'Selecione o profissional')}</select>
      <label>Serviço</label><select onchange="v46SelectBookingService(this.value)">${optionList(services,window.v46BookingService,'Selecione o serviço')}</select>
      ${selectedService?'<p class="sub">'+escF(selectedService.name)+' · '+brlF(selectedService.price||selectedService.price_base||0)+' · '+(Number(selectedService.duration_minutes)||60)+' min</p>':''}</div>
      <h3>Data</h3><div class="calendar"><div class="cal-head"><button onclick="v46SelectBookingDay('${localDate(new Date(y,mo-1,1))}')">‹</button><div class="cal-title">${first.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</div><button onclick="v46SelectBookingDay('${localDate(new Date(y,mo+1,1))}')">›</button></div><div class="cal-week">${['SEG','TER','QUA','QUI','SEX','SÁB','DOM'].map(x=>'<span>'+x+'</span>').join('')}</div><div class="cal-grid">${cal}</div></div>
      <h3>Horários disponíveis · ${d.toLocaleDateString('pt-BR')}</h3><div class="grid2">${available.map(t=>'<button class="btn '+(window.v46BookingTime===t?'primary':'')+'" onclick="v46SelectBookingTime(\''+t+'\')">'+t+'</button>').join('')||'<div class="card">Nenhum horário disponível para os registros selecionados.</div>'}</div>
      <button class="btn primary full" onclick="v46ConfirmBooking()" ${(!clients.length||!professionals.length||!services.length||!window.v46BookingTime)?'disabled':''}>✓ Confirmar agendamento</button>`;
  };
  window.v46SignTerm=function(id){const terms=window.state?.terms||read('eddu_state',{terms:[]}).terms||[],t=terms.find(x=>x.id===id);if(!t)return toastF('Termo não encontrado');views.termSign=()=>`<h2>Termo de responsabilidade</h2><p class="sub">${escF(t.client)} · ${escF(t.id)}</p><div class="card"><p>Declaro que li e compreendi o Termo de Responsabilidade e Consentimento.</p><label style="display:flex;gap:10px;align-items:center"><input id="termAgree" type="checkbox"> Concordo com o conteúdo do documento</label><button class="btn primary full" onclick="v46ConfirmTermSign('${escF(t.id)}')">✍️ Assinar digitalmente</button></div>`;openSheet('termSign')};
  window.v46ConfirmTermSign=function(id){const terms=window.state?.terms||read('eddu_state',{terms:[]}).terms||[],t=terms.find(x=>x.id===id);if(!t)return;if(!document.getElementById('termAgree')?.checked)return toastF('Marque o aceite antes de assinar');t.status='Assinado';t.signedAt=new Date().toLocaleString('pt-BR');write('eddu_state',{...read('eddu_state',{}),terms});toastF('✓ Termo assinado e registrado');openSheet('termsManager')};
  const oldSend=window.sendResponsibilityTerm;window.sendResponsibilityTerm=function(){if(typeof oldSend==='function')oldSend();setTimeout(()=>{const terms=window.state?.terms||read('eddu_state',{terms:[]}).terms||[],t=terms[terms.length-1];if(!t)return;const link=location.href.split('#')[0]+'#term='+encodeURIComponent(t.id),msg=`Olá, ${t.client}! A ED & DU | Terapia da Beleza enviou seu Termo de Responsabilidade e Consentimento para assinatura digital.\n\nTermo: ${t.id}\n\nAcesse este link para revisar e assinar:\n${link}`;window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener')},50)};
  const hash=(location.hash||'').match(/^#term=([^&]+)/);if(hash)setTimeout(()=>v46SignTerm(decodeURIComponent(hash[1])),250);
  window.EDDU_V46_RUNTIME_FIXES=true;
})();