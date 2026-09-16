/* V68 — Neon Auth + Data API bridge.
 * Keeps the existing Supabase-shaped application API while moving authority to Neon.
 * No secrets are stored here; Auth and Data API URLs are public endpoints.
 */
(function(){
  'use strict';
  const AUTH_URL='https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
  const DATA_API_URL='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
  let clientPromise=null;
  async function load(){
    if(window.__EDDU_NEON_CLIENT)return window.__EDDU_NEON_CLIENT;
    if(clientPromise)return clientPromise;
    clientPromise=import('https://esm.sh/@neondatabase/neon-js@0.7.0-beta').then(({createClient,SupabaseAuthAdapter})=>{
      const client=createClient({
        auth:{adapter:SupabaseAuthAdapter(),url:AUTH_URL},
        dataApi:{url:DATA_API_URL}
      });
      window.__EDDU_NEON_CLIENT=client;
      window.supabase=window.supabase||{};
      window.supabase.createClient=()=>client;
      window.__EDDU_DATA_AUTHORITY='neon';
      return client;
    });
    return clientPromise;
  }
  load().catch(e=>{console.error('[EDDU Neon] bootstrap failed',e);window.__EDDU_NEON_ERROR=e});
})();
