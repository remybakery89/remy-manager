/* F&B Manager V10 — authentication compatibility layer
   Temporary DIRECT MODE: no login/session UI. Google Sheets remains the shared source.
*/
(function(){
  'use strict';
  const config=window.FNB_CONFIG||{};
  const runtime=window.FNB_RUNTIME||{};
  const state=runtime.state||{};
  const sync=window.FNB_SYNC_INTERNAL||{};
  function requireFn(fn,name){if(typeof fn!=='function')throw new Error('Auth module chưa sẵn sàng: '+name);return fn;}
  function db(){return requireFn(sync.getDb,'getDb')()}
  function setStatus(text,kind){return requireFn(sync.setStatus,'setStatus')(text,kind)}
  function showApp(){return requireFn(sync.showApp,'showApp')()}
  function refresh(){return requireFn(sync.refresh,'refresh')()}
  function openModalCompat(){if(typeof closeModal==='function')closeModal()}
  function makeDirectUser(){
    return {username:'direct',name:'F&B Manager',role:'admin',branchId:config.BRANCH_DEFAULT||'*',branchName:'Tất cả'};
  }
  async function login(){
    state.user=makeDirectUser();
    state.branchId=state.user.branchId||'*';
    state.lastSync=null;
    state.pending=false;
    await sync.start();
    showApp();
    openModalCompat();
    setStatus('Online · tự động lưu Google Sheets','ok');
    refresh();
    return state.user;
  }
  function openLogin(){return login()}
  async function logout(){
    state.user=null;state.employee=null;state.branchId=config.BRANCH_DEFAULT||'*';state.lastSync=null;state.pending=false;
    if(typeof sync.stopPolling==='function')sync.stopPolling();
    try{if(typeof sync.emptyDb==='function')sync.setDb(sync.emptyDb())}catch(e){}
    showApp();
  }
  function openAccount(){
    const currentDb=db()||{};
    openModal(`<h2>☁️ F&B Manager</h2><div class="card" style="box-shadow:none"><div class="list-item row"><span>Chế độ</span><b>Tự động lưu</b></div><div class="list-item row"><span>Dữ liệu</span><b>Google Sheets</b></div><div class="list-item row"><span>Trạng thái</span><b>Tự động đồng bộ khi có thay đổi</b></div></div><div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  }
  async function init(){
    if(window.__FNB_AUTH_INITIALIZED__)return !!state.user;
    window.__FNB_AUTH_INITIALIZED__=true;
    try{
      await login();
      return true;
    }catch(e){
      console.error('V10 direct mode init',e);
      setStatus('Không thể tải DATA từ Google Sheets','warn');
      throw e;
    }
  }
  window.v10LoginAccount=login;
  window.v10DoLogin=login;
  window.FNB_AUTH={login,openLogin,logout,openAccount,getState:function(){return {user:state.user||null,employee:state.employee||null,branchId:state.branchId||null}},init};
})();