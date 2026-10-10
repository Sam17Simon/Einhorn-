// Cache-Version bei jedem Release hochzählen
const CACHE='einhorn-v24';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./game.js','./vendor/pixi.min.js','./assets/body_side.png','./assets/cloud.png','./assets/earL2.png','./assets/earR2.png','./assets/glint.png','./assets/hand2.png','./assets/headR.png','./assets/horn2.png','./assets/leg.png','./assets/mane0.png','./assets/mane1.png','./assets/mane2.png','./assets/mane3.png','./assets/mane4.png','./assets/mane5.png','./assets/mane6.png','./assets/neck.png','./assets/puff.png','./assets/ring.png','./assets/ringfill.png','./assets/sign.png','./assets/spark.png','./assets/star.png','./assets/tail1.png','./assets/tail2.png','./assets/tail3.png','./assets/wing.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  // Fremde Hosts (Fonts) durchlassen
  if(url.origin!==location.origin) return;
  // Erst Netz, damit alle Dateien zusammenpassen; Cache nur, wenn offline
  e.respondWith(fetch(e.request).then(r=>{
    if(r&&r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); }
    return r;
  }).catch(()=>caches.match(e.request).then(hit=>hit||(e.request.mode==='navigate'?caches.match('./index.html'):undefined))));
});
