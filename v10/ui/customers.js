/* F&B Manager V10 — Customers domain UI facade
   Phase 9: the customer domain is now exposed through one stable boundary.
   Business rules remain in the legacy V8 implementation until every call-site
   is migrated; this file must not duplicate customer/loyalty/debt logic.
*/
(function(){
  'use strict';

  function call(name,args){
    const fn=window[name];
    if(typeof fn!=='function')return undefined;
    return fn.apply(window,args||[]);
  }

  function renderCustomers(){ return call('renderV8Customers'); }
  function openCustomer(id){ return call('v8CustomerDetail',[id]); }
  function editCustomer(id){ return call('customerModalV8',[id||'']); }
  function createCustomer(){ return editCustomer(''); }
  function saveCustomer(id){ return call('v8SaveCustomer',[id||'']); }
  function recordDebt(customerId){ return call('v8CustomerDebt',[customerId]); }
  function saveDebt(customerId){ return call('v8SaveDebt',[customerId]); }
  function refreshPermissions(){ return call('v8RefreshPermissions'); }

  window.FNB_CUSTOMERS_UI={
    renderCustomers,
    openCustomer,
    editCustomer,
    createCustomer,
    saveCustomer,
    recordDebt,
    saveDebt,
    refreshPermissions
  };
})();
