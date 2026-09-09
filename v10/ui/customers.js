/* F&B Manager V10 — customer domain UI
   Phase 9: customer presentation/actions are exposed behind a stable domain facade.
   The canonical customer implementation remains in index.html during the safe
   extraction phase so existing V8 permissions, loyalty and debt behavior stay intact.
*/
(function(){
  'use strict';

  function renderCustomers(){
    if(typeof window.renderV8Customers==='function')return window.renderV8Customers();
    const v=document.getElementById('view');
    if(v&&typeof window.customerListModal==='function')v.innerHTML='';
  }

  function openCustomer(id){
    if(typeof window.v8CustomerDetail==='function')return window.v8CustomerDetail(id);
    if(typeof window.customerModal==='function')return window.customerModal(id);
  }

  function editCustomer(id){
    if(typeof window.customerModalV8==='function')return window.customerModalV8(id);
    if(typeof window.customerModal==='function')return window.customerModal(id);
  }

  function createCustomer(){return editCustomer('')}

  window.FNB_CUSTOMERS_UI={renderCustomers,openCustomer,editCustomer,createCustomer};
})();
