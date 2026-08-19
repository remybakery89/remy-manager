/* F&B Manager — compatibility bridge only
   The V10 branch now has ONE sync engine: v9.10.js (online-only).
   This file deliberately contains no queue, local app-data, conflict engine,
   fetch patch, DOM injection, polling, or second data store.
*/
(function(){
  'use strict';
  window.v10SyncNow=window.v10SyncNow||function(){
    return typeof window.v9SyncNow==='function'?window.v9SyncNow():Promise.resolve();
  };
  window.v10SyncState=window.v10SyncState||function(){
    return typeof window.v9state==='function'?window.v9state():{online:navigator.onLine!==false,pending:[],conflicts:[]};
  };
})();
