/* F&B Manager V10 — single browser entry point
   Load shared core modules first, then the online data/sync engine,
   authentication, compatibility facade, and isolated UI integration modules.
   index.html keeps loading only this file.
*/
(function(){
  'use strict';

  const modules=[
    './v10/config.js?v=1001',
    './v10/state.js?v=1001',
    './v10/api.js?v=1001',
    './v10-sync-base.js?v=1008',
    './v10/sync.js?v=1003',
    './v10/auth.js?v=1003',
    './v10/compatibility.js?v=1003',
    './v10/ui/dashboard.js?v=1001',
    './v10/ui/reports.js?v=1001',
    './v10/ui/pricing.js?v=1001',
    './v10/ui/recipes.js?v=1001',
    './v10/ui/ingredients.js?v=1001',
    './v10/ui/inventory.js?v=1001',
    './v10/ui/production.js?v=1001',
    './v10/ui/customers.js?v=1002',
    './v10/ui/sales.js?v=1002',
    './v10/ui/cashflow.js?v=1001',
    './v10/ui/employees.js?v=1001',
    './v10/ui/alerts.js?v=1001',
    './v10/ui/settings.js?v=1001',
    './v10-ui-patches.js?v=1003'
  ];

  function load(index){
    if(index>=modules.length)return;
    const s=document.createElement('script');
    s.src=modules[index];
    s.onload=function(){load(index+1)};
    s.onerror=function(){console.error('V10 module load failed:',modules[index])};
    document.head.appendChild(s);
  }

  load(0);
})();
