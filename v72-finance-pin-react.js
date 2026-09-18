(function(){
'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const key='eddu_finance_pin_verified';
async function neon(){if(window.__EDDU_SB)return window.__EDDU_SB;if(window.__EDDU_NEON_READY)return await window.__EDDU_NEON_READY;throw new Error('Neon não inicializado.');}
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
  if(result.data===true||result.data?.[0]===true){sessionStorage.setItem(key,'1');return true;}
  alert('PIN financeiro inválido.');
  return false;
}
function isFinanceButton(el){const t=String(el?.textContent||'').trim().toLowerCase();return t==='financeiro'||t.includes('financeiro');}
function bind(){document.addEventListener('click',async e=>{const el=e.target.closest('button');if(!el||!isFinanceButton(el))return;if(sessionStorage.getItem(key)==='1')return;e.preventDefault();e.stopImmediatePropagation();try{if(await verify()){sessionStorage.setItem(key,'1');el.click()}}catch(err){console.error('[EDDU finance PIN]',err);alert(err?.message||'Não foi possível validar o PIN financeiro.')}},true);}
async function boot(){for(let i=0;i<120;i++){if(window.__EDDU_SB||window.__EDDU_NEON_READY)break;await wait(100)}bind();}
boot();
})();