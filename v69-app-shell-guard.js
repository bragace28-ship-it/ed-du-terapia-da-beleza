/* V69 — Full application shell guard.
 * Keeps the ED & DU main application as the default surface.
 * Secondary full-screen modules (commands/PDV) may open only from an explicit user action.
 */
(function(){
  'use strict';
  const state={lastInput:0, boot:Date.now()};
  const mark=()=>{state.lastInput=Date.now()};
  ['pointerdown','click','touchstart','keydown'].forEach(ev=>document.addEventListener(ev,mark,true));
  const explicit=()=>Date.now()-state.lastInput<1800;
  const root=()=>document.getElementById('root');
  const hideSecondary=(id)=>{
    const el=document.getElementById(id);
    if(!el)return;
    if(id==='v46' && el.classList.contains('on') && !explicit()) el.classList.remove('on');
    if(id==='v60' && !explicit()) el.remove();
  };
  const enforce=()=>{
    hideSecondary('v46');
    hideSecondary('v60');
    const r=root();
    if(r && window.__EDDU_PRODUCTION_AUTHORITY===true && r.dataset.edduRuntime!=='blocked'){
      r.style.visibility='visible';
      r.style.opacity='1';
    }
  };
  const observer=new MutationObserver(enforce);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  window.__EDDU_APP_SHELL_GUARD={version:'V69',enforce};
  setTimeout(enforce,0);
  setTimeout(enforce,250);
  setTimeout(enforce,1000);
})();
