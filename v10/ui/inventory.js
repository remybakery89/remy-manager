/* F&B Manager V10 — inventory domain UI
   Phase 9: inventory presentation is isolated behind a stable domain facade.
   The canonical business/render implementation remains in index.html during the safe
   extraction phase so behavior is unchanged while dependencies are being mapped.
*/
(function(){
  'use strict';

  function setActive(page,title){
    document.getElementById('topTitle').textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  }

  function renderInventory(){
    const html=typeof window.inventoryRound4==='function'?window.inventoryRound4():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive('inventory','Kho');
  }

  window.FNB_INVENTORY_UI={renderInventory};
})();
