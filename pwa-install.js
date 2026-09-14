/* ED & DU PWA — no visual redesign. Loaded by the existing app bootstrap. */
(function(){
  'use strict';
  function ensureMeta(){
    if(!document.querySelector('link[rel="manifest"]')){const l=document.createElement('link');l.rel='manifest';l.href='/manifest.webmanifest';document.head.appendChild(l)}
    if(!document.querySelector('link[rel="apple-touch-icon"]')){const l=document.createElement('link');l.rel='apple-touch-icon';l.href='/icons/eddu-lotus.svg';document.head.appendChild(l)}
    if(!document.querySelector('meta[name="theme-color"]')){const m=document.createElement('meta');m.name='theme-color';m.content='#242321';document.head.appendChild(m)}
  }
  function standalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
  let deferredPrompt=null;
  function css(){if(document.getElementById('eddu-pwa-css'))return;const s=document.createElement('style');s.id='eddu-pwa-css';s.textContent='.eddu-pwa-card{position:fixed;left:12px;right:12px;bottom:78px;z-index:99990;background:#fff;border:1px solid #e6e1d9;border-radius:18px;padding:13px;display:flex;align-items:center;gap:10px;box-shadow:0 14px 38px rgba(35,30,25,.16);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.eddu-pwa-lotus{width:42px;height:42px;border-radius:13px;background:#242321;color:#fff;display:grid;place-items:center;font-size:25px;flex:0 0 auto}.eddu-pwa-copy{min-width:0;flex:1}.eddu-pwa-copy b{display:block;font-size:13px}.eddu-pwa-copy span{display:block;color:#77736c;font-size:11px;line-height:1.35;margin-top:2px}.eddu-pwa-add{border:0;border-radius:10px;padding:9px 12px;background:#242321;color:#fff;font-weight:700}.eddu-pwa-close{border:0;background:transparent;color:#77736c;font-size:22px;padding:4px}';document.head.appendChild(s)}
  function show(){
    if(standalone()||sessionStorage.getItem('eddu_pwa_dismissed')==='1'||document.getElementById('eddu-pwa-install'))return;
    const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const box=document.createElement('div');box.id='eddu-pwa-install';box.innerHTML='<div class="eddu-pwa-card"><div class="eddu-pwa-lotus">✿</div><div class="eddu-pwa-copy"><b>Tenha o ED & DU na tela inicial</b><span>Adicione o ícone Lótus ao seu celular para acessar mais rápido.</span></div><button type="button" class="eddu-pwa-add">Adicionar</button><button type="button" class="eddu-pwa-close" aria-label="Fechar">×</button></div>';document.body.appendChild(box);
    box.querySelector('.eddu-pwa-add').onclick=async function(){if(deferredPrompt){deferredPrompt.prompt();try{await deferredPrompt.userChoice}catch(e){}deferredPrompt=null;box.remove();return}if(isIOS){alert('No iPhone: toque em Compartilhar → Adicionar à Tela de Início → Adicionar. Se aparecer, ative “Abrir como App da Web”.')}else{alert('Use o menu do navegador e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.')}};
    box.querySelector('.eddu-pwa-close').onclick=function(){box.remove();sessionStorage.setItem('eddu_pwa_dismissed','1')};
  }
  ensureMeta();css();
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});
  window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.getElementById('eddu-pwa-install')?.remove()});
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('EDDU PWA',e)));
  let n=0;const t=setInterval(()=>{n++;try{if(window.app&&(app.role==='client'||app.role==='pro')){clearInterval(t);if(app.role==='client')setTimeout(show,700)}}catch(e){}if(n>60)clearInterval(t)},500);
})();
