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

console.log('— cột lộn xộn, tên cột vô nghĩa, dòng lộn xộn —');
const mixA = writeXlsx(path.join(TMP, 'e2e-mix-a.xlsx'), [
  ['Column1', 'Column2', 'Column3', 'Column4'],
  ['VT-003', 'Dây curoa', 12, 1440000],
  ['VT-001', 'Bulong M10', 500, 750000],
  ['VT-002', 'Vòng bi', 20, 1700000]
], 'A');
const mixB = writeXlsx(path.join(TMP, 'e2e-mix-b.xlsx'), [
  ['F1', 'F2', 'F3', 'F4'],
  [750000, 'Bulong M10', 500, 'VT-001'],
  [1530000, 'Vòng bi', 18, 'VT-002'],
  [1440000, 'Dây curoa', 12, 'VT-003']
], 'B');

await page.reload();
await page.setInputFiles('#fileA', mixA);
await page.setInputFiles('#fileB', mixB);
await page.waitForSelector('#resultBox:not(.hidden)', { timeout: 15000 });
await page.waitForTimeout(300);

const mixKey = await page.textContent('#keyInfo');
check('tự tìm ra khóa dù tên cột vô nghĩa', /Column1/.test(mixKey), mixKey);
const mixDiff = await page.$$eval('#tblWrap tbody tr', (rs) =>
  rs.map((r) => Array.from(r.cells).map((c) => c.textContent.trim())));
check('tìm đúng 2 ô lệch của VT-002',
  mixDiff.length === 2 && mixDiff.every((r) => r[0] === 'VT-002'), JSON.stringify(mixDiff));

await page.click('#optsBox > summary');
await page.waitForTimeout(200);
const mapRows = await page.$$eval('#colMap tbody tr', (rs) =>
  rs.map((r) => [r.cells[0].textContent.trim(),
    r.cells[1].textContent.trim(),
    r.cells[2].querySelector('select').selectedOptions[0].textContent.trim(),
    r.cells[4].textContent.trim()]));
check('bảng ghép cột hiện đủ 4 cột của file 1', mapRows.length === 4, JSON.stringify(mapRows));
check('Column1 được ghép với F4 theo dữ liệu',
  mapRows[0][2].startsWith('F4') && /dữ liệu/.test(mapRows[0][3]), JSON.stringify(mapRows[0]));
check('có hiện dữ liệu mẫu của cột để biết cột đó chứa gì',
  /VT-003/.test(mapRows[0][1]), JSON.stringify(mapRows[0]));

console.log('— tự tay đổi cột ghép —');
const SEL4 = '#colMap tbody tr:nth-child(4) td:nth-child(3) select';
await page.selectOption(SEL4, { label: '— không ghép —' });
await page.waitForTimeout(400);
const afterUnmap = await page.$$eval('#tblWrap tbody tr td:nth-child(2)', (ns) =>
  ns.map((n) => n.textContent.trim()));
check('bỏ ghép cột tiền thì chỉ còn 1 ô lệch',
  afterUnmap.length === 1 && afterUnmap[0] === 'Column3', JSON.stringify(afterUnmap));
const freeNote = await page.textContent('#unmatched');
check('báo đúng cột file 2 chưa dùng', /F1/.test(freeNote), freeNote);
await page.selectOption(SEL4, { index: 1 });
await page.waitForTimeout(400);

console.log('— nhớ cách ghép cho lần sau —');
const pickOf = (r) => r.cells[2].querySelector('select').selectedOptions[0].textContent.trim();
await page.selectOption('#colMap tbody tr:nth-child(2) td:nth-child(3) select', { label: '— không ghép —' });
await page.waitForTimeout(400);
check('báo đã nhớ cách ghép', /nhớ/.test(await page.textContent('#memNote')), await page.textContent('#memNote'));

await page.reload();
await page.setInputFiles('#fileA', mixA);
await page.setInputFiles('#fileB', mixB);
await page.waitForSelector('#resultBox:not(.hidden)', { timeout: 15000 });
await page.click('#optsBox > summary');
await page.waitForTimeout(300);
const restored = await page.$$eval('#colMap tbody tr', (rs, f) => rs.map(eval(f)), pickOf.toString());
check('mở lại 2 file thì giữ nguyên cách ghép đã chọn',
  restored[1].startsWith('—') && restored[0].startsWith('F4'), JSON.stringify(restored));

await page.click('#btnAuto');
await page.waitForTimeout(600);
const afterAuto = await page.$$eval('#colMap tbody tr', (rs, f) => rs.map(eval(f)), pickOf.toString());
check('bấm "máy ghép lại từ đầu" thì ghép lại đủ', afterAuto[1].startsWith('F2'), JSON.stringify(afterAuto));

await page.click('#btnClear');
await page.waitForTimeout(600);
const cleared = await page.$$eval('#colMap tbody tr', (rs, f) => rs.map(eval(f)), pickOf.toString());
check('bấm "bỏ hết ghép" thì xóa sạch để tự chọn',
  cleared.every((v) => v.startsWith('—')), JSON.stringify(cleared));
check('và báo rõ là chưa có cột khóa', /cột khóa/i.test(await page.textContent('#error')),
  await page.textContent('#error'));
await page.click('#btnAuto');
await page.waitForTimeout(600);

console.log('— ghép dòng theo thứ tự thay vì theo khóa —');
await page.selectOption('#fKey', 'rowOrder');
await page.waitForTimeout(500);
const rowOrderKey = await page.textContent('#keyInfo');
check('chuyển sang so theo thứ tự dòng', /thứ tự dòng/.test(rowOrderKey), rowOrderKey);
const rowOrderDiff = await page.$$eval('#tblWrap tbody tr td:first-child', (ns) =>
  ns.map((n) => n.textContent.trim()));
check('so theo thứ tự dòng thì dòng nào cũng lệch',
  rowOrderDiff.length > 0 && rowOrderDiff.every((k) => /^Dòng \d+$/.test(k)), JSON.stringify(rowOrderDiff));
await page.selectOption('#fKey', 'columns');
await page.waitForTimeout(400);

console.log('— ghép cột chỉ theo tên: không ghép được gì —');
await page.selectOption('#fMatch', 'name');
await page.waitForTimeout(500);
const nameErr = await page.textContent('#error');
check('báo rõ khi không ghép được cột nào', /cột khóa|Thứ tự dòng/i.test(nameErr), nameErr);
await page.selectOption('#fMatch', 'auto');
await page.waitForTimeout(500);
check('quay lại tự động thì đối chiếu lại được',
  await page.isVisible('#resultBox'), 'kết quả không hiện lại');

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
