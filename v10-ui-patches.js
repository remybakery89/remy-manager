/* F&B Manager V10 — UI integration layer
   Keeps remaining temporary UI compatibility rules separate from the online data/auth engine.
   Domain UI integrations now live in v10/ui/*.js.
*/
(function(){
  'use strict';

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
      if(page==='settings'&&window.FNB_SETTINGS_UI?.renderSettings)return window.FNB_SETTINGS_UI.renderSettings();
      if(page==='recipes'&&window.FNB_RECIPE_UI?.renderRecipes)return window.FNB_RECIPE_UI.renderRecipes();
      if(page==='ingredients'&&window.FNB_INGREDIENTS_UI?.renderIngredients)return window.FNB_INGREDIENTS_UI.renderIngredients();
      if(page==='inventory'&&window.FNB_INVENTORY_UI?.renderInventory)return window.FNB_INVENTORY_UI.renderInventory();
      if(page==='production'&&window.FNB_PRODUCTION_UI?.renderProduction)return window.FNB_PRODUCTION_UI.renderProduction();
      if(page==='customers'&&window.FNB_CUSTOMERS_UI?.renderCustomers)return window.FNB_CUSTOMERS_UI.renderCustomers();
      if(page==='pos'&&window.FNB_SALES_UI?.renderSales)return window.FNB_SALES_UI.renderSales();
      if(page==='cashflow'&&window.FNB_CASHFLOW_UI?.renderCashflow)return window.FNB_CASHFLOW_UI.renderCashflow();
      if(page==='employees'&&window.FNB_EMPLOYEES_UI?.renderEmployees)return window.FNB_EMPLOYEES_UI.renderEmployees();
      if(page==='alerts'&&window.FNB_ALERTS_UI?.renderAlerts)return window.FNB_ALERTS_UI.renderAlerts();
      return baseRender(page);
    };
  }

  // V8 binds customer, employee and settings navigation buttons directly to legacy renderers.
  // Rebind extracted domain facades after all modules have loaded.
  const customerButton=document.querySelector('.nav button[data-page="customers"]');
  if(customerButton&&window.FNB_CUSTOMERS_UI?.renderCustomers){
    customerButton.onclick=function(e){
      e.preventDefault();
      window.FNB_CUSTOMERS_UI.renderCustomers();
      if(typeof closeMenu==='function')closeMenu();
    };
  }

  const employeeButton=document.querySelector('.nav button[data-page="employees"]');
  if(employeeButton&&window.FNB_EMPLOYEES_UI?.renderEmployees){
    employeeButton.onclick=function(e){
      e.preventDefault();
      window.FNB_EMPLOYEES_UI.renderEmployees();
      if(typeof closeMenu==='function')closeMenu();
    };
  }

  const settingsButton=document.querySelector('.nav button[data-page="settings"]');
  if(settingsButton&&window.FNB_SETTINGS_UI?.renderSettings){
    settingsButton.onclick=function(e){
      e.preventDefault();
      window.FNB_SETTINGS_UI.renderSettings();
      if(typeof closeMenu==='function')closeMenu();
    };
  }
})();
