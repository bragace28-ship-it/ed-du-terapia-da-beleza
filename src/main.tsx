import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'

const APP_VERSION=import.meta.env.VITE_APP_VERSION||'33.0.0'
const KEY='eddu_app_version'
const stored=localStorage.getItem(KEY)
if(!stored||stored<APP_VERSION){for(const key of Object.keys(localStorage)){if(/^(eddu|v1|v2|v3|supabase\.auth)/i.test(key)&&key!==KEY)localStorage.removeItem(key)}localStorage.setItem(KEY,APP_VERSION)}
document.title=`ED & DU | Terapia da Beleza — V${APP_VERSION}`
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
