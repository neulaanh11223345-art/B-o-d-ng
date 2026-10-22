// Service worker: cho app mở được khi mất mạng (iPhone thêm vào màn hình chính).
// Trang app: lấy bản mới khi có mạng (chờ tối đa 4 giây), mất mạng thì dùng bản đã lưu.
// Thư viện / font từ CDN: dùng bản đã lưu, cập nhật ngầm. Không bao giờ lưu lời gọi máy chủ Apps Script.
const VER = 'cmms-2.15.1-efc26b8a';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VER).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(VER);
      try {
        // no-cache: luôn hỏi lại máy chủ (GitHub Pages cho trình duyệt giữ trang 10 phút), mất mạng mới dùng bản đã lưu
        const res = await Promise.race([fetch(req, { cache: 'no-cache' }), timeout(4000)]);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      } catch (x) {
        return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  if (url.origin === location.origin || CDN.test(req.url)) {
    e.respondWith((async () => {
      const c = await caches.open(VER);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
