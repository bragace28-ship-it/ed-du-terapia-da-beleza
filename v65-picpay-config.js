/* V65 — Loads only the public PicPay Transparent SDK credentials after authenticated boot. */
(function(){
'use strict';
const URL='https://cwdpwfzsasdsetthmpoa.supabase.co';
const KEY='sb_publishable_sPtr9cgaWgTAK4ooUkNpxg_5qI2erGj';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
  for(let i=0;i<80;i++){
    const S=window.__EDDU_SB;
    if(S?.auth){
      const {data}=await S.auth.getSession();
      const token=data?.session?.access_token;
      if(token){
        try{
          const r=await fetch(URL+'/functions/v1/picpay-public-config',{headers:{Authorization:'Bearer '+token,apikey:KEY}});
          const j=await r.json().catch(()=>({}));
          if(r.ok&&j.merchantCredential&&j.transparentToken){window.EDDU_PICPAY_CONFIG=j;window.EDDU_PICPAY_CONFIG_READY=true;return;}
          console.warn('[EDDU V65]',j.error||'Configuração pública PicPay indisponível.');
          return;
        }catch(e){console.warn('[EDDU V65]',e)}
      }
    }
    await wait(250);
  }
}
run();
})();
