/* EDDU QA — non-destructive runtime smoke checks. */
(function(){'use strict';
const checks=[];
const ok=(name,test)=>{try{checks.push({name,pass:!!test()})}catch(e){checks.push({name,pass:false,error:String(e?.message||e)})}};
ok('EDDU_AUTH exists',()=>!!window.EDDU_AUTH);
ok('Supabase client exists',()=>!!window.__EDDU_SB);
ok('production authority',()=>window.__EDDU_PRODUCTION_AUTHORITY===true);
ok('real data hydrated',()=>window.app?.__edduRealData===true);
ok('Smart Gateway client entry',()=>typeof window.EDDU_V50Pay==='function');
ok('V46 command center',()=>!!window.EDDU_V46);
ok('main close uses Smart Gateway',()=>window.__EDDU_MAIN_CLOSE_USES_SMART===true);
ok('role guard installed',()=>!!window.setRole?.__edduWrapped||!!window.setRole?.__edduV56);
window.EDDU_QA={run:()=>({timestamp:new Date().toISOString(),checks,passed:checks.filter(x=>x.pass).length,total:checks.length,failed:checks.filter(x=>!x.pass)})};
})();
