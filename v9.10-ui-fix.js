/* V9.10 UI FIX — loads the multi-device foundation and exposes its UI safely. */
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

  function syncCard(){
    if(document.getElementById('v910DataCard')) return;
    const view=document.getElementById('view'); if(!view) return;
    const el=document.createElement('div');
    el.id='v910DataCard'; el.className='card'; el.style.marginTop='16px';
    el.innerHTML=`<div class="section-title">🔄 Dữ liệu & đồng bộ</div>
      <div id="v910SyncStatus" style="font-size:13px;margin:8px 0">Đang kiểm tra...</div>
      <div style="font-size:12px;color:var(--muted);line-height:1.55">
        Thiết bị: <b>${String(meta.deviceId||'chưa tạo')}</b><br>
        Chế độ: <b>Tự động</b> — khi offline app vẫn dùng dữ liệu trên thiết bị.<br>
        Các thay đổi được ghi vào hàng đợi để đồng bộ khi máy chủ được bật.
      </div>`;
    view.appendChild(el);
    updateSyncStatus();
  }

  function updateSyncStatus(){
    networkBadge();
    const e=document.getElementById('v910SyncStatus'); if(!e) return;
    const q=read(QUEUE,[]).length, c=read(CONFLICT,[]).length;
    e.innerHTML=(navigator.onLine!==false?'🟢 Online':'🟠 Offline')+' · '+q+' thay đổi đang chờ · '+c+' xung đột';
  }

  function hook(){
    if(typeof window.renderV8Settings!=='function') return false;
    if(window.renderV8Settings.__v910FixWrapped) return true;
    const base=window.renderV8Settings;
    function wrapped(){
      base.apply(this,arguments);
      setTimeout(()=>{
        syncCard();
        if(typeof window.v9SettingsCard==='function' && !document.getElementById('v910OnlineCard')){
          const wrap=document.createElement('div');
          wrap.id='v910OnlineCard';
          wrap.innerHTML=window.v9SettingsCard();
          document.getElementById('view')?.appendChild(wrap);
          updateSyncStatus();
        }
      },0);
    }
    wrapped.__v910FixWrapped=true;
    window.renderV8Settings=wrapped;
    return true;
  }

  window.addEventListener('online',updateSyncStatus);
  window.addEventListener('offline',updateSyncStatus);
  const timer=setInterval(()=>{if(hook())clearInterval(timer)},50);
  setTimeout(()=>{hook();networkBadge();if(document.querySelector('[data-page="settings"].active')){syncCard();}},800);
  window.__v910UiFix=true;
})();
