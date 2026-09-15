/* ED&DU production self-host preload. Loaded before the existing frontend stack. */
(function(){
  'use strict';
  const legacy='https://cwdpwfzsasdsetthmpoa.supabase.co';
  let cfg={supabaseUrl:location.origin+'/supabase',supabasePublishableKey:'__SET_ON_SERVER__'};
  try{
    const x=new XMLHttpRequest();
    x.open('GET','/eddu-selfhost-config.json?ts='+Date.now(),false);
    x.send(null);
    if(x.status>=200&&x.status<300) cfg=Object.assign(cfg,JSON.parse(x.responseText));
  }catch(e){console.error('[EDDU] self-host config load failed',e)}
  window.EDDU_SELFHOST_CONFIG=cfg;
  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    try{
      const u=typeof input==='string'?input:input?.url;
      if(u&&u.startsWith(legacy)){
        const nu=cfg.supabaseUrl+u.slice(legacy.length);
        const headers=new Headers(init?.headers || (input instanceof Request?input.headers:undefined));
        if(headers.has('apikey')) headers.set('apikey',cfg.supabasePublishableKey);
        if(typeof input==='string') return originalFetch(nu,Object.assign({},init,{headers}));
        return originalFetch(new Request(nu,input),Object.assign({},init,{headers}));
      }
    }catch(e){console.warn('[EDDU] request rewrite failed',e)}
    return originalFetch(input,init);
  };
  function patch(){
    if(!window.supabase?.createClient) return false;
    const native=window.supabase.createClient;
    if(native.__edduSelfHosted)return true;
    const wrapped=function(url,key,options){
      const nextUrl=url===legacy?cfg.supabaseUrl:url;
      const nextKey=(key==='sb_publishable_sPtr9cgaWgTAK4ooUkNpxg_5qI2erGj')?cfg.supabasePublishableKey:key;
      return native.call(this,nextUrl,nextKey,options);
    };
    wrapped.__edduSelfHosted=true;
    window.supabase.createClient=wrapped;
    window.__EDDU_SELFHOST_READY=true;
    return true;
  }
  let n=0; const timer=setInterval(()=>{if(patch()||++n>100)clearInterval(timer)},10); patch();
})();
