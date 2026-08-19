/* F&B Manager V10 — single online bootstrap
   Existing index.html loads this one bridge.
   It activates v9.10.js as the single sync engine, purges legacy browser data,
   and never stores application data locally.
*/
(function(){
  'use strict';
  const API='https://script.google.com/macros/s/AKfycbyL2y6Y3iyTMFKt6x_U_JmYP-zTTgMkp1SMi0cFudNF8tmkm5CfOu6Y_jPZT2XKO18aiQ/exec';
  const LEGACY=['fnb_manager_v1','fnb_manager_v9','fnb_v910_queue','fnb_v910_meta','fnb_v910_conflicts','fnb_v9_url','v9_webapp_url','v9AppsScriptUrl'];
  try{LEGACY.forEach(k=>localStorage.removeItem(k));}catch(e){}
  window.__FNB_ONLINE_ONLY__=true;
  window.__FNB_API_URL__=API;

  if(window.__FNB_V910_LOADED__)return;
  window.__FNB_V910_LOADED__=true;
  const s=document.createElement('script');
  s.src='./v9.10.js?v=1011';
  s.async=false;
  s.onload=function(){try{LEGACY.forEach(k=>localStorage.removeItem(k));}catch(e){}};
  s.onerror=function(){window.__FNB_V910_LOADED__=false;console.error('F&B Manager: không tải được engine Online v9.10.js')};
  document.head.appendChild(s);
})();
