/**
 * CREDIBLE CMMS — CÔNG VIỆC · BẢO DƯỠNG · ĐIỆN NƯỚC · KHO LINH KIỆN · 设备管理 — máy chủ (Google Apps Script)
 * Dữ liệu lưu trong chính Google Sheet chứa script này (mỗi bảng một trang).
 *
 * Cài đặt lần đầu:
 *   1. Mở Google Sheet mới → Tiện ích mở rộng → Apps Script → dán toàn bộ file này → Lưu.
 *   2. Chọn hàm caiDatBanDau → Chạy → cấp quyền (Nâng cao → Đi tới … → Cho phép).
 *   3. Triển khai → Tùy chọn triển khai mới → Ứng dụng web; Thực thi với: Tôi; Truy cập: Bất kỳ ai.
 *   4. Chép link ứng dụng web (…/exec) dán vào app.
 * Tài khoản mẫu (mã nhân viên / PIN): NV001 / 111111 Quản trị · NV002 / 222222 Quản lý · NV003 / 333333 Kỹ thuật
 * (đổi PIN ngay sau khi cài).
 *
 * Nâng cấp từ bản cũ: dán đè file này → Lưu → Triển khai → Quản lý triển khai → bút chì → Phiên bản mới → Triển khai.
 * Các trang tự thêm cột mới; tiêu thụ điện của các kỳ cũ được tính và lưu một lần khi app tải dữ liệu.
 * Người dùng cũ chưa có mã nhân viên thì dùng mã ID (U001, U002…) hoặc chỉ nhập PIN như trước.
 *
 * Số điện từ file Excel (DL_EXCEL ở cuối file) tự nhập một lần khi app tải dữ liệu lần đầu.
 * Muốn nhập lại tay: chọn hàm nhapLaiSoDienExcel → Chạy (số đã có không bị ghi đè, không tạo trùng).
 */
var PHIEN_BAN = '2.5.1';
var TZ = 'Asia/Ho_Chi_Minh';
var HAN_PHIEN_NGAY = 30;           // đăng nhập giữ 30 ngày
var LUI_TOI_DA = 366;              // xác nhận lùi ngày tối đa

// Cột mới luôn thêm vào CUỐI mỗi trang để sheet cũ vẫn đọc đúng (capNhatTieuDe tự ghi lại dòng tiêu đề).
var BANG = {
  // Chuyen: mã chuyền sản xuất máy này thuộc về (vd VKY01), để trống nếu không thuộc chuyền nào
  May: ['Ma', 'Ten', 'TenPhu', 'Nhom', 'ViTri', 'ChuKy', 'HanKeTiep', 'NoiDung', 'HoatDong', 'CapNhat', 'HangMuc', 'LinhKien',
    'PhuTrach', 'NgayDuaVao', 'Chuyen'],
  // Chuyền sản xuất (theo Sổ cái quản lý cơ sở vật chất VKY-PR-E01-03). Sửa trực tiếp trên sheet hoặc trong app (Quản lý)
  Chuyen: ['Ma', 'Ten', 'TenZh', 'MaTaiSan', 'QuyCach', 'NhaSX', 'TinhNang', 'TocDoChuan', 'TocDoThucTe', 'ViTri', 'SoXuatXuong',
    'NgaySX', 'NgayCaiTao', 'NgayVN', 'GhiChu', 'HoatDong', 'CapNhat'],
  LichSu: ['ID', 'Ma', 'TenMay', 'Ngay', 'DenHan', 'NguoiLam', 'GhiChu', 'NguoiXacNhan', 'ThoiGian', 'TrangThai', 'OpId', 'UID', 'Huy', 'ChiTiet'],
  NguoiDung: ['ID', 'Ten', 'VaiTro', 'PinHash', 'Email', 'HoatDong', 'NgayTao', 'MaNV', 'TenZh'],
  // Loai: cao (cao áp, nhiều mã OBIS) · ha (tủ tổng hạ áp) · nhanh (công tơ nhánh) · nuoc (đồng hồ nước, m³)
  // Cha: mã công tơ cấp trên (công tơ nhánh nằm sau công tơ nhánh khác thì không cộng lần nữa vào tổng nhánh)
  // NguongTang / NguongGiam: % lệch so với bình quân ngày 3 kỳ trước thì coi là bất thường (trống = theo cài đặt chung)
  // SoChuSo: số chữ số trên mặt công tơ (để tính khi quay vòng về 0) · BatBuocAnh: 1 = bắt buộc chụp ảnh khi ghi
  CongTo: ['Ma', 'Ten', 'SoCongTo', 'ViTri', 'HeSo', 'ThongSo', 'HoatDong', 'GhiChu', 'CapNhat', 'Loai',
    'Cha', 'Nhom', 'NguongTang', 'NguongGiam', 'SoChuSo', 'BatBuocAnh'],
  // Mỗi công tơ, mỗi kỳ lưu CẢ chỉ số lúc ghi (GiaTri) VÀ lượng tiêu thụ riêng của kỳ (TieuThu, TieuThuKy).
  // TieuThu (JSON theo mã): {tt: tiêu thụ đã nhân hệ số, raw: chênh lệch chỉ số, cs0: chỉ số kỳ trước, ky0: kỳ trước,
  //   ngay: số ngày, gop: số kỳ bị thiếu ở giữa, heSo, cach: THUONG | QUAY_VONG | THAY_CT | MOC (mốc mới, không tính)}
  // KyTruoc / CSTruoc / TieuThuKy: bản sao của mã chính (1.8.0) để đọc trực tiếp trên sheet.
  // TrangThai: OK · HUY (đã xoá) · CHO_DUYET (ngoại lệ chờ Quản lý duyệt, chưa cộng vào tổng)
  // NgoaiLe (JSON): {loai: GIAM_THAY_CT | GIAM_QUAY_VONG | GIAM_KHAC | CAO | THAP, lyDo, pct, csCuCuoi, csMoiDau, duyet}
  ChiSo: ['ID', 'Ky', 'MaCT', 'GiaTri', 'NguoiGhi', 'ThoiGian', 'GhiChu', 'UID', 'TrangThai', 'OpId', 'SuaLuc',
    'KyTruoc', 'CSTruoc', 'TieuThuKy', 'TieuThu', 'LucGhi', 'Anh', 'NgoaiLe', 'NguoiSua', 'Nguon'],
  KhoLK: ['Ma', 'Ten', 'QuyCach', 'Dv', 'Nhom', 'Ton', 'ViTri', 'Nguon', 'ConFile', 'CapNhat', 'GhiChu', 'GopVao', 'An', 'TonMin'],
  // Nhật ký sửa đổi (audit): giá trị trước / sau, người sửa, thời gian, lý do
  NhatKy: ['ID', 'ThoiGian', 'UID', 'Nguoi', 'HanhDong', 'Bang', 'Khoa', 'Truoc', 'Sau', 'LyDo'],
  // Công việc giao cho nhân viên (chỉ người có tài khoản trong app). ID do máy tạo việc sinh ra (ghi được khi chưa có mạng).
  // TrangThai: CHO_GIAO · DA_GIAO · DANG_LAM · TAM_HOAN · XONG (chờ Quản lý kiểm tra) · DONG · HUY
  // Loai: SUA (sửa chữa: thêm NguyenNhan, PhutDung = số phút dừng máy) · VS (vệ sinh) · LAP (lắp đặt / di dời) · CT (cải tiến) · HT (hỗ trợ sản xuất) · BD (bảo dưỡng) · KHAC
  // UuTien: GAP · CAO · TB · UIDPhu (JSON): người làm cùng · LapLai: mã việc lặp lại đã sinh ra việc này
  // …Dich: bản dịch tự động Việt ↔ Trung của tên việc, mô tả, kết quả, nguyên nhân (sửa tay được)
  CongViec: ['ID', 'So', 'TieuDe', 'MoTa', 'Loai', 'UuTien', 'Ma', 'Han', 'TrangThai', 'UIDLam', 'NguoiLam', 'UIDPhu',
    'NguoiGiao', 'UIDGiao', 'LucGiao', 'NguoiTao', 'UIDTao', 'LucTao', 'LucBatDau', 'LucXong', 'KetQua', 'LinhKien',
    'AnhTao', 'AnhXong', 'CanKiemTra', 'NguoiKiemTra', 'LucKiemTra', 'LapLai', 'OpId', 'CapNhat', 'NhatKy', 'NguyenNhan', 'PhutDung',
    'TieuDeDich', 'MoTaDich', 'KetQuaDich', 'NguyenNhanDich'],
  // Việc lặp lại: mỗi ngày (khi app tải dữ liệu và lúc nhắc hằng ngày) tự sinh việc vào CongViec
  // Kieu: ngay (hằng ngày) · tuan (Ngay = các thứ 0–6, 0 = Chủ nhật) · thang (Ngay = các ngày trong tháng) · TaoDen: đã sinh việc đến ngày
  ViecLap: ['ID', 'TieuDe', 'MoTa', 'Loai', 'UuTien', 'Ma', 'Kieu', 'Ngay', 'UIDLam', 'CanKiemTra', 'HoatDong', 'TaoDen', 'NguoiTao', 'CapNhat',
    'TieuDeDich', 'MoTaDich']
};
var COT_SO = { May: ['ChuKy', 'HoatDong'], LichSu: [], NguoiDung: ['HoatDong'], CongTo: ['HeSo', 'HoatDong'], ChiSo: [], KhoLK: [], NhatKy: [],
  CongViec: ['So', 'CanKiemTra', 'PhutDung'], ViecLap: ['CanKiemTra', 'HoatDong'] };
// Cột số có định dạng riêng (giữ phần thập phân khi xem trên sheet)
var COT_DD = { ChiSo: { CSTruoc: '#,##0.###', TieuThuKy: '#,##0.###' } };

// Thông số công tơ (mã OBIS). Quản trị sửa được trong app (lưu ở Script Properties THONG_SO).
// tich = true: chỉ số cộng dồn → tiêu thụ = (kỳ này − kỳ trước) × hệ số nhân.
var THONG_SO_MAC_DINH = [
  { ma: '1.8.0', ten: 'Tổng kWh chiều giao (A+)', zh: '正向有功总电量', dv: 'kWh', tich: true },
  { ma: '1.8.1', ten: 'Giờ bình thường (BT)', zh: '平段电量', dv: 'kWh', tich: true },
  { ma: '1.8.2', ten: 'Giờ cao điểm (CĐ)', zh: '峰段电量', dv: 'kWh', tich: true },
  { ma: '1.8.3', ten: 'Giờ thấp điểm (TĐ)', zh: '谷段电量', dv: 'kWh', tich: true },
  { ma: '2.8.0', ten: 'Tổng kWh chiều nhận (A−)', zh: '反向有功总电量', dv: 'kWh', tich: true },
  { ma: '3.8.0', ten: 'Vô công chiều giao (R+)', zh: '正向无功总电量', dv: 'kvarh', tich: true },
  { ma: '4.8.0', ten: 'Vô công chiều nhận (R−)', zh: '反向无功总电量', dv: 'kvarh', tich: true }
];

var VAI_TRO = { admin: 'Quản trị · 管理员', quanly: 'Quản lý · 主管', kythuat: 'Kỹ thuật · 技术员' };
var QUYEN = {
  xacnhan: ['admin', 'quanly', 'kythuat'],
  may: ['admin', 'quanly'],
  huy: ['admin', 'quanly'],
  nguoidung: ['admin'],
  caidat: ['admin'],
  thongso: ['admin'],
  khoaky: ['admin', 'quanly'],      // khoá / mở lại kỳ điện, duyệt ngoại lệ, sửa số kỳ đã khoá
  nhatky: ['admin', 'quanly'],
  giaoviec: ['admin', 'quanly']     // giao việc, kiểm tra việc xong, việc lặp lại
};
var HANH_DONG_GHI = ['confirm', 'undo', 'saveMachine', 'saveLine', 'saveUser', 'changePin', 'notifySave',
  'saveReading', 'deleteReading', 'saveMeter', 'saveParams', 'saveLists', 'importKho', 'saveKho',
  'lockPeriod', 'unlockPeriod', 'approveReading', 'saveDienCfg',
  'saveTask', 'updateTask', 'assignTasks', 'saveRecurring'];

var CAI_DAT_MAC_DINH = {
  nhacTruoc: 3, gio: 7, tgBat: false, tgToken: '', tgChat: '', tgTen: '',
  mailBat: false, baoXong: false, linkApp: '',
  baoViec: true,                     // báo lên Telegram khi giao việc
  nguongTang: 50, nguongGiam: 50     // % lệch bình quân ngày so với 3 kỳ trước → cảnh báo bất thường
};

var MAU_MAY = [
  ["M001", "喷印机 VKY01", "Máy in phun · 喷印机", 20, "2026-10-12"],
  ["M002", "喷印机 VKY06", "Máy in phun · 喷印机", 20, "2026-10-09"],
  ["M003", "喷印机 VKY08", "Máy in phun · 喷印机", 20, "2026-10-10"],
  ["M004", "喷印机 VKY09", "Máy in phun · 喷印机", 20, "2026-09-27"],
  ["M005", "喷印机 VKY16", "Máy in phun · 喷印机", 20, "2026-10-09"],
  ["M006", "喷印机 VKY17", "Máy in phun · 喷印机", 20, "2026-10-10"],
  ["M007", "喷印机 VKY18", "Máy in phun · 喷印机", 20, "2026-09-27"],
  ["M008", "喷印机 VKY21", "Máy in phun · 喷印机", 20, "2026-10-12"],
  ["M009", "喷印机 VKY23", "Máy in phun · 喷印机", 20, "2026-09-26"],
  ["M010", "喷印机 Kho ngũ kim", "Máy in phun · 喷印机", 60, "2026-10-01"],
  ["M011", "打包机Máy đóng bao 01", "Máy đóng bao · 打包机", 45, "2026-11-07"],
  ["M012", "打包机Máy đóng bao 02", "Máy đóng bao · 打包机", 45, "2026-11-07"],
  ["M013", "打包机Máy đóng bao 03", "Máy đóng bao · 打包机", 45, "2026-11-07"],
  ["M014", "打包机Máy đóng bao 04", "Máy đóng bao · 打包机", 45, "2026-11-07"],
  ["M015", "打包机Máy đóng bao 05", "Máy đóng bao · 打包机", 45, "2026-11-07"],
  ["M016", "打包机Máy đóng bao 06", "Máy đóng bao · 打包机", 45, "2026-11-07"],
  ["M017", "打包机Máy đóng bao 07", "Máy đóng bao · 打包机", 45, "2026-11-07"],
  ["M018", "Máy hút bụi VKY01", "Máy hút bụi · 吸尘器", 45, "2026-09-28"],
  ["M019", "Máy hút bụi VKY02", "Máy hút bụi · 吸尘器", 45, "2026-09-28"],
  ["M020", "Máy hút bụi VKY03", "Máy hút bụi · 吸尘器", 45, "2026-09-28"],
  ["M021", "Máy hút bụi VKY04", "Máy hút bụi · 吸尘器", 45, "2026-09-28"],
  ["M022", "Máy hút bụi VKY06", "Máy hút bụi · 吸尘器", 45, "2026-09-28"],
  ["M023", "Máy hút bụi VKY08", "Máy hút bụi · 吸尘器", 45, "2026-09-28"],
  ["M024", "Máy hút bụi VKY09", "Máy hút bụi · 吸尘器", 45, "2026-10-01"],
  ["M025", "Máy hút bụi VKY10", "Máy hút bụi · 吸尘器", 45, "2026-10-01"],
  ["M026", "Máy hút bụi VKY12", "Máy hút bụi · 吸尘器", 45, "2026-10-01"],
  ["M027", "Máy hút bụi VKY13", "Máy hút bụi · 吸尘器", 45, "2026-10-01"],
  ["M028", "Máy hút bụi VKY15", "Máy hút bụi · 吸尘器", 45, "2026-10-01"],
  ["M029", "Máy hút bụi VKY16", "Máy hút bụi · 吸尘器", 45, "2026-10-01"],
  ["M030", "Máy hút bụi VKY17", "Máy hút bụi · 吸尘器", 45, "2026-10-01"],
  ["M031", "空调01车间", "Điều hòa · 空调", 30, "2026-10-05"],
  ["M032", "空调02车间", "Điều hòa · 空调", 30, "2026-10-06"],
  ["M033", "Máy băm phế + Máy ép phế xưởng 1", "Máy băm, ép phế · 废料机", 20, "2026-10-01"],
  ["M034", "Máy băm phế + Máy ép phế xưởng 2", "Máy băm, ép phế · 废料机", 20, "2026-10-01"],
  ["M035", "Máy bơm khu vực XLNT", "Bơm nước · 水泵", 45, "2026-10-03"],
  ["M036", "Bơm nước khu vực cầu công", "Bơm nước · 水泵", 40, "2026-10-04"],
  ["M037", "Máy phát điện và phòng điện", "Điện · 电力", 30, "2026-10-06"],
  ["M038", "Phòng máy nén khí", "Khí nén · 空压机", 15, "2026-10-07"],
  ["M039", "电柜一号车间Tủ điện xưởng 1", "Điện · 电力", 15, "2026-09-24"],
  ["M040", "电柜二号车间Tủ điện xưởng 2", "Điện · 电力", 15, "2026-10-07"],
];
var MAU_LS = [
  ["M001", "2026-09-06", "裴文终", "已经保养"],
  ["M009", "2026-09-06", "裴文终", "已经保养"],
  ["M002", "2026-09-19", "裴文终", "已经保养"],
  ["M005", "2026-09-19", "裴文终", "已经保养"],
  ["M006", "2026-09-20", "裴文终", "已经保养"],
  ["M003", "2026-09-20", "裴文终", "已经保养"],
  ["M008", "2026-09-22", "裴文终", "已经保养"],
  ["M001", "2026-09-22", "裴文终", "已经保养"],
  ["M038", "2026-09-22", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
  ["M040", "2026-09-22", "Đỗ Văn Hồng, 阿杰", "已经保养"],
  ["M011", "2026-09-23", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
  ["M012", "2026-09-23", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
  ["M013", "2026-09-23", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
  ["M014", "2026-09-23", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
  ["M015", "2026-09-23", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
  ["M016", "2026-09-23", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
  ["M017", "2026-09-23", "Lê Minh Tiến, Nguyễn tuấn", "已经保养"],
];

// ===================== Điểm vào =====================
function doGet() {
  return traVe({ ok: true, data: { app: 'lich-bao-duong', phienBan: PHIEN_BAN } });
}

function doPost(e) {
  var req;
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (x) { return traVe({ ok: false, code: 'YEU_CAU', message: 'Yêu cầu không hợp lệ' }); }
  return traVe(xuLy(req));
}

function traVe(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

var TIN_CHO = [];
var DA_TIEU_DE = {};  // trang đã kiểm dòng tiêu đề trong lần chạy này

function xuLy(req) {
  TIN_CHO = []; DA_TIEU_DE = {}; DU_COT = {}; DICH_LOI = false;
  var kq, lock = null;
  try {
    req = req || {};
    var a = String(req.action || '');
    if (HANH_DONG_GHI.indexOf(a) >= 0) {
      lock = LockService.getScriptLock();
      if (!lock.tryLock(25000)) throw loi('BAN', 'Máy chủ đang bận · 服务器繁忙');
    }
    kq = { ok: true, data: dieuHuong(a, req.payload || {}, req) };
  } catch (e) {
    kq = { ok: false, code: (e && e.code) || 'LOI', message: String((e && e.message) || e) };
    if (e && e.data !== undefined) kq.data = e.data;
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (x) { /* bỏ qua */ } }
  }
  guiTinCho();
  return kq;
}

function dieuHuong(a, p, req) {
  if (a === 'ping') return { phienBan: PHIEN_BAN };
  if (a === 'login') return dangNhap(p, req.device);
  var u = xacThuc(req.token);
  switch (a) {
    case 'data':
      try { nhapSoDienExcel(); } catch (e) { console.log('nhapSoDienExcel: ' + (e && e.message || e)); }
      try { nangCapLanDau(); } catch (e) { console.log('nangCapLanDau: ' + (e && e.message || e)); }
      try { taoViecLap(false); } catch (e) { console.log('taoViecLap: ' + (e && e.message || e)); }
      try { dichBu(8, false); } catch (e) { console.log('dichBu: ' + (e && e.message || e)); }
      return layDuLieu(u);
    case 'history': return {
      lichSu: docLichSu().filter(function (x) { return x.ngay.slice(0, 4) === String(p.nam); }).map(sachLS),
      chiSo: docChiSo().filter(function (x) { return x.ky.slice(0, 4) === String(p.nam) && x.trangThai !== 'HUY'; }).map(sachCS)
    };
    case 'confirm': canQuyen(u, 'xacnhan'); return xacNhan(u, p, s(req.opId));
    case 'undo': return huyXacNhan(u, p);
    case 'saveMachine': canQuyen(u, 'may'); return luuMay(u, p);
    case 'saveLine': canQuyen(u, 'may'); return luuChuyen(u, p);
    case 'saveLists': canQuyen(u, 'may'); return luuDanhSach(u, p);
    case 'users': canQuyen(u, 'nguoidung'); return { users: dsNguoiDung().map(congKhaiAdmin) };
    case 'saveUser': canQuyen(u, 'nguoidung'); return luuNguoiDung(u, p);
    case 'changePin': return doiPin(u, p);
    case 'notifyGet': canQuyen(u, 'caidat'); return layCaiDatBaoTin();
    case 'notifySave': canQuyen(u, 'caidat'); return luuCaiDatBaoTin(p);
    case 'notifyChats': canQuyen(u, 'caidat'); return timNhomTelegram(p);
    case 'notifyTest': canQuyen(u, 'caidat'); return guiThu();
    case 'saveReading': canQuyen(u, 'xacnhan'); return ghiChiSo(u, p, s(req.opId));
    case 'deleteReading': return xoaChiSo(u, p);
    case 'approveReading': canQuyen(u, 'khoaky'); return duyetChiSo(u, p);
    case 'lockPeriod': canQuyen(u, 'khoaky'); return khoaKy(u, p);
    case 'unlockPeriod': canQuyen(u, 'khoaky'); return moKhoaKy(u, p);
    case 'saveDienCfg': canQuyen(u, 'caidat'); return luuCauHinhDien(u, p);
    case 'photo': return docAnh(p);
    case 'audit': canQuyen(u, 'nhatky'); return docNhatKy(p);
    case 'saveMeter': canQuyen(u, 'may'); return luuCongTo(u, p);
    case 'saveParams': canQuyen(u, 'thongso'); return luuThongSo(p);
    case 'catalog': return layKho();
    case 'importKho': canQuyen(u, 'may'); return nhapKho(u, p);
    case 'saveKho': canQuyen(u, 'may'); return luuKho(u, p);
    case 'saveTask': canQuyen(u, 'xacnhan'); return luuCongViec(u, p, s(req.opId));
    case 'updateTask': canQuyen(u, 'xacnhan'); return capNhatCongViec(u, p, s(req.opId));
    case 'assignTasks': canQuyen(u, 'giaoviec'); return giaoNhieuViec(u, p, s(req.opId));
    case 'saveRecurring': canQuyen(u, 'giaoviec'); return luuViecLap(u, p);
  }
  throw loi('KHONG_HIEU', 'Máy chủ chưa hiểu yêu cầu này: ' + a);
}

// ===================== Tiện ích =====================
function loi(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
function s(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
function hd(v) { return !(v === 0 || v === '0' || v === false || String(v).toUpperCase() === 'FALSE'); }
function catChu(v, n) { return s(v).replace(/\s+/g, ' ').slice(0, n); }
function catNhieuDong(v, n) { return s(v).replace(/\r/g, '').slice(0, n); }
// Chặn chữ bắt đầu bằng = + - @ bị Google Sheets hiểu là công thức
function anToan(v) { return /^[=+\-@]/.test(v) ? "'" + v : v; }
function bayGio() { return new Date(Date.now() + (typeof __clock !== 'undefined' ? __clock.off : 0)); }
function homNayStr() { return Utilities.formatDate(bayGio(), TZ, 'yyyy-MM-dd'); }
function thoiGianStr() { return Utilities.formatDate(bayGio(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function ngayStr(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var t = s(v), m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad2(m[2]) + '-' + pad2(m[3]);
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]);
  return '';
}
function tgStr(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss') : s(v); }
function hopLeNgay(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  var x = new Date(d + 'T00:00:00Z');
  return !isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d && d >= '2000-01-01' && d <= '2100-12-31';
}
function congNgay(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function soNgay(a, b) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000); }
function ngayVN(d) { return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : ''; }
function hex(b) { return b.map(function (x) { var h = ((x + 256) % 256).toString(16); return h.length < 2 ? '0' + h : h; }).join(''); }

// ===================== Trang tính =====================
var DU_COT = {};      // trang đã đủ số cột trong lần chạy này
function trang(ten) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(ten);
  if (!sh) {
    sh = ss.insertSheet(ten);
    var cot = BANG[ten];
    // Trang mới của Google Sheet chỉ có 26 cột (A–Z): bảng nhiều cột hơn thì thêm cột trước
    if (sh.getMaxColumns() < cot.length) sh.insertColumnsAfter(sh.getMaxColumns(), cot.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, cot.length).setValues([cot]).setFontWeight('bold').setBackground('#16211F').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    cot.forEach(function (c, i) {
      sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(dinhDangCot(ten, c));
    });
  } else if (!DU_COT[ten]) {
    // Trang cũ được thêm cột mới ở cuối (vd CongViec v2.2 → v2.3) có thể vượt quá số cột đang có
    if (sh.getMaxColumns() < BANG[ten].length) sh.insertColumnsAfter(sh.getMaxColumns(), BANG[ten].length - sh.getMaxColumns());
  }
  DU_COT[ten] = 1;
  return sh;
}
function laSo(ten, c) { return (COT_SO[ten] || []).indexOf(c) >= 0; }
function dinhDangCot(ten, c) { return (COT_DD[ten] || {})[c] || (laSo(ten, c) ? '0' : '@'); }
function dinhDang(ten) { return BANG[ten].map(function (c) { return dinhDangCot(ten, c); }); }
function docTho(ten) {
  var sh = trang(ten), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, BANG[ten].length).getValues();
}
function themNhieu(ten, rows) {
  if (!rows.length) return;
  var sh = trang(ten), r = sh.getLastRow() + 1, can = r + rows.length - 1;
  if (can > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), can - sh.getMaxRows() + 200);
  var dd = dinhDang(ten).slice(0, rows[0].length);
  sh.getRange(r, 1, rows.length, rows[0].length)
    .setNumberFormats(rows.map(function () { return dd; })).setValues(rows);
}
function themDong(ten, arr) { themNhieu(ten, [arr]); }
function suaDong(ten, r, arr) {
  trang(ten).getRange(r, 1, 1, arr.length).setNumberFormats([dinhDang(ten).slice(0, arr.length)]).setValues([arr]);
}

// ----- Máy -----
function mayTuDong(r, i) {
  return {
    ma: s(r[0]), ten: s(r[1]), tenPhu: s(r[2]), nhom: s(r[3]), viTri: s(r[4]),
    chuKy: Math.round(Number(r[5])) || 0, hanKeTiep: ngayStr(r[6]), noiDung: s(r[7]),
    hoatDong: hd(r[8]), capNhat: tgStr(r[9]), hangMuc: docJson(r[10], []), linhKien: docJson(r[11], []),
    phuTrach: s(r[12]), ngayDuaVao: ngayStr(r[13]), chuyen: s(r[14]).toUpperCase(), _r: i + 2
  };
}
function mayThanhDong(m) {
  return [m.ma, anToan(m.ten), anToan(m.tenPhu), anToan(m.nhom), anToan(m.viTri), m.chuKy, m.hanKeTiep,
    anToan(m.noiDung), m.hoatDong ? 1 : 0, m.capNhat,
    m.hangMuc && m.hangMuc.length ? JSON.stringify(m.hangMuc) : '', m.linhKien && m.linhKien.length ? JSON.stringify(m.linhKien) : '',
    anToan(m.phuTrach || ''), m.ngayDuaVao || '', m.chuyen || ''];
}
function docJson(v, macDinh) {
  var t = s(v); if (!t) return macDinh;
  try { var o = JSON.parse(t); return o === null || o === undefined ? macDinh : o; } catch (e) { return macDinh; }
}
function dsMay() { return docTho('May').map(mayTuDong).filter(function (m) { return m.ma; }); }
function timMay(ma) { ma = s(ma).toUpperCase(); return dsMay().filter(function (m) { return m.ma === ma; })[0] || null; }
function sachMay(m) {
  return { ma: m.ma, ten: m.ten, tenPhu: m.tenPhu, nhom: m.nhom, viTri: m.viTri, chuKy: m.chuKy,
    hanKeTiep: m.hanKeTiep, noiDung: m.noiDung, hoatDong: m.hoatDong, capNhat: m.capNhat,
    hangMuc: m.hangMuc || [], linhKien: m.linhKien || [], phuTrach: m.phuTrach || '', ngayDuaVao: m.ngayDuaVao || '', chuyen: m.chuyen || '' };
}
// ----- Chuyền sản xuất -----
var CH_KHOA = ['ma', 'ten', 'tenZh', 'maTaiSan', 'quyCach', 'nhaSX', 'tinhNang', 'tocDoChuan', 'tocDoThucTe', 'viTri', 'soXuatXuong',
  'ngaySX', 'ngayCaiTao', 'ngayVN', 'ghiChu'];
function chTuDong(r, i) {
  var o = { _r: i + 2 };
  CH_KHOA.forEach(function (k, j) { o[k] = s(r[j]); });
  o.ma = o.ma.toUpperCase(); o.hoatDong = s(r[15]) === '' ? true : hd(r[15]); o.capNhat = tgStr(r[16]);
  return o;
}
function chThanhDong(o) { return CH_KHOA.map(function (k) { return anToan(o[k] || ''); }).concat([o.hoatDong === false ? 0 : 1, o.capNhat || '']); }
function dsChuyen() { return docTho('Chuyen').map(chTuDong).filter(function (x) { return x.ma; }); }
function sachCh(o) { var x = {}; CH_KHOA.forEach(function (k) { x[k] = o[k] || ''; }); x.hoatDong = o.hoatDong !== false; return x; }
// Lần đầu: tạo 16 chuyền từ sổ cái, xếp máy in phun (喷印机 VKYxx) và máy hút bụi (Máy hút bụi VKYxx) vào chuyền cùng số. Chạy lại không trùng, không đè máy đã xếp.
function napChuyen() {
  if (typeof DL_CHUYEN === 'undefined') return 0;
  trang('Chuyen'); capNhatTieuDe('Chuyen'); capNhatTieuDe('May');
  var co = {}, moi = [], bay = thoiGianStr();
  dsChuyen().forEach(function (x) { co[x.ma] = 1; });
  DL_CHUYEN.forEach(function (r) {
    if (co[r[0]]) return;
    var o = {}; CH_KHOA.forEach(function (k, j) { o[k] = r[j] === undefined || r[j] === null ? '' : String(r[j]); });
    o.hoatDong = true; o.capNhat = bay; moi.push(chThanhDong(o)); co[r[0]] = 1;
  });
  if (moi.length) themNhieu('Chuyen', moi);
  var n = 0;
  dsMay().forEach(function (m) {
    var k = /(?:喷印机|máy hút bụi)\s*VKY\s*0*(\d+)/i.exec(m.ten);
    if (!k || m.chuyen) return;
    var ma = 'VKY' + ('0' + k[1]).slice(-2);
    if (!co[ma]) return;
    m.chuyen = ma; suaDong('May', m._r, mayThanhDong(m)); n++;
  });
  return moi.length + n;
}
function luuChuyen(u, p) {
  var ma = s(p.ma).toUpperCase(), ds = dsChuyen(), x = ds.filter(function (c) { return c.ma === ma; })[0];
  if (!/^[A-Z0-9._()-]{1,20}$/.test(ma)) throw loi('MA_SAI', 'Mã chuyền không hợp lệ · 产线编号无效');
  capNhatTieuDe('Chuyen');
  var moi = !x; if (moi) x = { ma: ma };
  CH_KHOA.forEach(function (k) { if (k !== 'ma' && p[k] !== undefined) x[k] = catChu(p[k], k === 'ghiChu' ? 500 : 200); });
  if (p.hoatDong !== undefined) x.hoatDong = p.hoatDong !== false;
  x.capNhat = thoiGianStr();
  if (moi) themDong('Chuyen', chThanhDong(x)); else suaDong('Chuyen', x._r, chThanhDong(x));
  return { chuyen: sachCh(x) };
}

// ----- Lịch sử -----
function lsTuDong(r, i) {
  return {
    id: s(r[0]), ma: s(r[1]), tenMay: s(r[2]), ngay: ngayStr(r[3]), denHan: ngayStr(r[4]),
    nguoi: s(r[5]), ghiChu: s(r[6]), xacNhan: s(r[7]), thoiGian: tgStr(r[8]),
    trangThai: s(r[9]) || 'OK', opId: s(r[10]), uid: s(r[11]), huy: s(r[12]), chiTiet: docJson(r[13], null), _r: i + 2
  };
}
function lsThanhDong(x) {
  return [x.id, x.ma, anToan(x.tenMay), x.ngay, x.denHan, anToan(x.nguoi), anToan(x.ghiChu), anToan(x.xacNhan),
    x.thoiGian, x.trangThai, x.opId, x.uid, anToan(x.huy), x.chiTiet ? JSON.stringify(x.chiTiet) : ''];
}
function docLichSu() { return docTho('LichSu').map(lsTuDong).filter(function (x) { return x.id && x.ma; }); }
function sachLS(x) {
  return { id: x.id, ma: x.ma, tenMay: x.tenMay, ngay: x.ngay, denHan: x.denHan, nguoi: x.nguoi,
    ghiChu: x.ghiChu, xacNhan: x.xacNhan, thoiGian: x.thoiGian, trangThai: x.trangThai, uid: x.uid, huy: x.huy,
    chiTiet: x.chiTiet || null };
}

// ----- Người dùng -----
// Mã nhân viên (MaNV) dùng để đăng nhập cùng PIN. Người dùng cũ chưa có mã thì dùng ID (U001…).
function maNVHopLe(v) { v = s(v).toUpperCase().replace(/\s+/g, ''); return /^[A-Z0-9._-]{1,20}$/.test(v) ? v : ''; }
function ndTuDong(r, i) {
  var id = s(r[0]);
  return { id: id, ten: s(r[1]), vaiTro: s(r[2]), pinHash: s(r[3]), email: s(r[4]),
    hoatDong: hd(r[5]), ngayTao: tgStr(r[6]), maNV: maNVHopLe(r[7]) || id.toUpperCase(), tenZh: s(r[8]), _r: i + 2 };
}
function ndThanhDong(x) { return [x.id, anToan(x.ten), x.vaiTro, x.pinHash, x.email, x.hoatDong ? 1 : 0, x.ngayTao, x.maNV || '', anToan(x.tenZh || '')]; }
function dsNguoiDung() { return docTho('NguoiDung').map(ndTuDong).filter(function (x) { return x.id; }); }
function congKhai(u) { return { id: u.id, ten: u.ten, vaiTro: u.vaiTro, maNV: u.maNV, tenZh: u.tenZh || '' }; }
function congKhaiAdmin(u) {
  return { id: u.id, ten: u.ten, vaiTro: u.vaiTro, email: u.email, hoatDong: u.hoatDong, ngayTao: u.ngayTao, maNV: u.maNV, tenZh: u.tenZh || '' };
}

// ===================== Đăng nhập =====================
function thuocTinh(k) {
  var p = PropertiesService.getScriptProperties(), v = p.getProperty(k);
  if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty(k, v); }
  return v;
}
function bamPin(pin) {
  return hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, thuocTinh('SALT') + '|' + pin, Utilities.Charset.UTF_8));
}
function kyTen(base, pinHash) {
  var sig = Utilities.computeHmacSha256Signature(base + '.' + pinHash, thuocTinh('TOKEN_KEY'));
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 32);
}
function taoToken(u) {
  var base = u.id + '.' + (bayGio().getTime() + HAN_PHIEN_NGAY * 86400000);
  return base + '.' + kyTen(base, u.pinHash);
}
function xacThuc(token) {
  var p = s(token).split('.');
  if (p.length !== 3 || !(Number(p[1]) > bayGio().getTime())) throw loi('HET_PHIEN', 'Hết phiên đăng nhập · 登录已过期');
  var u = dsNguoiDung().filter(function (x) { return x.id === p[0]; })[0];
  if (!u || !u.hoatDong || kyTen(p[0] + '.' + p[1], u.pinHash) !== p[2]) throw loi('HET_PHIEN', 'Hết phiên đăng nhập · 登录已过期');
  return u;
}
// Đăng nhập: mã nhân viên + PIN 6 số. Bỏ trống mã nhân viên thì chỉ nhận khi PIN đó là của đúng một người
// (giữ cho người dùng bản cũ đăng nhập được). PIN không còn bắt buộc khác nhau giữa các người dùng.
function dangNhap(p, device) {
  var pin = s(p.pin), maNV = maNVHopLe(p.maNV), cache = CacheService.getScriptCache();
  var kMay = 'sai_' + s(device).slice(0, 60), nMay = Number(cache.get(kMay)) || 0, nAll = Number(cache.get('sai_all')) || 0;
  var kNV = maNV ? 'sai_nv_' + maNV : '', nNV = kNV ? Number(cache.get(kNV)) || 0 : 0;
  if (nMay >= 5 || nNV >= 5) throw loi('KHOA', 'Sai PIN nhiều lần, thử lại sau 5 phút');
  if (nAll >= 30) throw loi('KHOA_HT', 'Hệ thống tạm khoá 10 phút');
  var h = /^\d{6}$/.test(pin) ? bamPin(pin) : '';
  var ds = h ? dsNguoiDung().filter(function (x) { return x.hoatDong && x.pinHash === h && (!maNV || x.maNV === maNV); }) : [];
  if (!maNV && ds.length > 1) throw loi('CAN_MA_NV', 'Nhập mã nhân viên · 请输入员工编号');
  var u = ds[0];
  if (!u) {
    cache.put(kMay, String(nMay + 1), 300);
    if (kNV) cache.put(kNV, String(nNV + 1), 300);
    cache.put('sai_all', String(nAll + 1), 600);
    throw loi('PIN_SAI', 'Mã nhân viên hoặc PIN không đúng · 员工编号或PIN错误');
  }
  cache.remove(kMay); if (kNV) cache.remove(kNV);
  return { token: taoToken(u), me: congKhai(u) };
}
function coQuyen(u, q) { return (QUYEN[q] || []).indexOf(u.vaiTro) >= 0; }
function canQuyen(u, q) { if (!coQuyen(u, q)) throw loi('KHONG_QUYEN', 'Không có quyền · 无权限'); }

// ===================== Dữ liệu =====================
function layDuLieu(u) {
  var homNay = homNayStr(), tu = (Number(homNay.slice(0, 4)) - 1) + '-01-01';
  var cd = docCaiDat();
  return {
    homNay: homNay,
    thoiGian: thoiGianStr(),
    may: dsMay().map(sachMay),
    chuyen: dsChuyen().map(sachCh),
    lichSu: docLichSu().filter(function (x) { return x.ngay >= tu; }).map(sachLS),
    nguoiDung: dsNguoiDung().filter(function (x) { return x.hoatDong; }).map(function (x) { return x.ten; }),
    congTo: dsCongTo().map(sachCT),
    thongSo: docThongSo(),
    chiSo: docChiSo().filter(function (x) { return x.ky >= tu && x.trangThai !== 'HUY'; }).map(sachCS),
    caiDat: { nhacTruoc: cd.nhacTruoc, nguongTang: cd.nguongTang, nguongGiam: cd.nguongGiam },
    khoaKy: docKhoaKy(),
    congViec: docCongViec().filter(function (x) { return CV_MO.indexOf(x.trangThai) >= 0 || x.trangThai === 'XONG' || x.lucTao >= tu; }).map(sachCV),
    viecLap: docViecLap().map(sachCV),
    nhanVien: dsNguoiDung().filter(function (x) { return x.hoatDong; }).map(function (x) { return { id: x.id, ten: x.ten, tenZh: x.tenZh, vaiTro: x.vaiTro, maNV: x.maNV }; }),
    kho: khoTomTat(),
    me: congKhai(u),
    phienBan: PHIEN_BAN
  };
}

// ===================== Xác nhận bảo dưỡng =====================
function xacNhan(u, p, opId) {
  var ls = docLichSu();
  if (opId) {
    var cu = ls.filter(function (x) { return x.opId === opId; })[0];
    if (cu) { var m0 = timMay(cu.ma); return { dup: true, ban: sachLS(cu), may: m0 ? sachMay(m0) : null }; }
  }
  var m = timMay(p.ma);
  if (!m) throw loi('KHONG_CO_MAY', 'Không tìm thấy máy · 找不到设备');
  if (!m.hoatDong) throw loi('MAY_NGUNG', 'Máy đã ngừng theo dõi · 设备已停用');
  capNhatTieuDe('LichSu'); capNhatTieuDe('May');
  var ngay = ngayStr(p.ngay), homNay = homNayStr();
  if (!hopLeNgay(ngay)) throw loi('NGAY_SAI', 'Ngày không hợp lệ · 日期无效');
  if (ngay > homNay) throw loi('NGAY_TUONG_LAI', 'Không xác nhận trước ngày · 不能确认未来日期');
  if (soNgay(homNay, ngay) > LUI_TOI_DA) throw loi('NGAY_QUA_XA', 'Ngày quá xa · 日期太久');
  var trung = ls.filter(function (x) { return x.ma === m.ma && x.ngay === ngay && x.trangThai !== 'HUY'; })[0];
  if (trung) throw loi('DA_XAC_NHAN', trung.nguoi || trung.xacNhan);
  var cuoi = '';
  ls.forEach(function (x) { if (x.ma === m.ma && x.trangThai !== 'HUY' && x.ngay > cuoi) cuoi = x.ngay; });
  var moiNhat = !cuoi || ngay > cuoi;
  var chiTiet = sachChiTiet(p.chiTiet);
  var gan = ganLKDaDung(m, chiTiet ? chiTiet.lk : [], u, ngay, 'Thêm khi bảo dưỡng · 保养时添加');
  var x = {
    id: 'LS' + Utilities.formatDate(bayGio(), TZ, 'yyMMddHHmmss') + Math.floor(100 + Math.random() * 900),
    ma: m.ma, tenMay: m.ten, ngay: ngay, denHan: moiNhat ? m.hanKeTiep : '',
    nguoi: catChu(p.nguoi, 150) || u.ten, ghiChu: catNhieuDong(p.ghiChu, 500), xacNhan: u.ten,
    thoiGian: thoiGianStr(), trangThai: 'OK', opId: opId, uid: u.id, huy: '', chiTiet: chiTiet
  };
  themDong('LichSu', lsThanhDong(x));
  if (moiNhat) m.hanKeTiep = congNgay(ngay, m.chuKy);
  if (moiNhat || gan.doiMay) {
    m.capNhat = x.thoiGian;
    suaDong('May', m._r, mayThanhDong(m));
  }
  TIN_CHO.push({ loai: 'xong', may: m, ban: x });
  return { ban: sachLS(x), may: sachMay(m), kho: gan.kho ? khoLuuMoi(gan.kho) : null, dsCongViec: dongViecBaoDuong(m, x, u).map(sachCV) };
}
// Xác nhận bảo dưỡng thì đóng luôn các việc "bảo dưỡng" đang giao cho máy đó
function dongViecBaoDuong(m, ls, u) {
  var out = [];
  docCongViec().forEach(function (v) {
    if (v.loai !== 'BD' || v.ma !== m.ma || CV_MO.indexOf(v.trangThai) < 0) return;
    capNhatTieuDe('CongViec');
    v.trangThai = 'DONG'; v.lucXong = ls.thoiGian; v.capNhat = ls.thoiGian;
    if (!v.lucBatDau) v.lucBatDau = ls.thoiGian;
    v.ketQua = 'Đã xác nhận bảo dưỡng ngày ' + ngayVN(ls.ngay) + ' — ' + ls.nguoi;
    v.ketQuaDich = '已确认保养 ' + ngayVN(ls.ngay) + ' — ' + ls.nguoi;
    v.nhatKy.push({ b: 'xong', luc: ls.thoiGian, uid: u.id, nguoi: u.ten, gc: v.ketQua, op: '' });
    suaDong('CongViec', v._r, cvThanhDong(v));
    out.push(v);
  });
  return out;
}

// Linh kiện đã dùng khi bảo dưỡng / sửa chữa (lk đã qua sachChiTiet, bị sửa tại chỗ):
// - gõ tên tay nhưng máy đã có linh kiện trùng tên → dùng mã sẵn có để thống kê không bị tách đôi
// - mã kho lấy theo linh kiện của máy (linh kiện cũ chưa gắn thì gắn luôn); linh kiện chưa có trong kho thì tự thêm vào kho
// - linh kiện mới thì thêm vào bảng linh kiện của máy
// Trả { kho: kho đã nạp (null nếu không dùng), doiMay: true nếu phải ghi lại dòng máy }
function ganLKDaDung(m, lk, u, ngay, nguon) {
  var r = { kho: null, doiMay: false };
  if (!lk || !lk.length) return r;
  var lkMay = {}, theoTen = {};
  (m.linhKien || []).forEach(function (k) { lkMay[k.id] = k; theoTen[k.ten.toLowerCase()] = k.id; });
  lk.forEach(function (k) { if (!lkMay[k.id] && theoTen[k.ten.toLowerCase()]) k.id = theoTen[k.ten.toLowerCase()]; });
  r.kho = khoNap();
  var cu = [];
  lk.forEach(function (k) { var c = lkMay[k.id]; if (c && !c.maKho && cu.indexOf(c) < 0) cu.push(c); });
  if (cu.length) { ganKho(cu, ghiChuThem(m.ma, u), r.kho); r.doiMay = true; }
  lk.forEach(function (k) { var c = lkMay[k.id]; if (c) k.maKho = c.maKho; });
  ganKho(lk.filter(function (k) { return !lkMay[k.id]; }), ghiChuThem(m.ma, u), r.kho);
  m.linhKien = m.linhKien || [];
  var co = {};
  m.linhKien.forEach(function (k) { co[k.id] = 1; });
  lk.forEach(function (k) {
    if (co[k.id] || m.linhKien.length >= TOI_DA_DS) return;
    co[k.id] = 1; r.doiMay = true;
    var o = { id: k.id, ten: k.ten, quyCach: k.quyCach, dv: k.dv, sl: '', ghiChu: nguon + ' ' + ngayVN(ngay) + ' · ' + u.ten };
    if (k.maKho) o.maKho = k.maKho;
    m.linhKien.push(o);
  });
  return r;
}

function huyXacNhan(u, p) {
  var ls = docLichSu(), id = s(p.id);
  var x = ls.filter(function (r) { return r.id === id; })[0];
  if (!x) throw loi('KHONG_CO', 'Không tìm thấy · 找不到');
  var m = timMay(x.ma);
  if (x.trangThai === 'HUY') return { ban: sachLS(x), may: m ? sachMay(m) : null, daHuy: true };
  var cuaMinh = x.uid === u.id && x.thoiGian.slice(0, 10) === homNayStr();
  if (!coQuyen(u, 'huy') && !cuaMinh) throw loi('KHONG_QUYEN', 'Không có quyền · 无权限');
  var lyDo = catChu(p.lyDo, 200);
  capNhatTieuDe('LichSu'); capNhatTieuDe('May');
  x.trangThai = 'HUY';
  x.huy = u.ten + ' · ' + thoiGianStr() + (lyDo ? ' · ' + lyDo : '');
  suaDong('LichSu', x._r, lsThanhDong(x));
  if (m) {
    var moiNhat = '';
    ls.forEach(function (r) { if (r.ma === x.ma && r.trangThai !== 'HUY' && r.id !== x.id && r.ngay > moiNhat) moiNhat = r.ngay; });
    if (x.ngay > moiNhat) {
      m.hanKeTiep = x.denHan || (moiNhat ? congNgay(moiNhat, m.chuKy) : m.hanKeTiep);
      m.capNhat = thoiGianStr();
      suaDong('May', m._r, mayThanhDong(m));
    }
  }
  return { ban: sachLS(x), may: m ? sachMay(m) : null };
}

// ===================== Thời gian, ảnh (dùng chung) =====================
var SC_ANH_TOI_DA = 4;
// 'yyyy-MM-dd HH:mm[:ss]' hoặc 'yyyy-MM-ddTHH:mm' (ô chọn giờ của iPhone) → 'yyyy-MM-dd HH:mm:ss'; sai → ''
function tgHopLe(v) {
  var m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s(v));
  if (!m || !hopLeNgay(m[1]) || +m[2] > 23 || +m[3] > 59 || (m[4] && +m[4] > 59)) return '';
  return m[1] + ' ' + m[2] + ':' + m[3] + ':' + (m[4] || '00');
}
function msTG(t) { return Date.parse(t.replace(' ', 'T') + 'Z'); }
function phutGiua(a, b) { return Math.max(0, Math.round((msTG(b) - msTG(a)) / 60000)); }
// Thời điểm do người dùng nhập: không ở tương lai (cho lệch đồng hồ 10 phút), không lùi quá LUI_TOI_DA ngày
function scKiemTG(v, macDinh) {
  var t = v === undefined || v === null || s(v) === '' ? macDinh : tgHopLe(v);
  if (!t) throw loi('TG_SAI', 'Thời gian không hợp lệ · 时间无效');
  var bay = thoiGianStr();
  if (msTG(t) > msTG(bay) + 10 * 60000) throw loi('NGAY_TUONG_LAI', 'Thời gian ở tương lai · 时间不能晚于现在');
  if (msTG(bay) - msTG(t) > LUI_TOI_DA * 86400000) throw loi('NGAY_QUA_XA', 'Ngày quá xa · 日期太久');
  return t;
}
function anhSC(anh, ten, loai) {
  return sachAnh((Array.isArray(anh) ? anh : []).slice(0, SC_ANH_TOI_DA).map(function (a) {
    return a ? { loai: loai, data: a.data, id: a.id } : null;
  }), ten);
}

// ===================== Tự dịch Việt ↔ Trung (Google Dịch có sẵn trong Apps Script, không cần khoá) =====================
// Gõ tiếng Việt → dịch sang tiếng Trung; gõ tiếng Trung → dịch sang tiếng Việt; gõ sẵn "Việt · 中文" → tách đôi, không dịch.
// Dịch lỗi (hết hạn mức trong ngày, Google bận…) KHÔNG chặn việc lưu: bản dịch để trống, ghi dấu DICH_THIEU,
// rồi dịch bù khi app tải dữ liệu (sau ít nhất 1 giờ) hoặc lúc nhắc hằng ngày.
var DICH_LOI = false;      // trong lần chạy này dịch đã lỗi → không gọi tiếp
var CJK_RE = /[㐀-鿿豈-﫿]/g;
var CHU_RE = /[A-Za-zÀ-ỹ]/g;
var VI_DAU_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi;
// "chữ gốc · bản dịch" (tiếng Việt trước) cho tin nhắn Telegram / email
function hai(goc, dich) {
  goc = s(goc); dich = s(dich);
  if (!dich || dich === goc) return goc;
  return laTiengTrung(goc) && !laTiengTrung(dich) ? dich + ' · ' + goc : goc + ' · ' + dich;
}
function demKyTu(t, re) { var m = String(t || '').match(re); return m ? m.length : 0; }
function laTiengTrung(t) { var c = demKyTu(t, CJK_RE); return c > 0 && c * 2 >= demKyTu(t, CHU_RE); }
// Có cần dịch không: có chữ thật (bỏ qua mã như M001, VKY03, số), và chưa viết sẵn cả hai thứ tiếng
function canDich(t) {
  t = s(t);
  var chu = t.replace(/\S*\d\S*/g, ' ');
  if (!t || !(demKyTu(chu, CJK_RE) >= 1 || demKyTu(chu, CHU_RE) >= 2)) return false;
  return !(demKyTu(t, CJK_RE) >= 2 && demKyTu(t, VI_DAU_RE) >= 2);
}
function giaiMa(t) { return String(t).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
function dichChu(t) {
  t = s(t);
  if (DICH_LOI || !canDich(t)) return '';
  var zh = laTiengTrung(t);
  try {
    return s(giaiMa(LanguageApp.translate(t, zh ? 'zh-CN' : 'vi', zh ? 'vi' : 'zh-CN', { contentType: 'text' }))).slice(0, 2000);
  } catch (e) {
    DICH_LOI = true;
    try { PropertiesService.getScriptProperties().setProperty('DICH_THIEU', thoiGianStr()); } catch (x) { /* bỏ qua */ }
    console.log('dichChu: ' + (e && e.message || e));
    return '';
  }
}
// Chữ người dùng gõ → [chữ gốc, bản dịch]
function songNgu(t, dichTay) {
  t = s(t);
  if (!t) return ['', ''];
  if (s(dichTay)) return [t, s(dichTay).slice(0, 2000)];
  var i = t.indexOf(' · ');
  if (i > 0) {
    var a = t.slice(0, i).trim(), b = t.slice(i + 3).trim();
    if (a && b && laTiengTrung(a) !== laTiengTrung(b)) return [a, b];
  }
  return [t, dichChu(t)];
}
// Khi sửa: gửi kèm bản dịch = sửa tay (dùng luôn, không dịch đè); gửi bản dịch rỗng = nhờ dịch lại;
// không gửi: chữ gốc đổi (hoặc chưa có bản dịch) thì dịch lại, còn không thì giữ nguyên.
function dichKhiSua(moi, cuGoc, cuDich, dichGui) {
  if (dichGui !== undefined && dichGui !== null) return s(dichGui) ? [s(moi), s(dichGui).slice(0, 2000)] : songNgu(moi);
  if (s(moi) === s(cuGoc) && (s(cuDich) || !canDich(moi))) return [s(cuGoc), s(cuDich)];
  return songNgu(moi);
}
var DICH_TRUONG = [['tieuDe', 'tieuDeDich'], ['moTa', 'moTaDich'], ['ketQua', 'ketQuaDich'], ['nguyenNhan', 'nguyenNhanDich']];
var DICH_GC = ['hoan', 'tralai', 'huy'];
// Dịch bù những chỗ còn thiếu bản dịch (việc của 60 ngày gần đây + việc lặp lại). Trả số lần đã gọi dịch.
function dichBu(max, khongCho) {
  var ps = PropertiesService.getScriptProperties(), dau = ps.getProperty('DICH_THIEU');
  if (!dau) return 0;
  if (!khongCho && msTG(thoiGianStr()) - msTG(dau) < 3600000) return 0;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return 0;
  var n = 0, tu = congNgay(homNayStr(), -60);
  try {
    var thieu = function (o, k) { return canDich(o[k[0]]) && !s(o[k[1]]); };
    docCongViec().forEach(function (x) {
      if (n >= max || DICH_LOI || x.trangThai === 'HUY' || (x.lucTao || '').slice(0, 10) < tu) return;
      var doi = false;
      DICH_TRUONG.forEach(function (k) {
        if (n >= max || DICH_LOI || !thieu(x, k)) return;
        n++; var d = dichChu(x[k[0]]); if (d) { x[k[1]] = d; doi = true; }
      });
      x.nhatKy.forEach(function (e) {
        if (n >= max || DICH_LOI || DICH_GC.indexOf(e.b) < 0 || !thieu(e, ['gc', 'gcDich'])) return;
        n++; var d = dichChu(e.gc); if (d) { e.gcDich = d; doi = true; }
      });
      if (doi) { capNhatTieuDe('CongViec'); suaDong('CongViec', x._r, cvThanhDong(x)); }
    });
    docViecLap().forEach(function (v) {
      var doi = false;
      DICH_TRUONG.slice(0, 2).forEach(function (k) {
        if (n >= max || DICH_LOI || !thieu(v, k)) return;
        n++; var d = dichChu(v[k[0]]); if (d) { v[k[1]] = d; doi = true; }
      });
      if (doi) { capNhatTieuDe('ViecLap'); suaDong('ViecLap', v._r, vlThanhDong(v)); }
    });
    if (!DICH_LOI && n < max) ps.deleteProperty('DICH_THIEU');     // đã dịch hết
    return n;
  } finally { lock.releaseLock(); }
}
// Chạy tay trong trình soạn Apps Script để thử dịch (lần đầu Google có thể hỏi cấp quyền)
function thuDich() { return LanguageApp.translate('Thay bóng đèn xưởng 2', 'vi', 'zh-CN') + ' | ' + LanguageApp.translate('更换水泵密封圈', 'zh-CN', 'vi'); }
// Chạy tay để dịch mọi việc còn thiếu bản dịch (vd sau khi Google hết hạn mức nhiều ngày)
function dichLaiTatCa() { PropertiesService.getScriptProperties().setProperty('DICH_THIEU', thoiGianStr()); return dichBu(400, true); }

// ===================== Công việc (giao việc) =====================
var CV_LOAI = { SUA: 1, VS: 0, LAP: 1, CT: 1, HT: 0, BD: 0, KHAC: 1 };   // 1 = mặc định cần Quản lý kiểm tra khi xong
var CV_UU = ['GAP', 'CAO', 'TB'];
var CV_MO = ['CHO_GIAO', 'DA_GIAO', 'DANG_LAM', 'TAM_HOAN'];
var TEN_TT_CV = { CHO_GIAO: 'Chờ giao · 待派工', DA_GIAO: 'Đã giao · 已派工', DANG_LAM: 'Đang làm · 进行中', TAM_HOAN: 'Tạm hoãn · 暂停',
  XONG: 'Xong, chờ kiểm tra · 已完成待检查', DONG: 'Đã xong · 已完成', HUY: 'Đã huỷ · 已取消' };
var CV_KHOA = ['id', 'so', 'tieuDe', 'moTa', 'loai', 'uuTien', 'ma', 'han', 'trangThai', 'uidLam', 'nguoiLam', 'uidPhu',
  'nguoiGiao', 'uidGiao', 'lucGiao', 'nguoiTao', 'uidTao', 'lucTao', 'lucBatDau', 'lucXong', 'ketQua', 'linhKien',
  'anhTao', 'anhXong', 'canKiemTra', 'nguoiKiemTra', 'lucKiemTra', 'lapLai', 'opId', 'capNhat', 'nhatKy', 'nguyenNhan', 'phutDung',
  'tieuDeDich', 'moTaDich', 'ketQuaDich', 'nguyenNhanDich'];
var VL_KHOA = ['id', 'tieuDe', 'moTa', 'loai', 'uuTien', 'ma', 'kieu', 'ngay', 'uidLam', 'canKiemTra', 'hoatDong', 'taoDen', 'nguoiTao', 'capNhat',
  'tieuDeDich', 'moTaDich'];
var CV_JSON = { uidPhu: 1, linhKien: 1, anhTao: 1, anhXong: 1, nhatKy: 1 };
var CV_BOOL = { canKiemTra: 1, hoatDong: 1 };
var CV_NGAY = { han: 1, taoDen: 1 };
function obTuDong(khoa, r, i) {
  var o = { _r: i + 2 };
  khoa.forEach(function (k, j) {
    var v = r[j];
    if (CV_JSON[k]) o[k] = docJson(v, []);
    else if (CV_BOOL[k]) o[k] = s(v) !== '' && hd(v);
    else if (CV_NGAY[k]) o[k] = ngayStr(v);
    else if (k === 'so') o[k] = Math.round(Number(v)) || 0;
    else if (k === 'phutDung') o[k] = s(v) === '' ? '' : Math.round(Number(v)) || 0;
    else o[k] = v instanceof Date ? tgStr(v) : s(v);
  });
  return o;
}
function obThanhDong(khoa, x) {
  return khoa.map(function (k) {
    var v = x[k];
    if (CV_JSON[k]) return v && v.length ? (k === 'nhatKy' ? catJson(v) : JSON.stringify(v)) : '';
    if (CV_BOOL[k]) return v ? 1 : 0;
    if (v === undefined || v === null) return '';
    return typeof v === 'string' ? anToan(v) : v;
  });
}
function cvThanhDong(x) { return obThanhDong(CV_KHOA, x); }
function vlThanhDong(x) { return obThanhDong(VL_KHOA, x); }
function docCongViec() { return docTho('CongViec').map(function (r, i) { return obTuDong(CV_KHOA, r, i); }).filter(function (x) { return x.id; }); }
function docViecLap() { return docTho('ViecLap').map(function (r, i) { return obTuDong(VL_KHOA, r, i); }).filter(function (x) { return x.id; }); }
function sachCV(x) { var o = {}; Object.keys(x).forEach(function (k) { if (k !== '_r') o[k] = x[k]; }); return o; }
function timNV(id, ds) {
  id = s(id); if (!id) return null;
  return (ds || dsNguoiDung()).filter(function (n) { return n.id === id && n.hoatDong; })[0] || null;
}
function soLonNhat(ds) { var so = 0; ds.forEach(function (x) { if (x.so > so) so = x.so; }); return so; }
function idCV(v, tien) { v = s(v).toUpperCase(); return new RegExp('^' + tien + '[A-Z0-9]{6,30}$').test(v) ? v : ''; }
// Đọc các trường chung của việc / việc lặp lại từ yêu cầu
function cvTruong(p, nvs) {
  var tieuDe = catChu(p.tieuDe, 200);
  if (!tieuDe) throw loi('CAN_TIEU_DE', 'Cần ghi tên việc · 请填写工作名称');
  var ma = s(p.ma).toUpperCase();
  if (ma && !timMay(ma)) throw loi('KHONG_CO_MAY', 'Không tìm thấy máy · 找不到设备');
  var lam = s(p.uidLam) ? timNV(p.uidLam, nvs) : null;
  if (s(p.uidLam) && !lam) throw loi('KHONG_CO_NV', 'Không tìm thấy nhân viên · 找不到员工');
  var phu = [];
  (Array.isArray(p.uidPhu) ? p.uidPhu : []).forEach(function (id) {
    var n = timNV(id, nvs);
    if (n && (!lam || n.id !== lam.id) && phu.indexOf(n) < 0 && phu.length < 5) phu.push(n);
  });
  var loai = CV_LOAI.hasOwnProperty(p.loai) ? p.loai : 'KHAC', uu = CV_UU.indexOf(p.uuTien) >= 0 ? p.uuTien : 'TB';
  return { tieuDe: tieuDe, moTa: catNhieuDong(p.moTa, 1000).trim(), loai: loai, uuTien: uu, ma: ma, lam: lam, phu: phu,
    canKiemTra: p.canKiemTra === undefined || p.canKiemTra === null ? !!CV_LOAI[loai] || uu === 'GAP' : !!p.canKiemTra };
}
function giaoCho(x, lam, phu, u, bay, op) {
  x.uidLam = lam.id; x.nguoiLam = lam.ten; x.uidPhu = phu.map(function (n) { return n.id; });
  x.nguoiGiao = u.ten; x.uidGiao = u.id; x.lucGiao = bay;
  if (x.trangThai === 'CHO_GIAO') x.trangThai = 'DA_GIAO';
  x.nhatKy.push({ b: 'giao', luc: bay, uid: u.id, nguoi: u.ten, gc: lam.ten + (phu.length ? ' + ' + phu.map(function (n) { return n.ten; }).join(', ') : ''), op: op || '' });
}

// Ghi việc mới hoặc sửa việc. Kỹ thuật ghi việc → "Chờ giao"; Quản lý ghi kèm người làm → "Đã giao".
function luuCongViec(u, p, opId) {
  var ds = docCongViec(), id = s(p.id).toUpperCase();
  if (opId) {
    var cu = ds.filter(function (r) { return r.opId === opId || r.nhatKy.some(function (n) { return n.op === opId; }); })[0];
    if (cu) return { dup: true, congViec: sachCV(cu) };
  }
  var x = id ? ds.filter(function (r) { return r.id === id; })[0] : null;
  var quanLy = coQuyen(u, 'giaoviec'), nvs = dsNguoiDung(), f = cvTruong(p, nvs), bay = thoiGianStr();
  var han = s(p.han) ? ngayStr(p.han) : '';
  if (han && !hopLeNgay(han)) throw loi('NGAY_SAI', 'Ngày không hợp lệ · 日期无效');
  capNhatTieuDe('CongViec');
  if (!x) {
    id = idCV(id, 'CV') || 'CV' + Utilities.formatDate(bayGio(), TZ, 'yyMMddHHmmss') + Math.floor(100 + Math.random() * 900);
    // Bản dịch gửi kèm (vd app điền sẵn khi giao bảo dưỡng máy có tên tiếng Trung) thì dùng luôn, không thì tự dịch
    var so = soLonNhat(ds) + 1, td = dichKhiSua(f.tieuDe, '', '', p.tieuDeDich), mt = dichKhiSua(f.moTa, '', '', p.moTaDich);
    x = { id: id, so: so, tieuDe: td[0], tieuDeDich: td[1], moTa: mt[0], moTaDich: mt[1], ketQuaDich: '', nguyenNhanDich: '',
      loai: f.loai, uuTien: f.uuTien, ma: f.ma, han: han, trangThai: 'CHO_GIAO',
      uidLam: '', nguoiLam: '', uidPhu: [], nguoiGiao: '', uidGiao: '', lucGiao: '', nguoiTao: u.ten, uidTao: u.id, lucTao: bay,
      lucBatDau: '', lucXong: '', ketQua: '', linhKien: [], anhTao: anhSC(p.anh, 'cv' + so, 'TRUOC'), anhXong: [],
      canKiemTra: f.canKiemTra, nguoiKiemTra: '', lucKiemTra: '', lapLai: '', opId: opId, capNhat: bay, nguyenNhan: '', phutDung: '',
      nhatKy: [{ b: 'tao', luc: bay, uid: u.id, nguoi: u.ten, gc: '', op: opId }] };
    // Kỹ thuật tự ghi việc mình làm (vd máy hỏng, sửa luôn): giao cho chính mình
    if (!quanLy && p.tuLam) { var minh = timNV(u.id, nvs); if (minh) { f.lam = minh; f.phu = []; quanLy = true; } }
    if (f.lam && quanLy) {
      giaoCho(x, f.lam, f.phu, u, bay, '');
      TIN_CHO.push({ loai: 'giao', ds: [x], lam: f.lam, phu: f.phu, boi: u.ten });
    }
    themDong('CongViec', cvThanhDong(x));
    return { congViec: sachCV(x) };
  }
  if (x.trangThai === 'DONG' || x.trangThai === 'HUY') throw loiDL('SAI_TRANG_THAI', TEN_TT_CV[x.trangThai], { congViec: sachCV(x) });
  if (!quanLy && !(x.uidTao === u.id && x.trangThai === 'CHO_GIAO')) throw loi('KHONG_QUYEN', 'Không có quyền · 无权限');
  var truoc = { tieuDe: x.tieuDe, han: x.han, uidLam: x.uidLam, uuTien: x.uuTien };
  var td = dichKhiSua(f.tieuDe, x.tieuDe, x.tieuDeDich, p.tieuDeDich), mt = dichKhiSua(f.moTa, x.moTa, x.moTaDich, p.moTaDich);
  ['loai', 'uuTien', 'ma', 'canKiemTra'].forEach(function (k) { x[k] = f[k]; });
  x.tieuDe = td[0]; x.tieuDeDich = td[1]; x.moTa = mt[0]; x.moTaDich = mt[1];
  x.han = han;
  x.anhTao = x.anhTao.concat(anhSC(p.anh, 'cv' + x.so, 'TRUOC')).slice(0, SC_ANH_TOI_DA);
  x.nhatKy.push({ b: 'sua', luc: bay, uid: u.id, nguoi: u.ten, gc: '', op: opId });
  if (quanLy && p.uidLam !== undefined) {
    if (f.lam && (f.lam.id !== x.uidLam || f.phu.map(function (n) { return n.id; }).join() !== x.uidPhu.join())) {
      giaoCho(x, f.lam, f.phu, u, bay, '');
      TIN_CHO.push({ loai: 'giao', ds: [x], lam: f.lam, phu: f.phu, boi: u.ten });
    } else if (!f.lam && x.uidLam && x.trangThai === 'DA_GIAO') {
      x.uidLam = ''; x.nguoiLam = ''; x.uidPhu = []; x.trangThai = 'CHO_GIAO';
    }
  }
  x.capNhat = bay;
  suaDong('CongViec', x._r, cvThanhDong(x));
  if (truoc.uidLam !== x.uidLam || truoc.han !== x.han) ghiNhatKy(u, 'sua', 'CongViec', x.id, truoc, { tieuDe: x.tieuDe, han: x.han, uidLam: x.uidLam, uuTien: x.uuTien }, '');
  return { congViec: sachCV(x) };
}

// Giao nhiều việc cho một người (Quản lý). Giao lại việc đang làm cũng được.
function giaoNhieuViec(u, p, opId) {
  var ids = (Array.isArray(p.ids) ? p.ids : []).map(function (v) { return s(v).toUpperCase(); }).slice(0, 60);
  if (!ids.length) throw loi('KHONG_CO', 'Chưa chọn việc · 未选择工作');
  var ds = docCongViec(), nvs = dsNguoiDung();
  var lam = timNV(p.uidLam, nvs);
  if (!lam) throw loi('KHONG_CO_NV', 'Chọn người làm · 请选择执行人');
  var chon = ds.filter(function (x) { return ids.indexOf(x.id) >= 0; });
  if (opId && chon.length && chon.every(function (x) { return x.nhatKy.some(function (n) { return n.op === opId; }); })) return { dup: true, dsCongViec: chon.map(sachCV) };
  var phu = cvTruong({ tieuDe: '-', uidLam: lam.id, uidPhu: p.uidPhu }, nvs).phu;
  var han = s(p.han) ? ngayStr(p.han) : '';
  if (han && !hopLeNgay(han)) throw loi('NGAY_SAI', 'Ngày không hợp lệ · 日期无效');
  capNhatTieuDe('CongViec');
  var bay = thoiGianStr(), out = [];
  chon.forEach(function (x) {
    if (CV_MO.indexOf(x.trangThai) < 0) return;
    if (han) x.han = han;
    giaoCho(x, lam, phu, u, bay, opId);
    x.capNhat = bay;
    suaDong('CongViec', x._r, cvThanhDong(x));
    out.push(x);
  });
  if (out.length) TIN_CHO.push({ loai: 'giao', ds: out, lam: lam, phu: phu, boi: u.ten });
  return { dsCongViec: out.map(sachCV) };
}

// Các bước: batdau · hoan (tạm hoãn) · xong · kiemtra / tralai (Quản lý) · huy · giao (giao một việc)
function capNhatCongViec(u, p, opId) {
  var ds = docCongViec(), id = s(p.id).toUpperCase();
  var x = ds.filter(function (r) { return r.id === id; })[0];
  if (!x) throw loi('KHONG_CO', 'Không tìm thấy việc · 找不到工作');
  if (opId && x.nhatKy.some(function (n) { return n.op === opId; })) return { dup: true, congViec: sachCV(x) };
  var b = s(p.buoc), bay = thoiGianStr(), gc = catChu(p.ghiChu, 300), tra = {};
  var quanLy = coQuyen(u, 'giaoviec'), laNguoiLam = x.uidLam === u.id || x.uidPhu.indexOf(u.id) >= 0;
  function phai(tt) {
    if (tt.indexOf(x.trangThai) < 0) throw loiDL('SAI_TRANG_THAI', TEN_TT_CV[x.trangThai] || x.trangThai, { congViec: sachCV(x) });
  }
  function canLam() { if (!laNguoiLam && !quanLy) throw loi('KHONG_QUYEN', 'Việc này giao cho người khác · 此工作已派给他人'); }
  capNhatTieuDe('CongViec');
  if (b === 'batdau') {
    canLam(); phai(['DA_GIAO', 'TAM_HOAN']);
    x.trangThai = 'DANG_LAM';
    if (!x.lucBatDau) x.lucBatDau = bay;
  } else if (b === 'hoan') {
    canLam(); phai(['DA_GIAO', 'DANG_LAM']);
    if (!gc) throw loi('CAN_LY_DO', 'Cần ghi lý do tạm hoãn · 请填写暂停原因');
    x.trangThai = 'TAM_HOAN';
  } else if (b === 'xong') {
    canLam(); phai(['DA_GIAO', 'DANG_LAM', 'TAM_HOAN']);
    var kq = catNhieuDong(p.ketQua, 1000).trim();
    if (!kq) throw loi('CAN_KET_QUA', 'Cần ghi kết quả · 请填写工作结果');
    var lucXong = scKiemTG(p.lucXong, bay);
    var ct = sachChiTiet({ lk: p.linhKien }), lk = ct ? ct.lk : [];
    var m = x.ma ? timMay(x.ma) : null;
    var gan = m ? ganLKDaDung(m, lk, u, lucXong.slice(0, 10), 'Thêm khi làm việc · 工作时添加') : { kho: null, doiMay: false };
    if (!m && lk.length) { var kho = khoNap(); ganKho(lk, 'Dùng cho việc #' + x.so + ' · ' + u.ten, kho); gan.kho = kho; }
    var kqD = songNgu(kq), nnD = songNgu(catChu(p.nguyenNhan, 300));
    x.ketQua = kqD[0]; x.ketQuaDich = kqD[1]; x.nguyenNhan = nnD[0]; x.nguyenNhanDich = nnD[1];
    x.linhKien = lk; x.lucXong = lucXong; x.anhXong = anhSC(p.anh, 'cv' + x.so, 'SAU');
    var gio = soHoacRong(p.gioDung);
    x.phutDung = gio !== '' && gio >= 0 && gio <= 24 * 60 ? Math.round(gio * 60) : '';
    if (!x.lucBatDau) x.lucBatDau = lucXong;
    if (x.canKiemTra && !quanLy) x.trangThai = 'XONG';
    else { x.trangThai = 'DONG'; if (x.canKiemTra) { x.nguoiKiemTra = u.ten; x.lucKiemTra = bay; } }
    if (gan.doiMay) { m.capNhat = bay; suaDong('May', m._r, mayThanhDong(m)); tra.may = sachMay(m); }
    if (gan.kho) tra.kho = khoLuuMoi(gan.kho);
  } else if (b === 'kiemtra') {
    canQuyen(u, 'giaoviec'); phai(['XONG']);
    x.trangThai = 'DONG'; x.nguoiKiemTra = u.ten; x.lucKiemTra = bay;
  } else if (b === 'tralai') {
    canQuyen(u, 'giaoviec'); phai(['XONG']);
    if (!gc) throw loi('CAN_LY_DO', 'Cần ghi lý do trả lại · 请填写退回原因');
    x.trangThai = 'DANG_LAM';
  } else if (b === 'giao') {
    canQuyen(u, 'giaoviec'); phai(CV_MO);
    var nvs = dsNguoiDung(), f = cvTruong({ tieuDe: '-', uidLam: p.uidLam, uidPhu: p.uidPhu }, nvs);
    if (!f.lam) throw loi('KHONG_CO_NV', 'Chọn người làm · 请选择执行人');
    giaoCho(x, f.lam, f.phu, u, bay, opId);
    TIN_CHO.push({ loai: 'giao', ds: [x], lam: f.lam, phu: f.phu, boi: u.ten });
    x.capNhat = bay;
    suaDong('CongViec', x._r, cvThanhDong(x));
    return { congViec: sachCV(x) };
  } else if (b === 'huy') {
    var cuaMinh = x.uidTao === u.id && x.trangThai === 'CHO_GIAO';
    if (!cuaMinh && !quanLy) throw loi('KHONG_QUYEN', 'Không có quyền · 无权限');
    phai(CV_MO.concat(['XONG']));
    if (!gc && !cuaMinh) throw loi('CAN_LY_DO', 'Cần ghi lý do huỷ · 请填写取消原因');
    ghiNhatKy(u, 'huy', 'CongViec', x.id, { trangThai: x.trangThai, tieuDe: x.tieuDe }, { trangThai: 'HUY' }, gc);
    x.trangThai = 'HUY';
  } else {
    throw loi('KHONG_HIEU', 'Bước không hợp lệ: ' + b);
  }
  x.capNhat = bay;
  var gcD = gc && DICH_GC.indexOf(b) >= 0 ? songNgu(gc) : [gc, ''];
  x.nhatKy.push({ b: b, luc: bay, uid: u.id, nguoi: u.ten, gc: gcD[0], gcDich: gcD[1], op: opId });
  if (b === 'xong' && x.trangThai === 'DONG' && x.canKiemTra) x.nhatKy.push({ b: 'kiemtra', luc: bay, uid: u.id, nguoi: u.ten, gc: '', op: '' });
  suaDong('CongViec', x._r, cvThanhDong(x));
  tra.congViec = sachCV(x);
  return tra;
}

// ----- Việc lặp lại -----
function ngayKhop(vl, d) {
  if (vl.kieu === 'ngay') return true;
  var so = s(vl.ngay).split(',').map(function (v) { return Math.round(Number(v)); });
  if (vl.kieu === 'tuan') return so.indexOf(new Date(d + 'T00:00:00Z').getUTCDay()) >= 0;
  var day = +d.slice(8, 10), cuoi = cuoiThang(+d.slice(0, 4), +d.slice(5, 7));
  return so.some(function (n) { return n === day || (n > cuoi && day === cuoi); });
}
// Sinh việc từ một mẫu lặp lại cho các ngày (TaoDen, hôm nay], bù tối đa 7 ngày. Mã việc cố định theo mẫu + ngày nên không tạo trùng.
function taoTuMau(vl, homNay, cvs, nvs) {
  var tu = congNgay(vl.taoDen || congNgay(homNay, -1), 1), min = congNgay(homNay, -6), out = [], so = soLonNhat(cvs), bay = thoiGianStr();
  if (tu < min) tu = min;
  var lam = timNV(vl.uidLam, nvs);
  for (var d = tu, g = 0; d <= homNay && g < 40; d = congNgay(d, 1), g++) {
    if (!ngayKhop(vl, d)) continue;
    var id = 'CVL' + vl.id.replace(/[^A-Za-z0-9]/g, '').toUpperCase() + d.replace(/-/g, '');
    if (cvs.some(function (x) { return x.id === id; })) continue;
    so++;
    var x = { id: id, so: so, tieuDe: vl.tieuDe, tieuDeDich: vl.tieuDeDich || '', moTa: vl.moTa, moTaDich: vl.moTaDich || '',
      ketQuaDich: '', nguyenNhanDich: '', loai: vl.loai, uuTien: vl.uuTien, ma: vl.ma, han: d, trangThai: 'CHO_GIAO',
      uidLam: '', nguoiLam: '', uidPhu: [], nguoiGiao: '', uidGiao: '', lucGiao: '', nguoiTao: vl.nguoiTao, uidTao: '', lucTao: bay,
      lucBatDau: '', lucXong: '', ketQua: '', linhKien: [], anhTao: [], anhXong: [], canKiemTra: vl.canKiemTra, nguoiKiemTra: '', lucKiemTra: '',
      lapLai: vl.id, opId: '', capNhat: bay, nguyenNhan: '', phutDung: '', nhatKy: [{ b: 'lap', luc: bay, uid: '', nguoi: vl.nguoiTao, gc: '', op: '' }] };
    if (lam) giaoCho(x, lam, [], { id: '', ten: vl.nguoiTao }, bay, '');
    cvs.push(x); out.push(x);
  }
  if (out.length) { capNhatTieuDe('CongViec'); themNhieu('CongViec', out.map(cvThanhDong)); }
  vl.taoDen = homNay;
  suaDong('ViecLap', vl._r, vlThanhDong(vl));
  return out;
}
function taoViecLap(coLock) {
  var homNay = homNayStr();
  if (!docViecLap().some(function (v) { return v.hoatDong && v.taoDen < homNay; })) return [];
  var lock = null;
  if (!coLock) { lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return []; }
  try {
    var cvs = docCongViec(), nvs = dsNguoiDung(), out = [];
    capNhatTieuDe('ViecLap');
    docViecLap().forEach(function (v) { if (v.hoatDong && v.taoDen < homNay) out = out.concat(taoTuMau(v, homNay, cvs, nvs)); });
    return out;
  } finally { if (lock) lock.releaseLock(); }
}
function luuViecLap(u, p) {
  var ds = docViecLap(), id = s(p.id), x = id ? ds.filter(function (r) { return r.id === id; })[0] : null;
  var nvs = dsNguoiDung(), f = cvTruong(p, nvs), homNay = homNayStr(), bay = thoiGianStr();
  var kieu = ['ngay', 'tuan', 'thang'].indexOf(p.kieu) >= 0 ? p.kieu : 'tuan', ngay = '';
  if (kieu !== 'ngay') {
    var max = kieu === 'tuan' ? 6 : 31, min = kieu === 'tuan' ? 0 : 1, so = [];
    String(p.ngay === undefined ? '' : p.ngay).split(/[,;\s]+/).forEach(function (v) {
      if (v === '') return;
      var n = Math.round(Number(v)); if (n >= min && n <= max && so.indexOf(n) < 0) so.push(n);
    });
    if (!so.length) throw loi('CAN_NGAY_LAP', 'Chọn ngày lặp lại · 请选择重复日期');
    ngay = so.sort(function (a, b) { return a - b; }).join(',');
  }
  capNhatTieuDe('ViecLap');
  var td = x ? dichKhiSua(f.tieuDe, x.tieuDe, x.tieuDeDich, p.tieuDeDich) : songNgu(f.tieuDe);
  var mt = x ? dichKhiSua(f.moTa, x.moTa, x.moTaDich, p.moTaDich) : songNgu(f.moTa);
  var o = { tieuDe: td[0], tieuDeDich: td[1], moTa: mt[0], moTaDich: mt[1], loai: f.loai, uuTien: f.uuTien, ma: f.ma, kieu: kieu, ngay: ngay, uidLam: f.lam ? f.lam.id : '',
    canKiemTra: f.canKiemTra, hoatDong: p.hoatDong !== false, capNhat: bay };
  if (!x) {
    x = Object.assign({ id: 'VL' + Utilities.formatDate(bayGio(), TZ, 'yyMMddHHmmss') + Math.floor(10 + Math.random() * 90), taoDen: congNgay(homNay, -1), nguoiTao: u.ten }, o);
    themDong('ViecLap', vlThanhDong(x));
    x = docViecLap().filter(function (r) { return r.id === x.id; })[0];
  } else {
    var batLai = !x.hoatDong && o.hoatDong;
    Object.keys(o).forEach(function (k) { x[k] = o[k]; });
    if (batLai) x.taoDen = congNgay(homNay, -1);      // bật lại: không sinh bù những ngày đã tắt
    suaDong('ViecLap', x._r, vlThanhDong(x));
  }
  var moi = x.hoatDong && x.taoDen < homNay ? taoTuMau(x, homNay, docCongViec(), nvs) : [];
  return { viecLap: sachCV(x), dsCongViec: moi.map(sachCV) };
}

// ===================== Danh mục máy =====================
function luuMay(u, p) {
  var ten = catChu(p.ten, 120);
  if (!ten) throw loi('THIEU_TEN', 'Chưa nhập tên · 请输入名称');
  var chuKy = Math.round(Number(p.chuKy));
  if (!(chuKy >= 1 && chuKy <= 3650)) throw loi('CHU_KY_SAI', 'Chu kỳ 1–3650 ngày');
  var han = ngayStr(p.hanKeTiep);
  if (!hopLeNgay(han)) throw loi('NGAY_SAI', 'Ngày không hợp lệ · 日期无效');
  var ds = dsMay(), m = null;
  if (p.ma) {
    m = ds.filter(function (x) { return x.ma === s(p.ma).toUpperCase(); })[0];
    if (!m) throw loi('KHONG_CO_MAY', 'Không tìm thấy máy · 找不到设备');
  }
  var hoatDong = p.hoatDong !== false;
  var trung = ds.filter(function (x) {
    return x.hoatDong && x.ten.toLowerCase() === ten.toLowerCase() && (!m || x.ma !== m.ma);
  })[0];
  if (trung && hoatDong) throw loi('TEN_TRUNG', trung.ma);
  var moi = !m;
  capNhatTieuDe('May');
  if (moi) m = { ma: maMoi(ds), hangMuc: [], linhKien: [] };
  m.ten = ten; m.tenPhu = catChu(p.tenPhu, 120); m.nhom = catChu(p.nhom, 60); m.viTri = catChu(p.viTri, 120);
  m.chuKy = chuKy; m.hanKeTiep = han; m.noiDung = catNhieuDong(p.noiDung, 1000); m.hoatDong = hoatDong;
  if (p.phuTrach !== undefined) m.phuTrach = catChu(p.phuTrach, 120);
  if (p.ngayDuaVao !== undefined) { var nd = ngayStr(p.ngayDuaVao); m.ngayDuaVao = hopLeNgay(nd) ? nd : ''; }
  if (p.chuyen !== undefined) {
    var ch = s(p.chuyen).toUpperCase();
    if (ch && !dsChuyen().some(function (c) { return c.ma === ch; })) throw loi('KHONG_CO_CHUYEN', 'Không tìm thấy chuyền · 找不到产线');
    m.chuyen = ch;
  }
  m.capNhat = thoiGianStr();
  if (moi) themDong('May', mayThanhDong(m)); else suaDong('May', m._r, mayThanhDong(m));
  return { may: sachMay(m), moi: moi };
}
// ===================== Mục kiểm tra, linh kiện của máy =====================
// HangMuc: [{id, ten, kieu: 'OK' (Đạt/Lỗi) | 'SO' (số đo), dv, min, max}]
// LinhKien: [{id, ten, quyCach, dv, sl (số lượng lắp trên máy), ghiChu, anh (id file Drive), maKho (mã ERP),
//             viTriMay (vị trí lắp trên máy), mucDo (thap | tb | cao: mức độ quan trọng)}]
// LichSu.ChiTiet: {kt: [{id, ten, kq: DAT|LOI, gc}], so: [{id, ten, v, dv, min, max, vuot}], lk: [{id, ten, quyCach, dv, sl, loai: THAY|BOSUNG}], anh: [{loai: TRUOC|SAU, id, ten}]}
// ===================== ẢNH ĐÍNH KÈM · 附件照片 =====================
// Ảnh lưu trên Google Drive (folder LichBaoDuong_Anh trong Drive của chủ sheet), để riêng tư.
// Trong sheet chỉ lưu id file. Nếu Drive lỗi: fallback lưu base64 đã nén (cờ b64=1).
var ANH_FOLDER_KEY = 'ANH_FOLDER_ID';
var ANH_TOI_DA_CT = 8;
function anhFolder() {
  var ps = PropertiesService.getScriptProperties();
  var id = ps.getProperty(ANH_FOLDER_KEY);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* id cũ hết hiệu lực → tạo lại */ } }
  var f = DriveApp.createFolder('LichBaoDuong_Anh');
  ps.setProperty(ANH_FOLDER_KEY, f.getId());
  return f;
}
// dataUrl = 'data:image/jpeg;base64,....' ; trả về {id, ten} hoặc null nếu lỗi
function luuAnhDrive(dataUrl, ten) {
  try {
    var p = String(dataUrl || '').split(',');
    if (p.length < 2) return null;
    var bytes = Utilities.base64Decode(p[1]);
    if (!bytes || bytes.length < 100) return null;
    var blob = Utilities.newBlob(bytes, 'image/jpeg', ten);
    // Ảnh để RIÊNG TƯ (không chia sẻ link). App xem ảnh qua máy chủ (hành động 'photo'), cần đăng nhập.
    var file = anhFolder().createFile(blob);
    return { id: file.getId(), ten: ten };
  } catch (e) {
    return null;
  }
}
// Chuẩn hoá mảng ảnh: [{loai, data|id, ten}] → [{loai, id, ten}] (hoặc fallback data cắt nhỏ)
function sachAnh(anh, tenGoc) {
  var out = [];
  (Array.isArray(anh) ? anh : []).slice(0, ANH_TOI_DA_CT).forEach(function (a, i) {
    if (!a) return;
    var loai = a.loai === 'SAU' ? 'SAU' : 'TRUOC';
    var ten = (tenGoc || 'anh') + '_' + (i + 1) + '_' + loai + '.jpg';
    if (a.data && String(a.data).indexOf('data:') === 0) {
      var r = luuAnhDrive(a.data, ten);
      if (r) out.push({ loai: loai, id: r.id, ten: ten });
      else {
        var d = String(a.data); if (d.length > 18000) d = d.slice(0, 18000);
        out.push({ loai: loai, data: d, ten: ten, b64: 1 });
      }
    } else if (a.id) {
      out.push({ loai: loai, id: String(a.id).slice(0, 80), ten: ten });
    }
  });
  return out;
}
var TOI_DA_DS = 60;
function idHopLe(v, tien) {
  v = s(v);
  return /^[A-Za-z0-9_-]{1,24}$/.test(v) ? v : tien + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}
function soHoacRong(v) {
  if (v === '' || v === null || v === undefined) return '';
  var x = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(x) ? x : '';
}
function sachHangMuc(ds) {
  var out = [], thay = {};
  (Array.isArray(ds) ? ds : []).slice(0, TOI_DA_DS).forEach(function (h) {
    if (!h) return;
    var ten = catChu(h.ten, 120);
    if (!ten) return;
    var id = idHopLe(h.id, 'HM');
    if (thay[id]) id = idHopLe('', 'HM');
    thay[id] = 1;
    var o = { id: id, ten: ten, kieu: h.kieu === 'SO' ? 'SO' : 'OK' };
    if (o.kieu === 'SO') { o.dv = catChu(h.dv, 12); o.min = soHoacRong(h.min); o.max = soHoacRong(h.max); }
    out.push(o);
  });
  return out;
}
function sachLinhKien(ds) {
  var out = [], thay = {};
  (Array.isArray(ds) ? ds : []).slice(0, TOI_DA_DS).forEach(function (k) {
    if (!k) return;
    var ten = catChu(k.ten, 120);
    if (!ten) return;
    var id = idHopLe(k.id, 'LK');
    if (thay[id]) id = idHopLe('', 'LK');
    thay[id] = 1;
    var sl = soHoacRong(k.sl);
    var o = { id: id, ten: ten, quyCach: catChu(k.quyCach, 80), dv: catChu(k.dv, 12), sl: sl !== '' && sl >= 0 ? sl : '', ghiChu: catChu(k.ghiChu, 160) };
    var mk = maKhoHopLe(k.maKho);
    if (mk) o.maKho = mk;
    var vt = catChu(k.viTriMay, 80);
    if (vt) o.viTriMay = vt;
    if (k.mucDo === 'thap' || k.mucDo === 'tb' || k.mucDo === 'cao') o.mucDo = k.mucDo;
    var anhId = '';
    if (k.anhData && String(k.anhData).indexOf('data:') === 0) {
      var ra = luuAnhDrive(k.anhData, 'lk_' + id + '.jpg');
      if (ra) anhId = ra.id;
    } else if (k.anh && String(k.anh).indexOf('data:') !== 0) {
      anhId = String(k.anh).slice(0, 80);
    }
    if (anhId) o.anh = anhId;
    out.push(o);
  });
  return out;
}
function sachChiTiet(ct) {
  if (!ct || typeof ct !== 'object') return null;
  var kt = [], so = [], lk = [];
  (Array.isArray(ct.kt) ? ct.kt : []).slice(0, 100).forEach(function (h) {
    if (!h || (h.kq !== 'DAT' && h.kq !== 'LOI')) return;
    var ten = catChu(h.ten, 120);
    if (ten) kt.push({ id: idHopLe(h.id, 'HM'), ten: ten, kq: h.kq, gc: catChu(h.gc, 200) });
  });
  (Array.isArray(ct.so) ? ct.so : []).slice(0, 100).forEach(function (h) {
    if (!h) return;
    var ten = catChu(h.ten, 120), v = soHoacRong(h.v);
    if (!ten || v === '') return;
    var mn = soHoacRong(h.min), mx = soHoacRong(h.max);
    so.push({ id: idHopLe(h.id, 'HM'), ten: ten, v: v, dv: catChu(h.dv, 12), min: mn, max: mx,
      vuot: (mn !== '' && v < mn) || (mx !== '' && v > mx) });
  });
  (Array.isArray(ct.lk) ? ct.lk : []).slice(0, 50).forEach(function (k) {
    if (!k) return;
    var ten = catChu(k.ten, 120), sl = soHoacRong(k.sl);
    if (!ten || sl === '' || !(sl > 0) || sl > 1e6) return;
    var o = { id: idHopLe(k.id, 'LK'), ten: ten, quyCach: catChu(k.quyCach, 80), dv: catChu(k.dv, 12), sl: sl, loai: k.loai === 'BOSUNG' ? 'BOSUNG' : 'THAY' };
    var mk = maKhoHopLe(k.maKho);
    if (mk) o.maKho = mk;
    lk.push(o);
  });
  if (!kt.length && !so.length && !lk.length && !(ct.anh && ct.anh.length)) return null;
  var o = { kt: kt, so: so, lk: lk };
  var anh = sachAnh(ct.anh, 'bd');
  if (anh.length) o.anh = anh;
  return o;
}
// Chép danh sách sang máy khác: giữ id cũ của máy đích khi trùng tên (để thống kê không đứt)
function chepTheoTen(nguon, dich, tien) {
  var theo = {}, dung = {};
  (dich || []).forEach(function (x) { theo[s(x.ten).toLowerCase()] = x.id; });
  return nguon.map(function (x) {
    var o = JSON.parse(JSON.stringify(x)), id = theo[s(x.ten).toLowerCase()];
    o.id = id && !dung[id] ? id : (!dung[x.id] ? x.id : idHopLe('', tien));
    dung[o.id] = 1;
    return o;
  });
}
function luuDanhSach(u, p) {
  var ds = dsMay(), m = ds.filter(function (x) { return x.ma === s(p.ma).toUpperCase(); })[0];
  if (!m) throw loi('KHONG_CO_MAY', 'Không tìm thấy máy · 找不到设备');
  capNhatTieuDe('May');
  var hm = p.hangMuc !== undefined ? sachHangMuc(p.hangMuc) : null;
  var lk = p.linhKien !== undefined ? sachLinhKien(p.linhKien) : null;
  var luc = thoiGianStr(), doi = [], kho = null;
  // Linh kiện chưa có trong kho linh kiện: tự thêm vào kho (nguồn APP)
  if (lk && lk.length) { kho = khoNap(); ganKho(lk, ghiChuThem(m.ma, u), kho); }
  function ghi(x, laNguon) {
    if (hm) x.hangMuc = laNguon ? hm : chepTheoTen(hm, x.hangMuc, 'HM');
    if (lk) {
      var moiLK = laNguon ? lk : chepTheoTen(lk, x.linhKien, 'LK');
      ghiNhatKyLienKet(u, x, x.linhKien || [], moiLK);
      x.linhKien = moiLK;
    }
    x.capNhat = luc;
    suaDong('May', x._r, mayThanhDong(x));
    doi.push(sachMay(x));
  }
  ghi(m, true);
  if (p.caNhom && m.nhom) {
    ds.forEach(function (x) { if (x.ma !== m.ma && x.hoatDong && x.nhom === m.nhom) ghi(x, false); });
  }
  return { may: doi[0], dsMay: doi, kho: kho ? khoLuuMoi(kho) : null };
}

// Linh kiện của máy đổi mã ERP (liên kết, bỏ liên kết, đổi sang mã khác): ghi nhật ký, lịch sử dùng giữ nguyên theo id linh kiện
function ghiNhatKyLienKet(u, m, cu, moi) {
  var theoId = {};
  (cu || []).forEach(function (k) { theoId[k.id] = k; });
  (moi || []).forEach(function (k) {
    var c = theoId[k.id];
    if (!c) return;
    var a = c.maKho || '', b = k.maKho || '';
    if (a === b) return;
    ghiNhatKy(u, b ? (a ? 'DOI_MA_ERP' : 'LIEN_KET_ERP') : 'BO_LIEN_KET_ERP', 'May', m.ma + '|' + k.id,
      { maKho: a, ten: c.ten }, { maKho: b, ten: k.ten }, '');
  });
}

function maMoi(ds) {
  var n = 0;
  ds.forEach(function (x) { var k = /^M(\d+)$/.exec(x.ma); if (k) n = Math.max(n, Number(k[1])); });
  var t = String(n + 1); while (t.length < 3) t = '0' + t;
  return 'M' + t;
}

// ===================== Kho linh kiện · 备件库 =====================
// Danh mục linh kiện = file kho tải từ ERP (nhập lại mỗi tuần) + linh kiện gõ tay trong app (tự thêm, nguồn APP).
// KhoLK: Ma, Ten, QuyCach, Dv, Nhom, Ton, ViTri (JSON [[kho, ô, SL]]), Nguon (ERP|APP), ConFile (1: có trong file ERP lần nhập gần nhất),
//        CapNhat, GhiChu, GopVao (linh kiện APP đã gộp vào mã ERP trùng tên + quy cách), An (1: ẩn khỏi danh sách tìm),
//        TonMin (tồn tối thiểu: lấy từ cột 安全库存 / tồn tối thiểu của file ERP, hoặc Quản lý nhập trong app)
// Linh kiện của máy và linh kiện đã thay trong LichSu.ChiTiet gắn với kho qua trường maKho.
var KHO_META = 'KHO_META';
var KHO_TOI_DA = 20000;
function maKhoHopLe(v) { v = s(v); return v && v.length <= 40 && !/[\s"'<>]/.test(v) ? v : ''; }
function boDau(v) {
  var t = s(v).toLowerCase();
  try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* không có normalize */ }
  return t.replace(/đ/g, 'd').replace(/\s+/g, '');
}
function khoaLK(ten, qc) { return boDau(ten) + '|' + boDau(qc); }
function khoTuDong(r, i) {
  var ton = s(r[5]);
  return {
    ma: s(r[0]), ten: s(r[1]), qc: s(r[2]), dv: s(r[3]), nh: s(r[4]), ton: ton === '' ? '' : (Number(ton) || 0),
    vt: docJson(r[6], []), ng: s(r[7]) === 'APP' ? 'APP' : 'ERP', cf: s(r[8]) === '1' ? 1 : 0, cn: tgStr(r[9]),
    gc: s(r[10]), gop: s(r[11]), an: s(r[12]) === '1' ? 1 : 0, tonMin: soHoacRong(r[13]), _r: i + 2
  };
}
function khoThanhDong(x) {
  return [anToan(x.ma), anToan(x.ten), anToan(x.qc), anToan(x.dv), anToan(x.nh), x.ton === '' ? '' : String(x.ton),
    x.vt && x.vt.length ? JSON.stringify(x.vt) : '', x.ng, x.cf ? '1' : '0', x.cn, anToan(x.gc), x.gop || '', x.an ? '1' : '',
    x.tonMin === '' || x.tonMin === undefined ? '' : String(x.tonMin)];
}
// Gửi về máy: bỏ trường trống cho gọn
function sachKho(x) {
  var o = { ma: x.ma, ten: x.ten, ng: x.ng };
  if (x.qc) o.qc = x.qc;
  if (x.dv) o.dv = x.dv;
  if (x.nh) o.nh = x.nh;
  if (x.ton !== '') o.ton = x.ton;
  if (x.vt && x.vt.length) o.vt = x.vt;
  if (x.cf) o.cf = 1;
  if (x.cn) o.cn = x.cn;
  if (x.gc) o.gc = x.gc;
  if (x.gop) o.gop = x.gop;
  if (x.an) o.an = 1;
  if (x.tonMin !== '' && x.tonMin !== undefined) o.tonMin = x.tonMin;
  return o;
}
function docKho() { return docTho('KhoLK').map(khoTuDong).filter(function (x) { return x.ma; }); }
function docKhoMeta() {
  var m = docJson(PropertiesService.getScriptProperties().getProperty(KHO_META), null);
  return m && typeof m === 'object' ? m : { ver: '', n: 0, nhap: null };
}
function ghiKhoMeta(m) { PropertiesService.getScriptProperties().setProperty(KHO_META, JSON.stringify(m)); }
function khoTomTat() { var m = docKhoMeta(); return { ver: m.ver || '', n: m.n || 0, nhap: m.nhap || null }; }
function verMoi() { return Utilities.formatDate(bayGio(), TZ, 'yyyyMMddHHmmss') + Math.floor(100 + Math.random() * 900); }
function khoHien(x) { return !x.an && !x.gop; }
function layKho() {
  var m = docKhoMeta();
  return { ver: m.ver || '', nhap: m.nhap || null, ds: docKho().map(sachKho) };
}
function ghiChuThem(ma, u) { return 'Thêm từ máy · 从设备添加 ' + ma + ' · ' + u.ten + ' · ' + ngayVN(homNayStr()); }

// Nạp kho một lần cho mỗi yêu cầu: tra theo mã và theo tên + quy cách
function khoNap() {
  var c = { all: docKho(), by: {}, khoa: {}, n: 0, moi: [] };
  c.all.forEach(function (x) { c.by[x.ma] = x; var k = /^APP-(\d+)$/.exec(x.ma); if (k) c.n = Math.max(c.n, Number(k[1])); });
  khoLapKhoa(c);
  return c;
}
function khoLapKhoa(c) {
  c.khoa = {};
  c.all.forEach(function (x) {
    if (!khoHien(x)) return;
    var k = khoaLK(x.ten, x.qc), cu = c.khoa[k];
    if (!cu || (cu.ng === 'APP' && x.ng === 'ERP')) c.khoa[k] = x;
  });
}
// ds: [{ten, quyCach, dv, maKho?}] — có mã kho đúng thì giữ (mã đã gộp → mã ERP); chưa có thì tìm theo tên + quy cách;
// không thấy thì thêm linh kiện mới vào kho (nguồn APP, mã APP-0001…)
function ganKho(ds, ghiChu, c) {
  ds.forEach(function (k) {
    var x = k.maKho ? c.by[k.maKho] : null, vong = 0;
    while (x && x.gop && c.by[x.gop] && vong++ < 5) x = c.by[x.gop];
    if (x) { k.maKho = x.ma; return; }
    delete k.maKho;
    var f = c.khoa[khoaLK(k.ten, k.quyCach)];
    if (f) { k.maKho = f.ma; return; }
    c.n++;
    var so = String(c.n); while (so.length < 4) so = '0' + so;
    var it = { ma: 'APP-' + so, ten: k.ten, qc: k.quyCach || '', dv: k.dv || '', nh: '', ton: '', vt: [], ng: 'APP', cf: 0,
      cn: thoiGianStr(), gc: ghiChu, gop: '', an: 0, tonMin: '' };
    c.by[it.ma] = it; c.khoa[khoaLK(it.ten, it.qc)] = it; c.all.push(it); c.moi.push(it);
    k.maKho = it.ma;
  });
}
// Ghi các linh kiện vừa thêm; trả phần thay đổi để app cập nhật danh sách kho đang lưu
function khoLuuMoi(c) {
  if (!c.moi.length) return null;
  capNhatTieuDe('KhoLK');
  themNhieu('KhoLK', c.moi.map(khoThanhDong));
  var meta = docKhoMeta(), truoc = meta.ver || '';
  meta.ver = verMoi(); meta.n = c.all.filter(khoHien).length;
  ghiKhoMeta(meta);
  return { ver: meta.ver, truoc: truoc, n: meta.n, ds: c.moi.map(sachKho) };
}
function sachViTri(vt) {
  var out = [];
  (Array.isArray(vt) ? vt : []).slice(0, 60).forEach(function (v) {
    if (!Array.isArray(v)) return;
    var sl = soHoacRong(v[2]);
    out.push([catChu(v[0], 40), catChu(v[1], 30), sl === '' ? 0 : Math.round(sl * 1000) / 1000]);
  });
  return out;
}
// Nhập file kho ERP (app đã đọc file và gộp theo mã): thêm mã mới, cập nhật tồn / vị trí,
// mã không còn trong file → tồn 0 (không xoá, vì máy và lịch sử còn dùng)
function nhapKho(u, p) {
  var vao = Array.isArray(p.ds) ? p.ds : [];
  if (vao.length > KHO_TOI_DA) throw loi('KHO_NHIEU', 'File quá nhiều dòng · 行数太多 (> ' + KHO_TOI_DA + ')');
  var ds = [], theoMa = {};
  vao.forEach(function (x) {
    if (!x) return;
    var ma = maKhoHopLe(catChu(x.ma, 40).replace(/\s/g, ''));
    if (!ma || /^APP-/i.test(ma)) return;
    var ton = soHoacRong(x.ton); ton = ton === '' ? 0 : Math.round(ton * 1000) / 1000;
    var o = theoMa[ma], mn = soHoacRong(x.tonMin);
    if (o) { o.ton = Math.round((o.ton + ton) * 1000) / 1000; o.vt = o.vt.concat(sachViTri(x.vt)).slice(0, 60); if (mn !== '' && mn >= 0) o.tonMin = mn; return; }
    o = { ma: ma, ten: catChu(x.ten, 160), qc: catChu(x.qc, 200), dv: catChu(x.dv, 12), nh: catChu(x.nh, 20), ton: ton, vt: sachViTri(x.vt),
      tonMin: mn !== '' && mn >= 0 ? mn : undefined };
    if (!o.ten) o.ten = ma;
    theoMa[ma] = o; ds.push(o);
  });
  if (!ds.length) throw loi('KHO_TRONG', 'File không có linh kiện nào · 文件中没有零件');
  capNhatTieuDe('KhoLK');
  var c = khoNap(), luc = thoiGianStr(), soCu = c.all.length;
  var tk = { soMa: ds.length, moi: 0, doiTon: 0, doiTen: 0, het: 0, veLai: 0, gop: 0, giu: 0, themApp: 0 };
  ds.forEach(function (o) {
    var x = c.by[o.ma];
    if (!x) {
      x = { ma: o.ma, ten: o.ten, qc: o.qc, dv: o.dv, nh: o.nh, ton: o.ton, vt: o.vt, ng: 'ERP', cf: 1, cn: luc, gc: '', gop: '', an: 0,
        tonMin: o.tonMin !== undefined ? o.tonMin : '' };
      c.by[o.ma] = x; c.all.push(x); tk.moi++;
      return;
    }
    // File có cột tồn tối thiểu thì lấy theo file; không có thì giữ số Quản lý đã nhập trong app
    if (o.tonMin !== undefined && o.tonMin !== x.tonMin) { x.tonMin = o.tonMin; x.cn = luc; }
    var doiTon = x.ton !== o.ton || JSON.stringify(x.vt) !== JSON.stringify(o.vt);
    var doiTen = x.ten !== o.ten || x.qc !== o.qc || x.dv !== o.dv || x.nh !== o.nh;
    var veLai = !x.cf;
    if (veLai) tk.veLai++; else if (doiTon) tk.doiTon++;
    if (doiTen) tk.doiTen++;
    if (!doiTon && !doiTen && !veLai) { tk.giu++; return; }
    x.ten = o.ten; x.qc = o.qc; x.dv = o.dv; x.nh = o.nh; x.ton = o.ton; x.vt = o.vt; x.ng = 'ERP'; x.cf = 1; x.cn = luc;
  });
  c.all.forEach(function (x) {
    if (x.ng === 'ERP' && x.cf && !theoMa[x.ma]) { x.cf = 0; x.ton = 0; x.vt = []; x.cn = luc; tk.het++; }
  });
  // Linh kiện thêm trong app nay đã có trong file ERP (trùng tên + quy cách): gộp vào mã ERP
  var erpKhoa = {}, gop = {};
  ds.forEach(function (o) { var k = khoaLK(o.ten, o.qc); if (!erpKhoa[k]) erpKhoa[k] = o.ma; });
  c.all.forEach(function (x) {
    if (x.ng !== 'APP' || x.gop) return;
    var t = erpKhoa[khoaLK(x.ten, x.qc)];
    if (t) { x.gop = t; x.cn = luc; gop[x.ma] = t; tk.gop++; }
  });
  khoLapKhoa(c);
  // Cập nhật mã kho trên máy; linh kiện của máy chưa gắn kho thì gắn (hoặc thêm vào kho)
  var dsMayDoi = [];
  dsMay().forEach(function (m) {
    var lk = m.linhKien || [], doi = false;
    lk.forEach(function (k) { if (k.maKho && gop[k.maKho]) { k.maKho = gop[k.maKho]; doi = true; } });
    var chua = lk.filter(function (k) { return !k.maKho || !c.by[k.maKho]; });
    if (chua.length) { ganKho(chua, ghiChuThem(m.ma, u), c); doi = true; }
    if (doi) { m.capNhat = luc; suaDong('May', m._r, mayThanhDong(m)); dsMayDoi.push(sachMay(m)); }
  });
  tk.themApp = c.moi.length;
  // Ghi lại cả trang một lần (nhanh hơn ghi từng dòng)
  var sh = trang('KhoLK'), rows = c.all.map(khoThanhDong), cot = BANG.KhoLK.length;
  var cu = Math.max(soCu, sh.getLastRow() - 1);
  while (rows.length < cu) rows.push(BANG.KhoLK.map(function () { return ''; }));
  if (rows.length + 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows() + 200);
  var dd = dinhDang('KhoLK');
  sh.getRange(2, 1, rows.length, cot).setNumberFormats(rows.map(function () { return dd; })).setValues(rows);
  var meta = docKhoMeta();
  meta.ver = verMoi(); meta.n = c.all.filter(khoHien).length;
  meta.nhap = { luc: luc, file: catChu(p.file, 120), nguoi: u.ten, soDong: Math.round(Number(p.soDong)) || 0,
    soMa: tk.soMa, moi: tk.moi, doiTon: tk.doiTon, het: tk.het, veLai: tk.veLai, gop: tk.gop };
  ghiKhoMeta(meta);
  return { ver: meta.ver, nhap: meta.nhap, tk: tk, ds: c.all.map(sachKho), dsMay: dsMayDoi };
}
// Sửa / ẩn linh kiện thêm trong app (linh kiện từ ERP thì sửa trong ERP rồi nhập lại file)
function luuKho(u, p) {
  var ma = s(p.ma), x = docKho().filter(function (r) { return r.ma === ma; })[0];
  if (!x) throw loi('KHONG_CO', 'Không tìm thấy · 找不到');
  // Tồn tối thiểu đặt được cho mọi linh kiện; tên / quy cách / đơn vị của linh kiện ERP thì sửa trong ERP
  var chiMin = p.tonMin !== undefined && p.ten === undefined && p.qc === undefined && p.dv === undefined && p.an === undefined;
  if (x.ng !== 'APP' && !chiMin) throw loi('KHO_ERP', 'Linh kiện từ file ERP · ERP零件');
  capNhatTieuDe('KhoLK');
  if (p.tonMin !== undefined) {
    var mn = soHoacRong(p.tonMin);
    if (mn !== '' && !(mn >= 0 && mn <= 1e9)) throw loi('SO_SAI', 'Tồn tối thiểu không hợp lệ');
    if (mn !== x.tonMin) ghiNhatKy(u, 'SUA_TON_MIN', 'KhoLK', x.ma, { tonMin: x.tonMin }, { tonMin: mn }, '');
    x.tonMin = mn;
  }
  if (p.ten !== undefined) { var ten = catChu(p.ten, 160); if (!ten) throw loi('THIEU_TEN', 'Chưa nhập tên · 请输入名称'); x.ten = ten; }
  if (p.qc !== undefined) x.qc = catChu(p.qc, 200);
  if (p.dv !== undefined) x.dv = catChu(p.dv, 12);
  if (p.an !== undefined) x.an = p.an ? 1 : 0;
  x.cn = thoiGianStr();
  suaDong('KhoLK', x._r, khoThanhDong(x));
  var meta = docKhoMeta(), truoc = meta.ver || '';
  meta.ver = verMoi();
  meta.n = docKho().filter(khoHien).length;
  ghiKhoMeta(meta);
  return { kho: { ver: meta.ver, truoc: truoc, n: meta.n, ds: [sachKho(x)] } };
}

// ===================== Người dùng =====================
function luuNguoiDung(u, p) {
  var ten = catChu(p.ten, 60);
  if (!ten) throw loi('THIEU_TEN', 'Chưa nhập tên · 请输入名称');
  var vai = s(p.vaiTro);
  if (!VAI_TRO[vai]) throw loi('VAI_TRO_SAI', 'Vai trò không hợp lệ');
  var email = s(p.email).slice(0, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw loi('EMAIL_SAI', 'Email không hợp lệ');
  var ds = dsNguoiDung(), x = null;
  if (p.id) {
    x = ds.filter(function (d) { return d.id === s(p.id); })[0];
    if (!x) throw loi('KHONG_CO', 'Không tìm thấy · 找不到');
  }
  var pin = s(p.pin);
  if (!x && !pin) throw loi('THIEU_PIN', 'Chưa nhập PIN');
  if (pin && !/^\d{6}$/.test(pin)) throw loi('PIN_6_SO', 'PIN phải đủ 6 số');
  var hash = pin ? bamPin(pin) : x.pinHash;
  // Không kiểm tra PIN trùng: báo "PIN đã có người dùng" sẽ làm lộ PIN của người khác. Đăng nhập dùng mã nhân viên + PIN.
  var maNV = s(p.maNV) ? maNVHopLe(p.maNV) : '';
  if (s(p.maNV) && !maNV) throw loi('MA_NV_SAI', 'Mã nhân viên chỉ gồm chữ, số, dấu . _ -');
  if (maNV && ds.some(function (d) { return d.maNV === maNV && (!x || d.id !== x.id); })) throw loi('MA_NV_TRUNG', maNV);
  var hoatDong = p.hoatDong !== false;
  if (x && x.vaiTro === 'admin' && (vai !== 'admin' || !hoatDong)) {
    var con = ds.filter(function (d) { return d.vaiTro === 'admin' && d.hoatDong && d.id !== x.id; }).length;
    if (!con) throw loi('ADMIN_CUOI', 'Phải còn ít nhất một Quản trị');
  }
  var moi = !x;
  if (moi) {
    var n = 0;
    ds.forEach(function (d) { var k = /^U(\d+)$/.exec(d.id); if (k) n = Math.max(n, Number(k[1])); });
    var t = String(n + 1); while (t.length < 3) t = '0' + t;
    x = { id: 'U' + t, ngayTao: thoiGianStr() };
    if (!maNV) {
      var k = 0;
      ds.forEach(function (d) { var q = /^NV(\d+)$/.exec(d.maNV); if (q) k = Math.max(k, Number(q[1])); });
      do { k++; maNV = 'NV' + ('00' + k).slice(-3); } while (ds.some(function (d) { return d.maNV === maNV; }));
    }
  }
  capNhatTieuDe('NguoiDung');
  x.ten = ten; x.vaiTro = vai; x.pinHash = hash; x.email = email; x.hoatDong = hoatDong;
  if (maNV) x.maNV = maNV;
  if (p.tenZh !== undefined) x.tenZh = catChu(p.tenZh, 60);
  if (moi) themDong('NguoiDung', ndThanhDong(x)); else suaDong('NguoiDung', x._r, ndThanhDong(x));
  return { user: congKhaiAdmin(x) };
}
function doiPin(u, p) {
  if (bamPin(s(p.cu)) !== u.pinHash) throw loi('PIN_CU_SAI', 'PIN cũ không đúng');
  var moi = s(p.moi);
  if (!/^\d{6}$/.test(moi)) throw loi('PIN_6_SO', 'PIN phải đủ 6 số');
  u.pinHash = bamPin(moi);
  suaDong('NguoiDung', u._r, ndThanhDong(u));
  return { token: taoToken(u) };
}

// ===================== Số điện =====================
// Kỳ ghi cố định: ngày 10, ngày 20 và ngày cuối tháng (28/29/30/31).
function cuoiThang(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function ngayKy(y, m, d) { return y + '-' + pad2(m) + '-' + pad2(d); }
function laKy(d) {
  if (!hopLeNgay(d)) return false;
  var y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)), n = Number(d.slice(8, 10));
  return n === 10 || n === 20 || n === cuoiThang(y, m);
}
function kyHienTai(homNay) {
  var y = Number(homNay.slice(0, 4)), m = Number(homNay.slice(5, 7)), n = Number(homNay.slice(8, 10)), c = cuoiThang(y, m);
  if (n >= c) return ngayKy(y, m, c);
  if (n >= 20) return ngayKy(y, m, 20);
  if (n >= 10) return ngayKy(y, m, 10);
  var py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  return ngayKy(py, pm, cuoiThang(py, pm));
}
function kyTruoc(k) {
  var y = Number(k.slice(0, 4)), m = Number(k.slice(5, 7)), n = Number(k.slice(8, 10));
  if (n === 20) return ngayKy(y, m, 10);
  if (n === 10) { var py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return ngayKy(py, pm, cuoiThang(py, pm)); }
  return ngayKy(y, m, 20);
}

function kyTiep(k) {
  var y = Number(k.slice(0, 4)), m = Number(k.slice(5, 7)), n = Number(k.slice(8, 10));
  if (n === 10) return ngayKy(y, m, 20);
  if (n === 20) return ngayKy(y, m, cuoiThang(y, m));
  return m === 12 ? ngayKy(y + 1, 1, 10) : ngayKy(y, m + 1, 10);
}

// Loại công tơ: cao (cao áp, nhiều mã OBIS) · ha (tủ tổng hạ áp, cộng vào tổng hạ áp) · nhanh (công tơ nhánh sau tủ)
// · nuoc (đồng hồ nước, m³; ghi cùng 3 kỳ, không cộng vào điện)
var LOAI_CT = ['cao', 'ha', 'nhanh', 'nuoc'];
function loaiCT(v) { v = s(v); return LOAI_CT.indexOf(v) >= 0 ? v : 'cao'; }
function phanTram(v) { var x = soHoacRong(v); return x === '' || !(x > 0) || x > 10000 ? '' : Math.round(x * 10) / 10; }
function soChuSoHopLe(v) { var n = Math.round(Number(v)); return n >= 3 && n <= 12 ? n : ''; }
function ctTuDong(r, i) {
  return {
    ma: s(r[0]), ten: s(r[1]), soCongTo: s(r[2]), viTri: s(r[3]), heSo: Number(r[4]) || 1,
    thongSo: s(r[5]) ? s(r[5]).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [],
    hoatDong: hd(r[6]), ghiChu: s(r[7]), capNhat: tgStr(r[8]), loai: loaiCT(r[9]),
    cha: s(r[10]).toUpperCase(), nhom: s(r[11]), nguongTang: phanTram(r[12]), nguongGiam: phanTram(r[13]),
    soChuSo: soChuSoHopLe(r[14]), batBuocAnh: s(r[15]) === '1' ? 1 : 0, _r: i + 2
  };
}
function ctThanhDong(m) {
  return [m.ma, anToan(m.ten), anToan(m.soCongTo), anToan(m.viTri), m.heSo, (m.thongSo || []).join(','), m.hoatDong ? 1 : 0, anToan(m.ghiChu || ''),
    m.capNhat, m.loai, m.cha || '', anToan(m.nhom || ''), m.nguongTang === '' || m.nguongTang === undefined ? '' : String(m.nguongTang),
    m.nguongGiam === '' || m.nguongGiam === undefined ? '' : String(m.nguongGiam), m.soChuSo ? String(m.soChuSo) : '', m.batBuocAnh ? '1' : ''];
}
// Trang tạo từ bản cũ thiếu cột mới ở cuối: ghi lại dòng tiêu đề
function capNhatTieuDe(ten) {
  if (DA_TIEU_DE[ten]) return;
  DA_TIEU_DE[ten] = 1;
  var sh = trang(ten), cot = BANG[ten], h = sh.getRange(1, 1, 1, cot.length).getValues()[0], sai = [];
  cot.forEach(function (c, i) { if (s(h[i]) !== c) sai.push(i); });
  if (!sai.length) return;
  sh.getRange(1, 1, 1, cot.length).setValues([cot]).setFontWeight('bold').setBackground('#16211F').setFontColor('#FFFFFF');
  sai.forEach(function (i) { sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat(dinhDangCot(ten, cot[i])); });
}
function dsCongTo() { return docTho('CongTo').map(ctTuDong).filter(function (m) { return m.ma; }); }
function sachCT(m) {
  return { ma: m.ma, ten: m.ten, soCongTo: m.soCongTo, viTri: m.viTri, heSo: m.heSo, thongSo: m.thongSo,
    hoatDong: m.hoatDong, ghiChu: m.ghiChu, capNhat: m.capNhat, loai: m.loai, cha: m.cha || '', nhom: m.nhom || '',
    nguongTang: m.nguongTang, nguongGiam: m.nguongGiam, soChuSo: m.soChuSo, batBuocAnh: m.batBuocAnh };
}
function csTuDong(r, i) {
  return {
    id: s(r[0]), ky: ngayStr(r[1]), ma: s(r[2]), giaTri: docJson(r[3], {}) || {}, nguoi: s(r[4]), thoiGian: tgStr(r[5]), ghiChu: s(r[6]),
    uid: s(r[7]), trangThai: s(r[8]) || 'OK', opId: s(r[9]), suaLuc: tgStr(r[10]),
    tieuThu: docJson(r[14], null), lucGhi: tgStr(r[15]), anh: docJson(r[16], []) || [], ngoaiLe: docJson(r[17], null),
    nguoiSua: s(r[18]), nguon: s(r[19]), _r: i + 2
  };
}
// Mã chính của một lần ghi (để đưa ra các cột KyTruoc / CSTruoc / TieuThuKy đọc được trên sheet)
function maChinhCS(x) { var g = x.giaTri || {}; return g['1.8.0'] !== undefined ? '1.8.0' : Object.keys(g)[0]; }
function csThanhDong(x) {
  var mc = maChinhCS(x), c = (x.tieuThu || {})[mc] || null;
  return [x.id, x.ky, x.ma, JSON.stringify(x.giaTri), anToan(x.nguoi), x.thoiGian, anToan(x.ghiChu || ''), x.uid, x.trangThai, x.opId || '', x.suaLuc || '',
    c ? c.ky0 : '', c && c.cs0 !== undefined ? c.cs0 : '', c && typeof c.tt === 'number' ? c.tt : '',
    x.tieuThu ? JSON.stringify(x.tieuThu) : '', x.lucGhi || '', x.anh && x.anh.length ? JSON.stringify(x.anh) : '',
    x.ngoaiLe ? JSON.stringify(x.ngoaiLe) : '', anToan(x.nguoiSua || ''), x.nguon || ''];
}
function docChiSo() { return docTho('ChiSo').map(csTuDong).filter(function (x) { return x.id && x.ma && x.ky; }); }
// Phiên bản của một bản ghi: đổi mỗi khi sửa (dùng để phát hiện xung đột khi gửi lại từ máy đang offline)
function verCS(x) {
  var t = JSON.stringify(x.giaTri) + '|' + x.trangThai + '|' + (x.suaLuc || x.thoiGian), h = 0;
  for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return (x.suaLuc || x.thoiGian) + '#' + (h >>> 0).toString(36);
}
function sachCS(x) {
  return { id: x.id, ver: verCS(x), ky: x.ky, ma: x.ma, giaTri: x.giaTri, nguoi: x.nguoi, thoiGian: x.thoiGian, ghiChu: x.ghiChu,
    uid: x.uid, trangThai: x.trangThai, suaLuc: x.suaLuc, tieuThu: x.tieuThu || null, lucGhi: x.lucGhi || '',
    anh: x.anh || [], ngoaiLe: x.ngoaiLe || null, nguoiSua: x.nguoiSua || '', nguon: x.nguon || '' };
}
function docThongSo() {
  var t = PropertiesService.getScriptProperties().getProperty('THONG_SO');
  try { var a = JSON.parse(t || 'null'); if (a && a.length) return a; } catch (e) { /* dùng mặc định */ }
  return THONG_SO_MAC_DINH.map(function (x) { return { ma: x.ma, ten: x.ten, zh: x.zh, dv: x.dv, tich: x.tich }; });
}
// Công tơ hạ áp / nhánh / nước chỉ có một chỉ số (lưu dưới mã 1.8.0); cao áp dùng danh sách thông số
function thongSoCua(ct, ts) {
  if (ct.loai !== 'cao') return ['1.8.0'];
  var tatCa = (ts || docThongSo()).map(function (x) { return x.ma; });
  return ct.thongSo.length ? ct.thongSo.filter(function (m) { return tatCa.indexOf(m) >= 0; }) : tatCa;
}
// Các mã cộng dồn (dùng để tính tiêu thụ)
function maTich(ct, ts) {
  ts = ts || docThongSo();
  var tich = {};
  ts.forEach(function (x) { tich[x.ma] = x.tich !== false; });
  return thongSoCua(ct, ts).filter(function (m) { return ct.loai !== 'cao' || tich[m] !== false; });
}
function maChinhCT(ct, ts) { var a = maTich(ct, ts); return a.indexOf('1.8.0') >= 0 ? '1.8.0' : a[0]; }
function r3(v) { return Math.round(v * 1000) / 1000; }
// Số kỳ chuẩn (10, 20, cuối tháng) nằm giữa hai kỳ, không tính hai đầu
function soKyGiua(a, b) { var n = 0, k = kyTiep(a), g = 0; while (k < b && g++ < 1200) { n++; k = kyTiep(k); } return n; }

// ----- Tính tiêu thụ -----
// Tiêu thụ kỳ = (chỉ số kỳ này − chỉ số lần ghi hợp lệ gần nhất trước đó) × hệ số nhân.
// Kỳ đầu tháng lấy số cuối tháng trước (là lần ghi gần nhất). Kỳ trước bị thiếu thì tính gộp và ghi gop = số kỳ thiếu.
// Ngoại lệ chỉ số giảm: THAY_CT (thay công tơ: (số cuối công tơ cũ − kỳ trước) + (kỳ này − số đầu công tơ mới)),
// QUAY_VONG (công tơ quay về 0: (10^số chữ số − kỳ trước) + kỳ này), KHAC (lấy làm mốc mới, kỳ này không tính).
// truoc: các lần ghi trạng thái OK trước kỳ này, sắp theo kỳ tăng dần. giuHeSo: dùng lại hệ số đã lưu ở lần tính trước.
function tinhMotKy(ct, x, truoc, giuHeSo, ts) {
  var out = {}, g = (x.ngoaiLe && x.ngoaiLe.giam) || null;
  maTich(ct, ts).forEach(function (code) {
    var cur = x.giaTri[code];
    if (cur === undefined || cur === '' || cur === null) return;
    var prev = null;
    for (var i = truoc.length - 1; i >= 0; i--) if (truoc[i].giaTri && truoc[i].giaTri[code] !== undefined) { prev = truoc[i]; break; }
    if (!prev) return;                        // lần ghi đầu tiên: chỉ là mốc
    var p0 = Number(prev.giaTri[code]), c = Number(cur), cu = x.tieuThu && x.tieuThu[code];
    var hs = giuHeSo && cu && cu.heSo ? cu.heSo : ct.heSo;
    var o = { cs0: p0, ky0: prev.ky, ngay: soNgay(x.ky, prev.ky), gop: soKyGiua(prev.ky, x.ky), heSo: hs, cach: 'THUONG' };
    var raw = c - p0;
    if (raw < 0 && g) {
      if (g.loai === 'THAY_CT' && g.csCuCuoi && g.csMoiDau && g.csCuCuoi[code] !== undefined && g.csMoiDau[code] !== undefined) {
        raw = (Number(g.csCuCuoi[code]) - p0) + (c - Number(g.csMoiDau[code])); o.cach = 'THAY_CT';
      } else if (g.loai === 'QUAY_VONG' && ct.soChuSo) {
        raw = (Math.pow(10, ct.soChuSo) - p0) + c; o.cach = 'QUAY_VONG';
      } else if (g.loai === 'KHAC') {
        o.cach = 'MOC'; o.raw = null; o.tt = null; out[code] = o; return;
      }
    }
    o.raw = r3(raw); o.tt = r3(raw * hs);
    if (raw < 0) o.am = 1;                    // số cũ chưa xử lý ngoại lệ: không cộng vào tổng
    out[code] = o;
  });
  return out;
}
function theoKy(a, b) { return a.ky > b.ky ? 1 : a.ky < b.ky ? -1 : (a.thoiGian > b.thoiGian ? 1 : -1); }
// Tính lại mọi kỳ của một công tơ. Trả các bản ghi có tiêu thụ thay đổi.
// opt.heSoMoi: dùng hệ số hiện tại cho các kỳ chưa khoá (khi sửa hệ số nhân của công tơ)
function tinhLaiCT(ct, ds, opt, ts) {
  opt = opt || {};
  var arr = ds.filter(function (x) { return x.ma === ct.ma && x.trangThai !== 'HUY'; }).sort(theoKy);
  var ok = [], doi = [];
  arr.forEach(function (x) {
    var cu = JSON.stringify(x.tieuThu || null);
    var giu = !(opt.heSoMoi && !(opt.khoaDen && x.ky <= opt.khoaDen));
    x.tieuThu = tinhMotKy(ct, x, ok, giu, ts);
    if (JSON.stringify(x.tieuThu) !== cu) doi.push(x);
    if (x.trangThai === 'OK') ok.push(x);
  });
  return doi;
}
// So tiêu thụ bình quân ngày với 3 lần ghi hợp lệ trước đó (cùng mã). Trả {pct, tb (bình quân ngày)} hoặc null
function soSanhBinhQuan(x, truoc, code) {
  var t = x.tieuThu && x.tieuThu[code];
  if (!t || typeof t.tt !== 'number' || !(t.ngay > 0) || t.am) return null;
  var h = truoc.slice(-3).map(function (y) { return y.tieuThu && y.tieuThu[code]; })
    .filter(function (d) { return d && typeof d.tt === 'number' && d.ngay > 0 && !d.am && d.tt >= 0; });
  if (!h.length) return null;
  var tb = h.reduce(function (a, d) { return a + d.tt / d.ngay; }, 0) / h.length;
  if (!(tb > 0)) return null;
  return { pct: Math.round((t.tt / t.ngay / tb - 1) * 1000) / 10, tb: r3(tb) };
}
function nguongCua(ct) {
  var c = docCaiDat();
  return { tang: ct.nguongTang !== '' && ct.nguongTang !== undefined ? ct.nguongTang : c.nguongTang,
    giam: ct.nguongGiam !== '' && ct.nguongGiam !== undefined ? ct.nguongGiam : c.nguongGiam };
}

// ----- Khoá kỳ -----
// KHOA_KY = {den: kỳ đã khoá gần nhất, luc, nguoi}. Mọi kỳ từ "den" trở về trước đều đã khoá.
function docKhoaKy() {
  var o = docJson(PropertiesService.getScriptProperties().getProperty('KHOA_KY'), null);
  return o && typeof o === 'object' ? { den: ngayStr(o.den), luc: s(o.luc), nguoi: s(o.nguoi) } : { den: '', luc: '', nguoi: '' };
}
function ghiKhoaKy(o) { PropertiesService.getScriptProperties().setProperty('KHOA_KY', JSON.stringify(o)); }
function daKhoaKy(ky, khoa) { khoa = khoa || docKhoaKy(); return !!(khoa.den && ky <= khoa.den); }

// ----- Nhật ký sửa đổi -----
function catJson(o) { if (o === null || o === undefined || o === '') return ''; var t = JSON.stringify(o); return t.length > 45000 ? t.slice(0, 45000) + '…' : t; }
function ghiNhatKy(u, hanhDong, bang, khoa, truoc, sau, lyDo) {
  capNhatTieuDe('NhatKy');
  themDong('NhatKy', ['NK' + Utilities.formatDate(bayGio(), TZ, 'yyMMddHHmmss') + Math.floor(100 + Math.random() * 900), thoiGianStr(),
    u ? u.id : '', anToan(u ? u.ten : 'Hệ thống'), hanhDong, bang, anToan(s(khoa)), catJson(truoc), catJson(sau), anToan(catChu(lyDo, 300))]);
}
function docNhatKy(p) {
  var lim = Math.min(500, Math.max(1, Math.round(Number(p.lim)) || 100)), bang = s(p.bang), khoa = s(p.khoa);
  var rows = docTho('NhatKy').filter(function (r) { return s(r[0]) && (!bang || s(r[5]) === bang) && (!khoa || s(r[6]).indexOf(khoa) === 0); });
  return { ds: rows.slice(-lim).reverse().map(function (r) {
    return { id: s(r[0]), luc: tgStr(r[1]), uid: s(r[2]), nguoi: s(r[3]), hanhDong: s(r[4]), bang: s(r[5]), khoa: s(r[6]),
      truoc: docJson(r[7], s(r[7])), sau: docJson(r[8], s(r[8])), lyDo: s(r[9]) };
  }) };
}

// ----- Ảnh công tơ / ảnh bảo dưỡng: đọc qua máy chủ (file Drive để riêng tư) -----
function docAnh(p) {
  var id = s(p.id);
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(id)) throw loi('KHONG_CO', 'Không tìm thấy ảnh · 找不到照片');
  var f;
  try { f = DriveApp.getFileById(id); } catch (e) { throw loi('KHONG_CO', 'Không tìm thấy ảnh · 找不到照片'); }
  // Chỉ trả ảnh nằm trong thư mục ảnh của app (không cho đọc file Drive khác của chủ sheet)
  var fid = anhFolder().getId(), ok = false, it = f.getParents();
  while (it.hasNext()) { if (it.next().getId() === fid) { ok = true; break; } }
  if (!ok) throw loi('KHONG_CO', 'Không tìm thấy ảnh · 找不到照片');
  var b = f.getBlob();
  return { id: id, data: 'data:' + (b.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(b.getBytes()) };
}
function sachAnhCS(anh, tenGoc) {
  var out = [];
  (Array.isArray(anh) ? anh : []).slice(0, 3).forEach(function (a, i) {
    if (!a) return;
    if (a.data && String(a.data).indexOf('data:') === 0) {
      var r = luuAnhDrive(a.data, tenGoc + '_' + (i + 1) + '.jpg');
      if (r) out.push({ id: r.id });
    } else if (a.id && /^[A-Za-z0-9_-]{10,80}$/.test(s(a.id))) out.push({ id: s(a.id) });
  });
  return out;
}

// ----- Ghi chỉ số -----
function soMa(o, codes) {
  var r = {};
  if (!o || typeof o !== 'object') return r;
  codes.forEach(function (k) { var v = soHoacRong(o[k]); if (v !== '' && v >= 0 && v <= 1e12) r[k] = r3(v); });
  return r;
}
function loiDL(code, msg, data) { var e = loi(code, msg); e.data = data; return e; }
var LOAI_GIAM = ['THAY_CT', 'QUAY_VONG', 'KHAC'];

function ghiChiSo(u, p, opId) {
  var ds = docChiSo();
  if (opId) {
    var cu0 = ds.filter(function (x) { return x.opId === opId; })[0];
    if (cu0) return { dup: true, chiSo: sachCS(cu0) };
  }
  var ma = s(p.ma).toUpperCase(), cts = dsCongTo(), ts = docThongSo();
  var ct = cts.filter(function (x) { return x.ma === ma; })[0];
  if (!ct) throw loi('KHONG_CO_CT', 'Không tìm thấy công tơ · 找不到电表');
  if (!ct.hoatDong) throw loi('CT_NGUNG', 'Công tơ đã ngừng · 电表已停用');
  var ky = ngayStr(p.ky), homNay = homNayStr();
  if (!laKy(ky)) throw loi('KY_SAI', 'Kỳ ghi phải là ngày 10, 20 hoặc cuối tháng');
  if (ky > homNay) throw loi('NGAY_TUONG_LAI', 'Chưa đến kỳ ghi này');
  if (soNgay(homNay, ky) > LUI_TOI_DA) throw loi('NGAY_QUA_XA', 'Kỳ quá xa');
  var dung = thongSoCua(ct, ts), gt = {}, n = 0;
  Object.keys(p.giaTri || {}).forEach(function (k) {
    var v = p.giaTri[k];
    if (v === '' || v === null || v === undefined) return;
    if (dung.indexOf(k) < 0) throw loi('THONG_SO_SAI', k);
    var x = Number(v);
    if (!isFinite(x) || x < 0 || x > 1e12) throw loi('SO_SAI', k);
    gt[k] = r3(x); n++;
  });
  if (!n) throw loi('THIEU_SO', 'Chưa nhập chỉ số nào');
  capNhatTieuDe('ChiSo');
  var bay = thoiGianStr();
  var cu = ds.filter(function (x) { return x.ma === ct.ma && x.ky === ky && x.trangThai !== 'HUY'; })[0];
  // Xung đột: app gửi kèm phiên bản bản ghi nó đã thấy (goc); máy chủ đã khác thì báo để người dùng chọn
  if (p.goc !== undefined && p.goc !== null && !p.ghiDe) {
    var ver = cu ? verCS(cu) : '';
    if (s(p.goc) !== ver) throw loiDL('XUNG_DOT', 'Số này vừa được người khác ghi hoặc sửa · 数据已被他人修改', { chiSo: cu ? sachCS(cu) : null });
  }
  if (cu && !coQuyen(u, 'huy') && cu.uid !== u.id) throw loi('DA_GHI', cu.nguoi);
  var khoa = docKhoaKy(), daKhoa = daKhoaKy(ky, khoa), lyDoSua = catChu(p.lyDoSua, 200);
  if (daKhoa) {
    if (!coQuyen(u, 'khoaky')) throw loi('KY_DA_KHOA', ngayVN(ky));
    if (!lyDoSua) throw loi('CAN_LY_DO', 'Kỳ đã khoá: cần ghi lý do sửa · 已锁定，请填写修改原因');
  }
  var anh = p.anh !== undefined ? sachAnhCS(p.anh, ct.ma + '_' + ky.replace(/-/g, '')) : (cu ? cu.anh || [] : []);
  if (ct.batBuocAnh && !anh.length) throw loi('CAN_ANH', 'Công tơ này bắt buộc chụp ảnh · 此电表必须拍照');
  var truocSua = cu ? JSON.parse(JSON.stringify(sachCS(cu))) : null;
  var x = cu || { id: 'CS' + Utilities.formatDate(bayGio(), TZ, 'yyMMddHHmmss') + Math.floor(100 + Math.random() * 900),
    ky: ky, ma: ct.ma, uid: u.id, thoiGian: bay, suaLuc: '', opId: opId };
  x.giaTri = gt; x.nguoi = catChu(p.nguoi, 150) || u.ten; x.ghiChu = catNhieuDong(p.ghiChu, 300);
  var lg = tgStr(p.lucGhi);
  x.lucGhi = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(lg) ? lg : bay;
  x.anh = anh; x.nguon = p.nguon === 'MAY_TINH' ? 'MAY_TINH' : 'APP';
  if (cu) { x.suaLuc = bay; x.nguoiSua = u.ten; if (opId) x.opId = opId; }
  // Lần ghi hợp lệ trước kỳ này (không tính chính nó)
  var truoc = ds.filter(function (r) { return r.ma === ct.ma && r.trangThai === 'OK' && r.ky < ky && r !== x; }).sort(theoKy);
  var codes = maTich(ct, ts);
  // 1. Chỉ số nhỏ hơn kỳ trước: không nhận như bản ghi thường, phải chọn loại ngoại lệ + lý do
  x.ngoaiLe = null; x.tieuThu = null;
  var thuong = tinhMotKy(ct, x, truoc, false, ts);
  var giam = codes.filter(function (k) { return thuong[k] && thuong[k].raw < 0; });
  var g = p.ngoaiLe && p.ngoaiLe.giam, nl = {};
  x.trangThai = 'OK';
  if (giam.length) {
    var tr = {};
    giam.forEach(function (k) { tr[k] = thuong[k].cs0; });
    if (!g || LOAI_GIAM.indexOf(g.loai) < 0) throw loiDL('GIAM', 'Chỉ số nhỏ hơn kỳ trước · 读数小于上期', { ma: giam, truoc: tr });
    var lyDo = catChu(g.lyDo, 200);
    if (!lyDo) throw loi('CAN_LY_DO', 'Cần ghi lý do · 请填写原因');
    var o = { loai: g.loai, lyDo: lyDo };
    if (g.loai === 'THAY_CT') {
      o.csCuCuoi = soMa(g.csCuCuoi, giam); o.csMoiDau = soMa(g.csMoiDau, giam);
      giam.forEach(function (k) {
        if (o.csCuCuoi[k] === undefined || o.csMoiDau[k] === undefined) throw loi('THIEU_THAY_CT', k);
        if (o.csCuCuoi[k] < tr[k] || gt[k] < o.csMoiDau[k]) throw loi('THAY_CT_SAI', k);
      });
    }
    if (g.loai === 'QUAY_VONG' && !ct.soChuSo) throw loi('CHUA_SO_CHU_SO', 'Chưa khai báo số chữ số của công tơ · 未设置电表位数');
    nl.giam = o;
    if (coQuyen(u, 'khoaky')) nl.duyet = { kq: 'DUYET', nguoi: u.ten, luc: bay, tu: 1 };
    else x.trangThai = 'CHO_DUYET';
  }
  if (nl.giam) x.ngoaiLe = nl;
  x.tieuThu = tinhMotKy(ct, x, truoc, false, ts);
  // 2. Tiêu thụ lệch nhiều so với bình quân ngày 3 kỳ trước: cảnh báo, người ghi phải xác nhận đã kiểm tra lại
  var mc = maChinhCT(ct, ts), bq = soSanhBinhQuan(x, truoc, mc), ng = nguongCua(ct);
  if (bq && (bq.pct > ng.tang || bq.pct < -ng.giam)) {
    var huong = bq.pct > 0 ? 'CAO' : 'THAP';
    if (!p.xacNhanBatThuong) throw loiDL('BAT_THUONG', 'Tiêu thụ bất thường · 用量异常', { pct: bq.pct, huong: huong, tb: bq.tb, nguong: ng, tt: x.tieuThu[mc].tt, ngay: x.tieuThu[mc].ngay });
    x.ngoaiLe = x.ngoaiLe || {};
    x.ngoaiLe.batThuong = { huong: huong, pct: bq.pct, tb: bq.tb, lyDo: catChu(p.ngoaiLe && p.ngoaiLe.batThuongLyDo, 200) };
  }
  // 3. Kỳ sau dùng số này làm kỳ trước → tính lại cả công tơ
  if (!cu) ds.push(x);
  var doi = tinhLaiCT(ct, ds, {}, ts).filter(function (r) { return r !== x; });
  if (cu) suaDong('ChiSo', x._r, csThanhDong(x)); else themDong('ChiSo', csThanhDong(x));
  doi.forEach(function (r) { suaDong('ChiSo', r._r, csThanhDong(r)); if (daKhoaKy(r.ky, khoa)) ghiNhatKy(u, 'TINH_LAI', 'ChiSo', r.ma + '|' + r.ky, null, r.tieuThu, 'Do sửa kỳ ' + ngayVN(ky)); });
  var khoaNK = ct.ma + '|' + ky;
  if (cu) ghiNhatKy(u, daKhoa ? 'SUA_SAU_KHOA' : 'SUA_CHI_SO', 'ChiSo', khoaNK, truocSua, sachCS(x), lyDoSua);
  if (nl.giam) ghiNhatKy(u, x.trangThai === 'CHO_DUYET' ? 'NGOAI_LE_CHO_DUYET' : 'NGOAI_LE_TU_DUYET', 'ChiSo', khoaNK, null, x.ngoaiLe, nl.giam.lyDo);
  return { chiSo: sachCS(x), dsChiSo: doi.map(sachCS), sua: !!cu };
}
function xoaChiSo(u, p) {
  var ds = docChiSo(), x = ds.filter(function (r) { return r.id === s(p.id); })[0];
  if (!x) throw loi('KHONG_CO', 'Không tìm thấy · 找不到');
  var cuaMinh = x.uid === u.id && x.thoiGian.slice(0, 10) === homNayStr();
  if (!coQuyen(u, 'huy') && !cuaMinh) throw loi('KHONG_QUYEN', 'Không có quyền · 无权限');
  var khoa = docKhoaKy(), lyDo = catChu(p.lyDo, 200);
  if (daKhoaKy(x.ky, khoa)) {
    if (!coQuyen(u, 'khoaky')) throw loi('KY_DA_KHOA', ngayVN(x.ky));
    if (!lyDo) throw loi('CAN_LY_DO', 'Kỳ đã khoá: cần ghi lý do · 已锁定，请填写原因');
  }
  var doi = [];
  if (x.trangThai !== 'HUY') {
    capNhatTieuDe('ChiSo');
    var truoc = JSON.parse(JSON.stringify(sachCS(x)));
    x.trangThai = 'HUY'; x.suaLuc = thoiGianStr() + ' · ' + u.ten; x.nguoiSua = u.ten;
    suaDong('ChiSo', x._r, csThanhDong(x));
    var ct = dsCongTo().filter(function (c) { return c.ma === x.ma; })[0];
    if (ct) {
      doi = tinhLaiCT(ct, ds, {}).filter(function (r) { return r !== x; });
      doi.forEach(function (r) { suaDong('ChiSo', r._r, csThanhDong(r)); });
    }
    ghiNhatKy(u, 'XOA_CHI_SO', 'ChiSo', x.ma + '|' + x.ky, truoc, null, lyDo);
  }
  return { chiSo: sachCS(x), xoa: true, dsChiSo: doi.map(sachCS) };
}
// Quản lý duyệt / từ chối ngoại lệ (chỉ số giảm do thay công tơ, quay vòng, lý do khác)
function duyetChiSo(u, p) {
  var ds = docChiSo(), x = ds.filter(function (r) { return r.id === s(p.id); })[0];
  if (!x) throw loi('KHONG_CO', 'Không tìm thấy · 找不到');
  if (x.trangThai !== 'CHO_DUYET') throw loi('KHONG_CHO_DUYET', 'Bản ghi không ở trạng thái chờ duyệt · 不是待审核状态');
  var dongY = p.duyet !== false, lyDo = catChu(p.lyDo, 200);
  if (!dongY && !lyDo) throw loi('CAN_LY_DO', 'Cần ghi lý do từ chối · 请填写拒绝原因');
  capNhatTieuDe('ChiSo');
  var truoc = JSON.parse(JSON.stringify(sachCS(x))), bay = thoiGianStr();
  x.ngoaiLe = x.ngoaiLe || {};
  x.ngoaiLe.duyet = { kq: dongY ? 'DUYET' : 'TU_CHOI', nguoi: u.ten, luc: bay, lyDo: lyDo };
  x.trangThai = dongY ? 'OK' : 'HUY';
  x.suaLuc = bay; x.nguoiSua = u.ten;
  var ct = dsCongTo().filter(function (c) { return c.ma === x.ma; })[0];
  var doi = ct ? tinhLaiCT(ct, ds, {}).filter(function (r) { return r !== x; }) : [];
  suaDong('ChiSo', x._r, csThanhDong(x));
  doi.forEach(function (r) { suaDong('ChiSo', r._r, csThanhDong(r)); });
  ghiNhatKy(u, dongY ? 'DUYET_NGOAI_LE' : 'TU_CHOI_NGOAI_LE', 'ChiSo', x.ma + '|' + x.ky, truoc, sachCS(x), lyDo);
  return { chiSo: sachCS(x), dsChiSo: doi.map(sachCS) };
}
// Công tơ chưa có số (hoặc còn chờ duyệt) ở một kỳ
function tinhTrangKy(ky, cts, ds) {
  var co = {}, cho = [];
  ds.forEach(function (x) {
    if (x.ky !== ky || x.trangThai === 'HUY') return;
    co[x.ma] = 1;
    if (x.trangThai === 'CHO_DUYET') cho.push(x.ma);
  });
  return { thieu: cts.filter(function (c) { return c.hoatDong && !co[c.ma]; }).map(function (c) { return c.ma; }), cho: cho };
}
function khoaKy(u, p) {
  var ky = ngayStr(p.ky), homNay = homNayStr();
  if (!laKy(ky)) throw loi('KY_SAI', 'Kỳ ghi phải là ngày 10, 20 hoặc cuối tháng');
  if (ky > kyHienTai(homNay)) throw loi('NGAY_TUONG_LAI', 'Chưa đến kỳ này');
  var ds = docChiSo(), cts = dsCongTo(), khoa = docKhoaKy();
  // Mọi kỳ từ kỳ đã khoá gần nhất đến kỳ này đều phải không còn ngoại lệ chờ duyệt
  var choDuyet = ds.filter(function (x) { return x.trangThai === 'CHO_DUYET' && x.ky <= ky && (!khoa.den || x.ky > khoa.den); });
  if (choDuyet.length) throw loiDL('CON_CHO_DUYET', 'Còn ngoại lệ chờ duyệt · 还有待审核的异常', { ds: choDuyet.map(sachCS) });
  var tt = tinhTrangKy(ky, cts, ds);
  if (tt.thieu.length && !p.boQuaThieu) throw loiDL('CON_THIEU', 'Còn công tơ chưa ghi · 还有电表未抄', { thieu: tt.thieu });
  var truoc = JSON.parse(JSON.stringify(khoa));
  if (!khoa.den || ky > khoa.den) khoa = { den: ky, luc: thoiGianStr(), nguoi: u.ten };
  ghiKhoaKy(khoa);
  ghiNhatKy(u, 'KHOA_KY', 'KhoaKy', ky, truoc, khoa, tt.thieu.length ? 'Thiếu ' + tt.thieu.join(', ') : '');
  return { khoaKy: khoa };
}
function moKhoaKy(u, p) {
  var ky = ngayStr(p.ky), lyDo = catChu(p.lyDo, 200), khoa = docKhoaKy();
  if (!laKy(ky)) throw loi('KY_SAI', 'Kỳ ghi phải là ngày 10, 20 hoặc cuối tháng');
  if (!lyDo) throw loi('CAN_LY_DO', 'Cần ghi lý do mở lại · 请填写原因');
  if (!daKhoaKy(ky, khoa)) return { khoaKy: khoa };
  var truoc = JSON.parse(JSON.stringify(khoa));
  khoa = { den: kyTruoc(ky), luc: thoiGianStr(), nguoi: u.ten };
  ghiKhoaKy(khoa);
  ghiNhatKy(u, 'MO_KHOA_KY', 'KhoaKy', ky, truoc, khoa, lyDo);
  return { khoaKy: khoa };
}
function luuCauHinhDien(u, p) {
  var c = docCaiDat(), truoc = { nguongTang: c.nguongTang, nguongGiam: c.nguongGiam };
  var a = phanTram(p.nguongTang), b = phanTram(p.nguongGiam);
  if (a === '' || b === '' || b > 100) throw loi('SO_SAI', 'Ngưỡng phải lớn hơn 0 (giảm tối đa 100%)');
  c.nguongTang = a; c.nguongGiam = b;
  ghiCaiDat(c);
  ghiNhatKy(u, 'SUA_CAI_DAT', 'CaiDat', 'nguong', truoc, { nguongTang: a, nguongGiam: b }, '');
  return { caiDat: { nhacTruoc: c.nhacTruoc, nguongTang: a, nguongGiam: b } };
}
function luuCongTo(u, p) {
  var ten = catChu(p.ten, 120);
  if (!ten) throw loi('THIEU_TEN', 'Chưa nhập tên · 请输入名称');
  var heSo = Number(p.heSo);
  if (!(heSo > 0 && heSo <= 1e6)) throw loi('HE_SO_SAI', 'Hệ số nhân phải lớn hơn 0');
  var ts0 = docThongSo(), tatCa = ts0.map(function (x) { return x.ma; });
  var ts = (p.thongSo || []).map(s).filter(function (m) { return tatCa.indexOf(m) >= 0; });
  var ds = dsCongTo(), m = null;
  if (p.ma) {
    m = ds.filter(function (x) { return x.ma === s(p.ma).toUpperCase(); })[0];
    if (!m) throw loi('KHONG_CO_CT', 'Không tìm thấy công tơ · 找不到电表');
  }
  var hoatDong = p.hoatDong !== false, loai = loaiCT(p.loai);
  var trung = ds.filter(function (x) { return x.hoatDong && x.ten.toLowerCase() === ten.toLowerCase() && (!m || x.ma !== m.ma); })[0];
  if (trung && hoatDong) throw loi('TEN_TRUNG', trung.ma);
  // Công tơ cấp trên: phải có, khác chính nó, không tạo vòng
  var cha = s(p.cha).toUpperCase();
  if (cha) {
    var theo = {};
    ds.forEach(function (x) { theo[x.ma] = x; });
    if (!theo[cha] || (m && cha === m.ma)) throw loi('CHA_SAI', cha);
    var k = cha, vong = 0;
    while (k && vong++ < 50) { if (m && k === m.ma) throw loi('CHA_SAI', cha); k = theo[k] ? theo[k].cha : ''; }
  }
  capNhatTieuDe('CongTo');
  var moi = !m, truoc = m ? JSON.parse(JSON.stringify(sachCT(m))) : null;
  if (moi) {
    var n = 0;
    ds.forEach(function (x) { var q = /^E(\d+)$/.exec(x.ma); if (q) n = Math.max(n, Number(q[1])); });
    m = { ma: 'E' + pad2(n + 1) };
  }
  var doiHeSo = !moi && m.heSo !== heSo;
  m.ten = ten; m.soCongTo = catChu(p.soCongTo, 40); m.viTri = catChu(p.viTri, 120); m.heSo = heSo;
  m.loai = loai;
  m.thongSo = loai !== 'cao' || ts.length === tatCa.length ? [] : ts; m.hoatDong = hoatDong; m.ghiChu = catNhieuDong(p.ghiChu, 300);
  m.cha = cha; m.nhom = catChu(p.nhom, 60); m.nguongTang = phanTram(p.nguongTang); m.nguongGiam = phanTram(p.nguongGiam);
  m.soChuSo = soChuSoHopLe(p.soChuSo); m.batBuocAnh = p.batBuocAnh ? 1 : 0;
  m.capNhat = thoiGianStr();
  if (moi) themDong('CongTo', ctThanhDong(m)); else suaDong('CongTo', m._r, ctThanhDong(m));
  var dsCS = [];
  if (!moi) {
    ghiNhatKy(u, 'SUA_CONG_TO', 'CongTo', m.ma, truoc, sachCT(m), doiHeSo ? (p.apDungHeSoMoi ? 'Hệ số mới áp dụng cho các kỳ chưa khoá' : 'Hệ số mới áp dụng từ lần ghi sau') : '');
    if (doiHeSo && p.apDungHeSoMoi) {
      var all = docChiSo(), khoa = docKhoaKy();
      capNhatTieuDe('ChiSo');
      var doi = tinhLaiCT(m, all, { heSoMoi: true, khoaDen: khoa.den }, ts0);
      doi.forEach(function (r) { suaDong('ChiSo', r._r, csThanhDong(r)); });
      dsCS = doi.map(sachCS);
    }
  }
  return { congTo: sachCT(m), moi: moi, dsChiSo: dsCS };
}
function luuThongSo(p) {
  var ds = p.list || [], thay = {}, out = [];
  if (!ds.length) throw loi('THIEU_SO', 'Cần ít nhất một thông số');
  if (ds.length > 30) throw loi('SO_SAI', 'Tối đa 30 thông số');
  ds.forEach(function (x) {
    var ma = s(x.ma);
    if (!/^[0-9A-Za-z.\-_]{1,12}$/.test(ma)) throw loi('MA_TS_SAI', ma);
    if (thay[ma]) throw loi('MA_TS_TRUNG', ma);
    thay[ma] = 1;
    var ten = catChu(x.ten, 60);
    if (!ten) throw loi('THIEU_TEN', ma);
    out.push({ ma: ma, ten: ten, zh: catChu(x.zh, 40), dv: catChu(x.dv, 10) || 'kWh', tich: x.tich !== false });
  });
  PropertiesService.getScriptProperties().setProperty('THONG_SO', JSON.stringify(out));
  return { thongSo: out };
}
// Công tơ còn thiếu ở kỳ gần nhất (để nhắc)
function thieuSoDien(homNay) {
  var cts = dsCongTo().filter(function (m) { return m.hoatDong; });
  if (!cts.length) return null;
  var ky = kyHienTai(homNay);
  var da = {};
  docChiSo().forEach(function (x) { if (x.ky === ky && x.trangThai !== 'HUY') da[x.ma] = 1; });
  var thieu = cts.filter(function (m) { return !da[m.ma]; }).map(function (m) { return m.ten; });
  return thieu.length ? { ky: ky, thieu: thieu, tong: cts.length } : null;
}

// ----- Nâng cấp dữ liệu từ bản cũ (chạy một lần cho mỗi phiên bản, tự gọi khi app tải dữ liệu) -----
// Thêm cột mới vào các trang, tính và lưu tiêu thụ cho mọi kỳ đã ghi.
function nangCapLanDau() {
  var pr = PropertiesService.getScriptProperties();
  if (pr.getProperty('NANG_CAP') === PHIEN_BAN) return null;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (pr.getProperty('NANG_CAP') === PHIEN_BAN) return null;
    Object.keys(BANG).forEach(function (t) { trang(t); capNhatTieuDe(t); });
    var n = tinhLaiTatCa();
    // Việc ghi từ bản trước chưa có bản dịch: đánh dấu để dịch dần (dichBu, mỗi lần tải dữ liệu vài việc)
    if (!pr.getProperty('DICH_THIEU')) pr.setProperty('DICH_THIEU', '2000-01-01 00:00:00');
    napChuyen();
    pr.setProperty('NANG_CAP', PHIEN_BAN);
    return 'Đã nâng cấp lên ' + PHIEN_BAN + ' · tính lại ' + n + ' kỳ';
  } finally { lock.releaseLock(); }
}
// Tính lại tiêu thụ mọi công tơ, ghi cả trang một lần. Chạy tay được trong trình soạn Apps Script.
function tinhLaiTatCa() {
  var raw = docTho('ChiSo');
  if (!raw.length) return 0;
  var ds = raw.map(csTuDong).filter(function (x) { return x.id && x.ma && x.ky; }), ts = docThongSo(), n = 0;
  dsCongTo().forEach(function (ct) { n += tinhLaiCT(ct, ds, {}, ts).length; });
  var cot = BANG.ChiSo.length;
  var rows = raw.map(function (r) { var a = r.slice(0, cot); while (a.length < cot) a.push(''); return a; });
  ds.forEach(function (x) { rows[x._r - 2] = csThanhDong(x); });
  var dd = dinhDang('ChiSo');
  trang('ChiSo').getRange(2, 1, rows.length, cot).setNumberFormats(rows.map(function () { return dd; })).setValues(rows);
  return n;
}

// ---------- Nhập số điện từ file Excel (DL_EXCEL ở cuối file) ----------
// Chạy một lần (đánh dấu ở Script Properties NHAP_EXCEL). Công tơ khớp theo tên (phần tiếng Việt);
// số đã có ở cùng công tơ + kỳ, hoặc đã từng nhập rồi xoá, thì bỏ qua → chạy lại không tạo trùng.
var NHAP_EXCEL = 'NHAP_EXCEL';
function khoaTen(t) { return s(t).split(' · ')[0].toLowerCase().replace(/\s+/g, ' '); }
// truocKy (chỉ bản xem thử): bỏ các kỳ từ kỳ này trở đi, để còn kỳ trống cho người thử ghi số
function nhapSoDienExcel(batBuoc, truocKy) {
  if (typeof DL_EXCEL === 'undefined' || !DL_EXCEL.ct || !DL_EXCEL.ct.length) return null;
  var pr = PropertiesService.getScriptProperties();
  if (!batBuoc && pr.getProperty(NHAP_EXCEL)) return null;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (!batBuoc && pr.getProperty(NHAP_EXCEL)) return null;
    trang('CongTo'); trang('ChiSo'); capNhatTieuDe('CongTo'); capNhatTieuDe('ChiSo');
    var ds = dsCongTo(), theoTen = {}, n = 0, luc = thoiGianStr(), moi = [];
    ds.forEach(function (c) {
      var k = khoaTen(c.ten);
      if (!theoTen[k] || (c.hoatDong && !theoTen[k].hoatDong)) theoTen[k] = c;
      var x = /^E(\d+)$/.exec(c.ma); if (x) n = Math.max(n, Number(x[1]));
    });
    var maCua = DL_EXCEL.ct.map(function (r) {
      var c = theoTen[khoaTen(r[0])];
      if (!c) {
        n++;
        c = { ma: 'E' + pad2(n), ten: r[0], soCongTo: '', viTri: '', heSo: r[2], thongSo: [], hoatDong: !!r[3], ghiChu: r[4] || '', capNhat: luc, loai: loaiCT(r[1]) };
        moi.push(ctThanhDong(c));
        theoTen[khoaTen(r[0])] = c;
      }
      return c.ma;
    });
    if (moi.length) themNhieu('CongTo', moi);
    var daCo = {};
    docChiSo().forEach(function (x) { daCo[x.id] = 1; if (x.trangThai !== 'HUY') daCo[x.ma + '|' + x.ky] = 1; });
    var rows = [];
    DL_EXCEL.ct.forEach(function (r, i) {
      r[5].forEach(function (v, j) {
        if (v === null || v === undefined || (truocKy && DL_EXCEL.ky[j] >= truocKy)) return;
        var ky = DL_EXCEL.ky[j], ma = maCua[i], id = 'CSX' + ma + ky.replace(/-/g, '');
        if (daCo[id] || daCo[ma + '|' + ky]) return;
        daCo[id] = daCo[ma + '|' + ky] = 1;
        rows.push(csThanhDong({ id: id, ky: ky, ma: ma, giaTri: { '1.8.0': v }, nguoi: 'Nhập từ Excel · Excel导入',
          thoiGian: ky + ' 00:00:00', ghiChu: (DL_EXCEL.gc && DL_EXCEL.gc[i + '|' + j]) || (DL_EXCEL.gk && DL_EXCEL.gk[j]) || '', uid: 'EXCEL', trangThai: 'OK', opId: '', suaLuc: '', nguon: 'EXCEL' }));
      });
    });
    if (rows.length) { themNhieu('ChiSo', rows); tinhLaiTatCa(); }
    pr.setProperty(NHAP_EXCEL, luc + ' · ' + moi.length + ' công tơ, ' + rows.length + ' chỉ số');
    return 'Đã nhập ' + moi.length + ' công tơ mới, ' + rows.length + ' chỉ số · 已导入' + moi.length + '块电表、' + rows.length + '条读数';
  } finally { lock.releaseLock(); }
}

// Chạy tay trong trình soạn Apps Script (chọn hàm này → Chạy) để nhập lại phần còn thiếu
function nhapLaiSoDienExcel() { return nhapSoDienExcel(true); }

// ----- Nhập công việc cũ từ Excel (DL_CU). Chạy tay MỘT lần trong Apps Script; chạy lại không tạo trùng -----
// Tạo tài khoản cho người có tên trong bảng (PIN ngẫu nhiên, in ở Nhật ký thực thi), rồi nhập việc đúng người làm, hạn, trạng thái.
// Bảng cũ không ghi ngày xong: việc đã xong lấy ngày xong = hạn hoàn thành.
function nhapDuLieuCu() {
  if (typeof DL_CU === 'undefined') return 'Không có dữ liệu cũ';
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ['NguoiDung', 'CongViec'].forEach(function (t) { trang(t); capNhatTieuDe(t); });
    var nvs = dsNguoiDung(), bay = thoiGianStr(), nguoi = {}, pinMoi = [], soU = 0, soNV = 0;
    nvs.forEach(function (d) {
      var k = /^U(\d+)$/.exec(d.id); if (k) soU = Math.max(soU, Number(k[1]));
      k = /^NV(\d+)$/.exec(d.maNV); if (k) soNV = Math.max(soNV, Number(k[1]));
    });
    var coMa = function (m) { return nvs.some(function (d) { return d.maNV === m; }); };
    DL_CU.nv.forEach(function (r) {
      var c = nvs.filter(function (d) { return (r[1] && d.maNV === r[1]) || khoaTen(d.ten) === khoaTen(r[2]) || (r[3] && d.tenZh === r[3]); })[0];
      if (!c) {
        var ma = r[1] && !coMa(r[1]) ? r[1] : '';
        while (!ma || coMa(ma)) { soNV++; ma = 'NV' + ('00' + soNV).slice(-3); }
        soU++;
        var pin = String(Math.floor(100000 + Math.random() * 900000));
        c = { id: 'U' + ('00' + soU).slice(-3), ten: r[2], vaiTro: r[4], pinHash: bamPin(pin), email: '', hoatDong: true, ngayTao: bay, maNV: ma, tenZh: r[3] };
        themDong('NguoiDung', ndThanhDong(c)); nvs.push(c);
        pinMoi.push(ma + ' · ' + r[2] + ' · PIN ' + pin);
      }
      nguoi[r[0]] = c;
    });
    var ds = docCongViec(), co = {}, so = soLonNhat(ds), rows = [], NGUON = 'Nhập từ Excel · Excel导入';
    ds.forEach(function (x) { co[x.id] = 1; });
    function viecMoi(id, tieuDe, ai, luc, han, loai) {
      var lam = nguoi[ai[0]], phu = ai.slice(1).map(function (k) { return nguoi[k]; });
      var td = songNgu(catChu(tieuDe, 200)), mt = s(tieuDe).length > 200 ? songNgu(catChu(tieuDe, 2000)) : ['', ''];
      so++;
      return { id: id, so: so, tieuDe: td[0], tieuDeDich: td[1], moTa: mt[0], moTaDich: mt[1], ketQuaDich: '', nguyenNhanDich: '',
        loai: loai, uuTien: 'TB', ma: '', han: han, trangThai: 'DA_GIAO', uidLam: lam.id, nguoiLam: lam.ten,
        uidPhu: phu.map(function (n) { return n.id; }), nguoiGiao: NGUON, uidGiao: '', lucGiao: luc, nguoiTao: NGUON, uidTao: '', lucTao: luc,
        lucBatDau: '', lucXong: '', ketQua: '', linhKien: [], anhTao: [], anhXong: [], canKiemTra: false, nguoiKiemTra: '', lucKiemTra: '',
        lapLai: '', opId: '', capNhat: bay, nguyenNhan: '', phutDung: '',
        nhatKy: [{ b: 'tao', luc: luc, uid: '', nguoi: NGUON, gc: '', op: '' },
          { b: 'giao', luc: luc, uid: '', nguoi: NGUON, gc: lam.ten + (phu.length ? ' + ' + phu.map(function (n) { return n.ten; }).join(', ') : ''), op: '' }] };
    }
    function buoc(x, b, luc, gc, gcDich) {
      x.nhatKy.push({ b: b, luc: luc, uid: x.uidLam, nguoi: x.nguoiLam, gc: gc || '', gcDich: gcDich || '', op: '' });
    }
    var nCV = 0, nSC = 0;
    DL_CU.cv.forEach(function (r) {
      var id = 'CVCU' + ('00' + r[0]).slice(-3);
      if (co[id]) return;
      var bd = r[3] + ' 08:00:00', x = viecMoi(id, r[1], r[2], bd, r[4], r[6]);
      x.trangThai = r[5]; x.lucBatDau = bd; buoc(x, 'batdau', bd);
      if (r[5] === 'DONG') { x.lucXong = (r[4] >= r[3] ? r[4] : r[3]) + ' 17:00:00'; buoc(x, 'xong', x.lucXong); }
      if (r[5] === 'TAM_HOAN') buoc(x, 'hoan', bd, 'Tạm dừng (theo bảng Excel cũ)', '暂停（按旧Excel表）');
      rows.push(cvThanhDong(x)); nCV++;
    });
    DL_CU.sc.forEach(function (r, i) {
      var id = 'CVSC' + r[0].replace(/-/g, '') + (i + 1);
      if (co[id]) return;
      var tu = r[0] + ' ' + r[4] + ':00', den = r[0] + ' ' + r[5] + ':00', x = viecMoi(id, r[1] + ': ' + r[2], [r[8]], tu, r[0], 'SUA');
      var kq = songNgu(r[3]), kt = nguoi.CHUNG;
      x.trangThai = 'DONG'; x.lucBatDau = tu; x.lucXong = den; x.ketQua = kq[0]; x.ketQuaDich = kq[1];
      x.phutDung = phutGiua(tu, den);
      if (r[6]) x.linhKien = [{ id: '', ten: r[6], quyCach: r[7] || '', dv: '', sl: 1, loai: 'THAY' }];
      buoc(x, 'batdau', tu); buoc(x, 'xong', den);
      if (kt) { x.canKiemTra = true; x.nguoiKiemTra = kt.ten; x.lucKiemTra = den; x.nhatKy.push({ b: 'kiemtra', luc: den, uid: kt.id, nguoi: kt.ten, gc: '', op: '' }); }
      rows.push(cvThanhDong(x)); nSC++;
    });
    if (rows.length) themNhieu('CongViec', rows);
    var kq = 'Đã nhập ' + nCV + ' việc, ' + nSC + ' việc sửa chữa, tạo ' + pinMoi.length + ' tài khoản';
    console.log(kq);
    if (pinMoi.length) console.log('Tài khoản mới (ghi lại PIN, đưa cho từng người):\n' + pinMoi.join('\n'));
    return kq;
  } finally { lock.releaseLock(); }
}

// Số liệu cho BẢN XEM THỬ (không chạy trên máy chủ thật):
// số hạ áp / nhánh thật từ DL_EXCEL + một công tơ cao áp MẪU bám theo tổng hạ áp (+2,5% tổn hao máy biến áp)
function mauSoDien() {
  if (dsCongTo().length) return;
  var luc = thoiGianStr();
  themNhieu('CongTo', [['E01', 'Công tơ tổng cao áp · 高压总表', 'EVN 21345678', 'Trạm biến áp 22kV', 2000, '', 1,
    'Số liệu MẪU (bản xem thử) · 示例数据 · TU 22kV/110V × TI 50/5', luc, 'cao']]);
  nhapSoDienExcel(true, kyHienTai(homNayStr()));
  // Tổng hạ áp theo tháng (kWh/ngày)
  var cts = dsCongTo(), heSo = {}, laHa = {};
  cts.forEach(function (c) { heSo[c.ma] = c.heSo; laHa[c.ma] = c.loai === 'ha'; });
  var theoCT = {};
  docChiSo().forEach(function (x) { if (laHa[x.ma]) (theoCT[x.ma] = theoCT[x.ma] || []).push(x); });
  var thang = {};
  Object.keys(theoCT).forEach(function (ma) {
    var a = theoCT[ma].sort(function (p, q) { return p.ky > q.ky ? 1 : -1; });
    for (var i = 1; i < a.length; i++) {
      var d = (a[i].giaTri['1.8.0'] - a[i - 1].giaTri['1.8.0']) * heSo[ma];
      if (d >= 0) thang[a[i].ky.slice(0, 7)] = (thang[a[i].ky.slice(0, 7)] || 0) + d;
    }
  });
  var ks = Object.keys(thang).sort();
  if (!ks.length) return;
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function r2(x) { return Math.round(x * 100) / 100; }
  var ky = DL_EXCEL.ky[0], cuoi = kyHienTai(homNayStr()), v = { '1.8.1': 21050, '1.8.2': 7400, '1.8.3': 9950, '2.8.0': 0.62, '3.8.0': 17750, '4.8.0': 10.5 };
  var nguoi = ['Lê Minh Tiến', 'Nguyễn tuấn', 'Đỗ Văn Hồng'], rows = [], j = 0, gt0 = {};
  gt0['1.8.0'] = r2(v['1.8.1'] + v['1.8.2'] + v['1.8.3']); Object.keys(v).forEach(function (k) { gt0[k] = v[k]; });
  rows.push(['CSE01' + ky.replace(/-/g, ''), ky, 'E01', JSON.stringify(gt0), nguoi[0], ky + ' 08:10:00', '', 'U003', 'OK', '', '']);
  while (ky < cuoi) {
    var sau = ky; ky = kyTiep(sau);
    j++;
    var ym = ky.slice(0, 7), cs = thang[ym] !== undefined ? ym : ks[ks.length - 1];
    var y0 = Number(cs.slice(0, 4)), m0 = Number(cs.slice(5, 7));
    var kwh = thang[cs] / cuoiThang(y0, m0) * soNgay(ky, sau) * 1.025 * (0.99 + rnd() * 0.02) / 2000;
    var mth = Number(ky.slice(5, 7)), q = (mth === 3 || mth === 7) ? 0.54 : 0.44 + rnd() * 0.04;
    var bt = 0.55 + rnd() * 0.03, cd = 0.19 + rnd() * 0.02;
    v['1.8.1'] = r2(v['1.8.1'] + kwh * bt); v['1.8.2'] = r2(v['1.8.2'] + kwh * cd); v['1.8.3'] = r2(v['1.8.3'] + kwh * (1 - bt - cd));
    v['3.8.0'] = r2(v['3.8.0'] + kwh * q); v['4.8.0'] = r2(v['4.8.0'] + rnd() * 0.002);
    var gt = {};
    gt['1.8.0'] = r2(v['1.8.1'] + v['1.8.2'] + v['1.8.3']);
    Object.keys(v).forEach(function (k) { gt[k] = v[k]; });
    rows.push(['CSE01' + ky.replace(/-/g, ''), ky, 'E01', JSON.stringify(gt), nguoi[j % 3], ky + ' 08:' + pad2(10 + (j % 40)) + ':00', '', 'U003', 'OK', '', '']);
  }
  themNhieu('ChiSo', rows);
}

// ===================== Báo tin (Telegram / email) =====================
function docCaiDat() {
  var t = PropertiesService.getScriptProperties().getProperty('CAI_DAT'), o = {};
  try { o = JSON.parse(t || '{}') || {}; } catch (e) { o = {}; }
  var c = {};
  Object.keys(CAI_DAT_MAC_DINH).forEach(function (k) { c[k] = o[k] !== undefined ? o[k] : CAI_DAT_MAC_DINH[k]; });
  return c;
}
function ghiCaiDat(c) { PropertiesService.getScriptProperties().setProperty('CAI_DAT', JSON.stringify(c)); }
function docLoiBaoTin() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('BAO_TIN_LOI') || 'null'); } catch (e) { return null; }
}
function ghiLoiBaoTin(ds) {
  if (ds.length) PropertiesService.getScriptProperties().setProperty('BAO_TIN_LOI', JSON.stringify({ luc: thoiGianStr(), loi: ds.join(' | ').slice(0, 500) }));
}
function layCaiDatBaoTin() {
  var c = docCaiDat();
  var lich = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'nhacHangNgay'; }).length > 0;
  return {
    nhacTruoc: c.nhacTruoc, gio: c.gio, tgBat: c.tgBat, tgCo: !!c.tgToken, tgDuoi: c.tgToken ? c.tgToken.slice(-4) : '',
    tgChat: c.tgChat, tgTen: c.tgTen, mailBat: c.mailBat, baoXong: c.baoXong, baoViec: c.baoViec, linkApp: c.linkApp, lichBat: lich,
    loi: docLoiBaoTin(),
    nhanMail: dsNguoiDung().filter(function (x) { return x.hoatDong && x.email; }).map(function (x) { return x.ten + ' <' + x.email + '>'; })
  };
}
function luuCaiDatBaoTin(p) {
  var c = docCaiDat();
  if (p.nhacTruoc !== undefined) {
    var n = Math.round(Number(p.nhacTruoc));
    if (!(n >= 0 && n <= 30)) throw loi('SO_SAI', 'Số ngày 0–30');
    c.nhacTruoc = n;
  }
  if (p.gio !== undefined) {
    var g = Math.round(Number(p.gio));
    if (!(g >= 0 && g <= 23)) throw loi('SO_SAI', 'Giờ 0–23');
    c.gio = g;
  }
  ['tgBat', 'mailBat', 'baoXong', 'baoViec'].forEach(function (k) { if (p[k] !== undefined) c[k] = !!p[k]; });
  if (p.xoaTg) { c.tgToken = ''; c.tgChat = ''; c.tgTen = ''; c.tgBat = false; }
  if (s(p.tgToken)) c.tgToken = s(p.tgToken);
  if (p.tgChat !== undefined) { c.tgChat = s(p.tgChat); c.tgTen = catChu(p.tgTen, 80); }
  if (s(p.linkApp)) c.linkApp = s(p.linkApp).slice(0, 300);
  if (c.tgBat && (!c.tgToken || !c.tgChat)) throw loi('TG_CHUA_DU', 'Chưa đủ mã bot và nhóm Telegram');
  ghiCaiDat(c);
  datLichNhac(c.gio);
  return layCaiDatBaoTin();
}
function datLichNhac(gio) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'nhacHangNgay') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nhacHangNgay').timeBased().everyDays(1).atHour(Number(gio) || 0).inTimezone(TZ).create();
}
function goiTelegram(token, method, body) {
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body || {}), muteHttpExceptions: true
  });
  try { return JSON.parse(r.getContentText()) || {}; } catch (e) { return { ok: false, description: 'HTTP ' + r.getResponseCode() }; }
}
function timNhomTelegram(p) {
  var token = s(p.tgToken) || docCaiDat().tgToken;
  if (!token) throw loi('TG_THIEU_MA', 'Chưa nhập mã bot');
  var o = goiTelegram(token, 'getUpdates', {});
  if (!o.ok) throw loi('TG_MA_SAI', o.description || 'Mã bot không đúng');
  var thay = {}, ds = [];
  (o.result || []).forEach(function (up) {
    var msg = up.message || up.channel_post || up.edited_message || up.my_chat_member;
    var c = msg && msg.chat;
    if (!c || thay[c.id]) return;
    thay[c.id] = 1;
    ds.push({ id: String(c.id), ten: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || String(c.id), nhom: c.type !== 'private' });
  });
  ds.sort(function (a, b) { return (b.nhom ? 1 : 0) - (a.nhom ? 1 : 0); });
  return { chats: ds };
}
function guiTelegram(c, text) {
  var o = goiTelegram(c.tgToken, 'sendMessage', { chat_id: c.tgChat, text: text, parse_mode: 'HTML', disable_web_page_preview: true });
  if (!o.ok && o.parameters && o.parameters.migrate_to_chat_id) {
    c.tgChat = String(o.parameters.migrate_to_chat_id);
    ghiCaiDat(c);
    o = goiTelegram(c.tgToken, 'sendMessage', { chat_id: c.tgChat, text: text, parse_mode: 'HTML', disable_web_page_preview: true });
  }
  if (!o.ok) throw new Error('Telegram: ' + (o.description || 'lỗi gửi'));
}
function guiEmail(tieuDe, text, html) {
  var ds = dsNguoiDung().filter(function (x) { return x.hoatDong && x.email; }).map(function (x) { return x.email; });
  if (!ds.length) throw new Error('Email: chưa có người nhận (nhập email ở màn Người dùng)');
  MailApp.sendEmail({ to: ds.join(','), subject: tieuDe, body: text, htmlBody: html, name: 'Lịch bảo dưỡng 设备保养' });
  return ds.length;
}
function escH(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function tomTat(homNay, nhacTruoc) {
  var t = { qua: [], nay: [], sap: [] };
  dsMay().forEach(function (m) {
    if (!m.hoatDong || !m.hanKeTiep) return;
    var d = soNgay(m.hanKeTiep, homNay);
    var o = { ma: m.ma, ten: m.ten, han: m.hanKeTiep, d: d };
    if (d < 0) t.qua.push(o); else if (d === 0) t.nay.push(o); else if (d <= nhacTruoc) t.sap.push(o);
  });
  t.qua.sort(function (a, b) { return a.d - b.d; });
  t.sap.sort(function (a, b) { return a.d - b.d; });
  t.dien = thieuSoDien(homNay);
  t.choDuyet = docChiSo().filter(function (x) { return x.trangThai === 'CHO_DUYET'; }).length;
  var cv = docCongViec().filter(function (x) { return CV_MO.indexOf(x.trangThai) >= 0; });
  t.cvQua = cv.filter(function (x) { return x.han && x.han < homNay && x.trangThai !== 'CHO_GIAO'; })
    .sort(function (a, b) { return a.han < b.han ? -1 : 1; })
    .map(function (x) { return { so: x.so, ten: hai(x.tieuDe, x.tieuDeDich), nguoi: x.nguoiLam, han: x.han }; });
  t.cvCho = cv.filter(function (x) { return x.trangThai === 'CHO_GIAO'; }).length;
  return t;
}
function coNhac(t) { return !!(t.qua.length || t.nay.length || t.sap.length || t.dien || t.choDuyet || (t.cvQua && t.cvQua.length) || t.cvCho); }
function noiDungNhac(t, homNay, c, thu) {
  var TOI_DA = 30;
  function dong(o, loai) {
    if (loai === 'qua') return o.ten + ' — quá ' + (-o.d) + ' ngày · 逾期' + (-o.d) + '天 (' + ngayVN(o.han) + ')';
    if (loai === 'sap') return ngayVN(o.han).slice(0, 5) + ' — ' + o.ten + ' (còn ' + o.d + ' ngày · 还有' + o.d + '天)';
    return o.ten;
  }
  var nhom = [
    { k: 'qua', tg: '🔴 Quá hạn · 逾期', mau: '#C8372D' },
    { k: 'nay', tg: '🟠 Hôm nay · 今天', mau: '#E4731B' },
    { k: 'sap', tg: '🔵 Sắp đến (≤' + c.nhacTruoc + ' ngày) · 即将到期', mau: '#3565B8' }
  ];
  var tieuDe = (thu ? '[Gửi thử · 测试] ' : '') + 'Nhắc bảo dưỡng · 保养提醒 ' + ngayVN(homNay) +
    ' — ' + t.qua.length + ' quá hạn, ' + t.nay.length + ' hôm nay' +
    (t.dien ? ', số điện còn ' + t.dien.thieu.length + ' công tơ' : '') +
    (t.cvQua && t.cvQua.length ? ', ' + t.cvQua.length + ' việc quá hạn' : '');
  var tg = '<b>' + (thu ? '[Gửi thử · 测试] ' : '') + '🔧 NHẮC BẢO DƯỠNG · 保养提醒</b>\n' + ngayVN(homNay) + '\n';
  var text = tieuDe + '\n';
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#16211F">' +
    '<h2 style="margin:0 0 8px">Nhắc bảo dưỡng · 保养提醒 — ' + ngayVN(homNay) + '</h2>';
  var coGi = false;
  nhom.forEach(function (g) {
    var ds = t[g.k];
    if (!ds.length) return;
    coGi = true;
    tg += '\n<b>' + g.tg + ' (' + ds.length + ')</b>\n';
    text += '\n' + g.tg + ' (' + ds.length + ')\n';
    html += '<h3 style="margin:14px 0 4px;color:' + g.mau + '">' + escH(g.tg) + ' (' + ds.length + ')</h3><ul style="margin:0;padding-left:18px">';
    ds.slice(0, TOI_DA).forEach(function (o) {
      tg += '• ' + escH(dong(o, g.k)) + '\n';
      text += '- ' + dong(o, g.k) + '\n';
      html += '<li>' + escH(dong(o, g.k)) + '</li>';
    });
    if (ds.length > TOI_DA) {
      var them = '… và ' + (ds.length - TOI_DA) + ' máy khác · 等' + (ds.length - TOI_DA) + '台';
      tg += escH(them) + '\n'; text += them + '\n'; html += '<li>' + escH(them) + '</li>';
    }
    html += '</ul>';
  });
  if (t.dien) {
    coGi = true;
    var dt = '⚡ Ghi số điện kỳ ' + ngayVN(t.dien.ky).slice(0, 5) + ' · 抄电表 — còn ' + t.dien.thieu.length + '/' + t.dien.tong + ' công tơ';
    tg += '\n<b>' + escH(dt) + '</b>\n'; text += '\n' + dt + '\n';
    html += '<h3 style="margin:14px 0 4px;color:#2F62B8">' + escH(dt) + '</h3><ul style="margin:0;padding-left:18px">';
    var TOI_DA_CT = 20;
    t.dien.thieu.slice(0, TOI_DA_CT).forEach(function (n) { tg += '• ' + escH(n) + '\n'; text += '- ' + n + '\n'; html += '<li>' + escH(n) + '</li>'; });
    if (t.dien.thieu.length > TOI_DA_CT) {
      var con = '… và ' + (t.dien.thieu.length - TOI_DA_CT) + ' công tơ khác · 等' + (t.dien.thieu.length - TOI_DA_CT) + '块电表';
      tg += escH(con) + '\n'; text += con + '\n'; html += '<li>' + escH(con) + '</li>';
    }
    html += '</ul>';
  }
  if (t.choDuyet) {
    coGi = true;
    var cd = '⚠ ' + t.choDuyet + ' số điện/nước ngoại lệ chờ Quản lý duyệt · ' + t.choDuyet + '条抄表异常待审核';
    tg += '\n<b>' + escH(cd) + '</b>\n'; text += '\n' + cd + '\n'; html += '<h3 style="margin:14px 0 4px;color:#C8372D">' + escH(cd) + '</h3>';
  }
  if ((t.cvQua && t.cvQua.length) || t.cvCho) {
    coGi = true;
    var sv = '📋 Công việc · 工作: ' + (t.cvQua ? t.cvQua.length : 0) + ' quá hạn · 逾期' + (t.cvCho ? ', ' + t.cvCho + ' chưa giao · 未派工' : '');
    tg += '\n<b>' + escH(sv) + '</b>\n'; text += '\n' + sv + '\n';
    html += '<h3 style="margin:14px 0 4px;color:#C8372D">' + escH(sv) + '</h3><ul style="margin:0;padding-left:18px">';
    (t.cvQua || []).slice(0, 20).forEach(function (o) {
      var d = '#' + o.so + ' ' + o.ten + ' — ' + (o.nguoi || '?') + ' — hạn · 期限 ' + ngayVN(o.han).slice(0, 5);
      tg += '• ' + escH(d) + '\n'; text += '- ' + d + '\n'; html += '<li>' + escH(d) + '</li>';
    });
    html += '</ul>';
  }
  if (!coGi) {
    var khong = 'Không có máy nào đến hạn · 没有到期的设备';
    tg += '\n' + khong + '\n'; text += '\n' + khong + '\n'; html += '<p>' + khong + '</p>';
  }
  if (c.linkApp) {
    tg += '\n👉 <a href="' + escH(c.linkApp) + '">Mở app · 打开应用</a>';
    text += '\nMở app · 打开应用: ' + c.linkApp;
    html += '<p><a href="' + escH(c.linkApp) + '">Mở app · 打开应用</a></p>';
  }
  html += '</div>';
  return { tieuDe: tieuDe, tg: tg, text: text, html: html, coGi: coGi };
}

// Trigger hằng ngày (tạo bằng datLichNhac)
function nhacHangNgay() {
  try { taoViecLap(false); } catch (e) { console.log('taoViecLap: ' + (e && e.message || e)); }
  try { dichBu(60, true); } catch (e) { console.log('dichBu: ' + (e && e.message || e)); }
  var c = docCaiDat();
  if (!c.tgBat && !c.mailBat) return;
  var homNay = homNayStr(), t = tomTat(homNay, c.nhacTruoc);
  if (!coNhac(t)) return;
  var nd = noiDungNhac(t, homNay, c, false), loiDs = [];
  if (c.tgBat) { try { guiTelegram(c, nd.tg); } catch (e) { loiDs.push(String(e.message || e)); } }
  if (c.mailBat) { try { guiEmail(nd.tieuDe, nd.text, nd.html); } catch (e) { loiDs.push(String(e.message || e)); } }
  ghiLoiBaoTin(loiDs);
}
function guiThu() {
  var c = docCaiDat();
  if (!c.tgBat && !c.mailBat) throw loi('CHUA_BAT', 'Chưa bật kênh báo tin nào');
  var homNay = homNayStr(), nd = noiDungNhac(tomTat(homNay, c.nhacTruoc), homNay, c, true);
  var kq = { tg: null, mail: null }, loiDs = [];
  if (c.tgBat) { try { guiTelegram(c, nd.tg); kq.tg = 'ok'; } catch (e) { kq.tg = String(e.message || e); loiDs.push(kq.tg); } }
  if (c.mailBat) { try { kq.mail = guiEmail(nd.tieuDe, nd.text, nd.html); } catch (e) { kq.mail = String(e.message || e); loiDs.push(kq.mail); } }
  if (loiDs.length) ghiLoiBaoTin(loiDs); else PropertiesService.getScriptProperties().deleteProperty('BAO_TIN_LOI');
  return kq;
}
function soGon(v) { return String(Math.round(Number(v) * 1000) / 1000); }
function tomTatChiTiet(ct) {
  if (!ct) return '';
  var t = '';
  if (ct.kt.length) {
    var loi = ct.kt.filter(function (h) { return h.kq === 'LOI'; });
    t += 'Kiểm tra · 检查: ' + (ct.kt.length - loi.length) + '/' + ct.kt.length + ' đạt · 合格' +
      (loi.length ? '\n⚠ ' + loi.map(function (h) { return escH(h.ten + (h.gc ? ' (' + h.gc + ')' : '')); }).join('; ') : '') + '\n';
  }
  if (ct.so.length) {
    t += 'Số đo · 测量: ' + ct.so.map(function (h) { return escH(h.ten) + ' ' + soGon(h.v) + (h.dv ? ' ' + escH(h.dv) : '') + (h.vuot ? ' ⚠' : ''); }).join('; ') + '\n';
  }
  if (ct.lk.length) {
    t += 'Linh kiện · 零件: ' + ct.lk.map(function (k) { return escH(k.ten) + ' ×' + soGon(k.sl) + (k.dv ? ' ' + escH(k.dv) : '') + (k.loai === 'BOSUNG' ? ' (bổ sung · 补充)' : ''); }).join('; ') + '\n';
  }
  return t;
}
function guiTinCho() {
  if (!TIN_CHO.length) return;
  var ds = TIN_CHO; TIN_CHO = [];
  var c;
  try { c = docCaiDat(); } catch (e) { return; }
  if (!c.tgBat || !c.tgToken || !c.tgChat) return;
  var loiDs = [];
  ds.forEach(function (tin) {
    var txt = '';
    if (tin.loai === 'xong' && c.baoXong) {
      var b = tin.ban;
      txt = '✅ <b>Đã bảo dưỡng · 已保养</b>: ' + escH(tin.may.ten) + '\n' +
        'Ngày · 日期: ' + ngayVN(b.ngay) + ' · Người làm · 执行人: ' + escH(b.nguoi) + '\n' +
        (b.ghiChu ? 'Ghi chú · 备注: ' + escH(b.ghiChu) + '\n' : '') + tomTatChiTiet(b.chiTiet) +
        'Hạn kế tiếp · 下次: ' + ngayVN(tin.may.hanKeTiep);
    } else if (tin.loai === 'giao' && c.baoViec) {
      txt = tinGiaoViec(tin, c);
    }
    if (!txt) return;
    try { guiTelegram(c, txt); } catch (e) { loiDs.push(String(e.message || e)); }
  });
  ghiLoiBaoTin(loiDs);
}
var TEN_UU_CV = { GAP: '🔴 Gấp · 紧急', CAO: '🟠 Cao · 高', TB: '' };
function tinGiaoViec(tin, c) {
  var t = '📋 <b>GIAO VIỆC · 派工</b> → ' + escH(tin.lam.ten) + (tin.phu.length ? ' + ' + escH(tin.phu.map(function (n) { return n.ten; }).join(', ')) : '') + '\n' +
      tin.ds.map(function (x) {
        return '• #' + x.so + ' ' + escH(hai(x.tieuDe, x.tieuDeDich)) + (TEN_UU_CV[x.uuTien] ? ' ' + TEN_UU_CV[x.uuTien] : '') + (x.han ? ' — hạn · 期限 ' + ngayVN(x.han).slice(0, 5) : '');
      }).join('\n') + '\nGiao bởi · 派工人: ' + escH(tin.boi);
  if (c.linkApp) t += '\n👉 <a href="' + escH(c.linkApp) + '">Mở app · 打开应用</a>';
  return t;
}
// ===================== Mục kiểm tra, linh kiện MẪU (chỉ bản xem thử) =====================
function mauKiemTra() {
  var ds = dsMay();
  if (ds.some(function (m) { return m.hangMuc.length || m.linhKien.length; })) return;
  capNhatTieuDe('May'); capNhatTieuDe('LichSu');
  var mau = {
    'Máy in phun · 喷印机': {
      hangMuc: [
        { id: 'HM01', ten: 'Vệ sinh đầu phun · 清洁喷头', kieu: 'OK' },
        { id: 'HM02', ten: 'Mức mực, dung môi · 墨水、溶剂液位', kieu: 'OK' },
        { id: 'HM03', ten: 'Ống mực, rò rỉ · 墨管、泄漏', kieu: 'OK' },
        { id: 'HM04', ten: 'Quạt, lọc gió · 风扇、空气过滤', kieu: 'OK' },
        { id: 'HM05', ten: 'Áp suất mực · 墨水压力', kieu: 'SO', dv: 'bar', min: 2.5, max: 3.5 },
        { id: 'HM06', ten: 'Nhiệt độ đầu in · 喷头温度', kieu: 'SO', dv: '°C', min: 15, max: 40 }
      ],
      linhKien: [
        { id: 'LK01', ten: 'Lọc mực chính · 主墨水过滤器', quyCach: '10 µm', dv: 'cái · 个', sl: 1, ghiChu: '' },
        { id: 'LK02', ten: 'Lọc gió · 空气过滤器', quyCach: '', dv: 'cái · 个', sl: 1, ghiChu: '' },
        { id: 'LK03', ten: 'Gioăng đầu phun · 喷头密封圈', quyCach: 'Φ12', dv: 'cái · 个', sl: 2, ghiChu: '' },
        { id: 'LK04', ten: 'Mực in · 墨水', quyCach: '500 ml', dv: 'chai · 瓶', sl: '', ghiChu: 'Vật tư tiêu hao · 耗材' },
        { id: 'LK05', ten: 'Dung môi · 溶剂', quyCach: '500 ml', dv: 'chai · 瓶', sl: '', ghiChu: 'Vật tư tiêu hao · 耗材' }
      ]
    },
    'Khí nén · 空压机': {
      hangMuc: [
        { id: 'HM01', ten: 'Mức dầu máy nén · 空压机油位', kieu: 'OK' },
        { id: 'HM02', ten: 'Xả nước bình chứa · 储气罐排水', kieu: 'OK' },
        { id: 'HM03', ten: 'Vệ sinh lọc gió · 清洁空气滤芯', kieu: 'OK' },
        { id: 'HM04', ten: 'Dây curoa · 皮带', kieu: 'OK' },
        { id: 'HM05', ten: 'Áp suất khí · 气压', kieu: 'SO', dv: 'bar', min: 6, max: 8 },
        { id: 'HM06', ten: 'Nhiệt độ khí xả · 排气温度', kieu: 'SO', dv: '°C', min: 70, max: 95 }
      ],
      linhKien: [
        { id: 'LK01', ten: 'Lọc gió · 空气滤芯', quyCach: '', dv: 'cái · 个', sl: 6, ghiChu: '1 cái/máy · 每台1个' },
        { id: 'LK02', ten: 'Lọc dầu · 机油滤芯', quyCach: '', dv: 'cái · 个', sl: 6, ghiChu: '' },
        { id: 'LK03', ten: 'Lọc tách dầu · 油分离器', quyCach: '', dv: 'cái · 个', sl: 6, ghiChu: '' },
        { id: 'LK04', ten: 'Dầu máy nén · 空压机油', quyCach: 'ISO VG46', dv: 'lít · 升', sl: 120, ghiChu: '' },
        { id: 'LK05', ten: 'Dây curoa · 皮带', quyCach: 'SPA 1250', dv: 'sợi · 条', sl: 6, ghiChu: '' }
      ]
    }
  };
  var luc = thoiGianStr();
  ds.forEach(function (m) {
    var x = mau[m.nhom];
    if (!x) return;
    m.hangMuc = JSON.parse(JSON.stringify(x.hangMuc)); m.linhKien = JSON.parse(JSON.stringify(x.linhKien));
    m.capNhat = luc;
    suaDong('May', m._r, mayThanhDong(m));
  });
  function kt(ds, loi) {
    return ds.filter(function (h) { return h.kieu === 'OK'; }).map(function (h) {
      return { id: h.id, ten: h.ten, kq: loi[h.id] ? 'LOI' : 'DAT', gc: loi[h.id] || '' };
    });
  }
  function so(ds, v) {
    return ds.filter(function (h) { return h.kieu === 'SO'; }).map(function (h, i) {
      return { id: h.id, ten: h.ten, v: v[i], dv: h.dv, min: h.min, max: h.max, vuot: v[i] < h.min || v[i] > h.max };
    });
  }
  function lk(ds, a) {
    return a.map(function (r) {
      var k = ds.filter(function (y) { return y.id === r[0]; })[0];
      return { id: k.id, ten: k.ten, quyCach: k.quyCach, dv: k.dv, sl: r[1], loai: r[2] || 'THAY' };
    });
  }
  var ip = mau['Máy in phun · 喷印机'], kn = mau['Khí nén · 空压机'];
  var ct = {
    'M001|2026-09-06': { kt: kt(ip.hangMuc, {}), so: so(ip.hangMuc, [3.1, 27]), lk: lk(ip.linhKien, [['LK04', 2, 'BOSUNG'], ['LK05', 3, 'BOSUNG']]) },
    'M009|2026-09-06': { kt: kt(ip.hangMuc, {}), so: so(ip.hangMuc, [3.0, 26]), lk: lk(ip.linhKien, [['LK05', 2, 'BOSUNG']]) },
    'M002|2026-09-19': { kt: kt(ip.hangMuc, {}), so: so(ip.hangMuc, [2.9, 28]), lk: lk(ip.linhKien, [['LK01', 1], ['LK04', 1, 'BOSUNG']]) },
    'M005|2026-09-19': { kt: kt(ip.hangMuc, { HM04: 'Quạt kêu to · 风扇噪音大' }), so: so(ip.hangMuc, [3.2, 31]), lk: lk(ip.linhKien, [['LK02', 1]]) },
    'M008|2026-09-22': { kt: kt(ip.hangMuc, {}), so: so(ip.hangMuc, [3.0, 29]), lk: [] },
    'M001|2026-09-22': { kt: kt(ip.hangMuc, { HM03: 'Ống mực nứt, đã thay · 墨管裂，已更换' }), so: so(ip.hangMuc, [2.4, 30]),
      lk: lk(ip.linhKien, [['LK01', 1], ['LK03', 2], ['LK05', 2, 'BOSUNG']]) },
    'M038|2026-09-22': { kt: kt(kn.hangMuc, {}), so: so(kn.hangMuc, [7.2, 86]), lk: lk(kn.linhKien, [['LK01', 2], ['LK04', 18, 'BOSUNG']]) }
  };
  docLichSu().forEach(function (x) {
    var c = ct[x.ma + '|' + x.ngay];
    if (!c || x.chiTiet) return;
    x.chiTiet = sachChiTiet(c);
    suaDong('LichSu', x._r, lsThanhDong(x));
  });
}

// ===================== Cài đặt lần đầu =====================
// Chạy hàm này một lần trong trình soạn Apps Script (nó cũng hỏi cấp quyền).
function caiDatBanDau() {
  ['May', 'LichSu', 'NguoiDung', 'CongTo', 'ChiSo', 'NhatKy', 'CongViec', 'ViecLap', 'Chuyen'].forEach(trang);
  thuocTinh('SALT'); thuocTinh('TOKEN_KEY');
  if (!dsNguoiDung().length) {
    var bay = thoiGianStr();
    themNhieu('NguoiDung', [
      ['U001', 'Quản trị', 'admin', bamPin('111111'), '', 1, bay, 'NV001', ''],
      ['U002', 'Quản lý', 'quanly', bamPin('222222'), '', 1, bay, 'NV002', ''],
      ['U003', 'Kỹ thuật', 'kythuat', bamPin('333333'), '', 1, bay, 'NV003', '']
    ]);
  }
  if (!dsMay().length) {
    var luc = thoiGianStr(), ten = {};
    themNhieu('May', MAU_MAY.map(function (m) {
      ten[m[0]] = m[1];
      return [m[0], m[1], '', m[2], '', m[3], m[4], '', 1, luc];
    }));
    if (!docLichSu().length) {
      themNhieu('LichSu', MAU_LS.map(function (h, i) {
        return ['LS' + (1000 + i), h[0], ten[h[0]] || '', h[1], h[1], h[2], h[3], 'Nhập từ Excel · Excel导入',
          h[1] + ' 00:00:00', 'OK', '', '', ''];
      }));
    }
  }
  napChuyen();
  var c = docCaiDat();
  ghiCaiDat(c);
  try { datLichNhac(c.gio); } catch (e) { /* chạy lại sau khi cấp quyền */ }
  try { MailApp.getRemainingDailyQuota(); } catch (e) { /* chạm quyền gửi thư */ }
  return 'Đã cài xong · 安装完成. NV001/111111 · NV002/222222 · NV003/333333';
}

// ===================== Số điện từ file Excel =====================
// Mỗi công tơ: [tên, loại, hệ số, hoạt động, ghi chú, [chỉ số theo từng kỳ trong ky (null = không có)]]
// gc: ghi chú của từng số, khoá 'công tơ|kỳ' (số thứ tự) · gk: ghi chú chung cho cả kỳ
// [DL_EXCEL] tạo bằng tools/excel_dien.py — không sửa tay
var DL_EXCEL = {"nguon":"Sổ điện Credible T1–T10/2026 (đến kỳ 10/10)","ky":["2025-12-31","2026-01-10","2026-01-20","2026-01-31","2026-02-10","2026-02-20","2026-02-28","2026-03-10","2026-03-20","2026-03-31","2026-04-10","2026-04-20","2026-04-30","2026-05-10","2026-05-20","2026-05-31","2026-06-10","2026-06-20","2026-06-30","2026-07-10","2026-07-20","2026-07-31","2026-08-10","2026-08-20","2026-08-31","2026-09-10","2026-09-20","2026-09-30","2026-10-10"],"gc":{"0|0":"Sổ ghi 17259 (thiếu dấu thập phân) · 原表记17259","0|1":"Sổ ghi 20377 (thiếu dấu thập phân) · 原表记20377","0|2":"Sổ ghi 23771 (thiếu dấu thập phân) · 原表记23771","0|3":"Sổ ghi 28169 (thiếu dấu thập phân) · 原表记28169","0|4":"Sổ ghi 31486 (thiếu dấu thập phân) · 原表记31486","0|6":"Sổ ghi 34055 (thiếu dấu thập phân) · 原表记34055","0|7":"Sổ ghi 38063 (thiếu dấu thập phân) · 原表记38063","0|8":"Sổ ghi 42441 (thiếu dấu thập phân) · 原表记42441","0|9":"Sổ ghi 47288 (thiếu dấu thập phân) · 原表记47288","0|10":"Sổ ghi 51923 (thiếu dấu thập phân) · 原表记51923","0|11":"Sổ ghi 56551 (thiếu dấu thập phân) · 原表记56551"},"gk":{"16":"Ghi ngày 12/06 · 6月12日抄表"},"ct":[
  ["Tủ điện tổng số 1 · 1号总配电柜","ha",1000,1,"Công tơ hiển thị MWh, hệ số 1000 để ra kWh. Sổ T1–T4/2026 ghi thiếu dấu thập phân (vd 60524), đã chia 10 · 电表显示MWh，倍率1000换算为kWh。1–4月原表漏写小数点，已除以10",[1725.9,2037.7,2377.1,2816.9,3148.6,null,3405.5,3806.3,4244.1,4728.8,5192.3,5655.1,6052.4,6448.6,6870.6,7429.0,7942.8,8315.4,8696.1,null,null,9953.6,10378.0,10860.0,11306.0,11694,12145,12544,12925]],
  ["Tủ điện tổng số 2 · 2号总配电柜","ha",1000,1,"Công tơ hiển thị MWh, hệ số 1000 để ra kWh · 电表显示MWh，倍率1000换算为kWh",[255.0,314.3,384.0,475.3,544.0,null,549.26,600.42,673.87,768.27,864.46,968.32,1049.5,1140.6,1248.5,1377.2,1501.7,1588.1,1711.5,null,null,2072.6,2192.3,2333.2,2483.7,2574.6,2694.7,2720.6,2765.2]],
  ["Máy nén khí số 1 · 空压机1号","nhanh",1,1,"",[171234.0,189218.0,207471.0,228270.0,236206.0,null,242929.0,252512.0,269532.0,279032.0,289028.0,294996.0,299703.53,309273.71,319649.9,349314.06,375330.43,400329.87,424354.43,null,null,490563.4,515303.4,542325.25,571229.87,594446.43,623372.87,649854.87,671573.12]],
  ["Máy nén khí số 2 · 空压机2号","nhanh",1,1,"",[129728.0,155459.0,182234.0,216700.0,228671.0,null,246271.0,274148.0,304639.0,337809.0,368691.0,398246.0,422767.18,445333.56,474341.93,508867.9,534276.18,546958.5,557167.68,null,null,593928.5,609064.31,630963.31,642631.37,658618.12,670581,677209.37,688616.68]],
  ["Máy nén khí số 3 · 空压机3号","nhanh",1,1,"",[220612.0,220663.0,220758.0,220993.0,245155.0,null,258744.0,272286.0,286495.0,307293.0,324376.0,344916.0,365330.18,386986.34,408200.93,441471.75,460702.43,468857.03,474922.87,null,null,500999.43,513657.09,525761.5,535154.68,539021.68,546372.5,551026.25,556201.75]],
  ["Máy nén khí số 4 · 空压机4号","nhanh",1,1,"",[184443.0,206862.0,230738.0,263118.0,283444.0,null,291630.0,312114.0,333873.0,360027.0,384781.0,409604.0,430569.0,445470.0,464392.31,471154.25,495850.81,520841.5,548171.87,null,null,639347.12,665528.5,693500.0,718118.0,743670.75,772427.12,791438.06,818146.68]],
  ["Máy nén khí số 5 · 空压机5号","nhanh",1,1,"",[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,0.0,0.0,24.42,null,null,507.25,702.12,2013.8,15036.7,17406.52,27044.25,35080.37,41294.42]],
  ["Máy nén khí số 6 · 空压机6号","nhanh",1,1,"",[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,22.39,110.27,10756.59,null,null,35594.0,41051.39,48614.52,53782.35,59702.07,65431.35,70156.02,72860.62]],
  ["Máy sấy lạnh · 冷干机","nhanh",1,1,"",[12345.0,13126.0,13989.0,15143.0,16106.0,null,16822.0,18024.0,19279.0,20781.0,22179.0,23573.0,24735.79,25888.18,27290.15,28992.15,30609.21,32041.25,33605.66,null,null,38424.48,39839.42,41400.66,42901.58,44191.55,45816.63,46978.64,50237.7]],
  ["VKY01","nhanh",1,1,"",[104150.0,120790.0,137752.0,159602.0,177475.0,null,189115.0,207262.0,225240.0,243799.0,261392.0,278745.0,292245.81,306854.4,322878.06,342194.4,360808.53,369580.18,381213.59,null,null,403163.43,414466.31,416085.21,417472.9,418531.56,419945.87,431882.87,436337.78]],
  ["VKY02","nhanh",1,1,"",[179250.0,209254.0,244408.0,286471.0,319198.0,null,343579.0,377355.0,415658.0,454607.0,487509.0,526139.0,554874.18,582497.06,613563.37,653805.18,691907.12,718774.0,748128.62,null,null,846583.37,874447.18,911100.87,941786.5,970318.62,1004529,1038467,1069913]],
  ["VKY03","nhanh",1,1,"",[160523.0,193606.0,226249.0,266027.0,300093.0,null,321202.0,353437.0,390003.0,423548.0,457940.0,492794.0,519895.0,548277.31,583273.68,621169.37,656156.31,683075.62,722825.68,null,null,845364.18,886014.0,932106.68,975897.5,1010071,1053539,1061085,1080045]],
  ["VKY04","nhanh",1,1,"",[146248.0,183465.0,217811.0,269302.0,303317.0,null,326268.0,366869.0,409894.0,457490.0,499459.0,537246.0,566213.31,598866.37,634479.68,678060.0,723603.12,757835.68,800601.87,null,null,930237.18,972691.37,1022016.0,1068098.0,1105118,1150323,1157783,1179632]],
  ["VKY06","nhanh",1,1,"",[168347.0,189922.0,212948.0,243602.0,262249.0,null,278221.0,301580.0,327474.0,353718.0,379367.0,403299.0,424146.31,442412.09,465941.59,493343.68,497376.15,507539.18,508745.0,null,null,532633.56,551437.31,574260.87,594860.37,615109.62,637145.12,659209.12,677662.37]],
  ["VKY08","nhanh",1,1,"",[325053.0,345372.0,364435.0,381890.0,406734.0,null,416237.0,437587.0,461688.0,486250.0,510357.0,531642.0,551143.37,568692.75,589100.87,611481.25,632890.18,651006.93,670541.68,null,null,718608.38,736355.56,758672.37,780813.87,799467.31,823255.68,840149.68,852537.62]],
  ["VKY09","nhanh",1,1,"",[null,null,null,null,null,null,0.0,0.0,8478.0,27634.0,46418.0,64427.0,79868.7,95151.87,111914.85,133066.75,152723.79,160584.84,174250.15,null,null,222580.2,237185.0,255246.96,272376.03,285957.53,287468.31,288287.84,288621.31]],
  ["VKY10","nhanh",1,1,"",[null,null,null,null,null,null,0.0,0.0,0.0,147.59,336.0,692.0,960.99,1314.11,1753.92,2297.77,2826.25,3201.21,3626.95,null,null,4653.13,5050.82,5511.91,5940.0,6098.27,6119.51,6132.53,6136.87]],
  ["VKY12","nhanh",1,1,"",[41340.0,42444.0,43104.0,44864.0,45928.0,null,46512.0,47891.05,49248.0,50431.0,51288.0,52609.0,53386.17,54543.47,55874.47,56644.17,57142.85,57936.02,58612.44,null,null,60402.6,61354.87,62006.02,62017.25,63375.85,63904.27,67999.27,82373.39]],
  ["VKY15","nhanh",1,1,"",[53696.0,74911.0,96238.0,125029.0,147619.0,null,162727.0,185245.0,208777.0,234137.0,254868.0,275864.0,294667.56,314391.5,334929.93,359842.53,384546.25,401994.31,421241.0,null,null,460962.31,482846.9,507061.4,531535.87,554162,578784.62,599607.31,623149.87]],
  ["VKY17","nhanh",1,1,"",[445790.0,463574.0,480632.0,505209.0,516358.0,null,527900.0,546499.0,569153.0,590887.0,606397.0,625903.0,643387.31,658596.12,677955.5,698773.12,720465.68,735933.25,748250.18,null,null,803936.37,823353.5,845129.0,866776.37,884324.31,905603.5,923731.31,940186.81]],
  ["VKY18","nhanh",1,1,"",[205992.0,225221.0,244554.0,268590.0,286049.0,null,299889.0,319555.0,342190.0,364626.0,386969.0,402444.0,420521.18,433384.56,450701.0,474994.5,497122.09,513853.25,532537.31,null,null,575261.87,595545.56,615621.62,637259.18,655512.68,676075.81,691896.43,700260.37]],
  ["VKY21","nhanh",1,1,"",[80085.0,91855.0,103669.0,118771.0,130454.0,null,138235.0,149695.0,162982.0,176372.0,189009.0,200949.0,210995.26,221009.01,232393.29,245809.9,258827.73,265898.93,268831.62,null,null,283971.43,294079.81,300667.37,301169.75,301765.18,302683.06,306364,306684.78]],
  ["VKY23","nhanh",1,1,"",[402741.0,426671.0,449892.0,481749.0,503541.0,null,519263.0,543156.0,569533.0,595597.0,621541.0,644622.0,666121.5,687561.81,711674.0,741418.87,769559.62,791336.87,814553.18,null,null,896142.12,920719.87,949160.87,975411.68,999068.31,1027171,1052226,1073302]],
  ["VKY16 · VKYC4","nhanh",1,1,"Sổ Excel T1–T7/2026 ghi tên VKYC4 · 原表1–7月名称为VKYC4",[72096.0,98354.0,131382.0,178613.0,235139.0,null,277058.0,331704.0,388097.0,459436.0,527912.0,594343.0,653648.62,716638.12,747366.62,813819.56,882216.0,927498.62,977047.62,null,null,1159127.0,1204731.0,1264646.0,1324215.0,1371506,1433134,1485413,1543618]],
  ["VKY13","nhanh",1,1,"",[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,0.0,87.94,9803.29,14966.4,37324.05,38161.44,39104.8]],
  ["Điều hòa xưởng 1 · 车间空调1","nhanh",1,1,"",[377396.0,379687.0,384191.0,387674.0,390515.0,null,395613.0,410400.0,425668.0,447864.0,477792.0,512972.0,539561.0,567333.87,601151.62,646444.81,688084.0,716143.37,738063.62,null,null,842575.62,874870.12,913813.75,950886.62,981455.87,1017276,1047268,1072828]],
  ["Điều hòa xưởng 2 · 车间空调2","nhanh",1,1,"",[64363.0,65725.0,73864.0,78960.0,85412.0,null,96748.0,122301.0,147282.0,182542.0,219276.0,258235.0,287397.4,317616.56,359699.96,411487.18,461979.06,498090.4,540460.06,null,null,675831.31,715542.87,761045.18,805548.62,840214.62,878619.75,912386.87,942214.93]],
  ["Trạm sạc xe nâng · 叉车充电站","nhanh",1,1,"",[18282.0,19614.0,20938.0,22809.0,24280.0,null,25266.0,26988.0,28775.0,30772.0,32678.0,34405.0,36199.3,37960.47,39828.02,42083.66,44074.57,45516.62,47221.73,null,null,52635.83,54332.72,56445.87,58421.68,59919.25,61725.71,63219.38,64349.68]],
  ["Nhà xe · 车库","nhanh",1,1,"",[6980.0,7567.0,8170.0,8943.0,9589.0,null,10033.0,10646.0,11349.0,12048.0,12624.0,13249.0,13850.26,14549.01,15292.84,16042.81,16826.12,17491.2,18175.65,null,null,19959.29,20612.32,21289.68,22187.4,22815.01,23739.67,24518.57,25270.67]],
  ["Văn phòng · 办公室","nhanh",1,1,"",[104701.0,106671.0,108898.0,111506.0,113352.0,null,115714.0,118514.0,121672.0,126778.0,132622.0,139351.0,144490.96,150399.04,157911.84,170188.71,180949.96,188942.7,198955.07,null,null,227058.2,234686.29,245148.67,252883.12,261268.57,269518.87,277885.21,285106.28]],
  ["Nhà bếp · 厨房","nhanh",1,1,"",[95552.0,101668.0,108721.0,117465.0,124243.0,null,128904.0,135980.0,143347.0,151315.0,158585.0,165491.0,171740.28,178265.87,184973.09,193869.87,202419.71,208435.92,215858.12,null,null,238473.37,245400.9,252687.42,260106.75,266117.18,274018.56,280222.81,286510.9]],
  ["Xử lí nước thải · 污水处理","nhanh",1,1,"",[19367.0,19985.0,21177.0,22634.0,23701.0,null,24618.0,25850.0,27085.0,28434.0,29543.0,30702.0,31763.89,33114.19,34170.86,35511.62,36735.52,37600.19,38707.27,null,null,41769.54,42555.63,43325.75,44251.35,44854.83,45246.55,45557.18,45879.14]],
  ["Bảo vệ · 保安室","nhanh",1,1,"",[12886.0,13337.0,13795.0,14356.0,14779.0,null,15637.0,16122.0,16629.0,17244.0,17960.0,18704.0,19326.42,20129.9,20824.91,22011.5,23027.8,23778.34,24760.17,null,null,27311.01,28128.95,29108.28,29902.2,30828.21,31591.55,32435.42,33208.93]],
  ["DB-XF1.2","nhanh",1,1,"",[74186.0,78832.0,83078.0,90050.0,95142.0,null,99048.0,104631.0,110265.0,116788.0,123136.0,129194.0,134788.46,140214.73,146177.12,153518.29,160473.93,165625.26,171746.26,null,null,192673.71,199078.87,206215.46,213189.26,218757.65,225834.53,232071.48,238885.98]],
  ["Cửa cuốn X2.1 · 卷帘门 X2.1","nhanh",1,1,"",[15505.0,16371.0,17250.0,18344.0,19195.0,null,19835.0,20708.0,21518.0,22400.0,23171.0,24129.0,24882.14,25708.35,26671.19,27923.46,29041.3,29837.15,30888.88,null,null,34163.41,35056.83,36157.51,37241.85,38078.26,39143.33,40042.35,41047.23]],
  ["Cửa cuốn X2.2 · 卷帘门 X2.2","nhanh",1,1,"",[26689.0,29765.0,33978.0,39163.0,43139.0,null,45617.0,50263.0,55174.0,60910.0,66009.0,71198.0,75722.37,80693.77,86005.36,92960.4,99352.6,103311.37,108144.23,null,null,122865.05,127944.92,133009.12,137926.37,142260.29,146729.34,150832.12,154901.93]],
  ["Cửa cuốn X1 · 卷帘门 X1","nhanh",1,1,"",[26958.0,27264.0,27842.0,28639.0,29070.0,null,29567.0,31377.0,33356.0,35514.0,37569.0,40134.0,42347.47,45082.29,46942.64,49698.56,52227.44,53654.83,55523.01,null,null,62214.57,64087.24,66531.22,69383.37,72001.6,74772.87,76725.73,78798.83]],
  ["Hút khói X1 · 排烟 X1","nhanh",1,1,"",[775.0,781.0,787.0,793.0,800.0,null,838.0,862.0,886.0,913.0,1095.0,1118.0,1138.84,1183.8,1214.91,1237.31,1301.59,1340.44,1362.33,null,null,1661.4,1775.9,1849.58,1870.46,1894.3,1914.5,1975.47,2013.53]],
  ["Hút khói X2 · 排烟 X2","nhanh",1,1,"",[1457.0,1490.0,1522.0,1562.0,1593.0,null,1827.0,2121.0,2190.0,2259.0,2438.0,2473.0,2506.6,2649.37,2721.11,2755.41,2845.01,2876.28,2913.17,null,null,3230.67,3285.86,3380.26,3410.33,3436.61,3466.39,3529.55,3552.5]],
  ["Chiếu sáng X1 · 照明 X1","nhanh",1,1,"",[124255.0,129975.0,135688.0,142988.0,148318.0,null,152427.0,157895.0,163700.0,170259.0,176607.0,183303.0,189196.5,195568.68,201488.34,209382.73,217559.6,223116.17,229958.84,null,null,252481.73,259485.2,266991.31,275078.56,281684.06,289976.12,296726.68,303566.75]],
  ["Chiếu sáng X2 · 照明 X2","nhanh",1,1,"",[57492.0,63036.0,68731.0,75698.0,81006.0,null,85057.0,90682.0,96338.0,102802.0,109004.0,115502.0,121253.92,127405.68,133602.04,141566.01,149344.17,155195.1,162211.45,null,null,184738.78,191869.76,200006.68,207857.17,214258.01,221614.88,228121.43,234752.81]],
  ["Máy mài (công tơ cũ) · 磨床（旧表）","nhanh",1,0,"Đã thay công tơ mới tháng 7/2026 · 2026年7月已换新表",[null,null,null,null,null,null,null,null,null,null,null,null,100.09,121.69,160.14,440.08,747.06,791.74,838.46,null,null,897.84,null,null,null,null,null,null,null]],
  ["Máy mài · 磨床","nhanh",1,1,"Công tơ mới lắp tháng 7/2026 · 2026年7月新装电表",[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,null,null,83.4,149.92,281.27,339.64,372.07,470.7,528.45,567.32]],
  ["PCCC · 消防","nhanh",1,1,"",[null,null,null,null,null,null,null,null,null,null,null,null,954.54,989.9,995.34,1000.25,1003.04,1004.54,1007.59,null,null,1023.65,1041.34,1269.65,1288.65,1291.34,1292.4,1294.3,1295.09]]
]};
// [DL_EXCEL] hết

// [DL_CHUYEN] 16 chuyền theo Sổ cái quản lý cơ sở vật chất (VKY-PR-E01-03 Rev.1), thứ tự cột như CH_KHOA
var DL_CHUYEN = [
  ["VKY01", "Dây chuyền sản xuất miếng lót toàn bộ điều khiển bằng servo", "全伺服护垫生产线", "VKY-B-VKY01", "HNJX-HD2000", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "150/175", "2000", "1700/1500", "Xưởng 2 · 2#车间", "H2506", "09/2025", "", "24/10/2025", ""],
  ["VKY02", "Dây chuyền sản xuất băng vệ sinh toàn bộ điều khiển bằng servo", "全伺服卫生巾生产线", "VKY-B-VKY02", "HNJX-WSJ1200", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "240/280", "1200", "1000", "Xưởng 2 · 2#车间", "H2507", "09/2025", "", "01/10/2025", ""],
  ["VKY03", "Dây chuyền sản xuất băng vệ sinh điều khiển toàn bộ bằng servo", "全伺服卫生巾生产线", "VKY-B-VKY03", "HNJX-WSJ1200", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "280/320", "1000", "850/750", "Xưởng 2 · 2#车间", "H2508", "09/2025", "", "01/10/2025", ""],
  ["VKY04", "Dây chuyền sản xuất băng vệ sinh điều khiển toàn bộ bằng servo", "全伺服卫生巾生产线", "VKY-B-VKY04", "HNJX-WSJ1200", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "320/400", "900", "900/750", "Xưởng 2 · 2#车间", "H2509", "10/2025", "", "01/10/2025", ""],
  ["VKY06", "Thiết bị sản xuất băng vệ sinh điều khiển toàn bộ bằng servo", "全伺服控制卫生巾生产设备", "KY-B-VKY06", "FS-AE-500", "Công ty TNHH Chế tạo Cơ khí Hằng Xương An Khánh · 安庆恒昌机械制造有限公司", "238/278", "600/700", "", "Xưởng 1 · 1#车间", "38412", "05/2005", "05/2019", "", "Được cải tạo bởi Haina · 已由海纳改造"],
  ["VKY08", "Thiết bị sản xuất băng vệ sinh điều khiển hoàn toàn bằng servo", "全伺服控制卫生巾生产设备", "KY-B-VKY08", "FS-AE-440", "Công ty TNHH Chế tạo Cơ khí Hằng Xương An Khánh · 安庆恒昌机械制造有限公司", "238/278", "700", "700", "Xưởng 1 · 1#车间", "38412", "05/2005", "11/2020", "30/06/2025", "Được cải tạo bởi Haina · 已由海纳改造"],
  ["VKY09", "Dây chuyền sản xuất lót vệ sinh điều khiển toàn bộ bằng động cơ servo", "全伺服护垫生产线", "VKY-B-VKY09", "HNJX-HD2000", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "150/175", "2000", "1700/1500", "Xưởng 2 · 2#车间", "H2516", "12/2025", "", "01/03/2026", ""],
  ["VKY10", "Dây chuyền sản xuất băng vệ sinh toàn bộ điều khiển bằng servo", "全伺服卫生巾生产线", "VKY-B-VKY10", "HNJX-WSJ1200", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "280/320", "1000", "850/750", "Xưởng 2 · 2#车间", "H2521", "12/2025", "", "01/03/2026", ""],
  ["VKY12", "Thiết bị sản xuất băng vệ sinh điều khiển hoàn toàn bằng servo", "全伺服控制卫生巾生产设备", "KY-B-VKY12", "HNJX-WSJ600-GZ009", "Công ty TNHH Sản xuất Máy móc Anqing Hengchang · 安庆恒昌机械制造有限公司", "235/255", "", "", "Xưởng 1 · 1#车间", "38353", "05/2005", "09/2020", "", "Được cải tạo bởi Haina · 已由海纳改造"],
  ["VKY13", "Thiết bị sản xuất tã quần cho trẻ em", "婴儿拉拉裤设备", "VKY-B-VKY13", "HNJX-H2520", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "Tã quần trẻ em · 婴儿拉拉裤", "800", "500/450", "Xưởng 1 · 1#车间", "H2520", "08/2026", "", "09/09/2026", ""],
  ["VKY15", "Dây chuyền sản xuất băng vệ sinh toàn servo", "全伺服抓心包卫生巾生产线", "VKY-B-VKY15", "CSG-SN1000EP", "Công ty TNHH Cơ khí Tân Dư Hồng Hàng Châu · 杭州新余宏机械有限公司", "190/240", "800", "", "Xưởng sản xuất · 生产车间", "H21013", "07/2021", "07/2026", "01/10/2025", "Được cải tạo bởi Haina · 已由海纳改造"],
  ["VKY16", "Dây chuyền sản xuất tã quần người lớn điều khiển toàn bộ bằng servo (VKYC4)", "全伺服驱动成人拉拉裤生产线", "VKYC4(16)", "HNJX-H2407", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "Tã quần người lớn · 成人拉拉裤", "350 miếng/phút · 350片/分钟", "300", "Xưởng 1 · 1#车间", "", "05/2023", "", "01/10/2025", ""],
  ["VKY17", "Dây chuyền sản xuất băng vệ sinh hoàn toàn điều khiển bằng servo", "全伺服快易包护垫生产线", "VKY-B-VKY17", "HNJX-WSJ1000", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "190/215", "800", "900", "Xưởng 1 · 1#车间", "", "01/2018", "", "28/04/2025", ""],
  ["VKY18", "Dây chuyền sản xuất băng vệ sinh toàn bộ điều khiển servo tốc độ cao", "全伺服快易包护垫生产线", "KY-B-VKY18", "HNJX-WSJ1000-H1806", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "190/215", "800", "900", "Xưởng 1 · 1#车间", "H1806", "10/2018", "", "01/09/2025", ""],
  ["VKY21", "Dây chuyền sản xuất băng vệ sinh đóng gói tiện lợi, điều khiển toàn bộ bằng servo", "全伺服驱动快易包护垫生产线", "KY-B-VKY21", "HNJX-H1907", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "150/175", "1500", "", "Xưởng 2 · 2#车间", "H1907", "10/2019", "", "", ""],
  ["VKY23", "Dây chuyền sản xuất miếng nhỏ điều khiển hoàn toàn bằng servo", "全伺服驱动尿失禁巾生产线", "KY-B-VKY23", "HNJX-H2113", "Công ty TNHH thiết bị Haina Hàng Châu · 杭州海纳机械有限公司", "215", "850", "1000", "Xưởng 1 · 1#车间", "H2113", "06/2022", "", "08/07/2025", ""]
];

// Công việc cũ từ Excel của nhà máy: nv [khoá, mã NV, tên, tên Trung, vai trò]; cv [STT, việc, người làm (người đầu là người chính), ngày bắt đầu, hạn, trạng thái, loại];
// sc (Bảng ghi chép sửa chữa) [ngày, vị trí, sự cố, cách sửa, từ, đến, phụ tùng, quy cách, người sửa]
var DL_CU = {"nguon":"Bảng phân công công việc (Excel) đến 12/10/2026 + Bảng ghi chép sửa chữa thiết bị 12/10/2026","nv":[["TIEN","V25252","Lê Minh Tiến","黎明进","kythuat"],["HONG","V26179","Đỗ Văn Hồng","杜文红","kythuat"],["TUAN","","Nguyễn Tuấn","阮俊","kythuat"],["KIET","","吴建杰","吴建杰","kythuat"],["CHUNG","V25006","Bùi Văn Chung","裴文终","quanly"],["HIEP","V25066","Lương Văn Hiệp","梁文协","kythuat"],["VAN","V25178","Bùi Văn Vân","裴文云","kythuat"]],"sc":[["2026-10-12","VKY 23 máy in phun","Máy in phun mực tím bị mờ","Thay bộ lọc máy in phun","08:00","08:30","Bộ lọc cũ","","KIET"],["2026-10-12","VKY 17 máy keo nóng","Attomat 32A bị nhảy, máy keo nóng không có điện","Thay attomat 32A","08:20","08:40","Attomat","32A 3P","HONG"],["2026-10-12","Máy VKY03","Không gia nhiệt khuôn ép lõi bông trên","Sửa đồng hồ nhiệt","09:00","09:20","","","KIET"]],"cv":[
  [1,"Vệ sinh điều hòa xưởng 1 và xưởng 2, thông đường ống thoát nước từ C4 đến vị trí máy 18 ra ngoài",["VAN","TIEN"],"2026-07-25","2026-07-25","DONG","VS"],
  [2,"Dịch chuyển cảm biến đứt liệu cho máy VKY10",["VAN","KIET"],"2026-07-25","2026-07-25","DONG","LAP"],
  [3,"Máy biến áp chuyền vky8, 12 , 17 ,18 cần quấn sử lý lại đầu dây điện khi chuyền không hoạt động. Máy số 06 bọc thêm vỏ cách điện cho động cơ máy nghiền.VKY8、VKY12、VKY17、VKY18生产线的变压器需要在线体停机时重新缠绕并处理电线接头。 · 06号机需要给粉碎机电机加装绝缘保护套",["TIEN"],"2026-08-20","2026-08-27","DONG","SUA"],
  [4,"Thay dây điện điều khiển ở khoang số 2 máy VKY 17 Sửa chữa (Bảng điều khiển không có nguồn cho nút dừng và nút khởi động)",["HONG"],"2026-08-09","2026-08-10","DONG","SUA"],
  [5,"Cho toàn bộ dây điện đóng gói chuyền số 1 và chuyền số 9 của đóng gói đi xuống bên dưới tránh xước cáp将包装1号线和9号线的所有电线整理到下方走线，避免电缆被刮伤",["HONG","KIET"],"2026-08-09","2026-08-25","DONG","KHAC"],
  [6,"Lắp đèn bắt muỗi ngoài trời số lượng còn 10 cái安装室外灭蚊灯，剩余数量为10个",["TIEN","HONG"],"2026-08-08","2026-08-13","DONG","LAP"],
  [7,"行政支持区检查发现的（第8项）：车库电线管固定松脱Ống luồn dây điện tại gara bị lỏng, tuột khỏi vị trí cố định",["TIEN"],"2026-08-10","2026-08-11","DONG","SUA"],
  [8,"Hoàn thiện checksheet cứu hỏa, XLNT, phòng điện, máy nén khí và điều hòa tháng 7 và tháng 8 · 完成7月和8月的消防、污水处理、电气室、空压机及空调检查表（Checksheet）",["TIEN","TUAN"],"2026-08-21","2026-09-05","DONG","KHAC"],
  [9,"Kiểm tra điện chuyền sản xuất VKY 12 ; Máy đóng túi thủ công xác nhận đảm bảo điều kiện hoạt động检查VKY12生产线的电气系统；检查并确认手动包装机具备正常运行条件",["VAN"],"2026-08-10","2026-08-12","DONG","KHAC"],
  [10,"Xử lí cảm biến quang chuyền VKY 23",["KIET"],"2026-08-09","2026-08-09","DONG","SUA"],
  [11,"Lắp đặt đèn chống cháy nổ tại khu vực thu bụi tầng 2 xưởng 1 và xưởng 2 · 在1号车间和2号车间二楼的除尘区域安装防爆灯 (Đã hoàn thành xưởng 1)",["HIEP","TIEN","TUAN"],"2026-08-21","2026-09-05","DONG","LAP"],
  [12,"Thay quạt gió máy biến áp máy VKY 21 (Kẹt hỏng 2/3 cái), quạt không chạy : máy số 21 có 3 quạt, máy số 2 có 3 quạt.",["HONG","KIET"],"2026-08-19","2026-09-18","DONG","SUA"],
  [13,"Lắp đặt quạt thông gió cho máy kiểm tra hình ảnh (CCD) máy VKY06 ;Lắp đặt dây tín hiệu keo cho máy VKY06; Lắp dây nguồn 380V cho máy đóng gói sau chuyền sản xuất VKY06",["HONG","VAN","TIEN"],"2026-08-21","2026-08-23","DONG","LAP"],
  [14,"Lắp đặt dây nguồn cho máy hút bụi VKY B1",["HIEP","TIEN","TUAN"],"2026-08-21","2026-08-22","DONG","LAP"],
  [15,"Lắp đặt ổ cắm cho máy rửa xe khu vực cửa sau kho ngũ kim; Lắp đặt mạch điều khiển quạt gió phòng MNK",["TIEN","TUAN"],"2026-08-22","2026-08-27","DONG","LAP"],
  [16,"Hoàn thiện checksheet máy đóng bao, máy hút bụi, máy ép phế báo cáo sửa chữa, báo cáo bảo dưỡng trong tháng 7 và tháng 8",["HIEP"],"2026-08-21","2026-09-03","DONG","BD"],
  [17,"Chuyển toàn bộ cảm biến bên dưới cửa cuốn nhanh ra bên ngoài",["HONG","VAN","KIET"],"2026-08-21","2026-08-26","DONG","LAP"],
  [18,"Máy số 8 cần sửa đổi chương trình , 8号胶 chỉnh bù độ dài",["CHUNG"],"2026-08-23","2026-09-22","TAM_HOAN","CT"],
  [19,"Thêm dây tín hiệu cho máy VKY04 keo giấy không bụi",["HONG","VAN","CHUNG"],"2026-08-23","2026-08-23","DONG","KHAC"],
  [20,"Máy số 6 cần sửa đổi chương trình , 6号胶 thêm chức năng điều chỉnh keo hai bên",["CHUNG"],"2026-08-22","2026-08-23","DONG","CT"],
  [21,"Kiểm tra điều hòa , thay dây khí máy in và nâng giá đỡ máy in VKY23",["HONG","VAN","CHUNG"],"2026-08-23","2026-08-23","DONG","SUA"],
  [22,"Kiểm tra dây tín hiệu camera CCD máy VKY 06 (Vân bàn giao cho tiến kiểm tra)",["TIEN"],"2026-08-23","2026-08-23","DONG","KHAC"],
  [23,"Đặt mua ổ cứng cho máy in phun và máy kiểm tra hình ảnh CCD",["CHUNG"],"2026-08-25","2026-09-04","DONG","KHAC"],
  [24,"Kiểm tra tủ điện bên hậu công đoạn, bắn keo bọt làm kín tránh nước mưa và bụi vào tủ, đồng thời kiểm tra tản nhiệt của tủ điện (đã xong tủ tổng phòng phối điện xưởng 1 và xưởng 2)",["TIEN","TUAN"],"2026-08-25","2026-09-24","TAM_HOAN","KHAC"],
  [25,"Lắp 03 đèn chiếu sáng ngoài trời phía cổng 2, lắp thêm bộ hẹn giờ, đang đặt mua (đã lắp đặt xong 02 cái ở cổng 2, còn 1 cái chưa lắp xong)",["TIEN","TUAN","HIEP"],"2026-08-26","2026-09-15","TAM_HOAN","LAP"],
  [26,"Máy 04 lớp dẫn thấm , bên trên đứt liệu, đằng sau không kiểm tra được, lắp thêm 1 cảm biến liệu, khi không thấy thì sẽ dừng máy",["CHUNG"],"2026-08-26","2026-08-27","DONG","LAP"],
  [27,"Cải tạo, bọc bảo ôn đường ống điều hòa xưởng 2 trước cửa phòng khuôn",["TIEN","TUAN"],"2026-08-27","2026-08-29","DONG","KHAC"],
  [28,"Lắp đặt đèn chiếu sáng trong chuyền sản xuất VKY06/08/17 (sử dụng bóng đèn ngắn loại 220V)",["TIEN","TUAN","KIET"],"2026-08-29","2026-08-30","DONG","LAP"],
  [29,"Đặt mua ống nước Φ50mm, cút góc, cút nối",["CHUNG"],"2026-08-29","2026-09-01","TAM_HOAN","KHAC"],
  [30,"Tủ điện tổng VKY02 có đầu dây nhiệt độ cao, nghi là do lỏng ốc xiết đầu nối dây (Sáng ngày 03/9/2026)",["TUAN","HONG"],"2026-08-31","2026-09-05","DONG","KHAC"],
  [31,"Kiểm tra thiết bị hậu công đoạn, kiểm tra an toàn điện, tránh nguy cơ chập cháy điện (XLNT, cầu công, phòng điện, máy nén khí, điều hòa), kiểm tra bơm nước chính và bơm bù áp, bơm dầu trong phòng PCCC, khôi phục báo cháy các tủ báo cháy.",["TIEN","TUAN"],"2026-08-31","2026-09-03","DONG","SUA"],
  [32,"Kiểm tra thiết bị hậu công đoạn kiểm tra các quạt gió có bị rạn nứt, biến dạng, rung lắc, rò rỉ khí nén, ngăn ngừa cháy do chập điện các đèn chiếu sáng khẩn cấp và đèn exit, van điện từ ở các khu vực trên (Máy đóng bao, máy hút bụi, máy đóng phế, máy ép phế)",["HIEP"],"2026-08-31","2026-09-03","DONG","SUA"],
  [33,"Vệ sinh bộ lọc thùng mực máy VKY21 và VKY01",["HONG","KIET"],"2026-09-03","2026-09-04","DONG","VS"],
  [34,"Lắp đèn chiếu sáng bàn QC máy 12",["HONG","VAN","KIET"],"2026-09-03","2026-09-04","DONG","LAP"],
  [35,"Lắp đặt cover gia nhiệt khuôn dao máy VKY06/VKY08 (gia công cover )",["HONG","KIET","CHUNG"],"2026-09-03","2026-09-23","TAM_HOAN","LAP"],
  [36,"Kiểm tra dây encoder cho CCD máy VKY12",["HONG","VAN","KIET"],"2026-09-03","2026-09-05","DONG","KHAC"],
  [37,"Lắp đặt đèn UV, kiểm tra cây nước cho phòng QC",["HIEP","TUAN"],"2026-09-05","2026-09-07","DONG","LAP"],
  [38,"Kiểm tra đèn bắt muỗi sau điều hòa xưởng 2, Đèn bắt muỗi C46 kho nguyên liệu xưởng 1",["TIEN"],"2026-09-05","2026-09-07","DONG","KHAC"],
  [39,"Bảo dưỡng 02 quạt gió cao phân tử kẹt hỏng ở kho ngũ kim; Thay rơ le nhiệt ở nhà ăn",["HONG","VAN"],"2026-09-05","2026-09-06","DONG","BD"],
  [40,"Thay cảm biến đếm thành phẩm lối đi số 2 của máy VKY18 · 更换 VKY18 设备 2 号通道成品计数传感器",["KIET"],"2026-09-05","2026-09-09","DONG","SUA"],
  [41,"Sửa điều hòa máy in phun chuyền sản xuất VKY06 (Thay rơ le nhiệt); Thay module chân không",["HONG","KIET","CHUNG"],"2026-09-07","2026-09-17","DONG","SUA"],
  [42,"Chuyển bộ điều khiển tivi chuyền sản xuất VKY 18 vào tủ số 2.",["HONG","KIET"],"2026-09-08","2026-09-18","DONG","LAP"],
  [43,"Lắp đặt máy ép bụi chuyền sản xuất VKY13, thay động cơ chuyền sản xuất VKY12 (Lắp xong chưa kiểm tra)",["TIEN","TUAN","HIEP"],"2026-09-09","2026-10-01","DANG_LAM","LAP"],
  [44,"Lắp đặt quạt gió 55kW cho chuyền sản xuất VKY16 (đợi thời gian thay liệu tiến hành thay thế)",["TIEN","TUAN","HIEP"],"2026-09-09","2026-09-23","DONG","LAP"],
  [45,"Thay driver Panasonic cho máy đóng hộp thủ công trước phòng khuôn xưởng 1, đấu nối điện, khí và kiểm tra chạy thử.",["HONG","KIET"],"2026-09-08","2026-09-10","DONG","SUA"],
  [46,"Dịch chuyển camera chuyền sản xuất VKY 13",["VAN"],"2026-09-09","2026-09-10","DONG","LAP"],
  [47,"Lắp đặt điện cho tủ đựng đồ của công nhân khu vực giữa hai xưởng (Hạ thấp tủ đựng đồ)",["TIEN","TUAN"],"2026-09-10","2026-09-15","DONG","LAP"],
  [48,"Vệ sinh đầu in chuyền sản xuất VKY23",["HONG","KIET","CHUNG"],"2026-09-10","2026-09-15","DONG","VS"],
  [49,"Lắp đặt bộ chỉnh lệch chuyền sản xuất VKY04 thay cho bộ chỉnh lệch thủ công",["HONG","KIET"],"2026-09-11","2026-09-12","DONG","LAP"],
  [50,"Lắp đặt ổ cắm điện cho kho thành phẩm , vị trí gần cầu công (gặp phà để trao đổi vị trí lắp đặt) Còn X1 02 cái",["TIEN","TUAN"],"2026-09-11","2026-10-01","DONG","LAP"],
  [51,"Thay bóng điện chiếu sáng tại phòng sạc xe nâng xưởng 1",["HIEP"],"2026-09-11","2026-09-14","DONG","SUA"],
  [52,"Chuyền sản xuất VKY17 cần lắp đặt quản tản nhiệt cho máy kiểm tra hình ảnh.",["HONG","KIET","CHUNG"],"2026-09-11","2026-09-21","DONG","LAP"],
  [53,"Xóa reset keo trên màn hình cảm ứng và chuyển nút nhấn về phía sau máy chuyền sản xuất VKY02/03/04, sửa chương trình",["CHUNG"],"2026-09-11","2026-09-21","DONG","CT"],
  [54,"Tạo thời gian tự động reset ca sản xuất để công nhân không cần thao tác, tự động reset , sửa chương trình",["CHUNG"],"2026-09-11","2026-09-21","DONG","CT"],
  [55,"Sửa chương trình cho máy 02/03/04/10 nếu công tắc hạt siêu thấm tắt thì chỉ chạy được tốc độ dưới 100, 100 trở lên sẽ tự động dừng máy",["CHUNG"],"2026-09-14","2026-09-21","DANG_LAM","CT"],
  [56,"Kiểm tra xe nâng khuôn màu đỏ không có điện",["HONG","CHUNG"],"2026-09-14","2026-09-16","DONG","SUA"],
  [57,"Lắp máng cáp cho chuyền sản xuất VKY13 vị trí đóng gói",["HIEP","TIEN","TUAN"],"2026-09-14","2026-09-21","DONG","LAP"],
  [58,"Lắp dặt đường điện, khí cho phòng khuôn xưởng 1 và đóng gói bên ngoài phòng khuôn",["HIEP","TIEN","TUAN"],"2026-09-17","2026-09-22","DONG","LAP"],
  [59,"Lắp bóng chiếu sáng cho chuyền sản xuất VKY06/08",["HONG","TIEN","TUAN"],"2026-09-17","2026-10-02","DONG","LAP"],
  [60,"Xưởng 2 máng cáp điện cho đường ống keo nóng bị xô lệch, cần sửa lại và bắn nở cố định",["TIEN","TUAN"],"2026-09-17","2026-10-02","DONG","SUA"],
  [61,"Kho xưởng 2 có 01 máy di chuyển palet tự động bị hỏng giắc cắm, cần thay thế (gặp phà để trao đổi thêm)",["HONG","KIET"],"2026-09-17","2026-10-02","DONG","SUA"],
  [62,"Lắp lại bóng đèn thêm hẹn giờ bật tắt tại khu vực cầu công",["TIEN","TUAN"],"2026-09-18","2026-09-21","TAM_HOAN","LAP"],
  [63,"Lắp đặt đo nhiệt độ vòng bi máy 06/08 báo về màn hình điều khiển",["CHUNG","HONG"],"2026-09-17","2026-10-02","DANG_LAM","LAP"],
  [64,"Kiểm tra sau khi bật quạt, cửa gió máy hút bụi chỉ mở ra sau khi quạt gió đầu tiên mở ra",["CHUNG"],"2026-09-30","2026-10-15","TAM_HOAN","KHAC"],
  [65,"Thay máy chỉnh lệch chuyền sản xuất VKY08更换 VKY08 线纠偏器 面层和无尘纸",["KIET"],"2026-09-30","2026-10-01","DONG","SUA"],
  [66,"Kiểm tra, vệ sinh tủ điện, thay các quạt gió hỏng , thay thế bộ lọc mực các máy xưởng 1检查并清洁电气柜，更换损坏的风扇，更换一车间各设备的墨粉过滤器",["KIET"],"2026-09-30","2026-10-01","DONG","SUA"],
  [67,"Kiểm tra, vệ sinh tủ điện, thay các quạt gió hỏng , thay thế bộ lọc mực các máy xưởng 2检查并清洁电气柜，更换损坏的风扇，更换一车间各设备的墨粉过滤器",["TIEN","TUAN","HONG"],"2026-10-01","2026-10-02","DONG","SUA"],
  [68,"Lắp đặt quạt gió cho các tủ điện máy kiểm tra hình ảnh",["HONG","TIEN","TUAN"],"2026-10-01","2026-10-02","DANG_LAM","LAP"],
  [69,"Lắp đặt cảm biến nối liệu giấy vệ sinh phía trên",["TUAN","KIET"],"2026-10-07","2026-10-08","DONG","LAP"],
  [70,"Lắp đặt quạt gió chuyền sản xuất VKY23",["HONG","KIET"],"2026-10-07","2026-10-09","DONG","LAP"],
  [71,"Máy 16 网压lên xuống không hoạt động, cần sửa đổi",["CHUNG"],"2026-10-07","2026-10-09","DANG_LAM","SUA"],
  [72,"Lắp đặt thổi khí cho máy chỉnh lệch chuyền sản xuất VKY12",["KIET"],"2026-10-07","2026-10-09","DANG_LAM","LAP"],
  [73,"Kéo nguồn điện quạt bù gió xưởng 1 và xưởng 2",["CHUNG"],"2026-10-12","2026-10-17","DANG_LAM","LAP"]
]};
// [DL_CU] hết
