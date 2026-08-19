/* F&B Manager V10 — SINGLE DATA SYNC MODULE
   Online-first sync + offline journal/queue.
   No wrappers around save(), no MutationObserver, no script injection.
*/
(function(){
  'use strict';
  if(window.__fnbV10Sync) return;

  const DB_KEY='fnb_manager_v1';
  const META_KEY='fnb_v910_meta';
  const QUEUE_KEY='fnb_v910_queue';
  const CONFLICT_KEY='fnb_v910_conflicts';
  const COLLECTIONS=['ingredients','recipes','products','plans','sales','cash','batches'];
  const DEFAULT_API_URL='https://script.google.com/macros/s/AKfycbyL2y6Y3iyTMFKt6x_U_JmYP-zTTgMkp1SMi0cFudNF8tmkm5CfOu6Y_jPZT2XKO18aiQ/exec';
  const LEGACY_API_URLS=['https://script.google.com/macros/s/AKfycbyTDqlWXW9F1whF0J_cn8u-YbMHNvmvSsWRVCIP6-DRmus6MY06uXsC4dtDwLQXU-lh-w/exec'];

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
      el=document.createElement('button');el.id='v10SyncBadge';el.type='button';el.className='btn small';
      el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:190;border-radius:999px;background:#fff;box-shadow:0 6px 18px rgba(0,0,0,.10)';
      el.title='Đồng bộ dữ liệu';el.onclick=()=>window.v10SyncNow();document.body.appendChild(el);
    }
    el.textContent=statusText();
  }

  function currentUser(){return appState().user?.username||'local-user'}
  function branchId(){return appState().branchId||'MAIN'}

  function journalDiff(before,after){
    const at=new Date().toISOString();
    const add=op=>{const q=queue();q.push(op);write(QUEUE_KEY,q);meta.lastJournalAt=at;write(META_KEY,meta)};
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
    try{journalDiff(lastSnapshot,after);if(navigator.onLine!==false)setTimeout(syncNow,0)}catch(e){console.warn('V10 journal',e)}
    lastSnapshot=after;setTimeout(renderSettingsSync,0);
  });

  async function postJson(url,payload){
    let lastError=null;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),cache:'no-store'});
        const text=await response.text();let data;
        try{data=JSON.parse(text)}catch(e){lastError=new Error('Apps Script trả về dữ liệu không hợp lệ');if(attempt===0){await new Promise(resolve=>setTimeout(resolve,800));continue}throw lastError}
        if(!response.ok||data.ok===false)throw new Error(data.message||('HTTP '+response.status));
        return data;
      }catch(e){lastError=e;if(attempt===0&&e?.message==='Apps Script trả về dữ liệu không hợp lệ'){await new Promise(resolve=>setTimeout(resolve,800));continue}throw e}
    }
    throw lastError||new Error('Không thể kết nối máy chủ');
  }

  function isValidApiUrl(value){return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(String(value||''))}
  function isLegacyApiUrl(value){return LEGACY_API_URLS.includes(String(value||''))}

  function getUrl(){
    const s=appState();
    const candidates=[s.apiUrl,s.url,s.webAppUrl,localStorage.getItem('fnb_v9_url'),localStorage.getItem('v9_webapp_url'),localStorage.getItem('v9AppsScriptUrl')].filter(Boolean);
    const saved=candidates.find(isValidApiUrl);
    // A URL saved by an older V9 build must never override the canonical V10 endpoint.
    if(saved&&!isLegacyApiUrl(saved))return saved;
    return DEFAULT_API_URL;
  }

  function buildPayload(action,extra){const s=appState(),u=s.user||{};return Object.assign({action,username:u.username||'local-user',token:u.token||'',branchId:s.branchId||'MAIN'},extra||{})}

  function findServerValue(db,entity,entityId){
    if(entity==='settings')return db?.settings||{};
    const arr=Array.isArray(db?.[entity])?db[entity]:[];return arr.find(x=>x&&String(x.id)===String(entityId))||null;
  }

  async function rebaseOnlineConflicts(url,ops,conflictList){
    if(navigator.onLine===false||!conflictList.length)return {ops,conflictOpIds:new Set()};
    const pull=await postJson(url,buildPayload('pull'));const serverDb=pull.db||{};const conflictIds=new Set(conflictList.map(x=>String(x.opId)));const rebased=[];const stillConflicted=[];
    for(const op of ops){
      if(!conflictIds.has(String(op.opId))){rebased.push(op);continue}
      const serverValue=findServerValue(serverDb,op.entity,op.entityId);
      if(op.type==='update'&&serverValue){rebased.push({...op,beforeHash:hash(serverValue)});continue}
      if(op.type==='delete'&&serverValue){rebased.push({...op,beforeHash:hash(serverValue)});continue}
      if(op.type==='create'&&!serverValue){rebased.push({...op,beforeHash:null});continue}
      if(op.type==='create'&&serverValue){rebased.push({...op,type:'update',beforeHash:hash(serverValue)});continue}
      if(op.entity==='settings'&&op.type==='update'){rebased.push({...op,beforeHash:hash(serverValue||{})});continue}
      stillConflicted.push(op);
    }
    return {ops:rebased,conflictOpIds:conflictIds,stillConflicted};
  }

  async function syncNow(){
    if(window.__fnbV10SyncWorking)return;
    if(navigator.onLine===false){badge();renderSettingsSync();toast('Đang offline — thay đổi sẽ được giữ trên thiết bị');return}
    const q=queue();if(!q.length){badge();renderSettingsSync();toast('Không có thay đổi đang chờ');return}
    const url=getUrl();window.__fnbV10SyncWorking=true;
    try{
      let result=await postJson(url,buildPayload('pushQueue',{ops:q}));let allResolvedOnline=false;
      if((result.conflicts||[]).length&&navigator.onLine!==false){const rebased=await rebaseOnlineConflicts(url,q,result.conflicts||[]);if(rebased.ops.length){result=await postJson(url,buildPayload('pushQueue',{ops:rebased.ops}));allResolvedOnline=!(result.conflicts||[]).length}}
      const done=new Set((result.processedOpIds||[]).map(String));write(QUEUE_KEY,q.filter(x=>!done.has(String(x.opId))));
      const unresolved=(result.conflicts||[]).map(x=>({...x,at:new Date().toISOString(),deviceId:meta.deviceId}));const previous=conflicts();const resolvedIds=new Set((q||[]).map(x=>String(x.opId)).filter(id=>done.has(id)));write(CONFLICT_KEY,[...previous.filter(x=>!resolvedIds.has(String(x.opId))),...unresolved]);
      const m=read(META_KEY,{});if(result.serverUpdatedAt)m.serverUpdatedAt=result.serverUpdatedAt;if(result.serverVersion!=null)m.serverVersion=result.serverVersion;write(META_KEY,m);badge();renderSettingsSync();
      if(unresolved.length)toast('Đã đồng bộ phần an toàn · còn '+unresolved.length+' xung đột');else toast(allResolvedOnline?'Đã đồng bộ online · cập nhật máy chủ ngay':'Đồng bộ thành công · đã xử lý '+done.size+' thay đổi');
    }catch(e){console.error('V10 sync',e);badge();renderSettingsSync();toast('Đồng bộ lỗi: '+(e?.message||'Không xác định'))}finally{window.__fnbV10SyncWorking=false}
  }

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

  function renderSettingsSync(){
    const view=document.getElementById('view');if(!view)return;const title=document.getElementById('topTitle')?.textContent||'';if(title!=='Cài đặt')return;const old=document.getElementById('v10SyncCard');if(old)old.remove();
    const q=queue(),c=conflicts(),online=navigator.onLine!==false;const card=document.createElement('section');card.id='v10SyncCard';card.className='card';card.style.marginTop='16px';
    card.innerHTML=`<div class="row" style="margin-bottom:12px"><h3 class="section-title" style="margin:0">🔄 Dữ liệu &amp; đồng bộ</h3><span class="badge ${c.length?'danger':online?'ok':'warn'}">${esc(c.length?'🔴 Xung đột '+c.length:online?'🟢 Online':'🟠 Offline')}</span></div><div style="display:grid;gap:7px;color:var(--muted);font-size:13px"><div><b>Thiết bị:</b> ${esc(meta.deviceId)}</div><div><b>Trạng thái:</b> ${esc(online?(q.length?'Online · '+q.length+' thay đổi đang chờ':'Online · đã đồng bộ'):'Offline · dữ liệu vẫn lưu trên thiết bị')}</div><div><b>Chế độ:</b> <b>${online?'Online ưu tiên — thay đổi được gửi máy chủ ngay.':'Offline — thay đổi được giữ trên thiết bị và đưa vào hàng đợi.'}</b></div><div><b>Xung đột:</b> ${c.length} · <b>Phiên bản máy chủ:</b> ${esc(meta.serverVersion??'—')}</div></div><div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px"><button type="button" class="btn primary" id="v10SyncBtn">☁️ Đồng bộ ngay</button><button type="button" class="btn" id="v10ClearQueueBtn">🧹 Xóa hàng đợi</button><button type="button" class="btn" id="v10ConflictsBtn">⚠️ Xem xung đột</button></div><div id="v10ConflictsPanel" style="display:none;margin-top:14px"></div>`;
    view.appendChild(card);card.querySelector('#v10SyncBtn').onclick=syncNow;
    card.querySelector('#v10ClearQueueBtn').onclick=()=>{if(!q.length){toast('Hàng đợi đang trống');return}if(confirm('Xóa '+q.length+' thay đổi đang chờ? Các thay đổi này sẽ không được gửi lên máy chủ.')){write(QUEUE_KEY,[]);badge();renderSettingsSync();toast('Đã xóa hàng đợi')}};
    card.querySelector('#v10ConflictsBtn').onclick=()=>{const panel=card.querySelector('#v10ConflictsPanel');if(!c.length){panel.style.display='block';panel.innerHTML='<div class="alert ok">✅ Hiện không có xung đột.</div>';return}panel.style.display=panel.style.display==='none'?'block':'none';panel.innerHTML=c.map((x,i)=>`<div class="alert danger"><div><b>#${i+1} ${esc(x.entity||'')}</b> · ${esc(x.entityId||'')}<br><small>${esc(x.message||x.reason||'Máy chủ báo xung đột')}</small></div></div>`).join('')};
  }

  function installSettingsHook(){document.addEventListener('click',e=>{const btn=e.target.closest?.('[data-page="settings"]');if(btn)setTimeout(renderSettingsSync,0)},true);setTimeout(renderSettingsSync,0)}
  window.v10SyncNow=syncNow;
  window.v10SyncState=()=>({deviceId:meta.deviceId,online:navigator.onLine!==false,pending:queue(),conflicts:conflicts(),serverVersion:meta.serverVersion});
  window.addEventListener('online',()=>{badge();renderSettingsSync();setTimeout(syncNow,100)});window.addEventListener('offline',()=>{badge();renderSettingsSync()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installSettingsHook,{once:true});else installSettingsHook();badge();window.__fnbV10Sync=true;
})();
