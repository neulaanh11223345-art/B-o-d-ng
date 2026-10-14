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
  assert.equal(d.phienBan, '2.0.0');
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
