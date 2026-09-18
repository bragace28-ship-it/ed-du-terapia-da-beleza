(function(){
'use strict';
const HOMOLOGATION_BYPASS=true;
if(HOMOLOGATION_BYPASS){console.warn('[EDDU] Finance PIN temporarily bypassed for homologation. Re-enable v72 before production security sign-off.');return;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const timestampKey='eddu_finance_pin_timestamp';
const ttl=86400000;
async function neon(){if(window.__EDDU_SB)return window.__EDDU_SB;if(window.__EDDU_NEON_READY)return await window.__EDDU_NEON_READY;throw new Error('Neon não inicializado.');}
function hasValidTimestamp(){try{const raw=localStorage.getItem(timestampKey);if(!raw)return false;const ts=Number(raw);if(!Number.isFinite(ts)||Date.now()-ts>=ttl){localStorage.removeItem(timestampKey);return false}return true}catch(e){return false}}
async function verify(){
  const c=await neon();
  const status=await c.rpc('finance_pin_status');
  if(status.error)throw status.error;
  const row=Array.isArray(status.data)?status.data[0]:status.data;
  if(!row?.enabled){alert('O PIN financeiro ainda não foi configurado para este usuário.');return false;}
  const pin=window.prompt('Digite seu PIN financeiro (4 a 6 dígitos):');
  if(pin===null)return false;
  const result=await c.rpc('verify_finance_pin',{p_pin:String(pin).trim()});
  if(result.error)throw result.error;
  if(result.data===true||result.data?.[0]===true){try{localStorage.setItem(timestampKey,String(Date.now()))}catch(e){}return true;}
  alert('PIN financeiro inválido.');
  return false;
}
function isFinanceButton(el){const t=String(el?.textContent||'').trim().toLowerCase();return t==='financeiro'||t.includes('financeiro');}
function bind(){document.addEventListener('click',async e=>{const el=e.target.closest('button');if(!el||!isFinanceButton(el))return;if(hasValidTimestamp())return;e.preventDefault();e.stopImmediatePropagation();try{if(await verify()){el.click()}}catch(err){console.error('[EDDU finance PIN]',err);alert(err?.message||'Não foi possível validar o PIN financeiro.')}},true);}
async function boot(){for(let i=0;i<120;i++){if(window.__EDDU_SB||window.__EDDU_NEON_READY)break;await wait(100)}bind();}
boot();
})();