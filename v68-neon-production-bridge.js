/* V68 — Neon Auth + Data API bridge.
 * Keeps the existing Supabase-shaped application API while moving authority to Neon.
 * No secrets are stored here; Auth and Data API URLs are public endpoints.
 */
(function(){
  'use strict';
  const AUTH_URL='https://ep-sweet-meadow-b43jne0i.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
  const DATA_API_URL='https://ep-sweet-meadow-b43jne0i.apirest.c-6.us-east-2.aws.neon.tech/neondb/rest/v1';
  let clientPromise=null;
  async function ensureProfile(client,user){
    if(!user?.id)return;
    try{
      const current=await client.from('profiles').select('id,full_name,phone,role,active,avatar_url').eq('id',user.id).maybeSingle();
      if(!current.data){
        await client.from('profiles').insert({id:user.id,full_name:user.name||user.email?.split('@')[0]||'Cliente',role:'client',active:true});
      }
    }catch(e){console.warn('[EDDU Neon] profile sync',e)}
  }
  async function installLegacyRpcBridge(client){
    const originalRpc=client.rpc?.bind(client);
    client.rpc=async function(name,args){
      if(name!=='get_command_center_v2')return originalRpc?originalRpc(name,args):{data:null,error:new Error('RPC não disponível no Neon Data API: '+name)};
      try{
        const [profile,cl,sv,pr,co,ci,cp,pm]=await Promise.all([
          client.auth.getUser(),
          client.from('clients').select('*').order('name'),
          client.from('services').select('*').order('name'),
          client.from('professionals').select('*').order('name'),
          client.from('commands').select('*').order('created_at',{ascending:false}),
          client.from('command_items').select('*'),
          client.from('command_payments').select('*'),
          client.from('payment_methods').select('*').eq('active',true).order('name')
        ]);
        const first=[profile,cl,sv,pr,co,ci,cp,pm].find(x=>x?.error);
        if(first)return {data:null,error:first.error};
        const role=profile?.data?.user?.id ? (await client.from('profiles').select('role').eq('id',profile.data.user.id).maybeSingle()) : {data:null,error:null};
        if(role.error)return {data:null,error:role.error};
        return {data:{commands:co.data||[],command_items:ci.data||[],clients:cl.data||[],services:sv.data||[],professionals:pr.data||[],payments:cp.data||[],payment_methods:pm.data||[],role:role.data?.role==='client'?'client':'pro'},error:null};
      }catch(error){return {data:null,error}};
    };
  }
  async function load(){
    if(window.__EDDU_NEON_CLIENT)return window.__EDDU_NEON_CLIENT;
    if(clientPromise)return clientPromise;
    clientPromise=import('https://esm.sh/@neondatabase/neon-js@0.7.0-beta').then(async ({createClient,SupabaseAuthAdapter})=>{
      const client=createClient({auth:{adapter:SupabaseAuthAdapter(),url:AUTH_URL},dataApi:{url:DATA_API_URL}});
      const originalGetUser=client.auth.getUser.bind(client.auth);
      client.auth.getUser=async function(){const r=await originalGetUser();if(r?.data?.user)await ensureProfile(client,r.data.user);return r};
      await installLegacyRpcBridge(client);
      window.__EDDU_NEON_CLIENT=client;
      window.__EDDU_SB=client;
      window.supabase=window.supabase||{};
      window.supabase.createClient=()=>client;
      window.__EDDU_DATA_AUTHORITY='neon';
      const session=await client.auth.getSession();
      if(session?.data?.session?.user)await ensureProfile(client,session.data.session.user);
      return client;
    });
    return clientPromise;
  }
  window.__EDDU_NEON_READY=load();
  load().catch(e=>{console.error('[EDDU Neon] bootstrap failed',e);window.__EDDU_NEON_ERROR=e});
})();
