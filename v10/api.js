/* F&B Manager V10 — API transport
   Pure Apps Script transport. No UI, auth, db, or business logic.
*/
(function(){
  'use strict';

  const config=window.FNB_CONFIG||{};
  const API=config.API||'';

  function jsonError(text){
    const raw=String(text||'').trim();
    const looksLikeHtml=/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(raw);
    if(looksLikeHtml)return new Error('Apps Script trả về HTML thay vì JSON. Kiểm tra quyền truy cập Web App (Anyone) và deployment.');
    return new Error(raw.slice(0,500)||'Máy chủ trả về dữ liệu không hợp lệ');
  }

  async function request(payload){
    const r=await fetch(API,{method:'POST',redirect:'follow',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),cache:'no-store'});
    const text=await r.text();
    let data;
    try{data=JSON.parse(text)}catch(e){throw jsonError(text)}
    if(!r.ok||data.ok===false||data.success===false)throw new Error(data.message||data.error||('HTTP '+r.status));
    return data;
  }

  async function get(){
    const r=await fetch(API,{method:'GET',redirect:'follow',credentials:'omit',cache:'no-store'});
    const text=await r.text();
    let data;
    try{data=JSON.parse(text)}catch(e){throw jsonError(text)}
    if(!r.ok||data.ok===false||data.success===false)throw new Error(data.message||data.error||('HTTP '+r.status));
    return data;
  }

  window.FNB_API={request,get,jsonError};
})();
