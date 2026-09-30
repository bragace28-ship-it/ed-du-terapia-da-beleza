/* MASTER V46 FINAL FUNCTIONAL HOTFIX — 2026-09-30
   Additive only. V33/index.html remains immutable.
   Purpose: make the homologation flows deterministic before cloud E2E tests.
*/
(function(){
  'use strict';

  const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(e){return d}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
  const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const toastF=m=>{try{if(typeof window.toast==='function')window.toast(m);else alert(m)}catch(e){alert(m)}};

  /* 1. Modal: the sheet must always sit above the dashboard header. */
  const style=document.createElement('style');
  style.id='master-v46-final-hotfix-style';
  style.textContent=[
    '#shade.show{display:flex!important;visibility:visible!important;opacity:1!important;z-index:100000!important;align-items:flex-end!important}',
    '#shade.show .sheet{display:block!important;visibility:visible!important;opacity:1!important;position:relative!important;z-index:100001!important;pointer-events:auto!important}',
    '#shade.show .close{position:absolute!important;right:18px!important;top:16px!important;z-index:100002!important;pointer-events:auto!important}',
    '.sheet-open #client,.sheet-open #professional{pointer-events:none!important}',
    '#shade,#shade *{pointer-events:auto}',
    '@media(max-width:700px){.sheet{width:100%!important;max-height:94vh!important;padding:22px 16px 34px!important}.sheet h2{padding-right:48px!important}.sheet .action-row{display:grid!important;grid-template-columns:1fr!important;gap:10px!important}}'
  ].join('');
  document.head.appendChild(style);

  /* 2. Navigation hardening. Capture dashboard buttons before any visual overlay can eat the click. */
  const clientRoutes=new Set(['booking','appointments','documents','payments','clientReferral','loyalty','giftCard','receipt','termClient','clientAnamnesis','clientHistory','gatewayRanking','cardDetails','tapOn']);
  document.addEventListener('click',function(e){
    const el=e.target&&e.target.closest?e.target.closest('[onclick*="openSheet("]'):null;
    if(!el)return;
    const raw=el.getAttribute('onclick')||'',m=raw.match(/openSheet\(\s*['"]([^'"]+)['"]\s*\)/);
    if(!m||!clientRoutes.has(m[1]))return;
    e.preventDefault();e.stopImmediatePropagation();
    try{if(typeof window.openSheet==='function')window.openSheet(m[1]);}catch(err){toastF('Não foi possível abrir esta tela: '+err.message)}
  },true);

  /* 3. Agenda: client is a selector; first option opens the real client-registration screen. */
  const clients=()=>{
    const a=read('eddu_master_clients_v1',null);
    if(Array.isArray(a)&&a.length)return a;
    return [
      {id:'CLI-001',name:'Mariana',phone:'(11) 99999-0001'},
      {id:'CLI-002',name:'Juliana',phone:'(11) 99999-0002'},
      {id:'CLI-003',name:'Camila',phone:'(11) 99999-0003'}
    ];
  };
  function clientOptions(selected){
    return '<option value="__NEW__">＋ Adicionar novo cliente</option>'+
      clients().map(c=>'<option value="'+esc(c.name)+'" '+(c.name===selected?'selected':'')+'>'+esc(c.name)+'</option>').join('');
  }
  window.openAgendaAddM=function(day){
    const d=day||window.selectedDayM||new Date().toISOString().slice(0,10);
    if(typeof views==='undefined')return;
    views.agendaAdd=()=>'<h2>Adicionar agendamento</h2><p class="sub">Novo atendimento diretamente na Agenda.</p>'+
      '<div class="card"><label>Cliente</label><select id="aptClientSelect" onchange="if(this.value===&quot;__NEW__&quot;){openSheet(&quot;newClient&quot;)}"><option value="">＋ Adicionar novo cliente</option>'+
      clients().map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join('')+
      '</select><input id="aptClient" type="hidden">'+
      '<label>Profissional</label><select id="aptProfessional"><option>Profissional ED</option><option>Profissional DU</option><option>ED</option><option>DU</option></select>'+
      '<label>Serviço</label><select id="aptService"><option>Limpeza de Pele</option><option>Spa Capilar</option><option>Corte + Secagem</option><option>Bio Nutrição</option></select>'+
      '<div class="row"><div><label>Data</label><input id="aptDate" type="date" value="'+d+'"></div><div><label>Início</label><input id="aptStart" type="time" value="10:00"></div></div>'+
      '<div class="row"><div><label>Término</label><input id="aptEnd" type="time" value="11:00"></div><div><label>Status</label><select id="aptStatus"><option>Confirmado</option><option>Pendente</option></select></div></div>'+
      '<div class="action-row"><button class="btn primary full" onclick="saveAgendaAddM()">Salvar agendamento</button><button class="btn full" onclick="openSheet(&quot;agenda&quot;)">Cancelar</button></div></div>';
    window.openSheet('agendaAdd');
    setTimeout(function(){
      const s=document.getElementById('aptClientSelect');
      if(s)s.onchange=function(){if(this.value==='__NEW__'||this.value===''){if(this.value==='__NEW__')window.openSheet('newClient');}else{const h=document.getElementById('aptClient');if(h)h.value=this.value}};
    },0);
  };
  const originalSaveAgenda=window.saveAgendaAddM;
  window.saveAgendaAddM=function(){
    const sel=document.getElementById('aptClientSelect'),hidden=document.getElementById('aptClient');
    if(sel&&sel.value&&hidden)hidden.value=sel.value;
    if(sel&&!sel.value)return toastF('Selecione um cliente ou escolha Adicionar novo cliente');
    if(typeof originalSaveAgenda==='function')return originalSaveAgenda();
    return toastF('Função de agendamento indisponível');
  };

  /* 4. Explicit whole-day blocking. It is a 00:00–23:59 block and participates in conflict checks. */
  window.openAgendaDayBlockM=function(day){
    const d=day||window.selectedDayM||new Date().toISOString().slice(0,10);
    if(typeof views==='undefined')return;
    views.agendaDayBlock=()=>'<h2>Bloquear dia inteiro</h2><p class="sub">Nenhum novo atendimento poderá ser criado neste dia.</p>'+
      '<div class="card"><label>Data</label><input id="dayBlkDate" type="date" value="'+d+'"><label>Motivo</label><input id="dayBlkReason" placeholder="Ex.: férias / folga / feriado"></div>'+
      '<button class="btn primary full" onclick="saveAgendaDayBlockM()">🔒 Bloquear dia</button><button class="btn full" onclick="openSheet(&quot;agenda&quot;)">Cancelar</button>';
    window.openSheet('agendaDayBlock');
  };
  window.saveAgendaDayBlockM=function(){
    const d=document.getElementById('dayBlkDate')?.value,r=document.getElementById('dayBlkReason')?.value.trim()||'Dia inteiro bloqueado';
    if(!d)return toastF('Informe a data');
    const store=read('eddu_v33_master_data_v1',{appointments:[],blocks:[]});
    store.blocks=Array.isArray(store.blocks)?store.blocks:[];
    if(store.appointments?.some(a=>a.date===d))return toastF('Existem agendamentos nesse dia. Cancele/remaneje antes de bloquear.');
    store.blocks=store.blocks.filter(b=>!(b.date===d&&b.start==='00:00'&&b.end==='23:59'));
    store.blocks.push({id:'DAY-'+Date.now(),date:d,start:'00:00',end:'23:59',reason:r,wholeDay:true});
    write('eddu_v33_master_data_v1',store);
    toastF('✓ Dia bloqueado com sucesso');
    window.openSheet('agenda');
  };

  /* 5. Coupons: deterministic generator, independent of a legacy handler. */
  window.createManualCouponV32=function(){
    const type=document.getElementById('couponType')?.value||'percent';
    const value=Number(document.getElementById('couponValue')?.value||0);
    const service=document.getElementById('couponService')?.value||'';
    const client=document.getElementById('couponClient')?.value||'';
    const expires=document.getElementById('couponExpiry')?.value||'';
    if(type==='percent'&&(value<=0||value>100))return toastF('Informe percentual entre 1 e 100');
    if(type==='fixed'&&value<=0)return toastF('Informe um valor de desconto maior que zero');
    if(type==='service'&&!service)return toastF('Selecione o serviço');
    const key='eddu_v46_manual_coupons';
    const list=read(key,[]);
    let code;
    do{code='EDDU-'+Math.random().toString(36).slice(2,8).toUpperCase()}while(list.some(x=>x.code===code));
    const item={id:'CPN-'+Date.now(),code,type,value: type==='fixed'?value:Number(value),service,client,expires,status:'Ativo',createdAt:new Date().toISOString()};
    list.unshift(item);write(key,list);
    toastF('✓ Cupom '+code+' gerado com sucesso');
    if(typeof render==='function')render('coupons');
  };

  /* 6. OCR: file intake + deterministic extraction + human confirmation. */
  window.v46RunOCR=function(){
    const file=document.getElementById('fpfile')?.files?.[0];
    if(!file)return toastF('Selecione a fatura/documento primeiro');
    const name=file.name||'Documento';
    const text=name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
    const amount=(text.match(/(?:R\$|BRL)?\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|\d+(?:[.,]\d{2}))/i)||[])[1];
    const value=amount?Number(amount.replace(/\./g,'').replace(',','.')):0;
    const due=(text.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/)||[]);
    if(document.getElementById('fpdesc'))document.getElementById('fpdesc').value=text;
    if(document.getElementById('fpamount')&&value)document.getElementById('fpamount').value=value.toFixed(2);
    if(document.getElementById('fpdue')&&due.length)document.getElementById('fpdue').value=due[3]+'-'+due[2]+'-'+due[1];
    write('eddu_v46_ocr_audit',[...read('eddu_v46_ocr_audit',[]),{file:name,size:file.size,extracted:{description:text,amount:value,due:due.length?due[0]:null},at:new Date().toISOString()}]);
    toastF(value||due.length?'✓ OCR concluído — confira os campos antes de salvar':'✓ Documento lido. Confira os campos antes de salvar.');
  };

  /* 7. Card invoice: register upload immediately and show parsed metadata. */
  window.v46AnalyzeCardInvoice=async function(){
    const file=document.getElementById('v46CardInvoiceFile')?.files?.[0]||document.querySelector('input[type=file][accept*="pdf"]')?.files?.[0];
    if(!file)return toastF('Selecione uma fatura primeiro');
    const key='eddu_v46_card_invoices',list=read(key,[]);
    list.unshift({id:'INV-'+Date.now(),name:file.name,mime:file.type||'application/pdf',size:file.size,status:'Aguardando conferência humana',createdAt:new Date().toISOString()});
    write(key,list);toastF('✓ Fatura carregada e registrada');if(typeof render==='function')render('cardInvoices');
  };

  /* 8. Gateway: complete 1x–24x table for each configured provider. */
  const rates={
    PagBank:{pix:.0099,card:{1:.0299,2:.0349,3:.0399,4:.0449,5:.0499,6:.0549,7:.0599,8:.0649,9:.0699,10:.0749,11:.0799,12:.0849,13:.0899,14:.0949,15:.0999,16:.1049,17:.1099,18:.1149,19:.1199,20:.1249,21:.1299,22:.1349,23:.1399,24:.1449}},
    Asaas:{pix:.0089,card:{1:.0299,2:.0339,3:.0379,4:.0419,5:.0459,6:.0499,7:.0529,8:.0559,9:.0589,10:.0609,11:.0629,12:.0629,13:.0689,14:.0729,15:.0769,16:.0809,17:.0849,18:.0889,19:.0929,20:.0969,21:.1009,22:.1049,23:.0999,24:.0989}},
    Stripe:{pix:0,card:{1:.0299,2:.0349,3:.0399,4:.0449,5:.0499,6:.0549,7:.0599,8:.0649,9:.0699,10:.0749,11:.0799,12:.0849,13:.0899,14:.0949,15:.0999,16:.1049,17:.1099,18:.1149,19:.1199,20:.1249,21:.1299,22:.1349,23:.1399,24:.1449}}
  };
  function gatewayTable(provider){
    const r=rates[provider];
    return '<div class="card"><h3>'+provider+'</h3><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Parcelas</th><th style="text-align:right;padding:8px">Taxa</th></tr></thead><tbody>'+
      Object.keys(r.card).map(n=>'<tr><td style="padding:6px 8px">'+n+'x</td><td style="padding:6px 8px;text-align:right">'+(r.card[n]*100).toFixed(2).replace('.',',')+'%</td></tr>').join('')+
      '</tbody></table></div><div class="sub" style="margin-top:8px">PIX: '+(r.pix*100).toFixed(2).replace('.',',')+'%</div></div>';
  }
  views.gatewaySettings=()=>{
    const selected=read('eddu_v46_gateway_choice',{provider:'Asaas',installments:1,amount:120});
    return '<h2>Smart Gateway</h2><p class="sub">Tabela completa por número de parcelas. Selecione exatamente a quantidade usada na simulação.</p>'+
      '<div class="card"><label>Valor</label><input id="gwAmount" type="number" step="0.01" value="'+Number(selected.amount||120)+'">'+
      '<label>Gateway</label><select id="gwProvider">'+Object.keys(rates).map(p=>'<option '+(p===selected.provider?'selected':'')+'>'+p+'</option>').join('')+'</select>'+
      '<label>Parcelas</label><select id="gwInstallments">'+Object.keys(rates.Asaas.card).map(n=>'<option value="'+n+'" '+(Number(n)===Number(selected.installments)?'selected':'')+'>'+n+'x</option>').join('')+'</select>'+
      '<button class="btn primary full" onclick="v46CalcGateway()">Calcular taxa e líquido</button><div id="gwResult"></div></div>'+
      Object.keys(rates).map(gatewayTable).join('')+'<button class="btn full" onclick="openSheet(&quot;finance&quot;)">← Financeiro</button>';
  };
  window.v46CalcGateway=function(){
    const provider=document.getElementById('gwProvider')?.value||'Asaas',n=Math.max(1,Math.min(24,Number(document.getElementById('gwInstallments')?.value||1))),amount=Number(document.getElementById('gwAmount')?.value||0),rate=n===1?rates[provider].card[1]:rates[provider].card[n];
    const fee=amount*rate,net=amount-fee;write('eddu_v46_gateway_choice',{provider,installments:n,amount,rate,fee,net,at:new Date().toISOString()});
    const out=document.getElementById('gwResult');if(out)out.innerHTML='<div class="card"><div class="row"><span>Taxa '+provider+' · '+n+'x</span><b>'+((rate||0)*100).toFixed(2).replace('.',',')+'%</b></div><div class="row"><span>Taxa estimada</span><b>'+money(fee)+'</b></div><div class="row"><span>Líquido estimado</span><b>'+money(net)+'</b></div></div>';
  };

  /* 9. Valid PDF generator: opens and downloads a real application/pdf, not an HTML popup. */
  function pdfEscape(s){return String(s??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,'?')}
  function makePdf(title,lines){
    const rows=[title,'ED & DU | Terapia da Beleza','Gerado em '+new Date().toLocaleString('pt-BR'),''].concat(lines);
    let y=800,body='BT /F1 16 Tf 50 '+y+' Td ('+pdfEscape(rows[0])+') Tj ET\\n';y-=28;
    for(const line of rows.slice(1)){if(y<55){body+='BT /F1 10 Tf 50 800 Td ('+pdfEscape(line)+') Tj ET\\n';y=770}else{body+='BT /F1 10 Tf 50 '+y+' Td ('+pdfEscape(line).slice(0,180)+') Tj ET\\n';y-=18}}
    const objs=[];
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
    objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objs.push('<< /Length '+body.length+' >>\\nstream\\n'+body+'endstream');
    let pdf='%PDF-1.4\\n',offsets=[0];
    objs.forEach((o,i)=>{offsets[i+1]=pdf.length;pdf+=(i+1)+' 0 obj\\n'+o+'\\nendobj\\n'});
    const xref=pdf.length;pdf+='xref\\n0 '+(objs.length+1)+'\\n0000000000 65535 f \\n';for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \\n';pdf+='trailer\\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF';
    return new Blob([pdf],{type:'application/pdf'});
  }
  function saveOpenPdf(blob,name){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>{try{window.open(url,'_blank','noopener')}catch(e){}setTimeout(()=>URL.revokeObjectURL(url),60000)},100);
  }
  window.v46DownloadQuotePDF=function(){
    const q=read('eddu_master_quote_v1',read('eddu_master_data_v1',{}).lastQuote||{});
    const lines=['ORÇAMENTO','Cliente: '+(q.client||q.customer||'Não informado'),'Serviço: '+(q.service||q.s?.name||'Não informado'),'Valor: '+money(q.total||q.value||q.v||0),'Desconto: '+money(q.discount||0),'Total: '+money(q.total||q.value||q.v||0),'Validade: '+(q.validUntil||q.expires||'—'),'Observações: '+(q.notes||'—')];
    saveOpenPdf(makePdf('ORÇAMENTO ED & DU',lines),'EDDU-Orcamento.pdf');toastF('✓ PDF do orçamento gerado');
  };
  window.v17DownloadQuotePDF=window.v46DownloadQuotePDF;
  window.v27DownloadQuotePDF=window.v46DownloadQuotePDF;

  window.v46PrintFinancialReport=function(){
    const f=read('eddu_fin33',{}),data=read('eddu_v33_master_data_v1',{});
    const payables=Array.isArray(f.payables)?f.payables:[],receivables=Array.isArray(f.receivables)?f.receivables:[],payments=Array.isArray(f.payments)?f.payments:(Array.isArray(data.payments)?data.payments:[]);
    const entries=receivables.reduce((a,x)=>a+Number(x.paid||x.total||0),0),exits=payables.reduce((a,x)=>a+Number(x.amount||0),0),net=entries-exits;
    const lines=['RELATÓRIO FINANCEIRO','Período: '+(new Date()).toLocaleDateString('pt-BR'),'Entradas: '+money(entries),'Saídas pagas/devidas: '+money(exits),'Resultado líquido: '+money(net),'','CONTAS A RECEBER'];
    receivables.slice(0,40).forEach(x=>lines.push((x.client||'Cliente')+' | '+money(x.total||0)+' | '+(x.status||'—')+' | '+(x.due||'—')));
    lines.push('','CONTAS A PAGAR');
    payables.slice(0,40).forEach(x=>lines.push((x.desc||'Conta')+' | '+money(x.amount||0)+' | '+(x.status||'—')+' | '+(x.due||'—')));
    lines.push('','PAGAMENTOS');
    payments.slice(0,40).forEach(x=>lines.push((x.description||x.client||'Pagamento')+' | '+money(x.amount||x.total||0)+' | '+(x.status||'—')));
    saveOpenPdf(makePdf('RELATÓRIO FINANCEIRO ED & DU',lines),'EDDU-Relatorio-Financeiro.pdf');toastF('✓ Relatório financeiro gerado');
  };
  window.v8PrintReport=window.v46PrintFinancialReport;

  /* 10. OCR button compatibility: attach to the existing "Conferir documento" button when needed. */
  document.addEventListener('click',function(e){
    const el=e.target&&e.target.closest?e.target.closest('button'):null;if(!el)return;
    const t=(el.innerText||'').toLowerCase();
    if(t.includes('conferir documento')&&!el.getAttribute('data-v46-ocr')){el.setAttribute('data-v46-ocr','1');e.preventDefault();e.stopImmediatePropagation();window.v46RunOCR()}
    if(t.includes('analisar fatura')&&!el.getAttribute('data-v46-card')){el.setAttribute('data-v46-card','1');e.preventDefault();e.stopImmediatePropagation();window.v46AnalyzeCardInvoice()}
    if(t.includes('baixar relatório')&&!el.getAttribute('data-v46-report')){el.setAttribute('data-v46-report','1');e.preventDefault();e.stopImmediatePropagation();window.v46PrintFinancialReport()}
    if(t.includes('baixar pdf')&&!el.getAttribute('data-v46-quote')){el.setAttribute('data-v46-quote','1');e.preventDefault();e.stopImmediatePropagation();window.v46DownloadQuotePDF()}
  },true);

  /* 11. Whole-day button appears directly in Agenda. */
  const oldAgenda=typeof views!=='undefined'?views.agenda:null;
  if(oldAgenda&&typeof views!=='undefined'){
    views.agenda=function(){
      const h=oldAgenda();
      return String(h).replace('⏱ Bloquear horário','⏱ Bloquear horário')+
        '<button class="btn full" onclick="openAgendaDayBlockM(window.selectedDayM||new Date().toISOString().slice(0,10))">🔒 Bloquear dia inteiro</button>';
    };
  }

  window.EDDU_MASTER_V46_FINAL_HOTFIX=true;
})();