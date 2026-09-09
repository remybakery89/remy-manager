/* F&B Manager V10 — pricing/products UI integration
   Phase 8: canonical product pricing presentation is isolated behind this domain facade.
   The current business/render implementations remain in index.html during the safe
   extraction phase; this module owns the integration boundary so the renderer can be
   moved here without changing behavior.
*/
(function(){
  'use strict';

  function setActive(page,title){
    document.getElementById('topTitle').textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  }

  function renderProducts(){
    const html=typeof window.productsRound2==='function'?window.productsRound2():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive('products','Sản phẩm');
  }

  function renderPricingSettings(){
    try{
      const html=typeof window.settingsRound2==='function'?window.settingsRound2():'';
      if(!html){toast('Không tải được màn Giá bán');return;}
      const v=document.getElementById('view');
      if(v)v.innerHTML=html;
      setActive('settings','Cài đặt');
    }catch(e){console.error('pricing settings',e);toast('Không mở được phần Giá bán')}
  }

  window.FNB_PRICING_UI={renderProducts,renderPricingSettings};

  document.addEventListener('click',function(e){
    const b=e.target.closest?.('button[data-page="settings"]');
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    renderPricingSettings();
  },true);
})();
