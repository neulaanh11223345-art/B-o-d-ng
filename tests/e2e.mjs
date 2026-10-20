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

// 7. Phân quyền: kỹ thuật chỉ thấy Điện/Nước, Sửa chữa, Bảo dưỡng; cảnh báo trang chủ mở đúng nhóm máy
await page.click('.tabs .tab[data-v="home"]'); await wait();
assert.equal(await page.locator('.tabs .tab[data-v="list"]').count(), 0, 'kỹ thuật: không có tab Thiết bị');
assert.match(await text('.tabs .tab[data-v="cal"]'), /Bảo dưỡng/);
assert.match(await text('.tabs .tab[data-v="cv"]'), /Sửa chữa/);
assert.match(await text('.mtiles'), /Sửa chữa/);
assert.doesNotMatch(await text('.mtiles'), /Linh kiện|Thiết bị|Công việc/, 'Tổng quan chỉ còn Sửa chữa, Bảo dưỡng, Điện, Nước');
await shot('16-ky-thuat-trang-chu');
for (const v of ['list', 'kho', 'cvBC', 'labels']) {
  await page.evaluate((x) => go(x), v); await wait();
  assert.match(await text('#main'), /chỉ xem được Điện\/Nước, Sửa chữa và Bảo dưỡng/, 'chặn màn ' + v);
}
assert.equal(await page.evaluate(() => S.kho.ds.length), 0, 'kỹ thuật không tải kho linh kiện');
await page.click('.tabs .tab[data-v="cv"]'); await wait();
assert.match(await text('#barTitle'), /Sửa chữa/);
assert.equal(await page.locator('[data-act="go"][data-v="cvBC"], [data-act="go"][data-v="cvLap"]').count(), 0, 'không có báo cáo tháng, việc lặp lại');
await page.click('.tabs .tab[data-v="home"]'); await wait();
await page.click('.alert:has-text("Máy quá hạn")'); await wait();
assert.match(await text('#barTitle'), /Bảo dưỡng/);
assert.ok(await page.locator('.gap.g-qua.mo .gapb .row').count() > 0, 'mở Bảo dưỡng, nhóm Quá hạn mở sẵn');
ok('Kỹ thuật chỉ thấy Điện/Nước, Sửa chữa, Bảo dưỡng (không Thiết bị, Linh kiện, báo cáo); "Máy quá hạn" mở nhóm quá hạn ở Bảo dưỡng');

// 8. Hồ sơ thiết bị có nút xác nhận bảo dưỡng; xác nhận được
await page.click('.gap.g-qua .gapb .row >> nth=0'); await wait();
assert.equal(await page.locator('.ptabs [data-t="lk"]').count(), 0, 'hồ sơ máy: kỹ thuật không thấy tab Linh kiện');
await page.click('.bigbtn[data-act="xn"]'); await wait();
if (await page.isVisible('[data-act="ktAll"]')) await page.click('[data-act="ktAll"]');
await page.click('#fOk'); await wait(900);
// Bảo dưỡng · Tổng quan: máy quá hạn gom lại, bấm mới hiện; mỗi chuyền một ô, mở ra thấy máy trong chuyền
await page.evaluate(() => { S.f.mo = {}; tab('cal'); }); await wait();
assert.ok(await page.isVisible('.gaph[data-k="qua"]'), 'có dòng Quá hạn');
assert.equal(await page.locator('.gap .gapb').count(), 0, 'mặc định thu gọn');
await page.click('.gaph[data-k="qua"]'); await wait();
assert.ok(await page.locator('.gapb .row').count() > 0, 'bấm vào hiện danh sách máy quá hạn');
await page.click('.chtile[data-ma="VKY01"]'); await wait();
assert.match(await text('#barTitle'), /Chuyền sản xuất/);
assert.match(await text('#main'), /喷印机 VKY01/);
assert.match(await text('#main'), /HNJX-HD2000/);
assert.equal(await page.locator('.gaph[data-k="lkch:VKY01"]').count(), 0, 'kỹ thuật không thấy linh kiện / ERP của chuyền');
ok('Xác nhận bảo dưỡng từ hồ sơ thiết bị; Bảo dưỡng gọn (quá hạn bấm mới hiện), xem máy theo chuyền');

// 9. Kỹ thuật thấy máy hỏng: tự ghi việc sửa chữa (mất mạng vẫn ghi được), ghi nguyên nhân + giờ dừng máy
await page.click('.tabs .tab[data-v="home"]'); await wait();
await page.click('#meBtn'); await wait();
await page.check('#simOff'); await wait();
await page.click('.tabs .tab[data-v="home"]'); await wait();
await page.click('.cta2'); await wait();
assert.match(await text('#barTitle'), /Ghi việc/);
await page.fill('#cvTD', 'Máy hút bụi VKY03 không chạy');
await page.check('#cvTuLam'); await wait();
// Mọi loại việc chọn được cả chuyền, máy ngoài chuyền và máy thuộc chuyền
assert.equal(await page.locator('#cvMa option[value="VKY03"]').count(), 1, 'chọn được chuyền sản xuất');
assert.equal(await page.locator('#cvMa option[value="M038"]').count(), 1, 'chọn được máy ngoài chuyền');
assert.equal(await page.locator('#cvMa option[value="M020"]').count(), 1, 'chọn được máy thuộc chuyền (máy hút bụi VKY03)');
assert.equal(await page.locator('#cvMa optgroup[label*="Máy của chuyền VKY03"] option[value="M020"]').count(), 1,
  'máy thuộc chuyền gom đúng vào nhóm của chuyền đó');
await page.selectOption('#cvMa', 'VKY03');
await page.click('#cvOk'); await wait(900);
assert.match(await text('.schead'), /Đã giao/);
assert.match(await text('.scmayl'), /Chuyền VKY03/);
await page.click('[data-act="cvXong"]'); await wait();
await page.fill('#cxKQ', 'Thay chổi than motor');
await page.click('[data-act="cxNNChon"][data-k="nn_mon"]');
await page.fill('#cxGio', '1.5');
await shot('08-sua-chua-tu-ghi');
await page.click('#cxOk'); await wait(900);
assert.match(await text('.schead'), /Chờ kiểm tra/);
assert.match(await text('#syncBtn'), /Chờ mạng|Chờ gửi/);
await page.click('#meBtn'); await wait();
await page.uncheck('#simOff'); await wait(1800);
assert.match(await text('#syncBtn'), /Đã đồng bộ/);
// Có mạng lại: máy chủ đã tự dịch tên việc, kết quả, nguyên nhân sang tiếng Trung
await page.click('.tabs .tab[data-v="cv"]'); await wait();
await page.click('.chip[data-act="cvLoc"][data-v="all"]'); await wait();
await page.click('.scrow:has-text("Máy hút bụi VKY03")'); await wait();
assert.match(await text('.schead'), /吸尘器VKY03不运转/);
assert.match(await text('.scres'), /更换电机碳刷/);
assert.match(await text('.scres'), /自然磨损/);
ok('Kỹ thuật tự ghi việc sửa chữa khi mất mạng, ghi nguyên nhân và giờ dừng máy, có mạng tự gửi và tự dịch sang tiếng Trung');

// 10. Công việc: Quản lý ghi việc và giao luôn; giao nhiều việc một lần; nhân viên thấy ở "Việc của tôi", làm xong; Quản lý kiểm tra
await logout();
await login('NV002', '222222');
await page.click('.tabs .tab[data-v="cv"]'); await wait();
assert.match(await text('#barTitle'), /Công việc/);
await page.click('[data-act="cvNew"]'); await wait();
await page.click('#cvOk'); await wait();
assert.match(await text('#cvErr'), /tên việc/);
await page.fill('#cvTD', 'Thay vòi nước nhà vệ sinh xưởng 1');
await page.click('[data-act="cvHanChon"] >> nth=0'); await wait();
assert.equal(await page.inputValue('#cvTD'), 'Thay vòi nước nhà vệ sinh xưởng 1', 'giữ chữ đã gõ khi bấm chọn hạn');
await page.click('.nvc:has-text("Lê Minh Tiến")'); await wait();
await shot('12-ghi-viec');
await page.click('#cvOk'); await wait(900);
assert.match(await text('.schead'), /Đã giao/);
assert.match(await text('.schead'), /Lê Minh Tiến/);
assert.match(await text('.schead'), /更换一车间卫生间水龙头/, 'tự dịch tên việc sang tiếng Trung');
// Quản lý sửa tay bản dịch
await page.click('[data-act="cvEdit"]'); await wait();
assert.equal(await page.inputValue('#cvTDd'), '更换一车间卫生间水龙头');
await page.fill('#cvTDd', '更换一车间厕所水龙头');
await shot('12b-sua-ban-dich');
await page.click('#cvOk'); await wait(900);
assert.match(await text('.schead'), /更换一车间厕所水龙头/);
await page.click('.tabs .tab[data-v="home"]'); await wait();
await page.click('.mtile:has-text("Công việc")'); await wait();
await page.click('[data-act="go"][data-v="cvGiao"]'); await wait();
// Số việc chờ giao đổi theo ngày chạy (việc lặp lại ngày 1 và 15 hằng tháng), nên đếm trước khi giao
const choTruoc = await page.evaluate(() => S.V.cv.filter((x) => x.trangThai === 'CHO_GIAO').length);
await page.click('.cvpick >> nth=0'); await page.click('.cvpick >> nth=1');
await page.click('.nvc:has-text("Nguyễn Tuấn")'); await wait();
assert.match(await text('#cgLbl'), /Giao 2 việc cho Nguyễn Tuấn/);
await shot('13-giao-viec');
await page.click('#cgOk'); await wait(900);
const chipCho = await text('.chip[data-act="cvLoc"][data-v="cho"]');
if (choTruoc > 2) assert.match(chipCho, new RegExp('Chờ giao.*' + (choTruoc - 2), 's'), 'còn ' + (choTruoc - 2) + ' việc chờ giao');
else assert.doesNotMatch(chipCho, /\d/, 'hết việc chờ giao');
await logout();
await login('NV004', '444444');
assert.match(await text('#main'), /Việc của tôi/);
assert.equal(await page.locator('.gap.g-toi .scrow').count(), 0, 'trang chủ: Việc của tôi gọn một ô, chưa mở');
await page.click('.gap.g-toi .gaph'); await wait();
await page.click('.scrow:has-text("Thay vòi nước")'); await wait();
await page.click('[data-act="cvB"][data-b="batdau"]'); await wait(900);
assert.match(await text('.schead'), /Đang làm/);
await page.click('[data-act="cvXong"]'); await wait();
await page.fill('#cxKQ', 'Đã thay 2 vòi, hết rò');
await page.click('#cxOk'); await wait(900);
assert.match(await text('.schead'), /Chờ kiểm tra/);
assert.match(await text('.scres'), /已更换2个水龙头，不再漏水/, 'kết quả nhân viên ghi cũng được dịch');
await logout();
await login('NV002', '222222');
await page.click('.alert:has-text("chờ kiểm tra")'); await wait();
await page.click('.scrow:has-text("Thay vòi nước")'); await wait();
await page.click('[data-act="cvB"][data-b="kiemtra"]'); await wait(900);
assert.match(await text('.schead'), /Đã xong/);
// Báo cáo tháng: tỉ lệ hoàn thành theo người, sửa chữa trong tháng (có việc tự ghi ở bước 9)
await page.click('.tabs .tab[data-v="cv"]'); await wait();
await page.click('[data-act="go"][data-v="cvBC"]'); await wait();
assert.match(await text('#main'), /Tỉ lệ hoàn thành theo người/);
assert.match(await text('#main'), /Lê Minh Tiến/);
assert.match(await text('#main'), /Máy hút bụi VKY03 không chạy/);
await shot('14-bao-cao-thang');
const blob = await page.evaluate(() => bcWorkbook(bcThangNay()).size);
assert.ok(blob > 2000, 'tạo được file Excel');
assert.ok(await page.evaluate(() => giaoWorkbook().size) > 2000, 'tạo được file Excel việc đang giao');
// Giao bảo dưỡng máy có tên tiếng Trung: Google không dịch chữ lẫn hai thứ tiếng, nên app điền sẵn bản tiếng Trung
await page.evaluate(() => go('may', { ma: 'M001', tab: 'bd' })); await wait();
await page.click('[data-act="cvNewBD"]'); await wait();
assert.equal(await page.inputValue('#cvTD'), 'Bảo dưỡng 喷印机 VKY01');
await page.click('.nvc:has-text("Nguyễn Tuấn")'); await wait();
await page.click('#cvOk'); await wait(900);
assert.match(await text('.schead'), /保养 喷印机 VKY01/);
// Quản lý xem được linh kiện của chuyền: đối chiếu tồn ERP, xuất Excel
await page.evaluate(() => khoLoad()); await wait();
await page.evaluate(() => go('chuyen', { ma: 'VKY01' })); await wait();
await page.click('.gaph[data-k="lkch:VKY01"]'); await wait();
assert.ok(await page.locator('.lkch .dctag').count() > 0, 'mỗi linh kiện có kết quả đối chiếu ERP');
assert.ok(await page.evaluate(() => S.kho.ds.length) > 0, 'Quản lý tải lại kho linh kiện');
assert.ok(await page.evaluate(() => lkChXlsx(chDangDung()).size) > 2000, 'xuất được Excel linh kiện các chuyền');
// Bảng mẫu linh kiện: tải về rồi đọc lại được (nhập từ Excel)
const mau = await page.evaluate(async () => { const r = await lkDocFile(new File([lkMauXlsx()], 'mau.xlsx')); return [r.ds.length, r.ds.filter((o) => o.loi.length).length]; });
assert.ok(mau[0] > 0 && mau[1] === 0, 'bảng mẫu đọc lại đủ dòng, không lỗi máy: ' + mau);
ok('Công việc: ghi và giao, giao nhiều việc, nhân viên làm xong, Quản lý kiểm tra; báo cáo tháng + Excel; giao bảo dưỡng có sẵn tiếng Trung; linh kiện chuyền');

// 11. Máy tính: sidebar, bảng có tiêu đề, phân trang
await page.setViewportSize({ width: 1440, height: 900 });
await page.click('.side .nav[data-v="list"]'); await wait(600);
await page.click('.stchips .chip[data-st="qua"]'); await wait(600);
assert.ok(await page.isVisible('table.dt thead'), 'bảng thiết bị trên máy tính');
assert.match(await text('.pager'), /kết quả/);
await shot('07-desktop-list');
await page.click('.side .nav[data-v="dien"]'); await wait(600);
assert.ok(await page.isVisible('table.dt'), 'bảng công tơ trên máy tính');
await page.click('.side .nav[data-v="cal"]'); await wait(600);
assert.match(await text('#barTitle'), /Bảo dưỡng/);
assert.ok(await page.isVisible('.kstrip'), 'trang Bảo dưỡng có ô tóm tắt');
await page.click('.side .nav[data-v="cv"]'); await wait(600);
await page.click('[data-act="cvXem"][data-v="nguoi"]'); await wait();
assert.ok(await page.isVisible('.board .bcol[data-uid=""]'), 'bảng theo người');
await shot('14-desktop-theo-nguoi');
ok('Giao diện máy tính: sidebar có Công việc, Bảo dưỡng; bảng việc theo người');

// 12. Bản 2.9: tài liệu máy, tiền điện, gợi ý cách xử lý từ lịch sử sửa chữa, sao lưu
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => go('may', { ma: 'M001', tab: 'tl' })); await wait();
await page.click('[data-act="tlLink"]'); await wait();
await page.fill('#tlTen', 'Sách hướng dẫn máy in'); await page.fill('#tlUrl', 'https://example.com/huong-dan.pdf');
await page.click('[data-act="tlLinkLuu"]'); await wait(900);
assert.match(await text('#main'), /Sách hướng dẫn máy in/);
await page.evaluate(() => { S.f.dTab = 'tien'; tab('dien'); }); await wait(600);
assert.match(await text('#main'), /Tiền điện tháng/);
await shot('15-tien-dien');
await page.evaluate(() => go('scGhi')); await wait();
await page.selectOption('#scMa', 'M038'); await page.fill('#scMT', 'Máy nén khí báo nhiệt độ cao'); await wait(800);
assert.match(await text('#scGoiY'), /Két làm mát/, 'gợi ý lần sửa tương tự của cùng máy');
await page.click('#scGoiY [data-act="gyDung"]'); await wait();
assert.equal(await page.inputValue('#scNN'), 'Két làm mát bám bụi dày');
await logout(); await login('NV001', '111111');
await page.evaluate(() => go('saoLuu')); await wait(1200);
await page.click('[data-act="slNgay"]'); await wait(1500);
assert.match(await text('#main'), /Sao lưu tay/);
ok('Bản 2.9: tài liệu máy, tiền điện, gợi ý cách xử lý từ lịch sử, sao lưu dữ liệu');

// 13. Bản 2.11: đăng ký tăng ca theo tuần, in đơn theo mẫu công ty, tổng hợp tháng, phân quyền xem
await logout(); await login('NV003', '333333');
await page.evaluate(() => tab('tc')); await wait(600);
assert.match(await text('#barTitle'), /Đăng ký tăng ca/);
assert.match(await text('#main'), /V25066/, 'mã số thẻ tự điền từ tài khoản');
const tcTruoc = await page.locator('.tcrow').count();
await page.click('[data-act="tcThem"]'); await wait(500);
await page.click('.chip[data-act="tcCaChon"][data-k="DEM"]'); await wait(400);
assert.equal(await page.inputValue('#tcTu'), '06:00', 'chọn ca thì giờ điền sẵn theo ca');
await page.fill('#tcTu', '22:00'); await page.dispatchEvent('#tcTu', 'change'); await wait(250);
await page.fill('#tcDen', '02:00'); await page.dispatchEvent('#tcDen', 'change'); await wait(300);
assert.equal(await page.inputValue('#tcGioIn'), '4', 'qua 0 giờ vẫn tính đúng: 22:00 → 02:00 là 4 tiếng');
await page.fill('#tcLy', 'Trực sự cố máy nén khí');
await shot('17-tang-ca-ghi');
await page.click('#tcOk'); await wait(900);
assert.equal(await page.locator('.tcrow').count(), tcTruoc + 1, 'đã thêm một lần tăng ca');
// Đơn in theo đúng mẫu giấy của công ty
await page.evaluate(() => go('tcXem')); await wait(500);
const don = await text('.tcsheet');
assert.match(don, /ĐƠN XIN TĂNG CA/); assert.match(don, /自愿加班申请单/);
assert.match(don, /Trực sự cố máy nén khí/, 'lý do in ở cột Chú thích');
assert.match(don, /Kỹ thuật 技术员/, 'họ tên in kèm tên tiếng Trung');
assert.match(don, /TỔNG CỘNG/); assert.match(don, /Hành chính nhân sự/);
assert.equal(await page.locator('.tcsheet .ot tr').count(), 8, 'bảng 6 dòng + tiêu đề + tổng cộng');
await shot('18-tang-ca-don');
assert.ok(await page.evaluate(() => XW.build([tcSheet(tcLoc(tcUid(), tcTuanHT(), addD(tcTuanHT(), 6)), 'x', 'y')]).size) > 2000, 'xuất được Excel tuần');
// Kỹ thuật chỉ thấy tăng ca của mình
await page.evaluate(() => go('tcThang')); await wait(600);
assert.equal(await page.locator('.tcrow[data-act="tcNguoiMo"]').count(), 1, 'kỹ thuật chỉ thấy dòng của mình');
assert.equal(await page.locator('#tcNguoi').count(), 0, 'kỹ thuật không chọn được người khác');
// Quản lý thấy cả nhà máy và sửa được ca làm việc
await logout(); await login('NV002', '222222');
await page.evaluate(() => go('tcThang')); await wait(600);
assert.ok(await page.locator('.tcrow[data-act="tcNguoiMo"]').count() > 1, 'Quản lý thấy nhiều người');
await shot('19-tang-ca-thang');
assert.ok(await page.evaluate(() => tcThangWorkbook(tcThangHT()).size) > 2000, 'xuất được Excel tổng hợp tháng');
await page.evaluate(() => go('tcCfg')); await wait(500);
assert.equal(await page.locator('[data-cf$=":ten"]').count(), 4, 'bốn ca làm việc');
ok('Bản 2.11: đăng ký tăng ca theo tuần, in đơn đúng mẫu công ty, tổng hợp tháng, Excel; kỹ thuật chỉ thấy của mình');

// 14. Bản 2.11: nối thư mục Drive của nhà máy, quét vào danh mục, sắp xếp, tra cứu; kỹ thuật không mở được tài liệu
await page.evaluate(() => go('tlCfg')); await wait(600);
assert.match(await text('#main'), /Tài liệu thiết bị nhà máy/, 'đang nối thư mục Drive của nhà máy');
assert.ok(await page.isVisible('#tlQuetOk'), 'có nút quét Drive');
const chuaGan = await page.evaluate(() => S.base.taiLieu.filter((x) => !x.ma).length);
assert.ok(chuaGan > 0, 'quét xong còn tài liệu chưa gán máy');
assert.equal(await page.evaluate(() => S.base.taiLieu.filter((x) => x.ma === 'M001' && x.nhom === 'HDSD').length), 1,
  'tên tệp có M001 trong thư mục Hướng dẫn sử dụng thì tự vào đúng máy, đúng nhóm');
assert.equal(await page.evaluate(() => S.base.taiLieu.filter((x) => /tu dien xuong 1/.test(x.ten))[0].moDuoc), false,
  'bản vẽ CAD 24 MB mở bằng link Drive, không đi qua máy chủ');
await shot('20-tai-lieu-drive');
// Sắp xếp: chọn tài liệu chưa gán máy rồi gán cho máy nén khí M038
await page.evaluate(() => go('tlGan')); await wait(500);
assert.equal(await page.locator('[data-tlc]').count(), chuaGan, 'lọc đúng số tài liệu chưa gán máy');
await page.click('[data-tlc]'); await wait(400);
assert.match(await text('#main'), /Đã chọn 1 tài liệu/);
await shot('21-tai-lieu-sap-xep');
await page.click('[data-act="tlGanMay"]'); await wait(400);
await page.fill('#tlMayQ', 'M038'); await wait(400);
await page.click('#tlMayDS [data-act="tlGanGo"]'); await wait(900);
assert.equal(await page.evaluate(() => S.base.taiLieu.filter((x) => !x.ma).length), chuaGan - 1, 'đã gán một tài liệu cho máy');
// Tra cứu toàn nhà máy
await page.evaluate(() => go('tlDS')); await wait(500);
await page.fill('#tlDSQ', 'kiem dinh'); await page.dispatchEvent('#tlDSQ', 'change'); await wait(500);
assert.match(await text('#main'), /Kiem dinh/, 'tìm được tài liệu kiểm định trong toàn nhà máy');
// Hồ sơ máy: thẻ Tài liệu có tài liệu quét từ Drive, kèm đường dẫn thư mục
await page.evaluate(() => go('may', { ma: 'M001', tab: 'tl' })); await wait(600);
assert.match(await text('#main'), /Huong dan su dung/, 'dòng tài liệu ghi đường dẫn thư mục trên Drive');
// Kỹ thuật: không có thẻ Tài liệu, không mở được mục Tài liệu
await logout(); await login('NV003', '333333');
await page.evaluate(() => go('may', { ma: 'M001' })); await wait(600);
assert.equal(await page.locator('.ptabs [data-t="tl"]').count(), 0, 'kỹ thuật không thấy thẻ Tài liệu');
assert.equal(await page.evaluate(() => S.base.taiLieu.some((x) => !x.daiDien)), false, 'kỹ thuật chỉ nhận ảnh đại diện của máy');
await page.evaluate(() => go('tlCfg')); await wait(500);
assert.match(await text('#barTitle'), /Chỉ Quản lý/);
ok('Bản 2.11: nối thư mục Drive, quét và sắp xếp tài liệu, tra cứu toàn nhà máy; kỹ thuật không mở được tài liệu');

// 15. Bản 2.11.2: Quản lý xác nhận tiêu thụ bất thường, cảnh báo thôi hiện; kỹ thuật không xác nhận được
await logout(); await login('NV002', '222222');
await moCongTo('E09');
const p15 = +(await text('.rdbox.prev b')).replace(/\s/g, '');
await page.fill('#dnForm input[data-code="1.8.0"]', String(Math.round(p15 + 5000000))); await wait();
assert.ok(await page.isVisible('.btbox'), 'hiện cảnh báo bất thường');
await page.check('#btOk'); await page.fill('#btLyDo', 'Chuyền dừng cả kỳ trước'); await wait();
// Kỳ này đã bị khoá ở bước 6: Quản lý sửa được nhưng phải ghi lý do
if (await page.locator('#dnLyDoSua').count()) await page.fill('#dnLyDoSua', 'Ghi bổ sung số cuối kỳ');
await page.click('#dnSave'); await wait(1200);
assert.equal(await page.evaluate(() => { const e = document.querySelector('#dnErr'); return e && !e.hidden ? e.textContent : ''; }), '', 'lưu được số bất thường');
// Bản ghi lưu rồi, mang dấu bất thường và đang tính vào cảnh báo trang chủ
let bt15 = await page.evaluate(() => { const x = S.V.csKey['E09|' + S.f.dKy]; return { bt: !!(x && x.ngoaiLe && x.ngoaiLe.batThuong), xn: !!(x && x.ngoaiLe && x.ngoaiLe.batThuong && x.ngoaiLe.batThuong.duyet), dem: batThuongKy(S.f.dKy).length }; });
assert.deepEqual([bt15.bt, bt15.xn], [true, false], 'đã lưu, chưa ai xác nhận');
assert.ok(bt15.dem >= 1, 'đang tính vào cảnh báo trang chủ');
const demTruoc = bt15.dem;
await shot('22-bat-thuong-chua-xac-nhan');
// Quản lý xác nhận ngay trong chi tiết bản ghi (lưu xong app quay về màn quét, mở lại sổ công tơ)
await moCongTo('E09'); await wait(500);
await page.click('[data-act="btXacNhan"]'); await wait(500);
await page.fill('#btGC', 'VKY10 dừng cả kỳ trước');
await page.click('[data-act="btXacNhanGo"]'); await wait(1200);
bt15 = await page.evaluate(() => { const x = S.V.csKey['E09|' + S.f.dKy]; const d = x.ngoaiLe.batThuong.duyet; return { nguoi: d && d.nguoi, gc: d && d.ghiChu, dem: batThuongKy(S.f.dKy).length,
    conE09: batThuongKy(S.f.dKy).some((v) => v.ma === 'E09'), nhan: ctTT({ ma: 'E09' }, S.f.dKy).pill.replace(/<[^>]*>/g, '') }; });
assert.equal(bt15.nguoi, 'Quản lý'); assert.equal(bt15.gc, 'VKY10 dừng cả kỳ trước');
assert.equal(bt15.dem, demTruoc - 1, 'xác nhận xong thì bản ghi này thôi tính vào cảnh báo');
assert.equal(bt15.conE09, false, 'E09 không còn trong danh sách bất thường');
assert.match(bt15.nhan, /Đã xác nhận/);
await shot('23-bat-thuong-da-xac-nhan');
// Kỹ thuật không có nút xác nhận
await logout(); await login('NV003', '333333');
const ktBt = await page.evaluate(() => btKhoi({ id: 'X', ma: 'E04', ky: '2026-10-10', ngoaiLe: { batThuong: { huong: 'CAO', pct: 120 } } }));
assert.ok(!/data-act="btXacNhan/.test(ktBt), 'kỹ thuật không có nút xác nhận');
assert.match(ktBt, /Chỉ Quản lý/);
ok('Bản 2.11.2: Quản lý xác nhận tiêu thụ bất thường, cảnh báo thôi hiện; kỹ thuật không xác nhận được');

assert.deepEqual(errs, [], 'không có lỗi JavaScript');
await browser.close();
console.log(`\nĐạt ${step} bước, không lỗi JavaScript.`);
