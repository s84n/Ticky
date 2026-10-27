// Service Worker: Offline-Betrieb. Bei jedem Release CACHE_VERSION (und VERSION in js/config.js) erhöhen.
// Die Dateiliste kann mit `node tools/update-sw-assets.mjs` aktualisiert werden.
const CACHE_VERSION = 'ticky-v1.8.0';
const NETWORK_TIMEOUT_MS = 3000; // danach App-Shell aus dem Cache (schlechtes WLAN)

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/album.css',
  './css/base.css',
  './css/themes.css',
  './js/album.js',
  './js/audio.js',
  './js/celebrate.js',
  './js/child-editor.js',
  './js/config.js',
  './js/data/figures.js',
  './js/data/parent-quiz.js',
  './js/data/progression.js',
  './js/data/task-catalog.js',
  './js/data/themes.js',
  './js/demo.js',
  './js/figure-view.js',
  './js/fx.js',
  './js/herd.js',
  './js/main.js',
  './js/onboarding.js',
  './js/perf.js',
  './js/pwa.js',
  './js/render.js',
  './js/rewards/draw.js',
  './js/rewards/parade.js',
  './js/rewards/picker.js',
  './js/rewards/wheel.js',
  './js/routine.js',
  './js/settings.js',
  './js/speech.js',
  './js/store.js',
  './js/ui.js',
  './js/util.js',
  './assets/figures/dino/dino_01.svg',
  './assets/figures/dino/dino_02.svg',
  './assets/figures/dino/dino_03.svg',
  './assets/figures/dino/dino_04.svg',
  './assets/figures/dino/dino_05.svg',
  './assets/figures/dino/dino_06.svg',
  './assets/figures/dino/dino_07.svg',
  './assets/figures/dino/dino_08.svg',
  './assets/figures/dino/dino_09.svg',
  './assets/figures/dino/dino_10.svg',
  './assets/figures/dino/dino_11.svg',
  './assets/figures/dino/dino_12.svg',
  './assets/figures/neon/neon_01.svg',
  './assets/figures/neon/neon_02.svg',
  './assets/figures/neon/neon_03.svg',
  './assets/figures/neon/neon_04.svg',
  './assets/figures/neon/neon_05.svg',
  './assets/figures/neon/neon_06.svg',
  './assets/figures/neon/neon_07.svg',
  './assets/figures/neon/neon_08.svg',
  './assets/figures/neon/neon_09.svg',
  './assets/figures/neon/neon_10.svg',
  './assets/figures/neon/neon_11.svg',
  './assets/figures/neon/neon_12.svg',
  './assets/figures/pixel/pixel_01.svg',
  './assets/figures/pixel/pixel_02.svg',
  './assets/figures/pixel/pixel_03.svg',
  './assets/figures/pixel/pixel_04.svg',
  './assets/figures/pixel/pixel_05.svg',
  './assets/figures/pixel/pixel_06.svg',
  './assets/figures/pixel/pixel_07.svg',
  './assets/figures/pixel/pixel_08.svg',
  './assets/figures/pixel/pixel_09.svg',
  './assets/figures/pixel/pixel_10.svg',
  './assets/figures/pixel/pixel_11.svg',
  './assets/figures/pixel/pixel_12.svg',
  './assets/figures/schatz/schatz_01.svg',
  './assets/figures/schatz/schatz_02.svg',
  './assets/figures/schatz/schatz_03.svg',
  './assets/figures/schatz/schatz_04.svg',
  './assets/figures/schatz/schatz_05.svg',
  './assets/figures/schatz/schatz_06.svg',
  './assets/figures/schatz/schatz_07.svg',
  './assets/figures/schatz/schatz_08.svg',
  './assets/figures/schatz/schatz_09.svg',
  './assets/figures/schatz/schatz_10.svg',
  './assets/figures/schatz/schatz_11.svg',
  './assets/figures/schatz/schatz_12.svg',
  './assets/figures/weltraum/weltraum_01.svg',
  './assets/figures/weltraum/weltraum_02.svg',
  './assets/figures/weltraum/weltraum_03.svg',
  './assets/figures/weltraum/weltraum_04.svg',
  './assets/figures/weltraum/weltraum_05.svg',
  './assets/figures/weltraum/weltraum_06.svg',
  './assets/figures/weltraum/weltraum_07.svg',
  './assets/figures/weltraum/weltraum_08.svg',
  './assets/figures/weltraum/weltraum_09.svg',
  './assets/figures/weltraum/weltraum_10.svg',
  './assets/figures/weltraum/weltraum_11.svg',
  './assets/figures/weltraum/weltraum_12.svg',
  './assets/figures/zauber/zauber_01.svg',
  './assets/figures/zauber/zauber_02.svg',
  './assets/figures/zauber/zauber_03.svg',
  './assets/figures/zauber/zauber_04.svg',
  './assets/figures/zauber/zauber_05.svg',
  './assets/figures/zauber/zauber_06.svg',
  './assets/figures/zauber/zauber_07.svg',
  './assets/figures/zauber/zauber_08.svg',
  './assets/figures/zauber/zauber_09.svg',
  './assets/figures/zauber/zauber_10.svg',
  './assets/figures/zauber/zauber_11.svg',
  './assets/figures/zauber/zauber_12.svg',
  './assets/fonts/inter-latin-var.woff2',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/icon-maskable.svg',
  './assets/icons/icon.svg',
];

self.addEventListener('install', event => {
  // cache: 'reload' umgeht den HTTP-Cache, sonst landen evtl. noch alte Dateien im neuen Cache
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('ticky-') && k !== CACHE_VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App-Shell und Manifest: Network-First mit Cache-Fallback, damit Updates (z. B. App-Name) ankommen
  const isManifest = url.pathname.endsWith('/manifest.webmanifest');
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || isManifest) {
    event.respondWith((async () => {
      try {
        const res = await Promise.race([
          fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
        ]);
        const cache = await caches.open(CACHE_VERSION);
        if (res.ok) event.waitUntil(cache.put(isManifest ? './manifest.webmanifest' : './index.html', res.clone()));
        return res;
      } catch {
        if (isManifest) return (await caches.match('./manifest.webmanifest')) ?? Response.error();
        return (await caches.match('./index.html')) ?? (await caches.match('./')) ?? Response.error();
      }
    })());
    return;
  }

  // Assets: Cache-First
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
