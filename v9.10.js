/* F&B Manager — ONLINE ONLY
   Single sync engine for the V10 branch.
   Google Sheets via Apps Script is the source of truth.
   No offline data store, journal, queue, conflict cache, local app-data, fetch patching, or sync injection.
*/
(function(){
  'use strict';

  const API_URL='https://script.google.com/macros/s/AKfycbyL2y6Y3iyTMFKt6x_U_JmYP-zTTgMkp1SMi0cFudNF8tmkm5CfOu6Y_jPZT2XKO18aiQ/exec';
  const LEGACY_KEYS=['fnb_manager_v1','fnb_manager_v9','fnb_v910_queue','fnb_v910_meta','fnb_v910_conflicts','fnb_v9_url','v9_webapp_url','v9AppsScriptUrl'];
  const state={user:null,branchId:'MAIN',lastSync:null,online:navigator.onLine!==false,busy:false,dirty:false};
  let pollTimer=null;
  window.__FNB_ONLINE_ONLY__=true;

  // Purge all legacy browser-persisted app/sync data. Runtime data lives only in memory.
  try{LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));}catch(e){}

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const page=()=>document.querySelector('.nav button.active')?.dataset.page||'dashboard';
  const refresh=()=>{try{render(page())}catch(e){console.warn('render after sync',e)}};
  const setStatus=(text,kind)=>{
    const b=document.getElementById('v9ConnectionBadge');
    if(b){b.className='badge '+(kind||'info');b.textContent=text;}
    document.getElementById('v910NetworkBadge')?.remove();
    document.getElementById('v10SyncBadge')?.remove();
  };

  async function post(payload){
    const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),cache:'no-store'});
    const text=await r.text();
    let data;
    try{data=JSON.parse(text)}catch(e){throw new Error('Apps Script trả về dữ liệu không hợp lệ')}
    if(!r.ok||data.ok===false)throw new Error(data.message||('HTTP '+r.status));
    return data;
  }

  async function pullOnline(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(navigator.onLine===false)throw new Error('Không có mạng');
    if(state.dirty)return null;
    const data=await post({action:'pull',username:state.user.username,token:state.user.token,branchId:state.branchId});
    if(data.db){db=data.db;state.lastSync=data.serverUpdatedAt||new Date().toISOString();refresh();}
    return data;
  }

  async function pushOnline(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(navigator.onLine===false)throw new Error('Không có mạng');
    const data=await post({action:'sync',username:state.user.username,token:state.user.token,branchId:state.branchId,clientUpdatedAt:state.lastSync,db});
    if(data.db){db=data.db;state.lastSync=data.serverUpdatedAt||new Date().toISOString();refresh();}
    state.dirty=false;
    return data;
  }

  function startPolling(){
    clearInterval(pollTimer);
    pollTimer=setInterval(async()=>{
      if(!state.user||state.busy||state.dirty||navigator.onLine===false||document.visibilityState==='hidden')return;
      try{await pullOnline();setStatus('Đã đăng nhập · Online','ok')}catch(e){console.warn('Online pull',e)}
    },5000);
  }

  window.v9state=()=>({apiUrl:API_URL,user:state.user,branchId:state.branchId,lastSync:state.lastSync,pending:[],offlineCache:false,online:state.online});

  window.v9SaveSettings=function(){
    state.branchId=(document.getElementById('v9Branch')?.value||'MAIN').trim()||'MAIN';
    const input=document.getElementById('v9ApiUrl');if(input)input.value=API_URL;
    toast('Đã cố định kết nối Online');
    setStatus(state.user?'Đã đăng nhập · Online':'Chưa đăng nhập','info');
  };

  window.v9TestConnection=async function(){
    const btn=document.getElementById('v9TestBtn');
    if(btn){btn.disabled=true;btn.textContent='Đang kiểm tra...'}
    try{const r=await fetch(API_URL,{method:'GET',cache:'no-store'});const data=await r.json();if(!r.ok||!data.ok)throw new Error(data.message||'Kết nối thất bại');setStatus(state.user?'Đã đăng nhập · Kết nối OK':'Kết nối OK','ok');toast('✅ Kết nối Apps Script thành công')}
    catch(e){setStatus('Chưa kết nối','danger');toast('❌ Chưa kết nối được Apps Script')}
    finally{if(btn){btn.disabled=false;btn.textContent='🔌 Kiểm tra kết nối'}}
  };

  window.v9Login=async function(){
    const username=(document.getElementById('v9User')?.value||'').trim();
    const password=document.getElementById('v9Pass')?.value||'';
    if(!username||!password){toast('Nhập tài khoản và mật khẩu');return}
    try{
      const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(password));
      const passwordHash=[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,'0')).join('');
      const data=await post({action:'login',username,passwordHash});
      if(!data.user)throw new Error('Đăng nhập thất bại');
      state.user=data.user;state.branchId=data.user.branchId||'MAIN';state.dirty=false;
      closeModal();setStatus('Đang tải dữ liệu Online...','info');await pullOnline();setStatus('Đã đăng nhập · Online','ok');toast('✅ Đăng nhập thành công · dữ liệu lấy từ máy chủ');startPolling();
    }catch(e){console.error('Online login',e);v9LoginModal(e.message||'Đăng nhập thất bại')}
  };

  window.v9Logout=function(){
  state.user=null;
  state.branchId='MAIN';
  state.lastSync=null;
  state.dirty=false;
  clearInterval(pollTimer);
  pollTimer=null;

  db={
    ingredients:[],
    batches:[],
    recipes:[],
    products:[],
    plans:[],
    sales:[],
    cash:[],
    customers:[],
    debts:[],
    employees:[],
    roles:[],
    customerGroups:[],
    loyaltySettings:[],
    priceHistory:[],
    priceAlerts:[],
    settings:{}
  };

  toast('Đã đăng xuất');
  refresh();
  setStatus('Chưa đăng nhập','warn');
};

  window.v9OpenAccount=function(){
    if(!state.user){v9LoginModal();return}
    openModal(`<h2>Tài khoản</h2><div class="card" style="box-shadow:none"><div class="list-item row"><span>Đang đăng nhập</span><b>${esc(state.user.name||state.user.username)}</b></div><div class="list-item row"><span>Vai trò</span><b>${esc(state.user.role||'—')}</b></div><div class="list-item row"><span>Chi nhánh</span><b>${esc(state.user.branchName||state.branchId||'—')}</b></div><div class="list-item row"><span>Đồng bộ gần nhất</span><b>${state.lastSync?new Date(state.lastSync).toLocaleString('vi-VN'):'Chưa đồng bộ'}</b></div></div><div class="modal-actions"><button class="btn primary" onclick="v9SyncNow()">☁️ Đồng bộ</button><button class="btn danger" onclick="v9Logout();closeModal()">Đăng xuất</button><button class="btn" onclick="closeModal()">Đóng</button></div>`);
  };

  window.v9SyncNow=async function(){
    if(state.busy)return;
    if(!state.user){toast('Cần đăng nhập trước');return}
    if(navigator.onLine===false){toast('🔴 Không có mạng — Online mode không lưu dữ liệu');return}
    state.busy=true;
    try{
      setStatus('Đang đồng bộ Online...','info');
      if(state.dirty){await pushOnline();toast('☁️ Đã ghi dữ liệu lên máy chủ')}
      else{await pullOnline();toast('☁️ Đã lấy dữ liệu mới nhất từ máy chủ')}
      setStatus('Đã đăng nhập · Online','ok');
    }catch(e){console.error('Online sync',e);setStatus('Mất kết nối','danger');toast('❌ Không thể đồng bộ máy chủ: '+(e.message||'Không xác định'))}
    finally{state.busy=false}
  };

  window.save=function(){
    if(!state.user||navigator.onLine===false)return true;
    state.dirty=true;
    clearTimeout(window.__fnbOnlineSaveTimer);
    window.__fnbOnlineSaveTimer=setTimeout(()=>window.v9SyncNow(),0);
    return true;
  };

  window.v9SettingsCard=function(){
    return `<div class="card" style="margin-top:16px"><div class="section-title">☁️ Online & Đồng bộ</div><div class="form-grid"><div class="field full"><label>Apps Script Web App URL</label><input id="v9ApiUrl" value="${API_URL}" readonly><div style="font-size:12px;color:var(--muted);margin-top:6px">Kết nối cố định tới máy chủ Online. Không dùng URL V9 cũ.</div></div><div class="field"><label>Chi nhánh mặc định</label><input id="v9Branch" value="${esc(state.branchId||'MAIN')}"></div><div class="field"><label>Trạng thái</label><div style="padding:10px 0"><span id="v9ConnectionBadge" class="badge ${state.user?'ok':'warn'}">${state.user?'Đã đăng nhập · Online':'Chưa đăng nhập'}</span></div></div></div><div class="modal-actions"><button class="btn" id="v9TestBtn" onclick="v9TestConnection()">🔌 Kiểm tra kết nối</button><button class="btn primary" onclick="v9SaveSettings()">Lưu chi nhánh</button><button class="btn" onclick="v9OpenAccount()">Tài khoản</button><button class="btn primary" onclick="v9LoginModal()">🔐 Đăng nhập</button><button class="btn" onclick="v9SyncNow()">☁️ Đồng bộ ngay</button></div><div style="margin-top:12px;font-size:12px;color:var(--muted)">Online-only: Google Sheets/Apps Script là nguồn dữ liệu duy nhất. Khi có mạng, thay đổi được ghi máy chủ ngay và app tự lấy dữ liệu mới mỗi 5 giây.</div></div>`;
  };

  window.v910ClearLocalQueue=function(){toast('ℹ️ Không còn hàng đợi Offline')};
  window.v911SyncQueue=function(){return window.v9SyncNow()};
  window.v911ClearConflicts=function(){toast('ℹ️ Không còn hàng đợi xung đột Offline')};
  window.v10SyncNow=function(){return window.v9SyncNow()};
  window.v10SyncState=function(){return {online:state.online,user:state.user,branchId:state.branchId,lastSync:state.lastSync,pending:[],conflicts:[],apiUrl:API_URL}};

  window.addEventListener('online',async()=>{state.online=true;setStatus(state.user?'Đã đăng nhập · Online':'Online · chưa đăng nhập',state.user?'ok':'info');if(state.user&&!state.busy){try{await pullOnline()}catch(e){console.warn('Reconnect pull',e)}}startPolling()});
  window.addEventListener('offline',()=>{state.online=false;setStatus('Offline · không lưu dữ liệu','danger')});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>startPolling(),{once:true});else startPolling();
})();
