const CACHE_NAME='fnb-manager-v9.10-foundation-v6';
const APP_SHELL=[
  './','./index.html','./manifest.webmanifest','./v9.10.js','./v9.10-ui-fix.js',
  './remy-bakery-icon-192.png','./remy-bakery-icon-512.png','./remy-bakery-apple-touch-icon.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL).catch(()=>{})).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function appHtmlResponse(request){
  const response=await fetch(request,{cache:'no-store'});
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!/text\/html/i.test(type))return response;
  let html=await response.text();
  return new Response(html,{status:response.status,statusText:response.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(appHtmlResponse(req).then(async response=>{
      if(response.ok){const copy=response.clone();const cache=await caches.open(CACHE_NAME);await cache.put('./index.html',copy);}return response;
    }).catch(()=>caches.match('./index.html').then(c=>c||new Response('Offline',{status:503}))));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>{if(cached)return cached;return fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy));}return response;});}));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
