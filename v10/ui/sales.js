/* F&B Manager V10 — sales / POS UI
   Phase 9: POS and order-history presentation are exposed behind a stable domain facade.
   Existing checkout, cart, invoice, return/refund and cashflow integrations remain in
   index.html during the safe extraction phase; this module only defines the boundary.
*/
(function(){
  'use strict';

  function setActive(title){
    document.getElementById('topTitle').textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='pos'));
  }

  function renderSales(){
    const v=document.getElementById('view');
    if(v&&typeof window.pos==='function')v.innerHTML=window.pos();
    setActive('Bán hàng');
  }

  function openOrder(id){
    if(typeof window.orderDetailModal==='function')return window.orderDetailModal(id);
  }

  function renderHistory(){
    if(typeof window.orderHistoryPage==='function'){
      const v=document.getElementById('view');
      if(v)v.innerHTML=window.orderHistoryPage();
      setActive('Lịch sử đơn');
    }
  }

  window.FNB_SALES_UI={renderSales,openOrder,renderHistory};
})();
