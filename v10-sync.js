/* F&B Manager V10 — single browser entry point
   Load the online data/auth engine first, then the isolated UI integration layer.
   index.html keeps loading only this file.
*/
(function(){
  'use strict';

  const modules=[
    './v10-sync-base.js?v=1003',
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
