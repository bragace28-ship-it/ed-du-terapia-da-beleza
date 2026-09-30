/* ED & DU MASTER V46 — final homologation hardening */
(function(){
'use strict';
const toastF=window.toast||function(m){alert(m)};
const esc=function(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
const money=function(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0)};
const read=function(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(e){return d}};
const write=function(k,v){localStorage.setItem(k,JSON.stringify(v))};

function ascii(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'')}
function pdfEscape(v){return ascii(v).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function makePdf(title,lines){
  var perPage=44,pages=[],i;
  for(i=0;i<lines.length;i+=perPage)pages.push(lines.slice(i,i+perPage));
  if(!pages.length)pages.push([]);
  var objs=[];
  objs[0]='<< /Type /Catalog /Pages 2 0 R >>';
  objs[1]='<< /Type /Pages /Kids ['+pages.map(function(_,n){return (4+n*2)+' 0 R'}).join(' ')+'] /Count '+pages.length+' >>';
  objs[2]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  pages.forEach(function(pg,n){
    var pageNo=4+n*2,contentNo=pageNo+1;
    var cmds=['BT','/F1 18 Tf','50 790 Td','('+pdfEscape(title)+') Tj','/F1 9 Tf','0 -22 Td'];
    if(pages.length>1)cmds.push('('+pdfEscape('Pagina '+(n+1)+' de '+pages.length)+') Tj','0 -18 Td');
    pg.forEach(function(line){cmds.push('('+pdfEscape(String(line).slice(0,180))+') Tj','0 -15 Td')});
    cmds.push('ET');
    var stream=cmds.join('\n');
    objs[pageNo-1]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents '+contentNo+' 0 R >>';
    objs[contentNo-1]='<< /Length '+new TextEncoder().encode(stream).length+' >>\nstream\n'+stream+'\nendstream';
  });
  var out='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',offsets=[0];
  for(i=0;i<objs.length;i++){offsets[i+1]=new TextEncoder().encode(out).length;out+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n'}
  var xref=new TextEncoder().encode(out).length;
  out+='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
  for(i=1;i<=objs.length;i++)out+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  out+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return new Blob([out],{type:'application/pdf'});
}
function downloadBlob(blob,name){var url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000)}

function financialLines(){
  var d=window.data||read('eddu_data',{}),f=(window.state&&window.state.financial)||read('eddu_state',{financial:{}}).financial||{};
  var ap=Array.isArray(d.appointments)?d.appointments:[],pay=Array.isArray(d.payables)?d.payables:[],rec=Array.isArray(d.receivables)?d.receivables:[],commands=Array.isArray(d.commands)?d.commands:[];
  var received=rec.reduce(function(a,x){return a+Number(x.paid||x.amount||0)},0),outgoing=pay.filter(function(x){return x.status==='Paga'||x.status==='Pago'}).reduce(function(a,x){return a+Number(x.amount||0)},0),openPay=pay.filter(function(x){return x.status!=='Paga'&&x.status!=='Pago'}).reduce(function(a,x){return a+Number(x.amount||0)},0),sales=commands.reduce(function(a,x){return a+Number(x.netAmount||x.total||x.amount||0)},0);
  var lines=['ED & DU | TERAPIA DA BELEZA','RELATORIO FINANCEIRO COMPLETO','Gerado em: '+new Date().toLocaleString('pt-BR'),'','RESUMO EXECUTIVO','Recebimentos registrados: '+money(received),'Saidas pagas: '+money(outgoing),'Resultado realizado: '+money(received-outgoing),'Contas a pagar em aberto: '+money(openPay),'Vendas/comandas registradas: '+money(sales),'Descontos fidelidade: '+money(f.loyaltyDiscounts||0),'','AGENDA','Agendamentos registrados: '+ap.length,'','CONTAS A PAGAR'];
  pay.slice(0,80).forEach(function(x){lines.push((x.due||'-')+' | '+(x.status||'-')+' | '+ascii(x.desc||x.origin||'Conta')+' | '+money(x.amount))});
  lines.push('','CONTAS A RECEBER');
  rec.slice(0,80).forEach(function(x){lines.push((x.due||'-')+' | '+(x.status||'-')+' | '+ascii(x.client||'Cliente')+' | '+money(x.paid||x.amount||0))});
  lines.push('','ANALISE','Documento gerado a partir dos lancamentos disponiveis na homologacao. Conferir valores antes do uso contabil.');
  return lines;
}
window.v46DownloadFinancialPDF=function(){downloadBlob(makePdf('ED & DU | Relatorio Financeiro',financialLines()),'ED_DU_Relatorio_Financeiro.pdf');toastF('✓ Relatório financeiro PDF gerado.')};
window.v8PrintReport=window.v46DownloadFinancialPDF;

window.v46DownloadQuotePDF=function(){
  var q=read('eddu_state',{}).lastQuote||read('eddu_data',{}).lastQuote||(window.state&&window.state.lastQuote);
  if(!q)return toastF('Crie o orçamento primeiro.');
  var lines=['ED & DU | TERAPIA DA BELEZA','ORCAMENTO','','Cliente: '+ascii(q.client||'Nao informado'),'Servico: '+ascii(q.service||'-'),'Tamanho: '+ascii(q.length||'-'),'Valor: '+money(q.finalValue||q.total||0),'Validade: '+ascii(q.validUntil||'-'),''];
  if(q.notes)lines.push('Observacoes: '+ascii(q.notes),'');
  lines.push('Obrigado por escolher a ED & DU | Terapia da Beleza.');
  downloadBlob(makePdf('ED & DU | Orcamento',lines),'ED_DU_Orcamento_'+ascii(q.id||Date.now())+'.pdf');toastF('✓ Orçamento PDF gerado.');
};
window.v17DownloadQuotePDF=window.v46DownloadQuotePDF;

window.createManualCoupon=function(){
  var type=document.getElementById('couponType')?.value||'percent',value=Number(document.getElementById('couponValue')?.value||0),service=document.getElementById('couponService')?.value||'',client=(document.getElementById('couponClient')?.value||'').trim(),expires=document.getElementById('couponExpiry')?.value||'';
  if(type==='percent'&&!(value>0&&value<=100))return toastF('Informe percentual entre 1 e 100.');
  if(type==='fixed'&&!(value>0))return toastF('Informe um valor de desconto maior que zero.');
  if(type==='service'&&!service)return toastF('Selecione o serviço.');
  var st=window.state||read('eddu_state',{});st.coupons=Array.isArray(st.coupons)?st.coupons:[];var used=new Set(st.coupons.map(function(x){return x.code})),code='',tries=0;
  do{code='EDDU-'+Math.random().toString(36).slice(2,8).toUpperCase();tries++}while(used.has(code)&&tries<100);
  if(used.has(code))return toastF('Não foi possível gerar um código único. Tente novamente.');
  st.coupons.push({id:'C-'+Date.now(),code:code,type:type,value:value,service:service,client:client,status:'Disponível',expiresAt:expires,source:'Manual',createdAt:new Date().toISOString()});window.state=st;write('eddu_state',st);
  if(typeof window.persist==='function')try{window.persist()}catch(e){}
  if(typeof window.render==='function')window.render('coupons');toastF('✓ Cupom '+code+' gerado com sucesso.');
};

var ensureUserPerms=function(){if(typeof window.renderUserPermsV20!=='function')return;if(!document.getElementById('u20permchecks'))return;window.__u20perms=window.__u20perms||[];window.renderUserPermsV20()};
var oldOpenUserEdit=window.openUserEditV20;
window.openUserEditV20=function(id){if(typeof oldOpenUserEdit==='function')oldOpenUserEdit(id);setTimeout(ensureUserPerms,50);setTimeout(ensureUserPerms,180)};

function clientNames(){var a=(window.data&&window.data.clients)||(window.state&&window.state.clients)||read('eddu_data',{}).clients||read('eddu_state',{}).clients||[];var n=a.map(function(x){return typeof x==='string'?x:(x.name||x.fullName||'')}).filter(Boolean);return [...new Set(['Mariana','Juliana','Camila','Renata','Paula','Fernanda'].concat(n))]}
window.v46OpenNewClientFromAgenda=function(){if(typeof window.openSheet==='function')window.openSheet('newClient')};
var oldOpenAgendaAdd=window.openAgendaAddM;
window.openAgendaAddM=function(day){
  var d=day||new Date().toISOString().slice(0,10),names=clientNames();
  window.views=window.views||{};
  window.views.agendaAdd=function(){return '<h2>Adicionar agendamento</h2><p class="sub">Novo atendimento diretamente na Agenda.</p><div class="card"><label>Cliente</label><select id="aptClient"><option value="__NEW__">＋ Adicionar novo cliente</option>'+names.map(function(n){return '<option value="'+esc(n)+'">'+esc(n)+'</option>'}).join('')+'</select><label>Profissional</label><select id="aptProfessional">'+(typeof professionalOptionsM==='function'?professionalOptionsM('Profissional ED'):'<option>Profissional ED</option>')+'</select><label>Serviço</label><select id="aptService">'+(typeof serviceOptionsM==='function'?serviceOptionsM('Limpeza de Pele'):'<option>Limpeza de Pele</option>')+'</select><div class="row"><div><label>Data</label><input id="aptDate" type="date" value="'+d+'"></div><div><label>Início</label><input id="aptStart" type="time" value="10:00"></div></div><div class="row"><div><label>Término</label><input id="aptEnd" type="time" value="11:00"></div><div><label>Status</label><select id="aptStatus"><option>Confirmado</option><option>Pendente</option></select></div></div><div class="action-row"><button class="btn primary full" onclick="saveAgendaAddM()">Salvar agendamento</button><button class="btn full" onclick="openSheet(\'agenda\')">Cancelar</button></div></div>'};
  openSheet('agendaAdd');setTimeout(function(){var s=document.getElementById('aptClient');if(s)s.onchange=function(){if(s.value==='__NEW__')v46OpenNewClientFromAgenda()}},50);
};
var oldSaveAgendaAdd=window.saveAgendaAddM;
window.saveAgendaAddM=function(){var s=document.getElementById('aptClient');if(s?.value==='__NEW__')return v46OpenNewClientFromAgenda();if(typeof oldSaveAgendaAdd==='function')return oldSaveAgendaAdd()};

window.v46BlockWholeDay=function(day){
  var d=day||new Date().toISOString().slice(0,10),blocks=window.data?.blocks||[],apps=window.data?.appointments||[];
  if(blocks.some(function(b){return b.date===d&&(b.wholeDay||((b.start==='00:00'||b.start==='00:00:00')&&(b.end==='23:59'||b.end==='23:59:59')))}))return toastF('Este dia já está bloqueado.');
  if(apps.some(function(a){return a.date===d&&a.status!=='Cancelado'}))return toastF('Existem agendamentos neste dia. Cancele ou mova-os antes de bloquear o dia inteiro.');
  if(window.data){window.data.blocks=Array.isArray(window.data.blocks)?window.data.blocks:[];window.data.blocks.push({id:'DAY-'+Date.now(),date:d,start:'00:00',end:'23:59',wholeDay:true,reason:'Dia inteiro bloqueado'});if(typeof window.persist==='function')window.persist();else write('eddu_data',window.data)}
  toastF('✓ Dia inteiro bloqueado.');if(typeof window.render==='function')setTimeout(function(){window.render('agenda')},100)
};
if(window.views&&typeof window.views.agenda==='function'){
  var oldAgendaView=window.views.agenda;
  window.views.agenda=function(){
    var h=String(oldAgendaView()),needle='Bloquear horário</button>';
    if(h.indexOf('Bloquear dia')<0)h=h.replace(needle,needle+'<button class="btn" onclick="v46BlockWholeDay()">📅 Bloquear dia</button>');
    return h;
  };
}

window.v46StoreCardInvoiceFile=function(){
  var input=document.getElementById('v46CardInvoiceFile'),file=input?.files?.[0];if(!file)return toastF('Selecione uma fatura primeiro.');
  var reader=new FileReader();reader.onload=function(){var arr=read('eddu_v46_card_invoices',[]);arr.unshift({id:'INV-'+Date.now(),name:file.name,mime:file.type,size:file.size,dataUrl:reader.result,status:'Aguardando conferência humana',createdAt:new Date().toISOString()});write('eddu_v46_card_invoices',arr);toastF('✓ Fatura carregada e registrada.');if(typeof openSheet==='function')openSheet('cardInvoices')};reader.readAsDataURL(file)
};
window.v46AnalyzeCardInvoice=window.v46StoreCardInvoiceFile;
var oldCardView=window.views?.cardInvoices;
if(window.views&&typeof oldCardView==='function')window.views.cardInvoices=function(){return String(oldCardView()).replace(/onclick="v46AnalyzeCardInvoice\(\)"/g,'onclick="v46StoreCardInvoiceFile()"')};

var gatewayRates={PagBank:{pix:0.0099,1:0.0299,12:0.0849,24:0.1449},Asaas:{pix:0.0089,1:0.0299,12:0.0629,24:0.0989},Stripe:{pix:null,1:0.0299,12:0.0699,24:null}};
function rateCell(g,n){var r=gatewayRates[g]?.[n];return r==null?'—':(r*100).toFixed(2).replace('.',',')+'%'}
window.v46GatewayTable=function(){
  return '<h2>Smart Gateway — tabela completa</h2><p class="sub">Selecione exatamente a quantidade de parcelas. “—” significa taxa não cadastrada/verificada para aquele gateway; nenhuma outra parcela será usada como substituta.</p><div class="card"><label>Parcelas</label><select id="v46GwInst" onchange="renderGatewayRateRows()">'+[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(function(n){return '<option value="'+n+'">'+n+'x</option>'}).join('')+'</select></div><div id="v46GatewayRows"></div><div class="card"><b>Taxas homologadas disponíveis</b><p class="sub">PagBank: Pix 0,99%, 1x 2,99%, 12x 8,49%, 24x 14,49%. Asaas: Pix 0,89%, 1x 2,99%, 12x 6,29%, 24x 9,89%. Stripe: 1x 2,99%, 12x 6,99%.</p></div><button class="btn full" onclick="openSheet(\'gatewaySettings\')">← Smart Gateway</button>'
};
window.renderGatewayRateRows=function(){var n=Number(document.getElementById('v46GwInst')?.value||1),out=document.getElementById('v46GatewayRows');if(!out)return;out.innerHTML='<div class="card"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px">Gateway</th><th style="padding:8px">Taxa '+n+'x</th><th style="padding:8px">Situação</th></tr></thead><tbody>'+Object.keys(gatewayRates).map(function(g){var r=rateCell(g,n);return '<tr><td style="padding:8px"><b>'+g+'</b></td><td style="padding:8px;text-align:right">'+r+'</td><td style="padding:8px">'+(r==='—'?'Cadastrar/verificar':'Disponível')+'</td></tr>'}).join('')+'</tbody></table></div>'};
if(window.views)window.views.gatewayRankingV46=window.v46GatewayTable;

var css=document.createElement('style');css.textContent='#shade.show{z-index:100000!important}#shade.show .sheet{position:relative!important;z-index:100001!important;margin-top:0!important;max-height:calc(100vh - 24px)!important;overflow:auto!important}#shade.show .close{position:sticky!important;top:8px!important;right:8px!important;z-index:100010!important;float:right!important}.sheet-open #shade{z-index:100000!important}.sheet-open #client header,.sheet-open #professional header,.sheet-open .topbar,.sheet-open .app-header{z-index:1!important}';document.head.appendChild(css);
window.EDDU_MASTER_V46_HARDENING=true;
})();