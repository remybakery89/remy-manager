/* F&B Manager V10 — synchronization layer
   Phase 4/9: online transport, durable local snapshot, durable outbox,
   background synchronization, and connectivity lifecycle.
*/
(function(){
  'use strict';
  const runtime=window.FNB_RUNTIME||{};
  const api=window.FNB_API||null;
  const state=runtime.state||{};
  const base=window.FNB_BASE_INTERNAL||{};
  const persistence=window.FNB_PERSISTENCE||null;
  let pollTimer=null;
  let saveChain=Promise.resolve();
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
    const username=String(state.user?.username||'').trim().toLowerCase();
    const currentDb=db()||{};
    const employee=(Array.isArray(currentDb.employees)?currentDb.employees:[]).find(e=>String(e.username||'').trim().toLowerCase()===username&&e.active!==false);
    state.employee=employee||null;
    currentDb.sessionEmployeeId=employee?.id||null;
    setDb(currentDb);
  }
  async function persistSnapshot(){if(!persistence)return;try{await persistence.saveSnapshot(db(),state.lastSync)}catch(e){console.warn('V10 local snapshot',e)}}
  async function pushSnapshot(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(!navigator.onLine)throw new Error('Không có mạng');
    const payloadDb=normalizeDb(JSON.parse(JSON.stringify(db())));
    delete payloadDb.sessionEmployeeId;
    const data=await requireApi().request({action:'sync',username:state.user.username,token:state.user.token,branchId:state.branchId,clientUpdatedAt:state.lastSync,db:payloadDb});
    if(data.db){setDb(normalizeDb(data.db));state.lastSync=data.serverUpdatedAt||state.lastSync||new Date().toISOString();}
    await persistSnapshot();
    return data;
  }
  async function flushOutbox(){
    if(!persistence||!state.user||!navigator.onLine)return false;
    const items=await persistence.listOutbox();
    if(!items.length)return false;
    const latest=items[items.length-1];
    try{
      setStatus('Đang đồng bộ dữ liệu chờ...','info');
      setDb(normalizeDb(latest.db));
      state.lastSync=latest.lastSync||state.lastSync||null;
      await pushSnapshot();
      for(const item of items)await persistence.removeOutbox(item.id);
      state.pending=false;
      setStatus('Online · đã đồng bộ','ok');
      return true;
    }catch(e){state.pending=true;setStatus('Chờ đồng bộ · sẽ tự thử lại','warn');console.warn('V10 outbox',e);return false}
  }
  async function pullOnline(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(!navigator.onLine)throw new Error('Không có mạng');
    if(state.pending)return null;
    const data=await requireApi().request({action:'pull',username:state.user.username,token:state.user.token,branchId:state.branchId});
    if(data.db){
      const previousVersion=state.lastSync||'';
      const previousDb=JSON.stringify(db());
      setDb(normalizeDb(data.db));
      bindEmployeeSession();
      const nextVersion=data.serverUpdatedAt||'';
      state.lastSync=nextVersion||state.lastSync||new Date().toISOString();
      await persistSnapshot();
      const changed=nextVersion?nextVersion!==previousVersion:JSON.stringify(db())!==previousDb;
      if(changed)refresh();
    }
    return data;
  }
  async function queueSave(){
    if(!state.user)return;
    state.pending=true;
    const snapshot=normalizeDb(JSON.parse(JSON.stringify(db())));
    try{if(persistence){await persistence.saveSnapshot(snapshot,state.lastSync);await persistence.addOutbox({db:snapshot,lastSync:state.lastSync})}}catch(e){console.error('V10 local persistence',e);setStatus('Không lưu được trên thiết bị','danger');toast('❌ Không thể lưu dữ liệu trên thiết bị');return}
    if(!navigator.onLine){setStatus('Offline · chờ đồng bộ','warn');return}
    setStatus('Đang đồng bộ...','info');
    saveChain=saveChain.then(async()=>{await flushOutbox()});
    return saveChain;
  }
  window.save=function(){queueSave();return true;};
  window.v10SyncNow=async function(){
    if(!state.user){window.FNB_AUTH?.openLogin?.();return}
    if(state.busy)return;
    state.busy=true;
    try{setStatus('Đang đồng bộ...','info');await flushOutbox();if(!state.pending)await pullOnline();setStatus('Online · dữ liệu mới nhất','ok');toast('☁️ Đồng bộ hoàn tất')}
    catch(e){setStatus('Chờ đồng bộ · sẽ tự thử lại','warn');toast('⚠️ Chưa đồng bộ được: '+(e.message||'Không xác định'))}
    finally{state.busy=false}
  };
  async function restoreLocal(){
    if(!persistence)return false;
    try{
      const cached=await persistence.loadSnapshot();
      if(cached?.db){setDb(normalizeDb(cached.db));state.lastSync=cached.lastSync||null;return true}
    }catch(e){console.warn('V10 restore cache',e)}
    return false;
  }
  async function start(){
    const restored=await restoreLocal();
    if(restored&&state.user)refresh();
    if(state.user){state.pending=!!(await persistence?.listOutbox?.()).length; if(navigator.onLine){await flushOutbox();if(!state.pending)try{await pullOnline()}catch(e){console.warn('V10 initial pull',e)}}}
    startPolling();
    return restored;
  }
  function startPolling(){
    clearInterval(pollTimer);
    pollTimer=setInterval(async()=>{if(!state.user||state.busy||!navigator.onLine||document.visibilityState==='hidden'||typeof base.isModalOpen==='function'&&base.isModalOpen())return;try{if(await flushOutbox())return;await pullOnline();setStatus('Online · đã cập nhật','ok')}catch(e){console.warn('V10 pull',e)}},5000);
  }
  function stopPolling(){clearInterval(pollTimer);pollTimer=null;}
  window.FNB_SYNC_INTERNAL={api,requireApi,emptyDb,normalizeDb,pullOnline,pushSnapshot,startPolling,stopPolling,queueSave,refresh,setStatus,showApp,hideApp,getDb:db,setDb,getSafe:safe,restoreLocal,start,flushOutbox,persistSnapshot};
  window.addEventListener('online',async()=>{state.online=true;if(state.user&&!state.busy){try{await flushOutbox();if(!state.pending)await pullOnline();setStatus('Online · đã cập nhật','ok')}catch(e){console.warn('V10 reconnect',e)}}startPolling();});
  window.addEventListener('offline',()=>{state.online=false;if(state.user)setStatus('Offline · đã lưu trên thiết bị, chờ đồng bộ','warn')});
})();