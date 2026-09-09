/* F&B Manager V10 — single browser entry point
   Load shared core modules first, then the online data/sync engine,
   authentication, compatibility facade, and isolated UI integration layer.
   index.html keeps loading only this file.
*/
(function(){
  'use strict';

  const modules=[
    './v10/config.js?v=1001',
    './v10/state.js?v=1001',
    './v10/api.js?v=1001',
    './v10-sync-base.js?v=1008',
    './v10/sync.js?v=1003',
    './v10/auth.js?v=1003',
    './v10/compatibility.js?v=1003',
    './v10-ui-patches.js?v=1001'
  ];

  function load(index){
    if(index>=modules.length)return;
    const s=document.createElement('script');
    s.src=modules[index];
    s.onload=function(){load(index+1)};
    s.onerror=function(){console.error('V10 module load failed:',modules[index])};
    document.head.appendChild(s);
  }

  load(0);
})();
