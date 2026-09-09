/* F&B Manager V10 — UI integration layer
   Keeps remaining temporary UI compatibility rules separate from the online data/auth engine.
   Dashboard, reports, pricing, recipe, ingredient, inventory, and production UI integrations
   now live in v10/ui/*.js.
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
      if(page==='products'&&window.FNB_PRICING_UI?.renderProducts)return window.FNB_PRICING_UI.renderProducts();
      if(page==='settings'&&window.FNB_PRICING_UI?.renderPricingSettings)return window.FNB_PRICING_UI.renderPricingSettings();
      if(page==='recipes'&&window.FNB_RECIPE_UI?.renderRecipes)return window.FNB_RECIPE_UI.renderRecipes();
      if(page==='ingredients'&&window.FNB_INGREDIENTS_UI?.renderIngredients)return window.FNB_INGREDIENTS_UI.renderIngredients();
      if(page==='inventory'&&window.FNB_INVENTORY_UI?.renderInventory)return window.FNB_INVENTORY_UI.renderInventory();
      if(page==='production'&&window.FNB_PRODUCTION_UI?.renderProduction)return window.FNB_PRODUCTION_UI.renderProduction();
      return baseRender(page);
    };
  }
})();
