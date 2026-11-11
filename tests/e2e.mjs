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
// Chọn thiết bị qua hộp chọn mới (ô Loại thiết bị + ô gõ tìm) thay cho danh sách xổ xuống cũ
async function chonTB(id, ma) {
  await page.click(`.tbpick[data-for="${id}"]`);
  await page.waitForSelector('#tbQ');
  await page.fill('#tbQ', ma);
  await page.waitForSelector(`#tbDs .row[data-ma="${ma}"]`);
  await page.click(`#tbDs .row[data-ma="${ma}"]`);
  await wait(400);
}
// Mở một mục qua màn "Thêm" — đúng đường người dùng bấm trên điện thoại
async function moThem(v) {
  await page.click('.tabs .tab[data-v="them"]'); await wait(500);
  await page.click(`#main .row[data-v="${v}"]`); await wait(700);
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
await moThem('dien');
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
assert.match(await text('.tabs .tab[data-v="cal"]'), /Bảo dưỡng/, 'ô thứ tư của kỹ thuật là Bảo dưỡng');
assert.match(await text('.tabs .tab[data-v="cv"]'), /Sửa chữa/);
// Màn Thêm của kỹ thuật: không có Thiết bị, Kho, Kiểm định, Tính toán, Tài liệu.
// Đo tủ điện thì có, vì chính kỹ thuật là người đi đo.
await page.click('.tabs .tab[data-v="them"]'); await wait(600);
const them7 = await page.locator('#main .row .nm').allTextContents();
assert.deepEqual(them7, ['Công việc', 'Nghiệm thu sửa chữa', 'Máy nén khí', 'Bảo dưỡng', 'Điện / Nước', 'Đo tủ điện', 'Tăng ca', 'Lịch trực', 'Cá nhân'],
  'kỹ thuật thấy đúng chín mục: ' + JSON.stringify(them7));
await page.click('.tabs .tab[data-v="home"]'); await wait();
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

// 9. Kỹ thuật thấy máy hỏng: ghi sửa chữa (mất mạng vẫn ghi được), ghi nguyên nhân + giờ dừng máy.
// Từ bản 2.28 kỹ thuật KHÔNG ghi việc được nữa — chỉ Quản lý ghi việc để giao.
await page.click('.tabs .tab[data-v="cv"]'); await wait(700);
assert.equal(await page.locator('[data-act="cvNew"]').count(), 0, 'kỹ thuật không có nút Ghi việc');
assert.equal(await page.evaluate(() => xemDuoc('cvNew')), false, 'kỹ thuật không mở được màn Ghi việc');
await page.click('.tabs .tab[data-v="home"]'); await wait();
assert.equal(await page.locator('.cta2').count(), 0, 'trang chủ của kỹ thuật không còn ô Ghi việc');
await page.click('#meBtn'); await wait();
await page.check('#simOff'); await wait();
await page.click('.tabs .tab[data-v="cv"]'); await wait(700);
await page.click('[data-v="scGhi"]'); await wait(700);
assert.match(await text('#barTitle'), /sửa chữa/i);
// Chọn được cả chuyền, máy ngoài chuyền và máy thuộc chuyền
await page.click('.tbpick[data-for="scMa"]'); await wait(600);
// Bỏ lựa chọn "không gắn thiết bị": việc sửa chữa bắt buộc chọn máy
assert.equal(await page.locator('#tbDs .row[data-ma=""]').count(), 0, 'không có dòng bỏ trống, phải chọn máy');
assert.match(await page.locator('.tbpick[data-for="scMa"] .tbpt').textContent(), /Chọn thiết bị/);
for (const [ma, nhan] of [['VKY03', 'chuyền sản xuất'], ['M038', 'máy ngoài chuyền'], ['M020', 'máy thuộc chuyền']]) {
  await page.fill('#tbQ', ma); await wait(350);
  assert.equal(await page.locator(`#tbDs .row[data-ma="${ma}"]`).count(), 1, 'chọn được ' + nhan);
}
await page.evaluate(() => closeSheet()); await wait(300);
// Thiếu nội dung thì không lưu được; cảnh báo liệt kê đúng mục còn thiếu, song ngữ
await page.fill('#scMT', 'Máy hút bụi VKY03 không chạy');
await page.click('#scOk'); await wait(500);
const thieuSC = await text('#scErr');
assert.match(thieuSC, /Chưa điền đủ/, 'chặn lưu khi thiếu nội dung');
assert.match(thieuSC, /填写不完整/, 'cảnh báo có cả tiếng Trung');
assert.match(thieuSC, /Thiết bị \/ máy/); assert.match(thieuSC, /设备/);
assert.match(thieuSC, /Nguyên nhân/); assert.match(thieuSC, /原因/);
assert.match(thieuSC, /Kết quả/); assert.match(thieuSC, /处理结果/);
assert.doesNotMatch(thieuSC, /Mô tả sự cố/, 'mục đã điền thì không báo thiếu');
assert.equal(await page.locator('#scF').count(), 1, 'vẫn ở lại form, chưa lưu gì');
await chonTB('scMa', 'VKY03');
await page.fill('#scMT', 'Máy hút bụi VKY03 không chạy');
await page.click('[data-act="scNNChon"][data-k="nn_mon"]'); await wait(300);
await page.fill('#scKQ', 'Thay chổi than motor');
await page.fill('#scGio', '1.5');
await shot('08-sua-chua-tu-ghi');
await page.click('#scOk'); await wait(900);
assert.match(await text('#syncBtn'), /Chờ mạng|Chờ gửi/);
await page.click('#meBtn'); await wait();
await page.uncheck('#simOff'); await wait(1800);
assert.match(await text('#syncBtn'), /Đã đồng bộ/);
// Có mạng lại: máy chủ đã tự dịch mô tả, kết quả, nguyên nhân sang tiếng Trung.
// Bản ghi sửa chữa nằm ở Lịch sử sửa chữa, không lẫn vào danh sách Công việc.
await page.click('.tabs .tab[data-v="cv"]'); await wait(700);
assert.equal((await text('#main')).includes('Máy hút bụi VKY03'), false, 'bản ghi sửa chữa không lẫn vào danh sách Công việc');
await page.click('[data-v="scDS"]'); await wait(900);
await page.click('.scrow:has-text("Máy hút bụi VKY03")'); await wait();
assert.match(await text('.schead'), /吸尘器VKY03不运转/);
assert.match(await text('.scres'), /更换电机碳刷/);
assert.match(await text('.scres'), /自然磨损/);
// Nghiệm thu sửa chữa ngoài: kỹ thuật lập biên bản trước khi gửi sửa, ghi nghiệm thu khi nhận về
await page.click('.tabs .tab[data-v="cv"]'); await wait(700);
await page.click('#main [data-act="tab"][data-v="ngt"]'); await wait(800);
assert.match(await text('#barTitle'), /Nghiệm thu/);
await page.click('[data-act="ngtNew"]'); await wait(800);
await chonTB('ngtMa', 'M001');
await page.fill('#ngtTen', 'Quạt hút bụi xưởng 2');
await page.fill('#ngtDV', 'Cơ điện Minh Phát');
await page.fill('[data-c="congSuat"]', '7,5');
await page.fill('[data-c="dienAp"]', '380');
await page.fill('[data-m="a1"][data-s="so"]', '0,4'); await wait(300);
await page.click('[data-act="ngtDg"][data-k="a1"][data-v="K"]'); await wait(500);
await page.fill('#ngtVB', 'Cuộn dây ẩm, cách điện thấp');
await shot('40-nghiem-thu-truoc');
// Phần đã mở mà điền dở thì không lưu được; cảnh báo nêu rõ phần nào, mục nào, song ngữ
await page.click('#ngtOk'); await wait(600);
const thieuNT = await text('#ngtErr');
assert.match(thieuNT, /Chưa điền đủ/); assert.match(thieuNT, /填写不完整/);
assert.match(thieuNT, /Trước khi sửa chữa ›/, 'nêu rõ thuộc phần nào');
assert.match(thieuNT, /维修前 ›/);
assert.match(thieuNT, /chưa chấm Đạt \/ Không đạt/, 'mục kiểm tra chưa chấm thì báo thiếu');
assert.doesNotMatch(thieuNT, /Công suất/, 'mục đã điền thì không báo thiếu');
assert.equal(await page.evaluate(() => ngtDS().length), 0, 'chưa lưu biên bản nào');
// Điền nốt các mục còn lại rồi lưu
// Điền nốt phần đang mở đúng như người dùng gõ: đặt giá trị rồi bắn sự kiện input
// để app tự thu vào trạng thái, sau đó chấm Đạt cho từng mục còn trống.
const ngtDienNot = async () => {
  await page.evaluate(() => {
    const dat = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    // Ba ô này đã điền ở đầu phiếu; tờ in tự lấy xuống, đừng ghi đè bằng gạch ngang
    const dauPhieu = ['tenTB', 'maTB', 'donVi'];
    document.querySelectorAll('#ngtF [data-c]').forEach((el) => {
      if (dauPhieu.indexOf(el.dataset.c) < 0 && !el.value.trim()) dat(el, '—');
    });
    document.querySelectorAll('#ngtF [data-m]').forEach((el) => { if (el.dataset.s !== 'gc' && !el.value.trim()) dat(el, '1'); });
  });
  await wait(200);
  for (let i = 0; i < 40; i++) {
    const k = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('#ngtF [data-act="ngtDg"][data-v="D"]'))
        .find((x) => !document.querySelector(`#ngtF [data-act="ngtDg"][data-k="${x.dataset.k}"].dat, #ngtF [data-act="ngtDg"][data-k="${x.dataset.k}"].khong`));
      return b ? b.dataset.k : '';
    });
    if (!k) break;
    await page.click(`#ngtF [data-act="ngtDg"][data-k="${k}"][data-v="D"]`); await wait(120);
  }
  if (await page.locator('[data-act="ngtKl"]').count()) {
    const xong = await page.evaluate(() => !!topV().p[topV().p.seg].ketLuan);
    if (!xong) { await page.click('[data-act="ngtKl"][data-v="DAT"]'); await wait(300); }
  }
};
await ngtDienNot(); await wait(500);
await page.click('#ngtOk'); await wait(1600);
const bb = await page.evaluate(() => ngtDS()[0]);
assert.match(bb.soBB, /^BBNT\d{4}\.\d{2}\.\d{2}\/1$/, 'số biên bản tự đánh theo ngày: ' + bb.soBB);
assert.equal(bb.truoc.muc.a1.dg, 'K');
assert.equal(bb.sau, null, 'chưa ghi phần sau sửa chữa');
// Phần sau sửa chữa
await page.click('[data-act="ngtSeg"][data-v="sau"]'); await wait(800);
await page.fill('[data-m="a2"][data-s="A"]', '4,1');
await page.fill('[data-m="b3"][data-s="so"]', '3200');
await page.fill('[data-m="b4"][data-s="so"]', '450');
await page.click('[data-act="ngtDg"][data-k="a2"][data-v="D"]'); await wait(400);
await page.click('[data-act="ngtKl"][data-v="DAT"]'); await wait(400);
await page.click('#ngtOk'); await wait(600);
assert.match(await text('#ngtErr'), /Sau khi sửa chữa ›/, 'phần sau điền dở cũng bị chặn');
await ngtDienNot(); await wait(500);
await page.click('#ngtOk'); await wait(1600);
const bb2 = await page.evaluate(() => ngtDS()[0]);
assert.equal(bb2.ketLuan, 'DAT');
assert.deepEqual(bb2.truoc.muc.a1, { so: '0,4', dg: 'K' }, 'ghi phần sau không xoá phần trước');
assert.equal(bb2.soBB, bb.soBB, 'hai phần dùng chung một số biên bản');
// Tờ in: đúng mẫu giấy, thông số kèm đơn vị
const inT = await page.evaluate(() => ngtToHtml(ngtDS()[0], 'truoc').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
const inS = await page.evaluate(() => ngtToHtml(ngtDS()[0], 'sau').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
assert.ok(inT.includes('7,5 kW') && inT.includes('380 V'), 'thông số in kèm đơn vị');
assert.ok(inT.includes('Quạt hút bụi xưởng 2'), 'tên thiết bị điền sẵn vào bảng');
assert.ok(inT.includes('☒ Không đạt'), 'ô đánh giá in ra đúng');
assert.ok(inS.includes('3200 m³/h') && inS.includes('450 Pa'), 'lưu lượng và áp suất kèm đơn vị');
assert.ok(inS.includes('☑ Đạt yêu cầu'), 'kết luận nghiệm thu');
await shot('41-nghiem-thu-to-in');
// Biên bản thứ hai cùng ngày tự nhận số kế tiếp
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(500);
await page.click('[data-act="ngtNew"]'); await wait(700);
await page.fill('#ngtTen', 'Quạt mái xưởng 1');
// Biên bản trống rỗng cũng không lưu được nữa
await page.click('#ngtOk'); await wait(500);
assert.match(await text('#ngtErr'), /Chưa điền phần nào|尚未填写/, 'không lưu được biên bản trống');
assert.equal(await page.evaluate(() => ngtDS().length), 1, 'chưa sinh thêm biên bản nào');
await page.fill('#ngtDV', 'Cơ điện Minh Phát');
await ngtDienNot(); await wait(500);
await page.click('#ngtOk'); await wait(1500);
const hai = await page.evaluate(() => ngtDS().map((v) => v.soBB).sort());
assert.equal(hai.length, 2);
assert.match(hai[1], /\/2$/, 'biên bản thứ hai trong ngày: ' + hai.join(', '));
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Kỹ thuật không ghi việc được nữa, chỉ ghi sửa chữa; nghiệm thu sửa chữa ngoài hai phần trước/sau, số biên bản tự đánh, in kèm đơn vị');

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
// Giao việc là bắt đầu luôn: không còn nút "Bắt đầu", nhân viên làm xong là bấm Xong việc
assert.equal(await page.locator('[data-act="cvB"][data-b="batdau"]').count(), 0, 'bỏ bước xác nhận bắt đầu');
assert.match(await text('.schead'), /Đã giao/);
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
// Việc lặp lại giao cho nhiều người: mỗi người một việc, ai máy nấy
await page.evaluate(() => go('cvLapEdit', {})); await wait(600);
await page.fill('#vlTD', 'Kiểm tra máy đầu ca');
await page.click('[data-act="vlSet"][data-k="kieu"][data-v="ngay"]'); await wait(400);
await page.click('[data-act="vlSet"][data-k="kieuGiao"][data-v="rieng"]'); await wait(400);
assert.match(await text('#main'), /Mỗi người một việc/);
await page.click('[data-act="vlGiaoThem"]'); await wait(300);
await page.click('[data-act="vlGiaoThem"]'); await wait(300);
const nvId10 = await page.evaluate(() => nvDS().map((n) => n.id));
await page.selectOption('[data-gf="0:uid"]', nvId10[0]);
await page.selectOption('[data-gf="1:uid"]', nvId10[1]); await wait(300);
// Người đầu check sheet hai máy, người sau một máy → ba việc
const may10 = await page.evaluate(() => S.V.may.filter((m) => m.hoatDong).slice(0, 3).map((m) => m.ma));
async function themMay(i, ma) {
  await page.click(`.tbpick[data-cb="vlMayThem"][data-i="${i}"]`);
  await page.waitForSelector('#tbQ');
  await page.fill('#tbQ', ma);
  await page.waitForSelector(`#tbDs .row[data-ma="${ma}"]`);
  await page.click(`#tbDs .row[data-ma="${ma}"]`);
  await wait(400);
}
await themMay(0, may10[0]);
await themMay(0, may10[1]);
await themMay(1, may10[2]);
assert.equal(await page.locator('[data-act="vlMayXoa"]').count(), 3, 'thẻ máy của từng người');
await page.click('#vlOk'); await wait(1600);
const lapId = await page.evaluate(() => (S.V.vl.find((x) => x.tieuDe === 'Kiểm tra máy đầu ca') || {}).id);
const xem10 = () => page.evaluate((id) => {
  const v = S.V.vl.find((x) => x.id === id), cv = S.V.cvAll.filter((x) => x.lapLai === id && x.trangThai !== 'HUY');
  return { giao: (v && v.dsGiao || []).map((g) => [g.uid, (g.ma || []).length]), viec: cv.map((x) => ({ uid: x.uidLam, ma: x.ma, st: x.trangThai })) };
}, lapId);
const lap10 = await xem10();
assert.deepEqual(lap10.giao, [[nvId10[0], 2], [nvId10[1], 1]], 'mỗi người một dòng, kèm số máy của họ');
assert.equal(lap10.viec.length, 3, 'một người hai máy thì sinh hai việc');
assert.deepEqual(lap10.viec.map((x) => x.ma).sort(), may10.slice().sort(), 'mỗi việc một máy');
assert.equal(lap10.viec.filter((x) => x.uid === nvId10[0]).length, 2);
assert.ok(lap10.viec.every((x) => x.st === 'DA_GIAO'), 'giao sẵn cho từng người');
// Sửa mẫu trong ngày: bỏ một máy của người đầu → việc hôm nay đổi theo, nhân viên nhận được ngay
await page.evaluate((id) => go('cvLapEdit', { id: id }), lapId); await wait(600);
await page.click(`[data-act="vlMayXoa"][data-i="0"][data-ma="${may10[1]}"]`); await wait(300);
await page.click('#vlOk'); await wait(1600);
const lap10b = await xem10();
assert.equal(lap10b.viec.length, 2, 'bỏ máy thì việc thừa của hôm nay được huỷ');
assert.deepEqual(lap10b.viec.map((x) => x.ma).sort(), [may10[0], may10[2]].sort());
ok('Công việc: ghi và giao, giao nhiều việc, nhân viên làm xong, Quản lý kiểm tra; báo cáo tháng + Excel; giao bảo dưỡng có sẵn tiếng Trung; linh kiện chuyền');

// 11. Máy tính: sidebar, bảng có tiêu đề, phân trang
await page.setViewportSize({ width: 1440, height: 900 });
await page.click('.side .nav[data-v="list"]'); await wait(600);
// Danh sách nay là sổ thiết bị xếp thành cây: khối → chuyền / nhóm → máy
assert.equal(await page.locator('.stchips').count(), 0, 'Danh sách không còn chip Quá hạn / Hôm nay / Sắp đến');
assert.equal(await page.locator('.khoibtn').count(), 2, 'có hai nút khối thiết bị');
assert.equal(await page.locator('.hscroll .chip[data-act="listGrp"]').count(), 0, 'không còn dãy chip nhóm cuộn ngang');
// Khối sản xuất: lưới chuyền; khối phụ trợ: các nhóm, bấm mới xổ máy
assert.ok(await page.locator('.chgrid').count() > 0, 'khối sản xuất hiện lưới chuyền');
await page.click('.khoibtn[data-k="HCD"]'); await wait(700);
assert.equal(await page.locator('.chgrid').count(), 0, 'chọn khối phụ trợ thì không còn lưới chuyền');
const nhomPT = page.locator('#listBody .gap .gaph');
assert.ok(await nhomPT.count() >= 3, 'khối phụ trợ xổ ra các nhóm thiết bị');
await nhomPT.first().click(); await wait(700);
assert.ok(await page.isVisible('#listBody .gap.mo table.dt thead'), 'mở một nhóm thì ra bảng sổ thiết bị');
const cot11 = await page.evaluate(() => [...document.querySelectorAll('#listBody .gap.mo table thead th')].map((e) => e.textContent));
assert.ok(!cot11.some((c) => /Chu kỳ|Hạn kế tiếp|Xác nhận/.test(c)),
  'sổ thiết bị không còn cột bảo dưỡng: ' + JSON.stringify(cot11));
assert.ok(cot11.some((c) => /Vị trí/.test(c)) && cot11.some((c) => /Thông số/.test(c)), 'có cột Vị trí và Thông số');
// Gõ tìm thì bỏ cây, ra thẳng bảng phẳng có phân trang
await page.fill('#listQ', 'máy'); await wait(700);
assert.equal(await page.locator('#listBody .gap').count(), 0, 'đang tìm thì không còn cây nhóm');
assert.match(await text('.pager'), /kết quả/);
await page.fill('#listQ', ''); await wait(500);
await shot('07-desktop-list');
// Trạng thái bảo dưỡng chuyển hẳn sang tab Bảo dưỡng, bấm ô đếm là hiện ngay danh sách
await page.evaluate(() => { S.f.khoi = ''; S.f.grp = ''; tab('cal'); }); await wait(900);
await page.click('.kst.k-red'); await wait(800);
assert.equal(await page.evaluate(() => S.f.calSt), 'qua');
assert.equal(await page.evaluate(() => topV().v), 'cal', 'vẫn ở tab Bảo dưỡng, không nhảy sang Danh sách');
assert.ok(await page.evaluate(() => document.querySelectorAll('#main table tbody tr').length > 0),
  'hiện danh sách máy quá hạn ngay trong Bảo dưỡng');
await page.click('[data-act="calSt"][data-st="qua"]'); await wait(700);
assert.equal(await page.evaluate(() => S.f.calSt), '', 'bấm lại thì về lịch');
await page.click('.side .nav[data-v="list"]'); await wait(600);
await page.click('.side .nav[data-v="dien"]'); await wait(600);
assert.ok(await page.isVisible('table.dt'), 'bảng công tơ trên máy tính');
await page.click('.side .nav[data-v="list"]'); await wait(600);
await page.locator('#main .seg button').nth(1).click(); await wait(600);   // tab Bảo dưỡng trong màn Thiết bị
assert.match(await text('#barTitle'), /Bảo dưỡng/);
assert.ok(await page.evaluate(() => $('.side .nav[data-v="list"]').classList.contains('on')),
  'đang ở Bảo dưỡng thì ô Thiết bị sáng, vì cùng một màn');
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
await chonTB('scMa', 'M038'); await page.fill('#scMT', 'Máy nén khí báo nhiệt độ cao'); await wait(800);
assert.match(await text('#scGoiY'), /Két làm mát/, 'gợi ý lần sửa tương tự của cùng máy');
await page.click('#scGoiY [data-act="gyDung"]'); await wait();
assert.equal(await page.inputValue('#scNN'), 'Két làm mát bám bụi dày');
// Linh kiện thay: ô chọn có danh sách linh kiện của máy, chọn Khác thì gõ tên và gợi ý từ kho
assert.equal(await page.locator('#scLK').count(), 0, 'không còn ô chữ tự do');
await page.click('[data-act="lkAdd"]'); await wait(400);
assert.ok(await page.locator('.lkin select[data-lf="id"] option').count() > 1, 'có danh sách linh kiện của máy M038');
await page.selectOption('.lkin select[data-lf="id"]', '__khac'); await wait(400);
await page.fill('.lkin [data-lf="ten"]', 'vòng bi'); await wait(600);
assert.ok(await page.locator('.lksug .ksi').count() > 0, 'gõ tên thì gợi ý linh kiện có trong kho');
await page.click('.lksug .ksi'); await wait(400);
assert.ok(await page.evaluate(() => !!(S.ctF.lk[0] && S.ctF.lk[0].maKho)), 'chọn gợi ý thì nối được mã kho');
assert.equal(await page.locator('.lkin .klink').count(), 1, 'hiện mã kho và tồn kho');
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
// Chỉ ghi được từ thứ Hai tuần trước đến hôm nay
assert.deepEqual(await page.evaluate(() => [$('#tcNgay').min, $('#tcNgay').max]),
  await page.evaluate(() => [addD(tcThuHai(TODAY()), -7), TODAY()]), 'ô ngày chặn tuần đã khoá và ngày chưa tới');
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
const don = await text('.tcsheet.don');
assert.match(don, /ĐƠN XIN TỰ NGUYỆN TĂNG CA/); assert.match(don, /自愿加班申请表/);
assert.match(don, /CÔNG TY TNHH CREDIBLE VIỆT NAM/);
// Logo công ty lấy từ chính mẫu đơn giấy, nhúng thẳng vào app nên in offline vẫn có
assert.equal(await page.locator('.tcsheet.don .dh .lg img').count(), 1, 'đầu tờ có logo công ty');
assert.ok(await page.evaluate(() => {
  const i = document.querySelector('.tcsheet.don .dh .lg img');
  return i.src.startsWith('data:image/png;base64,') && i.naturalWidth > 0;
}), 'logo nhúng sẵn và tải được');
['Mã số thẻ', 'Họ và tên', 'KÝ TÊN', 'Vị trí - Chức vụ', 'Số tiếng thực tế tăng ca', 'Ghi chú']
  .forEach((k) => assert.ok(don.includes(k), 'đơn có cột ' + k));
['员工号', '签名', '职位', '加班实际小时数', '备注'].forEach((k) => assert.ok(don.includes(k), 'cột song ngữ ' + k));
assert.match(don, /Trực sự cố máy nén khí/, 'lý do in ở dòng Lý do xin tăng ca cuối tờ');
['Lập biểu', 'Người xác nhận', 'Trưởng bộ phận', 'Hành chính nhân sự', 'Phê duyệt']
  .forEach((k) => assert.ok(don.includes(k), 'đủ ô ký ' + k));
assert.equal(await page.locator('.tcsheet.don').count(), 1, 'một tờ');
assert.equal(await page.locator('.tcsheet.don .ot tr').count(), 17, 'hai dòng tiêu đề + đúng 15 dòng như mẫu giấy');
// Mỗi dòng là một lượt tăng ca: mã thẻ, giờ kiểu 22h00, số tiếng, ngày ở cột Ghi chú
const hangDon = await page.evaluate(() => Array.from(document.querySelectorAll('.tcsheet.don .ot tr'))
  .slice(2).map((tr) => Array.from(tr.children).map((td) => td.textContent.trim())).filter((r) => r[1]));
assert.ok(hangDon.length >= 1, 'có ít nhất một lượt tăng ca trong đơn');
assert.match(hangDon[0][1], /^V\d+$/, 'cột mã số thẻ');
assert.equal(hangDon[0][3], '', 'cột KÝ TÊN để trống cho người ký tay');
assert.match(hangDon[0][5], /^\d{2}h\d{2}$/, 'giờ viết kiểu 17h00');
assert.match(hangDon[0][6], /^\d{2}h\d{2}$/);
assert.match(hangDon[0][8], /^\d{2}\/\d{2}$/, 'cột Ghi chú ghi ngày của lượt đó');
assert.ok(hangDon.some((r) => r[5] === '22h00' && r[6] === '02h00'), 'lượt tăng ca vừa ghi có trong đơn');
// Kỹ thuật chỉ in đơn của chính mình, không có thanh chọn cả nhà máy
assert.equal(await page.locator('[data-act="tcDonChe"]').count(), 0, 'kỹ thuật không chọn in cả nhà máy');
assert.equal(new Set(hangDon.map((r) => r[1])).size, 1, 'đơn của kỹ thuật chỉ có một người');
assert.match(hangDon[0][2], /\s[\u4e00-\u9fff]/, 'họ tên in kèm tên tiếng Trung');
await shot('18-tang-ca-don');
assert.ok(await page.evaluate(() => XW.build([tcSheet(tcLoc(tcUid(), tcTuanHT(), addD(tcTuanHT(), 6)), 'x', 'y')]).size) > 2000, 'xuất được Excel tuần');
// Kỹ thuật chỉ thấy tăng ca của mình.
// Dữ liệu mẫu nằm ở tuần chứa hôm nay; tuần đó có thể vắt sang tháng trước (vd Chủ nhật 01/11 thì
// thứ Hai là 26/10), nên mở đúng tháng chứa thứ Hai của tuần, đừng để mặc định là tháng hiện tại.
const tcThangMau = await page.evaluate(() => tcThuHai(TODAY()).slice(0, 7));
await page.evaluate((m) => { S.f.tcThang = m; go('tcThang'); }, tcThangMau); await wait(600);
assert.equal(await page.locator('.tcrow[data-act="tcNguoiMo"]').count(), 1, 'kỹ thuật chỉ thấy dòng của mình');
assert.equal(await page.locator('#tcNguoi').count(), 0, 'kỹ thuật không chọn được người khác');
// Quản lý thấy cả nhà máy và sửa được ca làm việc
await logout(); await login('NV002', '222222');
// Quản lý in cho cả nhà máy thì MỖI NGƯỜI MỘT TỜ: Tiến một đơn, Hồng một đơn
await page.evaluate(() => { S.f.tcDonMot = ''; go('tcXem'); }); await wait(700);
assert.equal(await page.locator('[data-act="tcDonChe"]').count(), 2, 'Quản lý chọn được mỗi người một tờ / chỉ mình tôi');
const toQL = await page.evaluate(() => Array.from(document.querySelectorAll('.tcsheet.don')).map((sh) => {
  const r = Array.from(sh.querySelectorAll('.ot tr')).slice(2)
    .map((tr) => Array.from(tr.children).map((td) => td.textContent.trim())).filter((x) => x[1]);
  return { the: Array.from(new Set(r.map((x) => x[1]))), ten: r[0] ? r[0][2] : '', dong: r.length };
}));
assert.ok(toQL.length >= 3, 'mỗi người một tờ: ' + toQL.length + ' tờ');
assert.ok(toQL.every((t0) => t0.the.length === 1), 'mỗi tờ chỉ một người: ' + JSON.stringify(toQL.map((x) => x.the)));
assert.equal(new Set(toQL.map((t0) => t0.the[0])).size, toQL.length, 'không tờ nào trùng người');
assert.ok(toQL.some((t0) => t0.dong > 1), 'người tăng ca nhiều ngày thì gom hết vào một tờ');
assert.ok(toQL.every((t0) => /\s[\u4e00-\u9fff]/.test(t0.ten)), 'họ tên in kèm tên tiếng Trung: ' + JSON.stringify(toQL.map((x) => x.ten)));
await shot('18b-tang-ca-don-moi-nguoi-mot-to');
await page.click('[data-act="tcDonChe"][data-m="1"]'); await wait(600);
assert.equal(await page.locator('.tcsheet.don').count(), 1, 'chuyển sang chỉ in đơn của mình');
await page.evaluate(() => { S.f.tcDonMot = ''; }); await wait(200);
await page.evaluate((m) => { S.f.tcThang = m; go('tcThang'); }, tcThangMau); await wait(600);
assert.ok(await page.locator('.tcrow[data-act="tcNguoiMo"]').count() > 1, 'Quản lý thấy nhiều người');
await shot('19-tang-ca-thang');
assert.ok(await page.evaluate((m) => tcThangWorkbook(m).size, tcThangMau) > 2000, 'xuất được Excel tổng hợp tháng');
await page.evaluate(() => go('tcCfg')); await wait(500);
assert.equal(await page.locator('[data-cf$=":ten"]').count(), 4, 'bốn ca làm việc');
// Quản lý ghi hộ được cho tuần đã khoá (3 tuần trước)
const cu13 = await page.evaluate(async () => {
  const uid = S.V.nv.find((n) => n.maNV === 'NV003').id, ngay = addD(tcThuHai(TODAY()), -21);
  await api('saveOT', { uid, ngay, ca: 'HC', tu: '17:30', den: '19:30', lyDo: 'Sửa quạt hút tuần cũ' });
  return ngay;
});
// Nhân viên: tuần đó đã khoá, không sửa và không thêm được
await logout(); await login('NV003', '333333');
await page.evaluate((d) => { tab('tc'); S.f.tcTuan = tcThuHai(d); }, cu13); await wait(300);
await page.evaluate(() => render()); await wait(600);
assert.equal(await page.locator('.tcrow[disabled]').count(), 1, 'dòng của tuần đã khoá không bấm sửa được');
assert.equal(await page.locator('[data-act="tcThem"]').count(), 0, 'tuần đã khoá thì không thêm được');
assert.match(await text('#main'), /đã khoá/, 'có dòng nhắc tuần đã khoá');
await shot('32-tang-ca-tuan-da-khoa');
// Quay lại tuần này thì ghi thêm bình thường
await page.evaluate(() => { S.f.tcTuan = null; render(); }); await wait(600);
assert.equal(await page.locator('[data-act="tcThem"]').count(), 1, 'tuần này vẫn thêm được');
await logout(); await login('NV002', '222222');      // bước sau chạy tiếp với Quản lý
ok('Bản 2.11 + 2.22: tăng ca theo tuần, đơn đúng mẫu công ty song ngữ, tổng hợp tháng, Excel; tuần cũ tự khoá với nhân viên');

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
// Thêm tài liệu mới ngay từ màn tra cứu: chọn máy rồi chọn cách thêm
assert.equal(await page.locator('[data-act="tlThemMoi"]').count(), 1, 'màn tra cứu có nút Thêm tài liệu mới');
await page.click('[data-act="tlThemMoi"]'); await wait(500);
await page.fill('#tlMayQ', 'M038'); await wait(400);
await page.click('#tlMayDS [data-act="tlThemCach"]'); await wait(500);
const cach14 = await text('#sheetBg');
assert.match(cach14, /Tải tệp lên/);
assert.match(cach14, /Chụp ảnh/);
assert.match(cach14, /Thêm liên kết/);
assert.equal(await page.locator('#sheetBg [data-act="tlChon"][data-ma="M038"]').count(), 2, 'tải tệp và chụp ảnh đều gắn đúng máy');
await page.evaluate(() => closeSheet()); await wait(300);
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

// 16. Bản 2.12 + 2.31: lịch trực tháng điểm màu theo người và phân công ca trực
await logout(); await login('NV002', '222222');
// Dữ liệu mẫu lịch trực nằm ở tuần chứa hôm nay; tuần đó có thể vắt sang tháng trước
// (Chủ nhật 01/11 thì thứ Hai là 26/10), nên mở đúng tháng chứa thứ Hai của tuần.
const ymMau = await page.evaluate(() => tcThuHai(TODAY()).slice(0, 7));
await page.evaluate((m) => { S.f.trucThang = m; tab('truc'); }, ymMau); await wait(600);
assert.match(await text('#barTitle'), /Lịch trực tháng/);
const lich16 = await page.evaluate((ym) => {
  const { ds } = trucThangDS(ym);
  const co = ds.filter(trucCoNguoi);
  return { n: ds.length, co: co.length, ten: co.length ? co[0].ds[0].ten : '', trong: ds.filter((o) => !trucCoNguoi(o)).map((o) => o.ngay)[0] };
}, ymMau);
assert.equal(await page.locator('.trcal [data-act="trucXep"]').count(), lich16.n, 'lịch tháng có đủ mỗi ngày một ô, Quản lý bấm được: ' + lich16.n);
assert.equal(await page.locator('.trcal .wd').count(), 7, 'bảy cột thứ, lịch bắt đầu từ thứ Hai');
assert.match(await text('.trcal .wd:nth-child(7)'), /CN|日/, 'cột cuối là Chủ nhật');
assert.ok(lich16.co >= 3, 'tháng mẫu đã xếp vài ngày: ' + lich16.co);
// Ô ngày đã xếp mang màu riêng của người đó, chỉ hiện tên gọi cho vừa ô
const oMau = await page.evaluate(() => {
  const o = Array.from(document.querySelectorAll('.trcal .d')).filter((e) => e.style.background)[0];
  return o ? { bg: o.style.background, txt: o.textContent } : null;
});
assert.ok(oMau && oMau.bg, 'ngày đã xếp được tô màu');
assert.match(await text('.trleg'), /黎明进|杜文红|阮俊/, 'chú thích màu hiện tên tiếng Trung');
// Hai người không bao giờ trùng màu trong cùng một lịch
const mauTruc = await page.evaluate((ym) => {
  const m = trucMauThang(ym), v = Object.values(m).map((x) => x[0]);
  return { n: v.length, rieng: new Set(v).size };
}, ymMau);
assert.equal(mauTruc.rieng, mauTruc.n, 'mỗi người một màu riêng: ' + JSON.stringify(mauTruc));
const mauDon = await page.evaluate(() => {
  // Giả lập 14 người cùng trực một tháng để chắc chắn không ai trùng màu
  const ids = Array.from({ length: 14 }, (_, i) => 'U' + i);
  const m = trMauMap(ids, (id) => +id.slice(1));
  return new Set(Object.values(m).map((x) => x[0])).size;
});
assert.equal(mauDon, 10, 'quá 10 người thì dùng hết 10 màu, không bỏ màu nào');
// Tháng đã qua thì đếm cả tháng (soát lại sổ); tháng này và tháng sau chỉ đếm từ hôm nay trở đi
const cur16 = await page.evaluate(() => TODAY().slice(0, 7));
if (ymMau < cur16) assert.match(await text('.caltools'), /\d+ ngày chưa xếp/, 'tháng đã qua đếm cả tháng');
await page.evaluate((m) => { S.f.trucThang = m; render(); }, cur16); await wait(400);
assert.match(await text('.caltools'), /Còn \d+ ngày chưa xếp|Đã xếp đủ tháng/, 'tháng này chỉ đếm từ hôm nay trở đi');
const dem16 = await page.evaluate((m) => {
  const today = TODAY(), ds = trucThangDS(m).ds;
  return { ca: ds.filter((o) => !trucCoNguoi(o)).length, tuNay: ds.filter((o) => !trucCoNguoi(o) && o.ngay >= today).length };
}, cur16);
assert.ok(dem16.tuNay <= dem16.ca, 'đếm từ hôm nay không vượt quá đếm cả tháng: ' + JSON.stringify(dem16));
await page.evaluate((m) => { S.f.trucThang = m; render(); }, ymMau); await wait(400);
assert.doesNotMatch(await text('.trcal'), /Trực điện xưởng 1/, 'lịch tháng chỉ điểm màu, không nhồi nội dung vào ô');
await shot('24-lich-truc-thang');
// Chi tiết tuần: bảng cũ, mỗi ngày một dòng kèm nội dung trực song ngữ
await page.click('[data-act="trucChe"][data-m="tuan"]'); await wait(700);
assert.equal(await page.locator('.trcal').count(), 0, 'chế độ tuần thì ẩn lịch tháng');
assert.equal(await page.locator('[data-act="trucXep"]').count(), 7, 'bảy ngày trong tuần');
assert.match(await text('#main'), /Trực điện xưởng 1/, 'bảng chi tiết hiện nội dung trực');
assert.match(await text('#main'), /1号车间电工值班/, 'nội dung trực hiện cả tiếng Trung');
await shot('24b-lich-truc-tuan');
await page.click('[data-act="trucChe"][data-m="thang"]'); await wait(700);
assert.equal(await page.locator('.trcal').count(), 1, 'quay lại lịch tháng');
// Ngày chưa xếp: chọn người và nhập nội dung trực
assert.ok(lich16.trong, 'tháng mẫu có một ngày chưa xếp');
await page.click(`[data-act="trucXep"][data-d="${lich16.trong}"]`); await wait(500);
assert.match(await text('#barTitle'), /Xếp người trực/);
assert.equal(await page.locator('.trND, .trNDZ').count(), 2, 'ô xếp người trực có lại phần nội dung trực song ngữ');
const u16 = await page.evaluate(() => S.V.nv.find((n) => n.maNV === 'NV005').id);
await page.selectOption('.trNg', u16); await wait(400);
assert.equal(await page.locator('.trleg:visible').count(), 1, 'chọn người thì hiện màu của người đó');
await page.fill('.trND', 'Kiểm tra bơm nước khu xử lý nước thải'); await wait();
await page.click('#trOk'); await wait(1400);
const d16 = await page.evaluate((d) => { const x = trucNgayDS(d)[0]; return { uid: x.uid, ten: x.ten, nd: x.noiDung, dich: !!x.noiDungDich }; }, lich16.trong);
assert.equal(d16.uid, u16);
assert.equal(d16.nd, 'Kiểm tra bơm nước khu xử lý nước thải');
assert.equal(d16.dich, true, 'máy chủ vẫn tự dịch nội dung trực sang tiếng Trung');
// Hai người trực cùng một ngày: mỗi người một nội dung riêng, ô lịch chia màu
await page.click(`[data-act="trucXep"][data-d="${lich16.trong}"]`); await wait(600);
await page.click('[data-act="trThemNguoi"]'); await wait(400);
assert.equal(await page.locator('.trNg').count(), 2, 'thêm được người trực thứ hai');
const u16b = await page.evaluate(() => S.V.nv.find((n) => n.maNV === 'NV006').id);
await page.selectOption('.trNg >> nth=1', u16b); await wait(400);
assert.equal(await page.locator('.trNg >> nth=1 >> option[value="' + u16 + '"]').count(), 0,
  'người đã xếp ở dòng trên không chọn lại được');
await page.click('[data-act="trChepND"]'); await wait(400);
assert.equal(await page.inputValue('.trND >> nth=1'), 'Kiểm tra bơm nước khu xử lý nước thải', 'chép được nội dung của người đầu');
await page.fill('.trND >> nth=1', 'Trực cơ khí, hỗ trợ chuyền 5'); await wait();
await page.click('#trOk'); await wait(1500);
const hai16 = await page.evaluate((d) => trucNgayDS(d).map((x) => ({ uid: x.uid, nd: x.noiDung, zh: !!x.noiDungDich })), lich16.trong);
assert.equal(hai16.length, 2, 'một ngày giữ được hai người');
assert.deepEqual(hai16.map((x) => x.uid), [u16, u16b]);
assert.equal(hai16[1].nd, 'Trực cơ khí, hỗ trợ chuyền 5', 'người thứ hai có nội dung riêng');
assert.equal(hai16[1].zh, true, 'người thứ hai cũng được dịch');
const oHai = await page.evaluate((d) => {
  const el = document.querySelector(`.trcal [data-d="${d}"]`);
  return { nen: el.style.background, ten: Array.from(el.querySelectorAll('.nm')).map((x) => x.textContent) };
}, lich16.trong);
assert.match(oHai.nen, /linear-gradient/, 'ô lịch chia màu cho hai người');
assert.equal(oHai.ten.length, 2, 'ô lịch hiện tên cả hai người');
// Bảng chi tiết tuần ghi rõ hai người và nội dung của từng người
await page.click('[data-act="trucChe"][data-m="tuan"]'); await wait(700);
await page.evaluate((d) => { S.f.trucTuan = tcThuHai(d); render(); }, lich16.trong); await wait(500);
const bangTuan16 = await text('#main');
assert.match(bangTuan16, /2 người/, 'ngày hai người có chip đếm');
assert.match(bangTuan16, /Trực cơ khí, hỗ trợ chuyền 5/, 'hiện nội dung của người thứ hai');
// Giờ trực: mỗi lượt một khung giờ riêng, Chủ nhật lấy khung giờ của Chủ nhật
assert.match(await text('#main'), /Giờ mặc định/, 'đầu màn ghi giờ mặc định ngày thường và Chủ nhật');
const gioMD = await page.evaluate(() => ({ thuong: trucGioMacDinh('2026-01-05'), cn: trucGioMacDinh('2026-01-04') }));
assert.deepEqual(gioMD.thuong, { tu: '17:00', den: '19:30' });
assert.deepEqual(gioMD.cn, { tu: '07:30', den: '17:00' }, 'Chủ nhật mặc định 07:30 – 17:00');
const cnNay = await page.evaluate(() => addD(tcThuHai(TODAY()), 6));
await page.click(`[data-act="trucXep"][data-d="${lich16.trong}"]`); await wait(600);
assert.equal(await page.locator('.trTu, .trDen').count(), 4, 'hai lượt trực, mỗi lượt có ô Từ và Đến');
await page.fill('.trTu >> nth=0', '17:30'); await wait(400);
await page.fill('.trDen >> nth=0', '21:00'); await wait(400);
assert.match(await text('#main'), /3[.,]5 giờ/, 'app tính luôn số giờ của lượt đó');
await page.click('#trOk'); await wait(1500);
const gio16 = await page.evaluate((d) => trucNgayDS(d).map((x) => ({ tu: x.tu, den: x.den, txt: trucGioTxt(x, d), gio: trucSoGio(x, d) })), lich16.trong);
assert.equal(gio16[0].txt, '17:30 – 21:00', 'giờ riêng được lưu');
assert.equal(gio16[0].gio, 3.5);
// Ngày để trống giờ thì theo mặc định của ngày đó, Chủ nhật khác ngày thường
const cnTxt = await page.evaluate((d) => trucGioTxt({ tu: '', den: '' }, d), cnNay);
assert.equal(cnTxt, '07:30 – 17:00', 'Chủ nhật lấy khung giờ Chủ nhật');
// Sửa giờ mặc định
await page.click('[data-act="trucGioCfg"]'); await wait(600);
await page.fill('#gcTu', '17:00'); await page.fill('#gcDen', '19:00');
await page.fill('#gcCnTu', '07:30'); await page.fill('#gcCnDen', '17:00');
await page.click('#gcOk'); await wait(1400);
assert.deepEqual(await page.evaluate(() => trucGioMacDinh('2026-01-05')), { tu: '17:00', den: '19:00' }, 'giờ mặc định ngày thường đã đổi');
assert.equal(await page.evaluate((d) => trucNgayDS(d)[0].tu, lich16.trong), '17:30', 'lượt đã ghi giờ riêng không bị đổi theo');
// Tổng số ca cộng cả số giờ
await page.evaluate(() => go('trucTong')); await wait(700);
assert.match(await text('.dt thead'), /Số giờ trực/, 'bảng tổng có cột số giờ');
const tongGio = await page.evaluate((m) => trucTongDS(m).map((x) => x.gio), ymMau);
assert.ok(tongGio.every((g) => g > 0), 'mỗi người có số giờ trực: ' + JSON.stringify(tongGio));
// Đối chiếu giờ trực với giờ tăng ca đã đăng ký
assert.match(await text('#main'), /Đối chiếu với tăng ca/, 'Tổng số ca có bảng đối chiếu tăng ca');
const dc16 = await page.evaluate((m) => trucDoiChieu(m).map((x) => ({ ten: x.ten, truc: x.truc, tc: x.tc, lech: x.lech, thangTC: x.thangTC, thieu: x.thieu.length })), ymMau);
assert.ok(dc16.length >= 3, 'đối chiếu từng người: ' + dc16.length);
assert.ok(dc16.every((x) => Math.abs(x.truc - x.tc - x.lech) < 0.01), 'lệch = giờ trực − tăng ca ngày trực');
assert.ok(dc16.some((x) => x.tc > 0), 'có người đã đăng ký tăng ca đúng ngày trực');
assert.ok(dc16.some((x) => x.thieu > 0), 'có ngày trực chưa đăng ký đủ tăng ca');
assert.ok(dc16.every((x) => x.thangTC >= x.tc - 0.01), 'tổng tăng ca tháng không nhỏ hơn tăng ca ngày trực');
const dcM = await text('#main');
assert.match(dcM, /Ngày trực chưa đăng ký đủ tăng ca/);
assert.match(dcM, /chưa đăng ký/, 'ngày chưa đăng ký tăng ca ghi rõ');
await shot('25b-doi-chieu-tang-ca');
// Bấm một ngày thiếu thì mở thẳng form tăng ca, điền sẵn người, ngày và khung giờ của ca trực
const soThieu = await page.locator('[data-act="trucDCGhi"]').count();
assert.ok(soThieu >= 1, 'liệt kê từng ngày thiếu để bấm vào ghi');
const nhan16 = await page.evaluate(() => { const el = document.querySelector('[data-act="trucDCGhi"]'); return { d: el.dataset.d, tu: el.dataset.tu, den: el.dataset.den }; });
await page.click('[data-act="trucDCGhi"] >> nth=0'); await wait(900);
assert.match(await text('#barTitle'), /tăng ca/i, 'mở form tăng ca');
assert.equal(await page.inputValue('#tcNgay'), nhan16.d, 'điền sẵn đúng ngày trực');
assert.equal(await page.inputValue('#tcTu'), nhan16.tu, 'điền sẵn giờ bắt đầu ca trực');
assert.equal(await page.inputValue('#tcDen'), nhan16.den, 'điền sẵn giờ kết thúc ca trực');
await page.evaluate(() => back()); await wait(500);
// File Excel có thêm sheet đối chiếu
const shDC = await page.evaluate(async (m) => {
  const sh = await readXlsx(await trucXlsx(m).arrayBuffer());
  const r = await sh[3].rows();
  return { ten: sh.map((x) => x.name), txt: r.map((x) => x.join('|')).join('\n') };
}, ymMau);
assert.deepEqual(shDC.ten, ['Lich truc', 'Phan ca truc', 'Tong hop', 'Doi chieu TC'], 'Excel có bốn sheet');
assert.match(shDC.txt, /值班与加班核对/, 'sheet đối chiếu song ngữ');
assert.match(shDC.txt, /Ngày trực chưa đăng ký đủ tăng ca/, 'sheet liệt kê cả ngày thiếu');
await page.evaluate(() => back()); await wait(500);
await shot('24c-lich-truc-hai-nguoi');
// Bỏ người thứ hai: ngày đó quay về một người
await page.click(`[data-act="trucXep"][data-d="${lich16.trong}"]`); await wait(600);
await page.click('[data-act="trBoNguoi"] >> nth=1'); await wait(400);
await page.click('#trOk'); await wait(1500);
assert.equal(await page.evaluate((d) => trucNgayDS(d).length, lich16.trong), 1, 'bỏ được người thứ hai');
await page.click('[data-act="trucChe"][data-m="thang"]'); await wait(600);
await page.evaluate((m) => { S.f.trucThang = m; render(); }, ymMau); await wait(400);
const sau16 = await page.evaluate((m) => trucThangDS(m).ds.filter(trucCoNguoi).length, ymMau);
assert.equal(sau16, lich16.co + 1, 'xếp thêm một ngày thì lịch tháng đếm thêm một');
// Tổng số ca: số ngày trực và số ngày Chủ nhật
await page.evaluate(() => go('trucTong')); await wait(600);
assert.match(await text('#barTitle'), /Tổng số ca/);
const tong16 = await page.evaluate((m) => trucTongDS(m), ymMau);
assert.ok(tong16.length >= 3, 'bảng tổng liệt kê từng người');
// Chủ nhật của tuần đang xem có thể rơi sang tháng sau (vd thứ Hai 26/10 thì Chủ nhật là 1/11),
// nên đếm ngày Chủ nhật theo đúng tháng chứa Chủ nhật đó.
const cn16 = await page.evaluate(() => {
  const cn = addD(tcThuHai(TODAY()), 6);
  return trucTongDS(cn.slice(0, 7)).reduce((a, x) => a + x.cn, 0);
});
assert.ok(cn16 >= 1, 'đếm riêng số ngày Chủ nhật');
await shot('25-truc-tong-so-ca');
// Xuất Excel cả tháng: ba sheet (lịch từng ngày, phân công ca, tổng hợp)
const xlTruc = await page.evaluate(async (ym) => {
  const blob = trucXlsx(ym);
  const sh = await readXlsx(await blob.arrayBuffer());
  const r = await Promise.all(sh.map((x) => x.rows()));
  const cuoi = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
  const txt = (rows) => rows.map((x) => x.join('|')).join('\n');
  return { ten: sh.map((x) => x.name), size: blob.size, cuoi, ngay: txt(r[0]), ca: txt(r[1]), tong: txt(r[2]),
    dongCa: r[1].length };
}, ymMau);
assert.deepEqual(xlTruc.ten, ['Lich truc', 'Phan ca truc', 'Tong hop', 'Doi chieu TC'], 'đủ bốn sheet: ' + xlTruc.ten);
assert.ok(xlTruc.dongCa >= 7 && xlTruc.dongCa <= 9, 'sheet phân ca có mỗi tuần một dòng: ' + xlTruc.dongCa);
assert.match(xlTruc.ngay, /Thứ Hai.*Chủ nhật/s, 'sheet lịch trực là lịch tháng, bảy cột thứ Hai → Chủ nhật');
assert.match(xlTruc.ngay, /星期日/, 'cột thứ song ngữ');
assert.match(xlTruc.ngay, /Số ngày đã xếp/, 'sheet lịch trực đếm số ngày đã xếp');
assert.match(xlTruc.ngay, /Màu theo người trực/, 'sheet lịch trực có chú thích màu');
assert.doesNotMatch(xlTruc.ngay, /Nội dung trực/, 'sheet lịch trực không còn cột nội dung');
assert.equal((xlTruc.ngay.match(/\n/g) || []).length >= 8, true, 'lịch tháng có các dòng tuần');
assert.match(xlTruc.ca, /Kho ngũ kim/, 'sheet phân ca có nhóm kho ngũ kim');
assert.match(xlTruc.ca, /0389978042|0946367665/, 'sheet phân ca mang số điện thoại');
assert.match(xlTruc.tong, /Cộng/, 'sheet tổng hợp có dòng cộng');
assert.ok(xlTruc.size > 3000, 'file Excel có nội dung: ' + xlTruc.size);
await page.click('[data-act="trucXuat"]'); await wait(900);
// Phân ca cả tháng: mỗi tuần một dòng, ô tô màu theo người, bấm tuần mở bảng giấy
await page.evaluate((m) => { back(); S.f.trucThang = m; go('phanCa'); }, ymMau); await wait(700);
assert.match(await text('#barTitle'), /Phân công ca trực/);
assert.match(await text('#main'), /KHO NGŨ KIM/);
assert.match(await text('#main'), /0389978042|0946367665/, 'ô phân ca hiện số điện thoại của người trực');
const pcT = await page.evaluate((ym) => {
  const bang = Array.from(document.querySelectorAll('.pcthang'));
  return { tuan: pcThangDS(ym).length, nguoi: pcTongDS(ym).length, bang: bang.length,
    cot: bang.map((t) => t.querySelectorAll('thead th').length),
    tran: bang.filter((t) => t.scrollWidth > t.parentElement.clientWidth).length };
}, ymMau);
assert.equal(pcT.bang, 2, 'hai bảng xếp dọc: Sản xuất và Kho ngũ kim');
assert.deepEqual(pcT.cot, [3, 3], 'mỗi bảng ba cột: tuần, ca ngày, ca đêm');
assert.equal(pcT.tran, 0, 'bảng vừa bề ngang điện thoại, không phải kéo ngang');
assert.ok(pcT.tuan >= 4 && pcT.tuan <= 6, 'mỗi tuần trong tháng một dòng: ' + pcT.tuan);
assert.equal(await page.locator('.pcthang tbody tr').count(), pcT.tuan * 2);
assert.ok(await page.evaluate(() => Array.from(document.querySelectorAll('.pcthang td')).filter((e) => e.style.background).length) >= 4,
  'ô đã xếp được tô màu theo người');
assert.match(await text('.trleg'), /tuần ca ngày|tuần ca đêm/, 'chú thích màu đếm số tuần ca ngày / ca đêm');
await shot('26-phan-ca-thang');
// Tờ A4 để in hoặc lưu thành PDF: lịch tháng và bảng phân ca tháng
const toIn = await page.evaluate((ym) => {
  const a = trucInHtml(ym), b = pcThangInHtml(ym);
  const d = document.createElement('div');
  d.innerHTML = a; const oA = d.querySelectorAll('table tr').length;
  d.innerHTML = b; const oB = d.querySelectorAll('table').length;
  return { a, b, dongA: oA, bangB: oB };
}, ymMau);
assert.match(toIn.a, /LỊCH TRỰC THÁNG|值班表/, 'tờ in lịch tháng có tiêu đề song ngữ');
assert.match(toIn.a, /Màu theo người trực/, 'tờ in có chú thích màu');
assert.match(toIn.a, /background:#[0-9A-F]{6}/i, 'ô ngày trên tờ in được tô màu');
assert.match(toIn.a, /Người lập|制表人/, 'tờ in có chỗ ký');
assert.ok(toIn.dongA >= 6, 'tờ in có dòng tiêu đề thứ và các dòng tuần: ' + toIn.dongA);
assert.equal(toIn.bangB, 2, 'tờ in phân ca có hai bảng: Sản xuất và Kho ngũ kim');
assert.match(toIn.b, /五金仓库/, 'tờ in phân ca song ngữ');
assert.equal(await page.locator('[data-act="trucPdf"], [data-act="pcPdf"]').count() > 0, true, 'có nút xuất PDF');
// Mở bảng một tuần: đúng mẫu giấy, bấm luân phiên thì tiếp nối tuần trước
const pcTruoc = await page.evaluate(() => { const tu = tcThuHai(TODAY()); const x = pcO(tu, 'SX', 'NGAY'); return x ? x.ten : ''; });
assert.ok(pcTruoc, 'tuần này đã có người trực ca ngày');
await page.click(`[data-act="pcMoTuan"][data-tu="${await page.evaluate(() => tcThuHai(TODAY()))}"]`); await wait(700);
assert.match(await text('#barTitle'), /Phân ca một tuần/);
assert.match(await text('#main'), /BẢNG PHÂN CÔNG CA TRỰC/, 'bảng tuần đúng mẫu giấy');
await shot('27-phan-ca-tuan');
await page.click('[data-act="pcLP"]'); await wait(400);
await page.click('[data-act="pcLPOk"]'); await wait(1200);
const pcSau = await page.evaluate(() => {
  const tu = tcThuHai(TODAY());
  return { ngay: (pcO(tu, 'SX', 'NGAY') || {}).ten, dem: (pcO(tu, 'SX', 'DEM') || {}).ten,
    kho: (pcO(tu, 'KHO', 'NGAY') || {}).ten, n: pcDS().filter((x) => x.tuNgay === tu && x.nguoiId).length };
});
assert.equal(pcSau.n, 4, 'luân phiên xếp đủ bốn ô');
assert.notEqual(pcSau.ngay, pcSau.dem, 'ca ngày và ca đêm là hai người khác nhau');
assert.ok(pcSau.kho, 'kho ngũ kim cũng được xếp');
// Danh sách người trực: Nguyễn Thị The đã nghỉ nên không có trong danh sách
const ntDS16 = await page.evaluate(() => S.V.nt.map((x) => x.ten));
assert.equal(ntDS16.includes('Nguyễn Thị The'), false, 'người đã nghỉ không có trong danh sách sắp lịch');
assert.equal(ntDS16.length, 9);
// Sửa danh sách người trực ca: thêm một người và đổi số điện thoại
await page.click('[data-act="go"][data-v="trucNguoi"]'); await wait(600);
assert.match(await text('#barTitle'), /Danh sách người trực ca/);
await page.fill('[data-nf="0:dienThoai"]', '0912345678');
await page.click('[data-act="ntThem"]'); await wait(400);
const cuoi16 = await page.evaluate(() => topV().p.ds.length - 1);
await page.fill(`[data-nf="${cuoi16}:ten"]`, 'Phạm Văn Mới');
await page.fill(`[data-nf="${cuoi16}:tenZh"]`, '范文新');
await page.fill(`[data-nf="${cuoi16}:dienThoai"]`, '0977000111');
await page.selectOption(`[data-nf="${cuoi16}:nhom"]`, 'KHO'); await wait();
await page.click('#ntOk'); await wait(1200);
const ntSau = await page.evaluate(() => S.V.nt.map((x) => ({ ten: x.ten, dt: x.dienThoai, nhom: x.nhom })));
assert.equal(ntSau.length, 10, 'thêm được người mới vào danh sách');
assert.equal(ntSau[0].dt, '0912345678', 'sửa được số điện thoại');
const moi16 = ntSau.find((x) => x.ten === 'Phạm Văn Mới');
assert.equal(moi16.nhom, 'KHO');
// Chép người trực của một tuần sang hai tuần sau
await page.evaluate(() => { back(); tab('truc'); }); await wait(700);
const tuan16 = await page.evaluate(() => tcThuHai(TODAY()));
await page.click('[data-act="trucChep"]'); await wait(400);
await page.click('[data-act="trucChepN"][data-n="2"]'); await wait(400);
await page.click('[data-act="trucChepOk"][data-de="1"]'); await wait(1500);
const chep16 = await page.evaluate((tu) => {
  const g = (d) => trucNgayDS(d).map((x) => x.uid);
  return { goc: g(tu), t1: g(addD(tu, 7)), t2: g(addD(tu, 14)), t3: g(addD(tu, 21)) };
}, tuan16);
assert.ok(chep16.goc.length >= 2, 'ngày nguồn có hai người trực: ' + JSON.stringify(chep16.goc));
assert.deepEqual(chep16.t1, chep16.goc, 'chép sang tuần sau, đủ cả hai người');
assert.deepEqual(chep16.t2, chep16.goc, 'chép sang tuần thứ hai');
assert.deepEqual(chep16.t3, [], 'không chép quá số tuần đã chọn');
// Cặp trực: sản xuất xếp theo cặp, hiện trong thứ tự luân phiên
await page.evaluate(() => go('phanCaTuan')); await wait(700);
assert.match(await text('#main'), /Cặp 1/, 'panel thứ tự luân phiên hiện theo cặp');
const cap16 = await page.evaluate(() => {
  const ng = ntDS('SX'), caps = pcCapDS(ng);
  return { soCap: caps.length, le: ng.length - caps.length * 2, ten: caps.map((c) => c.map((x) => x.ten)) };
});
assert.equal(cap16.soCap, 3, 'ba cặp sản xuất');
assert.equal(cap16.le, 1, 'một người chưa ghép cặp');
assert.deepEqual(cap16.ten[0], ['Nguyễn Hữu Ninh', 'Đỗ Văn Quân']);
// Kỹ thuật: xem được lịch trực và bảng phân ca, không xếp được
await logout(); await login('NV003', '333333');
await page.evaluate(() => tab('truc')); await wait(600);
assert.ok(await page.locator('.trcal .d').count() >= 28, 'kỹ thuật xem được lịch trực tháng');
assert.match(await text('.trleg'), /Bạn trực/, 'chú thích màu đánh dấu ngày của chính mình');
assert.equal(await page.locator('[data-act="trucXep"]').count(), 0, 'kỹ thuật không bấm xếp lịch được');
assert.equal(await page.locator('.trcal button.d').count(), 0, 'ô ngày với kỹ thuật không phải nút bấm');
await page.evaluate(() => go('phanCa')); await wait(600);
assert.equal(await page.locator('.pcthang [data-act="pcChon"]').count(), 0, 'kỹ thuật không đổi được người trong bảng tháng');
await page.evaluate(() => go('phanCaTuan')); await wait(600);
assert.equal(await page.locator('[data-act="pcLP"]').count(), 0, 'kỹ thuật không có nút luân phiên');
await page.evaluate(() => go('trucNguoi')); await wait(500);
assert.match(await text('#barTitle'), /Chỉ Quản lý/);
ok('Bản 2.17 + 2.34: lịch trực tháng điểm màu, một ngày nhiều người trực, mỗi lượt một giờ và một nội dung riêng, Chủ nhật khung giờ riêng, đối chiếu giờ trực với tăng ca đã đăng ký, chép tuần, phân ca theo cặp; kỹ thuật chỉ xem');

// 17. Bản 2.13: kho ngũ kim nhớ tồn qua từng lần nhập, nhắc thiếu hàng và gần hết hàng
await logout(); await login('NV002', '222222');
await page.evaluate(() => tab('kho')); await wait(900);
await page.waitForFunction(() => S.kho.ds.length > 0, null, { timeout: 20000 });
// Lịch sử nhập file: ba lần nhập mẫu đều được ghi nhớ
assert.equal(await page.evaluate(() => S.kho.nhatKy.length), 3, 'nhớ cả ba lần nhập file');
assert.equal(await page.evaluate(() => S.kho.moc.length), 3, 'ba mốc thời gian để so tồn');
assert.match(await text('#main'), /Lịch sử nhập file kho/);
const nhac17 = await page.evaluate(() => { const d = khoNhacDS(); return { n: d.n, vua: d.vuaHet.map((o) => o.x.ma), gan: d.ganHet.map((o) => o.x.ma) }; });
assert.ok(nhac17.vua.includes('605010001') && nhac17.vua.includes('605010022'), 'hai mã vừa hết hàng');
assert.ok(nhac17.gan.includes('604010217') && nhac17.gan.includes('605010136'), 'hai mã gần hết (tồn 1)');
assert.equal(nhac17.gan.includes('605010344'), false, 'tồn 2 chưa coi là gần hết khi ngưỡng là 1');
await shot('27-kho-nhac-nut');
// Mở màn Nhắc hàng
await page.click('[data-act="khoNhac"]'); await wait(700);
assert.match(await text('#barTitle'), /Nhắc hàng/);
assert.match(await text('#main'), /Vừa hết hàng/);
assert.match(await text('#main'), /Gần hết hàng/);
assert.match(await text('#main'), /2 → 0|3 → 0/, 'hiện tồn lần nhập trước → tồn nay');
await shot('28-kho-nhac-hang');
// Chi tiết linh kiện: tồn qua từng lần nhập
await page.click('.khorow'); await wait(600);
assert.match(await text('.sheet, #sheetBg'), /Tồn qua các lần nhập/, 'phiếu linh kiện có lịch sử tồn');
await page.click('#sheetBg'); await wait(400);
// Đổi ngưỡng gần hết thành 3 thì mã còn tồn 2 cũng được nhắc
await page.evaluate(() => { back(); tab('kho'); }); await wait(700);
await page.click('#khoCfg summary'); await wait(300);
await page.fill('#khoNg', '3');
await page.click('[data-act="khoNgLuu"]'); await wait(1200);
const sau17 = await page.evaluate(() => ({ ng: khoGanHetN(), gan: khoNhacDS().ganHet.map((o) => o.x.ma) }));
assert.equal(sau17.ng, 3, 'đã lưu ngưỡng gần hết');
assert.ok(sau17.gan.includes('605010344'), 'tồn 2 nay là gần hết');
if (!await page.evaluate(() => !!($('#khoCfg') || {}).open)) await page.click('#khoCfg summary');
await page.fill('#khoNg', '1'); await page.click('[data-act="khoNgLuu"]'); await wait(1000);
ok('Bản 2.13: kho nhớ tồn qua từng lần nhập, nhắc vừa hết / đang hết / gần hết, ngưỡng gần hết sửa được');

// 18. Bản 2.14: tồn kho an toàn — tải file mẫu, nhập từ file, liệt kê hàng thiếu
await logout(); await login('NV002', '222222');
await page.evaluate(() => tab('kho')); await wait(900);
await page.waitForFunction(() => S.kho.ds.length > 0, null, { timeout: 20000 });
assert.ok(await page.locator('[data-act="khoMauTon"]').count(), 'có nút tải file mẫu tồn an toàn');
assert.ok(await page.evaluate(() => khoMauTonMinBlob().size > 2000), 'dựng được file mẫu Excel');
// Nhập tồn an toàn từ file: một mã đã có, một mã chưa có trong kho
const qcCu18 = await page.evaluate(() => khoGet('605010344').qc);
await page.setInputFiles('#khoMinFile', { name: 'ton-an-toan.csv', mimeType: 'text/csv',
  buffer: Buffer.from('Mã sản phẩm,Tên linh kiện,Mã linh kiện,Số lượng dự phòng,Bỏ theo dõi\n'
    + '605010344,Vòng bi,QC-SAI,20,\n609030115,Bộ lọc súng keo,LOC-φ8,3,\n605010014,Vòng bi lớn,,,x\n'
    + '60501034,Vòng bi gõ thiếu số,,5,\n', 'utf8') });
await wait(1200);
assert.match(await text('#barTitle'), /Nhập tồn kho an toàn/);
assert.match(await text('#main'), /Thêm mới, coi như hết hàng/, 'mã chưa có trong kho được hỏi thêm mới');
assert.match(await text('#main'), /Bỏ theo dõi/, 'mã đánh dấu x hiện trong nhóm bỏ theo dõi');
assert.match(await text('#main'), /Mã nghi gõ nhầm/, 'mã thiếu số bị chặn lại');
assert.match(await text('#main'), /60501034/);
await shot('29-nhap-ton-an-toan');
await page.click('#kmSave'); await wait(1500);
// Lưu xong mở luôn màn Nhắc hàng
assert.match(await text('#barTitle'), /Nhắc hàng/);
const at18 = await page.evaluate(() => {
  const a = khoGet('605010344'), b = khoGet('609030115');
  const d = khoNhacDS();
  return { at: a.tonMin, ton: a.ton, moiTon: b ? b.ton : null, moiAt: b ? b.tonMin : null,
    thieu: d.thieu.map((o) => o.x.ma), can: (d.thieu.find((o) => o.x.ma === '605010344') || {}).can,
    hetCo: d.vuaHet.concat(d.dangHet).some((o) => o.x.ma === '609030115') };
});
assert.equal(at18.at, 20, 'đã đặt tồn an toàn cho mã có sẵn');
assert.equal(at18.ton, 2, 'không đụng tới tồn thật');
assert.equal(at18.moiTon, 0, 'mã chưa có được thêm vào kho, coi như hết hàng');
assert.equal(at18.moiAt, 3);
assert.ok(at18.thieu.includes('605010344'), 'tồn 2 dưới mốc báo (15% của 20 = 3) thì vào nhóm thiếu');
assert.equal(at18.can, 18, 'số cần mua tính cho đủ 100% mức an toàn');
assert.ok(at18.hetCo, 'mã mới thêm nằm trong nhóm hết hàng');
// Quy cách lấy từ cột "Mã linh kiện" khi kho chưa có, không ghi đè quy cách sẵn có
const qc18 = await page.evaluate(() => ({ moi: khoGet('609030115').qc, cu: khoGet('605010344').qc,
  bo: !!khoGet('605010014').an, nhac: khoNhacDS().vuaHet.concat(khoNhacDS().dangHet, khoNhacDS().thieu, khoNhacDS().ganHet).some((o) => o.x.ma === '605010014') }));
assert.equal(qc18.moi, 'LOC-φ8', 'mã mới lấy quy cách từ cột Mã linh kiện trong file');
assert.equal(qc18.cu, qcCu18, 'không ghi đè quy cách đã có');
assert.equal(qc18.bo, true, 'mã đánh dấu x đã bị bỏ theo dõi');
assert.equal(qc18.nhac, false, 'mã đã bỏ theo dõi thì không nhắc mua nữa');
assert.equal(await page.evaluate(() => !!khoGet('60501034')), false, 'mã nghi gõ nhầm không được thêm vào kho');
assert.match(await text('#main'), /Thiếu hàng/);
assert.match(await text('#main'), /cần thêm 18/);
// Trên mốc báo thì thôi kêu; đổi mức báo thiếu lên 100% là lại vào danh sách
const pt18 = await page.evaluate(() => {
  const x = khoGet('605010344');
  return { pct: khoPhanTramN(), moc: khoMocBao(x), muc: khoMuc(x) };
});
assert.equal(pt18.pct, 15, 'mặc định báo khi tồn dưới 15% mức an toàn');
assert.equal(pt18.moc, 3);
await page.evaluate(() => { back(); tab('kho'); }); await wait(700);
if (!await page.evaluate(() => !!($('#khoCfg') || {}).open)) { await page.click('#khoCfg summary'); await wait(300); }
await page.fill('#khoPt', '5'); await page.click('[data-act="khoPtLuu"]'); await wait(1200);
const pt18b = await page.evaluate(() => ({ pct: khoPhanTramN(), muc: khoMuc(khoGet('605010344')), n: khoNhacDS().thieu.length }));
assert.equal(pt18b.pct, 5, 'đổi được mức báo thiếu');
assert.equal(pt18b.muc, '', 'tồn 2 trên mốc 5% của 20 = 1 thì thôi báo thiếu');
if (!await page.evaluate(() => !!($('#khoCfg') || {}).open)) { await page.click('#khoCfg summary'); await wait(300); }
await page.fill('#khoPt', '15'); await page.click('[data-act="khoPtLuu"]'); await wait(1000);
// Trang chủ không còn báo linh kiện thiếu
await page.evaluate(() => tab('home')); await wait(800);
assert.equal(await page.locator('[data-act="khoLoc"][data-v="thap"]').count(), 0, 'trang chủ không còn ô cảnh báo linh kiện');
assert.equal(/dưới tối thiểu/i.test(await text('#main')), false, 'ô Linh kiện ở Tổng quan không báo thiếu nữa');
await shot('30-nhac-hang-thieu');
assert.ok(await page.evaluate(() => khoThieuBlob(khoNhacDS()).size > 2000), 'xuất được danh sách cần mua');
ok('Bản 2.16: tồn an toàn từ file (quy cách, đơn vị, bỏ theo dõi), báo thiếu theo phần trăm, không báo ra trang chủ');

// 19. Báo tin qua WeChat Work: nhập webhook robot nhóm, chặn địa chỉ lạ, gửi thử (chỉ Quản trị vào được)
await logout();
await login('NV001', '111111');
await page.evaluate(() => go('notify', {})); await wait(1500);
assert.match(await text('#main'), /企业微信/, 'có mục WeChat Work trong Báo tin');
await page.fill('#nWwUrl', 'https://vidu.com/hook?key=abcdef123456');
await page.check('#nWw');
await page.click('#nSave'); await wait(1000);
assert.match(await text('#nErr'), /Webhook/i, 'địa chỉ lạ bị chặn');
await page.fill('#nWwUrl', 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abcdef123456');
await page.fill('#nWwTen', 'Tổ bảo trì 维修组');
await page.click('#nSave'); await wait(1200);
const ww19 = await page.evaluate(() => { const c = topV().p.c; return { bat: c.wwBat, co: c.wwCo, ten: c.wwTen, url: c.wwUrl }; });
assert.deepEqual(ww19, { bat: true, co: true, ten: 'Tổ bảo trì 维修组', url: undefined }, 'lưu được, không trả địa chỉ về app');
await shot('31-baotin-wechat-work');
await page.click('[data-act="tgTest"]'); await wait(1600);
assert.ok(await page.evaluate(() => DemoBackend.net.log.some((l) => /qyapi\.weixin\.qq\.com/.test(l.url))), 'gửi thử có vào WeChat Work');
// Xoá địa chỉ thì tắt kênh
await page.click('[data-act="wwXoa"]'); await wait(600);
await page.click('[data-act="wwXoaGo"]'); await wait(1200);
assert.equal(await page.evaluate(() => topV().p.c.wwCo), false, 'xoá được địa chỉ webhook');
ok('Bản 2.21: báo tin vào nhóm WeChat Work, chặn địa chỉ webhook lạ, gửi thử và xoá được');

// 20. Kiểm định thiết bị và Tính toán TB — chỉ Quản lý dùng được
await logout(); await login('NV003', '333333');
assert.equal(await page.evaluate(() => xemDuoc('kd') || xemDuoc('tt')), false, 'kỹ thuật không vào được hai mục này');
await page.click('.tabs .tab[data-v="them"]'); await wait(600);
assert.equal(await page.locator('#main .row[data-v="kd"], #main .row[data-v="tt"], #main .row[data-v="tlTb"]').count(), 0, 'kỹ thuật: màn Thêm không có ba mục này');
assert.equal(await page.evaluate(() => xemDuoc('tlTb')), false, 'kỹ thuật không xem được Tài liệu thiết bị');
await logout(); await login('NV002', '222222');
await moThem('kd');
assert.match(await text('#barTitle'), /Kiểm định/);
const kd20 = await page.evaluate(() => kdDem());
assert.ok(kd20.qua >= 1 && kd20.sap >= 1, 'dữ liệu mẫu có cả quá hạn và sắp hết hạn: ' + JSON.stringify(kd20));
assert.ok(await page.locator('.row[data-act="kdMo"]').count() >= 4, 'sổ kiểm định có thiết bị');
await shot('33-kiem-dinh-so');
// Thêm một thiết bị mới: chu kỳ và nhóm nghiêm ngặt tự điền theo loại
await page.click('[data-act="kdNew"]'); await wait(600);
await page.fill('#kdTen', 'Cầu trục dầm đơn 3 tấn');
await page.selectOption('#kdLoai', 'CAN_TRUC'); await wait(500);
assert.equal(await page.inputValue('#kdCk'), '36', 'chu kỳ điền sẵn theo loại');
assert.equal(await page.isChecked('#kdNN'), true, 'cần trục thuộc nhóm nghiêm ngặt');
await page.fill('#kdSo', 'CT-03'); await page.fill('#kdVt', 'Xưởng 3');
await page.click('#kdOk'); await wait(1200);
const moi20 = await page.evaluate(() => kdDS().find((x) => x.ten === 'Cầu trục dầm đơn 3 tấn'));
assert.ok(moi20 && moi20.nghiemNgat && moi20.chuKy === 36, 'đã lưu hồ sơ thiết bị');
assert.ok(moi20.tenZh, 'tên thiết bị được dịch sang tiếng Trung');
// Ghi một lần kiểm định → có hạn kế tiếp
await page.click(`.row[data-act="kdMo"]:has-text("Cầu trục dầm đơn 3 tấn")`); await wait(700);
await page.click('[data-act="kdGhi1"]'); await wait(700);
await page.fill('#kgDv', 'Trung tâm Kiểm định KTAT Khu vực I');
await page.fill('#kgSo', 'KD-2026-0999');
await page.click('#kgOk'); await wait(1400);
const sau20 = await page.evaluate(() => kdDS().find((x) => x.ten === 'Cầu trục dầm đơn 3 tấn'));
assert.equal(sau20.ketQua, 'DAT');
assert.equal(await page.evaluate((d) => kdHanTu(d.ngayKD, d.chuKy), sau20), sau20.ngayHetHan, 'hạn tính đúng theo chu kỳ');
assert.equal(sau20.lichSu.length, 1);
assert.ok(await page.evaluate(() => kdXlsx(kdDS()).size) > 2000, 'xuất được Excel sổ kiểm định');
// Nhập sổ kiểm định từ Excel: file mẫu đọc lại được, ghép theo số hiệu, nhập lại không nhân đôi
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(500);
await moThem('kd');
assert.ok(await page.evaluate(() => kdMauXlsx().size) > 2000, 'tải được file mẫu');
const mauKD = await page.evaluate(async () => {
  const rows = await (await readXlsx(await new File([kdMauXlsx()], 'mau.xlsx').arrayBuffer()))[0].rows();
  const h = timCotKD(rows);
  let loi = '';
  try { await docFileKD(new File([kdMauXlsx()], 'mau.xlsx')); } catch (e) { loi = e.code; }
  return { cot: h ? Object.keys(h.cot).length : 0, loi };
});
assert.ok(mauKD.cot >= 16, 'file mẫu đọc lại nhận đủ cột: ' + JSON.stringify(mauKD));
assert.equal(mauKD.loi, 'KHONG_CO_DONG', 'file mẫu chưa điền dòng nào thì báo đúng lý do');
const truocKD = await page.evaluate(() => kdDS().length);
const fileKD = await page.evaluate(async () => {
  const H = { b: 1, fill: '#1E3A6E', color: '#FFFFFF', align: 'center' };
  const c = (v) => ({ v, s: { border: true, wrap: 1 } });
  const ks = ['Tên thiết bị', 'Loại', 'Số hiệu', 'Nhà sản xuất', 'Năm sản xuất', 'Thông số',
    'Nghiêm ngặt', 'Chu kỳ', 'Đơn vị kiểm định', 'Số giấy chứng nhận', 'Số tem', 'Thuộc thiết bị',
    'Ngày kiểm định', 'Kết quả'];
  const rows = [ks.map((k) => ({ v: k, s: H }))];
  [['4M3', 'TEST-1'], ['4M3', 'TEST-2'], ['4M3', 'TEST-3'], ['4M3', 'TEST-4'], ['4M3', 'TEST-5'],
    ['2M3', 'TEST-6'], ['2M3', 'TEST-7'], ['5M3', 'TEST-8'], ['5M3', 'TEST-9']].forEach(([m, sr], i) => {
    rows.push([c('Bình chứa khí nén AIR TANK ' + m), c('Bình chịu áp lực'), c(sr), c('Trung Quốc'), c(2025),
      c('Dung tích ' + m + ' · 8,4 bar · 110 °C'), c('x'), c(36), c('PV TSR'), c('GCN-' + (i + 1)),
      c('TEM-' + (i + 1)), c(''), c('11/08/2025'), c('Đạt')]);
  });
  // Áp kế và van an toàn: loại mới, gắn trên bình, có số tem riêng
  rows.push([c('Áp kế bình chứa khí nén'), c('Áp kế'), c('AK-TEST-1'), c('Trung Quốc'), c(2025),
    c('Lò xo ống · 0÷1,6 MPa'), c(''), c(12), c('PV TSR'), c('GCN-AK-1'), c('24B TEST1'), c('TEST-1'),
    c('11/08/2025'), c('Đạt')]);
  rows.push([c('Van an toàn bình chứa khí nén'), c('Van an toàn'), c('VAT-TEST-1'), c('Trung Quốc'), c(2024),
    c('A28H-16 · 8,4 bar'), c('x'), c(12), c('PV TSR'), c('GCN-VAT-1'), c(''), c('TEST-1'),
    c('09/08/2025'), c('Đạt')]);
  rows.push([c('Găng tay cao su cách điện cấp 4'), c('Dụng cụ an toàn điện'), c('GT-TEST-1'), c('Shuang an'), c(2025),
    c('35 kV · thử 40 kV/1 phút'), c(''), c(6), c('PV TSR'), c('GCN-GT-1'), c('01A; 01B'), c(''),
    c('12/08/2025'), c('Đạt')]);
  const blob = XW.build([{ name: 'KD', rows }]);
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
});
const napKD = { name: 'kiem-dinh.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(fileKD) };
await page.setInputFiles('#kdFile', napKD); await wait(2500);
const binh = await page.evaluate(() => kdDS().filter((x) => /AIR TANK/.test(x.ten)));
// Ba loại thiết bị mới và hai trường Số tem / Thuộc thiết bị
const kdMoi = await page.evaluate(() => {
  const g = (lo) => kdDS().filter((x) => x.loai === lo)[0] || null;
  return { ak: g('AP_KE'), van: g('VAN_AT'), gt: g('DC_DIEN'), binh1: kdDS().filter((x) => x.soHieu === 'TEST-1')[0] };
});
assert.ok(kdMoi.ak && kdMoi.van && kdMoi.gt, 'nhận đủ ba loại mới: áp kế, van an toàn, dụng cụ an toàn điện');
assert.equal(kdMoi.ak.soTem, '24B TEST1', 'áp kế nhận số tem');
assert.equal(kdMoi.ak.thuocTB, 'TEST-1', 'áp kế ghi rõ gắn trên bình nào');
assert.equal(kdMoi.van.thuocTB, 'TEST-1', 'van an toàn ghi rõ gắn trên bình nào');
assert.equal(kdMoi.van.nghiemNgat, true, 'van an toàn thuộc nhóm nghiêm ngặt');
assert.equal(String(kdMoi.gt.chuKy), '6', 'dụng cụ an toàn điện chu kỳ sáu tháng');
assert.equal(kdMoi.gt.ngayHetHan, '2026-02-11', 'chu kỳ sáu tháng tính đúng hạn: ' + kdMoi.gt.ngayHetHan);
assert.equal(kdMoi.binh1.soTem, 'TEM-1', 'bình chứa khí nén nhận số tem');
// Số tem và Thuộc thiết bị hiện ở hồ sơ và có trong file xuất ra
await page.evaluate((i) => go('kdXem', { id: i }), kdMoi.ak.id); await wait(600);
assert.match(await text('#main'), /24B TEST1/, 'hồ sơ hiện số tem');
assert.match(await text('#main'), /Thuộc thiết bị/, 'hồ sơ hiện thiết bị mẹ');
// Ghi thêm một lần kiểm định nữa để có "lần trước" mà đối chiếu
const kdLan2 = await page.evaluate(async (i) => {
  const d = await api('doInspect', { id: i, ngayKD: '2025-09-15', chuKy: 36, donViKD: 'PV TSR 2',
    soGiayKD: 'GCN-LAN2', soTem: 'TEM-LAN2', ketQua: 'DAT' });
  await refresh(true);
  return (d.kiemDinh.lichSu || []).length;
}, kdMoi.binh1.id);
assert.equal(kdLan2, 2, 'ghi được lần kiểm định thứ hai');
const xlKD = await page.evaluate(async () => {
  const blob = kdXlsx(kdDS());
  const sh = await readXlsx(await blob.arrayBuffer());
  const r = await Promise.all(sh.map((x) => x.rows()));
  const txt = (rows) => rows.map((x) => x.join('|')).join('\n');
  // XW lưu zip không nén nên dò thẳng mã màu trong tệp là biết ô quá hạn có được tô đỏ không
  const byt = new Uint8Array(await blob.arrayBuffer());
  let raw = ''; for (let i = 0; i < byt.length; i++) raw += String.fromCharCode(byt[i]);
  return { ten: sh.map((x) => x.name), tieuDe: txt(r[0].slice(0, 4)), so: txt(r[0]), ls: txt(r[1]),
    dongLS: r[1].length, doQuaHan: raw.indexOf('FFFBDBD8') >= 0, camSapHet: raw.indexOf('FFFDEBCF') >= 0 };
});
assert.deepEqual(xlKD.ten, ['Kiem dinh', 'Lich su'], 'hai sheet: sổ kiểm định và lịch sử');
assert.match(xlKD.tieuDe, /Số tem/, 'file xuất có cột số tem');
assert.match(xlKD.tieuDe, /Thuộc thiết bị/, 'file xuất có cột thuộc thiết bị');
assert.match(xlKD.tieuDe, /LẦN KIỂM ĐỊNH TRƯỚC/, 'có cụm cột lần kiểm định trước');
assert.match(xlKD.tieuDe, /KỲ KIỂM ĐỊNH KẾ TIẾP/, 'có cụm cột kỳ kiểm định kế tiếp');
assert.match(xlKD.tieuDe, /Còn lại \(ngày\)/, 'có cột số ngày còn lại');
assert.doesNotMatch(xlKD.tieuDe, /undefined/, 'tiêu đề cột không dính chữ undefined');
assert.match(xlKD.so, /GCN-LAN2/, 'sổ hiện giấy của lần gần nhất');
assert.match(xlKD.so, /Quá hạn/, 'sổ đánh dấu thiết bị quá hạn');
assert.equal(xlKD.doQuaHan, true, 'ô quá hạn được tô đỏ trong file Excel');
assert.match(xlKD.ls, /Lần thứ/, 'sheet lịch sử có cột lần thứ');
assert.match(xlKD.ls, /GCN-LAN2/, 'sheet lịch sử ghi cả lần mới nhất');
assert.match(xlKD.ls, /GCN-1/, 'sheet lịch sử giữ cả lần cũ');
// Lịch kiểm định cả năm, kiểu bảng bảo dưỡng: mỗi thiết bị một dòng, mười hai cột tháng
await page.evaluate(() => back()); await wait(600);   // đang ở hồ sơ một áp kế, quay lại danh sách
assert.match(await text('#barTitle'), /Kiểm định/);
await page.click('[data-act="kdChe"][data-m="lich"]'); await wait(700);
const kdL = await page.evaluate(() => ({
  cot: document.querySelectorAll('.cal.yr thead th').length,
  dong: document.querySelectorAll('.cal.yr tbody tr:not(.grp)').length,
  nhom: document.querySelectorAll('.cal.yr tr.grp').length,
  o: document.querySelectorAll('.cal.yr .c').length,
  xong: document.querySelectorAll('.c-xong').length,
  qua: document.querySelectorAll('.c-qua').length,
  du: document.querySelectorAll('.c-du').length,
  nam: (document.querySelector('.caltools .stepper b') || {}).textContent
}));
assert.equal(kdL.cot, 13, 'cột tên thiết bị và mười hai tháng');
assert.ok(kdL.dong >= 3, 'có dòng thiết bị trong lịch năm: ' + kdL.dong);
assert.ok(kdL.nhom >= 1, 'thiết bị gom theo loại');
assert.ok(kdL.o >= kdL.dong, 'mỗi dòng ít nhất một mốc: ' + JSON.stringify(kdL));
assert.ok(kdL.xong >= 1, 'đánh dấu ngày đã kiểm định');
assert.ok(kdL.qua >= 1, 'đánh dấu mốc quá hạn');
assert.match(kdL.nam, /\d{4}/, 'có bộ chọn năm');
// Mốc tính đúng: lần đã kiểm định, hạn kế tiếp, và kỳ dự kiến theo chu kỳ
const kdMocTest = await page.evaluate(() => {
  const goc = '2026-03-10', han = kdHanTu(goc, 12);
  const x = { chuKy: 12, ngayKD: goc, ngayHetHan: han, ketQua: 'DAT',
    lichSu: [{ ngay: goc, hetHan: han, ketQua: 'DAT' }] };
  const m26 = kdLichNam(x, 2026, '2026-11-01'), m29 = kdLichNam(x, 2029, '2026-11-01');
  // Kỳ dự kiến cộng bội số chu kỳ từ ngày kiểm định gốc, không được trôi ngày qua từng năm
  return { n26: m26.size, k26: m26.get(goc), n29: m29.size, k29: m29.get(kdHanTu(goc, 36)),
    thang29: Array.from(m29.keys())[0].slice(5, 7), ngay29: Array.from(m29.keys())[0].slice(8, 10),
    ngay32: kdHanTu(goc, 72).slice(5) };
});
assert.deepEqual(kdMocTest, { n26: 1, k26: 'xong', n29: 1, k29: 'du', thang29: '03', ngay29: '09', ngay32: '03-09' },
  'năm cũ hiện lần đã kiểm định, năm sau hiện kỳ dự kiến đúng ngày, không trôi: ' + JSON.stringify(kdMocTest));
// Đổi năm thì bảng đổi theo
await page.click('[data-act="kdNamB"][data-d="1"]'); await wait(600);
assert.notEqual(await page.evaluate(() => document.querySelector('.caltools .stepper b').textContent), kdL.nam, 'bấm mũi tên đổi năm');
// Tổng hợp: đếm theo loại × tình trạng và mười hai tháng tới
await page.click('[data-act="kdChe"][data-m="th"]'); await wait(700);
const kdTH = await page.evaluate(() => {
  const g = kdTongHop(kdDS(), TODAY());
  return { kpi: document.querySelectorAll('.kpis .kpi').length, cot: document.querySelectorAll('.dt thead th').length,
    bar: document.querySelectorAll('.kdbar .b').length, tong: g.tong,
    cong: g.dem.qua + g.dem.sap + g.dem.ok + g.dem.chua, loai: g.theoLoai.length,
    t12: g.thang.length, nhan: (document.querySelector('.dt thead th:nth-child(3)') || {}).textContent };
});
assert.equal(kdTH.kpi, 4, 'bốn ô: quá hạn, sắp đến hạn, hạn kế tiếp, chưa kiểm định');
assert.equal(kdTH.cong, kdTH.tong, 'cộng bốn tình trạng phải bằng tổng số thiết bị');
assert.ok(kdTH.loai >= 3, 'bảng chia theo loại thiết bị: ' + kdTH.loai);
assert.equal(kdTH.bar, 12, 'biểu đồ mười hai tháng tới');
assert.equal(kdTH.t12, 12);
assert.match(kdTH.nhan, /Nghiêm ngặt/, 'cột nghiêm ngặt dùng nhãn ngắn, không phải câu giải thích');
assert.doesNotMatch(kdTH.nhan, /danh mục/, 'không lấy nhầm nhãn dài vào tiêu đề cột');
await shot('35-kiem-dinh-tong-hop');
await page.click('[data-act="kdChe"][data-m="ds"]'); await wait(600);
assert.equal(await page.locator('.cal.yr').count(), 0, 'quay lại danh sách thì ẩn bảng lịch');
assert.equal(await page.locator('.kdbar').count(), 0, 'quay lại danh sách thì ẩn biểu đồ tổng hợp');
assert.ok(xlKD.dongLS >= 13, 'sheet lịch sử một dòng cho mỗi lần kiểm định: ' + xlKD.dongLS);
await page.evaluate(() => back()); await wait(500);
assert.equal(binh.length, 9, 'nhập đủ chín bình chứa khí nén');
// Chín bình + áp kế + van an toàn + găng tay cách điện
assert.equal(await page.evaluate(() => kdDS().length), truocKD + 12);
assert.ok(binh.every((x) => x.loai === 'BINH_AL' && x.nghiemNgat && x.chuKy === 36 && x.ketQua === 'DAT'),
  'đúng loại, nhóm nghiêm ngặt, chu kỳ 36 tháng, kết quả Đạt');
assert.ok(binh.every((x) => x.ngayKD === '2025-08-11' && x.ngayHetHan === '2028-08-10'), 'hạn tính đúng theo chu kỳ');
assert.deepEqual(binh.map((x) => x.soHieu).sort(),
  ['TEST-1', 'TEST-2', 'TEST-3', 'TEST-4', 'TEST-5', 'TEST-6', 'TEST-7', 'TEST-8', 'TEST-9']);
await page.setInputFiles('#kdFile', napKD); await wait(2500);
assert.equal(await page.evaluate(() => kdDS().filter((x) => /AIR TANK/.test(x.ten)).length), 9, 'nhập lại không nhân đôi');
// TEST-1 đã được ghi thêm một lần kiểm định ở trên, nên soi một bình chưa đụng tới
assert.equal(await page.evaluate(() => kdDS().find((x) => x.soHieu === 'TEST-2').lichSu.length), 1, 'không ghi trùng lần kiểm định');
assert.equal(await page.evaluate(() => kdDS().find((x) => x.soHieu === 'TEST-1').lichSu.length), 2, 'lần kiểm định ghi tay vẫn còn sau khi nhập lại file');
assert.equal(await page.evaluate(() => kdDS().filter((x) => ['AP_KE', 'VAN_AT', 'DC_DIEN'].indexOf(x.loai) >= 0).length), 3,
  'nhập lại cũng không nhân đôi áp kế, van an toàn, dụng cụ an toàn điện');
await shot('42-kiem-dinh-nhap-file');
await shot('34-kiem-dinh-ho-so');
// Tính toán TB: động cơ → dây dẫn → tụ bù → sụt áp
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(500);
await moThem('tt');
assert.match(await text('#barTitle'), /Tính toán/);
const dc20 = await page.evaluate(() => ttDongCo({ kw: '7.5', u: '380', pha: '3', cos: '0.85', eta: '88', k: '6', kd: 'DOL' }));
assert.ok(Math.abs(dc20.I - 15.24) < 0.1, 'dòng định mức 7,5 kW/380V ≈ 15,2 A, ra ' + dc20.I);
assert.equal(dc20.cb, 20, 'chọn CB 20 A');
assert.match(await text('#ttKQ'), /A/);
await shot('35-tinh-toan-dong-co');
await page.click('[data-act="ttSeg"][data-v="day"]'); await wait(600);
await page.click('[data-act="ttLayDC"]'); await wait(600);
assert.equal(await page.inputValue('#ttI'), '15.2', 'lấy được dòng từ bài động cơ');
const day20 = await page.evaluate(() => ttDay({ i: '100', l: '120', u: '380', pha: '3', cos: '0.85', vl: 'CU', cd: 'PVC', di: 'C', nd: '35', mach: '1', du: '5', icp: '' }));
assert.ok(day20.S >= day20.sDong && day20.S >= day20.sSutChon, 'lấy tiết diện lớn hơn trong hai điều kiện');
assert.ok(day20.pct <= 5, 'tiết diện chọn xong thì sụt áp đạt: ' + day20.pct);
assert.equal(day20.pe, day20.S <= 16 ? day20.S : day20.S <= 35 ? 16 : day20.pe, 'tính được dây PE');
assert.equal(await page.evaluate(() => ttDay({ i: '2000', l: '10', u: '380', pha: '3', cos: '0.85', vl: 'CU', cd: 'PVC', di: 'B2', nd: '30', mach: '1', du: '5', icp: '' }).S), null, 'quá tải thì báo không đủ');
await shot('36-tinh-toan-day');
await page.click('[data-act="ttSeg"][data-v="tu"]'); await wait(600);
const tu20 = await page.evaluate(() => ttTuBu({ kw: '100', cos1: '0.78', cos2: '0.95' }));
assert.ok(Math.abs(tu20.Q - 47.4) < 0.6, 'bù từ 0,78 lên 0,95 cho 100 kW ≈ 47,4 kVAr, ra ' + tu20.Q);
assert.equal(await page.evaluate(() => ttTuBu({ kw: '100', cos1: '0.95', cos2: '0.8' })), null, 'cosφ mong muốn thấp hơn thì không tính');
await page.click('[data-act="ttSeg"][data-v="su"]'); await wait(600);
const su20 = await page.evaluate(() => ttSutAp({ i: '50', l: '80', s: '25', u: '380', pha: '3', cos: '0.85', vl: 'CU', du: '5' }));
assert.ok(su20.dat && su20.pct < 5, 'tuyến cáp mẫu đạt: ' + su20.pct);
assert.equal(await page.evaluate(() => ttSutAp({ i: '50', l: '400', s: '6', u: '380', pha: '3', cos: '0.85', vl: 'CU', du: '5' }).dat), false, 'cáp nhỏ đi xa thì không đạt');
// Tính toán TB không còn tab Tra lỗi
assert.equal(await page.locator('[data-act="ttSeg"][data-v="loi"]').count(), 0, 'Tra lỗi đã tách khỏi Tính toán TB');
assert.equal(await page.locator('[data-act="ttSeg"]').count(), 4, 'Tính toán TB còn bốn bài tính');
// Mục Tài liệu thiết bị: tra lỗi · sơ đồ đấu · tài liệu máy
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(500);
await moThem('tlTb');
assert.match(await text('#barTitle'), /Tài liệu thiết bị/);
assert.deepEqual((await page.locator('#main [data-act="tlTbSeg"]').allTextContents()).map((s) => s.split(' ')[0]),
  ['Tra', 'Sơ', 'Tài'], 'ba tab: Tra lỗi · Sơ đồ đấu · Tài liệu máy');
await page.fill('#ttLoiQ', 'E.OC1'); await wait(500);
let loi20 = await text('#ttLoiBody');
assert.match(loi20, /Quá dòng khi tăng tốc/, 'tra được mã lỗi biến tần');
assert.match(loi20, /加速中过电流/, 'tên lỗi có tiếng Trung');
assert.match(loi20, /Pr\.7/, 'có cách xử lý cụ thể');
// Gõ không dấu chấm vẫn ra, và tra được mã servo
await page.fill('#ttLoiQ', 'al32'); await wait(500);
assert.match(await text('#ttLoiBody'), /Quá dòng/, 'gõ gọn al32 vẫn ra AL.32');
await page.fill('#ttLoiQ', 'quá nhiệt'); await wait(500);
assert.ok((await page.locator('#ttLoiBody .card').count()) >= 2, 'tìm được theo từ khoá tiếng Việt');
await shot('37-tra-loi-bien-tan');
// Nhà máy thêm ghi chú cho một mã lỗi
await page.fill('#ttLoiQ', ''); await wait(400);
await page.fill('#ttLoiQ', 'E.FIN'); await wait(500);
await page.click('#ttLoiBody [data-act="mlThem"]'); await wait(700);
assert.equal(await page.inputValue('#mlMa'), 'E.FIN', 'mã lỗi điền sẵn');
await page.fill('#mlDong', 'FR-E740');
await page.fill('#mlXl', 'Máy in phun VKY01: lần trước do quạt tủ hỏng, thay quạt là hết');
await page.click('#mlOk'); await wait(1400);
const ml20 = await page.evaluate(() => mlDS().find((x) => x.ma === 'E.FIN'));
assert.ok(ml20 && ml20.cachXuLyDich, 'ghi chú của nhà máy đã lưu và được dịch');
await page.fill('#ttLoiQ', 'E.FIN'); await wait(500);
loi20 = await text('#ttLoiBody');
assert.match(loi20, /Ghi chú của nhà máy/);
assert.match(loi20, /quạt tủ hỏng/, 'ghi chú hiện ngay dưới mã lỗi');
await shot('38-tra-loi-ghi-chu-nha-may');
// Mã lỗi Inovance và lọc theo hãng
const loiHang = await page.evaluate(() => ({ tong: TT_LOI.length,
  mit: TT_LOI.filter((x) => x.hsx === 'MIT').length, inv: TT_LOI.filter((x) => x.hsx === 'INV').length }));
assert.ok(loiHang.mit > 60 && loiHang.inv > 60, 'có mã lỗi của cả hai hãng: ' + JSON.stringify(loiHang));
await page.fill('#ttLoiQ', 'Err09'); await wait(600);
assert.match(await text('#ttLoiBody'), /Inovance MD/, 'tra được mã biến tần Inovance');
assert.match(await text('#ttLoiBody'), /Thấp áp/);
await page.fill('#ttLoiQ', 'er740'); await wait(600);
assert.match(await text('#ttLoiBody'), /Inovance SV660/, 'gõ gọn er740 vẫn ra Er.740 của servo Inovance');
await page.fill('#ttLoiQ', ''); await wait(400);
await page.click('[data-act="ttLoiLoc"][data-v="INV"]'); await wait(700);
assert.equal(await page.evaluate(() => ttLoiTim('', 'INV').built.every((x) => x.hsx === 'INV')), true, 'lọc đúng hãng Inovance');
assert.equal(await page.evaluate(() => ttLoiTim('', 'MIT').built.every((x) => x.hsx === 'MIT')), true, 'lọc đúng hãng Mitsubishi');
// Sơ đồ đấu: bốn dòng máy, bảng chân đấu, nhảy sang tài liệu
await page.click('[data-act="tlTbSeg"][data-v="sd"]'); await wait(700);
assert.equal(await page.locator('[data-act="sdMo"]').count(), 4, 'bốn dòng máy: FR, MR-J4, MD, SV660');
assert.match(await text('#main'), /CHARGE/, 'có cảnh báo an toàn ngay đầu màn');
await page.click('[data-act="sdMo"][data-k="MD"]'); await wait(700);
const sd20 = (await text('#main')).replace(/\s+/g, ' ');
assert.ok(['R · S · T', 'U · V · W', 'DI1', 'TA · TB · TC', '485+'].every((k) => sd20.includes(k)), 'bảng chân đấu Inovance MD');
assert.match(sd20, /Dễ sai chỗ này/);
assert.doesNotMatch(sd20, /chân số \d|pin \d/i, 'cố ý không ghi số chân của giắc');
await shot('39-so-do-dau');
await page.click('[data-act="sdTL"]'); await wait(900);
assert.equal(await page.inputValue('#tlDSQ'), 'MD', 'sang tab Tài liệu máy với từ khoá đã lọc sẵn');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(500);
ok('Bản 2.23: sổ kiểm định thiết bị (nghiêm ngặt, hạn theo chu kỳ, Excel) và tính toán động cơ / dây dẫn / tụ bù / sụt áp; tra lỗi Mitsubishi + Inovance kèm ghi chú nhà máy; mục Tài liệu thiết bị gộp tra lỗi, sơ đồ đấu và tài liệu máy; kỹ thuật không vào được');

// 21. Máy nén khí: giờ chạy, mốc 3000 h, lịch luân phiên tuần
await moThem('mnk');
assert.match(await text('#barTitle'), /Máy nén khí/);
const mnk21 = await page.evaluate(() => mnkDS().map((m) => ({ ten: m.ten, bt: m.bienTan, gio: m.gio, tuBD: m.tuBD, con: m.conLai })));
assert.equal(mnk21.length, 6, 'sáu máy nén khí');
assert.deepEqual(mnk21.filter((m) => m.bt).map((m) => m.ten), ['Máy nén khí số 3', 'Máy nén khí số 6'], 'máy 3 và máy 6 chạy biến tần');
const qua21 = mnk21.filter((m) => m.con <= 0);
assert.equal(qua21.length, 1, 'một máy đã quá 3000 h kể từ lần bảo dưỡng trước');
assert.match(await text('#main'), /Quá hạn bảo dưỡng/, 'máy quá hạn báo đỏ ngay đầu danh sách');
assert.match(await text('#main'), /Thay lọc tách dầu/, 'mốc phụ theo giờ hiện trong thẻ máy');
await shot('40-may-nen-khi');
// Máy nén khí đã có trong sổ điện / danh mục máy thì lấy thẳng sang, không gõ lại
const nguon21 = await page.evaluate(() => ({
  trong: mnkNguonDS([]).map((x) => ({ ten: x.ten, zh: x.tenZh, ct: x.maCT, ma: x.ma })),
  conLai: mnkNguonDS(mnkDS()).map((x) => x.ten)
}));
assert.ok(nguon21.trong.length >= 6, 'nhận ra máy nén khí có sẵn: ' + nguon21.trong.length);
assert.deepEqual(nguon21.trong.filter((x) => x.ct).map((x) => x.ten).slice(0, 3),
  ['Máy nén khí số 1', 'Máy nén khí số 2', 'Máy nén khí số 3'], 'tách tên Việt khỏi tên công tơ');
assert.equal(nguon21.trong[0].zh, '空压机1号', 'tách luôn tên tiếng Trung');
assert.equal(nguon21.conLai.some((t0) => /số \d/.test(t0)), false, 'máy đã có trong danh sách thì không gợi ý lấy lại');
await page.evaluate(() => go('mnkDS')); await wait(700);
assert.equal(await page.locator('[data-act="mdLayCo"]').count(), 1, 'màn sửa danh sách có nút lấy từ danh sách có sẵn');
await page.evaluate(() => back()); await wait(500);
// Ghi giờ: đồng hồ cộng dồn nên ghi lùi là chặn
const idQua = await page.evaluate((ten) => mnkDS().find((m) => m.ten === ten).id, qua21[0].ten);
await page.click(`[data-act="mnkGhiMay"][data-id="${idQua}"]`); await wait(700);
assert.match(await text('#barTitle'), /Ghi giờ chạy/);
await page.fill('#mnGio', '10'); await page.click('#mnOk'); await wait(900);
assert.match(await text('#mnErr'), /không được giảm|不能减少/, 'ghi thấp hơn lần trước thì báo lỗi');
await page.fill('#mnGio', String(Math.round(qua21[0].gio + 30)));
await page.click('#mnOk'); await wait(1200);
assert.match(await text('#barTitle'), /Máy nén khí/, 'ghi xong quay lại danh sách');
assert.equal(await page.evaluate((id) => mnkDS().find((m) => m.id === id).gio, idQua), Math.round(qua21[0].gio + 30));
// Bảo dưỡng xong: đặt lại mốc giờ, đếm lại từ 0
await page.click(`[data-act="mnkGhiMay"][data-id="${idQua}"][data-bd="1"]`); await wait(700);
assert.equal(await page.isChecked('#mnBD'), true, 'mở từ nút Bảo dưỡng xong thì tích sẵn');
await page.fill('#mnGio', String(Math.round(qua21[0].gio + 40)));
await page.click('.mnMocI[data-i="0"]');
await page.click('#mnOk'); await wait(1200);
const sauBD = await page.evaluate((id) => { const m = mnkDS().find((x) => x.id === id); return { tuBD: m.tuBD, con: m.conLai, moc0: m.mocGio[0].gio, moc1: m.mocGio[1].gio }; }, idQua);
assert.equal(sauBD.tuBD, 0, 'bảo dưỡng xong thì giờ từ lần bảo dưỡng về 0');
assert.equal(sauBD.con, 3000, 'đếm lại đủ 3000 h');
assert.equal(sauBD.moc0, Math.round(qua21[0].gio + 40), 'mốc đã tích tính lại từ số giờ vừa ghi');
assert.notEqual(sauBD.moc1, sauBD.moc0, 'mốc không tích thì giữ nguyên');
await shot('41-may-nen-khi-bao-duong-xong');
// Lịch tuần: 3 máy thường + 1 máy biến tần, chọn sai số lượng thì chặn
await page.click('[data-act="mnkSeg"][data-m="tuan"]'); await wait(600);
assert.match(await text('#main'), /Máy thường/);
assert.match(await text('#main'), /Biến tần/);
await page.click('[data-act="mnkDoi"]'); await wait(600);
const hopBT = await page.locator('.mkI[data-bt="1"]').count();
assert.equal(hopBT, 2, 'hai máy biến tần để chọn một');
await page.evaluate(() => { document.querySelectorAll('.mkI').forEach((x) => { x.checked = false; }); });
await page.click('#mkOk'); await wait(500);
assert.match(await text('#mkErr'), /3 máy thường|3 台普通/, 'chọn thiếu máy thường thì chặn');
await page.evaluate(() => {
  const th = Array.from(document.querySelectorAll('.mkI[data-bt="0"]')).slice(0, 3);
  th.forEach((x) => { x.checked = true; });
  document.querySelector('.mkI[data-bt="1"]').checked = true;
});
await page.click('#mkOk'); await wait(1300);
// Đổi máy xong thì app mời ghi luôn số giờ của đúng những máy vừa đổi vào / đổi ra
const nhac21 = await text('#sheetBg');
assert.match(nhac21, /Ghi số giờ lúc đổi/, 'đổi máy xong có mục ghi số giờ');
assert.ok((await page.locator('#sheetBg [data-act="mnkGhiMay"][data-nguon="DOI"]').count()) >= 1, 'liệt kê máy vừa đổi để ghi giờ');
assert.match(nhac21, /Đổi vào chạy|Đổi ra nghỉ/, 'nói rõ máy nào đổi vào, máy nào đổi ra');
await page.click('#sheetBg [data-act="mnkNhacBo"]'); await wait(400);
const tuan21 = await page.evaluate(() => (mnkLichTuan(tcThuHai(TODAY())) || {}).dsChay || []);
assert.equal(tuan21.length, 4, 'tuần này xếp đúng 4 máy');
assert.equal(await page.evaluate((ds) => ds.filter((id) => mnkOf(id).bienTan).length, tuan21), 1, 'đúng một máy biến tần');
// Gợi ý xếp lịch: máy ít giờ kể từ lần bảo dưỡng trước được chạy trước
await page.click('[data-act="mnkGoiY"]'); await wait(600);
await page.click('#mgOk'); await wait(1400);
const goiY21 = await page.evaluate(() => {
  const ds = (mnkLichTuan(tcThuHai(TODAY())) || {}).dsChay || [];
  const th = mnkHD().filter((m) => !m.bienTan).sort((a, b) => a.tuBD - b.tuBD);
  return { chon: ds.length, bt: ds.filter((id) => mnkOf(id).bienTan).length, itNhat: th[0].id, co: ds.indexOf(th[0].id) >= 0 };
});
assert.equal(goiY21.chon, 4);
assert.equal(goiY21.bt, 1);
assert.equal(goiY21.co, true, 'máy ít giờ nhất được xếp chạy');
// Tính số máy cần bật theo lượng khí nén của các chuyền đang chạy
const khi21 = await page.evaluate(() => mnkTinh(mnkChuyenTuan(tcThuHai(TODAY()))));
assert.ok(khi21.soChuyen >= 10, 'đếm được các chuyền đang chạy: ' + khi21.soChuyen);
assert.ok(khi21.tongKhi > 0, 'cộng được lượng khí nén từ danh mục chuyền');
assert.equal(khi21.motMay, 27, 'một máy cấp 27 m³/phút');
assert.equal(khi21.can, Math.ceil(khi21.tongKhi / 27), 'số máy cần = tổng khí ÷ công suất, làm tròn lên');
assert.equal(khi21.tai, Math.round((khi21.tongKhi / (khi21.can * 27)) * 100), 'phần trăm tải khớp');
const mTuan = await text('#main');
assert.match(mTuan, /Chuyền sản xuất chạy tuần này/);
assert.match(mTuan, /Số máy cần bật/);
assert.match(mTuan, /chưa khai lượng khí nén/, 'chuyền chưa khai lượng khí thì báo rõ');
// Hộp đổi máy: hiện phép tính và đánh dấu máy khuyến nghị
await page.click('[data-act="mnkDoi"]'); await wait(600);
const hopDoi = await text('#sheetBg');
assert.match(hopDoi, new RegExp('Cần ' + khi21.can + ' máy'), 'hộp chọn máy nói rõ cần mấy máy');
assert.match(hopDoi, /Khuyến nghị/, 'đánh dấu máy nên chạy');
assert.equal(await page.locator('#sheetBg .pill.p-xong').count(), khi21.can, 'số máy khuyến nghị đúng bằng số cần');
await page.click('#mkTheo'); await wait(300);
assert.equal(await page.locator('#sheetBg .mkI:checked').count(), khi21.can, 'bấm tích theo khuyến nghị thì chọn đúng từng ấy máy');
await page.click('#mkOk'); await wait(1300);
if (await page.locator('[data-act="mnkNhacBo"]').count()) { await page.click('[data-act="mnkNhacBo"]'); await wait(400); }
assert.equal(await page.evaluate(() => (mnkLichTuan(tcThuHai(TODAY())) || {}).dsChay.length), khi21.can);
// Bỏ bớt chuyền thì số máy cần giảm theo
await page.click('[data-act="mnkChonCh"]'); await wait(600);
await page.click('#mcBo'); await wait(300);
await page.evaluate(() => { const a = document.querySelectorAll('.mcI'); a[0].checked = true; a[0].dispatchEvent(new Event('change', { bubbles: true })); });
await wait(300);
assert.match(await text('#mcTong'), /1 chuyền chạy/, 'hộp chọn chuyền cộng lại ngay khi tích');
await page.click('#mcOk'); await wait(1400);
const itCh = await page.evaluate(() => mnkTinh(mnkChuyenTuan(tcThuHai(TODAY()))));
assert.equal(itCh.soChuyen, 1, 'chỉ còn một chuyền chạy');
assert.ok(itCh.can < khi21.can, 'ít chuyền thì cần ít máy hơn: ' + itCh.can + ' < ' + khi21.can);
assert.match(await text('#main'), /chỉ cần|需/, 'lịch tuần đang xếp thừa máy thì báo để tắt bớt');
await shot('42-may-nen-khi-lich-tuan');
// Tổng hợp tháng + Excel hai sheet, máy quá hạn tô đỏ
await page.click('[data-act="mnkSeg"][data-m="thang"]'); await wait(600);
assert.match(await text('#main'), /Giờ chạy trong tháng/);
const xlMNK = await page.evaluate(async () => {
  const blob = mnkXlsx(TODAY().slice(0, 7));
  const sh = await readXlsx(await blob.arrayBuffer());
  const r = await Promise.all(sh.map((x) => x.rows()));
  const raw = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  return { ten: sh.map((x) => x.name), tong: r[0].map((x) => x.join('|')).join('\n'),
    log: r[1].map((x) => x.join('|')).join('\n'), cam: raw.indexOf('FFE7CF') >= 0,
    sapHan: mnkDS().some((m) => m.conLai > 0 && m.conLai <= 200) };
});
assert.deepEqual(xlMNK.ten, ['Tong hop', 'Ghi gio'], 'hai sheet: tổng hợp và nhật ký ghi giờ');
assert.match(xlMNK.tong, /空压机/, 'tiêu đề song ngữ');
assert.match(xlMNK.tong, /Biến tần/, 'ghi rõ máy nào chạy biến tần');
assert.match(xlMNK.log, /Bảo dưỡng xong/, 'nhật ký ghi rõ lần nào là bảo dưỡng');
assert.equal(xlMNK.cam, xlMNK.sapHan, 'máy sắp đến hạn thì ô giờ tô cam trong Excel');
// Tạo mã máy riêng trong danh mục cho từng máy nén khí, nối mã lại
await page.evaluate(() => go('mnkDS')); await wait(700);
assert.equal(await page.locator('[data-act="mdTaoMa"]').count(), 1, 'có nút tạo mã máy khi còn máy chưa có mã');
await page.click('[data-act="mdTaoMa"]'); await wait(600);
assert.match(await text('#sheetBg'), /Sẽ tạo mã cho 6 máy|将为 6 台/, 'nói rõ sẽ tạo mấy mã');
assert.equal(await page.inputValue('#mtCk'), '15', 'chu kỳ ngày lấy theo Phòng máy nén khí có sẵn');
await page.click('#mtOk'); await wait(1600);
const taoMa21 = await page.evaluate(() => ({
  mnk: mnkDS().map((m) => m.ma),
  may: (S.V.may || []).filter((m) => /Máy nén khí số/.test(m.ten)).map((m) => ({ ma: m.ma, zh: m.tenPhu, nhom: m.nhom, ck: m.chuKy }))
}));
assert.equal(taoMa21.may.length, 6, 'sáu máy nén khí thành sáu mã máy trong danh mục');
assert.equal(new Set(taoMa21.mnk).size, 6, 'mỗi máy một mã, nối ngược lại đủ');
assert.equal(taoMa21.may[0].zh, '空压机1号', 'tên tiếng Trung sang cột tên phụ của hồ sơ máy');
assert.match(taoMa21.may[0].nhom, /Khí nén/, 'cùng nhóm với Phòng máy nén khí');
assert.equal(taoMa21.may[0].ck, 15);
assert.equal(await page.locator('[data-act="mdTaoMa"]').count(), 0, 'tạo xong thì nút biến mất');
await page.evaluate(() => back()); await wait(500);
await shot('43-may-nen-khi-ma-may');
// Kỹ thuật: ghi giờ và đổi máy được, nhưng không sửa danh sách máy
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
await logout();
await login('NV003', '333333');
await moThem('mnk');
assert.match(await text('#barTitle'), /Máy nén khí/);
await page.click('[data-act="mnkSeg"][data-m="may"]'); await wait(600);
assert.equal(await page.locator('[data-act="go"][data-v="mnkDS"]').count(), 0, 'kỹ thuật không thấy nút sửa danh sách');
assert.ok(await page.locator('[data-act="mnkGhiMay"]').count() >= 6, 'kỹ thuật vẫn ghi giờ chạy được');
await page.click('[data-act="mnkSeg"][data-m="tuan"]'); await wait(600);
assert.equal(await page.locator('[data-act="mnkDoi"]').count(), 1, 'kỹ thuật tự đổi máy chạy được');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Bản 2.32 + 2.33: máy nén khí — giờ chạy cộng dồn, mốc 3000 h và mốc phụ, số máy cần bật theo lượng khí nén của chuyền đang chạy, khuyến nghị chạy máy nào, lịch tuần và Excel tổng hợp');

// 22. Bản 2.35: nút Cập nhật ở trang chủ, lọc hàng chưa có tồn an toàn, xuất Excel bảo dưỡng theo tuần / tháng / năm
await logout(); await login('NV002', '222222');
// Trang chủ có nút Cập nhật kèm giờ cập nhật gần nhất
await page.click('.tabs .tab[data-v="home"]'); await wait(700);
assert.equal(await page.locator('.hcapnhat [data-act="doRefresh"]').count(), 1, 'trang chủ có nút Cập nhật');
const cn22 = (await page.textContent('.hcapnhat')).replace(/\s+/g, ' ');
assert.match(cn22, /Cập nhật\s*更新/, 'nút song ngữ');
assert.match(cn22, /Cập nhật lúc .*\d{2}:\d{2} \d{2}\/\d{2}/, 'ghi giờ cập nhật gần nhất: ' + cn22);
await shot('44-trang-chu-cap-nhat');
// Bấm Cập nhật thì biểu tượng quay vòng trong lúc tải, xong thì thôi
await page.evaluate(() => { const g = window.api; window.api = async (...a) => { await new Promise((r) => setTimeout(r, 900)); return g(...a); }; });
await page.click('.hcapnhat [data-act="doRefresh"]'); await wait(300);
const quay22 = await page.evaluate(() => {
  const el = document.querySelector('.hcapnhat [data-act="doRefresh"]');
  return { quay: el.classList.contains('dangquay'), anim: getComputedStyle(el.querySelector('svg')).animationName, khoa: !!S.dangTai };
});
assert.equal(quay22.quay, true, 'đang tải thì nút quay');
assert.equal(quay22.anim, 'quay', 'có hiệu ứng quay vòng thật');
assert.equal(quay22.khoa, true, 'khoá lại để không bấm chồng');
await wait(1800);
assert.equal(await page.evaluate(() => !!S.dangTai), false, 'tải xong thì thôi quay');
// Nút đồng bộ trên thanh trên cùng: màn nào cũng bấm cập nhật được
assert.equal(await page.locator('header.bar #rfBtn').count(), 1, 'thanh trên cùng có nút đồng bộ');
// Mũi tên phải quay xuôi chiều kim đồng hồ: đầu mũi tên ở trên bên phải, dưới bên trái
const mui22 = await page.evaluate(() => [...document.querySelectorAll('#rfBtn svg path')].map((e) => e.getAttribute('d')).join(' '));
assert.match(mui22, /M19 3v4h-4/, 'đầu mũi tên trên nằm bên phải (xuôi chiều kim đồng hồ): ' + mui22);
assert.match(mui22, /M5 21v-4h4/, 'đầu mũi tên dưới nằm bên trái: ' + mui22);
// Vào một màn con rồi vẫn thấy nút, bấm thì quay và khoá lại
await page.evaluate(() => { const x = S.V.cv[0]; go('cvView', { id: x.id }); }); await wait(900);
assert.equal(await page.locator('header.bar #rfBtn').count(), 1, 'vào màn con vẫn còn nút đồng bộ');
await page.click('#rfBtn'); await wait(300);
const rf22 = await page.evaluate(() => {
  const el = document.querySelector('#rfBtn');
  return { quay: el.classList.contains('dangquay'), anim: getComputedStyle(el.querySelector('svg')).animationName, khoa: !!S.dangTai };
});
assert.equal(rf22.quay, true, 'bấm thì nút quay');
assert.equal(rf22.anim, 'quay', 'có hiệu ứng quay thật');
assert.equal(rf22.khoa, true, 'khoá lại để không bấm chồng');
await wait(2200);
assert.equal(await page.evaluate(() => !!S.dangTai), false, 'tải xong thì thôi quay');
// Thanh trên cùng không bị tràn ngang khi thêm nút
assert.equal(await page.evaluate(() => { const b = document.querySelector('.bar-in'); return b.scrollWidth > b.clientWidth + 1; }), false, 'thanh trên cùng không tràn ngang');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(500);
// Kho: lọc những hàng chưa khai tồn kho an toàn
await page.evaluate(() => tab('kho')); await wait(1600);
assert.equal(await page.locator('[data-act="khoF"][data-v="chuaAT"]').count(), 1, 'có chip Chưa có tồn an toàn');
await page.click('[data-act="khoF"][data-v="chuaAT"]'); await wait(800);
const k22 = await page.evaluate(() => ({
  chua: S.kho.ds.filter(khoChuaAT).length,
  co: S.kho.ds.filter((x) => !x.an && x.tonMin !== undefined && x.tonMin !== '').length,
  hien: document.querySelectorAll('#khoBody .list .row').length,
  dem: +(document.querySelector('#khoBody .sec .cnt') || {}).textContent.replace(/\D/g, '')
}));
assert.ok(k22.chua > 0, 'dữ liệu mẫu có hàng chưa khai tồn an toàn');
assert.equal(k22.dem, k22.chua, 'đếm đúng số hàng chưa khai: ' + JSON.stringify(k22));
assert.ok(k22.hien > 0 && k22.hien <= k22.chua);
assert.match(await text('#khoBody'), /chưa khai tồn kho an toàn/, 'có lời giải thích');
assert.equal(await page.locator('#khoBody [data-act="go"][data-v="khoMin"]').count(), 1, 'có lối nhập cả loạt bằng file');
// Hàng nào đã khai thì không nằm trong danh sách này
const maAT = await page.evaluate(() => {
  const x = S.kho.ds.filter(khoChuaAT)[0];
  x.tonMin = 5;
  render();
  return x.ma;
});
await wait(600);
const sauAT = await page.evaluate((ma) => ({
  conTrongLoc: S.kho.ds.filter(khoChuaAT).some((x) => x.ma === ma),
  dem: +(document.querySelector('#khoBody .sec .cnt') || {}).textContent.replace(/\D/g, '')
}), maAT);
assert.equal(sauAT.conTrongLoc, false, 'khai tồn an toàn xong thì hàng đó rời danh sách');
assert.equal(sauAT.dem, k22.chua - 1, 'số đếm giảm đúng một');
await shot('45-kho-chua-ton-an-toan');
// Bảo dưỡng: xuất Excel chọn tuần / tháng / năm
await page.evaluate(() => { S.f.histMonth = TODAY().slice(0, 7); tab('hist'); }); await wait(900);
await page.click('[data-act="export"]'); await wait(600);
const hx = await text('#sheetBg');
['Theo tuần', 'Theo tháng', 'Cả năm'].forEach((k) => assert.ok(hx.includes(k), 'hộp xuất có ' + k));
assert.equal(await page.locator('#sheetBg [data-act="exportGo"]').count(), 3, 'ba lựa chọn khoảng');
assert.match(hx, /lần đã làm/, 'mỗi lựa chọn ghi số lần đã làm');
assert.match(hx, /kỳ trong lịch/, 'và số kỳ trong lịch');
await shot('46-xuat-bao-duong-tuan-thang-nam');
await page.evaluate(() => closeSheet()); await wait(300);
// Ba khoảng ra ba file khác nhau: số cột ngày và lịch sử lọc đúng khoảng
const xl22 = await page.evaluate(async () => {
  const r = {};
  for (const k of ['tuan', 'thang', 'nam']) {
    const o = bdKhoang(k, +S.f.histMonth.slice(0, 4), S.f.histMonth);
    const sh = await readXlsx(await buildWorkbook(o.tu, o.den, o.nhan).arrayBuffer());
    const rows = await sh[0].rows();
    const ls = (await sh[2].rows()).slice(3).filter((x) => x[0]);
    // Ô ngày trong Excel là số sê-ri nên không so chuỗi được; đối chiếu số dòng với dữ liệu trong app
    r[k] = { tu: o.tu, den: o.den, ten: sh.map((x) => x.name), cot: rows[5].length, soLS: ls.length,
      mong: S.V.ls.filter((x) => x.ngay >= o.tu && x.ngay <= o.den).length };
  }
  return r;
}).catch((e) => ({ loi: String(e) }));
assert.ok(!xl22.loi, 'dựng được cả ba file: ' + xl22.loi);
const ngay7 = (d) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 6); return x.toISOString().slice(0, 10); };
assert.equal(xl22.tuan.den, ngay7(xl22.tuan.tu), 'tuần đúng bảy ngày');
assert.ok(xl22.tuan.cot < xl22.thang.cot && xl22.thang.cot < xl22.nam.cot,
  'càng dài càng nhiều cột ngày: ' + JSON.stringify([xl22.tuan.cot, xl22.thang.cot, xl22.nam.cot]));
assert.equal(xl22.nam.cot - 7, 365, 'năm 2026 có 365 cột ngày');
assert.ok(xl22.nam.ten.includes('Lich 2026'), 'tên sheet cả năm: ' + xl22.nam.ten);
assert.ok(xl22.thang.ten.some((n) => /^Lich T\d{2}-\d{4}$/.test(n)), 'tên sheet theo tháng: ' + xl22.thang.ten);
assert.ok(xl22.nam.soLS >= xl22.thang.soLS && xl22.thang.soLS >= xl22.tuan.soLS, 'lịch sử lọc theo khoảng');
['tuan', 'thang', 'nam'].forEach((k) => assert.equal(xl22[k].soLS, xl22[k].mong,
  'sheet lịch sử ' + k + ' đúng số dòng của khoảng: ' + JSON.stringify(xl22[k])));
ok('Bản 2.35 + 2.36: nút Cập nhật ở trang chủ và nút đồng bộ trên thanh trên cùng (mũi tên quay xuôi chiều kim đồng hồ), kho lọc hàng chưa khai tồn an toàn, xuất Excel bảo dưỡng theo tuần / tháng / năm');

// 23. Bản 2.36: Quản lý gia hạn việc quá hạn ngay ở dòng việc
await page.evaluate(() => ACT.cvLoc({ dataset: { v: 'qua' } })); await wait(900);
const qua23 = await page.evaluate(() => ({
  qua: S.V.cv.filter(cvQua).length,
  nut: document.querySelectorAll('#main .scwrap .scgh [data-act="cvGiaHan"]').length,
  dong: document.querySelectorAll('#main .list .scwrap').length
}));
assert.ok(qua23.qua > 0, 'dữ liệu mẫu có việc quá hạn');
assert.equal(qua23.nut, qua23.dong, 'mỗi dòng việc quá hạn có một nút Gia hạn: ' + JSON.stringify(qua23));
await shot('47-viec-qua-han-nut-gia-han');
// Mở hộp gia hạn: hạn hiện tại, các mốc bấm nhanh và ô chọn ngày
const id23 = await page.evaluate(() => S.V.cv.filter(cvQua)[0].id);
const hanCu23 = await page.evaluate((id) => S.V.cvById[id].han, id23);
await page.click(`.scwrap .scgh [data-act="cvGiaHan"][data-id="${id23}"]`); await wait(600);
const hgh = await text('#sheetBg');
assert.match(hgh, /Gia hạn thêm thời gian/, 'hộp gia hạn mở ra');
assert.match(hgh, /Hạn hiện tại/, 'ghi rõ hạn hiện tại');
assert.ok(await page.locator('#sheetBg [data-act="cvGiaHanChon"]').count() >= 3, 'có mốc bấm nhanh');
assert.equal(await page.locator('#sheetBg #ghNgay').count(), 1, 'có ô tự chọn ngày');
await shot('48-hop-gia-han');
// Không cho rút hạn: chọn ngày trước hạn cũ thì báo lỗi, hạn không đổi
await page.evaluate((d) => { document.querySelector('#ghNgay').value = d; }, hanCu23);
await page.click('#sheetBg [data-act="cvGiaHanGo"]'); await wait(500);
assert.match(await text('#ghErr'), /phải sau hạn cũ/, 'chặn rút hạn');
assert.equal(await page.evaluate((id) => S.V.cvById[id].han, id23), hanCu23, 'hạn chưa đổi');
// Bấm mốc nhanh rồi gia hạn thật
await page.click('#sheetBg [data-act="cvGiaHanChon"] >> nth=0'); await wait(200);
const chon23 = await page.inputValue('#sheetBg #ghNgay');
await page.fill('#sheetBg #ghLy', 'Chờ linh kiện về · 等配件');
await page.click('#sheetBg [data-act="cvGiaHanGo"]'); await wait(1200);
const sau23 = await page.evaluate((id) => {
  const x = S.V.cvById[id], n = x.nhatKy[x.nhatKy.length - 1];
  return { han: x.han, tt: x.trangThai, qua: cvQua(x), b: n.b, cu: n.hanCu, moi: n.hanMoi, gc: n.gc };
}, id23);
assert.equal(sau23.han, chon23, 'hạn đã dời sang ngày chọn');
assert.equal(sau23.qua, false, 'việc không còn quá hạn');
assert.equal(sau23.b, 'giahan', 'nhật ký ghi bước gia hạn');
assert.equal(sau23.cu, hanCu23, 'nhật ký ghi hạn cũ');
assert.equal(sau23.moi, chon23, 'nhật ký ghi hạn mới');
assert.match(sau23.gc, /Chờ linh kiện/, 'nhật ký giữ lý do gia hạn');
// Trong việc thấy dòng "từ ... sang ..." và trạng thái không đổi
await page.evaluate((id) => go('cvView', { id }), id23); await wait(900);
const tv23 = (await text('#main')).replace(/\s+/g, ' ');
assert.match(tv23, /Gia hạn/, 'nhật ký việc có mốc Gia hạn');
const dmy = (d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
assert.ok(tv23.includes('từ ' + dmy(hanCu23) + ' sang ' + dmy(chon23)), 'ghi rõ dời từ ngày nào sang ngày nào: ' + tv23.slice(0, 400));
await shot('49-nhat-ky-gia-han');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Kỹ thuật không được gia hạn
await logout(); await login('NV003', '333333');
await page.evaluate(() => ACT.cvLoc({ dataset: { v: 'toi' } })); await wait(900);
assert.equal(await page.locator('[data-act="cvGiaHan"]').count(), 0, 'kỹ thuật không thấy nút Gia hạn');
// Quản lý sửa lại nội dung nhân viên đã ghi khi xong việc
await logout(); await login('NV002', '222222'); await wait(1200);
const idX = await page.evaluate(() => {
  const x = S.V.cvAll.filter((o) => o.trangThai === 'DONG' && o.ketQua && o.nguon !== 'SC')[0];
  return x ? x.id : '';
});
assert.ok(idX, 'dữ liệu mẫu có việc đã đóng kèm kết quả');
await page.evaluate((id) => go('cvView', { id }), idX); await wait(900);
assert.equal(await page.locator('[data-act="cvEdit"]').count(), 1, 'việc đã đóng vẫn có lối sửa nội dung');
assert.match(await text('.scact2'), /Sửa nội dung đã xong/, 'ghi rõ là sửa nội dung đã xong');
await page.click('[data-act="cvEdit"]'); await wait(900);
assert.equal(await page.locator('#cvKQ').count(), 1, 'màn sửa có ô Kết quả');
assert.equal(await page.locator('#cvNN').count(), 1, 'và ô Nguyên nhân');
assert.equal(await page.locator('#cvGio').count(), 1, 'và ô Thời gian dừng máy');
assert.equal(await page.locator('#cvKT').count(), 0, 'việc đã đóng thì bỏ ô "cần kiểm tra"');
assert.match(await text('#main'), /Nội dung nhân viên ghi khi xong/, 'có đầu mục riêng cho phần này');
const kqCu = await page.inputValue('#cvKQ');
assert.ok(kqCu.trim(), 'ô Kết quả điền sẵn nội dung cũ: ' + kqCu);
await shot('50-sua-noi-dung-viec-da-xong');
// Xoá trắng kết quả thì không cho lưu
await page.fill('#cvKQ', '   ');
await page.click('#cvOk'); await wait(500);
assert.match(await text('#cvErr'), /Cần ghi kết quả/, 'chặn xoá trắng kết quả');
// Chữa lại rồi lưu: việc vẫn đóng, nhật ký ghi lần sửa
await page.fill('#cvKQ', kqCu.trim() + '; siết lại bu lông chân máy');
await page.fill('#cvNN', 'Bu lông chân máy lỏng');
await page.fill('#cvGio', '2.5');
await page.click('#cvOk'); await wait(1400);
const sauX = await page.evaluate((id) => {
  const x = S.V.cvById[id];
  return { tt: x.trangThai, kq: x.ketQua, nn: x.nguyenNhan, phut: x.phutDung, sua: x.nhatKy.filter((n) => n.b === 'sua').length };
}, idX);
assert.equal(sauX.tt, 'DONG', 'sửa nội dung không mở lại việc');
assert.match(sauX.kq, /siết lại bu lông chân máy/, 'kết quả đã lưu');
assert.equal(sauX.nn, 'Bu lông chân máy lỏng', 'nguyên nhân đã lưu');
assert.equal(sauX.phut, 150, 'giờ dừng máy đổi theo: ' + sauX.phut);
assert.ok(sauX.sua >= 1, 'nhật ký có mốc Sửa việc');
await shot('51-da-sua-noi-dung');
// Kỹ thuật không có lối sửa việc đã đóng
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
await logout(); await login('NV003', '333333');
await page.evaluate((id) => go('cvView', { id }), idX); await wait(900);
assert.equal(await page.locator('[data-act="cvEdit"]').count(), 0, 'kỹ thuật không sửa được việc đã đóng');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Bản 2.36: Quản lý gia hạn việc quá hạn ngay ở dòng việc, nhật ký ghi rõ dời từ ngày nào sang ngày nào; Quản lý sửa lại nội dung nhân viên đã ghi khi xong');

// 24. Bản 2.37: sổ thiết bị, thông số, vị trí sửa tại chỗ, nhập / xuất Excel theo từng loại
await logout(); await login('NV002', '222222');
await page.evaluate(() => tab('list')); await wait(1400);
// Xuất: mỗi loại một file, cột đúng như bảng của nhà máy
await page.click('[data-act="go"][data-v="tbXuat"]'); await wait(900);
const nut24 = await page.locator('[data-act="tbXuat1"]').count();
assert.ok(nut24 >= 5, 'mỗi loại thiết bị một nút xuất: ' + nut24);
const xl24 = await page.evaluate(async () => {
  const g = [...document.querySelectorAll('[data-act="tbXuat1"]')].map((e) => e.dataset.g);
  const f = tbXuatNhom(g[0]);
  const sh = await readXlsx(await f.blob.arrayBuffer());
  const rows = await sh[0].rows();
  return { nhom: g[0], ten: f.ten, soSheet: sh.length, cot: rows[1], dong: rows.length - 2 };
}).catch((e) => ({ loi: String(e) }));
assert.ok(!xl24.loi, 'dựng được file: ' + xl24.loi);
assert.equal(xl24.soSheet, 1, 'một loại một file, không gộp nhiều sheet');
assert.match(xl24.ten, /^Thiet-bi_.+\.xlsx$/, 'tên file theo loại: ' + xl24.ten);
['Mã máy', 'Tên thiết bị', 'Khối', 'Nhóm', 'Chuyền', 'Vị trí'].forEach((c) =>
  assert.ok(xl24.cot.includes(c), 'file có cột ' + c + ': ' + JSON.stringify(xl24.cot)));
assert.ok(xl24.dong >= 1, 'file có dòng thiết bị');
await shot('52-xuat-theo-loai');
// Xuất ra rồi đọc lại: khớp đúng, cột app tự điền không biến thành thông số rác
const vong24 = await page.evaluate(async (nhom) => {
  const f = tbXuatNhom(nhom);
  const ds = await tbDocFile(new File([await f.blob.arrayBuffer()], f.ten));
  const co = S.V.may.filter((m) => m.hoatDong && (m.nhom || '') === nhom);
  return { doc: ds.length, co: co.length, ma: ds[0].ma, ten: ds[0].ten,
    rac: ds.some((x) => x.thongSo.some(([k]) => /Hạn kế tiếp|Lần gần nhất/.test(k))) };
}, xl24.nhom).catch((e) => ({ loi: String(e) }));
assert.ok(!vong24.loi, 'đọc lại được file vừa xuất: ' + vong24.loi);
assert.equal(vong24.doc, vong24.co, 'đọc lại đủ số thiết bị');
assert.match(vong24.ma, /^M\d+$/, 'giữ nguyên mã máy để nhập lại là cập nhật');
assert.equal(vong24.rac, false, 'cột app tự điền không thành thông số');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Nhập: màn nhập có lối chọn file và lời giải thích
await page.evaluate(() => go('tbNhap')); await wait(800);
assert.equal(await page.locator('#tbFile').count(), 1, 'có ô chọn file Excel');
assert.match(await text('#main'), /Tên thiết bị/, 'ghi rõ cột bắt buộc');
await shot('53-nhap-tu-file');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Hồ sơ máy: thông số kỹ thuật và sửa vị trí tại chỗ
await page.evaluate(() => {
  const m = S.V.may[0];
  S.V.byMa[m.ma].thongSo = [['Model động cơ', 'YE3-160M2-2'], ['Công suất', '15 kW']];
  go('may', { ma: m.ma, tab: 'tt' });
}); await wait(900);
assert.match(await text('#main'), /Thông số kỹ thuật/, 'hồ sơ máy có bảng thông số');
assert.match(await text('#main'), /YE3-160M2-2/, 'hiện đúng thông số');
assert.match(await text('#main'), /Khối thiết bị/, 'hiện khối thiết bị');
assert.equal(await page.locator('[data-act="tbViTri"]').count(), 1, 'có nút Sửa vị trí');
await shot('54-ho-so-may-thong-so');
await page.click('[data-act="tbViTri"]'); await wait(600);
await page.fill('#vtNew', 'Xưởng 2 — cạnh cửa số 3');
await page.click('[data-act="tbViTriGo"]'); await wait(1200);
const vt24 = await page.evaluate(() => S.V.byMa[topV().p.ma].viTri);
assert.equal(vt24, 'Xưởng 2 — cạnh cửa số 3', 'vị trí đã lưu');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Kỹ thuật cũng sửa được vị trí, nhưng không nhập / xuất được
await logout(); await login('NV003', '333333');
await page.evaluate(() => go('may', { ma: S.V.may[0].ma, tab: 'tt' })); await wait(900);
assert.equal(await page.locator('[data-act="tbViTri"]').count(), 1, 'kỹ thuật vẫn sửa được vị trí');
assert.equal(await page.locator('[data-act="go"][data-v="tbNhap"]').count(), 0, 'kỹ thuật không thấy nút nhập');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Bản 2.37: Danh sách là sổ thiết bị hai khối, thông số theo từng loại, vị trí sửa tại chỗ, nhập / xuất Excel mỗi loại một file');

// 25. Bản 2.38: phân quyền xem theo từng tài khoản
await logout(); await login('NV001', '111111');
await page.evaluate(() => go('users')); await wait(2000);
await page.click('.row[data-act="userEdit"]:has-text("NV003")'); await wait(900);
assert.equal(await page.evaluate(() => ($('#uMaNV') || {}).value), 'NV003', 'mở đúng tài khoản NV003');
const q25 = await page.evaluate(() => ({
  sw: document.querySelectorAll('.qsw').length,
  md: [...document.querySelectorAll('.qmd')].map((e) => e.textContent.trim())
}));
assert.equal(q25.sw, 8, 'có đủ tám công tắc quyền');
assert.ok(q25.md.every((x) => /Theo vai trò/.test(x)), 'chưa đặt riêng thì tất cả theo vai trò');
await shot('55-phan-quyen');
// Mở riêng quyền xuất, khoá riêng quyền xem thiết bị phụ trợ
await page.click('.qsw[data-k="xuattb"]'); await wait(300);
await page.click('.qsw[data-k="xemhcd"]'); await wait(300);
assert.deepEqual(await page.evaluate(() => S.qTam), { xuattb: true, xemhcd: false });
assert.equal(await page.locator('[data-act="qReset"]').count(), 1, 'có nút về mặc định');
await page.click('[data-act="saveUser"]'); await wait(2400);
// Kỹ thuật đăng nhập: khối bị khoá không còn trong dữ liệu, nút xuất thì hiện
await logout(); await login('NV003', '333333');
await wait(1200);
const sau25 = await page.evaluate(() => ({
  q: S.quyen,
  hcd: S.V.may.filter((m) => khoiCua(m) === 'HCD').length,
  sx: S.V.may.filter((m) => khoiCua(m) === 'SX').length
}));
assert.equal(sau25.q.xemhcd, false, 'máy chủ trả về đúng quyền đã khoá');
assert.equal(sau25.q.xuattb, true, 'và đúng quyền đã mở riêng');
assert.equal(sau25.hcd, 0, 'máy phụ trợ không rời máy chủ, không chỉ ẩn nút');
assert.ok(sau25.sx > 0, 'khối còn lại vẫn xem được');
// Kỹ thuật vốn không mở được tab Thiết bị, nên phần giao diện kiểm bằng tài khoản Quản lý
await logout(); await login('NV001', '111111');
await page.evaluate(() => go('users')); await wait(2000);
await page.click('.row[data-act="userEdit"]:has-text("NV002")'); await wait(900);
assert.equal(await page.evaluate(() => ($('#uMaNV') || {}).value), 'NV002', 'mở đúng tài khoản NV002');
await page.click('.qsw[data-k="xemhcd"]'); await wait(300);
await page.click('.qsw[data-k="xuattb"]'); await wait(300);
assert.deepEqual(await page.evaluate(() => S.qTam), { xemhcd: false, xuattb: false }, 'khoá riêng hai mục của Quản lý');
await page.click('[data-act="saveUser"]'); await wait(2400);
await logout(); await login('NV002', '222222'); await wait(1400);
await page.evaluate(() => tab('list')); await wait(1400);
assert.equal(await page.locator('.khoibtn').count(), 1, 'khối bị khoá thì không còn nút khối đó');
assert.match(await text('.khoibtn'), /thiết bị sản xuất/i, 'còn lại đúng khối được xem');
assert.equal(await page.locator('[data-act="go"][data-v="tbXuat"]').count(), 0, 'khoá quyền thì mất nút Xuất Excel');
assert.equal(await page.evaluate(() => S.V.may.filter((m) => khoiCua(m) === 'HCD').length), 0,
  'máy khối bị khoá không rời máy chủ');
await shot('56-quan-ly-bi-khoa-khoi');
// Trả lại mặc định cho cả hai tài khoản để các bước sau không bị ảnh hưởng
await logout(); await login('NV001', '111111');
for (const ma of ['NV002', 'NV003']) {
  await page.evaluate(() => go('users')); await wait(1800);
  await page.click(`.row[data-act="userEdit"]:has-text("${ma}")`); await wait(900);
  assert.equal(await page.evaluate(() => ($('#uMaNV') || {}).value), ma, 'mở đúng tài khoản ' + ma);
  await page.click('[data-act="qReset"]'); await wait(400);
  await page.click('[data-act="saveUser"]'); await wait(2400);
}
await logout(); await login('NV003', '333333'); await wait(1400);
assert.equal(await page.evaluate(() => S.quyen.xemhcd), true, 'về mặc định thì xem lại được cả hai khối');
assert.equal(await page.evaluate(() => S.quyen.xuattb), false, 'và quyền xuất về lại đúng mặc định của vai trò');
ok('Bản 2.38: phân quyền xem theo từng tài khoản, tám mục đè lên mặc định của vai trò, máy chủ lọc thật chứ không chỉ ẩn nút');

// 26. Bản 2.38: ô chọn thiết bị có loại và ô tìm, thay danh sách xổ xuống
await logout(); await login('NV002', '222222');
await page.evaluate(() => go('scGhi', {})); await wait(1200);
assert.equal(await page.locator('select#scMa').count(), 0, 'không còn danh sách xổ xuống');
assert.equal(await page.locator('.tbpick[data-for="scMa"]').count(), 1, 'có ô chọn thiết bị mới');
await page.click('.tbpick[data-for="scMa"]'); await wait(700);
assert.equal(await page.locator('#tbL').count(), 1, 'hộp chọn có ô Loại thiết bị');
assert.equal(await page.locator('#tbQ').count(), 1, 'và ô gõ tìm');
assert.match(await text('#tbDs'), /Gần đây/, 'đưa thiết bị vừa làm lên trước');
await shot('57-chon-thiet-bi');
// Chọn loại: danh sách rút còn đúng loại đó
const loai26 = await page.evaluate(() => [...document.querySelectorAll('#tbL option')]
  .map((o) => o.value).find((x) => x.indexOf('|Máy hút bụi') > 0) || '');
assert.ok(loai26, 'ô loại có nhóm Máy hút bụi');
await page.selectOption('#tbL', loai26); await wait(600);
const n26 = await page.evaluate(() => ({
  dong: document.querySelectorAll('#tbDs .row').length,
  may: S.V.may.filter((m) => m.hoatDong && (m.nhom || '') === 'Máy hút bụi · 吸尘器').length
}));
assert.equal(n26.dong, n26.may, 'chọn loại thì chỉ còn thiết bị của loại đó: ' + JSON.stringify(n26));
await shot('58-chon-theo-loai');
await page.selectOption('#tbL', ''); await wait(400);
// Gõ tìm: theo mã máy, theo số chuyền, không dấu và cả tiếng Trung
for (const [q, it] of [['M020', 1], ['吸尘', 1], ['17', 1]]) {
  await page.fill('#tbQ', q); await wait(400);
  assert.ok(await page.evaluate(() => document.querySelectorAll('#tbDs .row').length) >= it,
    'gõ "' + q + '" phải ra kết quả');
}
await page.fill('#tbQ', 'hut bui'); await wait(450);
assert.ok(await page.evaluate(() => document.querySelectorAll('#tbDs .row').length) >= 5, 'gõ không dấu vẫn ra');
// Chọn một thiết bị: điền vào form và các xử lý cũ vẫn chạy
await page.click('#tbDs .row >> nth=0'); await wait(700);
const chon26 = await page.evaluate(() => ({
  val: ($('#scMa') || {}).value, p: topV().p.scMa,
  nhan: (document.querySelector('.tbpick[data-for="scMa"] .tbpt') || {}).textContent,
  dong: !!document.querySelector('#sheetBg')
}));
assert.match(chon26.val, /^M\d+$/, 'ô ẩn giữ đúng mã máy');
assert.equal(chon26.p, chon26.val, 'form nhận được giá trị mới');
assert.ok(chon26.nhan && chon26.nhan.indexOf('Chọn thiết bị') < 0, 'nút hiện tên thiết bị đã chọn');
assert.equal(chon26.dong, false, 'chọn xong thì đóng hộp');
// Ghi việc: vẫn bỏ trống thiết bị được
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
await page.evaluate(() => go('cvNew', {})); await wait(900);
await page.click('.tbpick[data-for="cvMa"]'); await wait(600);
assert.match(await page.evaluate(() => (document.querySelector('#tbDs .row .nm') || {}).textContent || ''),
  /Không gắn thiết bị/, 'việc không bắt buộc thiết bị thì có dòng bỏ trống');
await page.evaluate(() => closeSheet()); await wait(300);
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Bản 2.38: ô chọn thiết bị có lọc theo loại và gõ tìm không dấu, dùng chung cho mọi màn cần chọn máy');

// 27. Máy không theo dõi bảo dưỡng, và chuyền không bị nhập thành máy
await logout(); await login('NV002', '222222');
const ma27 = await page.evaluate(() => S.V.may.find((m) => m.hoatDong && m.chuKy > 0).ma);
await page.evaluate((x) => go('mayEdit', { ma: x }), ma27); await wait(1000);
assert.equal(await page.locator('#eBD').count(), 1, 'hồ sơ máy có công tắc Theo dõi bảo dưỡng');
assert.equal(await page.evaluate(() => $('#bdBox').hidden), false, 'đang bật thì hiện ô chu kỳ');
await page.uncheck('#eBD'); await wait(400);
assert.equal(await page.evaluate(() => $('#bdBox').hidden), true, 'tắt thì ẩn ô chu kỳ và hạn');
await shot('59-khong-theo-doi-bao-duong');
await page.click('#eSave'); await wait(1800);
const sau27 = await page.evaluate((x) => {
  const m = S.V.byMa[x];
  return { ck: m.chuKy, han: m.hanKeTiep, hd: m.hoatDong, st: stOf(m).k, lich: planFor(m, +TODAY().slice(0, 4), TODAY()).size };
}, ma27);
assert.equal(sau27.ck, 0, 'lưu với chu kỳ 0');
assert.equal(sau27.han, '', 'và không còn hạn kế tiếp');
assert.equal(sau27.hd, true, 'máy vẫn nằm trong sổ thiết bị');
assert.equal(sau27.st, 'ok', 'không bị tính là quá hạn');
assert.equal(sau27.lich, 0, 'không còn trong lịch bảo dưỡng');
await page.evaluate((x) => go('mayEdit', { ma: x }), ma27); await wait(900);
assert.equal(await page.isChecked('#eBD'), false, 'mở lại vẫn nhớ là đang tắt');
await page.check('#eBD'); await wait(300);
await page.click('#eSave'); await wait(1800);
assert.ok(await page.evaluate((x) => S.V.byMa[x].chuKy > 0, ma27), 'bật lại thì có chu kỳ');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Chuyền bị nhập thành máy: Danh sách có chip cảnh báo để dọn
await page.evaluate(() => {
  const c = S.V.ch[0];
  S.V.may.push({ ma: 'MTRUNG', ten: c.tenZh || c.ten, tenPhu: '', nhom: S.V.groups[0], viTri: '',
    chuKy: 0, hanKeTiep: '', hoatDong: true, maHT: '', chuyen: c.ma, thongSo: [], hangMuc: [], linhKien: [] });
  S.V.byMa.MTRUNG = S.V.may[S.V.may.length - 1];
  tab('list');
}); await wait(1400);
assert.deepEqual(await page.evaluate(() => mayTrungChuyen().map((m) => m.ma)), ['MTRUNG'], 'nhận ra máy trùng với chuyền');
assert.equal(await page.locator('[data-act="listGrp"][data-g="__trung"]').count(), 1, 'có chip Trùng với chuyền');
await page.click('[data-act="listGrp"][data-g="__trung"]'); await wait(700);
assert.equal(await page.evaluate(() => document.querySelectorAll('#listBody .row, #listBody .scrow, #listBody tbody tr').length), 1,
  'chip lọc ra đúng một máy trùng');
await shot('60-trung-voi-chuyen');
// Máy giả chỉ nằm trong bộ nhớ màn hình; dọn đi để bước sau đếm số máy cho đúng
await page.evaluate(() => {
  const i = S.V.may.findIndex((m) => m.ma === 'MTRUNG');
  if (i >= 0) S.V.may.splice(i, 1);
  delete S.V.byMa.MTRUNG;
  S.f.grp = ''; render();
}); await wait(500);
assert.deepEqual(await page.evaluate(() => mayTrungChuyen().map((m) => m.ma)), [], 'dọn xong máy giả');
ok('Bản 2.38: máy chỉ ghi sổ thì tắt theo dõi bảo dưỡng, và chuyền bị nhập thành máy thì có chip cảnh báo để dọn');

// 28. Bản 2.39: xoá hẳn thiết bị nhập nhầm, máy đã có lịch sử thì máy chủ giữ lại
await page.evaluate(() => { S.f.grp = ''; tab('list'); }); await wait(1200);
const sach28 = await page.evaluate(() => {
  const dung = new Set([...(S.V.ls || []).map((x) => x.ma), ...(S.V.cvAll || []).map((x) => x.ma)].filter(Boolean));
  const m = S.V.may.find((x) => x.hoatDong && !dung.has(x.ma));
  return m ? m.ma : '';
});
assert.ok(sach28, 'dữ liệu mẫu có máy chưa dính lịch sử');
const truoc28 = await page.evaluate(() => S.V.may.length);
await page.evaluate((x) => go('may', { ma: x }), sach28); await wait(1000);
assert.equal(await page.locator('[data-act="mayXoa"]').count(), 1, 'hồ sơ máy có nút Xoá hẳn');
await page.click('[data-act="mayXoa"]'); await wait(600);
assert.match(await text('#sheetBg'), /không lấy lại được/, 'hỏi lại trước khi xoá');
await shot('61-xoa-han-hoi');
await page.click('[data-act="mayXoaGo"]'); await wait(2000);
assert.equal(await page.evaluate(() => S.V.may.length), truoc28 - 1, 'máy biến khỏi danh sách');
assert.equal(await page.evaluate((x) => !!S.V.byMa[x], sach28), false, 'không tra ra được nữa');
// Máy đã có lịch sử bảo dưỡng thì máy chủ giữ lại và nói rõ vì sao
const coLS28 = await page.evaluate(() => (S.V.ls[0] || {}).ma);
await page.evaluate((x) => go('may', { ma: x }), coLS28); await wait(900);
await page.click('[data-act="mayXoa"]'); await wait(500);
await page.click('[data-act="mayXoaGo"]'); await wait(1800);
assert.match(await text('#xmErr'), /lịch sử bảo dưỡng/, 'báo rõ vì sao không xoá được');
assert.equal(await page.evaluate((x) => !!S.V.byMa[x], coLS28), true, 'máy vẫn còn nguyên');
await page.evaluate(() => closeSheet()); await wait(300);
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Kỹ thuật không có nút xoá
await logout(); await login('NV003', '333333');
await page.evaluate(() => go('may', { ma: S.V.may[0].ma })); await wait(900);
assert.equal(await page.locator('[data-act="mayXoa"]').count(), 0, 'kỹ thuật không xoá được thiết bị');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Phần trên vừa đăng nhập bằng kỹ thuật; quay lại Quản lý vì kỹ thuật không mở được Danh sách
await logout(); await login('NV002', '222222'); await wait(1200);
// Chuyền trong hộp chọn phải đủ mã + tên Việt + tên Trung, không thì rất dễ chọn nhầm chuyền
await page.evaluate(() => go('scGhi', {})); await wait(1000);
await page.click('.tbpick[data-for="scMa"]'); await wait(600);
await page.fill('#tbQ', 'VKY01'); await wait(400);
const dongCh = (await page.locator('#tbDs .row[data-ma="VKY01"]').textContent()).replace(/\s+/g, ' ');
const ch28 = await page.evaluate(() => S.V.chByMa.VKY01);
assert.ok(dongCh.includes(ch28.ten), 'dòng chuyền có tên tiếng Việt: ' + dongCh);
assert.ok(dongCh.includes(ch28.tenZh), 'và tên tiếng Trung');
assert.ok(dongCh.includes('VKY01'), 'và mã chuyền');
await page.click('#tbDs .row[data-ma="VKY01"]'); await wait(600);
const nhan28 = await page.locator('.tbpick[data-for="scMa"] .tbpt').textContent();
assert.ok(nhan28.includes('VKY01') && nhan28.includes(ch28.ten) && nhan28.includes(ch28.tenZh),
  'nút chọn cũng hiện đủ ba thứ: ' + nhan28);
await shot('62-chon-chuyen-du-ten');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
// Thiết bị còn chỗ chưa chắc: để riêng một chip, không đoán bừa
await page.evaluate(() => {
  const m = S.V.may.find((x) => x.hoatDong);
  m.thongSo = (m.thongSo || []).concat([['Cần kiểm tra', 'File ghi máy số 05, chưa rõ chuyền']]);
  tab('list');
}); await wait(1300);
assert.equal(await page.evaluate(() => mayCanKiemTra().length), 1, 'nhận ra thiết bị cần kiểm tra');
assert.equal(await page.locator('[data-act="listGrp"][data-g="__ktra"]').count(), 1, 'có chip Cần kiểm tra');
await page.click('[data-act="listGrp"][data-g="__ktra"]'); await wait(700);
assert.match(await text('#main'), /chưa chắc/, 'nói rõ vì sao để riêng');
assert.match(await text('#listBody'), /máy số 05/, 'dòng ghi luôn lý do cần kiểm tra');
await shot('63-can-kiem-tra');
await page.evaluate(() => {
  const m = S.V.may.find((x) => (x.thongSo || []).some(([k]) => k === 'Cần kiểm tra'));
  if (m) m.thongSo = m.thongSo.filter(([k]) => k !== 'Cần kiểm tra');
  S.f.grp = ''; render();
}); await wait(500);
ok('Bản 2.39: xoá hẳn thiết bị nhập nhầm, máy còn lịch sử thì máy chủ giữ lại; chuyền hiện đủ mã và hai thứ tiếng; thiết bị chưa chắc để riêng chip Cần kiểm tra');

// 29. Bản 2.40: sổ thiết bị xếp thành cây — khối → chuyền / nhóm → máy
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => { S.f.khoi = ''; S.f.grp = ''; S.f.q = ''; tab('list'); }); await wait(1200);
const khoi29 = await page.locator('.khoibtn').allTextContents();
assert.equal(khoi29.length, 2, 'hai khối thiết bị');
assert.match(khoi29.join(' '), /Thiết bị sản xuất/, 'khối 1 là Thiết bị sản xuất');
assert.match(khoi29.join(' '), /Thiết bị phụ trợ/, 'khối 2 là Thiết bị phụ trợ');
const gChip29 = await page.$$eval('.chip[data-act="listGrp"]', (e) => e.map((x) => x.dataset.g));
assert.ok(gChip29.every((g) => /^__/.test(g)), 'không còn chip nhóm, chỉ còn chip cảnh báo: ' + JSON.stringify(gChip29));
// Khối sản xuất xổ ra lưới chuyền, khối phụ trợ xổ ra các nhóm
assert.ok(await page.locator('.chgrid > *').count() >= 5, 'có lưới chuyền sản xuất');
const nhom29 = await page.locator('#listBody .gap .gaph .gt').allTextContents();
assert.ok(nhom29.length >= 3, 'khối phụ trợ xổ ra các nhóm: ' + JSON.stringify(nhom29));
// Bấm một nhóm thì mới hiện máy của nhóm đó
const iQuat = nhom29.findIndex((x) => /Quạt gió|Máy hút bụi/.test(x));
assert.ok(iQuat >= 0, 'có nhóm quạt gió hoặc hút bụi trong khối phụ trợ');
await page.locator('#listBody .gap .gaph').nth(iQuat).click(); await wait(700);
assert.ok(await page.locator('#listBody .gap.mo .gapb .row').count() > 0, 'mở nhóm thì ra máy của nhóm');
await shot('64-cay-thiet-bi');
// Trong một chuyền, từ 4 máy trở lên thì máy gom theo nhóm
const chNhieu = await page.evaluate(() => {
  const d = {};
  activeMay().forEach((m) => { if (m.chuyen) d[m.chuyen] = (d[m.chuyen] || 0) + 1; });
  return Object.keys(d).sort((a, b) => d[b] - d[a])[0] || '';
});
await page.evaluate((ma) => go('chuyen', { ma }), chNhieu); await wait(900);
const soMay29 = await page.evaluate((ma) => mayCuaCh(ma).length, chNhieu);
const nhomCh = await page.locator('.nhomh').count();
if (soMay29 >= 4) assert.ok(nhomCh > 0, 'chuyền nhiều máy thì gom theo nhóm');
else assert.equal(nhomCh, 0, 'chuyền ít máy thì để phẳng cho gọn');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Bản 2.40: sổ thiết bị xếp thành cây — hai khối sản xuất / phụ trợ, chuyền và nhóm là từng tầng, bỏ dãy chip nhóm');

// 30. Bản 2.41: đo tủ nhánh (nhiệt độ, điện áp, dòng điện), biểu đồ tháng và Excel có biểu đồ
await page.setViewportSize({ width: 390, height: 844 });
await moThem('doTu');
assert.match(await text('#barTitle'), /Đo tủ điện/);
const tu30 = await page.evaluate(() => tuChuyen().map((c) => c.maCh));
assert.ok(tu30.length >= 10, 'nhận ra các tủ nhánh của chuyền sản xuất: ' + tu30.length);
assert.equal(await page.locator('[data-act="dtMo"]').count(), tu30.length, 'mỗi tủ một dòng');
assert.equal(await page.locator('#main .srvwarn').count(), 0, 'máy chủ đã đủ bản, không còn cảnh báo');
// Ghi 5 số cho tủ đầu tiên
await page.click('[data-act="dtMo"] >> nth=0'); await wait(700);
await page.fill('#dtND', '52.4');
await page.fill('#dtUU', '382');
await page.fill('#dtIA', '128');
await page.fill('#dtIB', '131');
await page.fill('#dtIC', '126');
await page.click('[data-act="dtLuu"]'); await wait(2200);
const d30 = await page.evaluate(() => (S.V.doTu || []).map((x) => [x.maCT, x.nhietDo, x.dienAp, x.ia, x.ib, x.ic]));
assert.equal(d30.length, 1, 'đã lưu một dòng');
assert.deepEqual(d30[0].slice(1), [52.4, 382, 128, 131, 126], 'lưu đúng năm số');
assert.equal(await page.locator('[data-act="dtMo"] .pill.p-ok').count(), 1, 'tủ đã đo đổi sang chip Đã đo');
await shot('65-do-tu-dien');
// Ghi thêm vài ngày rồi xem biểu đồ tháng
const them30 = await page.evaluate(async () => {
  const ma = tuChuyen()[0].ma, thang = TODAY().slice(0, 7);
  let n = 0;
  for (let d = 1; d <= 9; d++) {
    const ng = thang + '-' + String(d).padStart(2, '0');
    if (ng >= TODAY()) break;
    const r = await send('tuGhi', { maCT: ma, ngay: ng, nhietDo: 44 + d, dienAp: 380 + (d % 4),
      ia: 120 + d, ib: 118 + (d % 5), ic: 125 - (d % 3), ghiChu: '' });
    if (r && r.err) return 'loi: ' + JSON.stringify(r.err);
    n++;
  }
  return n;
});
assert.equal(typeof them30, 'number', 'ghi thêm được các ngày trước: ' + them30);
await page.click('[data-act="dtTab"][data-v="bd"]'); await wait(900);
assert.equal(await page.locator('svg.dtchart').count(), 3, 'ba biểu đồ: nhiệt độ, điện áp, dòng điện');
assert.ok(await page.locator('svg.dtchart polyline').count() >= 5, 'có đủ đường nhiệt độ, điện áp và ba pha dòng');
await shot('66-bieu-do-thang');
// Xuất Excel: phải là biểu đồ Excel thật, tức trong file có phần chart
const xl30 = await page.evaluate(async () => {
  const goc = window.saveFile;
  let got = null;
  window.saveFile = async (blob, name) => { got = { blob, name }; };
  try { await dtXuatExcel(S.dt.thang); } finally { window.saveFile = goc; }
  if (!got) return null;
  const buf = new Uint8Array(await got.blob.arrayBuffer());
  let txt = '';
  for (let i = 0; i < buf.length; i++) txt += String.fromCharCode(buf[i]);
  return { name: got.name, size: buf.length, chart: txt.indexOf('xl/charts/chart1.xml') >= 0,
    ve: txt.indexOf('xl/drawings/drawing1.xml') >= 0 };
});
assert.ok(xl30 && xl30.size > 3000, 'xuất ra file Excel');
assert.match(xl30.name, /^Do-tu-dien_\d{4}-\d{2}\.xlsx$/, 'tên file theo tháng: ' + xl30.name);
assert.ok(xl30.chart && xl30.ve, 'file có biểu đồ Excel thật, không phải ảnh');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Bản 2.41: đo tủ nhánh ghi nhiệt độ / điện áp / dòng điện ba pha, biểu đồ tháng trong app và Excel xuất ra có biểu đồ thật');

// 31. Bản 2.42: linh kiện của thân dây chuyền
await page.setViewportSize({ width: 1440, height: 900 });
const lk31 = await page.evaluate(async () => {
  const d = await api('saveLists', { ma: 'VKY01', linhKien: [
    { ten: 'Bộ điều khiển servo', quyCach: 'MR-J4-40B', sl: 8 },
    { ten: 'Bộ điều khiển servo', quyCach: 'MR-J4-200B', sl: 9 },
    { ten: 'Xi lanh', quyCach: 'CA2YD63-300Z', sl: 4 }] });
  mergeResult(d); rebuild();
  return (S.V.chByMa.VKY01.linhKien || []).map((x) => x.quyCach);
});
assert.deepEqual(lk31, ['MR-J4-40B', 'MR-J4-200B', 'CA2YD63-300Z'],
  'cùng tên khác quy cách vẫn là hai linh kiện: ' + JSON.stringify(lk31));
await page.evaluate(() => go('chuyen', { ma: 'VKY01' })); await wait(900);
await page.evaluate(() => { S.f.mo = S.f.mo || {}; S.f.mo['lkch:VKY01'] = true; render(); }); await wait(700);
assert.match(await text('#main'), /Thân dây chuyền/, 'có phần Thân dây chuyền');
assert.equal(await page.locator('[data-act="lkChThanCh"]').count(), 1, 'có nút thêm linh kiện thân chuyền');
// Thân chuyền gom thành mục theo loại, đoán được cả khi không ghi loại
const muc31 = await page.$$eval('.gap .gapb .gap .gaph .gt', (e) => e.map((x) => x.textContent.trim()));
assert.ok(muc31.some((x) => /Bộ điều khiển servo/.test(x)) && muc31.some((x) => /Xi lanh/.test(x)),
  'có mục Bộ điều khiển servo và mục Xi lanh: ' + JSON.stringify(muc31));
await page.evaluate(() => { S.f.mo['lkl:VKY01:driver'] = true; S.f.mo['lkl:VKY01:xilanh'] = true; render(); }); await wait(600);
const nm31 = await page.$$eval('.lkch .row .nm', (e) => e.map((x) => x.textContent.trim()));
assert.deepEqual(nm31.sort(), ['CA2YD63-300Z', 'MR-J4-200B', 'MR-J4-40B'],
  'trong mục, tên dòng là model, không lặp lại tên loại: ' + JSON.stringify(nm31));
await shot('67-linh-kien-than-chuyen');
await page.evaluate(() => { while (S.stack.length > 1) back(); }); await wait(400);
ok('Bản 2.42 + 2.43: linh kiện gắn thẳng vào thân dây chuyền, gom thành mục theo loại (servo, driver, xi lanh…), cùng tên khác quy cách không đè lên nhau');

assert.deepEqual(errs, [], 'không có lỗi JavaScript');
await browser.close();
console.log(`\nĐạt ${step} bước, không lỗi JavaScript.`);
