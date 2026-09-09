/* F&B Manager V10 — Alerts domain UI
   Phase 14: alert presentation takes runtime ownership through the V10 boundary.
   Canonical alert logic remains in index.html temporarily for rollback safety.
*/
(function(){
  'use strict';
  function setActive(){
    const t=document.getElementById('topTitle');
    if(t)t.textContent='Cảnh báo';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='alerts'));
  }
  function renderAlerts(){
    const renderer=typeof alertsPageRound3==='function'?alertsPageRound3:(typeof alertsPageRound2==='function'?alertsPageRound2:(typeof alertsPage==='function'?alertsPage:null));
    const html=typeof renderer==='function'?renderer():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive();
    return html;
  }
  window.FNB_ALERTS_UI={renderAlerts};
})();
