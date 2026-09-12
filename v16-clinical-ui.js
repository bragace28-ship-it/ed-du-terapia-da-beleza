/* V16.8 — UI bridge for clinical records and responsibility term. */
(function(){
  const wait=fn=>{if(window.EDDU_CLINICAL&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
  function wrap(name,fn){const o=window[name];if(typeof o!=='function'||o.__edduClinicalUI)return;const w=function(){const args=arguments;const r=o.apply(this,args);Promise.resolve(r).then(()=>fn.apply(this,args)).catch(e=>console.warn('EDDU clinical UI',name,e));return r};w.__edduClinicalUI=true;window[name]=w}
  wait(()=>{
    wrap('saveAnam',async function(id){const c=db.clients.find(x=>String(x.id)===String(id));if(!c)return;const date=document.getElementById('ad')?.value,time=document.getElementById('at')?.value,desc=document.getElementById('ax')?.value?.trim();if(!date||!time||!desc)return;const r=await window.EDDU_CLINICAL.saveRecord({client_id:c.id,record_at:date+'T'+time+':00',procedure:c.anam||'',observations:desc,anamnesis:c.anam||''});if(r){c.anams=c.anams||[];c.anams.unshift({id:r.id,date,time,desc,photos:0});window.EDDU_RECORDS=window.EDDU_RECORDS||[];window.EDDU_RECORDS.unshift(r)}});
    wrap('acceptTerm',async function(){const r=await window.EDDU_CLINICAL.acceptTerm();if(!r?.error){window.EDDU_TERM_STATUS=await window.EDDU_CLINICAL.termStatus();const c=db.clients.find(x=>x.user_id===window.EDDU_AUTH.getUser()?.id);if(c)c.term=true;save()}});
    wrap('acceptTermModal',async function(){const r=await window.EDDU_CLINICAL.acceptTerm();if(!r?.error){window.EDDU_TERM_STATUS=await window.EDDU_CLINICAL.termStatus();const c=db.clients.find(x=>x.user_id===window.EDDU_AUTH.getUser()?.id);if(c)c.term=true;save()}});
  });
})();
