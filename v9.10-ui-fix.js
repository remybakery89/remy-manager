/* V9.10 UI bridge: attaches the new Data & Sync card to the app's real render() function. */
(function(){
  'use strict';
  if(window.__v910UiBridge) return;
  const META='fnb_v910_meta', QUEUE='fnb_v910_queue', CONFLICT='fnb_v910_conflicts';
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
  const meta=read(META,{});
  function statusText(){
    const online=navigator.onLine!==false, q=read(QUEUE,[]).length, c=read(CONFLICT,[]).length;
    return c?'🔴 Xung đột '+c:(online?(q?'🔵 Online · chờ '+q:'🟢 Online'):'🟠 Offline'+(q?' · chờ '+q:''));
  }
  function update(){
    const badge=document.getElementById('v910NetworkBadge');
    if(badge){badge.textContent=statusText();badge.title=navigator.onLine!==false?'Có kết nối mạng':'Đang dùng dữ liệu trên thiết bị'}
    const s=document.getElementById('v910SyncStatus');
    if(s){const q=read(QUEUE,[]).length,c=read(CONFLICT,[]).length;s.innerHTML=(navigator.onLine!==false?'🟢 Online':'🟠 Offline')+' · '+q+' thay đổi đang chờ · '+c+' xung đột'}
  }
  function card(){
    if(document.getElementById('v910DataCard')) return;
    const view=document.getElementById('view'); if(!view)return;
    const el=document.createElement('div');el.className='card';el.id='v910DataCard';el.style.marginTop='16px';
    el.innerHTML='<div class="section-title">🔄 Dữ liệu & đồng bộ</div><div id="v910SyncStatus" style="font-size:13px;margin:8px 0">Đang kiểm tra...</div><div style="font-size:12px;color:var(--muted);line-height:1.55">Thiết bị: <b>'+String(meta.deviceId||'chưa tạo')+'</b><br>Chế độ: <b>Tự động</b> — khi offline app dùng dữ liệu trên thiết bị.<br>Các thay đổi được ghi vào hàng đợi để xử lý khi cơ chế đồng bộ máy chủ được bật.</div>';
    view.appendChild(el);update();
  }
  function hook(){
    if(typeof window.render!=='function') return false;
    if(window.render.__v910UiHooked) return true;
    const base=window.render;
    function wrapped(page){const r=base.apply(this,arguments);if(page==='settings')setTimeout(card,0);return r}
    wrapped.__v910UiHooked=true;window.render=wrapped;return true;
  }
  window.addEventListener('online',update);window.addEventListener('offline',update);
  const timer=setInterval(()=>{if(hook()){clearInterval(timer);if(document.querySelector('[data-page="settings"].active'))card()}},50);
  setTimeout(()=>{hook();update();if(document.querySelector('[data-page="settings"].active'))card()},1000);
  window.__v910UiBridge=true;
})();
