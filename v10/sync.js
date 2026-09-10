/* F&B Manager V10 — synchronization layer
   Temporary DIRECT MODE: local-first UI + automatic background writes.
   Google Sheets is the shared source; refresh pulls the latest snapshot.
*/
(function(){
  'use strict';
  const runtime=window.FNB_RUNTIME||{};
  const api=window.FNB_API||null;
  const state=runtime.state||{};
  const base=window.FNB_BASE_INTERNAL||{};
  const persistence=window.FNB_PERSISTENCE||null;
  let saveTimer=null;
  let saveChain=Promise.resolve();
  let started=false;
  function requireFn(fn,name){if(typeof fn!=='function')throw new Error('Sync module chưa sẵn sàng: '+name);return fn;}
  function emptyDb(){return requireFn(base.emptyDb,'emptyDb')()}
  function normalizeDb(x){return requireFn(base.normalizeDb,'normalizeDb')(x)}
  function refresh(){return requireFn(base.refresh,'refresh')()}
  function setStatus(text,kind){return requireFn(base.setStatus,'setStatus')(text,kind)}
  function showApp(){return requireFn(base.showApp,'showApp')()}
  function hideApp(){return requireFn(base.hideApp,'hideApp')()}
  function safe(value){return typeof base.getSafe==='function'?base.getSafe(value):String(value??'').replace(/[<>]/g,'')}
  function requireApi(){if(!api||typeof api.request!=='function'||typeof api.get!=='function')throw new Error('API module chưa được tải');return api;}
  function db(){return typeof base.getDb==='function'?base.getDb():window.db}
  function setDb(value){if(typeof base.setDb==='function')base.setDb(value);else window.db=value}
  function bindEmployeeSession(){
    const currentDb=db()||{};
    const employee=(Array.isArray(currentDb.employees)?currentDb.employees:[]).find(e=>String(e.username||'').trim().toLowerCase()==='admin'&&e.active!==false);
    state.employee=employee||null;
    currentDb.sessionEmployeeId=employee?.id||null;
    setDb(currentDb);
    return employee||null;
  }
  async function fetchDirectChunks(meta){
    if(meta?.db)return {db:meta.db,serverUpdatedAt:meta.serverUpdatedAt||null};
    const total=Number(meta?.totalChunks)||0;
    if(!total)return {db:null,serverUpdatedAt:meta?.serverUpdatedAt||meta?.updatedAt||null};
    const parts=[];
    let serverUpdatedAt=meta.serverUpdatedAt||meta.updatedAt||null;
    for(let i=0;i<total;i++){
      const part=await requireApi().request({action:'directPullChunk',branchId:state.branchId,chunk:i});
      if(Number(part.chunk)!==i)throw new Error('DATA chunk không đúng thứ tự');
      parts.push(String(part.payload||''));
      serverUpdatedAt=part.serverUpdatedAt||serverUpdatedAt;
    }
    let parsed;
    try{parsed=JSON.parse(parts.join(''));}catch(e){throw new Error('DATA tải về không hợp lệ: '+(e.message||e));}
    return {db:parsed,serverUpdatedAt};
  }
  async function persistSnapshot(){if(!persistence)return;try{await persistence.saveSnapshot(db(),state.lastSync)}catch(e){console.warn('V10 local snapshot',e)}}
  async function pullOnline(){
    if(!navigator.onLine)throw new Error('Không có mạng');
    const meta=await requireApi().request({action:'directPull',branchId:state.branchId});
    const received=await fetchDirectChunks(meta);
    if(received.db){
      setDb(normalizeDb(received.db));
      bindEmployeeSession();
      state.lastSync=received.serverUpdatedAt||state.lastSync||new Date().toISOString();
      await persistSnapshot();
      refresh();
    }
    return meta;
  }
  async function pushSnapshot(snapshot){
    if(!navigator.onLine)throw new Error('Không có mạng');
    const payloadDb=normalizeDb(JSON.parse(JSON.stringify(snapshot||db())));
    delete payloadDb.sessionEmployeeId;
    const data=await requireApi().request({action:'directSync',branchId:state.branchId,db:payloadDb});
    setDb(payloadDb);
    bindEmployeeSession();
    state.lastSync=data.serverUpdatedAt||new Date().toISOString();
    await persistSnapshot();
    return data;
  }
  async function removeOutboxItems(items){
    if(!persistence)return;
    for(const item of items){try{await persistence.removeOutbox(item.id)}catch(e){console.warn('V10 remove outbox',e)}}
  }
  async function flushOutbox(){
    if(!persistence||!navigator.onLine)return false;
    const items=await persistence.listOutbox();
    if(!items.length)return false;
    const latest=items[items.length-1];
    try{
      setStatus('Đang lưu dữ liệu...','info');
      await pushSnapshot(latest.db);
      await removeOutboxItems(items);
      state.pending=false;
      setStatus('Đã lưu · Google Sheets','ok');
      refresh();
      return true;
    }catch(e){
      state.pending=true;
      setStatus('Chưa lưu máy chủ · sẽ tự thử lại','warn');
      console.warn('V10 direct auto-save retry',e);
      return false;
    }
  }
  async function queueSave(){
    const snapshot=normalizeDb(JSON.parse(JSON.stringify(db())));
    state.pending=true;
    try{
      if(persistence){
        await persistence.saveSnapshot(snapshot,state.lastSync);
        await persistence.addOutbox({db:snapshot,lastSync:state.lastSync});
      }
    }catch(e){console.warn('V10 local persistence',e)}
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{saveChain=saveChain.then(()=>flushOutbox())},350);
    return true;
  }
  window.save=function(){queueSave();return true;};
  window.v10SyncNow=async function(){
    if(state.busy)return;
    state.busy=true;
    try{await flushOutbox();if(!state.pending)await pullOnline();setStatus('Đã cập nhật từ Google Sheets','ok');refresh()}
    catch(e){setStatus('Không thể cập nhật từ Google Sheets','warn');console.warn('V10 refresh pull',e)}
    finally{state.busy=false}
  };
  async function restoreLocal(){
    if(!persistence)return false;
    try{
      const cached=await persistence.loadSnapshot();
      if(cached?.db){setDb(normalizeDb(cached.db));state.lastSync=cached.lastSync||null;bindEmployeeSession();return true}
    }catch(e){console.warn('V10 restore cache',e)}
    return false;
  }
  async function start(){
    if(started)return true;
    started=true;
    state.online=navigator.onLine;
    const restored=await restoreLocal();
    if(restored)refresh();
    try{
      if(navigator.onLine){
        const hadPending=await flushOutbox();
        if(!hadPending)await pullOnline();
      }
    }catch(e){console.warn('V10 direct startup sync',e)}
    return true;
  }
  function startPolling(){return true;}
  function stopPolling(){}
  window.FNB_SYNC_INTERNAL={api,requireApi,emptyDb,normalizeDb,pullOnline,pushSnapshot,startPolling,stopPolling,queueSave,refresh,setStatus,showApp,hideApp,getDb:db,setDb,getSafe:safe,restoreLocal,start,flushOutbox,persistSnapshot,bindEmployeeSession};
  window.addEventListener('online',async()=>{state.online=true;if(!state.busy){try{if(!(await flushOutbox()))await pullOnline();setStatus('Online · đã cập nhật','ok')}catch(e){console.warn('V10 reconnect',e)}}});
  window.addEventListener('offline',()=>{state.online=false;setStatus('Offline · thao tác vẫn dùng được, sẽ tự lưu khi có mạng','warn')});
})();