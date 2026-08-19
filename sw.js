/* F&B Manager Service Worker — V10 CLEAN
   Responsibilities ONLY:
   - PWA/offline asset caching
   - Network-first navigation
   - Cache fallback when offline
   NEVER rewrites HTML and NEVER injects application scripts.
*/
const CACHE_NAME='fnb-manager-v10-clean-v1';
const APP_SHELL=[
  './index.html','./manifest.webmanifest',
  './remy-bakery-icon-192.png','./remy-bakery-icon-512.png','./remy-bakery-apple-touch-icon.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(APP_SHELL).catch(()=>{}))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function navigationResponse(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok)return response;
  }catch(e){}
  const cached=await caches.match('./index.html');
  return cached||new Response('Không thể tải F&B Manager',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
}

async function assetResponse(request){
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok){
      const copy=response.clone();
      caches.open(CACHE_NAME).then(c=>c.put(request,copy)).catch(()=>{});
    }
    return response;
  }catch(e){
    return caches.match(request).then(c=>c||new Response('',{status:504}));
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  if(req.mode==='navigate'){
    event.respondWith(navigationResponse(req));
    return;
  }
  event.respondWith(assetResponse(req));
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING')self.skipWaiting();
});
