/* F&B Manager V10 — compatibility layer
   Temporary DIRECT MODE: keep legacy V9 names working while removing
   login/branch/manual-sync controls from the active UI.
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

  window.v9Logout=function(){return requireFn(auth.logout,'logout')()};
  window.v9OpenAccount=function(){return requireFn(auth.openAccount,'openAccount')()};

  window.v10SyncState=function(){
    return {
      online:navigator.onLine!==false,
      user:state.user,
      branchId:'*',
      lastSync:state.lastSync,
      pending:state.pending,
      conflicts:[],
      offlineCache:true,
      apiUrl:config.API||''
    };
  };
  window.v9state=window.v10SyncState;

  window.v9SaveSettings=function(){
    state.branchId='*';
    toast('Đang dùng dữ liệu chung · tự động lưu Google Sheets');
  };

  window.v9TestConnection=async function(){
    const btn=document.getElementById('v9TestBtn');
    if(btn){btn.disabled=true;btn.textContent='Đang kiểm tra...'}
    try{
      await requireFn(sync.requireApi,'requireApi').get();
      requireFn(sync.setStatus,'setStatus')('Kết nối Google Sheets OK','ok');
      toast('✅ Apps Script kết nối OK');
    }catch(e){
      requireFn(sync.setStatus,'setStatus')('Chưa kết nối được Google Sheets','danger');
      toast('❌ Chưa kết nối được Apps Script');
    }finally{
      if(btn){btn.disabled=false;btn.textContent='🔌 Kiểm tra kết nối'}
    }
  };

  window.v9SettingsCard=function(){
    return `<div class="card" style="margin-top:16px"><div class="section-title">☁️ Đồng bộ dữ liệu</div><div class="form-grid"><div class="field full"><label>Apps Script Web App URL</label><input value="${config.API||''}" readonly><div style="font-size:12px;color:var(--muted);margin-top:6px">Kết nối cố định · không cần đăng nhập.</div></div><div class="field"><label>Phạm vi dữ liệu</label><div style="padding:10px 0"><span class="badge ok">Tất cả dữ liệu chung</span></div></div><div class="field"><label>Trạng thái</label><div style="padding:10px 0"><span id="v9ConnectionBadge" class="badge ${state.user?'ok':'warn'}">${state.user?'Tự động lưu Google Sheets':'Đang khởi tạo'}</span></div></div></div><div class="modal-actions"><button class="btn" id="v9TestBtn" onclick="v9TestConnection()">🔌 Kiểm tra kết nối</button><button class="btn" onclick="v9OpenAccount()">Tài khoản</button></div><div style="margin-top:12px;font-size:12px;color:var(--muted)">Mọi thay đổi được lưu tự động. Không cần bấm Sync; khi mở lại trang sẽ lấy snapshot mới nhất từ Google Sheets.</div></div>`;
  };
})();
