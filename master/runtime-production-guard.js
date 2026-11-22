/* ED & DU production payment guard — credentials and live checkout only. */
(function(){
  'use strict';
  const PAYMENT_PATH=/^\/api\/payments(?:\?|$)/;
  const DATA_PATH=/^\/api\/data\//;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    let url='';
    try{url=typeof input==='string'?input:(input&&input.url)||'';}catch(_){}
    let path=url;
    try{path=new URL(url,location.href).pathname+new URL(url,location.href).search;}catch(_){}
    if(PAYMENT_PATH.test(path)||DATA_PATH.test(path)) init={...(init||{}),credentials:'include'};
    return nativeFetch(input,init);
  };
  const LEGACY=/Pagamento\s+em\s+modo\s+de\s+teste\s*,?\s*sem\s+cobrança\s+real/gi;
  const LEGACY_ALT=/Nenhuma cobrança real é criada nesta tela\.?/gi;
  function cleanText(root){
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const before=node.nodeValue||'';
      const after=before.replace(LEGACY,'Cobrança processada pelo gateway selecionado.').replace(LEGACY_ALT,'As cobranças são criadas no gateway real selecionado.');
      if(after!==before)node.nodeValue=after;
    }
  }
  cleanText(document.documentElement);
  new MutationObserver(records=>records.forEach(record=>{
    if(record.type==='characterData')cleanText(record.target.parentNode);
    else record.addedNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE)cleanText(node.parentNode);else if(node.nodeType===Node.ELEMENT_NODE)cleanText(node);});
  })).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  window.EDDU_LIVE_PAYMENT_GUARD=true;
})();