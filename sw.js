// Service worker: lưu sẵn app và bài học để mở được khi không có mạng.
// Mã và dữ liệu: ưu tiên mạng (luôn lấy bản mới), mất mạng thì dùng bản đã lưu. Phông chữ: dùng bản đã lưu.
const VERSION = 'sky-english-v1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-192.png',
  'data/units/index.json',
  'js/data.js',
  'js/dom.js',
  'js/exercises.js',
  'js/grade.js',
  'js/images.js',
  'js/main.js',
  'js/player.js',
  'js/speech.js',
  'js/store.js',
  'js/views/home.js',
  'js/views/print.js',
  'js/views/settings.js',
  'js/views/unit.js',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(VERSION);
  const network = fetch(request, { cache: 'no-cache' }).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  network.catch(() => {});
  const cached = async () => (await cache.match(request, { ignoreSearch: true })) || (fallbackUrl ? cache.match(fallbackUrl) : undefined);
  try {
    const fast = await Promise.race([network, new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT, null))]);
    return fast || (await cached()) || (await network);
  } catch (e) {
    const hit = await cached();
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request, request.mode === 'navigate' ? 'index.html' : undefined));
});
