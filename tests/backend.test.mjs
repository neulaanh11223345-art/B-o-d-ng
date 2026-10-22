// Kiểm thử máy chủ (Code.gs) — chạy: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBackend } from './harness.mjs';
import { readFileSync } from 'node:fs';
const PHIEN_BAN = JSON.parse(readFileSync(new URL('../src/config.json', import.meta.url), 'utf8')).version;

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

test('xác nhận tiêu thụ bất thường: chỉ Quản lý, xác nhận cả loạt, bỏ xác nhận được', () => {
  const b = setup({ heSo: 1 });
  const ky = ['2026-08-31', '2026-09-10', '2026-09-20', '2026-09-30'];
  b.setNow('2026-09-30T03:00:00Z');
  [1000, 1100, 1200, 1300].forEach((v, i) => ok(ghi(b, b.ql, ky[i], v)));
  b.setNow('2026-10-10T03:00:00Z');
  const x = ok(ghi(b, b.kt, '2026-10-10', 1500, { xacNhanBatThuong: true, ngoaiLe: { batThuongLyDo: 'Máy dừng kỳ trước' } })).chiSo;
  assert.ok(x.ngoaiLe.batThuong, 'có cờ bất thường');
  assert.equal(x.ngoaiLe.batThuong.duyet, undefined, 'chưa ai xác nhận');
  // Kỹ thuật không xác nhận được
  err(b.call('confirmAbnormal', { ids: [x.id] }, b.kt), 'KHONG_QUYEN');
  // Quản lý xác nhận: số liệu giữ nguyên, chỉ thêm dấu đã xác nhận
  const r = ok(b.call('confirmAbnormal', { ids: [x.id], ghiChu: 'Chuyền VKY10 dừng cả kỳ trước' }, b.ql));
  assert.equal(r.n, 1);
  const d = r.dsChiSo[0].ngoaiLe.batThuong.duyet;
  assert.deepEqual([d.nguoi, d.ghiChu], ['Quản lý', 'Chuyền VKY10 dừng cả kỳ trước']);
  assert.equal(r.dsChiSo[0].giaTri['1.8.0'], 1500, 'số liệu không đổi');
  assert.equal(r.dsChiSo[0].ngoaiLe.batThuong.lyDo, 'Máy dừng kỳ trước', 'giữ lý do người ghi nhập');
  // Xác nhận lại lần nữa thì báo không có gì để xác nhận
  err(b.call('confirmAbnormal', { ids: [x.id] }, b.ql), 'KHONG_CO');
  err(b.call('confirmAbnormal', { ids: [] }, b.ql), 'THIEU_CHON');
  // Bỏ xác nhận: cảnh báo hiện lại
  const r2 = ok(b.call('confirmAbnormal', { ids: [x.id], bo: true }, b.ql));
  assert.equal(r2.dsChiSo[0].ngoaiLe.batThuong.duyet, undefined);
  assert.ok(r2.dsChiSo[0].ngoaiLe.batThuong, 'vẫn là bản ghi bất thường');
  // Xác nhận cả loạt: mã lạ và bản ghi không bất thường thì bỏ qua, không làm hỏng cả lượt
  b.setNow('2026-10-20T03:00:00Z');
  const y = ok(ghi(b, b.kt, '2026-10-20', 1600)).chiSo;
  assert.ok(!(y.ngoaiLe && y.ngoaiLe.batThuong), 'kỳ này trong ngưỡng, không bất thường');
  const r3 = ok(b.call('confirmAbnormal', { ids: [x.id, y.id, 'CS_KHONG_CO'] }, b.ql));
  assert.deepEqual([r3.n, r3.dsChiSo.map((v) => v.id)], [1, [x.id]]);
  // Nhật ký ghi lại ai xác nhận
  const nk = ok(b.call('audit', { bang: 'ChiSo' }, b.ql)).ds;
  assert.ok(nk.some((v) => v.hanhDong === 'XAC_NHAN_BT'), 'có dòng nhật ký xác nhận');
  assert.ok(nk.some((v) => v.hanhDong === 'BO_XAC_NHAN_BT'), 'có dòng nhật ký bỏ xác nhận');
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
  assert.equal(d.phienBan, PHIEN_BAN, 'phiên bản máy chủ khớp src/config.json');
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

test('công việc: giao bảo dưỡng thì xác nhận bảo dưỡng đóng luôn việc; việc sửa chữa lưu nguyên nhân và giờ dừng; kỹ thuật tự ghi việc mình làm', () => {
  const b = setupSC();
  const kt = ok(b.call('data', {}, b.ql)).nhanVien.find((n) => n.maNV === 'NV003');
  const v = ok(viec(b, b.ql, { tieuDe: 'Bảo dưỡng M001', loai: 'BD', ma: 'M001', uidLam: kt.id, han: '2026-10-05' })).congViec;
  const r = ok(b.call('confirm', { ma: 'M001', ngay: '2026-10-05', nguoi: 'Quản lý' }, b.ql));
  assert.deepEqual(r.dsCongViec.map((x) => [x.id, x.trangThai]), [[v.id, 'DONG']]);
  // Kỹ thuật thấy máy hỏng, tự ghi việc và sửa luôn
  const s1 = ok(viec(b, b.kt, { tieuDe: 'Motor M002 không chạy', loai: 'SUA', ma: 'M002', tuLam: true })).congViec;
  assert.deepEqual([s1.trangThai, s1.uidLam], ['DA_GIAO', kt.id]);
  const x = ok(buocCV(b, b.kt, s1.id, 'xong', { ketQua: 'Thay contactor', nguyenNhan: 'Lỗi điện', gioDung: 1.5 })).congViec;
  assert.deepEqual([x.trangThai, x.nguyenNhan, x.phutDung], ['XONG', 'Lỗi điện', 90]);
  const H = b.ctx.BANG.CongViec, row = b.ctx.docTho('CongViec').find((rr) => rr[0] === s1.id);
  assert.equal(row[H.indexOf('PhutDung')], 90);
  ok(buocCV(b, b.ql, s1.id, 'kiemtra'));
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
  // Hai việc lặp lại tạo liên tiếp phải khác mã: trùng mã thì việc của mẫu sau không được sinh ra
  const vls = ok(b.call('data', {}, b.ql)).viecLap;
  assert.equal(new Set(vls.map((v) => v.id)).size, vls.length, 'mã việc lặp lại không được trùng');
  // Tháng: ngày 31 ở tháng 30 ngày rơi vào ngày cuối tháng
  assert.equal(b.ctx.ngayKhop({ kieu: 'thang', ngay: '31' }, '2026-11-30'), true);
  // Nhắc hằng ngày có mục việc quá hạn
  const t = b.ctx.tomTat('2026-10-17', 3);
  assert.ok(t.cvQua.length > 0);
});

// ===================== Tự dịch Việt ↔ Trung =====================
test('tự dịch: dịch khi lưu (Việt → Trung, Trung → Việt), tách "Việt · 中文", sửa tay không bị dịch đè, kết quả / nguyên nhân / lý do cũng dịch', () => {
  const b = setupSC();
  b.ctx.__dichMau.push(['Thay đèn xưởng 2', '更换二车间灯'], ['Đèn xưởng 2 bị cháy', '二车间灯烧坏了'], ['Thay phớt máy bơm', '更换水泵密封圈'],
    ['Đã thay 4 bóng', '已更换4个灯泡'], ['Lỗi điện', '电气故障'], ['Chờ bóng đèn', '等灯泡'], ['Thay đèn xưởng 3', '更换三车间灯']);
  const a = ok(viec(b, b.ql, { tieuDe: 'Thay đèn xưởng 2', moTa: 'Đèn xưởng 2 bị cháy', loai: 'SUA' })).congViec;
  assert.deepEqual([a.tieuDe, a.tieuDeDich, a.moTaDich], ['Thay đèn xưởng 2', '更换二车间灯', '二车间灯烧坏了']);
  // Người Trung gõ tiếng Trung → dịch sang tiếng Việt
  const z = ok(viec(b, b.kt, { tieuDe: '更换水泵密封圈' })).congViec;
  assert.deepEqual([z.tieuDe, z.tieuDeDich], ['更换水泵密封圈', 'Thay phớt máy bơm']);
  // Gõ sẵn hai thứ tiếng → tách đôi, không gọi Google
  let goi = b.ctx.__dich.goi;
  const h = ok(viec(b, b.ql, { tieuDe: 'Lắp quạt · 安装风扇' })).congViec;
  assert.deepEqual([h.tieuDe, h.tieuDeDich, b.ctx.__dich.goi], ['Lắp quạt', '安装风扇', goi]);
  // Chỉ có mã / số → không dịch
  assert.equal(ok(viec(b, b.ql, { tieuDe: 'M001 - 2026' })).congViec.tieuDeDich, '');
  // Chữ lẫn hai thứ tiếng (tên máy tiếng Trung) không tự dịch; app gửi kèm bản dịch điền sẵn thì dùng
  goi = b.ctx.__dich.goi;
  assert.equal(ok(viec(b, b.ql, { tieuDe: 'Bảo dưỡng 喷印机 VKY01', loai: 'BD' })).congViec.tieuDeDich, '');
  const bd = ok(viec(b, b.ql, { tieuDe: 'Bảo dưỡng 喷印机 VKY01', tieuDeDich: '保养 喷印机 VKY01', loai: 'BD' })).congViec;
  assert.deepEqual([bd.tieuDe, bd.tieuDeDich, b.ctx.__dich.goi], ['Bảo dưỡng 喷印机 VKY01', '保养 喷印机 VKY01', goi]);
  // Sửa hạn, không đổi chữ → giữ bản dịch, không gọi Google lại
  goi = b.ctx.__dich.goi;
  const sua = (more) => ok(viec(b, b.ql, Object.assign({ id: a.id, tieuDe: 'Thay đèn xưởng 2', moTa: 'Đèn xưởng 2 bị cháy', loai: 'SUA' }, more))).congViec;
  assert.equal(sua({ han: '2026-10-07' }).tieuDeDich, '更换二车间灯');
  assert.equal(b.ctx.__dich.goi, goi);
  // Sửa tay bản dịch → dùng bản sửa tay; lần sửa sau không bị dịch đè
  assert.equal(sua({ tieuDeDich: '更换2号车间照明灯' }).tieuDeDich, '更换2号车间照明灯');
  assert.equal(sua({ han: '2026-10-08' }).tieuDeDich, '更换2号车间照明灯');
  // Gửi bản dịch rỗng = nhờ dịch lại; đổi chữ gốc → dịch lại
  assert.equal(sua({ tieuDeDich: '' }).tieuDeDich, '更换二车间灯');
  assert.equal(sua({ tieuDe: 'Thay đèn xưởng 3' }).tieuDeDich, '更换三车间灯');
  // Lý do tạm hoãn, kết quả, nguyên nhân được dịch
  const kt = ok(b.call('data', {}, b.ql)).nhanVien.find((n) => n.maNV === 'NV003');
  ok(b.call('assignTasks', { ids: [a.id], uidLam: kt.id }, b.ql));
  const hn = ok(buocCV(b, b.kt, a.id, 'hoan', { ghiChu: 'Chờ bóng đèn' })).congViec;
  assert.equal(hn.nhatKy[hn.nhatKy.length - 1].gcDich, '等灯泡');
  const xg = ok(buocCV(b, b.kt, a.id, 'xong', { ketQua: 'Đã thay 4 bóng', nguyenNhan: 'Lỗi điện' })).congViec;
  assert.deepEqual([xg.ketQuaDich, xg.nguyenNhanDich], ['已更换4个灯泡', '电气故障']);
  // Đọc được bản dịch trực tiếp trên sheet
  const H = b.ctx.BANG.CongViec, row = b.ctx.docTho('CongViec').find((r) => r[0] === a.id);
  assert.deepEqual([row[H.indexOf('TieuDeDich')], row[H.indexOf('KetQuaDich')]], ['更换三车间灯', '已更换4个灯泡']);
  // Tin Telegram giao việc có cả hai thứ tiếng
  ok(b.call('notifySave', { tgToken: '123:abc', tgChat: '-100123', tgBat: true }, b.ad));
  b.ctx.__net.log.length = 0;
  ok(viec(b, b.ql, { tieuDe: 'Thay phớt máy bơm', uidLam: kt.id }));
  assert.match(String(b.ctx.__net.log.find((l) => /sendMessage/.test(l.url)).opt.payload), /Thay phớt máy bơm · 更换水泵密封圈/);
});

test('tự dịch: Google lỗi / hết hạn mức thì việc vẫn lưu, 1 giờ sau tự dịch bù; việc lặp lại dịch một lần ở mẫu', () => {
  const b = setupSC();
  b.ctx.__dichMau.push(['Kiểm tra bình chữa cháy', '检查灭火器'], ['Vệ sinh nhà ăn', '清洁食堂']);
  b.ctx.__dich.loi = true;
  const l = ok(viec(b, b.ql, { tieuDe: 'Kiểm tra bình chữa cháy' })).congViec;
  assert.deepEqual([l.trangThai, l.tieuDeDich], ['CHO_GIAO', '']);
  assert.ok(b.ctx.PropertiesService.getScriptProperties().getProperty('DICH_THIEU'), 'đánh dấu còn thiếu bản dịch');
  b.ctx.__dich.loi = false;
  let d = ok(b.call('data', {}, b.ql));
  assert.equal(d.congViec.find((v) => v.id === l.id).tieuDeDich, '', 'chưa đủ 1 giờ thì chưa dịch bù');
  b.setNow('2026-10-05T04:30:00Z');
  d = ok(b.call('data', {}, b.ql));
  assert.equal(d.congViec.find((v) => v.id === l.id).tieuDeDich, '检查灭火器');
  assert.equal(b.ctx.PropertiesService.getScriptProperties().getProperty('DICH_THIEU'), null, 'dịch xong thì bỏ dấu');
  // Việc lặp lại: dịch ở mẫu một lần, việc sinh ra mỗi ngày dùng lại bản dịch
  const goi = b.ctx.__dich.goi;
  const r = ok(b.call('saveRecurring', { tieuDe: 'Vệ sinh nhà ăn', loai: 'VS', kieu: 'ngay' }, b.ql));
  assert.equal(r.viecLap.tieuDeDich, '清洁食堂');
  assert.equal(r.dsCongViec[0].tieuDeDich, '清洁食堂');
  b.setNow('2026-10-07T03:00:00Z');
  d = ok(b.call('data', {}, b.ql));
  assert.ok(d.congViec.filter((v) => v.lapLai === r.viecLap.id).every((v) => v.tieuDeDich === '清洁食堂'));
  assert.equal(b.ctx.__dich.goi, goi + 1, 'chỉ gọi Google một lần cho mẫu');
  // Xác nhận bảo dưỡng đóng việc bảo dưỡng: kết quả có sẵn hai thứ tiếng
  const kt = d.nhanVien.find((n) => n.maNV === 'NV003');
  ok(viec(b, b.ql, { tieuDe: 'Bảo dưỡng M001', loai: 'BD', ma: 'M001', uidLam: kt.id }));
  const c = ok(b.call('confirm', { ma: 'M001', ngay: '2026-10-07', nguoi: 'Kỹ thuật' }, b.kt)).dsCongViec[0];
  assert.match(c.ketQuaDich, /已确认保养 07\/10\/2026/);
});
test('tự dịch: nâng cấp từ bản cũ thì việc đã ghi trước đó cũng được dịch dần', () => {
  const b = setupSC();
  b.ctx.__dichMau.push(['Thay bóng đèn kho', '更换仓库灯泡']);
  ok(b.call('data', {}, b.ql));
  const id = ok(viec(b, b.ql, { tieuDe: 'Thay bóng đèn kho' })).congViec.id;
  const x = b.ctx.docCongViec().find((v) => v.id === id);
  x.tieuDeDich = ''; b.ctx.suaDong('CongViec', x._r, b.ctx.cvThanhDong(x));    // như việc ghi ở bản 2.3, chưa có cột dịch
  const pr = b.ctx.PropertiesService.getScriptProperties();
  pr.setProperty('NANG_CAP', '2.3.0');
  const d = ok(b.call('data', {}, b.ql));
  assert.equal(d.congViec.find((v) => v.id === id).tieuDeDich, '更换仓库灯泡');
  assert.equal(pr.getProperty('DICH_THIEU'), null, 'dịch hết thì bỏ dấu');
});
test('nhập dữ liệu cũ: tạo tài khoản theo bảng phân công, nhập việc đúng người / hạn / trạng thái, chạy lại không trùng; số điện có đến kỳ 10/10', () => {
  const b = setupSC();
  const kq = b.ctx.nhapDuLieuCu();
  assert.match(kq, /Đã nhập 73 việc, 3 việc sửa chữa, tạo 7 tài khoản/);
  const d = ok(b.call('data', {}, b.ql));
  const nv = (ten) => d.nhanVien.find((n) => n.ten === ten);
  assert.equal(nv('Lê Minh Tiến').maNV, 'V25252');
  assert.equal(nv('Bùi Văn Chung').vaiTro, 'quanly');
  assert.ok(nv('吴建杰') && nv('Nguyễn Tuấn').maNV.startsWith('NV'));
  const cu = d.congViec.filter((x) => /^CVCU/.test(x.id));
  assert.equal(cu.length, 73);
  const dem = (tt) => cu.filter((x) => x.trangThai === tt).length;
  assert.deepEqual([dem('DONG'), dem('DANG_LAM'), dem('TAM_HOAN')], [59, 7, 7]);
  const v1 = cu.find((x) => x.id === 'CVCU001');
  assert.equal(v1.nguoiLam, 'Bùi Văn Vân');
  assert.deepEqual(v1.uidPhu, [nv('Lê Minh Tiến').id]);
  assert.equal(v1.han, '2026-07-25');
  // Tên việc viết sẵn hai thứ tiếng (xuống dòng) được tách đôi
  const v40 = cu.find((x) => x.id === 'CVCU040');
  assert.match(v40.tieuDe, /^Thay cảm biến đếm/); assert.match(v40.tieuDeDich, /^更换 VKY18/);
  const sc = d.congViec.filter((x) => /^CVSC/.test(x.id));
  assert.equal(sc.length, 3);
  assert.deepEqual([sc[1].nguoiLam, sc[1].phutDung, sc[1].nguoiKiemTra, sc[1].linhKien[0].quyCach], ['Đỗ Văn Hồng', 20, 'Bùi Văn Chung', '32A 3P']);
  // Người mới đăng nhập được bằng mã NV + PIN in ở nhật ký
  // Chạy lại: không tạo trùng
  assert.match(b.ctx.nhapDuLieuCu(), /Đã nhập 0 việc, 0 việc sửa chữa, tạo 0 tài khoản/);
  // Số điện: có kỳ 10/10/2026
  b.ctx.PropertiesService.getScriptProperties().deleteProperty('NHAP_EXCEL');
  b.ctx.nhapSoDienExcel(true);
  const d2 = ok(b.call('data', {}, b.ql));
  assert.ok(d2.chiSo.some((x) => x.ky === '2026-10-10'), 'có số điện kỳ 10/10');
});
test('chuyền sản xuất: nâng cấp tạo 16 chuyền từ sổ cái, xếp máy in phun vào đúng chuyền; đổi chuyền của máy; sửa thông tin chuyền', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333');
  let d = ok(b.call('data', {}, ql));
  assert.equal(d.chuyen.length, 16);
  const v16 = d.chuyen.find((c) => c.ma === 'VKY16');
  assert.equal(v16.maTaiSan, 'VKYC4(16)');
  assert.match(v16.ngaySX, /05\/2023/);
  const may = (ten) => d.may.find((m) => m.ten === ten);
  assert.equal(may('喷印机 VKY01').chuyen, 'VKY01');
  assert.equal(may('喷印机 VKY16').chuyen, 'VKY16');
  assert.equal(may('Máy hút bụi VKY01').chuyen, 'VKY01', 'máy hút bụi cũng vào chuyền cùng số');
  assert.equal(may('Máy hút bụi VKY17').chuyen, 'VKY17');
  assert.equal(may('打包机Máy đóng bao 01').chuyen, '', 'máy khác không tự xếp');
  // Đổi chuyền của một máy; mã chuyền sai thì báo lỗi
  const hb = may('Máy hút bụi VKY02');
  const sua = (more) => b.call('saveMachine', Object.assign({ ma: hb.ma, ten: hb.ten, nhom: hb.nhom, chuKy: hb.chuKy, hanKeTiep: hb.hanKeTiep }, more), ql);
  assert.equal(ok(sua({ chuyen: 'VKY03' })).may.chuyen, 'VKY03');
  assert.equal(ok(sua({ chuyen: '' })).may.chuyen, '', 'bỏ khỏi chuyền');
  err(sua({ chuyen: 'VKY99' }), 'KHONG_CO_CHUYEN');
  // Sửa thông tin chuyền: Quản lý được, kỹ thuật không
  assert.equal(ok(b.call('saveLine', { ma: 'VKY01', ghiChu: 'Thay dao cắt 10/2026' }, ql)).chuyen.ghiChu, 'Thay dao cắt 10/2026');
  err(b.call('saveLine', { ma: 'VKY01', ghiChu: 'x' }, kt), 'KHONG_QUYEN');
  // Chạy lại không tạo trùng, không đè máy đã xếp
  b.ctx.napChuyen();
  d = ok(b.call('data', {}, ql));
  assert.equal(d.chuyen.length, 16);
  assert.equal(d.chuyen.find((c) => c.ma === 'VKY01').ghiChu, 'Thay dao cắt 10/2026');
});
test('ghi sửa chữa: lưu luôn thành việc đã xong, 3 mục nhiều dòng có tiếng Trung, ngày lùi được, kỹ thuật tự ghi là người xử lý', () => {
  const b = setupSC();
  b.ctx.__dichMau.push(['SAT260 thay cuộn thì in lệch', 'SAT260换料印花跑位'], ['Sức căng quá lớn\nVạch màu lệch', '张力过紧\n色标偏差'], ['Chỉnh sức căng', '调整张力']);
  const d0 = ok(b.call('data', {}, b.ql)), hong = d0.nhanVien.find((n) => n.maNV === 'NV003');
  const r = ok(b.call('saveRepair', { moTa: 'SAT260 thay cuộn thì in lệch', nguyenNhan: 'Sức căng quá lớn\nVạch màu lệch', ketQua: 'Chỉnh sức căng',
    ma: 'M001', ngay: '2026-10-03', uidLam: hong.id, gioDung: 1.5, linhKien: 'Lọc mực\nGioăng' }, b.ql, 'op-sc-1')).congViec;
  assert.deepEqual([r.trangThai, r.loai, r.canKiemTra, r.han, r.lucXong.slice(0, 10), r.phutDung, r.nguoiLam], ['DONG', 'SUA', false, '2026-10-03', '2026-10-03', 90, 'Kỹ thuật']);
  assert.deepEqual([r.tieuDeDich, r.nguyenNhan, r.nguyenNhanDich, r.ketQuaDich], ['SAT260换料印花跑位', 'Sức căng quá lớn\nVạch màu lệch', '张力过紧\n色标偏差', '调整张力']);
  assert.deepEqual(r.linhKien.map((k) => k.ten), ['Lọc mực', 'Gioăng']);
  // Gửi lại cùng opId không tạo trùng
  assert.equal(ok(b.call('saveRepair', { moTa: 'x', ketQua: 'y' }, b.ql, 'op-sc-1')).congViec.id, r.id);
  // Kỹ thuật tự ghi: mặc định là người xử lý; thiếu mô tả / kết quả thì báo lỗi; ngày tương lai bị chặn
  const k = ok(b.call('saveRepair', { moTa: 'Máy kêu to', ketQua: 'Siết bu lông' }, b.kt)).congViec;
  assert.deepEqual([k.trangThai, k.nguoiLam], ['DONG', 'Kỹ thuật']);
  err(b.call('saveRepair', { ketQua: 'y' }, b.kt), 'CAN_MO_TA');
  err(b.call('saveRepair', { moTa: 'x' }, b.kt), 'CAN_KET_QUA');
  err(b.call('saveRepair', { moTa: 'x', ketQua: 'y', ngay: '2026-12-01' }, b.kt), 'NGAY_SAI');
});

test('ghi sửa chữa: linh kiện thay có mã kho và số lượng; kho đã có thì thêm vào danh sách của máy, gõ tay thì không', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ql = b.login('NV002', '222222');
  const d0 = ok(b.call('data', {}, ql));
  const kho = ok(b.call('catalog', {}, ql));
  const coSan = (kho.kho && kho.kho.ds ? kho.kho.ds : kho.ds || []).filter((x) => x.ten && !x.an)[0];
  assert.ok(coSan, 'kho mẫu có linh kiện');
  const truoc = d0.may.find((m) => m.ma === 'M038').linhKien.length;
  const r = ok(b.call('saveRepair', {
    moTa: 'Máy nén khí rò dầu', ketQua: 'Thay gioăng', ma: 'M038', ngay: '2026-10-14',
    linhKien: [
      { id: 'LKNEW1', ten: coSan.ten, quyCach: coSan.qc || '', dv: coSan.dv || '', sl: 2, loai: 'THAY', maKho: coSan.ma },
      { id: 'LKNEW2', ten: 'Gioăng chế bằng tay ngoài kho', quyCach: '', dv: 'cái', sl: 1, loai: 'THAY' }
    ]
  }, ql)).congViec;
  // Bản ghi giữ đủ cả hai, có số lượng
  assert.deepEqual(r.linhKien.map((k) => k.sl), [2, 1]);
  assert.equal(r.linhKien[0].maKho, coSan.ma, 'linh kiện chọn từ kho giữ mã kho');
  // Danh sách linh kiện của máy: chỉ nhận thứ kho đã có
  const may = ok(b.call('data', {}, ql)).may.find((m) => m.ma === 'M038');
  const ten = may.linhKien.map((k) => k.ten);
  assert.equal(may.linhKien.length, truoc + 1, 'chỉ thêm một linh kiện vào danh sách của máy');
  assert.ok(ten.includes(coSan.ten), 'linh kiện có sẵn trong kho được thêm vào máy');
  assert.ok(!ten.includes('Gioăng chế bằng tay ngoài kho'), 'linh kiện gõ tay kho chưa có thì không thêm vào máy');
  // Dạng chữ nhiều dòng của bản cũ vẫn nhận được (bản ghi ngoại tuyến từ app cũ)
  const cu = ok(b.call('saveRepair', { moTa: 'x', ketQua: 'y', ma: 'M038', linhKien: 'Lọc mực\nGioăng' }, ql)).congViec;
  assert.deepEqual(cu.linhKien.map((k) => k.ten), ['Lọc mực', 'Gioăng']);
});

test('mã hiển thị: tự đặt cho chuyền và máy, không trùng, đổi lại hoặc xoá được; mã hệ thống giữ nguyên', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ql = b.login('NV002', '222222');
  let d = ok(b.call('data', {}, ql));
  const ch = ok(b.call('saveLine', { ma: 'VKY01', maHT: 'H2506' }, ql)).chuyen;
  assert.equal(ch.ma, 'VKY01'); assert.equal(ch.maHT, 'H2506');
  const m = d.may.find((x) => x.ten === '喷印机 VKY16');
  const sua = (maHT, x = m) => b.call('saveMachine', { ma: x.ma, ten: x.ten, nhom: x.nhom, chuKy: x.chuKy, hanKeTiep: x.hanKeTiep, maHT }, ql);
  assert.equal(ok(sua('QTN-16')).may.maHT, 'QTN-16');
  const khac = d.may.find((x) => x.ma !== m.ma);
  err(sua('h2506', khac), 'MA_HT_TRUNG');
  err(sua('qtn-16', khac), 'MA_HT_TRUNG');
  err(sua(m.ma, khac), 'MA_HT_TRUNG');
  err(b.call('saveLine', { ma: 'VKY02', maHT: 'QTN-16' }, ql), 'MA_HT_TRUNG');
  err(sua('<b>', khac), 'MA_HT_SAI');
  assert.equal(ok(sua('QTN-16')).may.maHT, 'QTN-16', 'lưu lại chính mã của mình không báo trùng');
  d = ok(b.call('data', {}, ql));
  const m2 = d.may.find((x) => x.ma === m.ma);
  assert.equal(m2.maHT, 'QTN-16'); assert.equal(m2.chuyen, 'VKY16');
  assert.equal(d.chuyen.find((c) => c.ma === 'VKY01').maHT, 'H2506');
  // Sửa máy mà không gửi maHT (app cũ) thì giữ nguyên
  assert.equal(ok(b.call('saveMachine', { ma: m.ma, ten: m.ten, nhom: m.nhom, chuKy: m.chuKy, hanKeTiep: m.hanKeTiep }, ql)).may.maHT, 'QTN-16');
  assert.equal(ok(sua('')).may.maHT, '', 'xoá mã hiển thị');
});

test('bản ghi sửa chữa: đánh dấu nguồn SC (cả bản ghi cũ 2.6.0); xoá: Quản lý xoá mọi bản ghi, người khác chỉ xoá bản mình ghi; việc thường không xoá kiểu này', () => {
  const b = setupSC();
  const a = ok(b.call('saveRepair', { moTa: 'Máy kêu to', ketQua: 'Siết bu lông' }, b.kt)).congViec;
  const q = ok(b.call('saveRepair', { moTa: 'Băng tải lệch', ketQua: 'Căn chỉnh', ma: 'M001' }, b.ql)).congViec;
  assert.equal(a.nguon, 'SC');
  err(b.call('deleteRepair', { id: q.id }, b.kt), 'KHONG_QUYEN');
  assert.equal(ok(b.call('deleteRepair', { id: a.id, lyDo: 'Ghi nhầm' }, b.kt)).congViec.trangThai, 'HUY');
  assert.equal(ok(b.call('deleteRepair', { id: q.id }, b.ql)).congViec.trangThai, 'HUY');
  const d = ok(b.call('data', {}, b.ql));
  const x = d.congViec.find((v) => v.id === a.id);
  assert.equal(x.trangThai, 'HUY'); assert.equal(x.nhatKy.at(-1).b, 'xoa');
  const viec = ok(b.call('saveTask', { tieuDe: 'Thay bóng đèn', loai: 'SUA' }, b.ql)).congViec;
  assert.notEqual(viec.nguon, 'SC');
  err(b.call('deleteRepair', { id: viec.id }, b.ql), 'KHONG_CO');
  // Bản ghi cũ (chưa có cột Nguon) vẫn được nhận là bản ghi sửa chữa
  const cu = Object.assign({}, x, { nguon: '', trangThai: 'DONG' });
  assert.equal(b.ctx.sachCV(cu).nguon, 'SC');
});

test('sao lưu: lịch tự động 2 giờ sáng, sao lưu tay, giữ 30 bản, chỉ quản trị; khôi phục đưa dữ liệu về và tự sao lưu bản hiện tại trước', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ad = b.login('NV001', '111111'), ql = b.login('NV002', '222222');
  ok(b.call('data', {}, ad));
  assert.ok(b.ctx.ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === 'saoLuuTuDong' && t.hour === 2), 'nâng cấp tự đặt lịch sao lưu');
  err(b.call('backupInfo', {}, ql), 'KHONG_QUYEN');
  let info = ok(b.call('backupInfo', {}, ad));
  assert.equal(info.bat, true); assert.equal(info.ds.length, 0);
  info = ok(b.call('backupNow', {}, ad));
  assert.equal(info.ds.length, 1); assert.match(info.ds[0].ten, /^Sao lưu CMMS 2026-10-14 10:00 · Sao lưu tay/);
  const banTay = info.ds[0];
  const book = b.ctx.SpreadsheetApp.openById(banTay.id);
  assert.ok(book.getSheetByName('May') && book.getSheetByName('CongViec'), 'bản sao có đủ các trang');
  assert.equal(book.getSheets().some((sh) => /^Trang tính|^Bản sao/.test(sh.getName())), false, 'không còn trang thừa');
  // Sửa dữ liệu sau khi sao lưu, rồi khôi phục
  const d = ok(b.call('data', {}, ad)), m = d.may[0];
  ok(b.call('saveMachine', { ma: m.ma, ten: 'Tên đã sửa sau sao lưu', nhom: m.nhom, chuKy: m.chuKy, hanKeTiep: m.hanKeTiep }, ad));
  err(b.call('backupRestore', { id: banTay.id }, ad), 'CAN_DONG_Y');
  err(b.call('backupRestore', { id: 'khong-co-file', dongY: true }, ad), 'KHONG_CO');
  const kq = ok(b.call('backupRestore', { id: banTay.id, dongY: true }, ad));
  assert.ok(kq.bang.indexOf('May') >= 0);
  assert.match(kq.banAnToan.ten, /Trước khi khôi phục/);
  assert.equal(ok(b.call('data', {}, ad)).may[0].ten, m.ten, 'tên máy về như lúc sao lưu');
  // Bản an toàn có tên đã sửa (để quay lại được)
  assert.equal(b.ctx.SpreadsheetApp.openById(kq.banAnToan.id).getSheetByName('May').getRange(2, 2).getValue(), 'Tên đã sửa sau sao lưu');
  // Chạy tự động 35 đêm: chỉ giữ 30 bản
  for (let i = 0; i < 35; i++) b.ctx.saoLuuTuDong();
  info = ok(b.call('backupInfo', {}, ad));
  assert.equal(info.ds.length, 30); assert.equal(info.cuoi.lyDo, 'Tự động');
  // Tắt sao lưu tự động thì đêm không sao lưu nữa
  ok(b.call('backupCfg', { bat: false }, ad));
  const truoc = info.cuoi.id; b.ctx.saoLuuTuDong();
  assert.equal(ok(b.call('backupInfo', {}, ad)).cuoi.id, truoc);
});

test('lưu trữ: chuyển lịch sử, việc đã đóng, nhật ký của một năm cũ sang file riêng; năm gần đây không chuyển được', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ad = b.login('NV001', '111111');
  ok(b.call('data', {}, ad));
  const sh = (t) => b.ctx.SpreadsheetApp.getActive().getSheetByName(t);
  // Thêm vài dòng cũ năm 2023 và 2024
  const ls = b.ctx.BANG.LichSu, cv = b.ctx.BANG.CongViec;
  const rowLS = (id, ngay) => ls.map((k) => ({ ID: id, Ma: 'M001', TenMay: 'Máy cũ', Ngay: ngay, TrangThai: 'OK', ThoiGian: ngay + ' 08:00:00' }[k] || ''));
  const rowCV = (id, tt, luc) => cv.map((k) => ({ ID: id, So: 900, TieuDe: 'Việc cũ', Loai: 'SUA', TrangThai: tt, LucTao: luc, LucXong: tt === 'DONG' ? luc : '' }[k] || ''));
  sh('LichSu').appendRow(rowLS('LSOLD1', '2024-03-05')); sh('LichSu').appendRow(rowLS('LSOLD2', '2023-11-20'));
  sh('CongViec').appendRow(rowCV('CVOLD1', 'DONG', '2024-05-01 09:00:00')); sh('CongViec').appendRow(rowCV('CVOLD2', 'DANG_LAM', '2024-05-02 09:00:00'));
  const info = ok(b.call('archiveInfo', {}, ad));
  assert.deepEqual(info.nam['2024'], { LichSu: 1, CongViec: 1 });
  assert.deepEqual(info.nam['2023'], { LichSu: 1 });
  assert.equal(info.nam['2025'], undefined, 'năm ngoái chưa được chuyển');
  err(b.call('archiveRun', { nam: 2025 }, ad), 'NAM_SAI');
  const kq = ok(b.call('archiveRun', { nam: 2024 }, ad));
  assert.deepEqual(kq.dem, { LichSu: 1, CongViec: 1 });
  assert.match(kq.banAnToan.ten, /Trước khi lưu trữ năm 2024/);
  const f = b.ctx.SpreadsheetApp.openById(kq.luuTru['2024'].id);
  assert.equal(f.getSheetByName('LichSu').getRange(2, 1).getValue(), 'LSOLD1');
  assert.equal(f.getSheetByName('CongViec').getRange(2, 1).getValue(), 'CVOLD1');
  const ids = (t) => b.ctx.docTho(t).map((r) => r[0]);
  assert.equal(ids('LichSu').includes('LSOLD1'), false); assert.equal(ids('LichSu').includes('LSOLD2'), true);
  assert.equal(ids('CongViec').includes('CVOLD1'), false); assert.equal(ids('CongViec').includes('CVOLD2'), true, 'việc đang làm không bị chuyển');
  // Xem lịch sử năm 2024: báo đã lưu trữ
  const h = ok(b.call('history', { nam: 2024 }, ad));
  assert.equal(h.lichSu.length, 0); assert.deepEqual(h.luuTru.dem, { LichSu: 1, CongViec: 1 });
  // Chuyển tiếp năm 2023 vào file riêng
  const k2 = ok(b.call('archiveRun', { nam: 2023 }, ad));
  assert.notEqual(k2.luuTru['2023'].id, k2.luuTru['2024'].id);
  assert.equal(ok(b.call('archiveInfo', {}, ad)).nam['2023'], undefined);
});

test('tài liệu máy: chỉ Quản lý và Quản trị xem được; tải tệp, ảnh đại diện, liên kết, chặn tệp nguy hiểm và tệp quá lớn, xoá', () => {
  const b = loadBackend({ seed: 'empty', now: '2026-10-14T03:00:00Z' });
  const ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333');
  ok(b.call('data', {}, ql));
  const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 sach huong dan may in phun').toString('base64');
  const jpg = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(400)).toString('base64');
  // Kỹ thuật không tải lên, không mở, không xoá tài liệu
  err(b.call('docUpload', { ma: 'M001', ten: 'x', nhom: 'HDSD', data: pdf }, kt), 'KHONG_QUYEN');
  let r = ok(b.call('docUpload', { ma: 'm001', ten: 'Sách hướng dẫn 喷印机', nhom: 'HDSD', data: pdf }, ql));
  assert.equal(r.ma, 'M001'); assert.equal(r.taiLieu.length, 1);
  const tep = r.moi;
  assert.deepEqual([tep.kieu, tep.nhom, tep.mime, tep.nguoiTao, tep.nguon, tep.hienHanh], ['TEP', 'HDSD', 'application/pdf', 'Quản lý', 'APP', true]);
  const g = ok(b.call('docGet', { id: tep.id }, ql));
  assert.equal(Buffer.from(g.data.split(',')[1], 'base64').toString(), '%PDF-1.4 sach huong dan may in phun');
  err(b.call('docGet', { id: tep.id }, kt), 'KHONG_QUYEN');
  // Ảnh: kèm ảnh nhỏ, đặt làm ảnh đại diện; ảnh thứ hai làm đại diện thì ảnh đầu bỏ cờ
  const a1 = ok(b.call('docUpload', { ma: 'M001', ten: 'Ảnh máy', data: jpg, anhNho: jpg, daiDien: true }, ql)).moi;
  assert.deepEqual([a1.kieu, a1.nhom, a1.daiDien, !!a1.anhNho], ['ANH', 'ANH', true, true]);
  ok(b.call('photo', { id: a1.anhNho }, kt));
  const a2 = ok(b.call('docUpload', { ma: 'M001', ten: 'Ảnh tủ điện', data: jpg, anhNho: jpg, daiDien: true }, ql)).moi;
  r = ok(b.call('data', {}, ql));
  assert.deepEqual(r.taiLieu.filter((x) => x.daiDien).map((x) => x.id), [a2.id]);
  r = ok(b.call('docCover', { id: a1.id }, ql));
  assert.deepEqual(r.taiLieu.filter((x) => x.daiDien).map((x) => x.id), [a1.id]);
  err(b.call('docCover', { id: tep.id }, ql), 'KHONG_PHAI_ANH');
  // Liên kết
  const lk = ok(b.call('docLink', { ma: 'VKY01', ten: 'Bản vẽ điện chuyền 01', nhom: 'BANVE', url: 'https://drive.google.com/file/d/abc/view' }, ql)).moi;
  assert.deepEqual([lk.kieu, lk.ma, lk.url], ['LINK', 'VKY01', 'https://drive.google.com/file/d/abc/view']);
  err(b.call('docLink', { ma: 'VKY01', ten: 'x', url: 'javascript:alert(1)' }, ql), 'LINK_SAI');
  err(b.call('docGet', { id: lk.id }, ql), 'KHONG_CO');
  // Mã tài liệu phải khác nhau kể cả khi tạo liên tiếp trong cùng một giây (trùng mã thì mở nhầm tài liệu)
  const ids = b.ctx.docTaiLieu().map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'mã tài liệu không được trùng');
  // Chặn tệp nguy hiểm, tệp quá lớn, máy không có
  err(b.call('docUpload', { ma: 'M001', ten: 'x', data: 'data:text/html;base64,PGI+eDwvYj4=' }, ql), 'TEP_KHONG_HO_TRO');
  err(b.call('docUpload', { ma: 'M001', ten: 'x', data: 'data:image/svg+xml;base64,PHN2Zy8+' }, ql), 'TEP_KHONG_HO_TRO');
  err(b.call('docUpload', { ma: 'M001', ten: 'x', data: 'data:application/pdf;base64,' + Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64') }, ql), 'TEP_QUA_LON');
  err(b.call('docUpload', { ma: 'M999', ten: 'x', data: pdf }, ql), 'KHONG_CO_MAY');
  // Kỹ thuật chỉ nhận ảnh đại diện của máy, không nhận cả danh mục
  assert.deepEqual(ok(b.call('data', {}, kt)).taiLieu.map((x) => x.id), [a1.id]);
  // Xoá: tệp do app tải lên thì vào thùng rác Drive
  const fid = b.ctx.docTaiLieu().filter((x) => x.id === tep.id)[0].fileId;
  err(b.call('docDelete', { id: tep.id }, kt), 'KHONG_QUYEN');
  ok(b.call('docDelete', { id: tep.id }, ql));
  assert.equal(b.ctx.DriveApp.getFileById(fid).isTrashed(), true);
  err(b.call('docGet', { id: tep.id }, ql), 'KHONG_CO');
  r = ok(b.call('data', {}, ql));
  assert.deepEqual(r.taiLieu.map((x) => x.id).sort(), [a1.id, a2.id, lk.id].sort());
});

test('tài liệu trên Drive: nối thư mục của tài khoản khác, quét vào danh mục, đoán nhóm và đoán máy, gán hàng loạt, bản hiện hành, quét lại', () => {
  const b = loadBackend({ seed: 'empty', now: '2026-10-14T03:00:00Z' });
  const ad = b.login('NV001', '111111'), ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333');
  ok(b.call('data', {}, ql));
  // Mã hiển thị tự đặt: tên tệp ghi QTN-16 thì app vẫn tìm ra máy M031
  ok(b.call('saveMachine', { ma: 'M031', ten: '空调01车间', chuKy: 30, hanKeTiep: '2026-10-05', maHT: 'QTN-16' }, ql));
  // Thư mục Drive của nhà máy: xếp theo loại tài liệu
  const D = b.ctx.DriveApp;
  const goc = D.createFolder('Tai lieu thiet bi');
  const fHd = goc.createFolder('Huong dan su dung'), fBv = goc.createFolder('Ban ve'), fKd = goc.createFolder('Kiem dinh');
  const sub = fBv.createFolder('Nam 2026');
  D.__addFileIn(fHd, 'M001 may in phun - huong dan.pdf', 'application/pdf', 120000);
  D.__addFileIn(fHd, '喷印机 M002 使用说明书.pdf', 'application/pdf', 130000);
  D.__addFileIn(fHd, 'Quat tan nhiet QTN-16 manual.pdf', 'application/pdf', 90000);
  const dwg = D.__addFileIn(sub, 'M039 tu dien xuong 1.dwg', 'application/acad', 24 * 1024 * 1024);
  D.__addFileIn(fKd, 'Kiem dinh thiet bi nang 2026.pdf', 'application/pdf', 60000);
  const roi = D.__addFileIn(goc, 'Hop dong mua may dong bao.pdf', 'application/pdf', 70000);
  // Chưa nối thư mục thì không quét được; link sai và thư mục không đọc được đều báo rõ
  err(b.call('docScan', {}, ql), 'TL_CHUA_NOI');
  err(b.call('docFolder', { link: 'khong-phai-link' }, ql), 'TL_LINK_SAI');
  err(b.call('docFolder', { link: 'https://drive.google.com/drive/folders/KHONGCOTHUMUCNAYDAUNHE123' }, ql), 'TL_KHONG_DOC_DUOC');
  err(b.call('docFolder', { link: 'https://drive.google.com/drive/folders/' + goc.getId() }, kt), 'KHONG_QUYEN');
  let r = ok(b.call('docFolder', { link: 'https://drive.google.com/drive/folders/' + goc.getId() }, ql));
  assert.equal(r.tlInfo.ten, 'Tai lieu thiet bi');
  assert.equal(r.tlInfo.doc, true);
  assert.deepEqual(r.tlInfo.con.map((c) => c.ten), ['Ban ve', 'Huong dan su dung', 'Kiem dinh']);
  // Gán nhóm cho thư mục cấp 1: mọi tệp bên trong (kể cả thư mục con) vào nhóm đó
  r = ok(b.call('docFolderMap', { map: [{ id: fBv.getId(), nhom: 'BANVE' }, { id: fHd.getId(), nhom: 'HDSD' }, { id: fKd.getId(), nhom: 'XXX' }] }, ql));
  assert.deepEqual(Object.keys(r.tlInfo.map).sort(), [fBv.getId(), fHd.getId()].sort());
  err(b.call('docScan', {}, kt), 'KHONG_QUYEN');
  r = ok(b.call('docScan', {}, ql));
  assert.deepEqual([r.quet.moi, r.quet.tep, r.quet.conNua], [6, 6, false]);
  const byTen = {};
  r.taiLieu.forEach((x) => { byTen[x.ten] = x; });
  assert.equal(Object.keys(byTen).length, 6);
  assert.equal(new Set(r.taiLieu.map((x) => x.id)).size, 6, 'mỗi tệp quét được một mã riêng');
  // Nhóm theo thư mục đã gán, máy theo mã trong tên tệp
  assert.deepEqual([byTen['M001 may in phun - huong dan'].ma, byTen['M001 may in phun - huong dan'].nhom], ['M001', 'HDSD']);
  assert.deepEqual([byTen['喷印机 M002 使用说明书'].ma, byTen['喷印机 M002 使用说明书'].nhom], ['M002', 'HDSD']);
  assert.equal(byTen['Quat tan nhiet QTN-16 manual'].ma, 'M031', 'tìm máy theo mã hiển thị tự đặt');
  // Thư mục con nhận nhóm của thư mục cha, đường dẫn ghi đủ hai cấp
  const cad = byTen['M039 tu dien xuong 1'];
  assert.deepEqual([cad.ma, cad.nhom, cad.duongDan, cad.nguon, cad.moDuoc], ['M039', 'BANVE', 'Ban ve / Nam 2026', 'DRIVE', false]);
  // Thư mục chưa gán nhóm thì đoán theo tên tệp; tệp ngoài mọi thư mục con thì chưa gán máy, vào nhóm Khác
  assert.equal(byTen['Kiem dinh thiet bi nang 2026'].nhom, 'KIEMDINH');
  assert.deepEqual([byTen['Hop dong mua may dong bao'].ma, byTen['Hop dong mua may dong bao'].nhom], ['', 'KHAC']);
  // Tệp lớn hoặc loại tệp app không xem được: trả link Drive, không đưa nội dung qua máy chủ
  const mo = ok(b.call('docGet', { id: cad.id }, ql));
  assert.equal(mo.data, undefined); assert.ok(/drive\.google\.com/.test(mo.link));
  // Gán hàng loạt: hợp đồng vào máy M011 và nhóm Khác, kiểm định thiết bị nâng vào M037
  const hd = byTen['Hop dong mua may dong bao'], knang = byTen['Kiem dinh thiet bi nang 2026'];
  err(b.call('docAssign', { ids: [], ma: 'M011' }, ql), 'THIEU_CHON');
  err(b.call('docAssign', { ids: [hd.id], ma: 'M999' }, ql), 'KHONG_CO_MAY');
  err(b.call('docAssign', { ids: [hd.id], nhom: 'XXX' }, ql), 'NHOM_SAI');
  err(b.call('docAssign', { ids: [hd.id], ma: 'M011' }, kt), 'KHONG_QUYEN');
  r = ok(b.call('docAssign', { ids: [hd.id, knang.id], ma: 'M011', nhom: 'KIEMDINH' }, ql));
  assert.equal(r.n, 2);
  assert.equal(r.tlInfo.dem.chuaGanMay, 0);
  let ds = {}; r.taiLieu.forEach((x) => { ds[x.id] = x; });
  assert.deepEqual([ds[hd.id].ma, ds[hd.id].nhom], ['M011', 'KIEMDINH']);
  // Bản hiện hành: cùng máy, cùng nhóm thì chỉ một bản là hiện hành
  assert.deepEqual([ds[hd.id].hienHanh, ds[knang.id].hienHanh], [true, true]);
  r = ok(b.call('docCurrent', { id: knang.id }, ql));
  ds = {}; r.taiLieu.forEach((x) => { ds[x.id] = x; });
  assert.deepEqual([ds[knang.id].hienHanh, ds[hd.id].hienHanh], [true, false]);
  // Kỹ thuật không nhận danh mục và không nhận thông tin thư mục
  const dkt = ok(b.call('data', {}, kt));
  assert.deepEqual(dkt.taiLieu, []); assert.equal(dkt.tlInfo, null);
  assert.ok(ok(b.call('data', {}, ad)).tlInfo.id);
  // Bỏ khỏi danh mục: tệp gốc trên Drive của nhà máy không bị xoá; quét lại không thêm lại tài liệu đã bỏ
  ok(b.call('docDelete', { id: hd.id }, ql));
  assert.equal(D.getFileById(roi.getId()).isTrashed(), false, 'tệp gốc trên Drive không bị xoá');
  r = ok(b.call('docScan', {}, ql));
  assert.equal(r.quet.moi, 0, 'tài liệu đã bỏ khỏi danh mục thì quét lại không thêm lại');
  assert.equal(r.taiLieu.filter((x) => x.id === hd.id).length, 0);
  // Tệp bị xoá trên Drive: đánh dấu không còn, giữ nguyên dòng đã gán
  dwg.setTrashed(true);
  r = ok(b.call('docScan', {}, ql));
  assert.equal(r.quet.moi, 0);
  ds = {}; r.taiLieu.forEach((x) => { ds[x.id] = x; });
  assert.deepEqual([ds[cad.id].conTrenDrive, ds[cad.id].ma], [false, 'M039']);
  assert.equal(r.tlInfo.dem.mat, 1);
});

test('giá điện: mặc định giá EVN 22 kV, sửa theo ngày áp dụng, VAT, sản lượng tháng; chỉ quản lý thấy và sửa', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333');
  let d = ok(b.call('data', {}, ql));
  assert.deepEqual(d.caiDat.giaDien, [{ tu: '2025-05-10', bt: 1833, cd: 3398, td: 1190 }]);
  assert.equal(d.caiDat.vatDien, 8);
  assert.equal(ok(b.call('data', {}, kt)).caiDat.giaDien, undefined, 'kỹ thuật không nhận giá điện');
  err(b.call('saveGiaDien', { giaDien: [{ tu: '2026-01-01', bt: 2000, cd: 3500, td: 1300 }], vatDien: 8 }, kt), 'KHONG_QUYEN');
  const r = ok(b.call('saveGiaDien', { giaDien: [{ tu: '2026-11-01', bt: '1 950', cd: 3600, td: 1250 }, { tu: '2025-05-10', bt: 1833, cd: 3398, td: 1190 }], vatDien: 10, dvSanLuong: 'miếng' }, ql));
  assert.deepEqual(r.caiDat.giaDien.map((x) => x.tu), ['2025-05-10', '2026-11-01']);
  assert.equal(r.caiDat.giaDien[1].bt, 1950); assert.equal(r.caiDat.vatDien, 10); assert.equal(r.caiDat.dvSanLuong, 'miếng');
  err(b.call('saveGiaDien', { giaDien: [{ tu: '2026-11-01', bt: 0, cd: 3600, td: 1250 }], vatDien: 8 }, ql), 'GIA_SAI');
  err(b.call('saveGiaDien', { giaDien: [{ tu: '2026-11-01', bt: 1, cd: 2, td: 3 }, { tu: '2026-11-01', bt: 1, cd: 2, td: 3 }], vatDien: 8 }, ql), 'GIA_TRUNG');
  assert.deepEqual(ok(b.call('saveSanLuong', { thang: '2026-09', sl: '12 500 000' }, ql)).caiDat.sanLuong, { '2026-09': 12500000 });
  assert.deepEqual(ok(b.call('saveSanLuong', { thang: '2026-09', sl: '' }, ql)).caiDat.sanLuong, {});
  err(b.call('saveSanLuong', { thang: '2026-13', sl: 5 }, ql), 'SO_SAI');
});

test('sửa chữa ghi theo chuyền: thiết bị là mã chuyền (máy chính) hoặc máy ngoài chuyền; mã lạ báo lỗi', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ql = b.login('NV002', '222222');
  ok(b.call('data', {}, ql));
  const r = ok(b.call('saveRepair', { moTa: 'Chuyền 01 dừng do kẹt vật liệu ở cụm cắt', ketQua: 'Gỡ kẹt, chỉnh dao cắt', ma: 'vky01', gioDung: 0.5 }, ql)).congViec;
  assert.deepEqual([r.ma, r.trangThai, r.nguon], ['VKY01', 'DONG', 'SC']);
  const v = ok(b.call('saveTask', { tieuDe: 'Kiểm tra cụm dán keo chuyền 16', loai: 'SUA', ma: 'VKY16' }, ql)).congViec;
  assert.equal(v.ma, 'VKY16');
  err(b.call('saveRepair', { moTa: 'x', ketQua: 'y', ma: 'VKY99' }, ql), 'KHONG_CO_MAY');
  // Máy ngoài chuyền vẫn chọn được
  assert.equal(ok(b.call('saveRepair', { moTa: 'Máy nén khí kêu to', ketQua: 'Siết bu lông', ma: 'M038' }, ql)).congViec.ma, 'M038');
});

test('phân quyền xem: Quản lý, Quản trị thấy hết; kỹ thuật chỉ việc của mình và mọi việc Sửa chữa / Bảo dưỡng, không xem kho, việc lặp', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ad = b.login('NV001', '111111'), ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333'), kt2 = b.login('NV004', '444444');
  const d0 = ok(b.call('data', {}, ql)), uid = (ma) => d0.nhanVien.find((n) => n.maNV === ma).id;
  const viec = (p) => ok(b.call('saveTask', p, ql)).congViec;
  const vs = viec({ tieuDe: 'Vệ sinh kho nguyên liệu', loai: 'VS', uidLam: uid('NV004') });
  const sua = viec({ tieuDe: 'Sửa băng tải chuyền 02', loai: 'SUA', ma: 'VKY02', uidLam: uid('NV004') });
  const bd = viec({ tieuDe: 'Bảo dưỡng máy nén khí', loai: 'BD', ma: 'M038' });
  const ct = viec({ tieuDe: 'Cải tiến máng hứng dầu', loai: 'CT', uidLam: uid('NV003') });
  const khac = viec({ tieuDe: 'Sắp xếp tủ dụng cụ', loai: 'KHAC' });
  const ids = (u) => new Set(ok(b.call('data', {}, u)).congViec.map((x) => x.id));
  [ad, ql].forEach((u) => { const s = ids(u); [vs, sua, bd, ct, khac].forEach((x) => assert.ok(s.has(x.id), 'quản lý / quản trị thấy ' + x.tieuDe)); });
  const s = ids(kt);
  assert.ok(s.has(sua.id) && s.has(bd.id), 'kỹ thuật thấy mọi việc Sửa chữa, Bảo dưỡng (kể cả giao người khác, chưa giao)');
  assert.ok(s.has(ct.id), 'thấy việc giao cho mình');
  assert.ok(!s.has(vs.id) && !s.has(khac.id), 'không thấy việc loại khác của người khác');
  // Việc mình tự ghi (loại khác) thì mình thấy, người khác không
  const lap = ok(b.call('saveTask', { tieuDe: 'Lắp quạt thông gió', loai: 'LAP' }, kt)).congViec;
  assert.ok(ids(kt).has(lap.id) && !ids(kt2).has(lap.id) && ids(ql).has(lap.id));
  // Thấy việc sửa chữa giao người khác nhưng không làm thay được
  err(b.call('updateTask', { id: sua.id, buoc: 'batdau' }, kt), 'KHONG_QUYEN');
  // Kho linh kiện, việc lặp lại: chỉ Quản lý, Quản trị
  const dk = ok(b.call('data', {}, kt)), dq = ok(b.call('data', {}, ql));
  assert.equal(dk.kho, null);
  assert.ok(dq.kho && typeof dq.kho === 'object');
  assert.deepEqual(dk.viecLap, []);
  err(b.call('catalog', {}, kt), 'KHONG_QUYEN');
  ok(b.call('catalog', {}, ql)); ok(b.call('catalog', {}, ad));
  // Điện / nước, máy, lịch sử bảo dưỡng: vẫn đủ để làm việc
  assert.ok(dk.congTo.length > 0 && dk.may.length === dq.may.length && dk.lichSu.length === dq.lichSu.length);
  // Lịch sử sửa chữa (bản ghi SC) của người khác: kỹ thuật vẫn xem được
  const sc = ok(b.call('saveRepair', { moTa: 'Máy nén khí kêu to', ketQua: 'Siết bu lông', ma: 'M038' }, ql)).congViec;
  assert.ok(ids(kt).has(sc.id));
});

test('tăng ca: mỗi người ghi của mình, Quản lý ghi hộ và xem hết; số giờ tự tính kể cả qua 0 giờ; xoá được; ca làm việc sửa được', () => {
  const b = loadBackend({ seed: 'demo', now: '2026-10-14T03:00:00Z' });
  const ql = b.login('NV002', '222222'), kt = b.login('NV003', '333333'), kt2 = b.login('NV004', '444444'), ad = b.login('NV001', '111111');
  const d0 = ok(b.call('data', {}, ql)), uid = (ma) => d0.nhanVien.find((n) => n.maNV === ma).id;
  const cua = (u) => ok(b.call('data', {}, u)).tangCa;
  const goc = { kt: cua(kt).length, kt2: cua(kt2).length, ql: cua(ql).length };   // bản xem thử có sẵn vài bản ghi mẫu
  // Ca làm việc mặc định gửi cho mọi người để điền sẵn giờ
  assert.deepEqual(ok(b.call('data', {}, kt)).caiDat.caTangCa.map((c) => c.k), ['HC', 'NGAY', 'DEM', 'CN']);
  assert.equal(ok(b.call('data', {}, kt)).caiDat.gioTCThang, 40);
  // Kỹ thuật ghi tăng ca của mình, số giờ tự tính
  const x = ok(b.call('saveOT', { ngay: '2026-10-14', ca: 'HC', tu: '17:30', den: '19:30', lyDo: 'Sửa máy in phun VKY01' }, kt)).tangCa;
  assert.deepEqual([x.uid, x.soGio, x.ca], [uid('NV003'), 2, 'HC']);
  assert.ok(x.lyDoDich, 'lý do được dịch sang tiếng Trung');
  // Qua 0 giờ: 22:00 → 02:00 là 4 tiếng
  assert.equal(ok(b.call('saveOT', { ngay: '2026-10-15', ca: 'DEM', tu: '22:00', den: '02:00' }, kt)).tangCa.soGio, 4);
  // Sửa tay số giờ thì giữ nguyên số đã sửa
  const y = ok(b.call('saveOT', { id: x.id, ngay: x.ngay, ca: 'HC', tu: '17:30', den: '19:30', soGio: 1.5 }, kt)).tangCa;
  assert.deepEqual([y.id, y.soGio], [x.id, 1.5]);
  // Giờ sai, ca lạ: báo lỗi
  err(b.call('saveOT', { ngay: '2026-10-14', ca: 'HC', tu: '25:00', den: '19:30' }, kt), 'GIO_SAI');
  err(b.call('saveOT', { ngay: '2026-10-14', ca: 'XX', tu: '17:30', den: '19:30' }, kt), 'CA_SAI');
  err(b.call('saveOT', { ngay: '2026-10-14', ca: 'HC', tu: '17:30', den: '19:30', soGio: 0 }, kt), 'GIO_TC_SAI');
  // Không ghi hộ người khác được
  err(b.call('saveOT', { uid: uid('NV004'), ngay: '2026-10-14', ca: 'HC', tu: '17:30', den: '19:30' }, kt), 'KHONG_QUYEN');
  // Quản lý ghi hộ được
  const z = ok(b.call('saveOT', { uid: uid('NV004'), ngay: '2026-10-14', ca: 'CN', tu: '08:00', den: '17:00' }, ql)).tangCa;
  assert.deepEqual([z.uid, z.soGio], [uid('NV004'), 9]);
  // Ai thấy gì: kỹ thuật chỉ thấy của mình, Quản lý và Quản trị thấy hết
  assert.ok(cua(kt).every((r) => r.uid === uid('NV003')), 'kỹ thuật chỉ nhận bản ghi của mình');
  assert.equal(cua(kt).length, goc.kt + 2);
  assert.ok(cua(kt2).every((r) => r.uid === uid('NV004')));
  assert.equal(cua(kt2).length, goc.kt2 + 1);
  assert.equal(cua(ql).length, goc.ql + 3);
  assert.equal(cua(ad).length, goc.ql + 3);
  assert.ok(cua(ql).length > cua(kt).length, 'Quản lý thấy nhiều hơn kỹ thuật');
  // Xoá: của mình được, của người khác thì không; Quản lý xoá được mọi bản ghi
  err(b.call('deleteOT', { id: z.id }, kt), 'KHONG_QUYEN');
  assert.equal(ok(b.call('deleteOT', { id: x.id }, kt)).xoaTC, x.id);
  assert.equal(cua(kt).length, goc.kt + 1);
  assert.equal(ok(b.call('deleteOT', { id: z.id }, ql)).xoaTC, z.id);
  // Thông tin in trên đơn: mỗi người tự sửa của mình
  const me = ok(b.call('saveProfile', { maThe: 'V25066', boPhan: 'Kỹ thuật sản xuất', chucVu: 'Kỹ sư' }, kt)).me;
  assert.deepEqual([me.maThe, me.chucVu], ['V25066', 'Kỹ sư']);
  assert.ok(me.boPhanZh, 'bộ phận tự dịch sang tiếng Trung');
  assert.equal(ok(b.call('data', {}, kt)).me.maThe, 'V25066');
  // Kỹ thuật không thấy mã thẻ của người khác, Quản lý thì thấy
  assert.equal(ok(b.call('data', {}, kt2)).nhanVien.find((n) => n.maNV === 'NV003').maThe, undefined);
  assert.equal(ok(b.call('data', {}, ql)).nhanVien.find((n) => n.maNV === 'NV003').maThe, 'V25066');
  // Ca làm việc: chỉ Quản lý sửa
  err(b.call('saveOTCfg', { ca: [{ k: 'HC', ten: 'Hành chính', zh: '行政班', tu: '17:00', den: '19:00' }] }, kt), 'KHONG_QUYEN');
  const cd = ok(b.call('saveOTCfg', { ca: [{ k: 'HC', ten: 'Hành chính', zh: '行政班', tu: '17:00', den: '19:00' },
    { k: 'DEM', ten: 'Ca đêm', zh: '夜班', tu: '06:00', den: '08:00' }], gioTCThang: 36, gioTCNam: 180 }, ql)).caiDat;
  assert.deepEqual([cd.caTangCa.length, cd.caTangCa[0].tu, cd.gioTCThang, cd.gioTCNam], [2, '17:00', 36, 180]);
  err(b.call('saveOTCfg', { ca: [{ k: 'HC', ten: 'Hành chính', tu: '99:00', den: '19:00' }] }, ql), 'GIO_SAI');
  // Ca đã bỏ thì không ghi tăng ca theo ca đó nữa
  err(b.call('saveOT', { ngay: '2026-10-16', ca: 'CN', tu: '08:00', den: '17:00' }, kt), 'CA_SAI');
});

test('lịch trực tuần: Quản lý xếp người và nội dung, tự dịch; sửa tay bản dịch thì không dịch đè; kỹ thuật chỉ xem', () => {
  const b = setup();
  const nv = ok(b.call('data', {}, b.ql)).nhanVien;
  const kt3 = nv.find((x) => x.vaiTro === 'kythuat');

  // Chỉ Quản lý, Quản trị mới xếp được
  err(b.call('dutySet', { ngay: '2026-10-21', uid: kt3.id, noiDung: 'Trực điện xưởng 1' }, b.kt), 'KHONG_QUYEN');
  const x = ok(b.call('dutySet', { ngay: '2026-10-21', uid: kt3.id, noiDung: 'Trực điện xưởng 1' }, b.ql)).lichTruc;
  assert.equal(x.uid, kt3.id);
  assert.equal(x.ten, kt3.ten);
  assert.equal(x.noiDung, 'Trực điện xưởng 1');
  assert.ok(x.noiDungDich, 'phải có bản dịch tiếng Trung');

  // Ngày sai, người không có
  err(b.call('dutySet', { ngay: '2026-13-45', uid: kt3.id }, b.ql), 'NGAY_SAI');
  err(b.call('dutySet', { ngay: '2026-10-22', uid: 'U999' }, b.ql), 'KHONG_CO_NV');

  // Chỉ gửi nội dung: giữ người đang xếp
  const y = ok(b.call('dutySet', { ngay: '2026-10-21', noiDung: 'Ghi số điện kỳ 20/10' }, b.ql)).lichTruc;
  assert.equal(y.uid, kt3.id);
  assert.equal(y.noiDung, 'Ghi số điện kỳ 20/10');

  // Sửa tay bản dịch tiếng Trung thì giữ nguyên, lần sau không dịch đè
  const z = ok(b.call('dutySet', { ngay: '2026-10-21', noiDung: 'Ghi số điện kỳ 20/10', noiDungDich: '抄录10月20日电表' }, b.ql)).lichTruc;
  assert.equal(z.noiDungDich, '抄录10月20日电表');
  const z2 = ok(b.call('dutySet', { ngay: '2026-10-21', uid: kt3.id }, b.ql)).lichTruc;
  assert.equal(z2.noiDungDich, '抄录10月20日电表');

  // Mỗi ngày một dòng, không sinh thêm dòng mới
  assert.equal(b.ctx.docTho('LichTruc').filter((r) => r[0] === '2026-10-21').length, 1);

  // Kỹ thuật xem được lịch (để biết ai trực)
  const dsKT = ok(b.call('data', {}, b.kt)).lichTruc;
  assert.equal(dsKT.length, 1);
  assert.equal(dsKT[0].uid, kt3.id);

  // Bỏ trống ngày
  const bo = ok(b.call('dutySet', { ngay: '2026-10-21', uid: '', noiDung: '' }, b.ql)).lichTruc;
  assert.equal(bo.uid, '');
  assert.equal(bo.noiDung, '');
});

test('phân công ca trực: danh sách riêng, xếp tay từng ô, luân phiên tiếp nối tuần trước; người nghỉ không được xếp nữa', () => {
  const b = setup();
  const nt = ok(b.call('data', {}, b.ql)).nguoiTruc;
  const sx = nt.filter((x) => x.nhom === 'SX'), kho = nt.filter((x) => x.nhom === 'KHO');
  assert.equal(sx.length, 7);
  assert.equal(kho.length, 2);
  assert.equal(sx[0].ten, 'Nguyễn Hữu Ninh');
  assert.equal(sx[0].tenZh, '阮友宁');
  assert.equal(sx[0].dienThoai, '0389978042');   // giữ số 0 đầu

  // Tuần phải là thứ Hai
  err(b.call('shiftRotate', { tuNgay: '2026-10-21' }, b.ql), 'TUAN_SAI');
  err(b.call('shiftRotate', { tuNgay: '2026-10-19' }, b.kt), 'KHONG_QUYEN');

  // Tuần đầu: hai người đầu danh sách, ca ngày và ca đêm
  const t1 = ok(b.call('shiftRotate', { tuNgay: '2026-10-19' }, b.ql)).phanCa;
  const o = (ds, nhom, ca) => ds.find((x) => x.nhom === nhom && x.ca === ca);
  assert.equal(t1.length, 4);
  assert.equal(o(t1, 'SX', 'NGAY').ten, sx[0].ten);
  assert.equal(o(t1, 'SX', 'DEM').ten, sx[1].ten);
  assert.equal(o(t1, 'SX', 'NGAY').dienThoai, sx[0].dienThoai);
  assert.equal(o(t1, 'KHO', 'NGAY').ten, kho[0].ten);
  assert.equal(o(t1, 'KHO', 'DEM').ten, kho[1].ten);

  // Tuần sau: mỗi ca dịch xuống một người; nhóm 2 người thì đổi chỗ ca ngày ↔ ca đêm
  const t2 = ok(b.call('shiftRotate', { tuNgay: '2026-10-26' }, b.ql)).phanCa;
  assert.equal(o(t2, 'SX', 'NGAY').ten, sx[1].ten);
  assert.equal(o(t2, 'SX', 'DEM').ten, sx[2].ten);
  assert.equal(o(t2, 'KHO', 'NGAY').ten, kho[1].ten);
  assert.equal(o(t2, 'KHO', 'DEM').ten, kho[0].ten);

  // Xếp tay một ô, không đụng ô khác
  const tay = ok(b.call('shiftSet', { tuNgay: '2026-10-26', nhom: 'SX', ca: 'NGAY', id: sx[5].id }, b.ql)).phanCa[0];
  assert.equal(tay.ten, sx[5].ten);
  err(b.call('shiftSet', { tuNgay: '2026-10-26', nhom: 'KHO', ca: 'NGAY', id: sx[0].id }, b.ql), 'KHAC_NHOM');
  err(b.call('shiftSet', { tuNgay: '2026-10-26', nhom: 'SX', ca: 'TRUA', id: sx[0].id }, b.ql), 'CA_SAI');
  const pc = ok(b.call('data', {}, b.kt)).phanCa;
  assert.equal(pc.filter((x) => x.tuNgay === '2026-10-26').length, 4);
  assert.equal(pc.find((x) => x.tuNgay === '2026-10-26' && x.nhom === 'SX' && x.ca === 'DEM').ten, sx[2].ten);

  // Luân phiên tiếp nối ô vừa xếp tay
  const t3 = ok(b.call('shiftRotate', { tuNgay: '2026-11-02' }, b.ql)).phanCa;
  assert.equal(o(t3, 'SX', 'NGAY').ten, sx[6].ten);
  assert.equal(o(t3, 'SX', 'DEM').ten, sx[3].ten);

  // Bỏ trống một ô
  const trong = ok(b.call('shiftSet', { tuNgay: '2026-11-02', nhom: 'SX', ca: 'NGAY', id: '' }, b.ql)).phanCa[0];
  assert.equal(trong.ten, '');
  assert.equal(trong.nguoiId, '');
});

test('danh sách người trực ca: sửa tên, thêm người, bỏ khỏi danh sách là đánh dấu đã nghỉ và không xếp luân phiên nữa', () => {
  const b = setup();
  const nt0 = ok(b.call('data', {}, b.ql)).nguoiTruc;
  const kho = nt0.filter((x) => x.nhom === 'KHO');

  err(b.call('shiftPeople', { ds: nt0 }, b.kt), 'KHONG_QUYEN');
  err(b.call('shiftPeople', { ds: [] }, b.ql), 'CAN_NGUOI');

  // Bỏ một người kho khỏi danh sách (đã nghỉ) + thêm người mới + sửa số điện thoại
  const con = nt0.filter((x) => x.id !== kho[1].id).map((x) => Object.assign({}, x));
  con.find((x) => x.id === kho[0].id).dienThoai = '0912 345 678';
  con.push({ ten: 'Trần Thị Mới', tenZh: '陈氏新', dienThoai: '0988777666', nhom: 'KHO' });
  const sau = ok(b.call('shiftPeople', { ds: con }, b.ql)).nguoiTruc;
  const nghi = sau.find((x) => x.id === kho[1].id);
  assert.equal(nghi.hoatDong, false, 'người bị bỏ khỏi danh sách = đã nghỉ, vẫn còn dòng');
  assert.equal(sau.find((x) => x.id === kho[0].id).dienThoai, '0912 345 678');
  const moi = sau.find((x) => x.ten === 'Trần Thị Mới');
  assert.ok(moi && moi.id && moi.hoatDong);
  assert.equal(moi.tenZh, '陈氏新');

  // Luân phiên chỉ lấy người còn làm
  const t1 = ok(b.call('shiftRotate', { tuNgay: '2026-10-19' }, b.ql)).phanCa;
  const tenKho = t1.filter((x) => x.nhom === 'KHO').map((x) => x.ten);
  assert.ok(!tenKho.includes(kho[1].ten), 'người đã nghỉ không được xếp nữa');
  assert.deepEqual(tenKho.sort(), [kho[0].ten, 'Trần Thị Mới'].sort());
});

test('kho: mỗi lần nhập file đều ghi nhớ tồn của từng mã, có mốc thời gian và nhật ký nhập', () => {
  const b = setup();
  const nhap = (ds, file) => ok(b.call('importKho', { file, soDong: ds.length, ds }, b.ql));

  b.setNow('2026-09-05T09:00:00Z');
  nhap([{ ma: 'A1', ten: 'Vòng bi 6009', ton: 8 }, { ma: 'A2', ten: 'Dây curoa', ton: 4 }, { ma: 'A3', ten: 'Chốt', ton: 50 }], 'erp0905.xlsx');
  b.setNow('2026-09-15T09:00:00Z');
  nhap([{ ma: 'A1', ten: 'Vòng bi 6009', ton: 3 }, { ma: 'A2', ten: 'Dây curoa', ton: 1 }, { ma: 'A3', ten: 'Chốt', ton: 50 }], 'erp0915.xlsx');
  b.setNow('2026-09-26T09:00:00Z');
  const r = nhap([{ ma: 'A1', ten: 'Vòng bi 6009', ton: 0 }, { ma: 'A3', ten: 'Chốt', ton: 50 }], 'erp0926.xlsx');

  const by = {};
  r.ds.forEach((x) => { by[x.ma] = x; });
  assert.deepEqual(by.A1.tonCu, [8, 3, 0], 'nhớ tồn qua từng lần nhập');
  assert.deepEqual(by.A2.tonCu, [4, 1, 0], 'mã biến mất khỏi file được ghi là tồn 0');
  assert.deepEqual(by.A3.tonCu, [50, 50, 50]);

  // Mốc thời gian của ba lần nhập, khớp thứ tự với dãy tồn
  const k = ok(b.call('catalog', {}, b.ql));
  assert.equal(k.moc.length, 3);
  assert.deepEqual(k.moc.map((m) => m.luc.slice(0, 10)), ['2026-09-05', '2026-09-15', '2026-09-26']);
  assert.equal(k.moc[2].file, 'erp0926.xlsx');

  // Nhật ký nhập file: mỗi lần một dòng, mới nhất lên đầu
  assert.equal(k.nhatKy.length, 3);
  assert.equal(k.nhatKy[0].file, 'erp0926.xlsx');
  assert.equal(k.nhatKy[0].nguoi, 'Quản lý');
  assert.equal(k.nhatKy[0].soMa, 2);
  assert.equal(k.nhatKy[2].file, 'erp0905.xlsx');
  assert.equal(b.ctx.docTho('NhapKho').filter((x) => x[0]).length, 3);
});

test('kho: ngưỡng gần hết hàng mặc định là 1, Quản lý sửa được, kỹ thuật thì không', () => {
  const b = setup();
  assert.equal(ok(b.call('data', {}, b.ql)).caiDat.khoGanHet, 1, 'mặc định 1');
  assert.equal(ok(b.call('data', {}, b.kt)).caiDat.khoGanHet, 1, 'kỹ thuật cũng nhận ngưỡng để tự tính');

  err(b.call('saveKhoCfg', { ganHet: 2 }, b.kt), 'KHONG_QUYEN');
  err(b.call('saveKhoCfg', { ganHet: -1 }, b.ql), 'SO_SAI');
  err(b.call('saveKhoCfg', { ganHet: '' }, b.ql), 'SO_SAI');
  assert.equal(ok(b.call('saveKhoCfg', { ganHet: 3 }, b.ql)).caiDat.khoGanHet, 3);
  assert.equal(ok(b.call('data', {}, b.ql)).caiDat.khoGanHet, 3);
});

test('lưu ca làm việc không xoá mất các cài đặt khác (giá điện, sản lượng, ngưỡng kho)', () => {
  const b = setup();
  ok(b.call('saveGiaDien', { giaDien: [{ tu: '2026-01-01', bt: 2000, cd: 3500, td: 1200 }], vatDien: 10 }, b.ql));
  ok(b.call('saveSanLuong', { thang: '2026-09', sl: 123456 }, b.ql));
  ok(b.call('saveKhoCfg', { ganHet: 2 }, b.ql));

  ok(b.call('saveOTCfg', { ca: [{ k: 'HC', ten: 'Hành chính', zh: '行政班', tu: '17:30', den: '19:30' }], gioTCThang: 40, gioTCNam: 200 }, b.ql));

  const cd = ok(b.call('data', {}, b.ql)).caiDat;
  assert.equal(cd.giaDien[0].bt, 2000, 'giá điện còn nguyên');
  assert.equal(cd.vatDien, 10);
  assert.equal(cd.sanLuong['2026-09'], 123456, 'sản lượng còn nguyên');
  assert.equal(cd.khoGanHet, 2, 'ngưỡng kho còn nguyên');
  assert.equal(cd.caTangCa.length, 1, 'ca làm việc đã lưu');
});

test('tồn kho an toàn: nhập hàng loạt từ file, mã chưa có thì thêm vào kho coi như hết hàng', () => {
  const b = setup();
  ok(b.call('importKho', { file: 'erp.xlsx', soDong: 3, ds: [
    { ma: 'A1', ten: 'Vòng bi 6009', ton: 8 }, { ma: 'A2', ten: 'Dây curoa', ton: 4 }, { ma: 'A3', ten: 'Chốt', ton: 50 }] }, b.ql));

  err(b.call('importMin', { ds: [{ ma: 'A1', tonMin: 5 }] }, b.kt), 'KHONG_QUYEN');
  err(b.call('importMin', { ds: [] }, b.ql), 'KHO_TRONG');

  // Mã B9 không có trong file ERP (ERP chỉ xuất dòng còn tồn) → thêm vào kho với tồn 0
  const r = ok(b.call('importMin', { file: 'duphong.xlsm', ds: [
    { ma: 'A1', tonMin: 10 }, { ma: 'A2', tonMin: '' }, { ma: 'A3', tonMin: 20 },
    { ma: 'B9', tonMin: 3, ten: 'Súng bắn keo' }, { ma: 'B8', tonMin: '', ten: 'Không đặt, không thêm' }] }, b.ql));
  assert.equal(r.tk.dat, 2, 'A1 và A3 đã có trong kho');
  assert.equal(r.tk.them, 1, 'chỉ thêm mã có đặt tồn an toàn');
  assert.equal(r.tk.khongThay, 2);
  assert.deepEqual(r.thieu.sort(), ['B8', 'B9']);

  const by = {};
  r.ds.forEach((x) => { by[x.ma] = x; });
  assert.equal(by.A1.tonMin, 10);
  assert.equal(by.A1.ton, 8, 'không đụng tới tồn thật');
  assert.equal(by.A2.tonMin, undefined, 'để trống là chưa đặt tồn an toàn');
  assert.equal(by.B9.ton, 0, 'mã mới coi như hết hàng');
  assert.equal(by.B9.tonMin, 3);
  assert.equal(by.B9.ten, 'Súng bắn keo');
  assert.equal(by.B9.cf, undefined, 'đánh dấu ngoài file ERP');
  assert.equal(by.B8, undefined, 'mã không đặt tồn an toàn thì không thêm');

  // Không tự thêm khi app gửi themMoi = false
  const r2 = ok(b.call('importMin', { file: 'x.xlsx', themMoi: false, ds: [{ ma: 'C1', tonMin: 4, ten: 'Mã lạ' }] }, b.ql));
  assert.equal(r2.tk.them, 0);
  assert.equal(r2.ds.some((x) => x.ma === 'C1'), false);

  // Lần nhập ERP sau có hàng thì tồn tự cập nhật, tồn an toàn giữ nguyên
  const r3 = ok(b.call('importKho', { file: 'erp2.xlsx', soDong: 2, ds: [
    { ma: 'A1', ten: 'Vòng bi 6009', ton: 12 }, { ma: 'B9', ten: 'Súng bắn keo', ton: 5 }] }, b.ql));
  const sau = {};
  r3.ds.forEach((x) => { sau[x.ma] = x; });
  assert.equal(sau.B9.ton, 5);
  assert.equal(sau.B9.tonMin, 3, 'tồn an toàn không bị file ERP ghi đè');
  assert.equal(sau.A3.ton, 0, 'mã biến mất khỏi file ERP thì về 0');
  assert.equal(sau.A3.tonMin, 20);
});

test('mức báo thiếu theo phần trăm tồn kho an toàn: mặc định 15%, Quản lý sửa được', () => {
  const b = setup();
  const cd = ok(b.call('data', {}, b.ql)).caiDat;
  assert.equal(cd.khoPhanTram, 15, 'mặc định báo khi tồn dưới 15% mức an toàn');
  assert.equal(ok(b.call('data', {}, b.kt)).caiDat.khoPhanTram, 15, 'kỹ thuật cũng nhận ngưỡng để tô màu ô tồn');

  err(b.call('saveKhoCfg', { phanTram: 20 }, b.kt), 'KHONG_QUYEN');
  err(b.call('saveKhoCfg', { phanTram: 0 }, b.ql), 'SO_SAI');
  err(b.call('saveKhoCfg', { phanTram: 101 }, b.ql), 'SO_SAI');
  err(b.call('saveKhoCfg', {}, b.ql), 'SO_SAI');

  assert.equal(ok(b.call('saveKhoCfg', { phanTram: 30 }, b.ql)).caiDat.khoPhanTram, 30);
  // Sửa riêng từng ngưỡng, không xoá ngưỡng kia
  assert.equal(ok(b.call('saveKhoCfg', { ganHet: 2 }, b.ql)).caiDat.khoPhanTram, 30);
  const sau = ok(b.call('data', {}, b.ql)).caiDat;
  assert.equal(sau.khoGanHet, 2);
  assert.equal(sau.khoPhanTram, 30);
});
