/* F&B Manager V10 — compatibility layer
   Phase 5: keep legacy V9 public names working while the application is migrated
   to the V10 modules. No business logic lives here; this layer only forwards calls.
*/
(function(){
  'use strict';

  const config=window.FNB_CONFIG||{};
  const runtime=window.FNB_RUNTIME||{};
  const state=runtime.state||{};
  const auth=window.FNB_AUTH||{};
  const sync=window.FNB_SYNC_INTERNAL||{};

  function requireFn(fn,name){
    if(typeof fn!=='function')throw new Error('Compatibility module chưa sẵn sàng: '+name);
    return fn;
  }

  // Legacy account/logout names are still called by the current UI.
  window.v9Logout=function(){return requireFn(auth.logout,'logout')()};
  window.v9OpenAccount=function(){return requireFn(auth.openAccount,'openAccount')()};

  window.v10SyncState=function(){
    return {
      online:navigator.onLine!==false,
      user:state.user,
      branchId:state.branchId,
      lastSync:state.lastSync,
      pending:state.pending,
      conflicts:[],
      offlineCache:false,
      apiUrl:config.API||''
    };
  };
  window.v9state=window.v10SyncState;

  window.v9SaveSettings=function(){
    state.branchId=(document.getElementById('v9Branch')?.value||state.branchId||config.BRANCH_DEFAULT||'MAIN').trim()||config.BRANCH_DEFAULT||'MAIN';
    toast('Đã lưu chi nhánh trong phiên Online');
  };

  window.v9TestConnection=async function(){
    const btn=document.getElementById('v9TestBtn');
    if(btn){btn.disabled=true;btn.textContent='Đang kiểm tra...'}
    try{
      await requireFn(sync.requireApi,'requireApi').get();
      requireFn(sync.setStatus,'setStatus')(state.user?'Online · kết nối OK':'Kết nối OK','ok');
      toast('✅ Apps Script kết nối OK');
    }catch(e){
      requireFn(sync.setStatus,'setStatus')('Chưa kết nối','danger');
      toast('❌ Chưa kết nối được Apps Script');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='🔌 Kiểm tra kết nối'}
    }
  };

  window.v9SettingsCard=function(){
    const safe=typeof sync.getSafe==='function'?sync.getSafe:String;
    const branch=safe(state.branchId||config.BRANCH_DEFAULT||'MAIN');
    return `<div class="card" style="margin-top:16px"><div class="section-title">☁️ Online & Đồng bộ</div><div class="form-grid"><div class="field full"><label>Apps Script Web App URL</label><input value="${config.API||''}" readonly><div style="font-size:12px;color:var(--muted);margin-top:6px">Kết nối cố định. Không còn URL cũ, không lưu URL vào máy.</div></div><div class="field"><label>Chi nhánh</label><input id="v9Branch" value="${branch}"></div><div class="field"><label>Trạng thái</label><div style="padding:10px 0"><span id="v9ConnectionBadge" class="badge ${state.user?'ok':'warn'}">${state.user?'Online · dữ liệu từ Google Sheets':'Chưa đăng nhập'}</span></div></div></div><div class="modal-actions"><button class="btn" id="v9TestBtn" onclick="v9TestConnection()">🔌 Kiểm tra kết nối</button><button class="btn primary" onclick="v9SaveSettings()">Lưu chi nhánh</button><button class="btn" onclick="v9OpenAccount()">Tài khoản</button><button class="btn" onclick="v10SyncNow()">☁️ Lấy DATA mới</button></div><div style="margin-top:12px;font-size:12px;color:var(--muted)">Google Sheets là nguồn dữ liệu duy nhất. Thay đổi được ghi Online ngay; các thiết bị đang đăng nhập tự lấy DATA mới.</div></div>`;
  };
})();