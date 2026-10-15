# Credible Việt Nam CMMS · 设备管理 — v2.4.0

App quản lý công việc (giao việc, sửa chữa), bảo dưỡng thiết bị, ghi số điện/nước và kho linh kiện cho nhà máy Credible Việt Nam.

- **iPhone:** chạy dạng PWA — mở bằng Safari rồi "Thêm vào Màn hình chính", dùng như một app.
- **Máy tính:** cùng địa chỉ đó, mở bằng trình duyệt. Màn rộng tự chuyển sang giao diện có thanh bên và bảng dữ liệu.
- **Dữ liệu:** lưu trong **Google Sheet**, đọc/ghi qua Google Apps Script. Ảnh lưu trong Google Drive của chủ sheet và để riêng tư.
- **Ngôn ngữ:** song ngữ Việt – Trung. Tiếng Việt chữ lớn, tiếng Trung nhỏ hơn bên dưới. Nội dung công việc gõ một thứ tiếng, app tự dịch sang thứ tiếng kia.

## Các file

| File | Dùng để |
|---|---|
| `Code.gs-v2.4.0.txt` | Mã máy chủ, dán vào Apps Script của Google Sheet |
| `docs/` | Bộ PWA để đăng lên web (GitHub Pages): `index.html` (app thật), `demo.html` (bản xem thử), `sw.js`, `manifest.webmanifest`, `icons/` |
| `app-v2.4.0.html` | Giống `docs/index.html`, một file duy nhất (nếu muốn đăng ở chỗ khác) |
| `demo-v2.4.0.html` | Bản xem thử chạy hoàn toàn trong trình duyệt, có máy chủ giả và dữ liệu mẫu |
| `src/` | Mã nguồn: `app.html`, `Code.gs`, `sw.js`, `config.json` (link máy chủ, phiên bản), `demo/` |
| `tools/build.mjs` | Ghép `src/` thành các file trên: `node tools/build.mjs` |
| `tests/` | Kiểm thử máy chủ (`npm test`) và kiểm thử toàn luồng trên bản xem thử (`npm run e2e`) |
| `*-v1.6.0.*` | Bản cũ, giữ lại để đối chiếu hoặc quay lại khi cần |

> Chỉ sửa trong `src/`, rồi chạy `node tools/build.mjs`. Không sửa trực tiếp các file đã tạo.

## Xem thử ngay (không cần cài gì)

Mở `docs/demo.html` (hoặc `demo-v2.4.0.html`) bằng trình duyệt. Tài khoản mẫu:

| Mã nhân viên | PIN | Vai trò |
|---|---|---|
| NV001 | 111111 | Quản trị |
| NV002 | 222222 | Quản lý |
| NV003 | 333333 | Kỹ thuật |
| NV004 / NV005 / NV006 | 444444 / 555555 / 666666 | Kỹ thuật (chỉ có trong bản xem thử, để thử giao việc) |

Muốn thử cảnh mất mạng: vào **Cá nhân → Giả lập mất mạng**.

Bản xem thử không gọi Google Dịch thật, chỉ dịch được các câu mẫu, ví dụ "Thay vòi nước nhà vệ sinh xưởng 1", "Máy hút bụi VKY03 không chạy", "Thay chổi than motor", hoặc gõ tiếng Trung "检查空压机油位". Câu khác sẽ hiện dòng "（演示版：正式系统会自动翻译这句话）" thay cho bản dịch.

## Nâng cấp máy chủ từ bản cũ (giữ nguyên link)

1. Mở Google Sheet đang dùng → **Tiện ích mở rộng → Apps Script**.
2. Xoá hết mã cũ trong `Code.gs`, dán toàn bộ `Code.gs-v2.4.0.txt`, rồi bấm **Lưu**.
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
2. Xoá mã có sẵn, dán toàn bộ `Code.gs-v2.4.0.txt` → **Lưu**.
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
- **Nhân viên:** trang chủ có mục **Việc của tôi** (gồm cả phiếu sửa chữa được giao), xếp việc gấp / sắp hết hạn lên trước. Bấm Bắt đầu → Xong (ghi kết quả, linh kiện / vật tư đã dùng, ảnh). Bị vướng thì **Tạm hoãn** kèm lý do.
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
node --test tests/backend.test.mjs      # 22 bài kiểm thử máy chủ (chạy Code.gs với Apps Script giả lập)
node tests/e2e.mjs                      # 11 bước toàn luồng trên bản xem thử (cần Playwright + Chromium)
```
