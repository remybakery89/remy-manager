/* F&B Manager V10 — SINGLE DATA SYNC MODULE
   One responsibility: local change journal + manual queue sync.
   No wrappers around save(), no render overrides, no MutationObserver,
   and no script injection.
*/
(function(){
  'use strict';
  if(window.__fnbV10Sync) return;

  const DB_KEY='fnb_manager_v1';
  const META_KEY='fnb_v910_meta';
  const QUEUE_KEY='fnb_v910_queue';
  const CONFLICT_KEY='fnb_v910_conflicts';
  const COLLECTIONS=['ingredients','recipes','products','plans','sales','cash','batches'];

  const read=(key,fallback)=>{try{const v=JSON.parse(localStorage.getItem(key));return v==null?fallback:v}catch(e){return fallback}};
  const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
  const makeId=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  const hash=value=>{
    const s=JSON.stringify(value);
    let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  };

  let meta=read(META_KEY,{});
  if(!meta.deviceId)meta.deviceId=makeId('device');
  if(!meta.createdAt)meta.createdAt=new Date().toISOString();
  write(META_KEY,meta);

  const appState=()=>{try{return window.v9state?.()||{}}catch(e){return {}}};
  const queue=()=>read(QUEUE_KEY,[]);
  const conflicts=()=>read(CONFLICT_KEY,[]);
  const snapshot=()=>read(DB_KEY,{});
  const byId=arr=>Object.fromEntries((Array.isArray(arr)?arr:[]).filter(x=>x&&x.id!=null).map(x=>[String(x.id),x]));

  function statusText(){
    const q=queue().length,c=conflicts().length,online=navigator.onLine!==false;
    return c?'🔴 Xung đột '+c:(online?(q?'🔵 Online · chờ '+q:'🟢 Online'):'🟠 Offline'+(q?' · chờ '+q:''));
  }

  function badge(){
    let el=document.getElementById('v10SyncBadge');
    if(!el){
      el=document.createElement('button');
      el.id='v10SyncBadge';
      el.type='button';
      el.className='btn small';
      el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:190;border-radius:999px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.10)';
      el.title='Đồng bộ dữ liệu';
      el.onclick=()=>window.v10SyncNow();
      document.body.appendChild(el);
    }
    el.textContent=statusText();
  }

  function currentUser(){return appState().user?.username||'local-user'}
  function branchId(){return appState().branchId||'MAIN'}

  function journalDiff(before,after){
    const at=new Date().toISOString();
    const add=op=>{
      const q=queue();q.push(op);write(QUEUE_KEY,q);meta.lastJournalAt=at;write(META_KEY,meta);
    };
    for(const collection of COLLECTIONS){
      const a=byId(before[collection]),b=byId(after[collection]);
      const ids=new Set([...Object.keys(a),...Object.keys(b)]);
      for(const entityId of ids){
        const oldVal=a[entityId],newVal=b[entityId];
        if(!oldVal&&newVal)add({opId:makeId('op'),type:'create',entity:collection,entityId,after:newVal,beforeHash:null,deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
        else if(oldVal&&!newVal)add({opId:makeId('op'),type:'delete',entity:collection,entityId,after:null,beforeHash:hash(oldVal),deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
        else if(oldVal&&newVal&&hash(oldVal)!==hash(newVal))add({opId:makeId('op'),type:'update',entity:collection,entityId,after:newVal,beforeHash:hash(oldVal),deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
      }
    }
    if(hash(before.settings||{})!==hash(after.settings||{}))add({opId:makeId('op'),type:'update',entity:'settings',entityId:'app',after:after.settings||{},beforeHash:hash(before.settings||{}),deviceId:meta.deviceId,username:currentUser(),branchId:branchId(),at});
    badge();
  }

  let lastSnapshot=snapshot();
  window.addEventListener('fnb:data-saved',()=>{
    const after=snapshot();
    try{journalDiff(lastSnapshot,after)}catch(e){console.warn('V10 journal',e)}
    lastSnapshot=after;
  });

  async function postQueue(url,ops){
    const s=appState(),u=s.user||{};
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'pushQueue',username:u.username||'local-user',token:u.token||'',branchId:s.branchId||'MAIN',ops}),cache:'no-store'});
    const text=await response.text();
    let data;try{data=JSON.parse(text)}catch(e){throw new Error('Apps Script trả về dữ liệu không hợp lệ')}
    if(!response.ok||data.ok===false)throw new Error(data.message||('HTTP '+response.status));
    return data;
  }

  function getUrl(){
    const s=appState();
    return [s.apiUrl,s.url,s.webAppUrl,localStorage.getItem('fnb_v9_url'),localStorage.getItem('v9_webapp_url'),localStorage.getItem('v9AppsScriptUrl')]
      .filter(Boolean).find(x=>/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(String(x)))||'';
  }

  async function syncNow(){
    if(window.__fnbV10SyncWorking)return;
    if(navigator.onLine===false){toast('Đang offline — chưa thể đồng bộ');return}
    const q=queue();
    if(!q.length){badge();toast('Không có thay đổi đang chờ');return}
    const url=getUrl();
    if(!url){toast('Chưa tìm thấy Apps Script Web App URL');return}
    window.__fnbV10SyncWorking=true;
    try{
      const result=await postQueue(url,q);
      const done=new Set((result.processedOpIds||[]).map(String));
      write(QUEUE_KEY,q.filter(x=>!done.has(String(x.opId))));
      const newConflicts=(result.conflicts||[]).map(x=>({...x,at:new Date().toISOString(),deviceId:meta.deviceId}));
      write(CONFLICT_KEY,[...conflicts(),...newConflicts]);
      const m=read(META_KEY,{});if(result.serverUpdatedAt)m.serverUpdatedAt=result.serverUpdatedAt;if(result.serverVersion!=null)m.serverVersion=result.serverVersion;write(META_KEY,m);
      badge();
      toast(newConflicts.length?'Đã đồng bộ phần an toàn · còn '+newConflicts.length+' xung đột':'Đồng bộ thành công · đã xử lý '+done.size+' thay đổi');
    }catch(e){console.error('V10 sync',e);badge();toast('Đồng bộ lỗi: '+(e?.message||'Không xác định'))}
    finally{window.__fnbV10SyncWorking=false}
  }

  window.v10SyncNow=syncNow;
  window.v10SyncState=()=>({deviceId:meta.deviceId,online:navigator.onLine!==false,pending:queue(),conflicts:conflicts(),serverVersion:meta.serverVersion});
  window.addEventListener('online',badge);
  window.addEventListener('offline',badge);
  badge();
  window.__fnbV10Sync=true;
})();
