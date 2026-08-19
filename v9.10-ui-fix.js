/* V9.10 UI FIX — login diagnostics + single sync UI. */
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
   * V9 login used to catch every POST/JSON problem and show only
   * "Không kết nối được máy chủ". Replace that handler with a diagnostic
   * version so the actual Apps Script response is visible.
   */
  async function loginFixed(){
    const state=window.v9state?.();
    if(!state?.apiUrl){toast('Hãy cấu hình Apps Script URL trước');return}

    const username=(document.getElementById('v9User')?.value||'').trim();
    const password=document.getElementById('v9Pass')?.value||'';
    if(!username||!password){toast('Nhập tài khoản và mật khẩu');return}

    const btn=document.querySelector('#modal .btn.primary');
    if(btn){btn.disabled=true;btn.textContent='Đang đăng nhập...'}

    try{
      const passHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(password));
      const passwordHash=[...new Uint8Array(passHash)].map(x=>x.toString(16).padStart(2,'0')).join('');
      const url=String(state.apiUrl).trim().replace(/\/$/,'');

      const response=await fetch(url,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body:JSON.stringify({action:'login',username,passwordHash})
      });

      const raw=await response.text();
      let data=null;
      try{data=JSON.parse(raw)}catch(e){
        const preview=raw.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,260);
        v9LoginModal('Máy chủ trả về dữ liệu không phải JSON. HTTP '+response.status+(preview?' · '+preview:''));
        return;
      }

      if(!response.ok){
        v9LoginModal((data.message||data.error||'Máy chủ báo lỗi')+' · HTTP '+response.status);
        return;
      }
      if(!data.ok){
        v9LoginModal(data.message||data.error||'Tên đăng nhập hoặc mật khẩu không đúng');
        return;
      }
      if(!data.user){
        v9LoginModal('Máy chủ đăng nhập thành công nhưng không trả về thông tin tài khoản.');
        return;
      }

      /* Persist through the existing V9 state API. */
      const current=window.v9state?.();
      if(current){
        current.user=data.user;
        current.branchId=data.user.branchId||'MAIN';
        localStorage.setItem('fnb_manager_v9',JSON.stringify(current));
      }
      closeModal();
      if(typeof window.v9UpdateBadge==='function') window.v9UpdateBadge();
      toast('Đăng nhập thành công');
    }catch(e){
      console.error('V9 login error',e);
      const msg=e?.message||String(e||'Lỗi không xác định');
      v9LoginModal('Không gửi được yêu cầu tới Apps Script: '+msg);
    }finally{
      const b=document.querySelector('#modal .btn.primary');
      if(b){b.disabled=false;b.textContent='Đăng nhập'}
    }
  }

  /* v9Login is already defined by index.html before this external file. */
  window.v9Login=loginFixed;

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
