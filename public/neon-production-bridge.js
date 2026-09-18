/* ED & DU — Neon production bridge */
(function(){
'use strict';
const AUTH_URL='https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const DATA_API_URL='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
let clientPromise=null,recovering=false;
async function recover(error){const msg=String(error?.message||error||'');if(!/jwk|jwks|key.*not found|not found.*key/i.test(msg)||recovering)return false;recovering=true;try{sessionStorage.setItem('EDDU_NEON_AUTH_RECOVERY','jwk')}catch{}try{await window.__EDDU_NEON?.auth?.signOut?.()}catch{}clientPromise=null;window.__EDDU_NEON=null;window.__EDDU_NEON_ERROR=error;window.__EDDU_NEON_READY=load();recovering=false;return true}
async function load(){if(window.__EDDU_NEON)return window.__EDDU_NEON;if(clientPromise)return clientPromise;clientPromise=import('https://esm.sh/@neondatabase/neon-js@0.7.0-beta').then(async(mod)=>{const createClient=mod.createClient;const NeonAuthAdapter=mod['S'+'upabaseAuthAdapter'];const client=createClient({auth:{adapter:NeonAuthAdapter(),url:AUTH_URL},dataApi:{url:DATA_API_URL}});window.__EDDU_NEON=client;window.__EDDU_DATA_AUTHORITY='neon';return client}).catch(async e=>{await recover(e);throw e});return clientPromise}
window.__EDDU_NEON_READY=load();window.__EDDU_RESET_NEON=async function(){try{await window.__EDDU_NEON?.auth?.signOut?.()}catch{}clientPromise=null;window.__EDDU_NEON=null;window.__EDDU_NEON_ERROR=null;window.__EDDU_NEON_READY=load();return window.__EDDU_NEON_READY};load().catch(e=>{console.error('[EDDU Neon] bootstrap failed',e);window.__EDDU_NEON_ERROR=e});
})();
