/* V16.5 — prontuário, anamnese e termo digital. Mantém o layout V13.1/V15. */
(function(){
  const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
  async function client(){const u=window.EDDU_AUTH.getUser();if(!u)return null;const r=await window.__EDDU_SB.from('clients').select('*').eq('user_id',u.id).maybeSingle();return r.data||null}
  async function loadRecords(){const c=await client();if(!c)return;const r=await window.__EDDU_SB.from('client_records').select('*,client_photos(*)').eq('client_id',c.id).order('record_at',{ascending:false});window.EDDU_RECORDS=r.error?[]:(r.data||[]);return window.EDDU_RECORDS}
  async function activeTerm(){const r=await window.__EDDU_SB.from('responsibility_terms').select('*').eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();return r.data||null}
  async function acceptTerm(){const c=await client(),t=await activeTerm();if(!c||!t)return{error:'Cliente ou termo não encontrado'};const r=await window.__EDDU_SB.from('term_acceptances').upsert({term_id:t.id,client_id:c.id,accepted_at:new Date().toISOString(),user_agent:navigator.userAgent},{onConflict:'term_id,client_id'});return r}
  async function saveRecord(data){const c=await client();if(!c)return null;const row={client_id:c.id,appointment_id:data.appointment_id||null,record_at:data.record_at||new Date().toISOString(),procedure:data.procedure||'',observations:data.observations||'',anamnesis:data.anamnesis||'',created_by:window.EDDU_AUTH.getUser().id};const r=await window.__EDDU_SB.from('client_records').insert(row).select('*').single();if(!r.error)await loadRecords();return r.data||null}
  window.EDDU_CLINICAL={loadRecords,activeTerm,acceptTerm,saveRecord};
  wait(async()=>{await loadRecords();window.EDDU_TERM=await activeTerm();});
})();