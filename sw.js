// Cache-Version bei jedem Release hochzählen
const CACHE='einhorn-v12';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png','./game.js','./vendor/pixi.min.js','./assets/cloud.png','./assets/ear.png','./assets/hand.png','./assets/head.png','./assets/horn.png','./assets/mane1.png','./assets/mane2.png','./assets/mane3.png','./assets/puff.png','./assets/ring.png','./assets/ringfill.png','./assets/sign.png','./assets/spark.png','./assets/star.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // Seite: erst Netz (Updates sofort), offline aus dem Cache
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp));return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));return r;}).catch(()=>hit)));
});
