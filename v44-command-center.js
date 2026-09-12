/* V44 — authoritative command center. Replaces the visual command/payment layer without touching legacy business data. */
(function(){
  'use strict';
  const URL='https://cwdpwfzsasdsetthmpoa.supabase.co';
  const KEY='sb_publishable_sPtr9cgaWgTAK4ooUkNpxg_5qI2erGj';
  let sb=null,user=null,role='client',data={commands:[],items:[],clients:[],services:[],pros:[],payments:[],methods:[]};
  const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const money=v=>'R$ '+Number(v||0).toFixed(2).replace('.',',');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function ready(){
    for(let n=0;n<60;n++){
      try{
        sb=window.__EDDU_SB||sb;
        if(!sb&&window.supabase?.createClient) sb=window.supabase.createClient(URL,KEY);
        if(sb?.auth){const r=await sb.auth.getSession();if(r?.data?.session?.user){user=r.data.session.user;return true}}
      }catch(e){}
      await sleep(250);
    }
    return false;
  }
  async function identify(){
    const [p,pr]=await Promise.all([
      sb.from('profiles').select('id,role,active,full_name').eq('id',user.id).maybeSingle(),
      sb.from('professionals').select('id,user_id,name,active').eq('user_id',user.id).eq('active',true).maybeSingle()
    ]);
    role=(pr.data||p.data?.role==='professional'||p.data?.role==='admin')?'pro':'client';
  }
  async function load(){
    let rpc=null;
    try{rpc=await sb.rpc('get_command_center')}catch(e){}
    if(rpc&&!rpc.error&&rpc.data){
      const x=rpc.data||{};
      data.commands=x.commands||[];data.items=x.command_items||[];data.clients=x.clients||[];data.services=x.services||[];data.pros=x.professionals||[];
    }else{
      const [c,i,cl,s,p]=await Promise.all([
        sb.from('commands').select('*').order('created_at',{ascending:false}),
        sb.from('command_items').select('*'),
        sb.from('clients').select('id,user_id,name,email,phone'),
        sb.from('services').select('id,name,price_base,price_long').eq('active',true),
        sb.from('professionals').select('id,user_id,name').eq('active',true)
      ]);
      if(c.error)throw new Error(c.error.message);
      data.commands=c.data||[];data.items=i.data||[];data.clients=cl.data||[];data.services=s.data||[];data.pros=p.data||[];
    }
    try{const p=await sb.from('command_payments').select('*');data.payments=p.data||[]}catch(e){data.payments=[]}
    try{const m=await sb.from('payment_methods').select('id,name,active').eq('active',true);data.methods=m.data||[]}catch(e){data.methods=[]}
  }
  function commandItems(o){return data.items.filter(i=>String(i.command_id)===String(o.id));}
  function client(o){return data.clients.find(c=>String(c.id)===String(o.client_id));}
  function professional(o){return data.pros.find(p=>String(p.id)===String(o.professional_id));}
  function paid(o){return data.payments.filter(p=>String(p.command_id)===String(o.id)).reduce((a,p)=>a+Number(p.amount||0),0)>=Number(o.total||o.subtotal||0)-.01;}
  function status(o){if(paid(o))return 'paid';return String(o.status||'open').toLowerCase();}
  function inject(){
    if($('#eddu-v44-style'))return;
    const st=document.createElement('style');st.id='eddu-v44-style';st.textContent=`
      #eddu-v44{position:fixed;inset:0;z-index:2147483647;background:#f4f2ee;color:#242321;overflow:auto;font:14px/1.5 Inter,system-ui,sans-serif;display:none}
      #eddu-v44.on{display:block}#eddu-v44 *{box-sizing:border-box}#eddu-v44 .top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #e6e1d9;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px}
      #eddu-v44 .wrap{max-width:1100px;margin:auto;padding:24px 18px 70px}#eddu-v44 h1{font-size:30px;margin:0}#eddu-v44 h2{font-size:19px;margin:0 0 14px}#eddu-v44 p{color:#77736c;margin:4px 0}
      #eddu-v44 .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:0 0 22px}.box{background:#fff;border:1px solid #e6e1d9;border-radius:18px;padding:18px;box-shadow:0 8px 24px #231e190d;margin-bottom:14px}.kpi small{color:#77736c;text-transform:uppercase;letter-spacing:1px;font-weight:700}.kpi b{display:block;font-size:32px;margin-top:6px}.section{margin-top:24px}.cmd{background:#fff;border:1px solid #e6e1d9;border-radius:18px;padding:18px;margin:12px 0}.cmdhead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.clientname{font-size:18px;font-weight:800}.amount{font-size:23px;font-weight:800;white-space:nowrap}.badge{display:inline-block;border-radius:999px;padding:5px 10px;background:#eeeae4;color:#555;margin-top:6px}.badge.open{background:#f4ecd9;color:#705723}.badge.paid{background:#e5f1e9;color:#356448}.lines{border-top:1px solid #e6e1d9;margin-top:14px;padding-top:8px}.line{display:flex;justify-content:space-between;gap:12px;padding:9px 0}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.btn{border:0;border-radius:11px;padding:10px 14px;background:#eeeae4;color:#242321;font-weight:700;cursor:pointer}.btn.primary{background:#242321;color:#fff}.btn.ok{background:#e5f1e9;color:#356448}.empty{padding:25px;text-align:center;border:1px dashed #d9d2c8;border-radius:14px;color:#77736c}.modal{position:fixed;inset:0;background:#0007;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:18px}.modal.on{display:flex}.modalbox{background:#fff;border-radius:20px;max-width:680px;width:100%;max-height:90vh;overflow:auto;padding:22px}.paygrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.payopt{padding:14px;border:1px solid #e6e1d9;border-radius:12px;background:#fff;text-align:left;font-weight:700;cursor:pointer}.notice{background:#f4ecd9;border-radius:12px;padding:12px;margin:12px 0;color:#705723}
      @media(max-width:600px){#eddu-v44 .grid{grid-template-columns:1fr 1fr}#eddu-v44 h1{font-size:25px}.cmdhead{display:block}.amount{margin-top:8px}.paygrid{grid-template-columns:1fr}}@media(max-width:420px){#eddu-v44 .grid{grid-template-columns:1fr}}
    `;document.head.appendChild(st);
  }
  function root(){if($('#eddu-v44'))return;const d=document.createElement('div');d.id='eddu-v44';d.innerHTML='<div class="top"><div><b>ED & DU</b><p id="v44sub">Central de comandas</p></div><button class="btn" id="v44close">Fechar</button></div><div class="wrap" id="v44body"></div></div><div class="modal" id="v44modal"><div class="modalbox" id="v44modalbox"></div></div>';document.body.appendChild(d);$('#v44close').onclick=close;$('#v44modal').addEventListener('click',e=>{if(e.target.id==='v44modal')$('#v44modal').classList.remove('on')});}
  function detail(o){
    const c=client(o),its=commandItems(o);$('#v44modalbox').innerHTML=`<h2>Comanda</h2><p><b>${esc(c?.name||'Cliente')}</b></p><div class="lines">${its.map(i=>{const s=data.services.find(x=>String(x.id)===String(i.service_id));return `<div class="line"><span>${esc(i.description||s?.name||'Serviço')} × ${Number(i.quantity||1)}</span><b>${money(Number(i.unit_price||0)*Number(i.quantity||1))}</b></div>`}).join('')||'<div class="empty">Nenhum item.</div>'}</div><div class="line"><b>Total</b><b>${money(o.total??o.subtotal)}</b></div><div class="actions"><button class="btn" onclick="document.getElementById('v44modal').classList.remove('on')">Fechar</button>${role==='client'&&!paid(o)?`<button class="btn primary" onclick="window.EDDU_V44.pay('${o.id}')">Pagar</button>`:''}</div>`;$('#v44modal').classList.add('on');
  }
  function card(o){
    const c=client(o),p=professional(o),its=commandItems(o),st=status(o),total=Number(o.total??o.subtotal??0);
    return `<article class="cmd"><div class="cmdhead"><div><div class="clientname">${esc(c?.name||'Cliente')}</div><p>${esc(p?.name||'Profissional não definido')}</p><span class="badge ${st==='paid'?'paid':'open'}">${st==='paid'?'Pago':st==='closed'?'Aguardando pagamento':'Em aberto'}</span></div><div class="amount">${money(total)}</div></div><div class="lines">${its.map(i=>{const s=data.services.find(x=>String(x.id)===String(i.service_id));return `<div class="line"><span>${esc(i.description||s?.name||'Serviço')} × ${Number(i.quantity||1)}</span><b>${money(Number(i.unit_price||0)*Number(i.quantity||1))}</b></div>`}).join('')||'<div class="empty">Esta comanda não possui itens.</div>'}</div><div class="actions"><button class="btn" onclick="window.EDDU_V44.detail('${o.id}')">Ver comanda</button>${role==='client'&&!paid(o)?`<button class="btn primary" onclick="window.EDDU_V44.pay('${o.id}')">Pagar</button>`:''}${role==='pro'&&st!=='paid'?`<button class="btn ok" onclick="window.EDDU_V44.closeCommand('${o.id}')">Encerrar</button>`:''}</div></article>`;
  }
  function draw(){
    const rows=data.commands.filter(o=>commandItems(o).length).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    const visible=role==='client'?rows.filter(o=>String(client(o)?.user_id)===String(user.id)):rows;
    const open=visible.filter(o=>status(o)==='open');const waiting=visible.filter(o=>status(o)==='closed');const paidRows=visible.filter(o=>status(o)==='paid');
    $('#v44sub').textContent=role==='pro'?'Gestão profissional — comandas reais':'Suas comandas — valores e pagamentos';
    $('#v44body').innerHTML=`<div style="margin-bottom:22px"><h1>${role==='pro'?'Comandas':'Pagamentos'}</h1><p>${role==='pro'?'Todas as comandas reais do banco, sem depender do renderizador antigo.':'Veja a comanda, os serviços e a ação de pagamento.'}</p></div><div class="grid"><div class="box kpi"><small>Total</small><b>${visible.length}</b></div><div class="box kpi"><small>Em aberto</small><b>${open.length}</b></div><div class="box kpi"><small>${role==='pro'?'Pagas':'Aguardando'}</small><b>${role==='pro'?paidRows.length:waiting.length}</b></div></div>${role==='pro'?`<div class="section"><h2>EM ABERTO</h2>${open.length?open.map(card).join(''):'<div class="box empty">Nenhuma comanda em aberto.</div>'}</div><div class="section"><h2>AGUARDANDO PAGAMENTO</h2>${waiting.length?waiting.map(card).join(''):'<div class="box empty">Nenhuma aguardando pagamento.</div>'}</div><div class="section"><h2>COMANDAS PAGAS</h2>${paidRows.length?paidRows.map(card).join(''):'<div class="box empty">Nenhuma comanda paga ainda.</div>'}</div>`:`<div class="section"><h2>MINHAS COMANDAS</h2>${visible.length?visible.map(card).join(''):'<div class="box empty">Nenhuma comanda encontrada.</div>'}</div>`}`;
  }
  async function open(){if(!await ready()){alert('Sessão não disponível. Faça login novamente.');return}await identify();inject();root();$('#eddu-v44').classList.add('on');document.getElementById('root').style.display='none';try{await load();draw()}catch(e){$('#v44body').innerHTML='<div class="box empty">Não foi possível carregar as comandas.<br>'+esc(e.message)+'</div>'}}
  function close(){$('#eddu-v44')?.classList.remove('on');if($('#root'))$('#root').style.display='';}
  async function pay(id){
    const o=data.commands.find(x=>String(x.id)===String(id));if(!o)return;
    const methods=data.methods.length?data.methods:[{id:'',name:'Pagamento no salão'}];
    $('#v44modalbox').innerHTML=`<h2>Pagamento</h2><div class="notice">O botão de pagamento está ativo. Selecione a forma de pagamento disponível.</div><div class="line"><span>Total</span><b>${money(o.total??o.subtotal)}</b></div><div class="paygrid">${methods.map(m=>`<button class="payopt" onclick="window.EDDU_V44.requestPay('${id}','${m.id||''}')">${esc(m.name)}</button>`).join('')}</div><div class="actions"><button class="btn" onclick="document.getElementById('v44modal').classList.remove('on')">Cancelar</button></div>`;$('#v44modal').classList.add('on');
  }
  async function requestPay(id,methodId){
    // Client RLS intentionally does not allow writing command_payments. For online methods, hand off to the existing checkout if present; otherwise create a visible payment request without falsely marking it paid.
    if(typeof window.startStripeCheckout==='function'&&methodId){try{await window.startStripeCheckout(id);return}catch(e){}}
    const o=data.commands.find(x=>String(x.id)===String(id));
    $('#v44modalbox').innerHTML=`<h2>Pagamento solicitado</h2><p>A comanda de <b>${money(o?.total??o?.subtotal)}</b> está pronta para pagamento.</p><div class="notice">A confirmação do pagamento precisa ser feita pelo meio de pagamento/gateway configurado no salão. A comanda não será marcada como paga sem confirmação.</div><div class="actions"><button class="btn primary" onclick="document.getElementById('v44modal').classList.remove('on')">Entendi</button></div>`;
  }
  async function closeCommand(id){
    const {error}=await sb.from('commands').update({status:'closed',closed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}await load();draw();
  }
  function intercept(){
    document.addEventListener('click',function(e){
      const b=e.target?.closest?.('button');if(!b)return;const t=(b.textContent||'').trim().toLowerCase();
      if(t==='comandas'||t.includes('comandas')){e.preventDefault();e.stopImmediatePropagation();open()}
      else if(t==='pagamentos'||t==='meus pagamentos'){e.preventDefault();e.stopImmediatePropagation();open()}
    },true);
  }
  async function init(){inject();root();intercept();window.EDDU_V44={open,close,detail,pay,requestPay,closeCommand};setTimeout(()=>open(),800);}
  init();
})();
