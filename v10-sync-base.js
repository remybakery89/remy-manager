/* F&B Manager V10 — ONLINE ONLY
   Google Sheets / Apps Script is the only persistent data source.
   No localStorage, IndexedDB, offline queue, conflict cache, or local app database.
   The existing application UI/features remain in index.html; this file is the online
   data bridge/UI integration base. Shared configuration and runtime state are supplied
   by v10/config.js and v10/state.js before this module is loaded.
*/
(function(){
  'use strict';

  const config=window.FNB_CONFIG||{};
  const runtime=window.FNB_RUNTIME||{};
  const API=config.API||window.__FNB_API_URL__||'';
  const api=window.FNB_API||null;
  const EMPTY_DB=runtime.EMPTY_DB||{
    ingredients:[],batches:[],recipes:[],recipeHistory:[],products:[],plans:[],
    inventoryHistory:[],purchaseReceipts:[],sales:[],vouchers:[],cash:[],debts:[],
    shifts:[],reconciliations:[],customers:[],customerGroups:[],loyaltySettings:[],
    employees:[],roles:[],priceHistory:[],priceAlerts:[],
    settings:{tax:8,profit:35,packaging:2000,overhead:8}
  };
  const state=runtime.state||{
    user:null,employee:null,branchId:config.BRANCH_DEFAULT||'MAIN',lastSync:null,
    busy:false,online:navigator.onLine!==false,pending:false
  };
  const safe=s=>String(s??'').replace(/[<>]/g,'');

  window.__FNB_ONLINE_ONLY__=true;
  window.__FNB_API_URL__=API;
  window.FNB_RUNTIME=runtime;
  runtime.state=state;
  runtime.EMPTY_DB=EMPTY_DB;

  // Remove old persisted data once. V10 itself never writes application data locally.
  try{
    const oldKeys=['fnb_manager_v1','fnb_manager_v9','fnb_v910_queue','fnb_v910_meta','fnb_v910_conflicts','fnb_v9_url','v9_webapp_url','v9AppsScriptUrl'];
    oldKeys.forEach(k=>window.localStorage.removeItem(k));
  }catch(e){}

  function emptyDb(){
    if(typeof runtime.emptyDb==='function')return runtime.emptyDb();
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }
  function normalizeDb(x){
    const base=emptyDb();
    if(!x || typeof x!=='object')return base;
    const d={...base,...x};

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
    d.settings={...(config.SETTINGS_DEFAULTS||{tax:8,profit:35,packaging:2000,overhead:8}),...(d.settings&&typeof d.settings==='object'?d.settings:{})};
    return d;
  }
  function page(){return document.querySelector('.nav button.active')?.dataset.page||'dashboard';}
  function isModalOpen(){return document.getElementById('modalBack')?.classList.contains('show');}
  function refresh(){
    if(state.user){
      try{
        render(page());
        if(typeof window.v8RefreshPermissions==='function')window.v8RefreshPermissions();
      }catch(e){console.error('render',e)}
    }
  }
  function setStatus(text,kind){
    const b=document.getElementById('v9ConnectionBadge');
    if(b){b.className='badge '+(kind||'info');b.textContent=text;}
  }
  function showApp(){const app=document.querySelector('.app');if(app)app.style.display='flex';}
  function hideApp(){const app=document.querySelector('.app');if(app)app.style.display='none';}

  function requireApi(){
    if(!api||typeof api.request!=='function'||typeof api.get!=='function')throw new Error('API module chưa được tải');
    return api;
  }

  // Internal contract consumed by the dedicated sync module.
  window.FNB_BASE_INTERNAL={
    emptyDb,
    normalizeDb,
    refresh,
    setStatus,
    showApp,
    hideApp,
    requireApi,
    getDb:function(){return db;},
    setDb:function(value){db=value;},
    getSafe:function(value){return safe(value);},
    isModalOpen
  };

  window.v9SaveSettings=function(){state.branchId=(document.getElementById('v9Branch')?.value||state.branchId||config.BRANCH_DEFAULT||'MAIN').trim()||config.BRANCH_DEFAULT||'MAIN';toast('Đã lưu chi nhánh trong phiên Online');};
  window.v9TestConnection=async function(){
    const btn=document.getElementById('v9TestBtn');if(btn){btn.disabled=true;btn.textContent='Đang kiểm tra...'}
    try{await requireApi().get();setStatus(state.user?'Online · kết nối OK':'Kết nối OK','ok');toast('✅ Apps Script kết nối OK')}
    catch(e){setStatus('Chưa kết nối','danger');toast('❌ Chưa kết nối được Apps Script')}
    finally{if(btn){btn.disabled=false;btn.textContent='🔌 Kiểm tra kết nối'}}
  };
  window.v9SettingsCard=function(){return `<div class="card" style="margin-top:16px"><div class="section-title">☁️ Online & Đồng bộ</div><div class="form-grid"><div class="field full"><label>Apps Script Web App URL</label><input value="${API}" readonly><div style="font-size:12px;color:var(--muted);margin-top:6px">Kết nối cố định. Không còn URL cũ, không lưu URL vào máy.</div></div><div class="field"><label>Chi nhánh</label><input id="v9Branch" value="${safe(state.branchId||config.BRANCH_DEFAULT||'MAIN')}"></div><div class="field"><label>Trạng thái</label><div style="padding:10px 0"><span id="v9ConnectionBadge" class="badge ${state.user?'ok':'warn'}">${state.user?'Online · dữ liệu từ Google Sheets':'Chưa đăng nhập'}</span></div></div></div><div class="modal-actions"><button class="btn" id="v9TestBtn" onclick="v9TestConnection()">🔌 Kiểm tra kết nối</button><button class="btn primary" onclick="v9SaveSettings()">Lưu chi nhánh</button><button class="btn" onclick="v9OpenAccount()">Tài khoản</button><button class="btn" onclick="v10SyncNow()">☁️ Lấy DATA mới</button></div><div style="margin-top:12px;font-size:12px;color:var(--muted)">Google Sheets là nguồn dữ liệu duy nhất. Thay đổi được ghi Online ngay; các thiết bị đang đăng nhập tự lấy DATA mới.</div></div>`};
  const oldSettings=window.settings;
  window.settings=function(){const base=typeof oldSettings==='function'?oldSettings():'';return base+(window.v9SettingsCard?window.v9SettingsCard():'');};

  try{db=emptyDb();}catch(e){window.db=emptyDb();}
  hideApp();
})();