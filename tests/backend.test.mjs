// Kiểm thử máy chủ (Code.gs) — chạy: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackend } from './harness.mjs';

const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r)); return r.data; };
const err = (r, code) => { assert.equal(r.ok, false, 'phải lỗi ' + code); assert.equal(r.code, code, JSON.stringify(r)); return r; };

// Một máy chủ trống + một công tơ hạ áp E01 hệ số 2
function setup(extra) {
  const b = loadBackend({ now: '2026-10-05T03:00:00Z' });
  b.ctx.PropertiesService.getScriptProperties().setProperty('NHAP_EXCEL', 'test'); // không nhập sổ điện Excel mẫu
  const ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333'), ad = b.login('NV001', '111111');
  const m = ok(b.call('saveMeter', Object.assign({ ten: 'Tủ tổng 1', heSo: 2, loai: 'ha' }, extra || {}), ql)).congTo;
  return Object.assign(b, { ql, kt, ad, ma: m.ma });
}
const ghi = (b, tk, ky, v, more) => b.call('saveReading', Object.assign({ ma: b.ma, ky, giaTri: { '1.8.0': v } }, more || {}), tk);
const csOf = (b, ky, ma) => ok(b.call('data', {}, b.ql)).chiSo.find((x) => x.ky === ky && x.ma === (ma || b.ma));

test('đăng nhập bằng mã nhân viên + PIN; PIN không còn bị lộ khi trùng', () => {
  const b = loadBackend();
  const ad = b.login('nv001', '111111');
  err(b.call('login', { maNV: 'NV001', pin: '222222' }), 'PIN_SAI');
  // Chỉ nhập PIN (cách cũ) vẫn được khi PIN là của đúng một người
  ok(b.call('login', { pin: '333333' }));
  // Đặt trùng PIN không còn báo PIN_TRUNG
  const u = ok(b.call('saveUser', { ten: 'Thợ mới', vaiTro: 'kythuat', pin: '333333' }, ad)).user;
  assert.match(u.maNV, /^NV\d{3}$/);
  err(b.call('login', { pin: '333333' }), 'CAN_MA_NV');
  ok(b.call('login', { maNV: u.maNV, pin: '333333' }));
  err(b.call('saveUser', { ten: 'Trùng mã', vaiTro: 'kythuat', pin: '444444', maNV: u.maNV }, ad), 'MA_NV_TRUNG');
  // Đổi PIN sang PIN của người khác cũng không báo trùng
  const kt = b.login('NV003', '333333');
  ok(b.call('changePin', { cu: '333333', moi: '111111' }, kt));
  // Sai 5 lần theo mã nhân viên thì khoá
  for (let i = 0; i < 5; i++) b.call('login', { maNV: 'NV002', pin: '000000' });
  err(b.call('login', { maNV: 'NV002', pin: '222222' }), 'KHOA');
});

test('lưu cả chỉ số và tiêu thụ kỳ; kỳ đầu tháng lấy số cuối tháng trước; tổng tháng = tổng 3 kỳ', () => {
  const b = setup();
  ok(ghi(b, b.kt, '2026-09-30', 1000));
  b.setNow('2026-10-10T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-10', 1100));
  b.setNow('2026-10-20T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-20', 1190));
  b.setNow('2026-10-31T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-31', 1300));
  const k1 = csOf(b, '2026-10-10').tieuThu['1.8.0'];
  assert.deepEqual([k1.cs0, k1.ky0, k1.raw, k1.tt, k1.ngay, k1.gop], [1000, '2026-09-30', 100, 200, 10, 0]);
  const k3 = csOf(b, '2026-10-31').tieuThu['1.8.0'];
  assert.deepEqual([k3.cs0, k3.tt, k3.ngay], [1190, 220, 11]);
  const thang = ['2026-10-10', '2026-10-20', '2026-10-31'].reduce((a, k) => a + csOf(b, k).tieuThu['1.8.0'].tt, 0);
  assert.equal(thang, (1300 - 1000) * 2);          // không cộng chỉ số tuyệt đối
  // Cột đọc trực tiếp trên sheet
  const row = b.ctx.docTho('ChiSo').find((r) => r[1] === '2026-10-20' && r[2] === b.ma);
  const H = b.ctx.BANG.ChiSo;
  assert.equal(row[H.indexOf('KyTruoc')], '2026-10-10');
  assert.equal(row[H.indexOf('CSTruoc')], 1100);
  assert.equal(row[H.indexOf('TieuThuKy')], 180);
});

test('kỳ trước bị thiếu: tính gộp và đánh dấu số kỳ thiếu; ghi bù thì kỳ sau tự tính lại', () => {
  const b = setup();
  ok(ghi(b, b.kt, '2026-09-30', 1000));
  b.setNow('2026-10-20T03:00:00Z');
  ok(ghi(b, b.kt, '2026-10-20', 1200));
  let t = csOf(b, '2026-10-20').tieuThu['1.8.0'];
  assert.deepEqual([t.gop, t.ngay, t.tt], [1, 20, 400]);
  const r = ok(ghi(b, b.ql, '2026-10-10', 1080));
  assert.equal(r.dsChiSo.length, 1, 'kỳ 20/10 được tính lại và gửi về app');
  t = csOf(b, '2026-10-20').tieuThu['1.8.0'];
  assert.deepEqual([t.gop, t.cs0, t.tt], [0, 1080, 240]);
});

test('chỉ số giảm: chặn, bắt chọn ngoại lệ + lý do; kỹ thuật thì chờ duyệt, Quản lý duyệt', () => {
  const b = setup();
  ok(ghi(b, b.kt, '2026-09-30', 1000));
  b.setNow('2026-10-10T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-10', 1100));
  b.setNow('2026-10-20T03:00:00Z');
  const e = err(ghi(b, b.kt, '2026-10-20', 30), 'GIAM');
  assert.deepEqual(e.data, { ma: ['1.8.0'], truoc: { '1.8.0': 1100 } });
  err(ghi(b, b.kt, '2026-10-20', 30, { ngoaiLe: { giam: { loai: 'THAY_CT', lyDo: '' } } }), 'CAN_LY_DO');
  err(ghi(b, b.kt, '2026-10-20', 30, { ngoaiLe: { giam: { loai: 'THAY_CT', lyDo: 'Thay công tơ', csCuCuoi: { '1.8.0': 1090 }, csMoiDau: { '1.8.0': 0 } } } }), 'THAY_CT_SAI');
  const x = ok(ghi(b, b.kt, '2026-10-20', 30, { ngoaiLe: { giam: { loai: 'THAY_CT', lyDo: 'Thay công tơ', csCuCuoi: { '1.8.0': 1120 }, csMoiDau: { '1.8.0': 0 } } } })).chiSo;
  assert.equal(x.trangThai, 'CHO_DUYET');
  assert.equal(x.tieuThu['1.8.0'].tt, ((1120 - 1100) + 30) * 2);
  assert.equal(x.tieuThu['1.8.0'].cach, 'THAY_CT');
  err(b.call('approveReading', { id: x.id }, b.kt), 'KHONG_QUYEN');
  err(b.call('approveReading', { id: x.id, duyet: false }, b.ql), 'CAN_LY_DO');
  const d = ok(b.call('approveReading', { id: x.id }, b.ql)).chiSo;
  assert.equal(d.trangThai, 'OK');
  assert.equal(d.ngoaiLe.duyet.kq, 'DUYET');
  // Kỳ sau tính từ số công tơ mới
  b.setNow('2026-10-31T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-31', 130));
  assert.equal(csOf(b, '2026-10-31').tieuThu['1.8.0'].tt, 200);
  // Quản lý ghi ngoại lệ thì tự duyệt (vẫn phải có lý do), ghi nhật ký
  const nk = ok(b.call('audit', {}, b.ql)).ds.map((a) => a.hanhDong);
  assert.ok(nk.includes('NGOAI_LE_CHO_DUYET') && nk.includes('DUYET_NGOAI_LE'));
});

test('quay vòng công tơ dùng số chữ số; ngoại lệ "khác" thành mốc mới, không tính tiêu thụ', () => {
  const b = setup({ soChuSo: 4, heSo: 1 });
  ok(ghi(b, b.ql, '2026-09-30', 9990));
  b.setNow('2026-10-10T03:00:00Z');
  err(b.call('saveMeter', { ma: 'E99', ten: 'x', heSo: 1 }, b.ql), 'KHONG_CO_CT');
  const x = ok(ghi(b, b.ql, '2026-10-10', 15, { ngoaiLe: { giam: { loai: 'QUAY_VONG', lyDo: 'Về 0' } } })).chiSo;
  assert.equal(x.trangThai, 'OK');
  assert.equal(x.tieuThu['1.8.0'].tt, 25);
  b.setNow('2026-10-20T03:00:00Z');
  const y = ok(ghi(b, b.ql, '2026-10-20', 5, { ngoaiLe: { giam: { loai: 'KHAC', lyDo: 'Điện lực thay đồng hồ, không có số cũ' } } })).chiSo;
  assert.equal(y.tieuThu['1.8.0'].tt, null);
  assert.equal(y.tieuThu['1.8.0'].cach, 'MOC');
});

test('tiêu thụ bất thường so với bình quân ngày: bắt xác nhận, lưu cờ bất thường', () => {
  const b = setup({ heSo: 1 });
  const ky = ['2026-08-31', '2026-09-10', '2026-09-20', '2026-09-30'];
  b.setNow('2026-09-30T03:00:00Z');
  [1000, 1100, 1200, 1300].forEach((v, i) => ok(ghi(b, b.ql, ky[i], v)));
  b.setNow('2026-10-10T03:00:00Z');
  const e = err(ghi(b, b.kt, '2026-10-10', 1500), 'BAT_THUONG');
  assert.equal(e.data.huong, 'CAO');
  assert.equal(e.data.pct, 100);
  const x = ok(ghi(b, b.kt, '2026-10-10', 1500, { xacNhanBatThuong: true, ngoaiLe: { batThuongLyDo: 'Chạy thêm ca' } })).chiSo;
  assert.equal(x.trangThai, 'OK');
  assert.deepEqual([x.ngoaiLe.batThuong.huong, x.ngoaiLe.batThuong.lyDo], ['CAO', 'Chạy thêm ca']);
  // Ngưỡng riêng của công tơ
  ok(b.call('saveMeter', { ma: b.ma, ten: 'Tủ tổng 1', heSo: 1, loai: 'ha', nguongTang: 300 }, b.ql));
  b.setNow('2026-10-20T03:00:00Z');
  ok(ghi(b, b.kt, '2026-10-20', 1700));
});

test('khoá kỳ: kỹ thuật không sửa được; Quản lý sửa phải có lý do; có nhật ký trước/sau', () => {
  const b = setup();
  ok(ghi(b, b.kt, '2026-09-30', 1000));
  b.setNow('2026-10-10T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-10', 1100));
  err(b.call('lockPeriod', { ky: '2026-10-10' }, b.kt), 'KHONG_QUYEN');
  ok(b.call('lockPeriod', { ky: '2026-10-10' }, b.ql));
  err(ghi(b, b.kt, '2026-10-10', 1110), 'KY_DA_KHOA');
  err(ghi(b, b.ql, '2026-10-10', 1110), 'CAN_LY_DO');
  ok(ghi(b, b.ql, '2026-10-10', 1110, { lyDoSua: 'Ghi nhầm số' }));
  const nk = ok(b.call('audit', { bang: 'ChiSo' }, b.ql)).ds.find((a) => a.hanhDong === 'SUA_SAU_KHOA');
  assert.equal(nk.truoc.giaTri['1.8.0'], 1100);
  assert.equal(nk.sau.giaTri['1.8.0'], 1110);
  assert.equal(nk.lyDo, 'Ghi nhầm số');
  // Kỳ 30/9 cũng đã khoá (khoá đến 10/10)
  err(b.call('deleteReading', { id: csOf(b, '2026-09-30').id }, b.ql), 'CAN_LY_DO');
  // Mở lại kỳ
  err(b.call('unlockPeriod', { ky: '2026-10-10' }, b.ql), 'CAN_LY_DO');
  const k = ok(b.call('unlockPeriod', { ky: '2026-10-10', lyDo: 'Bổ sung số' }, b.ql)).khoaKy;
  assert.equal(k.den, '2026-09-30');
  ok(ghi(b, b.kt, '2026-10-10', 1120));
  // Khoá khi còn thiếu công tơ: báo, xác nhận thì vẫn khoá
  ok(b.call('saveMeter', { ten: 'Nhánh A', heSo: 1, loai: 'nhanh' }, b.ql));
  const e = err(b.call('lockPeriod', { ky: '2026-10-10' }, b.ql), 'CON_THIEU');
  assert.equal(e.data.thieu.length, 1);
  ok(b.call('lockPeriod', { ky: '2026-10-10', boQuaThieu: true }, b.ql));
});

test('xung đột phiên bản và gửi lại không tạo trùng', () => {
  const b = setup();
  ok(ghi(b, b.kt, '2026-09-30', 1000));
  b.setNow('2026-10-10T03:00:00Z');
  const a = ok(b.call('saveReading', { ma: b.ma, ky: '2026-10-10', giaTri: { '1.8.0': 1100 }, goc: '' }, b.kt, 'op-1')).chiSo;
  const dup = ok(b.call('saveReading', { ma: b.ma, ky: '2026-10-10', giaTri: { '1.8.0': 1100 }, goc: '' }, b.kt, 'op-1'));
  assert.equal(dup.dup, true);
  assert.equal(ok(b.call('data', {}, b.ql)).chiSo.filter((x) => x.ky === '2026-10-10').length, 1);
  // Quản lý sửa trong lúc máy kỹ thuật còn bản cũ chưa gửi
  ok(b.call('saveReading', { ma: b.ma, ky: '2026-10-10', giaTri: { '1.8.0': 1105 }, goc: a.ver }, b.ql));
  const e = err(b.call('saveReading', { ma: b.ma, ky: '2026-10-10', giaTri: { '1.8.0': 1101 }, goc: a.ver }, b.kt, 'op-2'), 'XUNG_DOT');
  assert.equal(e.data.chiSo.giaTri['1.8.0'], 1105);
  // Người ghi chọn "giữ bản của tôi" thì ghi đè được số của chính mình
  ok(b.call('saveReading', { ma: b.ma, ky: '2026-10-10', giaTri: { '1.8.0': 1101 }, goc: a.ver, ghiDe: true }, b.kt));
  // Kỹ thuật khác không được ghi đè số người khác đã ghi
  ok(b.call('saveUser', { ten: 'Thợ 2', vaiTro: 'kythuat', pin: '555555', maNV: 'NV010' }, b.ad));
  const kt2 = b.login('NV010', '555555');
  err(b.call('saveReading', { ma: b.ma, ky: '2026-10-10', giaTri: { '1.8.0': 1102 }, ghiDe: true }, kt2), 'DA_GHI');
});

test('xoá chỉ số thì kỳ sau tự tính lại', () => {
  const b = setup();
  ok(ghi(b, b.kt, '2026-09-30', 1000));
  b.setNow('2026-10-10T03:00:00Z'); const x = ok(ghi(b, b.kt, '2026-10-10', 1100)).chiSo;
  b.setNow('2026-10-20T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-20', 1200));
  const r = ok(b.call('deleteReading', { id: x.id }, b.ql));
  assert.equal(r.dsChiSo[0].tieuThu['1.8.0'].tt, 400);
  assert.equal(r.dsChiSo[0].tieuThu['1.8.0'].gop, 1);
});

test('đổi hệ số nhân: mặc định giữ hệ số cũ cho các kỳ đã ghi; chọn áp dụng thì tính lại kỳ chưa khoá', () => {
  const b = setup();
  ok(ghi(b, b.kt, '2026-09-30', 1000));
  b.setNow('2026-10-10T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-10', 1100));
  b.setNow('2026-10-20T03:00:00Z'); ok(ghi(b, b.kt, '2026-10-20', 1200));
  ok(b.call('lockPeriod', { ky: '2026-10-10' }, b.ql));
  ok(b.call('saveMeter', { ma: b.ma, ten: 'Tủ tổng 1', heSo: 3, loai: 'ha' }, b.ql));
  assert.equal(csOf(b, '2026-10-20').tieuThu['1.8.0'].tt, 200);
  const r = ok(b.call('saveMeter', { ma: b.ma, ten: 'Tủ tổng 1', heSo: 4, loai: 'ha', apDungHeSoMoi: true }, b.ql));
  assert.equal(r.dsChiSo.length, 1);
  assert.equal(csOf(b, '2026-10-20').tieuThu['1.8.0'].tt, 400);
  assert.equal(csOf(b, '2026-10-10').tieuThu['1.8.0'].tt, 200, 'kỳ đã khoá giữ nguyên');
});

test('công tơ cấp trên không tạo vòng; đồng hồ nước', () => {
  const b = setup();
  const a = ok(b.call('saveMeter', { ten: 'Nhánh xưởng', heSo: 1, loai: 'nhanh' }, b.ql)).congTo;
  const c = ok(b.call('saveMeter', { ten: 'Máy nén 1', heSo: 1, loai: 'nhanh', cha: a.ma }, b.ql)).congTo;
  assert.equal(c.cha, a.ma);
  err(b.call('saveMeter', { ma: a.ma, ten: 'Nhánh xưởng', heSo: 1, loai: 'nhanh', cha: c.ma }, b.ql), 'CHA_SAI');
  const n = ok(b.call('saveMeter', { ten: 'Nước cấp', heSo: 1, loai: 'nuoc' }, b.ql)).congTo;
  assert.equal(n.loai, 'nuoc');
});

test('ảnh công tơ lưu riêng tư, đọc lại qua máy chủ; ảnh bắt buộc', () => {
  const b = setup({ batBuocAnh: true });
  err(ghi(b, b.kt, '2026-09-30', 1000), 'CAN_ANH');
  const png = 'data:image/jpeg;base64,' + Buffer.alloc(300, 7).toString('base64');
  const x = ok(ghi(b, b.kt, '2026-09-30', 1000, { anh: [{ data: png }] })).chiSo;
  assert.equal(x.anh.length, 1);
  const f = ok(b.call('photo', { id: x.anh[0].id }, b.kt));
  assert.ok(f.data.startsWith('data:image/jpeg;base64,'));
  assert.equal(b.ctx.DriveApp.__files[x.anh[0].id].shared, false);
  err(b.call('photo', { id: 'khongcofile123' }, b.kt), 'KHONG_CO');
});

test('dữ liệu mẫu: nâng cấp tính tiêu thụ cho mọi kỳ cũ, tổng tháng khớp chênh lệch chỉ số', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const tk = b.login('NV002', '222222');
  const d = ok(b.call('data', {}, tk));
  assert.equal(d.phienBan, '2.2.0');
  const ct = d.congTo.find((c) => c.ten.startsWith('Tủ điện tổng số 1'));
  const rows = d.chiSo.filter((x) => x.ma === ct.ma).sort((a, c) => (a.ky > c.ky ? 1 : -1));
  assert.ok(rows.length > 10);
  assert.ok(rows.slice(1).every((x) => x.tieuThu && x.tieuThu['1.8.0']), 'mọi kỳ sau kỳ đầu đều có tiêu thụ');
  // Tháng 8: tổng 3 kỳ = (số 31/8 − số 31/7) × hệ số
  const v = (k) => rows.find((x) => x.ky === k).giaTri['1.8.0'];
  const aug = rows.filter((x) => x.ky.startsWith('2026-08')).reduce((a, x) => a + x.tieuThu['1.8.0'].tt, 0);
  assert.equal(Math.round(aug), Math.round((v('2026-08-31') - v('2026-07-31')) * ct.heSo));
  // Gọi lại không tính lại nữa
  assert.equal(b.ctx.nangCapLanDau(), null);
});

test('kho: tồn tối thiểu từ file ERP hoặc đặt trong app; liên kết mã ERP có nhật ký', () => {
  const b = loadBackend();
  const ql = b.login('NV002', '222222');
  ok(b.call('importKho', { file: 'erp.xlsx', soDong: 2, ds: [
    { ma: '605010022', ten: 'Vòng bi 6009-2Z', qc: '6009-2Z', dv: '个', ton: 45, tonMin: 10, vt: [['Kho 1', 'AA21', 20], ['Kho 1', 'AB21', 25]] },
    { ma: '605010099', ten: 'Dây curoa A42', qc: 'A42', dv: '条', ton: 0, vt: [] }] }, ql));
  let kho = ok(b.call('catalog', {}, ql)).ds;
  assert.equal(kho.find((x) => x.ma === '605010022').tonMin, 10);
  ok(b.call('saveKho', { ma: '605010099', tonMin: 2 }, ql));
  err(b.call('saveKho', { ma: '605010099', ten: 'Đổi tên' }, ql), 'KHO_ERP');
  kho = ok(b.call('catalog', {}, ql)).ds;
  assert.equal(kho.find((x) => x.ma === '605010099').tonMin, 2);
  const m = ok(b.call('data', {}, ql)).may[0];
  ok(b.call('saveLists', { ma: m.ma, linhKien: [{ id: 'LK01', ten: 'Vòng bi', quyCach: '', dv: 'cái', sl: 2, viTriMay: 'Motor chính', mucDo: 'cao' }] }, ql));
  const lk = ok(b.call('saveLists', { ma: m.ma, linhKien: [{ id: 'LK01', ten: 'Vòng bi', dv: 'cái', sl: 2, maKho: '605010022', viTriMay: 'Motor chính', mucDo: 'cao' }] }, ql)).may.linhKien[0];
  assert.deepEqual([lk.maKho, lk.viTriMay, lk.mucDo], ['605010022', 'Motor chính', 'cao']);
  const nk = ok(b.call('audit', {}, ql)).ds.map((a) => a.hanhDong);
  assert.ok(nk.includes('DOI_MA_ERP') || nk.includes('LIEN_KET_ERP'), nk.join(','));
});

// ===================== Sửa chữa =====================
function setupSC() {
  const b = loadBackend({ now: '2026-10-05T03:00:00Z' });      // 10:00 giờ Việt Nam
  b.ctx.PropertiesService.getScriptProperties().setProperty('NHAP_EXCEL', 'test');
  const ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333'), ad = b.login('NV001', '111111');
  return Object.assign(b, { ql, kt, ad });
}
const bao = (b, tk, more, opId) => b.call('reportRepair', Object.assign({ ma: 'M001', mucDo: 'DUNG', moTa: 'Không chạy', lucHong: '2026-10-05T08:00' }, more || {}), tk, opId);
const buoc = (b, tk, id, bc, more, opId) => b.call('updateRepair', Object.assign({ id, buoc: bc }, more || {}), tk, opId);

test('sửa chữa: báo hỏng → nhận → chờ linh kiện → sửa xong → trả lại → nghiệm thu; thời gian dừng; gửi lại không trùng', () => {
  const b = setupSC();
  const x = ok(bao(b, b.kt, { id: 'SCTEST0001' }, 'op1')).suaChua;
  assert.deepEqual([x.id, x.so, x.trangThai, x.lucHong, x.nguoiBao, x.tenMay], ['SCTEST0001', 1, 'CHO_SUA', '2026-10-05 08:00:00', 'Kỹ thuật', '喷印机 VKY01']);
  // Gửi lại cùng opId (mất mạng giữa chừng) → trả phiếu cũ
  assert.equal(ok(bao(b, b.kt, { id: 'SCTEST0001' }, 'op1')).dup, true);
  assert.equal(b.ctx.docSuaChua().length, 1);
  err(bao(b, b.kt, { id: 'SCTEST0001' }, 'opKhac'), 'TRUNG_ID');
  err(bao(b, b.kt, { moTa: '  ' }), 'CAN_MO_TA');
  err(bao(b, b.kt, { ma: 'M999' }), 'KHONG_CO_MAY');
  err(bao(b, b.kt, { lucHong: '2026-10-05 11:00' }), 'NGAY_TUONG_LAI');
  err(bao(b, b.kt, { lucHong: '2026-13-05 08:00' }), 'TG_SAI');
  // Máy khách cũ không gửi id → máy chủ tự tạo; số phiếu tăng dần
  const x2 = ok(bao(b, b.ql, { ma: 'M002', mucDo: 'HAN_CHE' })).suaChua;
  assert.match(x2.id, /^SC\d+/); assert.equal(x2.so, 2);

  const id = x.id;
  assert.equal(ok(buoc(b, b.kt, id, 'nhan', {}, 'op2')).suaChua.trangThai, 'DANG_SUA');
  const daNhan = err(buoc(b, b.ad, id, 'nhan'), 'DA_NHAN');
  assert.equal(daNhan.message, 'Kỹ thuật');
  err(buoc(b, b.kt, id, 'cholk'), 'CAN_LY_DO');
  assert.equal(ok(buoc(b, b.kt, id, 'cholk', { ghiChu: 'Chờ vòng bi 6205' })).suaChua.trangThai, 'CHO_LK');
  err(buoc(b, b.kt, id, 'cholk', { ghiChu: 'x' }), 'SAI_TRANG_THAI');
  assert.equal(ok(buoc(b, b.kt, id, 'tiep')).suaChua.trangThai, 'DANG_SUA');

  b.setNow('2026-10-05T05:00:00Z');                               // 12:00
  err(buoc(b, b.kt, id, 'xong', { xuLy: '' }), 'CAN_XU_LY');
  err(buoc(b, b.kt, id, 'xong', { xuLy: 'Thay vòng bi', lucXong: '2026-10-05 07:00' }), 'TG_TRUOC_HONG');
  const xong = ok(buoc(b, b.kt, id, 'xong', {
    xuLy: 'Thay vòng bi, căn chỉnh', nguyenNhan: 'Vòng bi mòn', nguoiSua: 'Lê Minh Tiến, Nguyễn tuấn',
    lucXong: '2026-10-05T10:15', lucChay: '2026-10-05T10:30',
    linhKien: [{ id: 'LKX1', ten: 'Vòng bi 6205', dv: 'cái', sl: 2, loai: 'THAY' }, { ten: '', sl: 1 }]
  }, 'op3'));
  assert.deepEqual([xong.suaChua.trangThai, xong.suaChua.phutDung, xong.suaChua.nguoiSua, xong.suaChua.linhKien.length],
    ['XONG', 150, 'Lê Minh Tiến, Nguyễn tuấn', 1]);
  // Linh kiện mới dùng khi sửa được thêm vào danh sách linh kiện của máy
  assert.ok(xong.may.linhKien.some((k) => k.ten === 'Vòng bi 6205' && /sửa chữa/.test(k.ghiChu)));
  assert.equal(ok(buoc(b, b.kt, id, 'xong', { xuLy: 'x' }, 'op3')).dup, true);
  err(buoc(b, b.kt, id, 'nghiemthu'), 'KHONG_QUYEN');
  err(buoc(b, b.ql, id, 'tralai'), 'CAN_LY_DO');
  assert.equal(ok(buoc(b, b.ql, id, 'tralai', { ghiChu: 'Còn kêu' })).suaChua.trangThai, 'DANG_SUA');
  ok(buoc(b, b.kt, id, 'xong', { xuLy: 'Thay lại vòng bi', lucXong: '2026-10-05 11:00', lucChay: '2026-10-05 11:10' }));
  const dong = ok(buoc(b, b.ql, id, 'nghiemthu')).suaChua;
  assert.deepEqual([dong.trangThai, dong.nguoiNghiemThu, dong.phutDung], ['DONG', 'Quản lý', 190]);
  assert.deepEqual(dong.nhatKy.map((n) => n.b), ['bao', 'nhan', 'cholk', 'tiep', 'xong', 'tralai', 'xong', 'nghiemthu']);
  err(buoc(b, b.ql, id, 'huy', { ghiChu: 'x' }), 'SAI_TRANG_THAI');
  // Dữ liệu tải về có phiếu; cột trên sheet đọc được trực tiếp
  const d = ok(b.call('data', {}, b.kt));
  assert.equal(d.suaChua.find((r) => r.id === id).trangThai, 'DONG');
  const H = b.ctx.BANG.SuaChua, row = b.ctx.docTho('SuaChua').find((r) => r[0] === id);
  assert.equal(row[H.indexOf('PhutDung')], 190);
  assert.equal(row[H.indexOf('TrangThai')], 'DONG');
});

test('sửa chữa: quyền huỷ; Quản lý sửa xong thì đóng luôn; chạy hạn chế không tính dừng máy; báo Telegram', () => {
  const b = setupSC();
  ok(b.call('notifySave', { tgToken: '123:abc', tgChat: '-100123', tgBat: true }, b.ad));
  b.ctx.__net.log.length = 0;
  const a = ok(bao(b, b.kt, { id: 'SCTEST000A' })).suaChua;
  const tg = b.ctx.__net.log.filter((l) => /sendMessage/.test(l.url));
  assert.equal(tg.length, 1);
  assert.match(String(tg[0].opt.payload), /BÁO HỎNG/);
  // Người báo tự huỷ khi chưa ai nhận, không cần lý do
  ok(buoc(b, b.kt, a.id, 'huy'));
  const c = ok(bao(b, b.ql, { id: 'SCTEST000C', mucDo: 'HAN_CHE' })).suaChua;
  err(buoc(b, b.kt, c.id, 'huy'), 'KHONG_QUYEN');                  // phiếu người khác báo
  ok(buoc(b, b.kt, c.id, 'nhan'));
  err(buoc(b, b.ql, c.id, 'huy'), 'CAN_LY_DO');
  b.setNow('2026-10-05T04:00:00Z');
  const cx = ok(buoc(b, b.ql, c.id, 'xong', { xuLy: 'Vệ sinh' })).suaChua;
  assert.deepEqual([cx.trangThai, cx.phutDung, cx.lucXong, cx.nhatKy.slice(-2).map((n) => n.b)], ['DONG', '', '2026-10-05 11:00:00', ['xong', 'nghiemthu']]);
  assert.ok(b.ctx.__net.log.some((l) => /ĐÃ SỬA XONG/.test(String(l.opt && l.opt.payload))));
  const nk = ok(b.call('audit', { bang: 'SuaChua' }, b.ql)).ds;
  assert.equal(nk[0].hanhDong, 'huy');
  // Tắt báo hỏng thì không gửi
  ok(b.call('notifySave', { baoHong: false }, b.ad));
  b.ctx.__net.log.length = 0;
  ok(bao(b, b.kt, { ma: 'M003' }));
  assert.equal(b.ctx.__net.log.filter((l) => /sendMessage/.test(l.url)).length, 0);
  // Nhắc hằng ngày có mục sửa chữa chưa xong
  const t = b.ctx.tomTat('2026-10-05', 3);
  assert.equal(t.sc.length, 1);
  assert.match(b.ctx.noiDungNhac(t, '2026-10-05', b.ctx.docCaiDat(), false).tg, /Sửa chữa chưa xong/);
});

test('xác nhận bảo dưỡng vẫn gắn linh kiện vào máy và kho như trước (sau khi tách hàm dùng chung)', () => {
  const b = setupSC();
  ok(b.call('saveLists', { ma: 'M001', linhKien: [{ id: 'LK01', ten: 'Lọc gió', dv: 'cái', sl: 1 }] }, b.ql));
  const r = ok(b.call('confirm', { ma: 'M001', ngay: '2026-10-05', nguoi: 'A', chiTiet: { lk: [
    { id: 'zzz', ten: 'lọc gió', sl: 1 }, { id: 'LKN1', ten: 'Dây curoa A42', dv: 'sợi', sl: 1 }] } }, b.kt));
  assert.deepEqual(r.ban.chiTiet.lk.map((k) => k.id), ['LK01', 'LKN1']);       // trùng tên → dùng mã sẵn có
  assert.deepEqual(r.may.linhKien.map((k) => k.ten), ['Lọc gió', 'Dây curoa A42']);
  assert.match(r.may.linhKien[1].ghiChu, /bảo dưỡng/);
  assert.ok(r.kho && r.kho.ds.some((k) => k.ten === 'Dây curoa A42'), 'linh kiện mới được thêm vào kho');
});

// ===================== Công việc =====================
const viec = (b, tk, more, opId) => b.call('saveTask', Object.assign({ tieuDe: 'Thay đèn xưởng 2', loai: 'SUA' }, more || {}), tk, opId);
const buocCV = (b, tk, id, bc, more, opId) => b.call('updateTask', Object.assign({ id, buoc: bc }, more || {}), tk, opId);

test('công việc: kỹ thuật ghi → chờ giao; Quản lý giao nhiều việc; làm → xong → kiểm tra; quyền; gửi lại không trùng', () => {
  const b = setupSC();
  const nv = ok(b.call('data', {}, b.ql)).nhanVien;
  const kt = nv.find((n) => n.maNV === 'NV003'), ad = nv.find((n) => n.maNV === 'NV001');
  const a = ok(viec(b, b.kt, { id: 'CVTEST0001', han: '2026-10-06' }, 'o1')).congViec;
  assert.deepEqual([a.id, a.so, a.trangThai, a.canKiemTra, a.nguoiTao], ['CVTEST0001', 1, 'CHO_GIAO', true, 'Kỹ thuật']);
  assert.equal(ok(viec(b, b.kt, { id: 'CVTEST0001' }, 'o1')).dup, true);
  // Kỹ thuật ghi kèm người làm thì vẫn chờ Quản lý giao
  const c = ok(viec(b, b.kt, { tieuDe: 'Vệ sinh khu máy nén', loai: 'VS', uidLam: kt.id })).congViec;
  assert.deepEqual([c.trangThai, c.canKiemTra], ['CHO_GIAO', false]);
  err(viec(b, b.kt, { tieuDe: ' ' }), 'CAN_TIEU_DE');
  err(b.call('assignTasks', { ids: [a.id, c.id], uidLam: kt.id }, b.kt), 'KHONG_QUYEN');
  err(b.call('assignTasks', { ids: [a.id], uidLam: 'U999' }, b.ql), 'KHONG_CO_NV');
  const g = ok(b.call('assignTasks', { ids: [a.id, c.id], uidLam: kt.id, uidPhu: [ad.id, kt.id] }, b.ql, 'o2')).dsCongViec;
  assert.deepEqual(g.map((x) => [x.trangThai, x.nguoiLam, x.uidPhu.join()]), [['DA_GIAO', 'Kỹ thuật', ad.id], ['DA_GIAO', 'Kỹ thuật', ad.id]]);
  assert.equal(ok(b.call('assignTasks', { ids: [a.id, c.id], uidLam: kt.id }, b.ql, 'o2')).dup, true);
  // Người không được giao không làm được
  const ql2 = b.login('NV002', '222222');
  ok(buocCV(b, b.kt, a.id, 'batdau'));
  err(buocCV(b, b.kt, a.id, 'hoan'), 'CAN_LY_DO');
  ok(buocCV(b, b.kt, a.id, 'hoan', { ghiChu: 'Chờ bóng đèn' }));
  err(buocCV(b, b.kt, a.id, 'xong', { ketQua: '' }), 'CAN_KET_QUA');
  const x = ok(buocCV(b, b.kt, a.id, 'xong', { ketQua: 'Đã thay 4 bóng', linhKien: [{ ten: 'Bóng LED 1m2', dv: 'cái', sl: 4 }] }, 'o3'));
  assert.equal(x.congViec.trangThai, 'XONG');
  assert.ok(x.kho.ds.some((k) => k.ten === 'Bóng LED 1m2'), 'linh kiện dùng cho việc không gắn máy vẫn vào kho');
  err(buocCV(b, b.kt, a.id, 'kiemtra'), 'KHONG_QUYEN');
  ok(buocCV(b, ql2, a.id, 'tralai', { ghiChu: 'Còn 1 bóng chập chờn' }));
  ok(buocCV(b, b.kt, a.id, 'xong', { ketQua: 'Thay thêm 1 bóng' }));
  const d = ok(buocCV(b, b.ql, a.id, 'kiemtra')).congViec;
  assert.deepEqual([d.trangThai, d.nguoiKiemTra], ['DONG', 'Quản lý']);
  assert.deepEqual(d.nhatKy.map((n) => n.b), ['tao', 'giao', 'batdau', 'hoan', 'xong', 'tralai', 'xong', 'kiemtra']);
  // Việc vệ sinh không cần kiểm tra: xong là đóng
  assert.equal(ok(buocCV(b, b.kt, c.id, 'xong', { ketQua: 'Sạch' })).congViec.trangThai, 'DONG');
  // Quản lý ghi kèm người làm → đã giao luôn; huỷ cần lý do; người tạo tự huỷ việc chưa giao
  const e = ok(viec(b, b.ql, { tieuDe: 'Lắp quạt', loai: 'LAP', uidLam: kt.id })).congViec;
  assert.equal(e.trangThai, 'DA_GIAO');
  err(buocCV(b, b.ql, e.id, 'huy'), 'CAN_LY_DO');
  ok(buocCV(b, b.ql, e.id, 'huy', { ghiChu: 'Không cần nữa' }));
  const f = ok(viec(b, b.kt, { tieuDe: 'Ghi nhầm' })).congViec;
  ok(buocCV(b, b.kt, f.id, 'huy'));
  // Sửa việc: kỹ thuật chỉ sửa việc mình ghi khi chưa giao
  err(viec(b, b.kt, { id: e.id, tieuDe: 'x' }), 'SAI_TRANG_THAI');
  const data = ok(b.call('data', {}, b.kt));
  assert.ok(data.congViec.some((v) => v.id === a.id && v.trangThai === 'DONG'));
});

test('công việc: giao bảo dưỡng thì xác nhận bảo dưỡng đóng luôn việc; giao phiếu sửa chữa cho người', () => {
  const b = setupSC();
  const kt = ok(b.call('data', {}, b.ql)).nhanVien.find((n) => n.maNV === 'NV003');
  const v = ok(viec(b, b.ql, { tieuDe: 'Bảo dưỡng M001', loai: 'BD', ma: 'M001', uidLam: kt.id, han: '2026-10-05' })).congViec;
  const r = ok(b.call('confirm', { ma: 'M001', ngay: '2026-10-05', nguoi: 'Kỹ thuật' }, b.kt));
  assert.deepEqual(r.dsCongViec.map((x) => [x.id, x.trangThai]), [[v.id, 'DONG']]);
  const sc = ok(bao(b, b.kt, { id: 'SCTEST0G01' })).suaChua;
  err(buoc(b, b.kt, sc.id, 'giao', { uid: kt.id }), 'KHONG_QUYEN');
  const g = ok(buoc(b, b.ql, sc.id, 'giao', { uid: kt.id })).suaChua;
  assert.deepEqual([g.trangThai, g.uidSua, g.nguoiSua], ['CHO_SUA', kt.id, 'Kỹ thuật']);
  const n = ok(buoc(b, b.kt, sc.id, 'nhan')).suaChua;
  assert.deepEqual([n.trangThai, n.uidSua], ['DANG_SUA', kt.id]);
});

test('việc lặp lại: sinh việc đúng ngày, giao sẵn người làm, không sinh trùng, bật lại không sinh bù', () => {
  const b = setupSC();                                   // 2026-10-05 là Thứ Hai
  const kt = ok(b.call('data', {}, b.ql)).nhanVien.find((n) => n.maNV === 'NV003');
  err(b.call('saveRecurring', { tieuDe: 'Kiểm tra bình chữa cháy', kieu: 'tuan', ngay: '' }, b.ql), 'CAN_NGAY_LAP');
  err(b.call('saveRecurring', { tieuDe: 'x', kieu: 'ngay' }, b.kt), 'KHONG_QUYEN');
  const r = ok(b.call('saveRecurring', { tieuDe: 'Kiểm tra bình chữa cháy', loai: 'KHAC', kieu: 'tuan', ngay: '1', uidLam: kt.id }, b.ql));
  assert.deepEqual(r.dsCongViec.map((x) => [x.han, x.trangThai, x.nguoiLam]), [['2026-10-05', 'DA_GIAO', 'Kỹ thuật']]);
  ok(b.call('saveRecurring', { tieuDe: 'Vệ sinh nhà ăn', loai: 'VS', kieu: 'ngay' }, b.ql));
  b.setNow('2026-10-08T03:00:00Z');                      // Thứ Năm: tải dữ liệu thì bù Thứ Ba, Tư, Năm
  let d = ok(b.call('data', {}, b.ql));
  const vs = d.congViec.filter((x) => x.tieuDe === 'Vệ sinh nhà ăn').map((x) => x.han).sort();
  assert.deepEqual(vs, ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
  d = ok(b.call('data', {}, b.ql));
  assert.equal(d.congViec.filter((x) => x.tieuDe === 'Vệ sinh nhà ăn').length, 4, 'tải lại không sinh trùng');
  b.setNow('2026-10-12T03:00:00Z');                      // Thứ Hai tuần sau
  d = ok(b.call('data', {}, b.ql));
  assert.deepEqual(d.congViec.filter((x) => x.tieuDe === 'Kiểm tra bình chữa cháy').map((x) => x.han).sort(), ['2026-10-05', '2026-10-12']);
  // Tắt rồi bật lại sau 5 ngày: không sinh bù những ngày đã tắt
  const vl = d.viecLap.find((x) => x.tieuDe === 'Vệ sinh nhà ăn');
  ok(b.call('saveRecurring', Object.assign({}, vl, { hoatDong: false }), b.ql));
  b.setNow('2026-10-17T03:00:00Z');
  ok(b.call('saveRecurring', Object.assign({}, vl, { hoatDong: true }), b.ql));
  d = ok(b.call('data', {}, b.ql));
  const sau = d.congViec.filter((x) => x.tieuDe === 'Vệ sinh nhà ăn' && x.han > '2026-10-12').map((x) => x.han);
  assert.deepEqual(sau, ['2026-10-17']);
  // Tháng: ngày 31 ở tháng 30 ngày rơi vào ngày cuối tháng
  assert.equal(b.ctx.ngayKhop({ kieu: 'thang', ngay: '31' }, '2026-11-30'), true);
  // Nhắc hằng ngày có mục việc quá hạn
  const t = b.ctx.tomTat('2026-10-17', 3);
  assert.ok(t.cvQua.length > 0);
});
