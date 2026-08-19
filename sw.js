/* F&B Manager Service Worker — V9.11 SAFE CACHE
   - Never caches HTML/navigation responses.
   - Never rewrites a JS response into the page.
   - Loads V9 scripts explicitly into navigations.
   - Network-first for assets, cache fallback only when offline.
*/
const CACHE_NAME='fnb-manager-v9.11-safe-v2';
const APP_SHELL=[
  './index.html','./manifest.webmanifest','./v9.10.js','./v9.10-ui-fix.js','./v9.11-sync.js',
  './remy-bakery-icon-192.png','./remy-bakery-icon-512.png','./remy-bakery-apple-touch-icon.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL).catch(()=>{})).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function navigationResponse(request){
  const response=await fetch(request,{cache:'no-store'});
  if(!response.ok)return response;
  const type=response.headers.get('content-type')||'';
  if(!/text\/html/i.test(type))return response;
  let html=await response.text();
  const scripts=['./v9.10.js?v=9105','./v9.10-ui-fix.js?v=9104','./v9.11-sync.js?v=9113'];
  const injection=scripts.map(src=>`<script src="${src}"></script>`).join('');
  if(!html.includes('v9.11-sync.js?v=9113'))html=html.includes('</body>')?html.replace('</body>',injection+'</body>'):html+injection;
  return new Response(html,{status:response.status,statusText:response.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
async function assetResponse(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(request,copy)).catch(()=>{});}
    return response;
  }catch(e){return caches.match(request).then(c=>c||new Response('',{status:504}));}
}
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith(navigationResponse(req).catch(()=>new Response('Không thể tải F&B Manager',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
    return;
  }
  event.respondWith(assetResponse(req));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
