/* Gộp HTML + CSS + thư viện + mã nguồn thành 1 file .html chạy offline.
   Dùng: node doichieu/build.mjs            */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(here, p), 'utf8');

// Không để chuỗi kết thúc thẻ script trong nội dung nhúng làm đứt file HTML.
// SheetJS có hàng chục nghìn ký tự U+FFFD thật trong bảng mã — viết dưới dạng
// escape \uFFFD để file HTML không chứa ký tự thay thế (nghĩa không đổi).
const safe = (js) => js
  .replace(/<\/script/gi, '<\\/script')
  .replace(/\uFFFD/g, '\\uFFFD');

const out = read('src/index.html')
  .replace('/*@CSS*/', () => read('src/style.css'))
  .replace('/*@XLSX*/', () => safe(read('vendor/xlsx.full.min.js')))
  .replace('/*@CORE*/', () => safe(read('src/core.js')))
  .replace('/*@UI*/', () => safe(read('src/ui.js')));

const target = path.join(here, '..', 'doi-chieu-excel.html');
fs.writeFileSync(target, out, 'utf8');
console.log('Đã tạo', path.relative(path.join(here, '..'), target),
  '—', (Buffer.byteLength(out) / 1024 / 1024).toFixed(2), 'MB');
