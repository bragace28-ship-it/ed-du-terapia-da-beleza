/* Master V46: prevent undefined/empty sheet content without changing the approved visual baseline. */
(function(){
  'use strict';
  if(typeof views==='undefined'||typeof window.openSheet!=='function') return;
  const fallback="<div class=\"card\" role=\"alert\"><h2>Seção temporariamente indisponível</h2><p class=\"sub\">Não foi possível abrir esta área do sistema. Nenhum dado foi alterado. Feche esta janela e tente outra opção.</p><button class=\"btn primary full\" onclick=\"closeSheet()\">Fechar</button></div>";
  const originalOpenSheet=window.openSheet.bind(window);
  window.openSheet=function(key){
    try{
      const current=views[key];
      if(typeof current==='function'){
        views[key]=function(){
          let result;
          try{result=current()}catch(error){console.error('[EDDU] Sheet render failed:',key,error)}
          if(typeof result==='string'&&result.trim()) return result;
          console.error('[EDDU] Missing/empty sheet content:',key);
          return fallback;
        };
      }else if(typeof current!=='string'||!current.trim()){
        console.error('[EDDU] Unknown sheet route:',key);
        views[key]=()=>fallback;
      }
    }catch(error){
      console.error('[EDDU] Sheet guard failed:',key,error);
      views[key]=()=>fallback;
    }
    return originalOpenSheet(key);
  };
})();