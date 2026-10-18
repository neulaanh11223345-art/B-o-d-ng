# Đối chiếu Excel

App **độc lập**, không dính gì tới app CMMS trong repo này: đưa 2 file Excel vào, máy tự đối
chiếu và chỉ ra chỗ lệch.

Kết quả build là **một file duy nhất**: `doi-chieu-excel.html` ở thư mục gốc repo.
Chép file đó đi đâu cũng chạy — mở bằng Chrome / Edge / Safari trên máy tính hoặc iPhone.
Không cần cài gì, không cần mạng, **dữ liệu không rời khỏi máy** (file được đọc ngay trong
trình duyệt).

## Dùng thế nào

1. Mở `doi-chieu-excel.html`.
2. Thả (hoặc bấm chọn) file Excel thứ nhất vào ô **FILE 1**, file thứ hai vào ô **FILE 2**.
   Thả cả 2 file một lúc cũng được.
3. Kết quả hiện ra ngay. Bấm **Tải kết quả Excel** để lấy file báo cáo.

Chưa có file thì bấm **Thử dữ liệu mẫu** để xem trước.

## Máy tự làm những gì

- **Dò dòng tiêu đề**: bỏ qua dòng tên công ty, tên báo cáo, dòng trống ở đầu sheet.
  File không có dòng tiêu đề thì đặt ô "Dòng tiêu đề" = 0, cột sẽ tên là `Cột 1`, `Cột 2`…
- **Ghép cột giữa 2 file** — thứ tự cột khác nhau không ảnh hưởng gì:
  - theo **tên**: giống nhau, đồng nghĩa (`Số lượng` ↔ `SL` ↔ `Qty`, `Thành tiền` ↔ `Amount`,
    `Mã hàng` ↔ `Ma hang`…), rồi tới tên gần giống;
  - theo **nội dung bên trong cột**: so bộ giá trị của từng cột với nhau. Cách này cứu được
    trường hợp tên cột vô nghĩa (`Column1`, `F3`) hoặc 2 file đặt tên khác hẳn — và không
    phụ thuộc thứ tự dòng, vì nó so tập hợp giá trị chứ không so theo vị trí.

  Mặc định máy dùng cả hai, cân nhắc cùng lúc. Đổi được sang *chỉ theo tên*, *chỉ theo nội
  dung*, hoặc *theo thứ tự cột* trong Tùy chọn.
- **Chọn cột khóa** để ghép dòng của 2 file với nhau — ưu tiên cột mã / số chứng từ, tránh
  cột STT. Nếu một cột chưa đủ phân biệt, máy tự ghép 2 cột làm khóa (ví dụ `Ngày` + `Mã KH`).
- **So sánh**: số so theo dung sai, ngày so theo ngày, chữ bỏ qua hoa/thường và khoảng trắng thừa.
  Đọc được số kiểu Việt Nam (`1.234,56`), kiểu Anh (`1,234.56`), số âm trong ngoặc `(1.200)`,
  có đuôi `đ` / `VNĐ` / `%`.
- Mã `001` và số `1` được coi là cùng một mã.

## Khi cột lộn xộn, dòng lộn xộn

- **Dòng lộn xộn**: không cần làm gì. App ghép dòng theo *cột khóa* chứ không theo vị trí,
  nên 2 file sắp xếp khác nhau vẫn ra đúng kết quả.
- **Cột khác thứ tự**: không cần làm gì, app ghép theo tên hoặc nội dung.
- **Tên cột vô nghĩa hoặc khác hẳn nhau**: app so nội dung từng cột để đoán, và nói rõ nó
  đoán theo cái gì (`dữ liệu trùng 82%`, `tên tương đương`…) để bạn kiểm lại.
- **Máy đoán sai**: bảng *"Cột nào so với cột nào"* trong Tùy chọn cho bạn tự chọn lại từng
  cặp cột bằng danh sách thả xuống, và đặt vai trò cho từng cột: **Cột khóa** / **Đem ra so**
  / **Bỏ qua**.
- **Không có cột nào làm khóa được**: đổi *"Ghép dòng của 2 file theo"* sang **Thứ tự dòng** —
  dòng 1 so với dòng 1, dòng 2 với dòng 2. Chỉ dùng khi 2 file chắc chắn cùng thứ tự.

Mọi thứ máy tự chọn đều sửa được trong phần **Tùy chọn đối chiếu**: cách ghép cột, cặp cột,
cột khóa, dung sai, từng quy tắc so sánh, hoặc **gộp dòng trùng khóa** (cộng số lượng, số tiền
rồi mới so — hợp khi một bên ghi nhiều dòng cho cùng một mã).

## Kết quả gồm

| Mục | Nội dung |
|---|---|
| Lệch giá trị | Từng ô lệch: khóa, cột, giá trị file 1, giá trị file 2, chênh lệch |
| Chỉ có ở file 1 | Dòng có ở file 1 mà file 2 không có |
| Chỉ có ở file 2 | Ngược lại |
| Khóa trùng lặp | Khóa xuất hiện nhiều lần, kèm số dòng mỗi bên |
| Theo cột | Số ô lệch mỗi cột, tổng cộng mỗi bên và **tổng chênh lệch** |

File Excel tải về có đủ 5 sheet trên, cộng sheet **Tóm tắt**.

## Dành cho người sửa code

```
doichieu/
  src/core.js     # lõi: dò tiêu đề, ghép cột, chọn khóa, so sánh (không đụng DOM)
  src/ui.js       # giao diện
  src/style.css
  src/index.html  # khung, có các chỗ chờ nhúng
  vendor/         # SheetJS 0.18.5 (Apache-2.0) để đọc/ghi .xlsx
  build.mjs       # gộp tất cả thành ../doi-chieu-excel.html
  test/           # test lõi (node:test) + test giao diện thật bằng Chromium
```

```sh
cd doichieu
npm run build    # tạo lại ../doi-chieu-excel.html
npm test         # 18 test của lõi xử lý
npm run e2e      # build rồi chạy thử trong Chromium (cần playwright)
```

Sửa code trong `src/` rồi **nhớ chạy `npm run build`**, vì file dùng thật là file đã gộp.
