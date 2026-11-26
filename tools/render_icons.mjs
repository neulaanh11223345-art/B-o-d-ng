// Vẽ biểu tượng app (đám mây + tai nghe trên nền xanh). Chạy: npm run icons
import { launch } from './browser.mjs';

const ROOT = new URL('../', import.meta.url);

function svg(size, pad = 0, round = 0.22) {
  const s = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>
<rect width="${size}" height="${size}" rx="${size * round}" fill="url(#g)"/>
<g transform="translate(${pad} ${pad}) scale(${s / 48})" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">
<path d="M14 31a6 6 0 0 1 1-11.9A9 9 0 0 1 32 17a7 7 0 0 1 2 13.7"/><path d="M17 33v-3a7 7 0 0 1 14 0v3"/>
<rect x="14" y="30" width="5" height="8" rx="2" fill="#fff" stroke="none"/><rect x="29" y="30" width="5" height="8" rx="2" fill="#fff" stroke="none"/></g></svg>`;
}

const targets = [
  ['icons/icon-192.png', 192, 0, 0.22],
  ['icons/icon-512.png', 512, 0, 0.22],
  ['icons/icon-maskable-512.png', 512, 70, 0],
  ['icons/apple-touch-icon.png', 180, 10, 0],
];
const browser = await launch();
const page = await browser.newPage();
for (const [file, size, pad, round] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg(size, pad, round)}`);
  await page.locator('svg').screenshot({ path: new URL(file, ROOT).pathname, omitBackground: true });
  console.log('đã vẽ', file);
}
await browser.close();
