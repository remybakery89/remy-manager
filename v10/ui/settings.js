/* F&B Manager V10 — settings UI
   Phase 11: settings presentation is isolated behind a stable domain facade.
   The canonical settings implementations remain in index.html during the safe
   extraction phase so pricing and legacy V8 settings behavior stays unchanged.
*/
(function(){
  'use strict';

  function renderSettings(){
    const renderer=typeof window.settingsRound2==='function'
      ?window.settingsRound2
      :(typeof window.settings==='function'?window.settings:null);
    const html=typeof renderer==='function'?renderer():'';
    const v=document.getElementById('view');
    if(v)v.innerHTML=html;
    document.getElementById('topTitle').textContent='Cài đặt';
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='settings'));
    return html;
  }

  window.FNB_SETTINGS_UI={renderSettings};
})();
