import {useEffect,useMemo,useState} from 'react'
import type {FormEvent,ReactNode} from 'react'
import {supabase} from './lib/supabaseClient'
import {APP_COMMIT,APP_ENV,APP_VERSION} from './version'
import {calculateBestPaymentGateway} from './lib/paymentEngine'
import {addCommandItem,closeCommandOnline,createCommand,getAppointments,getClientByUser,getClients,getCommands,getFinancial,getProfile,getProducts,getServices,markCommandPaidPdv,recalculateCommand} from './lib/data'
import type {Profile} from './lib/data'
import './styles/app.css'

const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const integer=new Intl.NumberFormat('pt-BR')
const dt=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'})
type View='home'|'agenda'|'clients'|'commands'|'services'|'finance'|'reports'|'documents'|'gateways'|'settings'|'support'|'payments'

function ErrorBox({text}:{text:string}){return <div className="error-banner">{text}</div>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty"><b>{title}</b><span>{text}</span></div>}
function Loading(){return <div className="loading">Carregando dados reais…</div>}
function Footer(){return <footer className="technical">ED & DU · V{APP_VERSION} · {APP_ENV} · {APP_COMMIT}</footer>}
function Lotus(){return <svg className="lotus-art" viewBox="0 0 120 90" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="2"><path d="M60 78C39 70 27 55 29 38c14 3 26 15 31 31"/><path d="M60 78c21-8 33-23 31-40-14 3-26 15-31 31"/><path d="M60 75C48 57 48 39 60 18c12 21 12 39 0 57Z"/><path d="M60 75C43 61 38 47 42 31c10 4 17 13 18 26"/><path d="M60 75c17-14 22-28 18-44-10 4-17 13-18 26"/><path d="M31 77c17 4 41 4 58 0"/></g></svg>}

export default function App(){
  const[profile,setProfile]=useState<Profile|null>(null)
  const[uid,setUid]=useState('')
  const[boot,setBoot]=useState(true)
  const[err,setErr]=useState('')
  useEffect(()=>{
    let alive=true
    supabase.auth.getSession().then(async({data})=>{
      if(data.session?.user){
        const p=await getProfile(data.session.user.id)
        if(alive&&p?.active){setUid(data.session.user.id);setProfile(p)}
      }
    }).catch(e=>alive&&setErr(e.message)).finally(()=>alive&&setBoot(false))
    const{data}=supabase.auth.onAuthStateChange(async(_,s)=>{
      if(!s?.user){setProfile(null);setUid('');return}
      try{const p=await getProfile(s.user.id);if(p?.active){setUid(s.user.id);setProfile(p)}}catch(e){setErr(e instanceof Error?e.message:'Falha ao carregar perfil')}
    })
    return()=>{alive=false;data.subscription.unsubscribe()}
  },[])
  if(boot)return <div className="app-loading"><b>ED & DU</b><span>TERAPIA DA BELEZA</span><Loading/></div>
  if(!profile)return <Login error={err} setError={setErr}/>
  return <Shell profile={profile} uid={uid}/>
}

function Login({error,setError}:{error:string;setError:(s:string)=>void}){
  const[email,setEmail]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');setMessage('')
    try{
      if(signup){const{data,error}=await supabase.auth.signUp({email:email.trim(),password});if(error)throw error;if(!data.session)setMessage('Cadastro criado. Confirme o e-mail para entrar.')}
      else{const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error}
    }catch(x){setError(x instanceof Error?x.message:'Falha na autenticação.')}finally{setBusy(false)}
  }
  return <main className="auth-page"><section className="auth-card"><div className="brand-mark">ED & DU</div><div className="brand-sub">TERAPIA DA BELEZA</div><h1>{signup?'Criar conta':'Entrar no aplicativo'}</h1><p className="muted">Acesso seguro por Supabase Auth.</p>{error&&<ErrorBox text={error}/>} {message&&<div className="success-banner">{message}</div>}<form onSubmit={submit}><label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary-btn full" disabled={busy}>{busy?'Processando…':signup?'Criar conta':'Entrar'}</button></form><button className="link-btn" onClick={()=>setSignup(!signup)}>{signup?'Já tenho uma conta':'Criar conta de cliente'}</button><Footer/></section></main>
}

function Shell({profile,uid}:{profile:Profile;uid:string}){
  const pro=profile.role!=='client'
  const[view,setView]=useState<View>('home')
  const[mode,setMode]=useState<'professional'|'client'>(pro?'professional':'client')
  const nav=mode==='professional'?[['home','Início'],['agenda','Agenda'],['clients','Clientes'],['commands','Comandas'],['finance','Financeiro']]:[['home','Início'],['agenda','Agendar'],['documents','Docs'],['support','Suporte']]
  const signout=async()=>{await supabase.auth.signOut()}
  const changeMode=(next:'professional'|'client')=>{if(next==='professional'&&pro){setMode(next);setView('home')}else if(next==='client'){setMode(next);setView('home')}}
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>setView('home')}><b>ED & DU</b><span>TERAPIA DA BELEZA</span></button>
      <div className="role-pill" aria-label="Seletor de perfil"><button className={mode==='professional'?'active':''} onClick={()=>changeMode('professional')}>Profissional</button><button className={mode==='client'?'active':''} onClick={()=>changeMode('client')}>Cliente</button></div>
      <div className="top-actions"><span className="top-symbol">♧</span><span className="avatar">{(profile.full_name||'E')[0].toUpperCase()}</span></div>
    </header>
    <div className="body-layout">
      <aside className="sidebar"><div className="side-title">{mode==='professional'?'Área do profissional':'Área do cliente'}</div>{nav.map(([id,label])=><button key={id} className={`side-nav ${view===id?'active':''}`} onClick={()=>setView(id as View)}>{label}</button>)}{mode==='professional'&&<><div className="side-title extra">Gestão</div>{[['services','Serviços'],['reports','Relatórios'],['gateways','Gateways'],['settings','Configurações']].map(([id,label])=><button key={id} className={`side-nav ${view===id?'active':''}`} onClick={()=>setView(id as View)}>{label}</button>)}</>}<button className="side-nav logout" onClick={()=>void signout()}>Sair</button></aside>
      <main className="main"><div className="content"><Route view={view} pro={mode==='professional'} uid={uid} profile={profile} setView={setView}/></div></main>
    </div>
    <nav className="bottom-nav">{nav.map(([id,label])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id as View)}><b>{label}</b></button>)}</nav>
    <Footer/>
  </div>
}

function Head({eyebrow,title,subtitle,action}:{eyebrow:string;title:string;subtitle?:string;action?:ReactNode}){return <div className="page-head"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>}

function Route({view,pro,uid,profile,setView}:{view:View;pro:boolean;uid:string;profile:Profile;setView:(v:View)=>void}){
  if(view==='home')return <Dashboard pro={pro} uid={uid} setView={setView} profile={profile}/>
  if(view==='agenda')return <Agenda pro={pro}/>
  if(view==='clients'&&pro)return <Clients/>
  if(view==='commands'&&pro)return <Commands/>
  if(view==='services'&&pro)return <Services/>
  if(view==='finance'&&pro)return <Finance/>
  if(view==='reports'&&pro)return <Simple title="Relatórios" text="Os indicadores serão derivados exclusivamente dos lançamentos reais."/>
  if(view==='documents')return <Simple title={pro?'Documentos do salão':'Meus documentos'} text="Nenhum documento real disponível para este usuário."/>
  if(view==='gateways'&&pro)return <Gateways/>
  if(view==='settings'&&pro)return <Simple title="Configurações" text={`Perfil autenticado: ${profile.full_name||'sem nome'} · ${profile.role}.`}/>
  if(view==='payments')return <Simple title="Pagamentos" text="O histórico de pagamentos será exibido a partir dos lançamentos reais do cliente."/>
  return <Simple title="Suporte" text="Configure o contato oficial do salão para habilitar o suporte WhatsApp."/>
}

function Dashboard({pro,uid,setView,profile}:{pro:boolean;uid:string;setView:(v:View)=>void;profile:Profile}){
  const[a,setA]=useState<any[]>([]),[c,setC]=useState<any[]>([]),[clients,setClients]=useState<any[]>([]),[financial,setFinancial]=useState<any[]>([]),[client,setClient]=useState<any>(null),[loading,setLoading]=useState(true)
  useEffect(()=>{Promise.all([getAppointments(),getCommands(),getClients(),getFinancial(200),getClientByUser(uid)]).then(([aa,cc,cl,ff,clientRow])=>{setA(aa);setC(cc);setClients(cl);setFinancial(ff);setClient(clientRow)}).finally(()=>setLoading(false))},[uid])
  if(loading)return <Loading/>
  const today=new Date().toISOString().slice(0,10)
  const todayA=a.filter(x=>String(x.starts_at).slice(0,10)===today)
  const weekStart=new Date();weekStart.setHours(0,0,0,0);weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7))
  const weekRevenue=financial.filter(x=>x.type==='revenue'&&x.status==='paid'&&x.paid_at&&new Date(x.paid_at)>=weekStart).reduce((s,x)=>s+Number(x.amount||0),0)
  if(!pro)return <ClientDashboard client={client} appointments={a} setView={setView}/>
  const name=profile.full_name?.trim()||'profissional'
  return <>
    <Head eyebrow="ÁREA DO PROFISSIONAL" title={`Olá, ${name}.`} subtitle="Sua agenda, clientes e resultados em um só lugar."/>
    <section className="metric-grid professional-metrics"><Metric icon="◷" v={todayA.length} l="Atendimentos Hoje"/><Metric icon="♙" v={clients.length} l="Clientes Esta semana"/><Metric icon="↗" v={money.format(weekRevenue)} l="Faturamento Esta semana"/><Metric icon="★" v="—" l="Avaliação Média"/></section>
    <section className="performance-card"><div><span className="eyebrow">DESEMPENHO COMERCIAL · ED + DU</span><h2>Meta do salão</h2><p>Acompanhe o faturamento realizado em relação à meta cadastrada.</p></div><div className="performance-value"><strong>{money.format(weekRevenue)}</strong><span>sem meta configurada</span></div><div className="performance-track"><span style={{width:'0%'}}/></div></section>
    <h2 className="section-title">Acesso rápido</h2>
    <div className="quick-grid professional-quick"><Action icon="＋" title="Nova Comanda" text="Registrar serviço" onClick={()=>setView('commands')}/><Action icon="◷" title="Minha Agenda" text="Ver atendimentos" onClick={()=>setView('agenda')}/><Action icon="♙" title="Meus Clientes" text="Histórico e perfil" onClick={()=>setView('clients')}/><Action icon="▥" title="Relatórios" text="Vendas e performance" onClick={()=>setView('reports')}/><Action icon="▤" title="Meus Documentos" text="Acesse seus documentos" onClick={()=>setView('documents')}/><Action icon="⚙" title="Configurações" text="Preferências do salão" onClick={()=>setView('settings')}/>
    </div>
  </>
}

function ClientDashboard({client,appointments,setView}:{client:any;appointments:any[];setView:(v:View)=>void}){
  const points=Math.max(0,Number(client?.loyalty_points||0)),goal=1000,progress=Math.min(100,(points/goal)*100),remaining=Math.max(0,goal-points)
  const ruler=[0,250,500,750,1000]
  return <>
    <Head eyebrow="ÁREA DO CLIENTE" title={`Olá, ${client?.name||'cliente'}.`} subtitle="Cuide de você. Seu próximo momento de bem-estar está aqui."/>
    <section className="loyalty-card">
      <div className="loyalty-art-wrap"><Lotus/></div>
      <div className="loyalty-head"><div><span className="loyalty-label">PONTOS FIDELIDADE</span><strong>{integer.format(points)} <small>/ {integer.format(goal)}</small></strong></div><span className="loyalty-badge">🎁 Troque por R$ 100,00 <b>›</b></span></div>
      <div className="progress-area"><div className="progress-track"><span style={{width:`${progress}%`}}/></div><div className="progress-ruler">{ruler.map((value)=><span key={value}>{integer.format(value)}</span>)}</div></div>
      <div className="loyalty-foot"><span>{integer.format(points)} pontos acumulados</span><span>{remaining?`Faltam ${integer.format(remaining)} pontos para o resgate`:'Resgate disponível'}</span></div>
    </section>
    <button className="referral-banner" onClick={()=>setView('support')}><span>🎁</span><span><b>Programa de Indicação | Indique e ganhe +100 pontos por cliente validado →</b></span></button>
    <div className="client-primary-actions"><button className="primary-btn pill" onClick={()=>setView('agenda')}>Agendar atendimento <span>→</span></button><button className="outline-btn pill-outline" onClick={()=>setView('agenda')}>Ver meus agendamentos <span>→</span></button></div>
    <h2 className="section-title">Acesso rápido</h2>
    <div className="quick-grid client-quick"><Action icon="◷" title="Agendar" text="Escolha serviço e horário" onClick={()=>setView('agenda')}/><Action icon="◫" title="Agendamentos" text="Veja seus próximos horários" onClick={()=>setView('agenda')}/><Action icon="▤" title="Meus documentos" text="Acesse seus comprovantes" onClick={()=>setView('documents')}/><Action icon="▣" title="Pagamentos" text="Veja seus pagamentos" onClick={()=>setView('payments')}/></div>
    {!appointments.filter(x=>x.client_id===client?.id).length&&<div className="client-note">Nenhum agendamento futuro foi encontrado nos dados reais.</div>}
  </>
}

function Metric({icon,v,l}:{icon:string;v:ReactNode;l:string}){return <div className="metric-card"><span className="metric-icon">{icon}</span><strong>{v}</strong><small>{l}</small></div>}
function Action({icon,title,text,onClick}:{icon:string;title:string;text:string;onClick:()=>void}){return <button className="action-card" onClick={onClick}><span className="action-icon">{icon}</span><b>{title}</b><small>{text}</small><i>›</i></button>}

function Agenda({pro}:{pro:boolean}){const[rows,setRows]=useState<any[]>([]),[services,setServices]=useState<any[]>([]),[loading,setLoading]=useState(true);useEffect(()=>{Promise.all([getAppointments(),getServices()]).then(([a,s])=>{setRows(a);setServices(s)}).finally(()=>setLoading(false))},[]);if(loading)return <Loading/>;return <><Head eyebrow="AGENDA" title={pro?'Minha agenda':'Agendar atendimento'} subtitle="Dados carregados diretamente do banco."/>{!pro&&<div className="card-grid">{services.map(s=><div className="card" key={s.id}><b>{s.name}</b><p>{s.duration_minutes} min · {money.format(Number(s.price_base||0))}</p></div>)}</div>}<div className="list">{rows.map(r=><div className="list-row" key={r.id}><div><b>{r.clients?.name||'Cliente'}</b><small>{dt.format(new Date(r.starts_at))}</small></div><span className="status">{r.status}</span></div>)}</div>{!rows.length&&<Empty title="Agenda vazia" text="Nenhum agendamento real foi encontrado."/>}</>}
function Clients(){const[rows,setRows]=useState<any[]>([]);useEffect(()=>{getClients().then(setRows)},[]);return <><Head eyebrow="CLIENTES" title="Meus clientes" subtitle="Cadastros reais do salão."/>{rows.length?<div className="client-grid">{rows.map(c=><div className="client-card" key={c.id}><b>{c.name}</b><small>{c.email||'Sem e-mail'}</small><small>{c.phone||'Sem telefone'}</small></div>)}</div>:<Empty title="Nenhum cliente" text="Não existem clientes cadastrados."/>}</>}
function Services(){const[rows,setRows]=useState<any[]>([]);useEffect(()=>{getServices().then(setRows)},[]);return <><Head eyebrow="SERVIÇOS" title="Serviços" subtitle="Catálogo real."/>{rows.length?<div className="card-grid">{rows.map(s=><div className="card" key={s.id}><b>{s.name}</b><p>{money.format(Number(s.price_base||0))} · {s.duration_minutes} min</p></div>)}</div>:<Empty title="Nenhum serviço" text="Cadastre o primeiro serviço."/>}</>}
function Commands(){const[rows,setRows]=useState<any[]>([]),[clients,setClients]=useState<any[]>([]),[services,setServices]=useState<any[]>([]),[products,setProducts]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[pay,setPay]=useState(false),[err,setErr]=useState(''),[toast,setToast]=useState(''),[creating,setCreating]=useState(false);const reload=()=>Promise.all([getCommands(),getClients(),getServices(),getProducts()]).then(([c,cl,s,p])=>{setRows(c);setClients(cl);setServices(s);setProducts(p)});useEffect(()=>{void reload()},[]);useEffect(()=>{if(!toast)return;const t=window.setTimeout(()=>setToast(''),4500);return()=>window.clearTimeout(t)},[toast]);const create=async()=>{if(creating)return;setCreating(true);setErr('');setToast('');try{if(!clients[0]||!services[0]||!products[0])throw new Error('Cadastre cliente, serviço e produto antes de abrir uma comanda.');const c=await createCommand({client_id:clients[0].id});await addCommandItem({command_id:c.id,service_id:services[0].id,description:services[0].name,quantity:1,unit_price:Number(services[0].price_base||0)});await addCommandItem({command_id:c.id,product_id:products[0].id,description:products[0].name,quantity:1,unit_price:Number(products[0].price||0)});await recalculateCommand(c.id);const{error}=await supabase.rpc('transition_command_state',{p_command_id:c.id,p_next:'open'});if(error)throw error;await reload();setToast('Comanda criada com sucesso.')}catch(e){console.error('[Commands] falha ao criar comanda',e);setErr('');setToast(e instanceof Error?e.message:'Não foi possível criar a comanda. Tente novamente.')}finally{setCreating(false)}};return <><Head eyebrow="CENTRAL DE COMANDAS" title="Comandas" subtitle="Gerencie comandas e pagamentos do salão." action={<button className="primary-btn" disabled={creating} onClick={()=>void create()}>{creating?'Criando…':'+ Nova comanda'}</button>}/>{toast&&<div className={`toast ${toast.includes('sucesso')?'success':''}`} role="status">{toast}</div>}{err&&<ErrorBox text={err}/>}<div className="list">{rows.map(c=><div className="list-row" key={c.id}><div><b>{c.clients?.name||'Cliente'}</b><small>{money.format(Number(c.total||0))}</small></div><div><span className="status">{c.status}</span>{c.status==='open'&&<button className="outline-btn" onClick={()=>{setSelected(c);setPay(true)}}>Fechar / Enviar pagamento</button>}</div></div>)}</div>{!rows.length&&<Empty title="Nenhuma comanda" text="Crie uma comanda real para iniciar o fluxo."/>}{pay&&selected&&<Payment command={selected} close={()=>setPay(false)} done={()=>{setPay(false);void reload()}}/>}</>}
function Payment({command,close,done}:{command:any;close:()=>void;done:()=>void}){const[method,setMethod]=useState<'PIX'|'CREDIT_CARD'|'PDV'>('PIX'),[inst,setInst]=useState(1),[ref,setRef]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');const gross=Number(command.total||0),ranking=method==='PDV'?[]:calculateBestPaymentGateway(gross,method,inst);const submit=async()=>{setBusy(true);try{if(method==='PDV'){if(!ref.trim())throw new Error('Informe a referência da maquininha.');const{data,error}=await supabase.from('payment_methods').select('id').eq('name','PDV / Maquininha').maybeSingle();if(error)throw error;if(!data)throw new Error('Método PDV não cadastrado.');await markCommandPaidPdv(command.id,data.id,ref.trim(),gross)}else{const best=ranking[0];await closeCommandOnline(command.id,best.gatewayId,best.feeTotal,best.netAmount,inst)}done()}catch(e){setErr(e instanceof Error?e.message:'Falha no pagamento.')}finally{setBusy(false)}};return <div className="modal-back"><div className="modal"><div className="modal-head"><div className="eyebrow">PAGAMENTO · {money.format(gross)}</div><button className="icon-btn" onClick={close}>×</button></div><div className="pay-method-grid">{(['PIX','CREDIT_CARD','PDV'] as const).map(x=><button key={x} className={method===x?'pay-method selected':'pay-method'} onClick={()=>setMethod(x)}>{x==='CREDIT_CARD'?'Cartão':x==='PDV'?'PDV / Maquininha':'PIX'}</button>)}</div>{method==='CREDIT_CARD'&&<label>Parcelas<select value={inst} onChange={e=>setInst(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1}>{i+1}</option>)}</select></label>}{method==='PDV'?<label>Referência da maquininha<input value={ref} onChange={e=>setRef(e.target.value)} placeholder="NSU / código"/></label>:<div className="ranking">{ranking.map(r=><div className={`rank-row ${r.isBestOption?'best':''}`} key={r.gatewayId}><b>{r.gatewayName}</b><span>{money.format(r.netAmount)} líquido<br/><small>taxa {money.format(r.feeTotal)}</small></span></div>)}</div>}{err&&<ErrorBox text={err}/>}<div className="modal-actions"><button className="outline-btn" onClick={close}>Cancelar</button><button className="primary-btn" disabled={busy} onClick={submit}>{busy?'Processando…':method==='PDV'?'Confirmar pagamento presencial':'Enviar para pagamento'}</button></div></div></div>}
function Finance(){const[rows,setRows]=useState<any[]>([]);useEffect(()=>{getFinancial(200).then(setRows)},[]);const revenue=rows.filter(r=>r.type==='revenue'&&r.status==='paid').reduce((s,r)=>s+Number(r.amount||0),0);return <><Head eyebrow="FINANCEIRO" title="Financeiro" subtitle="Lançamentos reais."/><div className="metric-grid"><Metric icon="↗" v={money.format(revenue)} l="Receitas pagas"/><Metric icon="▤" v={rows.length} l="Lançamentos"/></div><div className="list">{rows.map(r=><div className="list-row" key={r.id}><div><b>{r.description}</b><small>{r.type} · {r.status}</small></div><strong>{money.format(Number(r.amount||0))}</strong></div>)}</div>{!rows.length&&<Empty title="Sem lançamentos" text="O financeiro está vazio."/>}</>}
function Gateways(){return <><Head eyebrow="GATEWAYS" title="Gateways" subtitle="Ranking financeiro no fechamento."/><div className="card-grid">{['PagBank','Asaas','Stripe','PicPay','Nubank'].map(x=><div className="card" key={x}><b>{x}</b><p className="muted">Adapter disponível para configuração segura no backend.</p></div>)}</div></>}
function Simple({title,text}:{title:string;text:string}){return <><Head eyebrow="ED & DU" title={title}/><div className="card simple-card"><p>{text}</p></div></>}
