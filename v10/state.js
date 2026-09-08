/* F&B Manager V10 — shared runtime state
   Phase 1 of the core refactor: state ownership is isolated here so the
   remaining auth/sync engine can migrate without changing application behavior.
*/
(function(){
  'use strict';

  const config=window.FNB_CONFIG||{};

  const EMPTY_DB={
    ingredients:[],
    batches:[],
    recipes:[],
    recipeHistory:[],
    products:[],
    plans:[],
    inventoryHistory:[],
    purchaseReceipts:[],
    sales:[],
    vouchers:[],
    cash:[],
    debts:[],
    shifts:[],
    reconciliations:[],
    customers:[],
    customerGroups:[],
    loyaltySettings:[],
    employees:[],
    roles:[],
    priceHistory:[],
    priceAlerts:[],
    settings:{
      ...(config.SETTINGS_DEFAULTS||{tax:8,profit:35,packaging:2000,overhead:8})
    }
  };

  function emptyDb(){
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }

  window.FNB_RUNTIME={
    state:{
      user:null,
      employee:null,
      branchId:config.BRANCH_DEFAULT||'MAIN',
      lastSync:null,
      busy:false,
      online:navigator.onLine!==false,
      pending:false
    },
    EMPTY_DB:EMPTY_DB,
    emptyDb:emptyDb
  };
})();
