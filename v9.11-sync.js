/* V9.11 — QUEUE SYNC CLIENT
   Safe queue push only. Server endpoint required: action=pushQueue. */
(function(){
  'use strict';
  if(window.__v911QueueSync) return;
  const QUEUE_KEY='fnb_v910_queue', META_KEY='fnb_v910_meta';
  const read=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function state(){try{return window.v9state?.()||{}}catch(e){return {}}}
  async function post(action,extra){
    const s=state(), url=s.url||s.apiUrl||localStorage.getItem('fnb_v9_url')||'';
    if(!url) throw new Error('Chưa cấu hình Apps Script Web App URL');
    const body=Object.assign({action,username:s.user?.username||'local-user',token:s.user?.token||''},extra||{});
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
    const text=await r.text(); let data;
    try{data=JSON.parse(text)}catch(e){throw new Error('Apps Script trả về dữ liệu không hợp lệ')}
    if(!r.ok||data.ok===false) throw new Error(data.message||('HTTP '+r.status));
    return data;
  }
  window.v911SyncQueue=async function(){
    const q=read(QUEUE_KEY,[]);
    if(!q.length)return {ok:true,processedOpIds:[],remaining:0,conflicts:0};
    if(navigator.onLine===false)throw new Error('Đang offline');
    const result=await post('pushQueue',{branchId:state().branchId||'MAIN',ops:q});
    const done=new Set((result.processedOpIds||[]).map(String));
    const remaining=q.filter(x=>!done.has(String(x.opId)));
    write(QUEUE_KEY,remaining);
    const meta=read(META_KEY,{});
    if(result.serverUpdatedAt)meta.serverUpdatedAt=result.serverUpdatedAt;
    if(result.serverVersion!=null)meta.serverVersion=result.serverVersion;
    write(META_KEY,meta);
    window.dispatchEvent(new Event('v911queuechange'));
    return Object.assign({},result,{remaining:remaining.length});
  };
  window.__v911QueueSync=true;
})();
