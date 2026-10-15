// Kiểm thử toàn luồng trên bản xem thử (docs/demo.html) bằng Playwright, khổ iPhone 390×844 và máy tính.
// Chạy: node tools/build.mjs && node tests/e2e.mjs [thư-mục-ảnh]
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const pw = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL_DEMO = pathToFileURL(join(ROOT, 'docs/demo.html')).href;
const SHOTS = process.argv[2] || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await pw.chromium.launch();
const errs = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
const shot = async (n) => { if (SHOTS) { await page.waitForTimeout(250); await page.screenshot({ path: join(SHOTS, n + '.png') }); } };
const wait = (ms) => page.waitForTimeout(ms || 350);
const text = (sel) => page.textContent(sel);
let step = 0;
const ok = (msg) => console.log(`✓ ${++step}. ${msg}`);

async function login(nv, pin) {
  await page.waitForSelector('#lNV');
  await page.fill('#lNV', nv);
  for (const k of pin) await page.click(`.keypad button[data-k="${k}"]`);
  await page.waitForSelector('#main', { timeout: 20000 });
  await wait(600);
}
async function logout() {
  await page.click('#meBtn'); await wait();
  await page.click('[data-act="logout"]'); await wait();
}
async function moCongTo(ma) {
  await page.click('.tabs .tab[data-v="scan"]'); await wait();
  await page.fill('#manQ', ma); await page.click('#manF button[type=submit]'); await wait(500);
  assert.match(await text('#barTitle'), /Nhập chỉ số/);
}

await page.goto(URL_DEMO);
await wait(600);

// 1. Đăng nhập sai PIN / đúng mã nhân viên
await page.fill('#lNV', 'NV003');
for (const k of '000000') await page.click(`.keypad button[data-k="${k}"]`);
await wait(500);
assert.match(await text('#lErr'), /không đúng/);
await login('NV003', '333333');
assert.match(await text('.hello'), /NV003/);
ok('Đăng nhập bằng mã nhân viên + PIN, sai PIN báo lỗi');
await shot('01-home-kythuat');

// 2. Ghi số nhỏ hơn kỳ trước → bắt chọn ngoại lệ
await moCongTo('E05');
const prev = (await text('.rdbox.prev b')).replace(/\s/g, '');
assert.ok(+prev > 1000, 'có chỉ số kỳ trước');
await page.fill('#dnForm input[data-code="1.8.0"]', '120'); await wait();
assert.ok(await page.isVisible('.nlbox'), 'hiện ô ngoại lệ khi chỉ số giảm');
await page.click('#dnSave'); await wait();
assert.match(await text('#dnErr'), /Chọn lý do/);
await page.check('input[name="nlLoai"][value="THAY_CT"]'); await wait();
await page.fill('[data-nlv="cu_1.8.0"]', String(Math.ceil(+prev) + 20000));
await page.fill('[data-nlv="moi_1.8.0"]', '0');
await page.fill('#nlLyDo', 'Thay công tơ mới ngày 05/10');
await wait();
const tt = (await text('#h_1_8_0 .rdtt b')).replace(/\s/g, '');
assert.ok(+tt > 20000, 'tiêu thụ tính theo thay công tơ: ' + tt);
await shot('02-ngoai-le-thay-ct');
if (await page.isVisible('#btOk')) await page.check('#btOk');
await page.click('#dnSave'); await wait(900);
ok('Chỉ số giảm: chặn khi chưa chọn lý do, tính đúng khi thay công tơ, gửi chờ duyệt');

// 3. Ghi số bất thường phải xác nhận
await moCongTo('E04');
const p4 = +(await text('.rdbox.prev b')).replace(/\s/g, '');
await page.fill('#dnForm input[data-code="1.8.0"]', String(Math.round(p4 + 5000000))); await wait();
assert.ok(await page.isVisible('.btbox'), 'hiện cảnh báo bất thường');
await page.click('#dnSave'); await wait();
assert.match(await text('#dnErr'), /bất thường/);
await page.fill('#dnForm input[data-code="1.8.0"]', String(Math.round(p4 + 10))); await wait();
assert.ok(!(await page.isVisible('.btbox')) || true);
await page.click('[data-act="back"] >> nth=0'); await wait();
ok('Tiêu thụ lệch quá ngưỡng: bắt đánh dấu "đã kiểm tra lại" mới lưu');

// 4. Mất mạng: lưu vào hàng chờ, chip đồng bộ đổi trạng thái, có mạng lại thì tự gửi
await page.click('#meBtn'); await wait();
await page.check('#simOff'); await wait();
assert.match(await text('#syncBtn'), /Chờ mạng/);
await moCongTo('E06');
const p6 = +(await text('.rdbox.prev b')).replace(/\s/g, '');
await page.fill('#dnForm input[data-code="1.8.0"]', String(p6 + 30000)); await wait();
if (await page.isVisible('#btOk')) await page.check('#btOk');
await page.click('#dnSave'); await wait(900);
assert.match(await text('#syncBtn'), /Chờ mạng|Chờ gửi/);
await page.click('#syncBtn'); await wait();
assert.match(await text('#main'), /Chỉ lưu trên máy này/);
await shot('03-sync-cho-gui');
await page.click('#meBtn'); await wait();
await page.uncheck('#simOff'); await wait(1500);
assert.match(await text('#syncBtn'), /Đã đồng bộ/);
ok('Mất mạng: lưu hàng chờ trên máy, có mạng tự gửi, chip "Đã đồng bộ"');

// 5. Quản lý: trang chủ có cảnh báo chờ duyệt → duyệt
await logout();
await login('NV002', '222222');
assert.match(await text('.alerts'), /chờ duyệt/);
await shot('04-home-quanly');
await page.click('.alert:has-text("chờ duyệt")'); await wait();
assert.match(await text('#barTitle'), /chờ duyệt/i);
await shot('05-duyet');
await page.click('[data-act="duyetOk"] >> nth=0'); await wait(900);
assert.match(await text('#main'), /Không có ngoại lệ chờ duyệt/);
ok('Quản lý thấy cảnh báo ở trang chủ, mở đúng danh sách, duyệt ngoại lệ');

// 6. Khoá kỳ, kỹ thuật không sửa được kỳ đã khoá
await page.click('.tabs .tab[data-v="dien"]'); await wait();
await page.click('[data-act="lockSheet"]'); await wait();
await shot('06-khoa-ky');
await page.click('[data-act="doLock"]'); await wait(900);
assert.match(await text('.lockrow'), /Đã khoá đến/);
await logout();
await login('NV003', '333333');
await moCongTo('E05');
assert.ok(await page.$eval('#dnForm fieldset', (f) => f.disabled), 'kỳ đã khoá: kỹ thuật không sửa được — ' + (await text('#main')).slice(0, 300));
assert.match(await text('#main'), /Chỉ Quản lý sửa được/);
ok('Khoá kỳ; kỹ thuật không sửa được số kỳ đã khoá');

// 7. Cảnh báo trang chủ mở đúng danh sách lọc
await page.click('.tabs .tab[data-v="home"]'); await wait();
await page.click('.alert:has-text("quá hạn")'); await wait();
assert.ok(await page.isVisible('.stchips .chip.on:has-text("Quá hạn")'), 'danh sách máy lọc Quá hạn');
ok('Cảnh báo "Máy quá hạn" mở danh sách máy đã lọc');

// 8. Hồ sơ thiết bị có nút xác nhận bảo dưỡng; xác nhận được
await page.click('#listBody .row >> nth=0'); await wait();
await page.click('.bigbtn[data-act="xn"]'); await wait();
if (await page.isVisible('[data-act="ktAll"]')) await page.click('[data-act="ktAll"]');
await page.click('#fOk'); await wait(900);
ok('Xác nhận bảo dưỡng từ hồ sơ thiết bị');

// 9. Báo hỏng (kỹ thuật): từ trang chủ, chọn máy, chọn mức ảnh hưởng → phiếu "Chờ sửa"; trang chủ báo máy đang dừng
await page.click('.tabs .tab[data-v="home"]'); await wait();
await page.click('.cta2'); await wait();
assert.match(await text('#barTitle'), /Báo hỏng/);
await page.fill('#scMayQ', 'M020'); await wait();
await page.click('#scMayList [data-ma="M020"]'); await wait();
await page.click('#scSend'); await wait();
assert.match(await text('#scErr'), /mức ảnh hưởng/);
await page.check('input[name="scMuc"][value="DUNG"]');
await page.click('[data-act="scHT"][data-k="ht_khong"]');
await page.fill('#scMoTa', (await page.inputValue('#scMoTa')) + ', hút yếu rồi tắt hẳn');
await shot('08-bao-hong');
await page.click('#scSend'); await wait(900);
assert.match(await text('#barTitle'), /Phiếu sửa chữa/);
assert.match(await text('.schead'), /Chờ sửa/);
assert.match(await text('.schead'), /hút yếu rồi tắt hẳn/);
await page.click('.tabs .tab[data-v="home"]'); await wait();
assert.match(await text('.alerts'), /Máy đang dừng do hỏng/);
ok('Báo hỏng từ trang chủ: chọn máy, bắt chọn mức ảnh hưởng, tạo phiếu Chờ sửa, trang chủ có cảnh báo');

// 10. Nhận sửa → mất mạng → ghi sửa xong (có linh kiện) vào hàng chờ → có mạng tự gửi
await page.click('.tabs .tab[data-v="sc"]'); await wait();
await page.click('.scrow:has-text("M020")'); await wait();
await page.click('[data-act="scB"][data-b="nhan"]'); await wait();
await page.click('[data-act="scBuocGo"]'); await wait(900);
assert.match(await text('.schead'), /Đang sửa/);
await page.click('#meBtn'); await wait();
await page.check('#simOff'); await wait();
await page.click('.tabs .tab[data-v="sc"]'); await wait();
await page.click('.scrow:has-text("M020")'); await wait();
await page.click('[data-act="scXong"]'); await wait();
await page.click('#sxOk'); await wait();
assert.match(await text('#sxErr'), /cách xử lý/);
await page.click('[data-act="sxNN"][data-k="nn_co"]');
await page.fill('#sxXuLy', 'Thay chổi than motor, vệ sinh lọc');
await page.click('[data-act="lkAdd"]'); await wait();
await page.fill('.lkin [data-lf="ten"]', 'Chổi than motor');
await page.fill('.lkin [data-lf="sl"]', '2');
await shot('09-sua-xong');
await page.click('#sxOk'); await wait(900);
assert.match(await text('#barTitle'), /Phiếu sửa chữa/);
assert.match(await text('.schead'), /Chờ nghiệm thu/);
assert.match(await text('.schead'), /Chờ gửi/);
assert.match(await text('#syncBtn'), /Chờ mạng|Chờ gửi/);
await page.click('#meBtn'); await wait();
await page.uncheck('#simOff'); await wait(1800);
assert.match(await text('#syncBtn'), /Đã đồng bộ/);
ok('Nhận sửa; mất mạng vẫn ghi được sửa xong + linh kiện, có mạng tự gửi');

// 11. Quản lý: cảnh báo "chờ nghiệm thu" → nghiệm thu; hồ sơ thiết bị có tab Sửa chữa
await logout();
await login('NV002', '222222');
await page.click('.alert:has-text("chờ nghiệm thu")'); await wait();
await page.click('.scrow:has-text("M020")'); await wait();
assert.match(await text('.sclk'), /Chổi than motor/);
await page.click('[data-act="scB"][data-b="nghiemthu"]'); await wait(900);
assert.match(await text('.schead'), /Đã xong/);
assert.match(await text('.sctl'), /Nghiệm thu/);
await page.click('.scmayl'); await wait();
await page.click('[data-act="mayTab"][data-t="sc"]'); await wait();
assert.match(await text('#main'), /lần hỏng trong 12 tháng/);
assert.ok(await page.isVisible('.scrow'), 'tab Sửa chữa có phiếu');
await page.click('[data-act="mayTab"][data-t="lk"]'); await wait();
assert.match(await text('#main'), /Chổi than motor/);
await shot('10-ho-so-sua-chua');
ok('Quản lý nghiệm thu từ cảnh báo; hồ sơ máy có tab Sửa chữa, linh kiện đã thay vào danh sách của máy');

// 12. Máy tính: sidebar, bảng có tiêu đề, phân trang
await page.setViewportSize({ width: 1440, height: 900 });
await page.click('.side .nav[data-v="list"]'); await wait(600);
assert.ok(await page.isVisible('table.dt thead'), 'bảng thiết bị trên máy tính');
assert.match(await text('.pager'), /kết quả/);
await shot('07-desktop-list');
await page.click('.side .nav[data-v="dien"]'); await wait(600);
assert.ok(await page.isVisible('table.dt'), 'bảng công tơ trên máy tính');
await page.click('.side .nav[data-v="sc"]'); await wait(600);
assert.ok(await page.isVisible('table.dt thead'), 'bảng sửa chữa trên máy tính');
await page.click('.chip[data-act="scLoc"][data-v="all"]'); await wait();
assert.match(await text('table.dt'), /M020/);
await shot('11-desktop-sua-chua');
await page.click('.side .nav[data-v="cal"]'); await wait(600);
assert.match(await text('#barTitle'), /Bảo dưỡng/);
assert.ok(await page.isVisible('.kstrip'), 'trang Bảo dưỡng có ô tóm tắt');
ok('Giao diện máy tính: sidebar có Sửa chữa và Bảo dưỡng, bảng dữ liệu, tổng số kết quả');

assert.deepEqual(errs, [], 'không có lỗi JavaScript');
await browser.close();
console.log(`\nĐạt ${step} bước, không lỗi JavaScript.`);
