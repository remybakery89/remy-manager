/* F&B Manager V10 — alerts UI
   Phase 11: alert presentation is isolated behind a stable domain facade.
   The canonical alert logic remains in index.html during the safe extraction phase
   so inventory, pricing and ingredient-price alert behavior stays unchanged.
*/
(function(){
  'use strict';

  function renderAlerts(){
    const renderer=typeof window.alertsPageRound3==='function'
      ?window.alertsPageRound3
      :(typeof window.alertsPageRound2==='function'?window.alertsPageRound2:window.alertsPage);
    const html=typeof renderer==='function'?renderer():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    document.getElementById('topTitle').textContent='Cảnh báo';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='alerts'));
    return html;
  }

  window.FNB_ALERTS_UI={renderAlerts};
})();
