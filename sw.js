// Service Worker für MF-Log (beide Kanäle; dieselbe Datei liegt unter ./ und ./test/).
// VERSION muss APP_VERSION in index.html entsprechen (prüft app/build.js).
const VERSION='1.0.2';
const SCOPE_PATH=new URL(self.registration.scope).pathname;
// Kanal aus dem Geltungsbereich: …/mf-test/ (veröffentlicht) oder …/test/ (lokal) = Testkanal. Getrennte Cache-Namen, weil beide Kanäle denselben CacheStorage der Herkunft teilen.
const KANAL=/\/(mf-)?test\/$/.test(SCOPE_PATH)?'test':'app';
const PREFIX='mflog-'+KANAL+'-';
const CACHE=PREFIX+VERSION;
const ICONS=['./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-192.png','./icons/maskable-512.png'];
const PRECACHE=['./','./index.html','./manifest.webmanifest',...ICONS];

self.addEventListener('install',ev=>{
  // einzeln hinzufügen: ein fehlendes Icon soll die Installation nicht verhindern
  ev.waitUntil(caches.open(CACHE).then(c=>Promise.all(PRECACHE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))));
});

self.addEventListener('activate',ev=>{
  // nur eigene alte Caches löschen, nicht die des anderen Kanals
  ev.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// „Neue Version verfügbar · Laden“ in der App sendet skipWaiting
self.addEventListener('message',ev=>{if(ev.data&&ev.data.type==='skipWaiting')self.skipWaiting()});

self.addEventListener('fetch',ev=>{
  const req=ev.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // Fremd-Origins (Google Fonts) weder abfangen noch cachen
  if(url.origin!==self.location.origin)return;
  // Anfragen außerhalb des eigenen Bereichs oder im Bereich des Testkanals (eigener Service Worker) nicht anfassen
  if(!url.pathname.startsWith(SCOPE_PATH))return;
  const rel=url.pathname.slice(SCOPE_PATH.length);
  if(KANAL==='app'&&rel.startsWith('test/'))return;
  // Seite: Netz zuerst, bei Erfolg Cache aktualisieren, ohne Netz aus dem Cache
  if(req.mode==='navigate'||rel===''||rel==='index.html'){
    ev.respondWith(fetch(req).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy)).catch(()=>{})}
      return res;
    }).catch(()=>caches.open(CACHE).then(c=>c.match('./index.html').then(r=>r||c.match('./')))));
    return;
  }
  // Icons: Cache zuerst
  if(rel.startsWith('icons/')){
    ev.respondWith(caches.open(CACHE).then(c=>c.match(req).then(r=>r||fetch(req).then(res=>{if(res&&res.ok)c.put(req,res.clone());return res}))));
    return;
  }
  // übrige eigene Dateien (Manifest): Netz zuerst, sonst Cache
  ev.respondWith(fetch(req).catch(()=>caches.open(CACHE).then(c=>c.match(req))));
});
