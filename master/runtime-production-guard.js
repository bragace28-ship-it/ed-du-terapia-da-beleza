/* ED & DU — production data guard
   Production-only: never present local/demo seed values as live business data.
*/
(function(){
'use strict';
if(window.__EDDU_PRODUCTION_BUILD__!==true)return;
const views=window.views||(typeof globalThis.views!=='undefined'?globalThis.views:{});
window.views=views;
const data=()=>window.data||{};
const rows=(...keys)=>{for(const k of keys){const v=data()[k];if(Array.isArray(v))return v;}return[];};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const dt=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('pt-BR'):'Data não informada';};
const empty=(title,detail,action='')=>'<div class="card"><b>'+esc(title)+'</b><p class="sub">'+esc(detail)+'</p>'+action+'</div>';
const appointments=()=>rows('appointments').slice().sort((a,b)=>new Date(a.starts_at||0)-new Date(b.starts_at||0));
const clients=()=>rows('clients');
const professionals=()=>rows('professionals');
const services=()=>rows('services');
const transactions=()=>rows('financialTransactions','financial_transactions');
const commands=()=>rows('commands');
const txDirection=t=>String(t.direction||t.type||'').toLowerCase();
const isOutgoing=t=>/(out|expense|payable|saida|saída|despesa|debit)/i.test(txDirection(t));
const isPaid=t=>Boolean(t.paid_at)||/(paid|pago|confirmado|liquidado|conciliado|settled)/i.test(String(t.status||''));
const clientFor=id=>clients().find(x=>String(x.id)===String(id));
const professionalFor=id=>professionals().find(x=>String(x.id)===String(id));
const serviceFor=id=>services().find(x=>String(x.id)===String(id));
const clientLabel=id=>clientFor(id)?.name||'Cliente não identificado';
const serviceLabel=id=>serviceFor(id)?.name||'Serviço não identificado';
const professionalLabel=id=>professionalFor(id)?.name||'Profissional não identificado';
const action=(label,onclick)=>'<button class="btn primary full" type="button" onclick="'+onclick+'">'+esc(label)+'</button>';

views.agenda=function(){
 const ap=appointments(),blocks=rows('blocks','agendaBlocks');
 const list=ap.length?ap.map(a=>'<div class="option"><span><b>'+esc(serviceLabel(a.service_id))+'</b><small>'+esc(clientLabel(a.client_id))+' · '+esc(professionalLabel(a.professional_id))+'<br>'+esc(dt(a.starts_at))+' · '+esc(a.status||'Pendente')+'</small></span><button class="btn" type="button" onclick="window.__EDDU_SELECTED_APPOINTMENT_ID=\''+esc(a.id)+'\';window.openSheet(\'appointmentDetail\')">Abrir</button></div>').join(''):empty('Nenhum agendamento sincronizado.','A agenda será preenchida somente com registros confirmados no Neon.');
 const blockHtml=blocks.length?'<h3>Bloqueios</h3>'+blocks.map(b=>'<div class="option"><span><b>'+esc(b.reason||'Horário bloqueado')+'</b><small>'+esc(dt(b.starts_at))+' — '+esc(dt(b.ends_at))+'</small></span></div>').join(''):'';
 return '<h2>Minha agenda</h2><p class="sub">Agenda sincronizada com o Neon. Nenhum atendimento de demonstração é exibido.</p><div class="action-row">'+action('Adicionar agendamento','window.openAgendaAddM&&window.openAgendaAddM()')+action('Bloquear dia inteiro','window.openAgendaBlockDayM&&window.openAgendaBlockDayM()')+'</div><h3>Agendamentos</h3>'+list+blockHtml;
};
views.appointments=function(){
 const ap=appointments();
 return '<h2>Agendamentos</h2><p class="sub">Somente registros gravados no servidor.</p>'+action('Novo agendamento','window.openAgendaAddM&&window.openAgendaAddM()')+(ap.length?ap.map(a=>'<div class="option"><span><b>'+esc(serviceLabel(a.service_id))+'</b><small>'+esc(clientLabel(a.client_id))+' · '+esc(dt(a.starts_at))+' · '+esc(a.status||'Pendente')+'</small></span><button class="btn" onclick="window.__EDDU_SELECTED_APPOINTMENT_ID=\''+esc(a.id)+'\';window.openSheet(\'appointmentDetail\')">Detalhes</button></div>').join(''):empty('Nenhum agendamento confirmado.','Os atendimentos aparecerão aqui após a confirmação no Neon.'));
};
views.appointmentDetail=function(){
 const a=appointments().find(x=>String(x.id)===String(window.__EDDU_SELECTED_APPOINTMENT_ID));
 if(!a)return '<h2>Detalhes do agendamento</h2>'+empty('Nenhum agendamento selecionado.','Abra um registro existente na agenda.');
 return '<h2>Detalhes do agendamento</h2><div class="card"><b>'+esc(serviceLabel(a.service_id))+'</b><p>'+esc(clientLabel(a.client_id))+'</p><p>'+esc(professionalLabel(a.professional_id))+'</p><p>'+esc(dt(a.starts_at))+' — '+esc(dt(a.ends_at))+'</p><p>Status: '+esc(a.status||'Pendente')+'</p></div><button class="btn full" onclick="window.openSheet(\'agenda\')">Voltar à agenda</button>';
};
views.clients=function(){
 const cs=clients();
 return '<h2>Clientes</h2><p class="sub">Cadastro real sincronizado com o Neon.</p>'+(cs.length?cs.map(c=>'<div class="option"><span><b>'+esc(c.name||'Cliente')+'</b><small>'+esc(c.phone||c.email||'Sem contato cadastrado')+'</small></span><button class="btn" onclick="window.__EDDU_SELECTED_CLIENT_ID=\''+esc(c.id)+'\';window.openSheet(\'clientFile\')">Abrir</button></div>').join(''):empty('Nenhum cliente cadastrado.','Cadastre o primeiro cliente para iniciar o relacionamento.'))+action('+ Novo cliente','window.openSheet(\'clientRegistration\')');
};
views.clientFile=function(){
 const c=clients().find(x=>String(x.id)===String(window.__EDDU_SELECTED_CLIENT_ID));
 if(!c)return '<h2>Ficha do cliente</h2>'+empty('Nenhum cliente selecionado.','Abra um cliente cadastrado no servidor.');
 return '<h2>'+esc(c.name||'Ficha do cliente')+'</h2><div class="card"><p>Telefone: '+esc(c.phone||'Não informado')+'</p><p>E-mail: '+esc(c.email||'Não informado')+'</p><p>Observações: '+esc(c.notes||'Nenhuma observação registrada')+'</p><p>Pontos de fidelidade: '+Number(c.loyalty_points||0)+'</p></div>'+action('Ver anamnese','window.openSheet(\'clientAnamnesis\')')+action('Voltar aos clientes','window.openSheet(\'clients\')');
};
views.booking=function(){
 return '<h2>Novo agendamento</h2><p class="sub">O agendamento só será confirmado depois da validação de disponibilidade e gravação no Neon.</p>'+action('Abrir formulário seguro da agenda','window.openAgendaAddM&&window.openAgendaAddM()');
};
views.reports=function(){
 const tx=transactions(),paid=tx.filter(isPaid),income=paid.filter(t=>!isOutgoing(t)).reduce((s,t)=>s+Number(t.amount||0),0),expense=paid.filter(isOutgoing).reduce((s,t)=>s+Number(t.amount||0),0);
 return '<h2>Relatórios</h2><p class="sub">Indicadores calculados a partir de lançamentos financeiros persistidos no Neon.</p><div class="grid"><div class="card"><small>Entradas pagas</small><h3>'+money(income)+'</h3></div><div class="card"><small>Saídas pagas</small><h3>'+money(expense)+'</h3></div><div class="card"><small>Resultado</small><h3>'+money(income-expense)+'</h3></div><div class="card"><small>Agendamentos</small><h3>'+appointments().length+'</h3></div></div>'+(tx.length?'<div class="card">'+tx.map(t=>'<div class="option"><span><b>'+esc(t.description||t.type||'Lançamento')+'</b><small>'+esc(t.status||'Pendente')+' · '+esc(t.due_date||'')+'</small></span><b>'+money(t.amount)+'</b></div>').join('')+'</div>':empty('Nenhum lançamento financeiro sincronizado.','O relatório não utiliza valores de demonstração.'));
};
views.performance=function(){
 const tx=transactions().filter(isPaid).filter(t=>!isOutgoing(t)),gross=tx.reduce((s,t)=>s+Number(t.amount||0),0),ap=appointments(),cs=clients();
 const goal=Number(data().settings?.monthly_goal||data().settings?.monthlyGoal||7000),pct=goal>0?Math.min(100,Math.round(gross/goal*100)):0;
 return '<h2>Desempenho comercial</h2><p class="sub">Indicadores reais do banco de dados.</p><div class="grid"><div class="card"><small>Vendas confirmadas</small><h3>'+money(gross)+'</h3></div><div class="card"><small>Meta</small><h3>'+money(goal)+'</h3></div><div class="card"><small>Meta atingida</small><h3>'+pct+'%</h3></div><div class="card"><small>Clientes ativos</small><h3>'+cs.filter(x=>x.active!==false).length+'</h3></div><div class="card"><small>Agendamentos</small><h3>'+ap.length+'</h3></div><div class="card"><small>Ticket médio</small><h3>'+money(tx.length?gross/tx.length:0)+'</h3></div></div>';
};
views.payments=function(){
 const tx=transactions();
 return '<h2>Pagamentos</h2><p class="sub">Status retornado pelos lançamentos do Neon e webhooks.</p>'+(tx.length?tx.map(t=>'<div class="option"><span><b>'+esc(t.description||t.type||'Pagamento')+'</b><small>'+esc(t.status||'Pendente')+' · '+esc(t.paid_at?dt(t.paid_at):t.due_date||'Sem data')+'</small></span><button class="btn" onclick="window.__EDDU_SELECTED_TRANSACTION_ID=\''+esc(t.id)+'\';window.openSheet(\'receipt\')">Comprovante</button></div>').join(''):empty('Nenhum pagamento registrado.','Nenhum pagamento será presumido sem retorno do gateway e registro no Neon.'));
};
views.receipt=function(){
 const t=transactions().find(x=>String(x.id)===String(window.__EDDU_SELECTED_TRANSACTION_ID));
 if(!t)return '<h2>Comprovante</h2>'+empty('Nenhum pagamento selecionado.','Selecione um lançamento existente.');
 return '<h2>Comprovante</h2><div class="card"><b>'+esc(t.description||'Pagamento')+'</b><p>Valor: '+money(t.amount)+'</p><p>Status: '+esc(t.status||'Pendente')+'</p><p>Data: '+esc(t.paid_at?dt(t.paid_at):t.due_date||'Não informada')+'</p></div>';
};
views.payables=function(){
 const tx=transactions().filter(isOutgoing);
 return '<h2>Contas a pagar</h2>'+(tx.length?tx.map(t=>'<div class="option"><span><b>'+esc(t.description||'Despesa')+'</b><small>'+esc(t.status||'Pendente')+' · '+esc(t.due_date||'')+'</small></span><b>'+money(t.amount)+'</b></div>').join(''):empty('Nenhuma conta a pagar sincronizada.','Não há despesas reais registradas no Neon.'));
};
views.receivables=function(){
 const tx=transactions().filter(t=>!isOutgoing(t));
 return '<h2>Contas a receber</h2>'+(tx.length?tx.map(t=>'<div class="option"><span><b>'+esc(t.description||'Recebimento')+'</b><small>'+esc(t.status||'Pendente')+' · '+esc(t.due_date||'')+'</small></span><b>'+money(t.amount)+'</b></div>').join(''):empty('Nenhuma conta a receber sincronizada.','Não há recebíveis reais registrados no Neon.'));
};
views.command=function(){
 const cs=commands();
 return '<h2>Comandas</h2><p class="sub">Comandas persistidas no Neon.</p>'+(cs.length?cs.map(c=>'<div class="option"><span><b>Comanda '+esc(c.id)+'</b><small>'+esc(c.status||'Aberta')+' · '+esc(clientLabel(c.client_id))+'</small></span><b>'+money(c.total)+'</b></div>').join(''):empty('Nenhuma comanda aberta.','As comandas aparecerão após serem gravadas no servidor.'));
};
views.clientReferral=views.referralsPro;
views.loyalty=function(){const c=clients().find(x=>String(x.id)===String(window.__EDDU_SELECTED_CLIENT_ID));return '<h2>Fidelidade</h2>'+(c?'<div class="card"><b>'+esc(c.name)+'</b><p>Pontos registrados: '+Number(c.loyalty_points||0)+'</p></div>':empty('Nenhum cliente selecionado.','Selecione um cliente cadastrado para consultar os pontos.'));};
views.clientHistory=function(){const c=clients().find(x=>String(x.id)===String(window.__EDDU_SELECTED_CLIENT_ID));if(!c)return '<h2>Histórico do cliente</h2>'+empty('Nenhum cliente selecionado.','Abra um cliente cadastrado.');const ap=appointments().filter(a=>String(a.client_id)===String(c.id));return '<h2>Histórico de '+esc(c.name)+'</h2>'+(ap.length?ap.map(a=>'<div class="option"><span><b>'+esc(serviceLabel(a.service_id))+'</b><small>'+esc(dt(a.starts_at))+' · '+esc(a.status||'Pendente')+'</small></span></div>').join(''):empty('Nenhum atendimento registrado.','O histórico será preenchido com agendamentos persistidos.'));};
views.documents=function(){return '<h2>Documentos</h2>'+empty('Nenhum documento sincronizado.','Os documentos serão exibidos quando o armazenamento estiver conectado ao Neon.');};
views.finance=function(){const tx=transactions(),paid=tx.filter(isPaid),income=paid.filter(t=>!isOutgoing(t)).reduce((s,t)=>s+Number(t.amount||0),0),expense=paid.filter(isOutgoing).reduce((s,t)=>s+Number(t.amount||0),0);return '<h2>Financeiro</h2><p class="sub">Valores derivados de lançamentos persistidos.</p><div class="grid"><div class="card"><small>Entradas pagas</small><h3>'+money(income)+'</h3></div><div class="card"><small>Saídas pagas</small><h3>'+money(expense)+'</h3></div><div class="card"><small>Saldo</small><h3>'+money(income-expense)+'</h3></div></div>'+action('Pagamentos','window.openSheet(\'payments\')')+action('Contas a pagar','window.openSheet(\'payables\')')+action('Contas a receber','window.openSheet(\'receivables\')')+action('Relatórios','window.openSheet(\'reports\')');};
views.referralsPro=function(){
 const rs=rows('referrals');
 return '<h2>Indicações</h2>'+(rs.length?rs.map(r=>'<div class="option"><span><b>'+esc(r.referred_name||'Indicação')+'</b><small>'+esc(r.status||'Pendente')+' · '+esc(r.referred_phone||'')+'</small></span></div>').join(''):empty('Nenhuma indicação registrada.','Não há indicações de demonstração.'));
};
views.clientAnamnesis=function(){
 const as=rows('anamneses'),c=clients().find(x=>String(x.id)===String(window.__EDDU_SELECTED_CLIENT_ID));
 const filtered=c?as.filter(x=>String(x.client_id)===String(c.id)):as;
 return '<h2>Anamnese</h2>'+(filtered.length?filtered.map(a=>'<div class="card"><b>'+esc(clientLabel(a.client_id))+'</b><p>Objetivo: '+esc(a.objective||'Não informado')+'</p><p>Análise: '+esc(a.analysis||'Não informada')+'</p></div>').join(''):empty('Nenhuma anamnese registrada.','Os dados clínicos só aparecerão após gravação no Neon.'));
};
views.termClient=function(){return '<h2>Termos e documentos</h2>'+empty('Nenhum termo eletrônico sincronizado.','O armazenamento e a assinatura de termos ainda precisam de integração persistente no servidor.');};
views.beforeAfterGallery=function(){return '<h2>Antes e depois</h2>'+empty('Nenhuma foto sincronizada.','A galeria não exibirá imagens de demonstração como se fossem registros de clientes.');};
views.cardInvoices=function(){return '<h2>Faturas de cartão</h2>'+empty('Integração de faturas pendente.','O upload local de homologação foi desativado na produção para não indicar que um documento foi processado ou persistido.');};
views.giftCardBulkTest=function(){return '<h2>Homologação de Gift Cards</h2>'+empty('Ferramenta de teste indisponível em produção.','Envios em massa permanecem restritos ao ambiente de homologação.');};
views.giftCard=function(){
 const gs=rows('giftCards','gift_cards');
 return '<h2>Gift Cards</h2>'+(gs.length?gs.map(g=>'<div class="option"><span><b>'+esc(g.code||g.title||'Gift Card')+'</b><small>'+esc(g.status||'Disponível')+'</small></span><b>'+money(g.value||g.amount)+'</b></div>').join(''):empty('Nenhum Gift Card cadastrado.','Nenhum cartão de demonstração é apresentado como real.'));
};

function refreshOverlay(){
 const overlay=document.querySelector('.performance-card-overlay');if(!overlay)return;
 const tx=transactions().filter(isPaid).filter(t=>!isOutgoing(t));
 const gross=tx.reduce((s,t)=>s+Number(t.amount||0),0),goal=Number(data().settings?.monthly_goal||data().settings?.monthlyGoal||7000),pct=goal>0?Math.min(100,Math.round(gross/goal*100)):0;
 const values=overlay.querySelectorAll('.pc-k b');
 if(values[0])values[0].textContent=money(gross);
 if(values[1])values[1].textContent=pct+'%';
 if(values[2])values[2].textContent=goal>0?money(goal):'—';
 const bar=overlay.querySelector('.pc-bar i');if(bar)bar.style.width=pct+'%';
 const note=overlay.querySelector('.pc-goal');
 if(note)note.textContent=window.__EDDU_NEON_CONNECTED===true?(goal>0?money(Math.max(0,goal-gross))+' para atingir a meta':'Meta ainda não configurada'):'Aguardando autenticação e sincronização com o Neon';
}
window.saveAgendaBlockDayM=async function(){
 const date=document.getElementById('blkDayDate')?.value,reason=document.getElementById('blkDayReason')?.value?.trim()||'Dia bloqueado';
 if(!date){if(window.toast)window.toast('Informe a data.');return false;}
 const client=window.__EDDU_NEON_CLIENT;
 if(!client||window.__EDDU_NEON_READY!==true||!navigator.onLine){if(window.toast)window.toast('Neon indisponível. O bloqueio não foi salvo.');return false;}
 const start=new Date(date+'T00:00:00'),end=new Date(date+'T23:59:59');
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())){if(window.toast)window.toast('Data inválida.');return false;}
 try{
  const [appointmentsResult,blocksResult]=await Promise.all([
   client.from('appointments').select('id').lt('starts_at',end.toISOString()).gt('ends_at',start.toISOString()).not('status','in','(cancelled,Cancelado,Cancelled)'),
   client.from('agenda_blocks').select('id').lt('starts_at',end.toISOString()).gt('ends_at',start.toISOString())
  ]);
  if(appointmentsResult?.error)throw new Error(appointmentsResult.error.message||'Falha ao consultar agendamentos.');
  if(blocksResult?.error)throw new Error(blocksResult.error.message||'Falha ao consultar bloqueios.');
  if((appointmentsResult.data||[]).length)throw new Error('Há agendamentos neste dia; o bloqueio não foi criado.');
  if((blocksResult.data||[]).length)throw new Error('Já existe um bloqueio neste dia.');
  const result=await client.from('agenda_blocks').insert({professional_id:null,starts_at:start.toISOString(),ends_at:end.toISOString(),reason}).select('*').limit(1);
  if(result?.error)throw new Error(result.error.message||'Falha ao gravar bloqueio.');
  if(!result?.data?.[0]?.id)throw new Error('O servidor não confirmou o bloqueio.');
  window.data=window.data||{};window.data.blocks=Array.isArray(window.data.blocks)?window.data.blocks:[];window.data.blocks.unshift(result.data[0]);
  if(window.toast)window.toast('Bloqueio de dia confirmado no Neon.');
  window.openSheet?.('agenda');return true;
 }catch(e){if(window.toast)window.toast('Bloqueio não confirmado: '+String(e?.message||'erro'));return false;}
};
const disabled=(name,label)=>{window[name]=function(){if(window.toast)window.toast(label+' ainda não está conectado à persistência de produção. Nenhuma alteração foi salva.');return {ok:false,error:'not_implemented_in_production'};};};
disabled('createManualCoupon','Criação de cupom');
disabled('v46AnalyzeCardInvoice','Upload de fatura');
disabled('v46SendGiftCardBulkTest','Envio em massa de Gift Cards');
disabled('createTestReceivable','Recebível de teste');
disabled('v8PrintReport','Relatório financeiro local');
disabled('v46DownloadFinancialReport','Relatório financeiro local');
try{if(window.state){window.state.command={client:'',service:'',amount:0,method:'',brand:'',installments:1,gateway:'',closed:false,grossAmount:0,netAmount:0,discount:0,coupon:'',cost:0};window.state.referrals=[];window.state.points=0;window.state.financial={grossSales:0,netSales:0,expenses:0,cpv:0};}}catch(_){}
window.__EDDU_PRODUCTION_GUARD_ACTIVE=true;
refreshOverlay();
setInterval(refreshOverlay,2000);
window.addEventListener('eddu-appointment-confirmed',refreshOverlay);
})();
