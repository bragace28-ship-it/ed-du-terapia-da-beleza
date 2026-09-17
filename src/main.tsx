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
if(!url||!anon){root.render(<main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui',background:'#f7f4fb'}}><section style={{maxWidth:560,padding:32,borderRadius:24,background:'#fff',boxShadow:'0 15px 50px #4a23701a'}}><b style={{fontSize:28,color:'#6414a6'}}>ED & DU</b><h1>Configuração de produção incompleta</h1><p>O build V33 foi publicado, mas o ambiente Cloudflare ainda não recebeu <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>. Nenhum dado de teste ou fallback está sendo usado.</p><small>V{APP_VERSION}</small></section></main>)}else{import('./App').then(({default:App})=>root.render(<React.StrictMode><App/></React.StrictMode>)).catch(error=>root.render(<main style={{padding:32,fontFamily:'system-ui'}}><h1>Falha ao iniciar o aplicativo</h1><pre>{error instanceof Error?error.message:String(error)}</pre></main>))}
