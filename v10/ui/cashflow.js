/* F&B Manager V10 — Cashflow domain UI
   Phase 12: cashflow UI takes runtime ownership through the V10 boundary.
   Canonical cashflow business logic remains in index.html temporarily for rollback safety.
*/
(function(){
  'use strict';

  function setActive(){
    const t=document.getElementById('topTitle');
    if(t)t.textContent='Dòng tiền';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='cashflow'));
  }

  function renderCashflow(){
    const html=typeof cashflowPage==='function'
      ?cashflowPage()
      :(typeof cashflow==='function'?cashflow():typeof cash==='function'?cash():'');
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive();
    return html;
  }

  window.FNB_CASHFLOW_UI={renderCashflow};
})();
