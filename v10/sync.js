/* F&B Manager V10 — synchronization layer
   Phase 4: online data transport, save queue, manual sync, polling, and
   connectivity lifecycle live here. UI/business logic remains elsewhere.
*/
(function(){
  'use strict';
  const runtime=window.FNB_RUNTIME||{};
  const api=window.FNB_API||null;
  const state=runtime.state||{};
  const base=window.FNB_BASE_INTERNAL||{};
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
  async function pullOnline(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(!navigator.onLine)throw new Error('Không có mạng');
    if(state.pending)return null;
    const data=await requireApi().request({action:'pull',username:state.user.username,token:state.user.token,branchId:state.branchId});
    if(data.db){setDb(normalizeDb(data.db));bindEmployeeSession();state.lastSync=data.serverUpdatedAt||new Date().toISOString();refresh();}
    return data;
  }
  async function pushSnapshot(){
    if(!state.user)throw new Error('Chưa đăng nhập');
    if(!navigator.onLine)throw new Error('Không có mạng');
    const payloadDb=normalizeDb(JSON.parse(JSON.stringify(db())));
    delete payloadDb.sessionEmployeeId;
    const data=await requireApi().request({action:'sync',username:state.user.username,token:state.user.token,branchId:state.branchId,clientUpdatedAt:state.lastSync,db:payloadDb});
    if(data.db){setDb(normalizeDb(data.db));state.lastSync=data.serverUpdatedAt||new Date().toISOString();}
    refresh();
    return data;
  }
  function queueSave(){
    if(!state.user||!navigator.onLine)return;
    state.pending=true;
    setStatus('Đang ghi lên Google Sheets...','info');
    saveChain=saveChain.then(async()=>{try{await pushSnapshot();state.pending=false;setStatus('Online · đã lưu máy chủ','ok')}catch(e){state.pending=false;setStatus('Lỗi kết nối máy chủ','danger');toast('❌ Chưa ghi được Google Sheets: '+(e.message||'Không xác định'));console.error('V10 save',e)}});
  }
  window.save=function(){queueSave();return true;};
  window.v10SyncNow=async function(){
    if(!state.user){window.FNB_AUTH?.openLogin?.();return}
    if(state.busy||state.pending)return;
    state.busy=true;
    try{setStatus('Đang lấy DATA mới...','info');await pullOnline();setStatus('Online · DATA mới nhất','ok');toast('☁️ Đã lấy DATA mới nhất từ Google Sheets')}
    catch(e){setStatus('Lỗi kết nối máy chủ','danger');toast('❌ Không lấy được DATA: '+(e.message||'Không xác định'))}
    finally{state.busy=false}
  };
  function startPolling(){
    clearInterval(pollTimer);
    pollTimer=setInterval(async()=>{if(!state.user||state.busy||state.pending||!navigator.onLine||document.visibilityState==='hidden'||typeof base.isModalOpen==='function'&&base.isModalOpen())return;try{await pullOnline();setStatus('Online · đã cập nhật','ok')}catch(e){console.warn('V10 pull',e)}},2500);
  }
  function stopPolling(){clearInterval(pollTimer);pollTimer=null;}
  window.FNB_SYNC_INTERNAL={api,requireApi,emptyDb,normalizeDb,pullOnline,pushSnapshot,startPolling,stopPolling,queueSave,refresh,setStatus,showApp,hideApp,getDb:db,setDb,getSafe:safe};
  window.addEventListener('online',async()=>{state.online=true;if(state.user&&!state.busy&&!state.pending){try{await pullOnline();setStatus('Online · đã cập nhật','ok')}catch(e){console.warn('V10 reconnect',e)}}startPolling();});
  window.addEventListener('offline',()=>{state.online=false;setStatus('Offline · không lưu dữ liệu','danger');toast('🔴 Mất mạng — V10 không lưu cục bộ')});
})();