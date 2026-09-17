import React from 'react'
import {createRoot} from 'react-dom/client'
import './styles/global.css'
import './nav-bridge'

const APP_VERSION=import.meta.env.VITE_APP_VERSION||'33.0.0'
const KEY='eddu_app_version'
const stored=localStorage.getItem(KEY)
if(!stored||stored<APP_VERSION){for(const key of Object.keys(localStorage)){if(/^(eddu|v1|v2|v3|supabase\.auth)/i.test(key)&&key!==KEY)localStorage.removeItem(key)}localStorage.setItem(KEY,APP_VERSION)}
document.title=`ED & DU | Terapia da Beleza — V${APP_VERSION}`
const root=createRoot(document.getElementById('root')!)
const url=import.meta.env.VITE_SUPABASE_URL
const anon=import.meta.env.VITE_SUPABASE_ANON_KEY
const hostname=window.location.hostname.toLowerCase()
const isCustomDomain=hostname==='ededuterapiadabeleza.online'||hostname==='www.ededuterapiadabeleza.online'

function renderMessage(title:string,message:string,detail?:string){root.render(<main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui',background:'#f7f4fb'}}><section style={{maxWidth:620,padding:32,borderRadius:24,background:'#fff',boxShadow:'0 15px 50px #4a23701a'}}><b style={{fontSize:28,color:'#6414a6'}}>ED & DU</b><h1>{title}</h1><p>{message}</p>{detail&&<p>{detail}</p>}<small>V{APP_VERSION} · production</small></section></main>)}

async function boot(){
  if(!url||!anon){renderMessage('Configuração de produção incompleta','O ambiente desta origem ainda não recebeu as variáveis públicas necessárias do Supabase.','Se este endereço estiver em transição para o Cloudflare Pages, confirme o vínculo do domínio personalizado e aguarde a propagação DNS. Nenhum dado de teste ou fallback está sendo usado.');return}
  if(isCustomDomain){
    try{
      const response=await fetch(`/version.json?boot=${Date.now()}`,{cache:'no-store'})
      const metadata=await response.json() as {version?:string}
      if(metadata.version!==APP_VERSION){renderMessage('Domínio em transição','Este domínio ainda não está servindo a publicação V33 do Cloudflare Pages.','Conclua o apontamento DNS para o projeto ED & DU e tente novamente após a propagação.');return}
    }catch{
      renderMessage('Domínio em transição','Este domínio não está respondendo como a aplicação ED & DU V33.','Verifique o vínculo do domínio ao Cloudflare Pages e os registros DNS.');return
    }
  }
  import('./App').then(({default:App})=>root.render(<React.StrictMode><App/></React.StrictMode>)).catch(error=>renderMessage('Falha ao iniciar o aplicativo',error instanceof Error?error.message:String(error)))
}

void boot()
