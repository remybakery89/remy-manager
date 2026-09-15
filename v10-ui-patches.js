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

  // V10 data can contain records created by older versions without optional UI fields.
  // Normalize only the three fields required by the extracted Products/Recipes/Sales renderers.
  function normalizeUiData(page){
    try{
      if(typeof db==='undefined')return;
      if(page==='products'){
        db.products.forEach(p=>{if(!Array.isArray(p.components))p.components=[];});
      }else if(page==='recipes'){
        db.recipes.forEach(r=>{if(!Array.isArray(r.lines))r.lines=[];});
      }else if(page==='pos'){
        db.products.forEach(p=>{if(typeof p.name!=='string')p.name='';});
      }
    }catch(e){console.warn('V10 UI data normalization',e);}
  }

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

  const baseRefreshPermissions=window.v8RefreshPermissions;
  if(typeof baseRefreshPermissions==='function'){
    window.v8RefreshPermissions=function(){
      const state=window.FNB_RUNTIME?.state||{};
      const employee=state.employee;
      if(employee?.id){
        try{if(window.db)window.db.sessionEmployeeId=employee.id}catch(e){console.warn('V10 permission bridge',e)}
      }
      return baseRefreshPermissions();
    };
  }

  // Run normalization immediately before the extracted renderer is invoked.
  const renderWithUiData=window.render;
  if(typeof renderWithUiData==='function'){
    window.render=function(page){
      if(page==='products'||page==='recipes'||page==='pos')normalizeUiData(page);
      return renderWithUiData(page);
    };
  }

  // Keep the recipe line action reachable while the ingredient list is scrolled.
  function syncRecipeLineFab(){
    const old=document.getElementById('recipeLineFab');
    const add=document.querySelector('button[onclick^="addRecipeLineV31"]');
    if(!add){if(old)old.remove();return;}
    if(old)return;
    add.style.display='none';
    const fab=document.createElement('button');
    fab.id='recipeLineFab';
    fab.className='btn primary';
    fab.type='button';
    fab.textContent='+';
    fab.title='Thêm dòng';
    fab.setAttribute('aria-label','Thêm dòng');
    fab.style.cssText='position:fixed;right:24px;bottom:24px;z-index:10050;width:48px;height:48px;border-radius:50%;padding:0;font-size:28px;line-height:1;box-shadow:0 8px 24px rgba(0,0,0,.18);';
    fab.onclick=function(){if(typeof addRecipeLineV31==='function')addRecipeLineV31();};
    document.body.appendChild(fab);
  }

  // Mobile UX: the scaled-recipe table should fit the viewport without horizontal scrolling.
  // The original "Gốc" column is redundant here; keep only Thành phần, Sau scale, Đơn vị.
  function optimizeScaledRecipeTables(){
    document.querySelectorAll('.table-wrap table.table').forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')];
      const baseIndex=headers.findIndex(th=>th.textContent.trim()==='Gốc');
      if(baseIndex<0)return;
      table.querySelectorAll('tr').forEach(row=>{
        const cell=row.children[baseIndex];
        if(cell)cell.style.display='none';
      });
      table.style.width='100%';
      table.style.minWidth='0';
      table.style.tableLayout='fixed';
      table.querySelectorAll('th,td').forEach(cell=>{
        cell.style.whiteSpace='normal';
        cell.style.overflowWrap='anywhere';
      });
      const remaining=[...table.querySelectorAll('thead th')].filter(th=>th.style.display!=='none');
      if(remaining.length===3){
        remaining[0].style.width='56%';
        remaining[1].style.width='26%';
        remaining[2].style.width='18%';
      }
      const wrap=table.parentElement;
      if(wrap)wrap.style.overflowX='visible';
    });
  }

  if(typeof MutationObserver==='function'){
    new MutationObserver(()=>{
      syncRecipeLineFab();
      optimizeScaledRecipeTables();
    }).observe(document.body,{childList:true,subtree:true});
    syncRecipeLineFab();
    optimizeScaledRecipeTables();
  }
})();
