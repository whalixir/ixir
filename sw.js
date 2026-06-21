const V='wx-v4';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  // برای index.html همیشه از شبکه بگیر (no-cache)
  e.respondWith(
    fetch(e.request, {cache:'no-store'}).catch(()=>caches.match(e.request))
  );
});
