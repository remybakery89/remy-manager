/* F&B Manager V10 — Settings domain UI
   Phase 15: settings UI takes runtime ownership through the V10 boundary.
   Canonical settings logic remains in index.html temporarily for rollback safety.
*/
(function(){
  'use strict';

  function setActive(){
    const t=document.getElementById('topTitle');
    if(t)t.textContent='Cài đặt';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='settings'));
  }

  function renderSettings(){
    const renderer=typeof settingsRound2==='function'
      ?settingsRound2
      :(typeof settings==='function'?settings:null);
    const html=typeof renderer==='function'?renderer():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    setActive();
    return html;
  }

  window.FNB_SETTINGS_UI={renderSettings};
})();
