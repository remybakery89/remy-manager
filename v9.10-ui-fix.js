/* V9.10 UI FIX — login refresh + single sync UI. */
(function(){
  'use strict';
  if(window.__v910UiFix) return;

  const META='fnb_v910_meta', QUEUE='fnb_v910_queue', CONFLICT='fnb_v910_conflicts';
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
  const meta=read(META,{});

  function networkBadge(){
    let b=document.getElementById('v910NetworkBadge');
    if(!b){
      b=document.createElement('div');
      b.id='v910NetworkBadge';
      b.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;background:#fff;border:1px solid var(--line,#e4e9e6);border-radius:999px;padding:8px 12px;font-size:12px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.10)';
      document.body.appendChild(b);
    }
    const online=navigator.onLine!==false, q=read(QUEUE,[]).length, c=read(CONFLICT,[]).length;
    b.textContent=c?'🔴 Xung đột '+c:(online?(q?'🔵 Online · chờ '+q:'🟢 Online'):'🟠 Offline'+(q?' · chờ '+q:''));
    b.title=online?'Có kết nối mạng':'Đang dùng dữ liệu trên thiết bị';
  }

  function updateSyncStatus(){
    networkBadge();
    const e=document.getElementById('v910SyncStatus'); if(!e) return;
    const q=read(QUEUE,[]).length, c=read(CONFLICT,[]).length;
    e.innerHTML=(navigator.onLine!==false?'🟢 Online':'🟠 Offline')+' · '+q+' thay đổi đang chờ · '+c+' xung đột';
  }

  /*
   * IMPORTANT: keep the original V9 login as the single source of truth.
   * It updates the internal V9 state object and persists the token.
   * We only refresh the Settings screen after a successful login so the
   * visible badge changes from "Chưa đăng nhập" to "Đã đăng nhập".
   */
  const originalLogin=window.v9Login;
  if(typeof originalLogin==='function'){
    window.v9Login=async function(){
      await originalLogin.apply(this,arguments);
      const s=window.v9state?.();
      if(s?.user){
        if(typeof window.v9UpdateBadge==='function') window.v9UpdateBadge();
        if(typeof window.go==='function') window.go('settings');
        setTimeout(updateSyncStatus,0);
      }
    };
  }

  function hook(){
    if(typeof window.renderV8Settings!=='function') return false;
    if(window.renderV8Settings.__v910FixWrapped) return true;
    const base=window.renderV8Settings;
    function wrapped(){
      base.apply(this,arguments);
      setTimeout(updateSyncStatus,0);
    }
    wrapped.__v910FixWrapped=true;
    window.renderV8Settings=wrapped;
    return true;
  }

  window.addEventListener('online',updateSyncStatus);
  window.addEventListener('offline',updateSyncStatus);
  const timer=setInterval(()=>{if(hook())clearInterval(timer)},50);
  setTimeout(()=>{hook();networkBadge();updateSyncStatus()},800);
  window.__v910UiFix=true;
})();
