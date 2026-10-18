/* Kiểm tra file doi-chieu-excel.html bằng Chromium thật:
   nạp 2 file Excel vào giao diện và xem kết quả hiển thị đúng chưa. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const XLSX = require('../vendor/xlsx.full.min.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.join(here, '.tmp');
const APP = path.join(here, '..', '..', 'doi-chieu-excel.html');
fs.mkdirSync(TMP, { recursive: true });

function writeXlsx(file, aoa, sheet = 'Sheet1') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
  fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  return file;
}

const fileA = writeXlsx(path.join(TMP, 'e2e-a.xlsx'), [
  ['CÔNG TY TNHH DEMO'],
  ['BẢNG KÊ THÁNG 9'],
  [],
  ['STT', 'Mã vật tư', 'Tên vật tư', 'Số lượng', 'Thành tiền'],
  [1, 'VT-001', 'Bulong M10', 500, 750000],
  [2, 'VT-002', 'Vòng bi 6204', 20, 1700000],
  [3, 'VT-003', 'Dây curoa', 12, 1440000],
  [4, 'VT-009', 'Van điện từ', 2, 2400000]
], 'Xuat kho');

const fileB = writeXlsx(path.join(TMP, 'e2e-b.xlsx'), [
  ['Ma vat tu', 'Ten vat tu', 'SL', 'Amount', 'Kho'],
  ['VT-001', 'Bulong M10', 500, 750000, 'A'],
  ['VT-002', 'Vòng bi 6204', 18, 1530000, 'A'],
  ['VT-003', 'Dây curoa', 12, 1440000, 'B'],
  ['VT-010', 'Rơ le', 4, 840000, 'B']
], 'The kho');

const fails = [];
function check(name, cond, extra = '') {
  if (cond) console.log('  ok  ', name);
  else { console.log('  FAIL', name, extra); fails.push(name); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto('file://' + APP);
await page.waitForSelector('#dropA');

console.log('— nạp 2 file Excel —');
await page.setInputFiles('#fileA', fileA);
await page.setInputFiles('#fileB', fileB);
await page.waitForSelector('#resultBox:not(.hidden)', { timeout: 15000 });
await page.waitForTimeout(300);

const stats = await page.$$eval('#statCards .stat', (ns) =>
  ns.map((n) => ({ n: n.querySelector('.n').textContent, k: n.querySelector('.k').textContent })));
const by = (frag) => (stats.find((s) => s.k.includes(frag)) || {}).n;

check('2 dòng khớp hoàn toàn', by('khớp hoàn toàn') === '2', JSON.stringify(stats));
check('1 dòng lệch giá trị', by('lệch giá trị') === '1');
check('1 dòng chỉ có ở file 1', by('chỉ có ở file 1') === '1');
check('1 dòng chỉ có ở file 2', by('chỉ có ở file 2') === '1');

const keyInfo = await page.textContent('#keyInfo');
check('khóa là Mã vật tư', /Mã vật tư/.test(keyInfo), keyInfo);

const diffRows = await page.$$eval('#tblWrap tbody tr', (rs) =>
  rs.map((r) => Array.from(r.cells).map((c) => c.textContent.trim())));
check('bảng lệch có 2 ô (SL + tiền) của VT-002',
  diffRows.length === 2 && diffRows.every((r) => r[0] === 'VT-002'), JSON.stringify(diffRows));
check('chênh lệch số lượng là +2', diffRows[0] && diffRows[0][4] === '+2', JSON.stringify(diffRows[0]));

console.log('— tab "Chỉ có ở file 1" —');
await page.click('.tabs .tab:nth-child(2)');
await page.waitForTimeout(150);
const onlyA = await page.$$eval('#tblWrap tbody tr td:first-child', (ns) => ns.map((n) => n.textContent.trim()));
check('đúng là VT-009', onlyA.join() === 'VT-009', JSON.stringify(onlyA));

console.log('— tab "Theo cột" —');
await page.click('.tabs .tab:nth-child(5)');
await page.waitForTimeout(150);
const cols = await page.$$eval('#tblWrap tbody tr', (rs) =>
  rs.map((r) => Array.from(r.cells).map((c) => c.textContent.trim())));
const tien = cols.find((r) => /Thành tiền/.test(r[0]));
check('tổng chênh lệch cột tiền là +170.000', tien && tien[5] === '+170.000', JSON.stringify(tien));

console.log('— đổi dung sai để bỏ qua lệch nhỏ —');
await page.click('#optsBox > summary');
await page.fill('#fTol', '200000');
await page.dispatchEvent('#fTol', 'change');
await page.waitForTimeout(400);
const after = await page.$$eval('#statCards .stat', (ns) =>
  ns.map((n) => ({ n: n.querySelector('.n').textContent, k: n.querySelector('.k').textContent })));
const byA = (frag) => (after.find((s) => s.k.includes(frag)) || {}).n;
check('dung sai lớn → không còn dòng lệch', byA('lệch giá trị') === '0', JSON.stringify(after));
await page.fill('#fTol', '0.01');
await page.dispatchEvent('#fTol', 'change');
await page.waitForTimeout(300);

console.log('— tải file kết quả —');
const dl = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.click('#btnExport')
]).then((r) => r[0]);
const saved = path.join(TMP, 'ket-qua.xlsx');
await dl.saveAs(saved);
const wb = XLSX.read(fs.readFileSync(saved), { cellDates: true });
check('file kết quả có đủ 5 sheet',
  ['Tóm tắt', 'Lệch giá trị', 'Chỉ có ở file 1', 'Chỉ có ở file 2', 'Khóa trùng lặp']
    .every((n) => wb.SheetNames.includes(n)), JSON.stringify(wb.SheetNames));
const diffSheet = XLSX.utils.sheet_to_json(wb.Sheets['Lệch giá trị'], { header: 1 });
check('sheet lệch giá trị có 2 dòng dữ liệu', diffSheet.length === 3, JSON.stringify(diffSheet));

console.log('— dữ liệu mẫu —');
await page.reload();
await page.click('#btnDemo');
await page.waitForSelector('#resultBox:not(.hidden)', { timeout: 15000 });
const demoStats = await page.$$eval('#statCards .stat .n', (ns) => ns.map((n) => n.textContent));
check('dữ liệu mẫu cho ra kết quả', demoStats.length === 6 && demoStats[0] !== '0', JSON.stringify(demoStats));

console.log('— màn hình điện thoại —');
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('không bị tràn ngang trên iPhone', overflow <= 1, 'tràn ' + overflow + 'px');
await page.screenshot({ path: path.join(TMP, 'mobile.png'), fullPage: false });
await page.setViewportSize({ width: 1280, height: 1000 });
await page.waitForTimeout(200);
await page.screenshot({ path: path.join(TMP, 'desktop.png'), fullPage: false });

check('không có lỗi JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(fails.length ? '\n✗ ' + fails.length + ' mục chưa đạt' : '\n✓ tất cả đều đạt');
process.exit(fails.length ? 1 : 0);
