'use strict';
const CACHE='ballpark-cribbage-static-v3';const ASSETS=['/','/styles.css','/app.js','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).pathname.startsWith('/api/'))return;
 event.respondWith(fetch(event.request).then(res=>{if(res.ok&&new URL(event.request.url).origin===self.location.origin){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res;}).catch(()=>caches.match(event.request)));
});
