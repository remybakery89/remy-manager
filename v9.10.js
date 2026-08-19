/* V10 compatibility entry point.
   The old V9.10 wrapper is intentionally removed.
   This file remains temporarily so older cached index.html files do not
   reintroduce nested save/render wrappers. New builds load v10-sync.js directly.
*/
(function(){
  'use strict';
  if(window.__fnbV10CompatLoaded)return;
  window.__fnbV10CompatLoaded=true;
  if(!window.__fnbV10Sync && !document.querySelector('script[data-v10-sync]')){
    const s=document.createElement('script');
    s.src='./v10-sync.js?v=1001';
    s.async=false;
    s.dataset.v10Sync='1';
    (document.head||document.documentElement).appendChild(s);
  }
})();
