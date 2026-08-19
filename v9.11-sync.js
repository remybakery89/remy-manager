/* =========================================================
   V9.11 — QUEUE SYNC CLIENT (SAFE)
   Manual sync + server refresh.
   IMPORTANT: no MutationObserver. Settings rendering is hooked once
   to avoid recursive DOM work / browser hangs.
========================================================= */
(function(){
  'use strict';
  if(window.__v911QueueSync) return;

  const QUEUE_KEY='fnb_v910_queue';
  const META_KEY='fnb_v910_meta';
  const CONFLICT_KEY='fnb_v910_conflicts';

  const read=(k,d)=>{
    try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}
    catch(e){return d;}
  };
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

  function appState(){
    try{return window.v9state?.()||{};}catch(e){return {};}
  }

  function getUrl(){
    const s=appState();
    const candidates=[s.apiUrl,s.url,s.webAppUrl,
      localStorage.getItem('fnb_v9_url'),
      localStorage.getItem('v9_webapp_url'),
      localStorage.getItem('v9AppsScriptUrl')].filter(Boolean);
    for(const x of candidates){
      if(/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/i.test(String(x))) return String(x);
    }
    const input=[...document.querySelectorAll('input')].find(i=>/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/i.test(i.value||''));
    return input?.value||'';
  }

  function syncStatus(){
    const q=read(QUEUE_KEY,[]), c=read(CONFLICT_KEY,[]), online=navigator.onLine!==false;
    const e=document.getElementById('v910SyncStatus');
    if(e)e.innerHTML=(online?'🟢 Online':'🟠 Offline')+' · '+q.length+' thay đổi đang chờ · '+c.length+' xung đột';
    const badge=document.getElementById('v910NetworkBadge');
    if(badge){
      badge.textContent=c.length?'🔴 Xung đột '+c.length:(online?(q.length?'🔵 Online · chờ '+q.length:'🟢 Online'):'🟠 Offline'+(q.length?' · chờ '+q.length:''));
      badge.title=online?'Có kết nối mạng':'Đang dùng dữ liệu trên thiết bị';
    }
  }

  function setButtonState(working){
    const b=document.getElementById('v911SyncButton');
    if(!b)return;
    b.disabled=working;
    b.textContent=working?'⏳ Đang đồng bộ...':'☁️ Đồng bộ ngay';
  }

  async function postQueue(url,ops){
    const s=appState(), user=s.user||{};
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'pushQueue',username:user.username||'local-user',token:user.token||'',branchId:s.branchId||'MAIN',ops}),cache:'no-store'});
    const text=await response.text();
    let data;try{data=JSON.parse(text);}catch(e){throw new Error('Apps Script trả về dữ liệu không hợp lệ');}
    if(!response.ok||data.ok===false)throw new Error(data.message||('HTTP '+response.status));
    return data;
  }

  async function pullServer(){
    if(typeof window.v9PullNow==='function')return window.v9PullNow();
    const s=appState(),user=s.user||{};
    if(!user.username)throw new Error('Chưa đăng nhập');
    const url=getUrl();
    if(!url)throw new Error('Chưa tìm thấy Apps Script Web App URL');
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action:'pull',username:user.username,token:user.token||'',branchId:s.branchId||'MAIN'}),cache:'no-store'});
    const text=await response.text();let data;
    try{data=JSON.parse(text);}catch(e){throw new Error('Apps Script trả về dữ liệu không hợp lệ');}
    if(!response.ok||data.ok===false)throw new Error(data.message||('HTTP '+response.status));
    if(data.db&&typeof window.v9ApplyServerData==='function')window.v9ApplyServerData(data);
    return data;
  }

  async function syncQueue(){
    if(window.__v911SyncWorking)return;
    if(navigator.onLine===false){toast('Đang offline — chưa thể đồng bộ');return;}
    const q=read(QUEUE_KEY,[]);

    // No pending local queue still needs a real SERVER → DEVICE refresh.
    if(!q.length){
      setButtonState(true);
      try{
        await pullServer();
        syncStatus();
        toast('☁️ Đã cập nhật dữ liệu từ máy chủ');
      }catch(err){
        console.error('V9.11 pull',err);syncStatus();toast('Đồng bộ lỗi: '+(err?.message||'Không xác định'));
      }finally{setButtonState(false);}
      return;
    }

    const url=getUrl();
    if(!url){toast('Chưa tìm thấy Apps Script Web App URL');return;}

    window.__v911SyncWorking=true;setButtonState(true);
    try{
      const result=await postQueue(url,q);
      const done=new Set((result.processedOpIds||[]).map(String));
      write(QUEUE_KEY,q.filter(x=>!done.has(String(x.opId))));
      const oldConflicts=read(CONFLICT_KEY,[]);
      const newConflicts=(result.conflicts||[]).map(x=>({...x,at:new Date().toISOString(),deviceId:read(META_KEY,{}).deviceId||''}));
      write(CONFLICT_KEY,[...oldConflicts,...newConflicts]);
      const meta=read(META_KEY,{});
      if(result.serverUpdatedAt)meta.serverUpdatedAt=result.serverUpdatedAt;
      if(result.serverVersion!=null)meta.serverVersion=result.serverVersion;
      write(META_KEY,meta);

      // Critical: after pushing local changes, pull the canonical server state back.
      await pullServer();

      window.dispatchEvent(new Event('v911queuechange'));
      syncStatus();
      toast(newConflicts.length?'Đã đồng bộ phần an toàn · còn '+newConflicts.length+' xung đột':'Đồng bộ thành công · đã cập nhật máy chủ và thiết bị');
    }catch(err){
      console.error('V9.11 sync',err);syncStatus();toast('Đồng bộ lỗi: '+(err?.message||'Không xác định'));
    }finally{window.__v911SyncWorking=false;setButtonState(false);}
  }

  function clearConflicts(){
    const c=read(CONFLICT_KEY,[]);
    if(!c.length){toast('Không có xung đột');return;}
    if(!confirm('Xóa danh sách xung đột trên thiết bị? Không xóa dữ liệu trên máy chủ.'))return;
    write(CONFLICT_KEY,[]);syncStatus();toast('Đã xóa danh sách xung đột');
  }

  function injectControls(){
    const card=document.getElementById('v910DataCard');
    if(!card)return;
    if(document.getElementById('v911SyncButton')){syncStatus();return;}
    const toolbar=card.querySelector('.toolbar')||card;
    const sync=document.createElement('button');
    sync.className='btn primary';sync.id='v911SyncButton';sync.type='button';sync.textContent='☁️ Đồng bộ ngay';sync.onclick=syncQueue;
    toolbar.insertBefore(sync,toolbar.firstChild);
    const conflict=document.createElement('button');
    conflict.className='btn';conflict.type='button';conflict.textContent='⚠️ Xem xung đột';
    conflict.onclick=()=>{
      const c=read(CONFLICT_KEY,[]);
      if(!c.length){toast('Không có xung đột');return}
      openModal(`<h2>Xung đột đồng bộ</h2><p style="color:var(--muted)">Các thay đổi này không được tự động ghi đè dữ liệu trên máy chủ.</p><div class="list">${c.map(x=>`<div class="alert warn"><div>⚠️</div><div><b>${x.entity||'Dữ liệu'} · ${x.entityId||''}</b><div style="font-size:12px;margin-top:4px">${x.reason||'conflict'}</div><div style="font-size:11px;color:var(--muted);margin-top:4px">${x.at||''}</div></div></div>`).join('')}</div><div class="modal-actions"><button class="btn" onclick="closeModal()">Đóng</button><button class="btn danger" onclick="v911ClearConflicts();closeModal()">Xóa danh sách</button></div>`);
    };
    toolbar.appendChild(conflict);syncStatus();
  }

  function hookSettings(){
    if(typeof window.renderV8Settings!=='function')return false;
    if(window.renderV8Settings.__v911SafeHook)return true;
    const base=window.renderV8Settings;
    function wrapped(){
      const result=base.apply(this,arguments);
      setTimeout(injectControls,0);
      setTimeout(injectControls,80);
      return result;
    }
    wrapped.__v911SafeHook=true;
    window.renderV8Settings=wrapped;
    return true;
  }

  window.v911SyncQueue=syncQueue;
  window.v911ClearConflicts=clearConflicts;
  window.addEventListener('online',syncStatus);
  window.addEventListener('offline',syncStatus);
  window.addEventListener('v911queuechange',syncStatus);

  const timer=setInterval(()=>{if(hookSettings())clearInterval(timer);},100);
  setTimeout(()=>{hookSettings();injectControls();syncStatus();},500);
  window.__v911QueueSync=true;
})();
