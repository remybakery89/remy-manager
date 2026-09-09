/* F&B Manager V10 — pricing/settings UI integration
   Phase 7: pricing-related UI compatibility rules live here.
   Business/data logic remains in the existing application code until its domain is mapped.
*/
(function(){
  'use strict';

  function renderPricingSettings(){
    try{
      const html=typeof settingsRound2==='function'?settingsRound2():'';
      if(!html){toast('Không tải được màn Giá bán');return;}
      const v=document.getElementById('view');
      if(v)v.innerHTML=html;
      document.getElementById('topTitle').textContent='Cài đặt';
      document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='settings'));
    }catch(e){console.error('pricing settings',e);toast('Không mở được phần Giá bán')}
  }

  document.addEventListener('click',function(e){
    const b=e.target.closest?.('button[data-page="settings"]');
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    renderPricingSettings();
  },true);
})();
