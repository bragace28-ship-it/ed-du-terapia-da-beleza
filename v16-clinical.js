/* V16.9 — clinical layer. Preserves V13.1/V15 UI. */
(function(){
  const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
  async function client(){const u=window.EDDU_AUTH.getUser();if(!u)return null;const r=await window.__EDDU_SB.from('clients').select('*').eq('user_id',u.id).maybeSingle();return r.data||null}
  async function loadRecords(clientId){const c=clientId?{id:clientId}:await client();if(!c)return[];const r=await window.__EDDU_SB.from('client_records').select('*,client_photos(*)').eq('client_id',c.id).order('record_at',{ascending:false});window.EDDU_RECORDS=r.error?[]:(r.data||[]);return window.EDDU_RECORDS}
  async function activeTerm(){const r=await window.__EDDU_SB.from('responsibility_terms').select('*').eq('active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();return r.data||null}
  async function termStatus(){const c=await client(),t=await activeTerm();if(!c||!t)return{accepted:false,term:t};const r=await window.__EDDU_SB.from('term_acceptances').select('id,accepted_at').eq('term_id',t.id).eq('client_id',c.id).maybeSingle();return{accepted:!!r.data,accepted_at:r.data?.accepted_at||null,term:t}}
  async function acceptTerm(){const c=await client(),t=await activeTerm();if(!c||!t)return{error:{message:'Cliente ou termo não encontrado'}};return await window.__EDDU_SB.from('term_acceptances').upsert({term_id:t.id,client_id:c.id,accepted_at:new Date().toISOString(),user_agent:navigator.userAgent},{onConflict:'term_id,client_id'}).select('*').single()}
  async function saveRecord(data){const u=window.EDDU_AUTH.getUser();if(!u||!data?.client_id)return null;const row={p_client_id:data.client_id,p_appointment_id:data.appointment_id||null,p_record_at:data.record_at||new Date().toISOString(),p_procedure:data.procedure||'',p_observations:data.observations||'',p_anamnesis:data.anamnesis||'',p_record_id:data.id||null};const r=await window.__EDDU_SB.rpc('save_client_record',row);if(!r.error)await loadRecords(data.client_id);return r.data||null}
  window.EDDU_CLINICAL={loadRecords,activeTerm,termStatus,acceptTerm,saveRecord};
  wait(async()=>{try{await loadRecords();window.EDDU_TERM=await activeTerm();window.EDDU_TERM_STATUS=await termStatus()}catch(e){console.warn('EDDU clinical',e)}});
})();
