/* F&B Manager V10 — UI integration layer
   Keeps remaining temporary UI compatibility rules separate from the online data/auth engine.
   Dashboard, reports, pricing, recipe, and ingredient UI integrations now live in v10/ui/*.js.
*/
(function(){
  'use strict';

  /*
    index.html still contains historical renderers. Route extracted V10 domains
    through their canonical module facades without deleting legacy implementations yet.
  */
  const baseRender=window.render;
  if(typeof baseRender==='function'){
    window.render=function(page){
      const v=document.getElementById('view');
      if(page==='dashboard'&&window.FNB_DASHBOARD_UI?.render){
        if(v)v.innerHTML=window.FNB_DASHBOARD_UI.render();
        document.getElementById('topTitle').textContent='Trang chủ';
        document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='dashboard'));
        return;
      }
      if(page==='reports'&&window.FNB_REPORTS_UI?.render){
        if(v)v.innerHTML=window.FNB_REPORTS_UI.render();
        document.getElementById('topTitle').textContent='Báo cáo';
        document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='reports'));
        return;
      }
      if(page==='products'&&window.FNB_PRICING_UI?.renderProducts){
        return window.FNB_PRICING_UI.renderProducts();
      }
      if(page==='settings'&&window.FNB_PRICING_UI?.renderPricingSettings){
        return window.FNB_PRICING_UI.renderPricingSettings();
      }
      return baseRender(page);
    };
  }
})();
