/* F&B Manager V10 — synchronization layer
   Temporary DIRECT MODE: local-first UI + automatic background writes.
   Google Sheets is the shared source; refresh pulls the latest snapshot.
   Server revisions prevent stale snapshots from overwriting newer changes.
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
  let serverBaseDb=null;

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
  function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
  function equal(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function isObject(x){return x&&typeof x==='object'&&!Array.isArray(x);}
  function itemKey(item){if(!isObject(item))return null;for(const k of ['id','uuid','code','sku','username','name']){if(item[k]!=null&&String(item[k])!=='')return k+':'+String(item[k]);}return null;}
  function merge3(baseValue,localValue,remoteValue){
    if(equal(localValue,baseValue))return clone(remoteValue);
    if(equal(remoteValue,baseValue))return clone(localValue);
    if(Array.isArray(baseValue)&&Array.isArray(localValue)&&Array.isArray(remoteValue)){
      const keyed=[...baseValue,...localValue,...remoteValue].every(v=>itemKey(v));
      if(keyed){
        const maps=[baseValue,localValue,remoteValue].map(arr=>new Map(arr.map(v=>[itemKey(v),v])));
        const keys=[...new Set([...maps[0].keys(),...maps[1].keys(),...maps[2].keys()])];
        return keys.map(k=>{
          const b=maps[0].get(k),l=maps[1].get(k),r=maps[2].get(k);
          const merged=merge3(b,l,r);
          return merged===undefined?undefined:merged;
        }).filter(v=>v!==undefined);
      }
      return clone(localValue);
    }
    if(isObject(baseValue)||isObject(localValue)||isObject(remoteValue)){
      const b=isObject(baseValue)?baseValue:{};
      const l=isObject(localValue)?localValue:{};
      const r=isObject(remoteValue)?remoteValue:{};
      const keys=[...new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])];
      const out={};
      for(const k of keys){
        const hasB=Object.prototype.hasOwnProperty.call(b,k),hasL=Object.prototype.hasOwnProperty.call(l,k),hasR=Object.prototype.hasOwnProperty.call(r,k);
        const merged=merge3(hasB?b[k]:undefined,hasL?l[k]:undefined,hasR?r[k]:undefined);
        if(merged!==undefined)out[k]=merged;
      }
      return out;
    }
    return clone(localValue);
  }
  function stripSession(value){
    const out=clone(value)||{};
    delete out.sessionEmployeeId;
    return out;
  }
  function bindEmployeeSession(){
    const currentDb=db()||{};
    const employee=(Array.isArray(currentDb.employees)?currentDb.employees:[]).find(e=>String(e.username||'').trim().toLowerCase()==='admin'&&e.active!==false);
    state.employee=employee||null;
    currentDb.sessionEmployeeId=employee?.id||null;
    setDb(currentDb);
    return employee||null;
  }
  async function fetchDirectChunks(meta){
    if(meta?.db)return {db:meta.db,serverUpdatedAt:meta.serverUpdatedAt||meta.updatedAt||null};
    const total=Number(meta?.totalChunks)||0;
    if(!total)return {db:null,serverUpdatedAt:meta?.serverUpdatedAt||meta?.updatedAt||null};
    const serverUpdatedAt=meta.serverUpdatedAt||meta.updatedAt||null;
    const parts=await Promise.all(Array.from({length:total},(_,i)=>
      requireApi().request({action:'directPullChunk',branchId:state.branchId,chunk:i})
        .then(part=>{if(Number(part.chunk)!==i)throw new Error('DATA chunk không đúng thứ tự');return String(part.payload||'');})
    ));
    try{return {db:JSON.parse(parts.join('')),serverUpdatedAt};}
    catch(e){throw new Error('DATA tải về không hợp lệ: '+(e.message||e));}
  }
  async function fetchRemote(){
    if(!navigator.onLine)throw new Error('Không có mạng');
    const meta=await requireApi().request({action:'directPull',branchId:state.branchId});
    const received=await fetchDirectChunks(meta);
    return {db:received.db?normalizeDb(received.db):null,serverUpdatedAt:received.serverUpdatedAt||null,meta};
  }
  async function persistSnapshot(){if(!persistence)return;try{await persistence.saveSnapshot(db(),state.lastSync,serverBaseDb)}catch(e){console.warn('V10 local snapshot',e)}}
  async function pullOnline(){
    const remote=await fetchRemote();
    if(remote.db){
      serverBaseDb=clone(remote.db);
      setDb(normalizeDb(remote.db));
      bindEmployeeSession();
      state.lastSync=remote.serverUpdatedAt||state.lastSync||null;
      await persistSnapshot();
      refresh();
    }
    return remote.meta;
  }
  async function pushSnapshot(snapshot,baseUpdatedAt){
    if(!navigator.onLine)throw new Error('Không có mạng');
    const payloadDb=stripSession(normalizeDb(clone(snapshot||db())));
    const data=await requireApi().request({action:'directSync',branchId:state.branchId,baseUpdatedAt:String(baseUpdatedAt||''),db:payloadDb});
    if(data?.conflict)return data;
    setDb(payloadDb);
    bindEmployeeSession();
    serverBaseDb=clone(payloadDb);
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
    if(!items.length){state.pending=false;return false;}
    const latest=items[items.length-1];
    try{
      setStatus('Đang lưu dữ liệu...','info');
      let result=await pushSnapshot(latest.db,latest.baseUpdatedAt);
      if(result?.conflict){
        setStatus('Đang ghép thay đổi từ thiết bị khác...','info');
        const remote=await fetchRemote();
        if(!remote.db)throw new Error('Không đọc được DATA hiện tại');
        const baseDb=latest.baseDb||serverBaseDb||emptyDb();
        const merged=normalizeDb(merge3(baseDb,latest.db,remote.db));
        result=await pushSnapshot(merged,remote.serverUpdatedAt);
        if(result?.conflict)throw new Error('DATA vừa thay đổi, sẽ tự thử lại');
      }
      await removeOutboxItems(items);
      state.pending=false;
      setStatus('Đã lưu · Google Sheets','ok');
      refresh();
      return true;
    }catch(e){
      state.pending=true;
      setStatus('Chưa lưu máy chủ · sẽ tự thử lại','warn');
      console.warn('V10 revision-safe auto-save retry',e);
      return false;
    }
  }
  async function queueSave(){
    const snapshot=normalizeDb(clone(db()));
    state.pending=true;
    try{
      if(persistence){
        await persistence.saveSnapshot(snapshot,state.lastSync,serverBaseDb||snapshot);
        await persistence.addOutbox({db:stripSession(snapshot),baseDb:clone(serverBaseDb||snapshot),baseUpdatedAt:state.lastSync||''});
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
    try{if(await flushOutbox())return;await pullOnline();setStatus('Đã cập nhật từ Google Sheets','ok');refresh();}
    catch(e){setStatus('Không thể cập nhật từ Google Sheets','warn');console.warn('V10 refresh pull',e)}
    finally{state.busy=false}
  };
  async function restoreLocal(){
    if(!persistence)return false;
    try{
      const cached=await persistence.loadSnapshot();
      if(cached?.db){
        setDb(normalizeDb(cached.db));
        state.lastSync=cached.lastSync||null;
        serverBaseDb=cached.serverDb?normalizeDb(cached.serverDb):null;
        bindEmployeeSession();
        const pending=await persistence.listOutbox();
        state.pending=pending.length>0;
        return true;
      }
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
  window.addEventListener('online',async()=>{
    state.online=true;
    if(!state.busy){try{await flushOutbox();setStatus('Online · tự động lưu đã sẵn sàng','ok')}catch(e){console.warn('V10 reconnect',e)}}
  });
  window.addEventListener('offline',()=>{state.online=false;setStatus('Offline · thao tác vẫn dùng được, sẽ tự lưu khi có mạng','warn')});
})();
