/* F&B Manager V10 — authentication layer
   Phase 3/9: authentication plus durable device session restoration.
   Passwords are never persisted; only the server-issued session is retained.
*/
(function(){
  'use strict';
  const config=window.FNB_CONFIG||{};
  const runtime=window.FNB_RUNTIME||{};
  const state=runtime.state||{};
  const sync=window.FNB_SYNC_INTERNAL||{};
  const persistence=window.FNB_PERSISTENCE||null;
  function requireFn(fn,name){if(typeof fn!=='function')throw new Error('Auth module chưa sẵn sàng: '+name);return fn;}
  function db(){return requireFn(sync.getDb,'getDb')()}
  function setDb(value){return requireFn(sync.setDb,'setDb')(value)}
  function emptyDb(){return requireFn(sync.emptyDb,'emptyDb')()}
  function setStatus(text,kind){return requireFn(sync.setStatus,'setStatus')(text,kind)}
  function showApp(){return requireFn(sync.showApp,'showApp')()}
  function hideApp(){return requireFn(sync.hideApp,'hideApp')()}
  function refresh(){return requireFn(sync.refresh,'refresh')()}
  function startPolling(){return requireFn(sync.startPolling,'startPolling')()}
  function stopPolling(){return requireFn(sync.stopPolling,'stopPolling')()}
  function safe(value){return typeof sync.getSafe==='function'?sync.getSafe(value):String(value??'').replace(/[<>]/g,'')}
  function api(){return requireFn(sync.requireApi,'requireApi')()}
  async function persistSession(){if(!persistence)return;await persistence.saveSession({user:state.user,branchId:state.branchId});}
  async function login(username,password){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(password));
    const passwordHash=[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const data=await api().request({action:'login',username,passwordHash});
    if(!data.user)throw new Error('Đăng nhập thất bại');
    state.user=data.user;
    state.branchId=data.user.branchId||config.BRANCH_DEFAULT||'MAIN';
    state.lastSync=null;
    state.pending=false;
    setDb(emptyDb());
    setStatus('Đang tải DATA từ Google Sheets...','info');
    try{
      await sync.pullOnline();
      await persistSession();
      showApp();
      closeModal();
      startPolling();
      setStatus(state.pending?'Chờ đồng bộ · dữ liệu đã lưu trên thiết bị':'Online · đã cập nhật','ok');
      refresh();
      toast('✅ Đăng nhập thành công');
    }catch(e){
      state.user=null;
      state.employee=null;
      state.branchId=config.BRANCH_DEFAULT||'MAIN';
      setDb(emptyDb());
      setStatus('Không thể tải DATA từ Google Sheets','warn');
      throw e;
    }
  }
  async function restoreSession(){
    if(!persistence)return false;
    try{
      const saved=await persistence.loadSession();
      if(!saved?.user?.username||!saved?.user?.token)return false;
      state.user=saved.user;
      state.branchId=saved.branchId||saved.user.branchId||config.BRANCH_DEFAULT||'MAIN';
      const restored=await sync.start();
      showApp();
      setStatus(restored?'Online · dữ liệu trên thiết bị':'Đang cập nhật dữ liệu nền...',restored?'ok':'info');
      refresh();
      return true;
    }catch(e){
      console.warn('V10 restore session',e);
      state.user=null;state.employee=null;
      try{await persistence.clearSession()}catch(_e){}
      return false;
    }
  }
  function loginModal(message){
    openModal(`<h2>🔐 Đăng nhập F&B Manager</h2>${message?`<div class="alert danger" style="margin-bottom:14px">${safe(message)}</div>`:''}<div class="form-grid"><div class="field full"><label>Tài khoản</label><input id="v10User" autocomplete="username"></div><div class="field full"><label>Mật khẩu</label><input id="v10Pass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')v10DoLogin()"></div></div><div class="modal-actions"><button class="btn primary" id="v10LoginBtn" onclick="v10DoLogin()">Đăng nhập</button></div>`);
  }
  async function doLogin(){
    const u=(document.getElementById('v10User')?.value||'').trim();
    const p=document.getElementById('v10Pass')?.value||'';
    if(!u||!p){toast('Nhập tài khoản và mật khẩu');return}
    const btn=document.getElementById('v10LoginBtn');
    if(btn){btn.disabled=true;btn.textContent='Đang đăng nhập...'}
    try{await login(u,p)}catch(e){console.error('V10 login',e);loginModal(e.message||'Đăng nhập thất bại')}
    finally{const b=document.getElementById('v10LoginBtn');if(b){b.disabled=false;b.textContent='Đăng nhập'}}
  }
  async function logout(){
    state.user=null;state.employee=null;state.branchId=config.BRANCH_DEFAULT||'MAIN';state.lastSync=null;state.pending=false;stopPolling();setDb(emptyDb());
    try{if(persistence)await persistence.clear()}catch(e){console.warn('V10 clear device session',e)}
    hideApp();loginModal();setStatus('Chưa đăng nhập','warn');
  }
  function openAccount(){
    if(!state.user){loginModal();return}
    const currentDb=db()||{};
    const employee=state.employee;
    const role=employee?(currentDb.roles||[]).find(r=>r.id===employee.roleId):null;
    openModal(`<h2>☁️ Tài khoản & Online</h2><div class="card" style="box-shadow:none"><div class="list-item row"><span>Đang đăng nhập</span><b>${safe(employee?.name||state.user.name||state.user.username)}</b></div><div class="list-item row"><span>Tài khoản</span><b>${safe(state.user.username)}</b></div><div class="list-item row"><span>Vai trò</span><b>${safe(role?.name||state.user.role||'—')}</b></div><div class="list-item row"><span>Chi nhánh</span><b>${safe(state.user.branchName||state.branchId||'—')}</b></div><div class="list-item row"><span>Dữ liệu</span><b>Google Sheets</b></div><div class="list-item row"><span>Đồng bộ gần nhất</span><b>${state.lastSync?new Date(state.lastSync).toLocaleString('vi-VN'):'—'}</b></div></div><div class="modal-actions"><button class="btn primary" onclick="v10SyncNow()">☁️ Đồng bộ ngay</button><button class="btn danger" onclick="v9Logout()">Đăng xuất</button><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  async function init(){
    if(window.__FNB_AUTH_INITIALIZED__)return !!state.user;
    window.__FNB_AUTH_INITIALIZED__=true;
    const restored=await restoreSession();
    if(!restored)loginModal();
    return restored;
  }
  window.v10LoginAccount=login;
  window.v10DoLogin=doLogin;
  window.FNB_AUTH={login,openLogin:loginModal,logout,openAccount,getState:function(){return {user:state.user||null,employee:state.employee||null,branchId:state.branchId||null}},init};
})();