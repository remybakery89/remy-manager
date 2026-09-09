/* F&B Manager V10 — cashflow domain UI
   Phase 8: cashflow presentation is isolated behind a stable domain facade.
   The canonical business/render implementation remains in index.html during the
   safe extraction phase so cashflow behavior and its cross-domain dependencies
   stay unchanged.
*/
(function(){
  'use strict';

  function setActive(page,title){
    const t=document.getElementById('topTitle');
    if(t)t.textContent=title;
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  }

  function renderCashflow(){
    const renderer=typeof window.cashflow==='function'
      ?window.cashflow
      :(typeof window.cash==='function'?window.cash:null);
    const html=renderer?renderer():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive('cashflow','Dòng tiền');
    return html;
  }

  window.FNB_CASHFLOW_UI={renderCashflow};
})();
