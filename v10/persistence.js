/* F&B Manager V10 — device persistence
   Durable browser-side snapshot/outbox for fast startup and crash-safe sync.
   Google Sheets remains the source of truth; this layer stores the latest
   known snapshot, server revision, and mutations awaiting acknowledgement.
*/
(function(){
  'use strict';
  const DB_NAME='fnb-manager-v10';
  const DB_VERSION=1;
  const SNAPSHOT='snapshot';
  const OUTBOX='outbox';
  const SESSION='session';
  let dbPromise=null;

  function openDb(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(new Error('Thiết bị không hỗ trợ bộ nhớ phiên'));
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const d=req.result;
        if(!d.objectStoreNames.contains(SNAPSHOT))d.createObjectStore(SNAPSHOT);
        if(!d.objectStoreNames.contains(OUTBOX))d.createObjectStore(OUTBOX,{keyPath:'id',autoIncrement:true});
        if(!d.objectStoreNames.contains(SESSION))d.createObjectStore(SESSION);
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Không mở được bộ nhớ thiết bị'));
    });
    return dbPromise;
  }
  function tx(store,mode,work){return openDb().then(d=>new Promise((resolve,reject)=>{const t=d.transaction(store,mode),s=t.objectStore(store);let result;try{result=work(s)}catch(e){reject(e);return}t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error||new Error('Lỗi bộ nhớ thiết bị'));}));}
  function put(store,key,value){return tx(store,'readwrite',s=>s.put(value,key));}
  function get(store,key){return tx(store,'readonly',s=>new Promise((resolve,reject)=>{const r=s.get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)}));}
  function addOutbox(item){return tx(OUTBOX,'readwrite',s=>s.add({...item,createdAt:item.createdAt||Date.now()}));}
  function listOutbox(){return tx(OUTBOX,'readonly',s=>new Promise((resolve,reject)=>{const r=s.getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)}));}
  function removeOutbox(id){return tx(OUTBOX,'readwrite',s=>s.delete(id));}
  function clear(){return openDb().then(d=>new Promise((resolve,reject)=>{const t=d.transaction([SNAPSHOT,OUTBOX,SESSION],'readwrite');t.objectStore(SNAPSHOT).clear();t.objectStore(OUTBOX).clear();t.objectStore(SESSION).clear();t.oncomplete=resolve;t.onerror=()=>reject(t.error)}));}

  window.FNB_PERSISTENCE={
    saveSnapshot:function(db,lastSync,serverDb){
      return put(SNAPSHOT,'current',{
        db:JSON.parse(JSON.stringify(db)),
        lastSync:lastSync||null,
        serverDb:serverDb?JSON.parse(JSON.stringify(serverDb)):null,
        savedAt:Date.now()
      });
    },
    loadSnapshot:function(){return get(SNAPSHOT,'current')},
    saveSession:function(session){return put(SESSION,'current',JSON.parse(JSON.stringify(session)))},
    loadSession:function(){return get(SESSION,'current')},
    clearSession:function(){return tx(SESSION,'readwrite',s=>s.delete('current'))},
    addOutbox,
    listOutbox,
    removeOutbox,
    clear
  };
})();
