// Guarda o app para funcionar sem internet.
// Abre na hora com a cópia salva e busca a versão nova em segundo plano (vale na próxima abertura).
const CACHE = 'forja-v9';
// Fotos dos exercícios: cache separado que sobrevive às atualizações do app.
const IMG_CACHE = 'forja-img-v1';
const ASSETS = ['./', 'index.html', 'styles.css', 'data.js', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.origin + url.pathname; // ignora ?parametros
  if (url.pathname.includes('/img/ex/')) { // fotos não mudam: usa a cópia salva, baixa só na primeira vez
    e.respondWith(caches.open(IMG_CACHE).then(c => c.match(key).then(hit => hit || fetch(key).then(res => {
      if (res.ok) c.put(key, res.clone());
      return res;
    }))));
    return;
  }
  const refresh = fetch(key, { cache: 'no-cache' })
    .then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    });
  e.respondWith(
    caches.match(key).then(cached => {
      if (cached) { refresh.catch(() => {}); return cached; }
      return refresh.catch(() => caches.match('index.html'));
    })
  );
  e.waitUntil(refresh.catch(() => {}));
});
