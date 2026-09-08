/* F&B Manager V10 — ONLINE ONLY
   Google Sheets / Apps Script is the only persistent data source.
   No localStorage, IndexedDB, offline queue, conflict cache, or local app database.
   The existing application UI/features remain in index.html; this file is the single
   online data/auth bridge loaded by GitHub Pages.
*/
(function(){
  'use strict';

  const API='https://script.google.com/macros/s/AKfycbyL2y6Y3iyTMFKt6x_U_JmYP-zTTgMkp1SMi0cFudNF8tmkm5CfOu6Y_jPZT2XKO18aiQ/exec';
  const EMPTY_DB={
  ingredients:[],
  batches:[],

  recipes:[],
  recipeHistory:[],

  products:[],

  plans:[],
  inventoryHistory:[],
  purchaseReceipts:[],

  sales:[],
  vouchers:[],

  cash:[],
  debts:[],
  shifts:[],
  reconciliations:[],

  customers:[],
  customerGroups:[],
  loyaltySettings:[],

  employees:[],
  roles:[],

  priceHistory:[],
  priceAlerts:[],

  settings:{
    tax:8,
    profit:35,
    packaging:2000,
    overhead:8
  }
};
  const state={
  user:null,
  employee:null,
  branchId:'MAIN',
  lastSync:null,
  busy:false,
  online:navigator.onLine!==false,
  pending:false
};
  let pollTimer=null;
  let saveChain=Promise.resolve();
  const safe=s=>String(s??'').replace(/[<>]/g,'');

  window.__FNB_ONLINE_ONLY__=true;
  window.__FNB_API_URL__=API;

  // Remove old persisted data once. V10 itself never writes application data locally.
  try{
    const oldKeys=['fnb_manager_v1','fnb_manager_v9','fnb_v910_queue','fnb_v910_meta','fnb_v910_conflicts','fnb_v9_url','v9_webapp_url','v9AppsScriptUrl'];
    oldKeys.forEach(k=>window.localStorage.removeItem(k));
  }catch(e){}

  function emptyDb(){return JSON.parse(JSON.stringify(EMPTY_DB));}
  function normalizeDb(x){

  const base=emptyDb();

  if(!x || typeof x!=='object'){
    return base;
  }

  const d={
    ...base,
    ...x
  };

  d.ingredients=Array.isArray(d.ingredients)?d.ingredients:[];
  d.batches=Array.isArray(d.batches)?d.batches:[];

  d.recipes=Array.isArray(d.recipes)?d.recipes:[];
  d.recipeHistory=Array.isArray(d.recipeHistory)?d.recipeHistory:[];

  d.products=Array.isArray(d.products)?d.products:[];

  d.plans=Array.isArray(d.plans)?d.plans:[];
  d.inventoryHistory=Array.isArray(d.inventoryHistory)?d.inventoryHistory:[];
  d.purchaseReceipts=Array.isArray(d.purchaseReceipts)?d.purchaseReceipts:[];

  d.sales=Array.isArray(d.sales)?d.sales:[];
  d.vouchers=Array.isArray(d.vouchers)?d.vouchers:[];

  d.cash=Array.isArray(d.cash)?d.cash:[];
  d.debts=Array.isArray(d.debts)?d.debts:[];
  d.shifts=Array.isArray(d.shifts)?d.shifts:[];
  d.reconciliations=Array.isArray(d.reconciliations)?d.reconciliations:[];

  d.customers=Array.isArray(d.customers)?d.customers:[];
  d.customerGroups=Array.isArray(d.customerGroups)?d.customerGroups:[];
  d.loyaltySettings=Array.isArray(d.loyaltySettings)?d.loyaltySettings:[];

  d.employees=Array.isArray(d.employees)?d.employees:[];
  d.roles=Array.isArray(d.roles)?d.roles:[];

  d.priceHistory=Array.isArray(d.priceHistory)?d.priceHistory:[];
  d.priceAlerts=Array.isArray(d.priceAlerts)?d.priceAlerts:[];

  d.settings={
  tax:8,
  profit:35,
  packaging:2000,
  overhead:8,
  ...(d.settings && typeof d.settings==='object' ? d.settings : {})
};
  return d;
}
  function page(){return document.querySelector('.nav button.active')?.dataset.page||'dashboard';}
  function isModalOpen(){return document.getElementById('modalBack')?.classList.contains('show');}
  function refresh(){
  if(state.user){
    try{
      render(page());

      if(typeof window.v8RefreshPermissions==='function'){
        window.v8RefreshPermissions();
      }
    }catch(e){
      console.error('render',e);
    }
  }
}
  function setStatus(text,kind){
    const b=document.getElementById('v9ConnectionBadge');
    if(b){b.className='badge '+(kind||'info');b.textContent=text;}
  }
  function showApp(){const app=document.querySelector('.app');if(app)app.style.display='flex';}
  function hideApp(){const app=document.querySelector('.app');if(app)app.style.display='none';}
  function jsonError(text){const t=String(text||'').slice(0,500);return new Error(t||'Máy chủ trả về dữ liệu không hợp lệ');}

  async function request(payload){
    const r=await fetch(API,{method:'POST',redirect:'follow',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),cache:'no-store'});
    const text=await r.text();
    let data;try{data=JSON.parse(text)}catch(e){throw jsonError(text)}
    if(!r.ok||data.ok===false||data.success===false)throw new Error(data.message||data.error||('HTTP '+r.status));
    return data;
  }
function bindEmployeeSession(){
  const username=String(state.user?.username||'').trim().toLowerCase();

  const employee=(Array.isArray(db.employees)?db.employees:[])
    .find(e=>
      String(e.username||'').trim().toLowerCase()===username &&
      e.active!==false
    );

  state.employee=employee||null;

  // Session chỉ tồn tại trên thiết bị hiện tại.
  // Không coi đây là DATA dùng chung trên Google Sheets.
  db.sessionEmployeeId=employee?.id||null;
}
  async function pullOnline(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(!navigator.onLine)throw new Error('Không có mạng');
    if(state.pending)return null;
    const data=await request({action:'pull',username:state.user.username,token:state.user.token,branchId:state.branchId});
    if(data.db){
  db=normalizeDb(data.db);

  bindEmployeeSession();

  state.lastSync=data.serverUpdatedAt||new Date().toISOString();

  refresh();
    }
    return data;
  }

  async function pushSnapshot(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(!navigator.onLine)throw new Error('Không có mạng');
    const payloadDb=normalizeDb(JSON.parse(JSON.stringify(db)));

// Session đăng nhập là của riêng thiết bị.
// Tuyệt đối không ghi nó vào DATA chung.
delete payloadDb.sessionEmployeeId;

const data=await request({
  action:'sync',
  username:state.user.username,
  token:state.user.token,
  branchId:state.branchId,
  clientUpdatedAt:state.lastSync,
  db:payloadDb
});
    if(data.db){db=normalizeDb(data.db);state.lastSync=data.serverUpdatedAt||new Date().toISOString();}
    refresh();
    return data;
  }

  function queueSave(){
    if(!state.user||!navigator.onLine)return;
    state.pending=true;
    setStatus('Đang ghi lên Google Sheets...','info');
    saveChain=saveChain.then(async()=>{
      try{await pushSnapshot();state.pending=false;setStatus('Online · đã lưu máy chủ','ok');}
      catch(e){state.pending=false;setStatus('Lỗi kết nối máy chủ','danger');toast('❌ Chưa ghi được Google Sheets: '+(e.message||'Không xác định'));console.error('V10 save',e)}
    });
  }
  window.save=function(){queueSave();return true;};

  async function login(username,password){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(password));
    const passwordHash=[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const data=await request({action:'login',username,passwordHash});
    if(!data.user)throw new Error('Đăng nhập thất bại');
    state.user=data.user;state.branchId=data.user.branchId||'MAIN';state.lastSync=null;state.pending=false;db=emptyDb();showApp();closeModal();setStatus('Đang tải DATA từ Google Sheets...','info');await pullOnline();setStatus('Online · dữ liệu từ Google Sheets','ok');refresh();startPolling();toast('✅ Đăng nhập thành công · đã tải DATA máy chủ');
  }

  function loginModal(message){
    openModal(`<h2>🔐 Đăng nhập F&B Manager</h2>${message?`<div class="alert danger" style="margin-bottom:14px">${safe(message)}</div>`:''}<div class="form-grid"><div class="field full"><label>Tài khoản</label><input id="v10User" autocomplete="username"></div><div class="field full"><label>Mật khẩu</label><input id="v10Pass" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')v10DoLogin()"></div></div><div class="modal-actions"><button class="btn primary" id="v10LoginBtn" onclick="v10DoLogin()">Đăng nhập</button></div>`);
  }

  window.v10DoLogin=async function(){
    const u=(document.getElementById('v10User')?.value||'').trim(),p=document.getElementById('v10Pass')?.value||'';
    if(!u||!p){toast('Nhập tài khoản và mật khẩu');return}
    const btn=document.getElementById('v10LoginBtn');if(btn){btn.disabled=true;btn.textContent='Đang đăng nhập...'}
    try{await login(u,p)}catch(e){console.error('V10 login',e);loginModal(e.message||'Đăng nhập thất bại')}
    finally{const b=document.getElementById('v10LoginBtn');if(b){b.disabled=false;b.textContent='Đăng nhập'}}
  };
  window.v10LoginAccount=login;
window.v9Login=window.v10DoLogin;
window.v9LoginModal=loginModal;

  window.v9Logout=function(){state.user=null;state.employee=null;state.branchId='MAIN';state.lastSync=null;state.pending=false;clearInterval(pollTimer);pollTimer=null;db=emptyDb();hideApp();loginModal();setStatus('Chưa đăng nhập','warn');};

  window.v9OpenAccount=function(){
  if(!state.user){
    loginModal();
    return;
  }

  const employee=state.employee;
  const role=employee
    ? (db.roles||[]).find(r=>r.id===employee.roleId)
    : null;

  openModal(`
    <h2>☁️ Tài khoản & Online</h2>

    <div class="card" style="box-shadow:none">

      <div class="list-item row">
        <span>Đang đăng nhập</span>
        <b>${safe(employee?.name||state.user.name||state.user.username)}</b>
      </div>

      <div class="list-item row">
        <span>Tài khoản</span>
        <b>${safe(state.user.username)}</b>
      </div>

      <div class="list-item row">
        <span>Vai trò</span>
        <b>${safe(role?.name||state.user.role||'—')}</b>
      </div>

      <div class="list-item row">
        <span>Chi nhánh</span>
        <b>${safe(state.user.branchName||state.branchId||'—')}</b>
      </div>

      <div class="list-item row">
        <span>Dữ liệu</span>
        <b>Google Sheets</b>
      </div>

      <div class="list-item row">
        <span>Đồng bộ gần nhất</span>
        <b>
          ${state.lastSync
            ? new Date(state.lastSync).toLocaleString('vi-VN')
            : '—'}
        </b>
      </div>

    </div>

    <div class="modal-actions">
      <button class="btn primary" onclick="v10SyncNow()">
        ☁️ Lấy DATA mới
      </button>

      <button class="btn danger" onclick="v9Logout()">
        Đăng xuất
      </button>

      <button class="btn" onclick="closeModal()">
        Đóng
      </button>
    </div>
  `);
};

  window.v10SyncNow=async function(){
    if(!state.user){loginModal();return}
    if(state.busy||state.pending)return
    state.busy=true;
    try{setStatus('Đang lấy DATA mới...','info');await pullOnline();setStatus('Online · DATA mới nhất','ok');toast('☁️ Đã lấy DATA mới nhất từ Google Sheets')}
    catch(e){setStatus('Lỗi kết nối máy chủ','danger');toast('❌ Không lấy được DATA: '+(e.message||'Không xác định'))}
    finally{state.busy=false}
  };
  window.v9SyncNow=window.v10SyncNow;window.v911SyncQueue=window.v10SyncNow;
  window.v910ClearLocalQueue=function(){toast('ℹ️ V10 Online-only: không có hàng đợi Offline')};
  window.v911ClearConflicts=function(){toast('ℹ️ V10 Online-only: không có bộ nhớ xung đột cục bộ')};
  window.v10SyncState=function(){return {online:navigator.onLine!==false,user:state.user,branchId:state.branchId,lastSync:state.lastSync,pending:state.pending,conflicts:[],offlineCache:false,apiUrl:API}};
  window.v9state=window.v10SyncState;

  window.v9SaveSettings=function(){state.branchId=(document.getElementById('v9Branch')?.value||state.branchId||'MAIN').trim()||'MAIN';toast('Đã lưu chi nhánh trong phiên Online');};
  window.v9TestConnection=async function(){
    const btn=document.getElementById('v9TestBtn');if(btn){btn.disabled=true;btn.textContent='Đang kiểm tra...'}
    try{const r=await fetch(API,{method:'GET',redirect:'follow',credentials:'omit',cache:'no-store'});const text=await r.text();let data;try{data=JSON.parse(text)}catch(e){throw jsonError(text)}if(!r.ok||data.ok===false)throw new Error(data.message||'Kết nối thất bại');setStatus(state.user?'Online · kết nối OK':'Kết nối OK','ok');toast('✅ Apps Script kết nối OK')}
    catch(e){setStatus('Chưa kết nối','danger');toast('❌ Chưa kết nối được Apps Script')}
    finally{if(btn){btn.disabled=false;btn.textContent='🔌 Kiểm tra kết nối'}}
  };

  window.v9SettingsCard=function(){return `<div class="card" style="margin-top:16px"><div class="section-title">☁️ Online & Đồng bộ</div><div class="form-grid"><div class="field full"><label>Apps Script Web App URL</label><input value="${API}" readonly><div style="font-size:12px;color:var(--muted);margin-top:6px">Kết nối cố định. Không còn URL cũ, không lưu URL vào máy.</div></div><div class="field"><label>Chi nhánh</label><input id="v9Branch" value="${safe(state.branchId||'MAIN')}"></div><div class="field"><label>Trạng thái</label><div style="padding:10px 0"><span id="v9ConnectionBadge" class="badge ${state.user?'ok':'warn'}">${state.user?'Online · dữ liệu từ Google Sheets':'Chưa đăng nhập'}</span></div></div></div><div class="modal-actions"><button class="btn" id="v9TestBtn" onclick="v9TestConnection()">🔌 Kiểm tra kết nối</button><button class="btn primary" onclick="v9SaveSettings()">Lưu chi nhánh</button><button class="btn" onclick="v9OpenAccount()">Tài khoản</button><button class="btn" onclick="v10SyncNow()">☁️ Lấy DATA mới</button></div><div style="margin-top:12px;font-size:12px;color:var(--muted)">Google Sheets là nguồn dữ liệu duy nhất. Thay đổi được ghi Online ngay; các thiết bị đang đăng nhập tự lấy DATA mới.</div></div>`};

  const oldSettings=window.settings;
  window.settings=function(){const base=typeof oldSettings==='function'?oldSettings():'';return base+(window.v9SettingsCard?window.v9SettingsCard():'');};

  function startPolling(){
    clearInterval(pollTimer);
    pollTimer=setInterval(async()=>{if(!state.user||state.busy||state.pending||!navigator.onLine||document.visibilityState==='hidden'||isModalOpen())return;try{await pullOnline();setStatus('Online · đã cập nhật','ok')}catch(e){console.warn('V10 pull',e)}},2500);
  }
  window.addEventListener('online',async()=>{state.online=true;if(state.user&&!state.busy&&!state.pending){try{await pullOnline();setStatus('Online · đã cập nhật','ok')}catch(e){console.warn('V10 reconnect',e)}}startPolling();});
  window.addEventListener('offline',()=>{state.online=false;setStatus('Offline · không lưu dữ liệu','danger');toast('🔴 Mất mạng — V10 không lưu cục bộ')});

  try{db=emptyDb();}catch(e){window.db=emptyDb();}
  hideApp();
  setTimeout(()=>loginModal(),0);
})();
