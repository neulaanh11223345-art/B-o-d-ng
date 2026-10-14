# Credible Việt Nam CMMS · 设备管理 — v2.0.0

App quản lý bảo dưỡng thiết bị, ghi số điện/nước và kho linh kiện cho nhà máy Credible Việt Nam.

- **iPhone:** chạy dạng PWA — mở bằng Safari rồi "Thêm vào Màn hình chính", dùng như một app.
- **Máy tính:** cùng địa chỉ đó, mở bằng trình duyệt. Màn rộng tự chuyển sang giao diện có thanh bên và bảng dữ liệu.
- **Dữ liệu:** lưu trong **Google Sheet**, đọc/ghi qua Google Apps Script. Ảnh lưu trong Google Drive của chủ sheet và để riêng tư.
- **Ngôn ngữ:** song ngữ Việt – Trung. Tiếng Việt chữ lớn, tiếng Trung nhỏ hơn bên dưới.

## Các file

| File | Dùng để |
|---|---|
| `Code.gs-v2.0.0.txt` | Mã máy chủ, dán vào Apps Script của Google Sheet |
| `docs/` | Bộ PWA để đăng lên web (GitHub Pages): `index.html` (app thật), `demo.html` (bản xem thử), `sw.js`, `manifest.webmanifest`, `icons/` |
| `app-v2.0.0.html` | Giống `docs/index.html`, một file duy nhất (nếu muốn đăng ở chỗ khác) |
| `demo-v2.0.0.html` | Bản xem thử chạy hoàn toàn trong trình duyệt, có máy chủ giả và dữ liệu mẫu |
| `src/` | Mã nguồn: `app.html`, `Code.gs`, `sw.js`, `config.json` (link máy chủ, phiên bản), `demo/` |
| `tools/build.mjs` | Ghép `src/` thành các file trên: `node tools/build.mjs` |
| `tests/` | Kiểm thử máy chủ (`npm test`) và kiểm thử toàn luồng trên bản xem thử (`npm run e2e`) |
| `*-v1.6.0.*` | Bản cũ, giữ lại để đối chiếu hoặc quay lại khi cần |

> Chỉ sửa trong `src/`, rồi chạy `node tools/build.mjs`. Không sửa trực tiếp các file đã tạo.

## Xem thử ngay (không cần cài gì)

Mở `docs/demo.html` (hoặc `demo-v2.0.0.html`) bằng trình duyệt. Tài khoản mẫu:

| Mã nhân viên | PIN | Vai trò |
|---|---|---|
| NV001 | 111111 | Quản trị |
| NV002 | 222222 | Quản lý |
| NV003 | 333333 | Kỹ thuật |

Muốn thử cảnh mất mạng: vào **Cá nhân → Giả lập mất mạng**.

## Nâng cấp máy chủ từ v1.6.0 (giữ nguyên link)

1. Mở Google Sheet đang dùng → **Tiện ích mở rộng → Apps Script**.
2. Xoá hết mã cũ trong `Code.gs`, dán toàn bộ `Code.gs-v2.0.0.txt`, rồi bấm **Lưu**.
3. Vào **Triển khai → Quản lý triển khai** → bấm bút chì → **Phiên bản: Phiên bản mới** → **Triển khai**.
   - **Không** chọn "Tùy chọn triển khai mới", vì làm vậy sẽ ra link khác.
4. Mở app và đăng nhập. Lần tải dữ liệu đầu tiên, máy chủ sẽ tự làm hai việc:
   - thêm các cột mới vào các trang;
   - tính và lưu tiêu thụ cho mọi kỳ điện đã ghi.

   Việc này chỉ chạy một lần. Muốn chạy lại bằng tay: trong Apps Script chọn hàm `tinhLaiTatCa` → **Chạy**.
5. **Đăng nhập:** người dùng cũ chưa có mã nhân viên thì có hai cách:
   - nhập mã theo ID: U001, U002…;
   - bỏ trống mã và chỉ nhập PIN như trước (được khi PIN đó chỉ một người dùng).

   Quản trị nên vào **Cá nhân → Quản trị → Người dùng** để đặt mã nhân viên (NV001…) và tên tiếng Trung cho từng người.

Cài mới từ đầu: tạo Google Sheet mới → dán mã → chạy hàm `caiDatBanDau` một lần để cấp quyền → **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**, đặt "Thực thi với: Tôi" và "Người có quyền truy cập: Bất kỳ ai". Sau đó chép link `/exec` vào `src/config.json` (`apiUrl`) rồi build lại.

## Đăng app lên web để cài vào iPhone

Cách gợi ý là dùng GitHub Pages, miễn phí và có https (iPhone bắt buộc https để dùng camera và chạy offline):

1. Trên GitHub: **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = nhánh chứa code này, Folder = `/docs` → **Save**.
2. Sau khoảng 1 phút, app có ở địa chỉ `https://<tài-khoản>.github.io/<tên-repo>/` (bản xem thử ở `…/demo.html`).
3. Trên iPhone: mở link bằng **Safari** → nút **Chia sẻ** → **Thêm vào Màn hình chính**.

**Tem QR đã in.** Tem cũ chứa link app cũ kèm `?m=M001`. Mã máy vẫn giữ nguyên (M001…, E01…).

- Quét bằng **nút Quét trong app mới**: tem cũ vẫn dùng được, ở bất kỳ địa chỉ nào.
- Quét bằng **Camera của iPhone**: mở ra địa chỉ in trên tem. Muốn tem cũ mở thẳng app mới thì phải đăng app mới đúng địa chỉ cũ. Nếu không, chỉ cần in tem mới (**Thiết bị → In tem QR**).

**Giới hạn của PWA trên iPhone:**
- Việc chờ gửi chỉ được gửi khi app đang mở và có mạng. iOS không có gửi ngầm.
- Không xoá icon khỏi màn hình chính khi còn việc chờ gửi. Xoá icon là mất dữ liệu đang lưu trên máy.
- Đèn flash khi quét QR chỉ hiện khi trình duyệt cho điều khiển. Nhiều iPhone không cho, khi đó nút đèn sẽ bị ẩn.

## Điểm mới của v2.0.0

### Giao diện (theo bản thiết kế)
- **Màu và bố cục:** màu xanh dương, ô tổng quan nhiều màu. Màu đỏ chỉ dùng cho cảnh báo.
- **Thanh tab dưới:** Trang chủ · Thiết bị · **[Quét QR]** · Điện/Nước · Cá nhân.
- **Trên máy tính:** thanh bên trái, ô tìm chung, bảng có tiêu đề cố định, phân trang và tổng số kết quả.
- **Trang chủ:**
  - **Việc cần làm** đặt ở trên: máy quá hạn / đến hạn / sắp đến, công tơ chưa ghi kỳ hiện tại, ngoại lệ chờ duyệt, tiêu thụ bất thường, linh kiện dưới tồn tối thiểu, việc chờ gửi hoặc gửi lỗi, kỳ chưa khoá, file kho ERP cũ.
  - Bấm vào mỗi cảnh báo sẽ mở đúng danh sách đã lọc.
  - Ô tổng quan nằm bên dưới.
- **Trạng thái đồng bộ** luôn hiện ở góc trên, gồm bốn trạng thái:
  - **Đã đồng bộ**, có giờ đồng bộ gần nhất;
  - **Đang chờ mạng**;
  - **Có dữ liệu chờ đồng bộ (n)**;
  - **Đồng bộ lỗi**.

  Màn **Đồng bộ dữ liệu** liệt kê những gì *chỉ lưu trên máy*. Khi xung đột, màn này cho chọn *giữ bản của tôi* hoặc *dùng bản máy chủ*.
- **Hồ sơ thiết bị:**
  - Có tab Thông tin · Linh kiện · Bảo dưỡng · Lịch sử.
  - Nút lớn **Xác nhận bảo dưỡng** đặt ngay trên đầu.
  - Thêm hai trường "Người phụ trách" và "Ngày đưa vào sử dụng".
- **Quét QR:** có ô **nhập mã thủ công**, hướng dẫn cấp quyền camera, báo khi không mở được camera, nút đèn và chụp ảnh tem.
- **Đăng nhập:** bằng **mã nhân viên + PIN 6 số** (6 chấm). Có nút "Quên PIN?".
- **Số:** viết với khoảng trắng phân cách hàng nghìn (`126 972`), để không nhầm với dấu thập phân. Ngày viết dạng dd/mm/yyyy.

### Điện (mục 2.2 · 2.7 của checklist)
- **Lưu cả hai số:** mỗi công tơ, mỗi kỳ lưu **chỉ số lúc ghi** và **lượng tiêu thụ riêng của kỳ**.
  - Trên sheet `ChiSo` có thêm các cột `KyTruoc`, `CSTruoc`, `TieuThuKy`, `TieuThu`.
  - Tiêu thụ kỳ = (chỉ số kỳ này − chỉ số lần ghi hợp lệ gần nhất) × hệ số nhân. Kỳ đầu tháng lấy số cuối tháng trước.
  - Tổng tháng = tổng tiêu thụ ba kỳ, không cộng các chỉ số tuyệt đối.
- **Sửa, xoá, ghi bù một kỳ:** kỳ sau tự tính lại theo, kể cả khi qua năm.
- **Kỳ trước bị thiếu:** số được tính gộp và đánh dấu `*` (gồm n kỳ chưa ghi).
- **Chỉ số nhỏ hơn kỳ trước:** không nhận như bản ghi thường. Người ghi phải chọn một trong ba lý do:
  - **Thay công tơ:** nhập số cuối công tơ cũ và số đầu công tơ mới;
  - **Quay vòng về 0:** cần khai báo số chữ số của công tơ;
  - **Lý do khác:** kỳ này thành mốc mới, không tính tiêu thụ.

  Lý do là bắt buộc. Kỹ thuật ghi thì phải **chờ Quản lý duyệt**; chưa duyệt thì không cộng vào tổng. Quản lý ghi thì được tự duyệt.
- **Tiêu thụ bất thường:**
  - App so tiêu thụ bình quân **mỗi ngày** với 3 kỳ trước. Cách này tránh báo sai vì kỳ 3 dài từ 8 đến 11 ngày.
  - Ngưỡng mặc định là +50% / −50%. Đặt chung ở **Quản trị → Cảnh báo tiêu thụ bất thường**, hoặc riêng cho từng công tơ.
  - Lệch quá ngưỡng thì người ghi phải đánh dấu "đã kiểm tra lại" mới lưu được.
- **Khoá kỳ:**
  - Quản lý khoá kỳ (khoá luôn các kỳ trước đó). Sau khi khoá, Kỹ thuật không sửa được số.
  - Quản lý muốn sửa phải ghi lý do. Mở lại kỳ cũng phải có lý do.
  - Mọi lần sửa, xoá, duyệt, khoá đều lưu vào trang **NhatKy**: giá trị trước/sau, người sửa, thời gian, lý do. Xem ở **Cá nhân → Nhật ký sửa đổi**.
- **Màn ghi số:**
  - Hiện chỉ số kỳ trước, ô nhập chỉ số hiện tại, tiêu thụ tự tính (có hệ số nhân) và mức so với bình quân.
  - Có ảnh công tơ, người ghi, thời điểm ghi và ghi chú.
  - Mỗi công tơ có thể đặt **bắt buộc chụp ảnh**.
- **Công tơ:**
  - **Cao áp:** vẫn ghi nhiều mã OBIS (1.8.0–4.8.0) như cũ.
  - **Công tơ cấp trên:** công tơ nhánh nằm sau công tơ nhánh khác thì không cộng lần nữa vào tổng nhánh.
  - **Nhóm:** dùng cho bảng tổng hợp theo nhóm. Bấm một nhóm để xem các công tơ trong nhóm, có cột % so với tháng trước.
  - **Loại mới "Nước":** đơn vị m³, ghi cùng 3 kỳ, không cộng vào điện.
- **Bảng tháng:**
  - Ghi **"Tạm tính (n/3 kỳ)"** khi tháng chưa đủ 3 kỳ.
  - Chênh lệch âm (tổng nhánh lớn hơn hạ áp) được tô đỏ, kèm gợi ý kiểm tra công tơ cấp trên hoặc hệ số nhân.
- **Xuất Excel:** có **xem trước** mẫu, số trang, số công tơ, số còn thiếu, ngoại lệ chờ duyệt và kỳ chưa khoá. Sau đó chọn *Quay lại xử lý* hoặc *Vẫn xuất*.

### Offline và đồng bộ (mục 2.3)
- **Hàng chờ:** lưu trong IndexedDB thay cho localStorage, có xin trình duyệt giữ lâu dài.
- **Gửi lại không tạo trùng:** mỗi thao tác có mã riêng (`opId`).
- **Phát hiện xung đột:** nếu số đã bị người khác sửa trong lúc máy này mất mạng, app báo cho người dùng chọn.
- **Ghi lại khi chưa gửi:** sửa số của một công tơ/kỳ đang chờ gửi sẽ cập nhật luôn việc chờ gửi đó, không tạo thêm.

### Linh kiện và ERP (mục 2.5)
- **Chọn linh kiện từ ERP:** phải qua bước **xác nhận mã và đơn vị tính**. Màn này hiện quy cách, tồn tổng, tồn theo vị trí kho, thời điểm nhập file ERP và tồn tối thiểu.
- **Linh kiện trên máy:** có thêm vị trí lắp và mức độ quan trọng.
- **Nhãn:** "ERP" và "Thủ công" tách riêng với nhãn tồn kho. Tồn kho có ba mức: còn / **dưới tối thiểu** / hết.
- **Tồn tối thiểu:** lấy từ cột `安全库存` (tồn tối thiểu) của file ERP, hoặc Quản lý nhập trong app.
- **Nhật ký:** liên kết, bỏ liên kết hoặc đổi mã ERP đều được ghi lại.

### Bảo mật
- **PIN:** không còn bắt buộc khác nhau giữa người dùng. Trước đây thông báo "PIN đã có người dùng" làm lộ PIN của người khác.
- **Khoá khi sai PIN:** sai 5 lần thì khoá theo từng mã nhân viên.
- **Ảnh mới trên Drive:** để **riêng tư**. App lấy ảnh qua máy chủ, cần đăng nhập. Ảnh cũ vẫn xem được.

## Đối chiếu checklist nghiệm thu

| Mục | Trạng thái |
|---|---|
| Mỗi công tơ/kỳ lưu chỉ số kỳ trước và chỉ số hiện tại | ✅ |
| Tiêu thụ kỳ = chênh lệch chỉ số (× hệ số) | ✅ |
| Kỳ đầu tháng dùng chỉ số cuối tháng trước | ✅ |
| Tổng tháng = tổng tiêu thụ 3 kỳ, không cộng chỉ số tuyệt đối | ✅ |
| Chỉ số thấp hơn kỳ trước bị chặn / qua quy trình ngoại lệ | ✅ |
| Tiêu thụ bất thường có cảnh báo theo ngưỡng cấu hình | ✅ |
| Đính kèm ảnh, người ghi, thời điểm ghi | ✅ |
| Sửa sau khi chốt có quyền + audit | ✅ |
| Biểu đồ và Excel tách chỉ số với tiêu thụ | ✅ |
| Offline xem được dữ liệu đã lưu | ✅ |
| Đếm và hiển thị việc chờ đồng bộ | ✅ |
| Gửi lại không tạo trùng | ✅ |
| Phản hồi khi đồng bộ lỗi / xung đột | ✅ |
| QR có nhập mã thủ công khi camera lỗi | ✅ |
| Mã linh kiện, đơn vị, tồn theo vị trí trước khi xác nhận | ✅ |
| Lọc / tìm / phân trang bảng lớn | ✅ Thiết bị, công tơ (máy tính) |
| Xem trước khi xuất Excel | ✅ |
| Cảnh báo trang chủ mở đúng danh sách | ✅ |

**Chưa làm trong đợt này (giai đoạn sau, cần vẽ màn và chốt quy trình trước):**
- Công việc / Sửa chữa / Báo hỏng
- Nhật ký ca
- Quản lý nhân viên ngoài tài khoản đăng nhập

**Các câu hỏi ở mục 6 của checklist đã có chỗ cấu hình**, chỉ cần chốt giá trị:
- ngưỡng bất thường;
- số chữ số của công tơ;
- công tơ nào bắt buộc ảnh;
- ai duyệt ngoại lệ: Quản lý / Quản trị.

## Kiểm thử

```bash
node tools/build.mjs                    # tạo lại các file từ src/
node --test tests/backend.test.mjs      # 14 bài kiểm thử máy chủ (chạy Code.gs với Apps Script giả lập)
node tests/e2e.mjs                      # 9 bước toàn luồng trên bản xem thử (cần Playwright + Chromium)
```
