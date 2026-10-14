// Ghép mã nguồn trong src/ thành các file chạy được:
//   app-v{ver}.html   — app thật (gọi máy chủ Apps Script)
//   demo-v{ver}.html  — bản xem thử (máy chủ giả chạy ngay trong trình duyệt)
//   Code.gs-v{ver}.txt — dán vào Apps Script
//   docs/             — bộ PWA để đăng lên GitHub Pages (index.html, demo.html, sw.js, manifest, icon)
// Chạy: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const wr = (p, s) => { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), s); };

const cfg = JSON.parse(rd('src/config.json'));
const ver = cfg.version;
const code = rd('src/Code.gs');
const m = /var PHIEN_BAN = '([^']+)'/.exec(code);
if (!m || m[1] !== ver) throw new Error(`PHIEN_BAN trong Code.gs (${m && m[1]}) khác version trong config.json (${ver})`);

const app = rd('src/app.html');
if (!app.includes('/*@@CONFIG@@*/')) throw new Error('src/app.html thiếu /*@@CONFIG@@*/');
const shim = rd('src/demo/gas-shim.js');
const extra = rd('src/demo/demo-extra.js');

const head = (mode, url) => `const API_URL = ${JSON.stringify(url)};\nconst MODE = ${JSON.stringify(mode)};\nconst APP_VER = ${JSON.stringify(ver)};\n`;
const live = app.replace('/*@@CONFIG@@*/', head('live', cfg.apiUrl) + 'const DemoBackend = null;');
const demoBackend = 'const DemoBackend = (function () {\n' + shim + '\n' + code + '\n' + extra + '\n})();';
// Dùng hàm thay thế để chuỗi "$&", "$1"… trong code không bị hiểu nhầm
const demo = app.replace('/*@@CONFIG@@*/', () => head('demo', '') + demoBackend);

wr(`app-v${ver}.html`, live);
wr(`demo-v${ver}.html`, demo);
wr(`Code.gs-v${ver}.txt`, code);

// ----- Bộ PWA -----
wr('docs/index.html', live);
wr('docs/demo.html', demo);
wr('docs/manifest.webmanifest', JSON.stringify({
  name: 'Credible CMMS · 设备管理',
  short_name: 'Bảo dưỡng',
  description: 'Bảo dưỡng thiết bị, ghi số điện nước, kho linh kiện · 设备保养、抄表、备件库',
  lang: 'vi',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F3F6FB',
  theme_color: '#1E5EEA',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2) + '\n');
wr('docs/sw.js', rd('src/sw.js').replace('@@VER@@', ver));
if (existsSync(join(ROOT, 'src/icons'))) {
  mkdirSync(join(ROOT, 'docs/icons'), { recursive: true });
  readdirSync(join(ROOT, 'src/icons')).forEach((f) => copyFileSync(join(ROOT, 'src/icons', f), join(ROOT, 'docs/icons', f)));
}
wr('docs/.nojekyll', '');
console.log(`Đã tạo v${ver}: app ${(live.length / 1024).toFixed(0)} KB · demo ${(demo.length / 1024).toFixed(0)} KB · Code.gs ${(code.length / 1024).toFixed(0)} KB`);
