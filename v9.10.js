/* =========================================================
   V9.10 — MULTI-DEVICE DATA FOUNDATION
   Client-side foundation only. No automatic cloud sync yet.
   - Network status
   - Device ID
   - Local change journal / pending queue
   - Generic add/update/delete diffing for master data
   - Conflict queue foundation
   - Settings card for Admin
========================================================= */
(function(){
  'use strict';
  if(window.__v910MultiDeviceFoundation) return;

  const DB_KEY = 'fnb_manager_v1';
  const META_KEY = 'fnb_v910_meta';
  const QUEUE_KEY = 'fnb_v910_queue';
  const CONFLICT_KEY = 'fnb_v910_conflicts';
  const COLLECTIONS = ['ingredients','recipes','products','plans','sales','cash','batches'];

  function read(key, fallback){
    try { const v=JSON.parse(localStorage.getItem(key)); return v==null?fallback:v; }
    catch(e){ return fallback; }
  }
  function write(key,value){ localStorage.setItem(key,JSON.stringify(value)); }
  function makeId(prefix){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }
  function hash(value){
    const s=JSON.stringify(value);
    let h=2166136261;
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }

  let meta=read(META_KEY,{});
  if(!meta.deviceId) meta.deviceId=makeId('device');
  if(!meta.createdAt) meta.createdAt=new Date().toISOString();
  if(!meta.lastJournalAt) meta.lastJournalAt=null;
  if(!meta.serverVersion) meta.serverVersion=null;
  write(META_KEY,meta);

  function currentUser(){
    try { return window.v9state?.()?.user?.username || 'local-user'; } catch(e){ return 'local-user'; }
  }
  function branchId(){
    try { return window.v9state?.()?.branchId || 'MAIN'; } catch(e){ return 'MAIN'; }
  }

  function queue(){ return read(QUEUE_KEY,[]); }
  function conflicts(){ return read(CONFLICT_KEY,[]); }

  function addQueue(op){
    const q=queue();
    q.push(op);
    write(QUEUE_KEY,q);
    meta.lastJournalAt=op.at;
    write(META_KEY,meta);
    renderStatus();
  }

  function snapshot(){
    try { return JSON.parse(localStorage.getItem(DB_KEY)||'{}'); }
    catch(e){ return {}; }
  }

  function byId(arr){
    const m={};
    (Array.isArray(arr)?arr:[]).forEach(x=>{ if(x && x.id!=null) m[String(x.id)]=x; });
    return m;
  }

  function journalDiff(before,after){
    const at=new Date().toISOString();
    COLLECTIONS.forEach(collection=>{
      const a=byId(before[collection]);
      const b=byId(after[collection]);
      const ids=new Set([...Object.keys(a),...Object.keys(b)]);
      ids.forEach(id=>{
        const oldVal=a[id];
        const newVal=b[id];
        if(!oldVal && newVal){
          addQueue({opId:makeId('op'),type:'create',entity:collection,entityId:id,after:newVal,beforeHash:null,deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
        }else if(oldVal && !newVal){
          addQueue({opId:makeId('op'),type:'delete',entity:collection,entityId:id,after:null,beforeHash:hash(oldVal),deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
        }else if(oldVal && newVal && hash(oldVal)!==hash(newVal)){
          addQueue({opId:makeId('op'),type:'update',entity:collection,entityId:id,after:newVal,beforeHash:hash(oldVal),deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
        }
      });
    });
    if(hash(before.settings||{})!==hash(after.settings||{})){
      addQueue({opId:makeId('op'),type:'update',entity:'settings',entityId:'app',after:after.settings||{},beforeHash:hash(before.settings||{}),deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
    }
  }

  // Wrap the existing save() without changing its original behavior.
  const originalSave=window.save;
  if(typeof originalSave==='function'){
    window.save=function(){
      const before=snapshot();
      const result=originalSave.apply(this,arguments);
      const after=snapshot();
      try { journalDiff(before,after); } catch(e){ console.warn('V9.10 journal',e); }
      return result;
    };
  }

  function setNetworkBadge(){
    let b=document.getElementById('v910NetworkBadge');
    if(!b){
      b=document.createElement('div');
      b.id='v910NetworkBadge';
      b.style.cssText='position:fixed;right:18px;bottom:18px;z-index:190;background:#fff;border:1px solid var(--line,#e4e9e6);border-radius:999px;padding:7px 11px;font-size:12px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.08)';
      document.body.appendChild(b);
    }
    const online=navigator.onLine!==false;
    const pending=queue().length;
    const conflictsCount=conflicts().length;
    b.textContent=conflictsCount?'🔴 Xung đột '+conflictsCount:online?(pending?'🔵 Online · chờ '+pending:'🟢 Online'):'🟠 Offline'+(pending?' · chờ '+pending:'');
    b.title=online?'Có kết nối mạng':'Đang dùng dữ liệu trên thiết bị';
  }
  window.addEventListener('online',setNetworkBadge);
  window.addEventListener('offline',setNetworkBadge);

  function renderStatus(){
    setNetworkBadge();
    const e=document.getElementById('v910SyncStatus');
    if(!e) return;
    const q=queue().length, c=conflicts().length;
    e.innerHTML=(navigator.onLine!==false?'🟢 Online':'🟠 Offline')+' · '+q+' thay đổi đang chờ · '+c+' xung đột';
  }

  window.v910GetState=function(){
    return {deviceId:meta.deviceId,online:navigator.onLine!==false,pending:queue(),conflicts:conflicts(),serverVersion:meta.serverVersion};
  };

  window.v910ClearLocalQueue=function(){
    if(!confirm('Xóa hàng đợi thay đổi cục bộ? Chỉ làm việc này khi bạn chắc chắn các thay đổi đã được xử lý.')) return;
    write(QUEUE_KEY,[]); renderStatus(); toast('Đã xóa hàng đợi cục bộ');
  };

  const oldCard=window.v9SettingsCard;
  if(typeof oldCard==='function'){
    window.v9SettingsCard=function(){
      let base=oldCard();
      if(base.includes('id="v910DataCard"')) return base;
      return base+`<div class="card" id="v910DataCard" style="margin-top:16px">
        <div class="section-title">🔄 Dữ liệu & đồng bộ</div>
        <div id="v910SyncStatus" style="font-size:13px;margin:8px 0">Đang kiểm tra...</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.55">
          Thiết bị: <b>${meta.deviceId}</b><br>
          Chế độ hiện tại: <b>tự động</b> — khi offline app dùng dữ liệu trên thiết bị.<br>
          Các thay đổi được ghi vào hàng đợi để xử lý khi cơ chế đồng bộ máy chủ được bật.
        </div>
        <div class="toolbar" style="margin-top:12px">
          <button class="btn" onclick="v910ClearLocalQueue()">🧹 Xóa hàng đợi</button>
        </div>
      </div>`;
    };
  }

  window.__v910MultiDeviceFoundation=true;
  setTimeout(renderStatus,50);
  setTimeout(renderStatus,400);
})();
