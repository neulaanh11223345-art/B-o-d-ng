# Credible Việt Nam CMMS · 设备管理 — v2.26.0

App quản lý công việc (giao việc, sửa chữa), bảo dưỡng thiết bị, ghi số điện/nước và kho linh kiện cho nhà máy Credible Việt Nam.

- **iPhone:** chạy dạng PWA — mở bằng Safari rồi "Thêm vào Màn hình chính", dùng như một app.
- **Máy tính:** cùng địa chỉ đó, mở bằng trình duyệt. Màn rộng tự chuyển sang giao diện có thanh bên và bảng dữ liệu.
- **Dữ liệu:** lưu trong **Google Sheet**, đọc/ghi qua Google Apps Script. Ảnh lưu trong Google Drive của chủ sheet và để riêng tư.
- **Ngôn ngữ:** song ngữ Việt – Trung. Tiếng Việt chữ lớn, tiếng Trung nhỏ hơn bên dưới. Nội dung công việc gõ một thứ tiếng, app tự dịch sang thứ tiếng kia.

## Các file

| File | Dùng để |
|---|---|
| `Code.gs-v2.26.0.txt` | Mã máy chủ, dán vào Apps Script của Google Sheet |
| `docs/` | Bộ PWA để đăng lên web (GitHub Pages): `index.html` (app thật), `demo.html` (bản xem thử), `sw.js`, `manifest.webmanifest`, `icons/` |
| `app-v2.26.0.html` | Giống `docs/index.html`, một file duy nhất (nếu muốn đăng ở chỗ khác) |
| `demo-v2.26.0.html` | Bản xem thử chạy hoàn toàn trong trình duyệt, có máy chủ giả và dữ liệu mẫu |
| `src/` | Mã nguồn: `app.html`, `Code.gs`, `sw.js`, `config.json` (link máy chủ, phiên bản), `demo/` |
| `tools/build.mjs` | Ghép `src/` thành các file trên: `node tools/build.mjs` |
| `tests/` | Kiểm thử máy chủ (`npm test`) và kiểm thử toàn luồng trên bản xem thử (`npm run e2e`) |
| `*-v1.6.0.*` | Bản cũ, giữ lại để đối chiếu hoặc quay lại khi cần |

> Chỉ sửa trong `src/`, rồi chạy `node tools/build.mjs`. Không sửa trực tiếp các file đã tạo.

## Xem thử ngay (không cần cài gì)

Mở `docs/demo.html` (hoặc `demo-v2.26.0.html`) bằng trình duyệt. Tài khoản mẫu:

| Mã nhân viên | PIN | Vai trò | Xem được |
|---|---|---|---|
| NV001 | 111111 | Quản trị | Tất cả, thêm phần cài đặt máy chủ |
| NV002 | 222222 | Quản lý | Tất cả |
| NV003 | 333333 | Kỹ thuật | Điện/Nước, Sửa chữa, Bảo dưỡng, Tăng ca của mình |
| NV004 / NV005 / NV006 | 444444 / 555555 / 666666 | Kỹ thuật (chỉ có trong bản xem thử, để thử giao việc) | Điện/Nước, Sửa chữa, Bảo dưỡng, Tăng ca của mình |

Muốn thử cảnh mất mạng: vào **Cá nhân → Giả lập mất mạng**.

Bản xem thử không gọi Google Dịch thật, chỉ dịch được các câu mẫu, ví dụ "Thay vòi nước nhà vệ sinh xưởng 1", "Máy hút bụi VKY03 không chạy", "Thay chổi than motor", hoặc gõ tiếng Trung "检查空压机油位". Câu khác sẽ hiện dòng "（演示版：正式系统会自动翻译这句话）" thay cho bản dịch.

## Nâng cấp máy chủ từ bản cũ (giữ nguyên link)

1. Mở Google Sheet đang dùng → **Tiện ích mở rộng → Apps Script**.
2. Xoá hết mã cũ trong `Code.gs`, dán toàn bộ `Code.gs-v2.26.0.txt`, rồi bấm **Lưu**.
3. Vào **Triển khai → Quản lý triển khai** → bấm bút chì → **Phiên bản: Phiên bản mới** → **Triển khai**.
   - **Không** chọn "Tùy chọn triển khai mới", vì làm vậy sẽ ra link khác.
4. Mở app và đăng nhập. Lần tải dữ liệu đầu tiên, máy chủ sẽ tự làm hai việc:
   - thêm các cột mới vào các trang (tự thêm cột cho trang nào không đủ) và tạo các trang mới `CongViec`, `ViecLap`;
   - tính và lưu tiêu thụ cho mọi kỳ điện đã ghi.

   Việc này chỉ chạy một lần. Muốn chạy lại bằng tay: trong Apps Script chọn hàm `tinhLaiTatCa` → **Chạy**.
   - Từ bản 2.4.0: các việc đã ghi trước đó (trong 60 ngày gần nhất) được dịch dần sang thứ tiếng còn lại.
5. **Thử tự dịch (một lần):** trong Apps Script chọn hàm `thuDich` → **Chạy**. Kết quả là hai câu đã dịch. Nếu Google hỏi cấp quyền thì bấm cho phép.
6. **Đăng nhập:** người dùng cũ chưa có mã nhân viên thì có hai cách:
   - nhập mã theo ID: U001, U002…;
   - bỏ trống mã và chỉ nhập PIN như trước (được khi PIN đó chỉ một người dùng).

   Quản trị nên vào **Cá nhân → Quản trị → Người dùng** để đặt mã nhân viên (NV001…) và tên tiếng Trung cho từng người.

## Cài mới từ đầu (chưa có bản cũ)

1. Tạo **Google Sheet mới** (trống) → **Tiện ích mở rộng → Apps Script**.
2. Xoá mã có sẵn, dán toàn bộ `Code.gs-v2.26.0.txt` → **Lưu**.
3. Chọn hàm `caiDatBanDau` → **Chạy** → cấp quyền khi Google hỏi. Hàm này tạo các trang, 3 tài khoản đầu tiên (NV001/111111 Quản trị, NV002/222222 Quản lý, NV003/333333 Kỹ thuật) và danh sách máy mẫu của nhà máy.
4. Chọn hàm `thuDich` → **Chạy** để kiểm tra tự dịch.
5. **Triển khai → Tùy chọn triển khai mới** → loại **Ứng dụng web**; "Thực thi với: **Tôi**", "Người có quyền truy cập: **Bất kỳ ai**" → **Triển khai** → chép link kết thúc bằng `/exec`.
6. Mở app lần đầu: app hỏi link máy chủ, dán link `/exec` vào. Mỗi máy chỉ làm một lần.
   - Gửi cho nhân viên link có sẵn máy chủ để họ khỏi phải dán: `https://<link-app>/?api=<link /exec>`.
   - Hoặc ghi link vào `src/config.json` (`apiUrl`) rồi chạy `node tools/build.mjs`: app sẽ không hỏi nữa.
7. Đăng nhập NV001 / 111111 → **Cá nhân → Quản trị → Người dùng**: đổi PIN mặc định, thêm nhân viên (mã NV, tên tiếng Trung).

## Nhập dữ liệu cũ từ Excel của nhà máy

Dữ liệu cũ đã nằm sẵn trong `Code.gs`, không cần tải file lên:
- **Số điện** (sổ điện 2026, từ kỳ 31/12/2025 đến kỳ 10/10/2026, 44 công tơ): tự nhập ở lần mở app đầu tiên. Nếu app đã mở trước khi dán bản mã có kỳ tháng 9–10, chạy hàm `nhapLaiSoDienExcel` một lần; số đã có không bị nhập trùng.
- **Công việc** (Bảng phân công công việc: 73 việc; Bảng ghi chép sửa chữa thiết bị 12/10/2026: 3 việc sửa chữa): chạy hàm `nhapDuLieuCu` một lần trong Apps Script.
  - Tạo tài khoản cho 7 người trong bảng (Lê Minh Tiến, Đỗ Văn Hồng, Nguyễn Tuấn, 吴建杰, Bùi Văn Chung là Quản lý, Lương Văn Hiệp, Bùi Văn Vân). Mã nhân viên lấy theo mã thẻ (V25252…); người chưa có mã thẻ được đặt NV004, NV005…
  - PIN của mỗi tài khoản mới là số ngẫu nhiên, in ở **Nhật ký thực thi** ngay sau khi chạy. Ghi lại và đưa cho từng người, hoặc đặt PIN khác ở **Quản trị → Người dùng**.
  - Người ghi đầu tiên ở cột "Nhân viên thực hiện" là người làm chính, người sau là người làm cùng. "吴剑杰" và "阿杰" được hiểu là 吴建杰; "Vân", "Tiến" là Bùi Văn Vân, Lê Minh Tiến.
  - Bảng cũ không có ngày xong, nên việc "Đã hoàn thành" lấy ngày xong bằng hạn hoàn thành. Loại việc (Lắp đặt, Sửa chữa…) được đoán theo tên việc, sửa được trong app.
  - Chạy lại không tạo trùng.

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

## Điểm mới của v2.26.0: mã lỗi Inovance và màn Sơ đồ đấu

Cả hai chỉ **Quản lý và Quản trị** dùng được, như phần Tính toán TB.

### Thêm mã lỗi Inovance — bảng tra lên 142 mã

| Hãng | Dòng | Số mã |
|---|---|---|
| Mitsubishi | Biến tần FR-E700/D700/A700/F700 · Servo MR-J4/MR-JE | 74 |
| **Inovance** | **Biến tần MD200/MD280/MD290/MD310/MD380/MD500/MD520** · **Servo SV660/SV620/IS620** | **68** |

Biến tần Inovance: `Err01`–`Err51` (bảo vệ khối nghịch lưu, quá dòng/quá áp theo từng giai đoạn, thấp áp, quá tải, mất pha, quá nhiệt, chạm đất, lỗi truyền thông, encoder, mất tải, vượt tốc…). Servo Inovance: `Er.101`–`Er.950` (quá dòng, chạm đất, sai thứ tự pha, quá áp/thấp áp, vượt tốc, quá tải, pin encoder, sai lệch vị trí…).

Chip lọc đổi từ *Biến tần / Servo* sang **Mitsubishi / Inovance**; mỗi thẻ kết quả ghi rõ hãng, dòng máy và loại thiết bị. Tìm vẫn bỏ qua dấu chấm, gạch và khoảng trắng: `err 09` ra **Err09**, `er740` ra **Er.740**.

### Màn Sơ đồ đấu

Bốn dòng máy: **Mitsubishi FR**, **Mitsubishi MR-J4**, **Inovance MD**, **Inovance SV660/IS620**. Mỗi dòng có:

- **Mạch động lực** — tên đầu cốt in trên máy và chức năng (R/S/T, U/V/W, P/+ – PR, (+) – PB, L11/L21, L1C/L2C, cầu nối điện trở hãm, cuộn kháng…).
- **Mạch điều khiển** — tên chân điều khiển (STF/STR/SD/PC/10/2/5/4/AM, DI1–DI5/COM/+24V/OP/AI/AO/TA-TB-TC/485…).
- **Giắc cắm** — CN1/CN2/CN3/CN8/CNP… dùng vào việc gì.
- **Dễ sai chỗ này** — những lỗi đấu nối hay gặp: đấu nhầm nguồn vào U/V/W, quên tháo cầu nối khi lắp điện trở hãm hoặc cuộn kháng, quên bật AU khi dùng 4–20mA, quên tháo cầu nối +24V–OP khi dùng nguồn ngoài, thay pin encoder lúc mất nguồn…
- Nút **Tài liệu của dòng này** → mở thẳng mục Tài liệu đã lọc sẵn theo dòng máy.

Trên đầu màn có cảnh báo cố định: *cắt nguồn và chờ đèn CHARGE tắt hẳn mới được mở tủ hay chạm vào đầu cốt*.

**App cố ý KHÔNG vẽ lại sơ đồ của hãng và KHÔNG ghi số chân của các giắc.** Số chân khác nhau theo từng đời máy, ghi sai là hỏng thiết bị hoặc gây tai nạn. Màn này là bảng tên đầu cốt để tra nhanh tại máy; sơ đồ thật thì tải trang manual của hãng lên mục **Tài liệu → nhóm Bản vẽ**, nút trên màn mở thẳng tới đó.

## Điểm mới của v2.25.0: sắp xếp lại menu

Menu cũ là **11 mục phẳng** ngang hàng nhau, và riêng mục *Thiết bị* gánh tới **20 màn con**. Hai mục thêm ở bản 2.23 (Kiểm định, Tính toán TB) bị nhét vào đó vì không còn chỗ — dấu hiệu cấu trúc đã quá tải.

### Một quy tắc thay cho việc xếp hộp

> **Màn nào đã có tab bên trong thì chỉ được MỘT dòng ở menu.**

*Thiết bị · Bảo dưỡng · Lịch sử · Kho linh kiện* vốn là **bốn tab của cùng một màn**, nhưng menu cũ để chúng thành các mục riêng — bấm mục này lại thấy thanh tab của mục kia. Nay gộp về một dòng **Thiết bị**; vào trong đổi tab như cũ. Tương tự, *Nhắc hàng, Tồn kho an toàn, In tem QR, Phân ca trực, Tổng số ca* đều đã nằm trong màn của chúng nên bỏ khỏi menu.

### Kết quả: 11 mục → 5 nhóm, 9 dòng

| Nhóm | Dòng | Bên trong có sẵn |
|---|---|---|
| **Việc hằng ngày** | Công việc | Sửa chữa · Việc lặp lại · Báo cáo |
| | Thiết bị | Danh sách · Bảo dưỡng · Lịch sử · Kho linh kiện |
| **Điện · Nước** | Điện / Nước | Ghi số · Duyệt ngoại lệ · Tiền điện · Thông số |
| **Nhân sự** | Tăng ca | Đơn in · Tổng hợp tháng · Ca làm việc |
| | Lịch trực | Lịch tuần · Tổng số ca · Phân công ca trực |
| **Tra cứu · Công cụ** | Kiểm định · Tính toán TB · Tài liệu máy | |
| **Hệ thống** | Cá nhân | Quản trị · Người dùng · Báo tin · Sao lưu |

**Tài liệu máy** kéo từ *Cá nhân → Quản trị* ra ngoài — thợ tra suốt mà đang bị chôn ba lớp. **Quét QR** bỏ khỏi menu vì nút tròn giữa thanh tab đã là nó.

### Trên điện thoại và máy tính

Thanh tab: **Trang chủ · Công việc · [Quét] · Thiết bị · Thêm**. Bấm **Thêm** ra đúng năm nhóm trên, không phải nhớ chức năng nằm ở đâu.

Máy tính: sidebar vẫn thấy hết, có thêm tiêu đề phân nhóm. Đang xem *Bảo dưỡng*, *Lịch sử* hay *Kho* thì ô **Thiết bị** sáng, vì cùng một màn.

**Tài khoản kỹ thuật** tự gọn còn 4 nhóm / 6 dòng (không Thiết bị, không Kho, không Kiểm định, không Tính toán, không Tài liệu); ô thứ tư của thanh tab là **Bảo dưỡng** thay cho Thiết bị.

Giao diện (màu sắc, kiểu thẻ) **giữ nguyên** — bản này chỉ đổi cách sắp xếp.

## Điểm mới của v2.24.0: tra lỗi biến tần và servo Mitsubishi

Thêm tab **Tra lỗi** vào mục **Tính toán TB**. Gõ mã lỗi đang hiện trên màn hình thiết bị (hoặc từ khoá tiếng Việt như *quá dòng*, *quá nhiệt*) là ra ngay **tên lỗi song ngữ, nguyên nhân thường gặp và cách xử lý**.

Bảng tra sẵn gồm **74 mã**:

- **Biến tần Mitsubishi FR** (E700 · D700 · A700 · F700): E.OC1–OC3, E.OV1–OV3, E.THT, E.THM, E.FIN, E.IPF, E.UVT, E.ILF, E.LF, E.GF, E.OLT, E.OHT, E.PTC, E.BE, E.PE, E.PUE, E.RET, E.CPU, E.OPT, E.AIE, E.SAF, E.P24, E.CTE, và các cảnh báo OL, oL, TH, RB, FN, PS, Err, HOLD, LOCd.
- **Servo / driver Mitsubishi MR-J4 · MR-JE**: AL.10, 12, 13, 15, 16, 17, 1A, 20, 24, 25, 30, 31, 32, 33, 34, 35, 37, 42, 45, 46, 47, 50, 51, 52, 56, 63, 8A, 8E, 888, và các cảnh báo AL.90, 91, 92, 9F, E0, E1, E6, E9, EC.

Gõ gọn cũng ra: *al32* tìm được **AL.32**, *eoc1* tìm được **E.OC1** (app bỏ qua dấu chấm, gạch và khoảng trắng).

### Ba thứ app ghép thêm vào mỗi mã lỗi

1. **Ghi chú của nhà máy** — bấm *Thêm ghi chú* để ghi cách xử lý thực tế đã làm ở xưởng ("máy in phun VKY01: lần trước do quạt tủ hỏng, thay quạt là hết"). Ghi chú **tự dịch sang tiếng Trung**, lưu trên máy chủ (trang `MaLoi`), lần sau ai tra mã đó cũng thấy. Mã lỗi **chưa có trong bảng** cũng thêm được bằng đúng chỗ này.
2. **Đã gặp ở nhà máy** — app dò trong sổ sửa chữa và công việc xem mã lỗi đó từng xuất hiện chưa, liệt kê tối đa 5 lần gần nhất, bấm vào là mở thẳng phiếu cũ.
3. **Nhắc an toàn** cố định trên đầu màn: *cắt nguồn và chờ đèn CHARGE tắt hẳn mới được mở tủ hay chạm vào đầu cốt.*

Bảng tra soạn theo tài liệu Mitsubishi cho các dòng kể trên; mỗi đời máy có thể khác nên màn hình ghi rõ phải **đối chiếu manual đúng đời trước khi thao tác**.

## Điểm mới của v2.23.0: kiểm định thiết bị và tính toán TB

Hai mục mới, mở từ màn **Thiết bị**, **chỉ Quản lý và Quản trị** dùng được (kỹ thuật không thấy, máy chủ cũng chặn).

### Sổ kiểm định thiết bị · 设备检定

Sổ **riêng**, không phải danh mục máy — vì xe nâng, nồi hơi, bình chịu áp lực thường không nằm trong danh mục máy sản xuất. Thiết bị nào đã có trong danh mục thì **chọn mã máy để nối vào**, bấm là mở sang hồ sơ máy.

Mỗi thiết bị ghi: loại, số hiệu/serial, nhà sản xuất, năm sản xuất, thông số (tải trọng, áp suất, dung tích…), vị trí đặt, chu kỳ kiểm định, ngày khai báo sử dụng, ghi chú. Tên và ghi chú **tự dịch sang tiếng Trung**.

**Thiết bị có yêu cầu nghiêm ngặt về an toàn lao động** được đánh dấu riêng và lọc riêng. Chọn loại là app tự tích sẵn và điền sẵn chu kỳ thường gặp (nồi hơi 24 tháng, bình chịu áp lực 36, xe nâng 24, thang máy 36…) — sửa lại được cho từng thiết bị. Danh mục loại gồm 17 nhóm: nồi hơi, bình chịu áp lực, đường ống hơi, hệ thống lạnh, chai chứa khí, cần trục, palăng, xe nâng, sàn nâng, thang máy, thang cuốn, thiết bị hàn hơi, máy nén khí, thiết bị điện và chống sét, PCCC, thiết bị đo lường, khác.

**Ghi từng lần kiểm định**: ngày, đơn vị kiểm định, số giấy chứng nhận, kết quả. **Hạn kế tiếp tự tính** = ngày kiểm định + chu kỳ. Kết quả *Không đạt* thì không có hạn, phải kiểm định lại. Lần cũ vào **lịch sử**, giữ tối đa 30 lần — tra lại được cả quá trình.

**Nhắc hạn**: quá hạn hiện đỏ ở **trang chủ** của Quản lý, sắp hết hạn (trong 30 ngày) hiện xanh; cả hai đi kèm **tin nhắn nhắc hằng ngày** (Telegram và WeChat Work). Xin lịch kiểm định mất thời gian nên app nhắc trước 30 ngày, không theo số ngày nhắc bảo dưỡng.

**Xuất Excel** cả sổ để nộp hoặc lưu hồ sơ: 17 cột, có cột tình trạng và cột đánh dấu nhóm nghiêm ngặt.

Trang mới `KiemDinh`, tự tạo khi nâng cấp.

### Tính toán TB · 设备计算

Bốn bài tính, không lưu gì, mở ra là dùng:

| Bài | Nhập | Ra |
|---|---|---|
| **Động cơ** | kW, điện áp, số pha, cosφ, hiệu suất, bội số dòng khởi động, kiểu khởi động | Dòng định mức, dòng khởi động, **chọn CB**, **khởi động từ (AC-3)**, giá trị đặt **rơle nhiệt** |
| **Dây dẫn** | Dòng (lấy được từ bài động cơ), chiều dài, đồng/nhôm, PVC/XLPE, cách đi dây, nhiệt độ, số mạch đi chung, sụt áp cho phép | Hệ số hiệu chỉnh k1/k2, tiết diện **theo dòng** và **theo sụt áp**, lấy cái lớn hơn, sụt áp thực tế, cỡ **dây PE** |
| **Tụ bù** | kW, cosφ hiện tại, cosφ mong muốn | kVAr cần bù, gợi ý cỡ tụ lắp |
| **Kiểm tra sụt áp** | Dòng, chiều dài, tiết diện đang dùng | Sụt áp (V và %), đạt hay không |

**Về bảng dòng cho phép**: app có sẵn bảng tra theo IEC 60364-5-52 (cáp nhiều ruột, 3 ruột mang tải, 30 °C) cho đồng và nhôm, cách điện PVC và XLPE, ba cách đi dây. Phần sụt áp tính thẳng bằng công thức, không tra bảng. Nếu cáp nhà máy đang mua có dòng cho phép khác với bảng, nhập thẳng vào ô **Icp theo catalogue hãng** — app sẽ dùng số đó.

Màn hình có ghi rõ: **kết quả chỉ để chọn sơ bộ, trước khi lắp đặt phải có thợ điện hoặc đơn vị thiết kế kiểm tra lại theo catalogue của hãng.**

## Điểm mới của v2.22.0: tăng ca tuần cũ tự khoá, chú thích trên đơn in song ngữ

### Nhân viên chỉ ghi và sửa trong hai tuần gần nhất

Trước đây nhân viên sửa được tăng ca của bất kỳ ngày nào, kể cả tháng đã chốt lương, và ghi trước được cho ngày chưa tới.

Nay khoảng ghi và sửa của nhân viên là **từ thứ Hai tuần trước đến hôm nay**:

- **Mỗi thứ Hai, tuần cũ nhất tự khoá lại** — không phải bấm nút gì, cũng không ai quên. Hợp với lệ chốt lịch vào thứ Hai.
- **Không ghi trước cho ngày chưa tới**: hôm nay không ghi được tăng ca của ngày mai.
- Trong khoảng đó thì thoải mái: quên chưa ghi hôm thứ Bảy tuần trước vẫn ghi bù được, sửa và xoá được.

Trên giao diện: dòng của tuần đã khoá hiện mờ và bấm không vào, tuần đó không có nút **Thêm**, ô chọn ngày không chọn được ngoài khoảng. Máy chủ cũng chặn lại, kể cả khi app gửi lên từ hàng chờ lúc mất mạng.

**Quản lý và Quản trị không bị khoá** — vẫn ghi hộ, sửa và xoá được mọi tuần. Ai lỡ ghi sai tuần đã khoá thì báo Quản lý sửa hộ; mọi lần sửa đều đã ghi nhật ký như trước.

### Cột Chú thích 备注 trên đơn in thành song ngữ

Tờ **ĐƠN XIN TĂNG CA · 自愿加班申请单** trước đây in cột *Chú thích* chỉ bằng tiếng Việt. Nay in cả hai thứ tiếng: **ca làm việc** (Hành chính 行政班, Ca đêm 夜班 …) và **lý do tăng ca** kèm bản dịch tiếng Trung mà máy chủ đã dịch sẵn. Dịch sai thì sửa tay trong app, tờ đơn in theo bản đã sửa.

## Điểm mới của v2.21.0: báo tin vào nhóm WeChat Work · 企业微信

Ngoài Telegram và email, app gửi được tin vào **nhóm WeChat Work (企业微信)** bằng **robot nhóm** — thứ công nhân người Trung đằng nào cũng có sẵn trên điện thoại.

Gửi đúng những tin như Telegram: nhắc máy đến hạn hằng ngày, báo khi giao việc, báo khi bảo dưỡng xong. Bật được cả ba kênh cùng lúc, kênh này lỗi không ảnh hưởng kênh kia.

### Cài (một lần, khoảng 2 phút)

1. Mở **企业微信** → vào nhóm chat muốn nhận tin.
2. Bấm **⋯** góc trên bên phải → **群机器人** → **添加** → **新创建一个机器人** → đặt tên.
3. Copy **Webhook地址**.
4. Trong app: **Quản trị → Báo tin → WeChat Work 企业微信**, dán địa chỉ vào, đặt tên nhóm cho dễ nhớ, bật công tắc, **Lưu**, rồi bấm **Gửi thử**.

Không phải xin quyền, không OAuth, không xác thực doanh nghiệp, **không mất phí**.

### Phần an toàn

App **chỉ nhận địa chỉ `qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…`** — dán nhầm hay dán địa chỉ lạ thì báo lỗi ngay, không gửi dữ liệu nhà máy đi đâu khác. Địa chỉ đã lưu **không trả ngược về app** (chỉ hiện 4 ký tự cuối), ai mở màn Báo tin cũng không đọc trộm được. Chỉ **Quản trị** vào được màn này.

Tin soạn sẵn theo kiểu Telegram (HTML) nên app tự đổi sang Markdown của 企业微信; tin dài quá 4096 byte thì cắt bớt cho đúng giới hạn của WeChat Work.

## Điểm mới của v2.20.0: bỏ bước xác nhận bắt đầu, ngày giao việc là ngày bắt đầu

Trước đây nhân viên nhận việc phải bấm **Bắt đầu** rồi mới bấm **Xong việc** — một bước thừa, vì việc đã giao là coi như bắt đầu từ lúc giao.

Nay **bỏ hẳn nút Bắt đầu**. Việc *Đã giao* hiện thẳng **Xong việc** và **Tạm hoãn**; nhân viên làm xong là bấm Xong việc, không phải xác nhận gì trước đó.

**Giờ bắt đầu lấy theo giờ giao việc**: lúc giao (giao tay, giao nhiều việc một lúc, hay việc lặp lại tự sinh ra) app ghi luôn `LucBatDau` bằng giờ giao. Trước đây việc không bấm Bắt đầu thì giờ bắt đầu bị lấy bằng **giờ xong**, nên thời gian làm việc trong báo cáo bằng 0.

Việc **Tạm hoãn** vẫn có nút **Làm tiếp** như cũ. Việc đang ở *Đang làm* từ trước vẫn chạy bình thường.

## Điểm mới của v2.19.0: giao việc lặp lại tới được tài khoản nhân viên, một người check sheet nhiều máy

### Sửa lỗi: giao người trong mẫu mà nhân viên không nhận được việc

Mỗi mẫu **việc lặp lại** chỉ sinh việc cho ngày chưa sinh. Mẫu đã sinh việc của hôm nay rồi, sau đó Quản lý mới mở mẫu ra chọn người, thì **việc hôm nay vẫn nằm ở "Chờ giao" không có ai** — phải sang ngày mai mới đúng người. Tài khoản nhân viên vì thế không thấy việc nào.

Nay sửa mẫu là **việc đã sinh của hôm nay đổi theo luôn**: người làm, người làm cùng, thiết bị, tiêu đề, loại, mức ưu tiên. Nhân viên mở app là thấy việc trong phần việc của mình.

Chỉ đổi những việc **chưa ai động tới** (còn *Chờ giao* hoặc *Đã giao*, chưa bấm bắt đầu). Việc nhân viên đã bắt đầu, đã xong hay đã huỷ thì **giữ nguyên**, sửa mẫu không chạm tới. Bớt người hoặc bớt máy trong mẫu thì việc thừa của hôm nay, nếu chưa ai làm, được **huỷ** (giữ dòng để tra lại).

Mẫu lâu ngày chưa chạy vẫn sinh bù những ngày đã qua như trước.

Thêm nữa: việc lặp lại sinh ra có giao sẵn người thì **báo tin Telegram** như khi Quản lý giao tay (gộp theo người, có bật/tắt ở mục *Báo tin*).

### Một người check sheet nhiều máy

Trong kiểu **mỗi người một việc**, mỗi người giờ chọn được **nhiều máy** chứ không phải một máy. Mỗi máy sinh **một việc riêng** cho người đó — đúng như bảng check sheet một người đi mấy máy.

Mỗi dòng là một người, bên dưới là các thẻ máy người đó phụ trách: chọn ở ô *+ Thêm máy cho người này*, bấm vào thẻ máy để bỏ. Không chọn máy nào thì theo thiết bị chung ghi ở trên.

Giới hạn: **30 người** mỗi mẫu, **20 máy** mỗi người, **60 việc** mỗi lần sinh. Quá thì app báo ngay lúc lưu.

## Điểm mới của v2.18.0: việc lặp lại giao cho nhiều người

Trước đây mỗi mẫu **việc lặp lại** chỉ giao được cho **một người**. Nay có hai cách giao, chọn ngay trong màn sửa mẫu:

| Cách giao | Sinh ra | Dùng khi |
|---|---|---|
| **Một việc cho cả nhóm** | **Một việc**, một người làm chính + **người làm cùng** (tối đa 5) | Việc cần mấy người cùng làm một chỗ |
| **Mỗi người một việc** | **Mỗi dòng một việc riêng**, ai máy nấy | Check sheet: mỗi người kiểm tra máy của mình |

Kiểu **mỗi người một việc**: thêm từng dòng **người + thiết bị** (tối đa 30 dòng). Mỗi ngày đến hạn, app sinh ra **một việc riêng cho từng dòng**, giao sẵn cho đúng người và gắn đúng máy của họ. Dòng nào để trống thiết bị thì dùng thiết bị chung ghi ở trên.

Trang `ViecLap` thêm hai cột `UIDPhu` và `DsGiao`, tự thêm khi nâng cấp; mẫu cũ vẫn chạy như trước.

## Điểm mới của v2.17.0: ghép cặp trực ca, chép lịch trực sang tuần sau

### Phân công ca trực theo cặp

Nhóm **SẢN XUẤT** trực theo **cặp** đúng như bảng giấy cũ của nhà máy: hai người một cặp, **trực chung hai tuần** — tuần đầu một người ca ngày một người ca đêm, **tuần sau đổi lại**; hết hai tuần mới sang cặp kế tiếp.

Ghép cặp trong **Lịch trực → Phân công ca trực → Sửa danh sách người trực**: mỗi người chọn *Cặp 1 … Cặp 8*. Hai người cùng số cặp là một cặp. Ai **chưa ghép cặp** thì không được xếp tự động (Quản lý vẫn chọn tay được), app ghi rõ trong danh sách.

Lần nâng cấp đầu nhập sẵn ba cặp theo bảng cũ: Ninh–Quân, Đông–Thịnh, Vinh–Hòa.

Nhóm **KHO NGŨ KIM** chỉ có hai người nên giữ cách cũ: mỗi tuần hai người đổi ca cho nhau. Nhóm nào **chưa ghép cặp ai** cũng chạy cách cũ (luân phiên từng người).

Panel **Thứ tự luân phiên** nay hiện theo cặp, đánh dấu ai đang trực tuần này và cặp nào kế tiếp.

### Chép lịch trực sang mấy tuần sau

Nội dung trực tuần này hay lặp lại, nên thêm nút **Chép lịch sang tuần sau** trong Lịch trực tuần (chỉ Quản lý): chọn **1 · 2 · 4 · 8 tuần**, rồi chọn

- **Giữ ngày đã xếp** — chỉ điền vào ngày còn trống ở các tuần sau
- **Ghi đè tất cả** — thay hết

Chép cả người trực lẫn nội dung trực (kèm bản dịch tiếng Trung). Ngày nào tuần nguồn để trống thì tuần sau cũng để trống.

## Điểm mới của v2.15.0: tồn kho an toàn nhập từ file, báo thiếu theo phần trăm

Bản 2.13 đã biết nhắc thiếu hàng, nhưng tồn kho an toàn phải gõ từng mã trong app. Nhà máy có sẵn bảng **số lượng dự phòng** cho hàng trăm linh kiện điện – khí, nên bản này cho **nhập cả bảng vào app một lần**.

### Hai cách đặt tồn kho an toàn

1. **Sửa trong app** — mở linh kiện trong Kho ngũ kim, sửa ô *Tồn tối thiểu* (như cũ).
2. **Sửa trên file rồi tải lên** — Kho ngũ kim → **Tải file mẫu tồn an toàn** (Excel: mã sản phẩm, tên, quy cách, ĐVT, vị trí, tồn hiện tại, **tồn an toàn**, cần thêm, **bỏ theo dõi**, máy đang dùng) → sửa cột *Tồn an toàn* → **Nhập tồn an toàn từ file**.

App nhận cả **bảng dự phòng sẵn có của nhà máy**: chỉ cần có cột **Mã sản phẩm** (mã ERP) và cột **Số lượng dự phòng** (hoặc *Tồn an toàn*, *安全库存*). Trước khi lưu, app hiện rõ sẽ đổi bao nhiêu mã, bỏ qua bao nhiêu mã lạ.

> Mã phải là **mã sản phẩm (mã ERP)**, không phải mã của nhà cung cấp — mã nhà cung cấp không khớp được với kho.

### Quy cách và đơn vị lấy thêm từ file

Mã nào trong kho **chưa có quy cách** (mã app vừa thêm, hoặc file ERP để trống cột 规格) thì lấy theo file tồn an toàn: cột *Quy cách*, hoặc **cột "Mã linh kiện"** — trong bảng của nhà máy nhiều dòng để quy cách ở chính cột này (vd `φ12`). Quy cách đã có từ ERP thì **không bị ghi đè**; đơn vị tính cũng vậy.

### Bỏ những mã không mua nữa

Hàng không dùng nữa, không mua nữa thì **đánh dấu `x` ở cột "Bỏ theo dõi"** trong file rồi tải lên: app bỏ tồn an toàn, **ẩn mã đó khỏi kho** và thôi nhắc mua. Xoá dấu `x` rồi nhập lại là dùng lại được — không mất dữ liệu, tồn vẫn cập nhật theo file ERP.

Trong app cũng làm được từng mã: mở linh kiện → **Bỏ theo dõi linh kiện này** / **Dùng lại** (chỉ Quản lý). Trước đây chỉ linh kiện tự thêm trong app mới ẩn được, nay cả linh kiện từ file ERP.

> File **không có** cột "Bỏ theo dõi" thì app không đụng tới trạng thái ẩn của mã nào — nên bảng dự phòng sẵn có của nhà máy nhập vào vẫn an toàn.

### Chặn mã gõ nhầm

Mã trong file **dài ngắn khác hẳn mọi mã đang có trong kho** (vd `60803009` 8 số trong khi mã kho đều 9 số) thì app xếp riêng vào nhóm **Mã nghi gõ nhầm**, gợi ý vài mã kho gần giống, và **không thêm vào kho**. Sửa lại mã trong file rồi nhập lại là xong — tránh việc một mã gõ thiếu số biến thành linh kiện "hết hàng" nằm mãi trong danh sách cần mua.

### Mã đã hết sạch không có trong file ERP

File ERP **chỉ xuất những mã còn tồn**, nên thứ đã dùng hết lại biến mất khỏi file — đúng những thứ cần mua nhất. Khi nhập tồn an toàn, app hỏi có **thêm những mã chưa có vào kho, coi như hết hàng** không (mặc định có). Lần nhập ERP sau có hàng về thì tồn tự cập nhật, tồn an toàn giữ nguyên.

### Thiếu hàng tính theo phần trăm mức an toàn

| Trường hợp | App xếp vào |
|---|---|
| Tồn 0 | **Hết hàng** (vừa hết / đang hết) |
| Có tồn an toàn, tồn tụt **dưới 15%** mức an toàn | **Thiếu hàng**, ghi rõ *cần thêm bao nhiêu* |
| Chưa đặt tồn an toàn, tồn ≤ ngưỡng chung (mặc định 1) | **Gần hết hàng** |

**Mức báo thiếu 15% sửa được ngay trong app**: Kho ngũ kim → ô **Mức báo thiếu hàng** (bấm mới mở, chỉ Quản lý) — trong đó có cả *Báo thiếu khi tồn dưới __%* và *Gần hết khi tồn còn __*. Đặt 100% là hễ dưới mức an toàn là báo; đặt 15% thì chỉ báo khi gần cạn. Số **cần mua vẫn tính cho đủ 100%** mức an toàn, không phải chỉ đủ mốc báo.

Danh sách sắp theo **thiếu nhiều nhất lên trước**, và **xuất Excel "Linh kiện cần mua"** để gửi thẳng bộ phận mua hàng. Linh kiện đã đặt tồn an toàn được theo dõi **dù chưa gắn vào máy nào**.

### Thiếu hàng không báo ra trang chủ

Toàn bộ phần này nằm trong **Kho ngũ kim**, chỉ **Quản lý, Quản trị** xem và sửa. Trang chủ không còn ô cảnh báo linh kiện dưới mức tối thiểu, ô *Linh kiện* ở Tổng quan chỉ còn đếm số mã còn hàng.

Dán `Code.gs-v2.26.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Không có trang mới.

## Điểm mới của v2.13.0: kho ngũ kim nhớ tồn qua từng lần nhập, nhắc thiếu hàng

Trước đây mỗi lần nhập file ERP là **ghi đè** số tồn, không giữ lại gì. App chỉ biết "lần này mã nào bằng 0", nên chỉ cảnh báo được **hết hàng**, mà cũng chỉ với linh kiện đã gắn vào máy.

Nay mỗi lần nhập file, máy chủ **ghi nhớ tồn của từng mã** (12 lần nhập gần nhất, cột `TonCu` trong trang `KhoLK`) và ghi một dòng vào trang **`NhapKho`** — nhật ký nhập file giữ lại hết. Nhờ đó app biết tồn lần này so với lần trước, và mã nào đã hết liền mấy lần nhập mà vẫn chưa về hàng.

### Nhắc hàng ngay sau khi nhập file

Nhập file xong, app mở luôn màn **Nhắc hàng**, chia ba nhóm:

| Nhóm | Nghĩa |
|---|---|
| **Vừa hết hàng** | Lần nhập trước vẫn còn, lần này đã hết |
| **Đang hết hàng** | Hết từ những lần nhập trước, vẫn chưa về hàng — ghi rõ *hết mấy lần nhập liền* |
| **Gần hết hàng** | Tồn còn ít hơn hoặc bằng ngưỡng gần hết |

Mỗi dòng ghi **tồn lần trước → tồn nay**, số máy đang dùng linh kiện đó, và ô để trong kho.

### Chỉ nhắc linh kiện đã dùng

File ERP có hàng nghìn mã, phần lớn không liên quan tới thiết bị. App chỉ nhắc linh kiện **đang gắn vào máy** hoặc **đã từng thay** trong sửa chữa, bảo dưỡng, công việc — đúng những thứ nhà máy thực sự dùng.

### Ngưỡng "gần hết hàng" mặc định là 1

Tồn còn **1** là gần hết (ô tồn chuyển màu cam ở mọi danh sách, kể cả lúc chọn linh kiện khi ghi sửa chữa). Quản lý đổi ngưỡng chung ngay trong mục Kho ngũ kim; linh kiện nào có **tồn tối thiểu riêng** thì vẫn theo số riêng của nó.

Phiếu chi tiết mỗi linh kiện có thêm mục **Tồn qua các lần nhập**, xem được hàng này tiêu hao nhanh hay chậm.

### Sửa lỗi: lưu ca làm việc làm mất cài đặt khác

Màn **Ca làm việc** (phần Tăng ca) khi lưu đang ghi đè cả khối cài đặt, làm mất **giá điện**, **sản lượng tháng**, ngưỡng cảnh báo điện và cả **token Telegram** đã nhập — những thứ đó âm thầm quay về mặc định. Nay sửa thành đọc rồi sửa, chỉ thay phần ca làm việc.

Dán `Code.gs-v2.26.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Trang `NhapKho` và cột `TonCu` tự thêm, dữ liệu cũ giữ nguyên. Lịch sử tồn bắt đầu tính từ lần nhập file đầu tiên sau khi nâng cấp.

## Điểm mới của v2.12.0: lịch trực tuần và phân công ca trực

Thêm mục **Lịch trực** (thanh bên và ô ở Tổng quan). Trong đó có hai phần tách riêng nhau, vì là hai việc khác nhau:

### 1. Lịch trực tuần — 17:00 đến 19:30

Bảng bảy ngày của tuần, **mỗi ngày một người**, Chủ nhật cũng có trực. Người trực là người có tài khoản trong app.

- Bên cạnh tên là **nội dung trực của riêng người đó ngày đó**, do Quản lý nhập, không theo mẫu sẵn — nhập gì thì người đó thấy đúng cái đó.
- Nhập tiếng Việt, **app tự dịch sang tiếng Trung** ở dòng dưới (Google Dịch có sẵn trong Apps Script, không cần khoá). Dịch chưa đúng thì sửa ô *Nội dung tiếng Trung*; đã sửa tay rồi thì app **không dịch đè** nữa.
- Tên người hiện **song ngữ** (lấy tên tiếng Trung trong hồ sơ nhân viên).
- Ngày chưa xếp hiện đỏ "Chưa xếp", đầu bảng đếm "còn mấy ngày chưa xếp".
- **Tổng số ca** là một ô riêng, bấm vào mới mở bảng: mỗi người **bao nhiêu ngày trực** trong tháng, **trong đó bao nhiêu ngày Chủ nhật**. Ai trực nhiều hơn hẳn hoặc có ngày Chủ nhật thì số tô cam, để chia lại cho đều.

### 2. Phân công ca trực · 值班排班表

Dựng đúng bảng giấy của nhà máy: **ca ngày (7h30–19h30)** và **ca đêm (19h30–7h30)** × hai nhóm **SẢN XUẤT 生产** và **KHO NGŨ KIM 五金仓库**, mỗi ô là tên song ngữ kèm số điện thoại (bấm số là gọi được).

- **Danh sách người trực ca là danh sách riêng** (trang `NguoiTruc`), không phải tài khoản dùng app, không dính tới công việc, bảo dưỡng hay số điện. Lần đầu nâng cấp app nhập sẵn 7 người sản xuất và 2 người kho ngũ kim theo bảng của nhà máy; sửa trong app hoặc ngay trên trang `NguoiTruc`.
- Bỏ ai khỏi danh sách thì app **ghi là đã nghỉ** (không xoá dòng): bảng các tuần cũ vẫn còn tên người đó, nhưng xếp lịch mới thì không gọi tới nữa.
- **Hai cách xếp:** bấm vào ô để **chọn tay**, hoặc bấm **Xếp luân phiên** — mỗi ca dịch xuống một người so với tuần trước (ai trực ca đêm tuần trước thì tuần sau trực ca ngày; nhóm có hai người thì đổi chỗ ca ngày ↔ ca đêm). Tuần đầu chưa có gì thì lấy hai người đầu danh sách.
- Panel **Thứ tự luân phiên** hiện rõ ai đang trực tuần này, ai **kế tiếp**.
- **Số điện thoại tự lấy theo người đã chọn**, không phải nhập lại. Nút **In bảng** in ra đúng mẫu giấy để dán xưởng.

**Phân quyền:** ai cũng **xem** được cả hai bảng (để biết ai trực, gọi số nào); chỉ **Quản lý, Quản trị** xếp lịch, nhập nội dung trực và sửa danh sách người trực ca.

**Ba trang mới tự tạo khi nâng cấp:** `LichTruc` (mỗi ngày một dòng), `NguoiTruc` (danh sách người trực ca), `PhanCa` (bảng phân công từng tuần). Dán `Code.gs-v2.26.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới; dữ liệu cũ giữ nguyên.

## Điểm mới của v2.11.3: Ghi sửa chữa chọn linh kiện từ kho

Ô **Linh kiện thay** ở màn **Ghi sửa chữa** trước đây chỉ là ô chữ tự do: gõ "driver" thì máy chủ cắt theo dòng rồi tạo linh kiện giả mã `LKSC1`, `LKSC2`… **không mã kho, không số lượng, không vào thống kê linh kiện của máy**. Nên mọi lần sửa chữa đều không được đếm trong thống kê, chỉ bảo dưỡng và việc được giao mới có.

Nay ô đó dùng **đúng ô chọn linh kiện** của màn Xác nhận bảo dưỡng và Báo xong việc:

- Chọn từ **danh sách linh kiện của máy**, có sẵn số lượng và đơn vị tính, hiện **tồn kho**.
- Hoặc chọn **Khác** rồi gõ tên — app **gợi ý linh kiện có trong kho** ngay khi gõ, kèm mã ERP và tồn; bấm chọn là nối mã kho.
- Đổi thiết bị thì danh sách linh kiện đổi theo, các dòng đã chọn theo máy cũ được bỏ đi.
- Thiết bị là **chuyền** hoặc **không gắn thiết bị** thì vẫn ghi được: ô chọn chuyển thành gõ tên có gợi ý kho.

**Quy tắc thêm vào danh sách linh kiện của máy:**

- Linh kiện **kho đã có** (chọn từ danh sách của máy, hoặc chọn từ gợi ý kho) → **thêm vào danh sách linh kiện của máy**, như Báo xong việc vẫn làm. Từ đó vào thống kê linh kiện.
- Linh kiện **gõ tay mà kho chưa có** → chỉ ghi trong bản ghi sửa chữa, **không thêm vào danh sách của máy**, để danh sách không phình ra vì những thứ dùng một lần.

Máy chủ vẫn nhận dạng chữ nhiều dòng của bản cũ, nên bản ghi sửa chữa đang chờ gửi ngoại tuyến từ app cũ không bị hỏng.

## Điểm mới của v2.11.2: xác nhận tiêu thụ bất thường, mã việc lặp lại không trùng

Bản sửa lỗi, không thêm bảng dữ liệu nào. Dán `Code.gs-v2.26.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới là xong, dữ liệu cũ giữ nguyên.

### Xác nhận tiêu thụ bất thường (chỉ Quản lý)

Máy dừng một kỳ rồi kỳ sau chạy lại thì tiêu thụ lệch rất nhiều so với bình quân — app đánh dấu **Bất thường**, và trước đây dấu đó **không bao giờ xoá được**, nên kỳ nào cũng thấy cả chục dòng cam.

Nay Quản lý và Quản trị xác nhận được:

- **Từng bản ghi:** mở sổ công tơ của kỳ đó → nút **Xác nhận bất thường**, ghi chú tuỳ ý (vd *"chuyền VKY10 dừng cả kỳ trước"*).
- **Cả loạt:** Điện/Nước → lọc **Bất thường** → nút **Xác nhận hết {n} bản ghi**, xem lại danh sách rồi xác nhận một lần.
- Xác nhận xong, dòng đó đổi nhãn thành **Đã xác nhận · 已确认** và **thôi tính vào ô cảnh báo ở Trang chủ**. Số liệu giữ nguyên, không sửa gì.
- **Bỏ xác nhận** được, cảnh báo hiện lại như cũ.
- **Kỹ thuật không xác nhận được** — chỉ thấy dòng chữ *"Chỉ Quản lý mới xác nhận được bản ghi bất thường"*. Máy chủ cũng chặn (quyền `khoaky`), không chỉ ẩn nút trên app.
- Mỗi lần xác nhận hay bỏ xác nhận đều vào **Nhật ký** (`XAC_NHAN_BT` / `BO_XAC_NHAN_BT`), ghi rõ ai và lúc nào.

Lý do người ghi nhập lúc lưu số vẫn giữ nguyên, nằm cạnh tên người xác nhận.

### Mã bản ghi không còn trùng nhau

Mã bản ghi vốn là **thời điểm đến giây + 3 chữ số ngẫu nhiên**, nên hai bản ghi tạo trong cùng một giây có thể trùng mã. Hậu quả tuỳ chỗ:

- **Ghi sửa chữa** bị từ chối với lỗi *"Trùng mã việc · 工作编号重复"* — báo lỗi ra mặt, ghi lại là được;
- **Ghi việc, lịch sử bảo dưỡng, chỉ số điện nước, tăng ca, tài liệu** thì trùng âm thầm: mở một bản ghi lại ra bản ghi khác, xoá thì xoá nhầm.

Nặng nhất là **việc lặp lại**: mã chỉ có **2 chữ số ngẫu nhiên — 90 khả năng**, nên hai việc lặp lại tạo trong cùng một giây trùng mã với xác suất khoảng **1/90**. Khi trùng, app coi hai mẫu là một, và **việc của mẫu sau không bao giờ được sinh ra**.

Nay mã **đánh số tăng dần** trong cùng một giây (`CV26102012340001`, `…0002`…) nên không thể trùng. Áp dụng cho `CongViec`, `LichSu`, `ChiSo`, `TangCa`, `ViecLap` và `TaiLieu`. Dữ liệu cũ giữ nguyên mã, không cần chuyển đổi. Nhật ký (`NhatKy`) giữ cách cũ vì mã nhật ký không dùng để tra cứu.

## Điểm mới của v2.11.1: chọn thiết bị cho mọi loại việc, mã bản ghi không trùng

Bản này đã nằm trong v2.11.2 ở trên — dán `Code.gs-v2.26.0.txt` là có cả hai.

### Mọi loại việc đều chọn được chuyền sản xuất hoặc máy của chuyền

Trước đây chỉ **Sửa chữa** mới hiện chuyền sản xuất; các loại việc khác (Vệ sinh, Lắp đặt, Cải tiến, Hỗ trợ sản xuất, Bảo dưỡng, Khác) và **Việc lặp lại** chỉ hiện danh sách máy, không có chuyền. Nay **Ghi việc, Ghi sửa chữa và Việc lặp lại dùng chung một danh sách**, ba nhóm theo thứ tự:

1. **Chuyền sản xuất (máy chính)** — VKY01…VKY23;
2. **Máy ngoài chuyền** — máy nén khí, tủ điện, bơm, điều hoà… gom theo nhóm máy;
3. **Máy của chuyền …** — máy in phun, máy hút bụi… gom theo từng chuyền.

Chuyền vẫn nằm trên cùng nên thói quen ghi sửa chữa theo chuyền không đổi; khác là từ nay **máy nhánh của chuyền cũng chọn riêng được** khi cần ghi đúng vào một máy (vd thay chổi than motor máy hút bụi VKY03). Mở Ghi sửa chữa từ hồ sơ một máy thuộc chuyền thì app vẫn điền sẵn chuyền, đổi lại được.

Ghi theo chuyền thì lịch sử sự cố gom về chuyền; ghi theo máy thì gom về đúng máy đó. Trang chuyền vẫn gom cả hai trong **Lịch sử sự cố của chuyền**. Máy chủ không đổi — vốn đã nhận cả mã máy lẫn mã chuyền cho mọi loại việc.

## Điểm mới của v2.11.0: đăng ký tăng ca và tài liệu nhà máy trên Drive

Bản này có hai phần mới: **Tăng ca** (đăng ký, in đơn, tổng hợp tháng) và **Tài liệu** (nối thư mục Drive sẵn có của nhà máy, quét vào danh mục, sắp xếp, tra cứu).

### Tăng ca

Mục **Tăng ca** riêng, ai cũng dùng được. Ở điện thoại vào từ ô **Tăng ca** trên Trang chủ hoặc từ trang **Cá nhân**; trên máy tính có ở thanh bên.

- **Đăng ký theo tuần** (thứ Hai → Chủ nhật), vì mỗi tuần in một đơn cho nhân viên ký.
  - Mỗi lần tăng ca ghi: ngày · ca làm việc · từ giờ · đến giờ · lý do.
  - **Số tiếng TC tự tính** = đến giờ trừ từ giờ, không trừ giờ nghỉ. Qua 0 giờ vẫn đúng (22:00 → 02:00 là 4 tiếng). Sửa tay được.
  - Bốn ca: **hành chính · ca ngày · ca đêm · chủ nhật** (行政班、日班、夜班、周日班). Bấm chọn ca là hai ô giờ tự điền.
  - Mất mạng vẫn ghi được, có mạng tự gửi như các mục khác.
- **Đơn in đúng mẫu giấy của công ty** (ĐƠN XIN TĂNG CA · 自愿加班申请单): tiêu đề công ty, ô Bộ phận và 部门, hàng Họ tên · Mã số thẻ · Chức vụ, bảng 5 cột 6 dòng, dòng TỔNG CỘNG, dòng ghi chú, bốn chỗ ký (Người xin · Người xác nhận · Quản lý bộ phận · Hành chính nhân sự).
  - Cột **Chú thích** in "tên ca — lý do", ví dụ "Hành chính — Sửa máy in phun VKY01".
  - Hơn 6 lần trong một tuần thì tự sang tờ thứ hai, mỗi tờ đủ chỗ ký, tờ cuối ghi tổng cả tuần.
  - **Xuất PDF:** bấm **In / Lưu PDF**. Trên iPhone, Safari hiện trang in → **Chia sẻ → Lưu vào Tệp**. Trên máy tính, chọn máy in **Save as PDF**.
- **Tổng hợp theo tháng:** mỗi người một dòng, tách theo bốn ca, có cột tổng. Vượt 40 giờ/tháng thì số chuyển màu cam. Xuất **Excel** hai trang: tổng hợp và chi tiết từng lần.
  - Không cần xoá gì sau mỗi tuần: app tự gom các tuần trong tháng.
- **Phân quyền:**
  - nhân viên chỉ thấy và in tăng ca **của mình**;
  - Quản lý, Quản trị thấy cả nhà máy, chọn người để xem, ghi hộ và in hộ được;
  - máy chủ cũng lọc, không chỉ ẩn trên app.
- **Thông tin in trên đơn** (mã số thẻ 工号, bộ phận, bộ phận tiếng Trung 部门, chức vụ) lưu trong hồ sơ người dùng. Mỗi người tự điền một lần ở mục Tăng ca, hoặc Quản trị nhập trong **Cá nhân → Quản trị → Người dùng**. App tự dịch tên bộ phận sang tiếng Trung.
- **Giờ các ca và giới hạn 40 giờ/tháng, 200 giờ/năm:** Quản lý sửa trong **Tăng ca → Sửa ca làm việc**.

### Tài liệu nhà máy: nối thư mục Drive có sẵn

Tài liệu đã để trên Google Drive thì **không cần tải lại**. App chỉ ghi mã tệp vào danh mục: Drive giữ tệp, app giữ cách sắp xếp và tra cứu. App **không chép, không sửa và không xoá** tệp gốc.

- **Chỉ Quản lý và Quản trị** mở được mục Tài liệu. Kỹ thuật không thấy thẻ **Tài liệu** trong hồ sơ máy, không mở được tệp; máy chủ cũng chặn chứ không chỉ ẩn trên app. Riêng **ảnh đại diện** của máy thì ai cũng xem được, vì nó chỉ để nhận ra máy.
- **Nối thư mục** (Cá nhân → Quản trị → **Tài liệu**):
  1. Mở thư mục tài liệu trên Drive → **Chia sẻ** → thêm địa chỉ Gmail của tài khoản đang chạy app (màn hình Tài liệu ghi sẵn địa chỉ này). **Người xem** là đủ để đọc; để **Người chỉnh sửa** nếu muốn tải tệp mới lên từ app.
  2. Sao chép link thư mục (có `/folders/…`) rồi dán vào ô **Link thư mục Drive** → **Nối thư mục**.
  - Thư mục nằm trên Drive của tài khoản khác cũng được. Nếu chưa chia sẻ, app báo rõ "App chưa đọc được thư mục này" kèm địa chỉ cần chia sẻ, bấm **Kiểm tra lại** sau khi chia sẻ xong.
- **Thư mục này là nhóm nào:** tài liệu xếp theo loại thì gán một lần cho từng thư mục cấp 1 (`Bản vẽ` → Bản vẽ, `Huong dan su dung` → Hướng dẫn sử dụng…). Mọi tệp trong đó, kể cả thư mục con và tệp thêm sau này, tự vào đúng nhóm. Sáu nhóm: Hướng dẫn sử dụng · Bản vẽ · Quy trình (SOP) · Kiểm định · Ảnh · Khác.
- **Quét Drive:** app đi hết cây thư mục (sâu tối đa 8 cấp) và ghi từng tệp vào danh mục, mỗi lần nhận tối đa 300 tệp mới — còn nữa thì bấm quét thêm lần nữa.
  - **Đoán máy theo tên tệp và tên thư mục:** nhận cả mã hệ thống (`M005`, `VKY01`) và **mã hiển thị tự đặt** (`H2506`, `QTN-16`).
  - **Đoán nhóm** theo từ khoá tiếng Việt, tiếng Trung và tiếng Anh khi thư mục chưa gán nhóm (`说明书`, `manual`, `ban ve`, `图纸`, `SOP`, `kiem dinh`, `校准`…).
  - **Quét lại** bất cứ lúc nào: tệp mới được thêm, tệp đã đổi chỗ thì cập nhật đường dẫn, tệp đã xoá hoặc chuyển đi bị đánh dấu **Không còn trên Drive** (dòng vẫn giữ, không mất phần đã gán).
- **Sắp xếp** (Tài liệu → **Sắp xếp tài liệu**): lọc theo *Chưa gán máy · Chưa gán nhóm · Không còn trên Drive · Tất cả*, tìm theo tên tệp hoặc thư mục, chọn nhiều dòng rồi **gán một máy / chuyền** hoặc **một nhóm** cho cả nhóm đã chọn. Đây là chỗ xử lý một lượt đống tài liệu cũ.
- **Tra cứu tài liệu** (Tài liệu → **Tra cứu tài liệu**): tìm toàn nhà máy theo tên tệp, thư mục, mã máy, mã hiển thị hay tên máy; lọc theo nhóm; kết quả gom theo từng máy, tài liệu chưa gán máy xếp cuối.
- **Mở tệp:** tệp xem được và dưới 8 MB thì mở ngay trong app qua máy chủ, không cần tài khoản Google. Tệp lớn hơn hoặc loại app không xem được (bản vẽ CAD, tệp nén) thì mở bằng **link Drive** — cần tài khoản Google có quyền vào thư mục, nên vẫn chỉ người quản lý mở được.
- **Bản hiện hành:** một máy có nhiều tệp cùng nhóm thì đánh dấu **Đặt làm bản hiện hành**; các bản còn lại hiện nhãn **Bản cũ**, không bị xoá.
- **Bỏ khỏi danh mục:** tài liệu quét từ Drive chỉ bị gỡ khỏi danh mục của app, tệp gốc trên Drive không bị xoá và những lần quét sau cũng không thêm lại. Muốn nhận lại thì xoá dấu ở cột `Xoa` của dòng đó trên trang `TaiLieu`. Tệp do app tải lên thì vẫn vào thùng rác Drive như trước.
- Trang `TaiLieu` có thêm 5 cột: `DuongDan` (đường dẫn thư mục trên Drive), `Nguon` (`APP` tải từ app · `DRIVE` tài liệu có sẵn), `ConTrenDrive`, `HienHanh`, `LucQuet`.

- Nâng cấp: dán `Code.gs-v2.26.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Máy chủ tự tạo trang `TangCa`, thêm 4 cột mới vào trang `NguoiDung` và 5 cột mới vào trang `TaiLieu`.

## Điểm mới của v2.10.0: phân quyền xem theo vai trò

- **Quản lý, Quản trị:** xem được tất cả, như trước.
- **Kỹ thuật** (các tài khoản còn lại) chỉ xem được ba mục:
  - **Điện / Nước:** ghi số, xem kỳ, công tơ;
  - **Sửa chữa:** việc sửa chữa, Ghi sửa chữa, Lịch sử sửa chữa, sổ tay xử lý;
  - **Bảo dưỡng:** lịch bảo dưỡng, xác nhận bảo dưỡng, lịch sử bảo dưỡng.
- **Thanh dưới của kỹ thuật:** Trang chủ · Bảo dưỡng · [Quét QR] · Sửa chữa · Điện/Nước. Trên máy tính, thanh bên cũng chỉ còn các mục đó.
- **Trang chủ của kỹ thuật:** Tổng quan còn các ô Sửa chữa, Bảo dưỡng, Điện, Nước. Không còn ô Thiết bị, Công việc, Linh kiện. Cảnh báo "Máy quá hạn / đến hạn" mở thẳng nhóm máy đó ở Bảo dưỡng.
- **Kỹ thuật không xem được:**
  - danh sách Thiết bị;
  - kho Linh kiện, tab Linh kiện trong hồ sơ máy, phần linh kiện / ERP của chuyền;
  - Giao việc, Việc lặp lại, Báo cáo tháng, In tem QR;
  - tài liệu máy và chuyền (từ v2.11.0), trừ ảnh đại diện của máy;
  - việc của người khác không thuộc Sửa chữa / Bảo dưỡng.

  Mở các màn đó (ví dụ bằng link cũ) thì app báo "Chỉ Quản lý".
- **Kỹ thuật vẫn làm được:**
  - mở hồ sơ máy, hồ sơ chuyền từ Bảo dưỡng, Sửa chữa hoặc quét QR;
  - xem mọi việc Sửa chữa / Bảo dưỡng và việc của mình;
  - ghi việc, báo hỏng;
  - chọn linh kiện của máy khi xác nhận bảo dưỡng hoặc báo xong việc. Không thấy số tồn kho.
- **Máy chủ cũng chặn**, không chỉ ẩn trên app:
  - tài khoản kỹ thuật không nhận dữ liệu kho, việc lặp lại, việc ngoài phạm vi;
  - gọi tải kho thì báo "Không có quyền".
- **Nâng cấp:** dán bản `Code.gs` mới nhất → Lưu → Quản lý triển khai → Phiên bản mới. Khi máy chủ còn bản cũ, app vẫn ẩn các mục trên nhưng máy chủ chưa chặn dữ liệu.

## Điểm mới của v2.9.1: sửa chữa chọn theo chuyền sản xuất

- Ô **Thiết bị** ở **Ghi sửa chữa** và ở việc loại **Sửa chữa** chỉ còn:
  - **chuyền sản xuất** (máy chính), ví dụ VKY01 hoặc mã hiển thị H2506;
  - **máy ngoài chuyền**: máy nén khí, máy đóng bao, điều hoà, bơm, tủ điện…
- Máy thuộc chuyền (máy in phun, máy hút bụi…) không chọn riêng. Mở Ghi sửa chữa từ hồ sơ của máy đó thì app tự chọn chuyền của nó.
- Việc bảo dưỡng vẫn chọn từng máy như cũ.
- **Hiển thị:**
  - sửa chữa ghi theo chuyền hiện ở **Lịch sử sự cố của chuyền**, Lịch sử sửa chữa, file Excel 疑难故障 (cột mã thiết bị là mã chuyền + tên chuyền), gợi ý cách xử lý và sổ tay xử lý;
  - trang chuyền có nút **Ghi sửa chữa chuyền …**;
  - hồ sơ máy thuộc chuyền có lối sang lịch sử sửa chữa của chuyền.
- Nâng cấp: dán `Code.gs-v2.9.1.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Máy chủ cũ (2.9.0) chưa nhận mã chuyền, nên app giữ danh sách máy như trước cho tới khi cập nhật.

## Điểm mới của v2.9.0: sao lưu tự động, tài liệu máy, tiền điện, gợi ý cách xử lý

- **Sao lưu dữ liệu** (Quản trị → Cá nhân → Quản trị → Sao lưu dữ liệu):
  - Mỗi đêm lúc 2 giờ sáng, app chép toàn bộ Google Sheet sang một file mới trong thư mục Drive `CMMS_SaoLuu` và giữ 30 bản gần nhất. File sao lưu chỉ chứa dữ liệu, không chép mã Apps Script.
  - Có nút **Sao lưu ngay**.
  - **Khôi phục**: đưa mọi bảng dữ liệu về như trong bản đã chọn. Trước khi khôi phục, app tự sao lưu bản hiện tại để quay lại được.
  - **Lưu trữ dữ liệu cũ**: chuyển lịch sử bảo dưỡng, việc đã đóng/huỷ và nhật ký của từng năm (từ 2 năm trước trở về trước) sang file `Lưu trữ CMMS năm …`. Chỉ số điện giữ lại vì cần để tính tiêu thụ.
  - Nếu màn hình báo "Chưa đặt được lịch chạy hằng đêm": mở Apps Script, chọn hàm `datLichSaoLuu`, bấm **Chạy** một lần và cấp quyền.
- **Tài liệu và ảnh của máy / chuyền**: thẻ **Tài liệu** trong hồ sơ máy, mục Tài liệu ở trang chuyền.
  - Tải tệp lên (PDF, ảnh, Word, Excel, PowerPoint, văn bản; tối đa 10 MB), chụp ảnh, hoặc dán liên kết (tệp lớn để trên Google Drive).
  - Nhóm: Hướng dẫn sử dụng, Bản vẽ, Quy trình (SOP), Ảnh, Khác. Một ảnh đặt làm **ảnh đại diện**, hiện ở đầu hồ sơ máy.
  - Tệp lưu trong thư mục Drive `CMMS_TaiLieu` (riêng tư), app lấy qua máy chủ khi mở. Kỹ thuật xoá được tài liệu mình tải, Quản lý xoá được mọi tài liệu.
- **Tiền điện** (Điện/Nước → Tiền điện, chỉ Quản lý):
  - Tính từ công tơ tổng cao áp ghi 3 khung giờ: 1.8.1 bình thường, 1.8.2 cao điểm, 1.8.3 thấp điểm. Mỗi kỳ và mỗi tháng có tiền điện năng, cosφ, tiền công suất phản kháng (khi cosφ dưới 0,9: tiền điện năng × (0,9 / cosφ − 1)), VAT, tổng cộng, giá bình quân, % điện giờ cao điểm.
  - Ước tính số tiền bớt được nếu dời 10% điện giờ cao điểm sang giờ thấp điểm.
  - Nhập sản lượng tháng để có điện tiêu thụ trên 1.000 sản phẩm.
  - Giá mặc định: giá EVN cho sản xuất, cấp 22 kV – dưới 110 kV (QĐ 1279/QĐ-BCT, từ 10/05/2025): bình thường 1.833, cao điểm 3.398, thấp điểm 1.190 đ/kWh, VAT 8%. Đối chiếu với hoá đơn rồi sửa ở **Sửa giá**. Khi EVN đổi giá, thêm dòng giá mới và giữ giá cũ.
  - File Excel số điện năm có thêm trang `Tien dien`.
- **Gợi ý cách xử lý từ lịch sử sửa chữa**: khi gõ mô tả sự cố (Ghi sửa chữa, hoặc báo xong việc sửa chữa được giao), app hiện tối đa 3 lần sửa giống nhất trước đây, ưu tiên cùng máy rồi cùng loại máy. Bấm để chép nguyên nhân và cách xử lý vào ô.
  - **Sổ tay xử lý** theo loại máy: mọi lần sửa của các máy cùng nhóm, tìm được theo lỗi, xuất Excel.
- Nâng cấp: dán `Code.gs-v2.9.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Máy chủ tự thêm trang `TaiLieu` và đặt lịch sao lưu hằng đêm.

## Điểm mới của v2.8.0: trang chủ iPhone gọn hơn, Lịch sử sửa chữa

- **Trang chủ iPhone:**
  - **Tổng quan** nằm ngay dưới lời chào.
  - **Việc của tôi** gọn thành một ô có số việc, bấm vào mới mở danh sách.
  - Bỏ nút "Quét QR" ở đầu trang, vì nút quét đã có ở giữa thanh dưới.
- **Ghi sửa chữa chỉ lưu làm lịch sử:** bản ghi sửa chữa không còn hiện trong danh sách, bảng và thống kê Công việc.
  - Xem ở **Công việc → Lịch sử sửa chữa**: lọc theo tháng hoặc tất cả, tìm theo máy, mã, nội dung, người sửa.
  - Thẻ **Sự cố** trong hồ sơ máy vẫn có các bản ghi này.
- **Xoá bản ghi sửa chữa:** mở bản ghi → **Xoá bản ghi sửa chữa**. Quản lý xoá được mọi bản ghi, nhân viên chỉ xoá bản mình ghi. Dòng trên sheet được đánh dấu `HUY` và ghi vào nhật ký, không mất hẳn.
- **Xuất Excel gộp mọi máy:** nút **Xuất Excel (gộp mọi máy)** ở trang Lịch sử sửa chữa xuất các bản ghi đang lọc vào một bảng duy nhất theo mẫu 疑难故障.
- Nâng cấp: dán `Code.gs-v2.8.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Máy chủ tự thêm cột `Nguon` vào trang `CongViec`; bản ghi cũ của v2.6–2.7 vẫn được nhận ra.

## Điểm mới của v2.7.0: mã hiển thị tự đặt, quét QR xem lịch sử sự cố

- **Mã hiển thị (tự đặt):** ở **Sửa máy** và **Sửa thông tin chuyền** có ô **Mã hiển thị**. Ví dụ chuyền VKY01 đặt là `H2506`, quạt tản nhiệt M005 đặt là `QTN-16`.
  - Mã này hiện ở mọi chỗ: bảng Công việc, danh sách thiết bị, tem QR, Excel và tìm kiếm.
  - Mã hệ thống (M001…, VKY01…) giữ nguyên bên trong, nên tem QR đã in vẫn quét được.
  - Mã không được trùng với máy hay chuyền khác. Để trống thì app dùng mã hệ thống.
- **Bảng Công việc:** cột Mã hiện mã máy, bên dưới là mã chuyền nếu máy thuộc chuyền.
- **Quét QR xem lịch sử sự cố:**
  - Quét tem máy thì màn xác nhận có thêm dòng **Lịch sử sự cố (n lần)**, bấm vào để xem.
  - Hồ sơ máy có thẻ **Sự cố**: số lần sửa, tổng giờ dừng máy, lần gần nhất, và từng lần sửa với mô tả, nguyên nhân, kết quả.
  - Chuyền cũng in được tem QR. Quét tem chuyền (hoặc gõ mã hiển thị) sẽ mở trang chuyền, có mục **Lịch sử sự cố của chuyền** gồm mọi máy trong chuyền.
- Nâng cấp: dán `Code.gs-v2.7.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Máy chủ tự thêm cột `MaHT` vào trang `May` và `Chuyen`.

## Điểm mới của v2.6.0: Ghi sửa chữa theo mẫu 疑难故障

- **Công việc → Ghi sửa chữa:** ghi lại việc sửa chữa đã làm xong, lưu là xong luôn, không cần ai xác nhận. Quản lý và nhân viên đều ghi được.
  - 3 ô theo bảng giấy: **Mô tả sự cố 问题描述**, **Phân tích nguyên nhân 分析原因**, **Kết quả xử lý 处理结果**. Mỗi dòng là một ý, app tự đánh số 1. 2. 3. Có nút chọn nhanh nguyên nhân thường gặp.
  - Kèm thiết bị, ngày sửa, người xử lý và người làm cùng, thời gian dừng máy, linh kiện thay.
  - Lưu xong máy chủ tự dịch sang tiếng Trung (gõ tiếng Trung thì dịch sang tiếng Việt).
- Việc sửa chữa được giao rồi báo xong cũng dùng đúng 3 ô này.
- **Báo cáo tháng → Xuất Excel**, trang `Sua chua` theo mẫu 可悦设备疑难故障处理过程及分析: mỗi ô tiếng Trung ở trên, tiếng Việt ở dưới; có cột Ngày (đủ năm), Người xử lý, Dừng máy (giờ). Tất cả việc sửa chữa trong tháng đều vào bảng.
- Danh sách chọn người (giao việc, người làm cùng) hiện cả tên tiếng Trung.
- Nâng cấp: dán `Code.gs-v2.6.0.txt` → Lưu → Quản lý triển khai → Phiên bản mới.

## Điểm mới của v2.5.0: chuyền sản xuất, Bảo dưỡng gọn hơn

- **Chuyền sản xuất:** 16 chuyền theo Sổ cái quản lý cơ sở vật chất (VKY-PR-E01-03): VKY01–VKY04, VKY06, VKY08–VKY10, VKY12, VKY13, VKY15, VKY16 (VKYC4), VKY17, VKY18, VKY21, VKY23.
  - Mỗi chuyền có trang riêng: các máy trong chuyền với hạn bảo dưỡng của từng máy, và thông tin theo sổ cái (mã số thiết bị, quy cách, nhà sản xuất, tốc độ, xưởng, ngày sản xuất, ngày cải tạo, ngày về Việt Nam).
  - Máy in phun 喷印机 VKYxx và máy hút bụi "Máy hút bụi VKYxx" được tự xếp vào chuyền cùng số (từ v2.5.1). Máy khác chọn chuyền ở **Sửa máy → Chuyền sản xuất**, hoặc bấm **Thêm máy vào chuyền** ở trang chuyền.
  - Quản lý sửa được thông tin chuyền (**Sửa thông tin**). Google Sheet có trang mới `Chuyen`, trang `May` thêm cột `Chuyen` ở cuối.
- **Bảo dưỡng · Tổng quan** (mặc định): máy quá hạn, đến hạn hôm nay, sắp đến hạn mỗi loại gom thành một dòng, bấm vào mới hiện danh sách. Dưới là các chuyền dạng ô (đỏ = có máy quá hạn) và thiết bị khác gom theo nhóm. Lịch năm / tháng vẫn còn ở hai nút bên cạnh.
- **Thiết bị:** khi không tìm, không lọc thì cũng hiện gọn như trên.
- **Thiết bị trên máy tính** cũng hiện gọn: các chuyền dạng ô, thiết bị khác mỗi nhóm một dòng, bấm mới hiện bảng.
- **Linh kiện của chuyền:** trang chuyền có mục "Linh kiện của chuyền" gom linh kiện của mọi máy trong chuyền, mỗi linh kiện được đối chiếu với tồn kho trong file ERP đã nhập:
  - **Lỗi (đỏ):** mã không có trong ERP, linh kiện chỉ có trong app (ERP không có), quy cách khác ERP, hết hàng.
  - **Cảnh báo (cam):** chưa liên kết mã ERP nhưng ERP có mã cùng quy cách, tồn ít hơn số lắp trên máy, dưới tồn tối thiểu.
  - Thêm / sửa linh kiện: chọn máy trong chuyền rồi tìm linh kiện trong kho ERP như ở hồ sơ máy.
  - **Mục riêng "Linh kiện theo chuyền"** (nút ở đầu phần Chuyền sản xuất): mỗi chuyền một dòng kèm số lỗi; **Xuất Excel** cho một chuyền hoặc tất cả chuyền (trang Tổng hợp, trang "Can xu ly" gom các linh kiện lỗi / cảnh báo, mỗi chuyền một trang).
- **Nhập linh kiện từ Excel** (Linh kiện theo chuyền → mục "Nhập linh kiện từ file Excel", Quản lý):
  - **Tải bảng mẫu:** file có trang "Linh kien" điền sẵn mọi máy đang theo dõi và linh kiện hiện có (Chuyền · Mã máy · Tên máy · Tên linh kiện · Quy cách · Mã ERP · Đơn vị · SL trên máy · Vị trí lắp · Mức độ · Ghi chú), trang "Danh sach may" và trang "Huong dan".
  - **Nhập từ Excel:** chọn file → xem trước: số dòng nhập được, số máy, dòng lỗi (không tìm thấy máy, số lượng sai — bị bỏ qua) và lỗi ERP từng dòng (mã không có trong ERP, quy cách khác, hết hàng…).
  - Chọn **Thêm vào** (giữ linh kiện cũ, trùng tên thì cập nhật) hoặc **Thay toàn bộ** (máy có trong file chỉ còn các dòng trong file) → **Nhập**.
  - Mã ERP nên để ô dạng Văn bản (Text) trong Excel để không mất số 0 ở đầu.
- **Xuất Excel việc đang giao** (nút trong Công việc, Quản lý): trang "Tat ca" liệt kê mọi việc chưa xong (chờ giao, đã giao, đang làm, tạm hoãn) theo hạn; mỗi người một trang riêng (phiếu giao việc) có cột ghi chú / kết quả và dòng ký nhận, để in ra đưa cho từng người. Việc quá hạn tô đỏ ở cột Hạn.
- Nâng cấp: dán `Code.gs-v2.5.1.txt` → Lưu → Quản lý triển khai → Phiên bản mới. Lần mở app đầu tiên máy chủ tự tạo trang `Chuyen` và xếp máy in phun.

## Điểm mới của v2.4.0: tự dịch Việt ↔ Trung trong Công việc

- **Gõ một thứ tiếng, app hiện cả hai.** Gõ tiếng Việt thì máy chủ dịch sang tiếng Trung lúc lưu; gõ tiếng Trung thì dịch sang tiếng Việt. Màn hình luôn hiện tiếng Việt chữ lớn ở trên, tiếng Trung chữ nhỏ ở dưới.
- **Những gì được dịch:**
  - tên việc và mô tả, cả mẫu việc lặp lại (mẫu chỉ dịch một lần, các việc sinh ra mỗi ngày dùng lại bản dịch);
  - kết quả và nguyên nhân hỏng khi ghi xong việc;
  - lý do tạm hoãn, trả lại, huỷ việc;
  - kết quả tự ghi khi xác nhận bảo dưỡng ("Đã xác nhận bảo dưỡng ngày…" · "已确认保养…").

  Không dịch:
  - chữ chỉ có mã và số (ví dụ "M001 - 2026");
  - chữ đã viết sẵn hai thứ tiếng dạng `Việt · 中文`: app tách làm hai;
  - chữ lẫn cả tiếng Việt và tiếng Trung (ví dụ "Bảo dưỡng 喷印机 VKY01"), vì có thể đã là song ngữ. Riêng nút **Giao bảo dưỡng cho người làm** ở hồ sơ máy có tên tiếng Trung, app điền sẵn bản tiếng Trung ("保养 喷印机 VKY01").
- **Sửa bản dịch:** khi sửa một việc, dưới ô Tên việc (và Mô tả) có ô **Bản dịch**. Quản lý sửa được; người ghi việc sửa được khi việc còn chờ giao.
  - Sửa tay thì app giữ nguyên, không dịch đè.
  - Xoá trống ô Bản dịch rồi lưu thì app dịch lại.
  - Đổi tên việc mà không sửa bản dịch thì app dịch lại theo tên mới.
  - Bản dịch của kết quả, nguyên nhân hỏng và lý do chưa sửa tay được.
- **Tìm việc** theo cả tiếng Việt và tiếng Trung.
- **Telegram và Excel song ngữ:**
  - Tin giao việc và tin nhắc việc quá hạn ghi tên việc dạng `Việt · 中文`.
  - Trong file Excel báo cáo tháng, ô tên việc, nguyên nhân và cách xử lý có hai dòng: tiếng Việt, dưới là tiếng Trung.
- **Mất mạng:** việc ghi lúc mất mạng được dịch khi gửi lên máy chủ (lúc có mạng lại).
- **Google lỗi hoặc hết hạn mức dịch trong ngày:** việc vẫn lưu bình thường, tạm thời chỉ có một thứ tiếng.
  - Máy chủ ghi nhớ và tự dịch bù sau ít nhất 1 giờ: mỗi lần app tải dữ liệu dịch thêm vài câu, lúc gửi nhắc hằng ngày dịch nhiều hơn.
  - Chỉ dịch bù các việc trong 60 ngày gần nhất.
- **Chất lượng bản dịch:** dùng Google Dịch có sẵn trong Apps Script (`LanguageApp`), miễn phí, không cần khoá API. Câu kỹ thuật ngắn thường dịch ổn. Tên riêng, cách gọi riêng trong xưởng và chữ viết tắt có thể bị dịch sai, nên mới có ô sửa tay.
- **Hai hàm chạy tay trong Apps Script:**
  - `thuDich`: thử dịch hai câu, để kiểm tra Google Dịch chạy được và cấp quyền nếu Google hỏi.
  - `dichLaiTatCa`: dịch ngay mọi việc còn thiếu bản dịch, ví dụ sau nhiều ngày Google báo hết hạn mức.
- **Google Sheet:**
  - Trang `CongViec` thêm 4 cột ở cuối: `TieuDeDich`, `MoTaDich`, `KetQuaDich`, `NguyenNhanDich`.
  - Trang `ViecLap` thêm 2 cột ở cuối: `TieuDeDich`, `MoTaDich`.
  - Bản dịch của lý do tạm hoãn, trả lại, huỷ nằm trong cột `NhatKy` có sẵn (trường `gcDich`).
  - Máy chủ tự thêm cột ở lần tải dữ liệu đầu tiên sau khi nâng cấp.

## Điểm mới của v2.3.0 (sửa theo lần duyệt giao diện thứ nhất)

- **Bỏ phiếu báo hỏng.** Sửa chữa là một loại việc trong Công việc:
  - Quản lý giao việc sửa chữa cho nhân viên.
  - Nhân viên gặp máy hỏng thì tự ghi việc và đánh dấu "Tôi tự làm việc này" (việc giao luôn cho chính họ).
  - Khi xong, nhân viên ghi kết quả, **nguyên nhân hỏng** và **thời gian dừng máy**; Quản lý xác nhận "Đạt, đóng việc".
- **Thanh tab dưới (iPhone):** Trang chủ · Thiết bị · [Quét QR] · **Công việc** · Điện/Nước.
- **Trang chủ:** nút "Ghi việc, giao việc" thay cho nút "Báo hỏng".
- **Ghi xong việc:** bỏ dòng nhắc chờ Quản lý kiểm tra.
- **Hồ sơ máy:** hai nút "Ghi việc cho máy này" và "Xác nhận bảo dưỡng". Tab Bảo dưỡng có nút xác nhận (Quản lý cũng dùng được) và nút giao bảo dưỡng. Tab Lịch sử gộp bảo dưỡng với các việc của máy.
- **Báo cáo tháng (mới):** nút "Báo cáo tháng" trong Công việc (Quản lý).
  - Tỉ lệ hoàn thành của từng người: được giao, đã xong, %, % xong đúng hạn, quá hạn chưa xong.
  - Danh sách sửa chữa trong tháng, tổng giờ dừng máy.
  - **Xuất Excel**, gồm 3 trang: Sửa chữa · Tỉ lệ hoàn thành · Tất cả việc.
- **Bảng theo người (máy tính):** đầu mỗi cột có thanh tỉ lệ hoàn thành trong tháng.
- **Bảng công việc (máy tính):** màu nhẹ hơn. Trạng thái chỉ còn chấm màu và chữ trên một dòng; dòng quá hạn chỉ có vạch đỏ ở đầu dòng.
- **Google Sheet:** trang `CongViec` có thêm 2 cột ở cuối, `NguyenNhan` và `PhutDung`.

## Điểm mới của v2.2.0: Công việc (ghi việc, giao việc)

- **Ghi việc nhanh:** chỉ bắt buộc tên việc. Chọn thêm loại việc (Sửa nhỏ · Vệ sinh · Lắp đặt / di dời · Cải tiến · Hỗ trợ sản xuất · Bảo dưỡng · Khác), mức ưu tiên (Gấp · Cao · Bình thường), hạn (Hôm nay · Ngày mai · Cuối tuần · chọn ngày), thiết bị, mô tả, ảnh. Nút **"Lưu và ghi tiếp"** để ghi liền nhiều việc.
- **Chỉ giao cho người có tài khoản trong app**, để người đó thấy việc và tự bấm Xong. Mỗi việc 1 người chính, thêm tối đa 5 người làm cùng.
- **Ai ghi việc:** Quản lý / Quản trị ghi và giao luôn được. Kỹ thuật ghi việc thì việc vào mục **Chờ giao** để Quản lý giao.
- **Màn Giao việc:** tích chọn nhiều việc đang chờ, chọn người. Mỗi người hiện **số việc đang làm và số việc quá hạn** để chia đều. Đổi hạn được cho cả nhóm việc.
- **Trên máy tính:** bảng **Theo người**, mỗi người một cột; kéo thẻ việc sang cột người khác để giao hoặc giao lại.
- **Nhân viên:** trang chủ có mục **Việc của tôi** (gồm cả phiếu sửa chữa được giao), xếp việc gấp / sắp hết hạn lên trước. Làm xong bấm **Xong việc** (ghi kết quả, linh kiện / vật tư đã dùng, ảnh) — không phải bấm Bắt đầu, vì ngày giao việc là ngày bắt đầu. Bị vướng thì **Tạm hoãn** kèm lý do.
- **Kiểm tra khi xong:** mỗi việc có ô "Cần Quản lý kiểm tra khi xong". Mặc định bật cho Sửa nhỏ, Lắp đặt, Cải tiến, Khác và mọi việc Gấp; tắt cho Vệ sinh, Hỗ trợ sản xuất, Bảo dưỡng. Quản lý kiểm tra: **Đạt, đóng việc** hoặc **Chưa đạt, trả lại**.
- **Việc lặp lại:** hằng ngày / hằng tuần (chọn thứ) / hằng tháng (chọn ngày). Mỗi ngày app tự tạo việc (khi có người mở app hoặc lúc gửi nhắc hằng ngày); có người làm sẵn thì giao luôn, không thì vào Chờ giao. Không tạo trùng; bật lại sau khi tắt thì không tạo bù những ngày đã tắt.
- **Nối với Sửa chữa và Bảo dưỡng:**
  - Quản lý **giao phiếu báo hỏng** cho một người; phiếu hiện trong "Việc của tôi" của người đó.
  - Trong hồ sơ máy, tab Bảo dưỡng có nút **Giao bảo dưỡng cho người làm**. Việc bảo dưỡng có nút **Xác nhận bảo dưỡng**; xác nhận xong thì việc tự đóng.
  - Hồ sơ máy hiện các việc đang mở của máy, có nút "Ghi việc cho máy này".
- **Trang chủ:** ô **Công việc**; cảnh báo cho Quản lý: *Việc quá hạn*, *Việc chưa giao người làm*, *Việc xong chờ kiểm tra*; cho nhân viên: *Việc của tôi quá hạn*.
- **Telegram:** báo khi giao việc (ghi tên người được giao). Tin nhắc hằng ngày có việc quá hạn và số việc chưa giao.
- **Mất mạng vẫn dùng được:** ghi việc, giao việc và các bước đều vào hàng chờ, gửi đúng thứ tự khi có mạng.
- **Trên Google Sheet:** trang `CongViec` (mỗi dòng một việc) và `ViecLap` (mẫu việc lặp lại).
- **Sửa lỗi:** trang Google Sheet mới chỉ có 26 cột; máy chủ nay tự thêm cột khi bảng cần nhiều hơn.

## Điểm mới của v2.1.0: Sửa chữa và Bảo dưỡng thành mục riêng

> Phần phiếu báo hỏng dưới đây đã bỏ ở v2.3.0; sửa chữa nay là một loại việc trong Công việc.

### Sửa chữa (báo hỏng)
- **Quy trình một phiếu:** Báo hỏng → Nhận sửa → (Chờ linh kiện) → Sửa xong → Quản lý nghiệm thu.
  - Quản lý / Quản trị tự ghi "Sửa xong" thì phiếu đóng luôn.
  - Quản lý có thể **trả lại** (ghi lý do còn lỗi gì) hoặc **huỷ phiếu** (ghi lý do). Người báo tự huỷ được khi chưa ai nhận sửa.
- **Báo hỏng:** từ nút đỏ trên trang chủ, trong hồ sơ thiết bị, hoặc ngay trong bảng xác nhận bảo dưỡng sau khi quét QR.
  - Chọn máy, chọn **mức ảnh hưởng**: Dừng máy / Chạy hạn chế / Không ảnh hưởng.
  - Ghi hiện tượng (có nút chọn nhanh: không chạy, kêu to, rò rỉ, quá nóng…), lúc phát hiện hỏng, ảnh hiện trường.
  - Nếu máy đang có phiếu chưa xong, app hiện phiếu đó để tránh báo trùng.
- **Sửa xong:** người sửa, nguyên nhân (chọn nhanh), cách xử lý, **linh kiện đã thay** (chọn từ linh kiện của máy hoặc tìm trong kho ERP), ảnh sau sửa, lúc sửa xong, lúc máy chạy lại.
  - **Thời gian dừng máy** = lúc chạy lại − lúc hỏng, chỉ tính khi mức là "Dừng máy". Phiếu đang mở thì đếm đến hiện tại.
  - Linh kiện mới dùng khi sửa được thêm vào danh sách linh kiện của máy (giống khi bảo dưỡng).
- **Mất mạng vẫn dùng được:** báo hỏng và các bước sau đều vào hàng chờ, gửi lại không tạo trùng, gửi đúng thứ tự khi có mạng.
- **Màn Sửa chữa:** ô tóm tắt (máy đang dừng, phiếu đang mở, chờ nghiệm thu, giờ dừng máy trong tháng), lọc Đang mở / Chờ nghiệm thu / Đã xong / Đã huỷ, tìm kiếm. Trên máy tính là bảng có tiêu đề và phân trang.
- **Trang chủ:** ô "Sửa chữa" và các cảnh báo *Máy đang dừng do hỏng*, *Báo hỏng chưa có người nhận sửa*, *Sửa xong chờ nghiệm thu* (Quản lý).
- **Hồ sơ thiết bị:** nhãn "Đang hỏng, dừng máy" / "Đang sửa chữa", hai nút **Báo hỏng** và **Xác nhận bảo dưỡng**, tab **Sửa chữa** (số lần hỏng 12 tháng, tổng giờ dừng), tab **Lịch sử** gộp bảo dưỡng và sửa chữa.
- **Quét QR** máy đang có phiếu sửa chữa thì mở hồ sơ máy (thấy ngay phiếu), không tự bật bảng xác nhận bảo dưỡng.
- **Telegram:** báo ngay khi có báo hỏng và khi sửa xong (bật/tắt ở **Quản trị → Báo tin**). Tin nhắc hằng ngày có thêm danh sách phiếu chưa xong.
- **Trên Google Sheet:** trang mới `SuaChua`, mỗi dòng một phiếu: số phiếu, máy, trạng thái, mức ảnh hưởng, hiện tượng, các mốc thời gian, người báo / sửa / nghiệm thu, nguyên nhân, cách xử lý, linh kiện, số phút dừng máy, quá trình xử lý.

### Bảo dưỡng dễ thấy hơn
- **Thanh tab dưới (iPhone):** Trang chủ · Thiết bị · **[Quét QR]** · **Sửa chữa** · Điện/Nước. Mục **Cá nhân** chuyển lên nút tròn có chữ cái đầu tên ở góc trên bên phải.
- **Thanh bên (máy tính):** Trang chủ · Thiết bị · **Sửa chữa** · **Bảo dưỡng** · Lịch sử bảo dưỡng · Điện/Nước · Kho linh kiện · Quét QR · Cá nhân.
- **Trang Bảo dưỡng** (trước gọi là "Lịch"): thêm ô tóm tắt Quá hạn / Hôm nay / Sắp đến / Đã làm trong tháng, bấm vào mở danh sách máy đã lọc; bên dưới vẫn là lịch năm/tháng và xuất Excel.

## Điểm mới của v2.0.0

### Giao diện (theo bản thiết kế)
- **Màu và bố cục:** màu xanh dương, ô tổng quan nhiều màu. Màu đỏ chỉ dùng cho cảnh báo.
- **Thanh tab dưới:** Trang chủ · Thiết bị · **[Quét QR]** · Điện/Nước · Cá nhân (bản 2.1.0 đổi Cá nhân thành Sửa chữa, xem ở trên).
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
| Sửa chữa: người sửa, nguyên nhân, thời gian dừng máy, Quản lý xác nhận, báo cáo Excel tháng | ✅ (v2.3.0) |
| Ghi việc, giao việc cho nhân viên, việc lặp lại | ✅ (v2.2.0) |
| Nội dung công việc tự dịch Việt ↔ Trung, sửa tay được bản dịch | ✅ (v2.4.0) |

**Chưa làm (giai đoạn sau, cần vẽ màn và chốt quy trình trước):**
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
node --test tests/backend.test.mjs      # 56 bài kiểm thử máy chủ (chạy Code.gs với Apps Script giả lập)
node tests/e2e.mjs                      # 20 bước toàn luồng trên bản xem thử (cần Playwright + Chromium)
```
