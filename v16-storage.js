/* V17.8 — private clinical photo storage. UI layer controls when photos are attached. */
(function(){
  async function clientById(id){
    const r=await window.__EDDU_SB.from('clients').select('id').eq('id',id).maybeSingle();
    return r.data||null;
  }
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
  async function signedUrl(path,seconds=900){
    if(!path)return null;
    const r=await window.__EDDU_SB.storage.from('client-photos').createSignedUrl(path,seconds);
    return r.data?.signedUrl||null;
  }
  window.EDDU_STORAGE={uploadPhotos,signedUrl};
})();
