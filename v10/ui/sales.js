/* F&B Manager V10 — POS / Sales domain UI facade
   Phase 9: expose the complete sales lifecycle through one stable boundary.
   Checkout/cart/order business rules remain in the canonical implementation in
   index.html until all call-sites are migrated. Do not duplicate those rules here.
*/
(function(){
  'use strict';

  function call(name,args){
    const fn=window[name];
    if(typeof fn!=='function')return undefined;
    return fn.apply(window,args||[]);
  }

  function setActive(title){
    document.getElementById('topTitle').textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='pos'));
  }

  function renderSales(){
    const v=document.getElementById('view');
    if(v&&typeof window.pos==='function')v.innerHTML=window.pos();
    setActive('Bán hàng');
  }

  function openOrder(id){ return call('orderDetailModal',[id]); }
  function renderHistory(){
    const html=call('orderHistoryPage');
    if(typeof html==='string'){
      const v=document.getElementById('view');
      if(v)v.innerHTML=html;
      setActive('Lịch sử đơn');
    }
    return html;
  }

  function addToCart(productId){ return call('addCart',[productId]); }
  function changeCart(productId,delta){ return call('changeCartV5',[productId,delta]) || call('changeCart',[productId,delta]); }
  function clearCart(){ return call('clearCart'); }
  function checkout(){ return call('completeOrderV5') || call('checkout'); }
  function resetCheckout(){ return call('resetCheckout'); }
  function renderCheckout(){ return call('renderCheckoutBox'); }
  function returnOrder(id){ return call('returnOrderModal',[id]) || call('returnOrder',[id]); }
  function cancelOrder(id){ return call('cancelOrderModal',[id]) || call('cancelOrder',[id]); }

  window.FNB_SALES_UI={
    renderSales,
    openOrder,
    renderHistory,
    addToCart,
    changeCart,
    clearCart,
    checkout,
    resetCheckout,
    renderCheckout,
    returnOrder,
    cancelOrder
  };
})();
