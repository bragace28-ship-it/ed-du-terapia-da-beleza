/* V16.8 — private clinical photo storage. Keeps V13.1/V15 UI untouched. */
(function(){
  const wait=fn=>{if(window.__EDDU_SB&&window.EDDU_AUTH?.getUser())fn();else setTimeout(()=>wait(fn),300)};
  async function clientById(id){const r=await window.__EDDU_SB.from('clients').select('id').eq('id',id).maybeSingle();return r.data||null}
  async function uploadPhotos(clientId,recordId,files){
    const c=await clientById(clientId);if(!c||!files?.length)return[];
    const sb=window.__EDDU_SB,u=window.EDDU_AUTH.getUser(),out=[];
    for(const file of Array.from(files)){
      if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10*1024*1024)continue;
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
      const path=`${clientId}/${recordId||crypto.randomUUID()}/${crypto.randomUUID()}.${ext}`;
      const up=await sb.storage.from('client-photos').upload(path,file,{contentType:file.type,upsert:false});
      if(up.error){console.warn('EDDU photo upload',up.error);continue}
      const row=await sb.from('client_photos').insert({client_id:clientId,record_id:recordId||null,storage_path:path,caption:file.name,created_by:u.id}).select('*').single();
      if(!row.error)out.push(row.data);
    }
    return out;
  }
  async function signedUrl(path,seconds=900){if(!path)return null;const r=await window.__EDDU_SB.storage.from('client-photos').createSignedUrl(path,seconds);return r.data?.signedUrl||null}
  window.EDDU_STORAGE={uploadPhotos,signedUrl};
  wait(()=>{
    const orig=window.saveAnam;
    if(typeof orig!=='function'||orig.__v168)return;
    const w=function(){
      const args=arguments,id=args[0],client=db.clients?.find(x=>String(x.id)===String(id));
      const input=document.getElementById('af');const files=input?.files;
      const result=orig.apply(this,args);
      Promise.resolve(result).then(async()=>{
        if(!client||!files?.length)return;
        const rec=await window.EDDU_CLINICAL?.saveRecord({client_id:client.id,record_at:((document.getElementById('ad')?.value||new Date().toISOString().slice(0,10))+'T'+(document.getElementById('at')?.value||'00:00')+':00'),procedure:client.anam||'',observations:document.getElementById('ax')?.value?.trim()||'',anamnesis:client.anam||''});
        if(rec)await uploadPhotos(client.id,rec.id,files);
      }).catch(e=>console.warn('EDDU storage',e));
      return result;
    };
    w.__v168=true;window.saveAnam=w;
  });
})();
