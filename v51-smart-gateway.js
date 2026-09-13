/* V51 — Smart Gateway: profissional escolhe o gateway; cliente escolhe apenas a forma de pagamento. */
(function(){
'use strict';
const GW={pagbank:'PagBank',stripe:'Stripe',asaas:'Asaas',picpay:'PicPay'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(){
  for(let i=0;i<80;i++){
    if(window.EDDU_V46){
      const V=window.EDDU_V46;
      const oldClose=V.closeCommand;
      const oldRequest=V.requestPay;
      const show=(html)=>{const b=document.querySelector('#v46modalbox'),m=document.querySelector('#v46modal');if(!b||!m)return; b.innerHTML=html;m.classList.add('on')};
      const closeModal=()=>V.closeModal?.();
      V.closeCommand=async function(id){
        if(!id)return;
        const cmd=(V._data?.commands||[]).find(x=>String(x.id)===String(id));
        let chosen=(cmd?.payment_gateway||'pagbank').toLowerCase();
        show('<h2>Gateway da cobrança</h2><p>Escolha onde o <b>cartão de crédito</b> desta comanda será processado.</p><div class="v46paygrid">'+Object.keys(GW).map(k=>'<button class="v46pay" data-gw="'+k+'"><b>'+GW[k]+'</b><small>Cartão → '+GW[k]+'</small></button>').join('')+'</div><div class="v46notice"><b>Pix permanece PagBank.</b> O cliente não verá esta escolha.</div><div class="v46actions"><button class="v46btn" id="v51cancel">Cancelar</button></div>');
        document.querySelectorAll('[data-gw]').forEach(btn=>btn.onclick=async()=>{
          chosen=btn.dataset.gw;
          try{
            if(!window.__EDDU_SB) throw new Error('Conexão com o banco indisponível.');
            const r=await window.__EDDU_SB.rpc('set_command_payment_gateway',{p_command_id:id,p_gateway:chosen});
            if(r.error)throw new Error(r.error.message||'Não foi possível salvar o gateway.');
            closeModal();
            await oldClose.call(V,id);
          }catch(e){show('<h2>Não foi possível salvar</h2><div class="v46notice">'+String(e.message||e)+'</div><div class="v46actions"><button class="v46btn" id="v51back">Voltar</button></div>');document.querySelector('#v51back').onclick=()=>V.closeModal();}
        });
        document.querySelector('#v51cancel').onclick=()=>closeModal();
      };
      V.requestPay=async function(id,methodId,methodName){
        const name=String(methodName||'');
        const cmds=V._data?.commands||[]; const o=cmds.find(x=>String(x.id)===String(id));
        if(!o)return;
        closeModal();
        const invoke=V._invoke||null;
        try{
          const s=await window.__EDDU_SB.auth.getSession(); const token=s?.data?.session?.access_token;
          if(!token)throw new Error('Sessão expirada. Entre novamente.');
          const call=async(slug)=>{const r=await fetch('https://cwdpwfzsasdsetthmpoa.supabase.co/functions/v1/'+slug,{method:'POST',headers:{Authorization:'Bearer '+token,apikey:'sb_publishable_sPtr9cgaWgTAK4ooUkNpxg_5qI2erGj','Content-Type':'application/json'},body:JSON.stringify({command_id:id})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||j.message||'Falha ao iniciar pagamento.');return j};
          let slug;
          if(/pix/i.test(name)) slug='create-pix-charge';
          else if(/crédito|credit|cart[aã]o/i.test(name)){
            const gw=String(o.payment_gateway||'pagbank').toLowerCase();
            slug=gw==='asaas'?'create-asaas-checkout':gw==='stripe'?'create-stripe-checkout':gw==='picpay'?'create-picpay-checkout':'create-pix-charge';
          } else {
            if(typeof V.showManual==='function')return V.showManual(name,o);
            return;
          }
          if(slug==='create-picpay-checkout')throw new Error('PicPay será habilitado quando o checkout PicPay estiver conectado.');
          const j=await call(slug); if(!j.checkout_url)throw new Error('O gateway não retornou um link de checkout.'); location.href=j.checkout_url;
        }catch(e){
          const b=document.querySelector('#v46modalbox'),m=document.querySelector('#v46modal');if(b&&m){b.innerHTML='<h2>Pagamento</h2><div class="v46notice">'+String(e.message||e)+'</div><div class="v46actions"><button class="v46btn" id="v51err">Fechar</button></div>';m.classList.add('on');document.querySelector('#v51err').onclick=()=>V.closeModal();}
        }
      };
      return;
    }
    await sleep(250);
  }
}
boot();
})();
