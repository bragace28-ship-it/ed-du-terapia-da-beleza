/* V69.1 — Production shell safety without hiding the approved application. */
(function(){
  'use strict';
  const state={lastInput:0};
  const mark=()=>{state.lastInput=Date.now()};
  ['pointerdown','click','touchstart','keydown'].forEach(ev=>document.addEventListener(ev,mark,true));
  const explicit=()=>Date.now()-state.lastInput<10000;
  const root=()=>document.getElementById('root');
  function showRoot(){
    const r=root();
    if(!r)return;
    if(r.dataset.edduRuntime==='blocked')return;
    r.style.visibility='visible';
    r.style.opacity='1';
  }
  function protectSecondary(){
    const v46=document.getElementById('v46');
    if(v46&&v46.classList.contains('on')&&!explicit())v46.classList.remove('on');
    const v60=document.getElementById('v60');
    if(v60&&!explicit())v60.remove();
  }
  function boot(){
    showRoot();
    protectSecondary();
    /* If the auth layer did not mount, ask the existing V16 auth controller to mount it. */
    setTimeout(()=>{
      showRoot();
      if(!document.getElementById('v16-auth')){
        try{window.EDDU_AUTH?.bootUser?.(false)}catch(e){console.warn('[EDDU V69] auth fallback',e)}
      }
    },350);
    setTimeout(()=>{showRoot();protectSecondary()},1500);
    setTimeout(()=>{showRoot();protectSecondary()},5000);
  }
  window.__EDDU_APP_SHELL_GUARD={version:'V69.1',enforce:()=>{showRoot();protectSecondary()}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
