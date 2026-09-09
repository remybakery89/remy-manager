/* F&B Manager V10 — production domain UI
   Phase 9: production presentation is isolated behind a stable domain facade.
   The canonical business/render implementation remains in index.html during the safe
   extraction phase so behavior is unchanged while dependencies are being mapped.
*/
(function(){
  'use strict';

  function setActive(page,title){
    document.getElementById('topTitle').textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  }

  function renderProduction(){
    const html=typeof window.productionRound4==='function'?window.productionRound4():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive('production','Sản xuất');
  }

  window.FNB_PRODUCTION_UI={renderProduction};
})();
