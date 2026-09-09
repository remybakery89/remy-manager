/* F&B Manager V10 — UI integration layer
   Keeps the remaining temporary UI compatibility rule separate from the online data/auth engine.
   Pricing, recipe, and ingredient UI integrations now live in v10/ui/*.js.
*/
(function(){
  'use strict';

  /*
    index.html still contains a later V5 renderer which can overwrite the
    Round-2 product screen. Keep this compatibility rule in the UI layer.
  */
  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(page){
      if(page==='products'){
        const v=document.getElementById('view');
        if(v)v.innerHTML=typeof productsRound2==='function'?productsRound2():'';
        document.getElementById('topTitle').textContent='Sản phẩm';
        document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='products'));
        return;
      }
      return baseRender(page);
    };
  }
})();