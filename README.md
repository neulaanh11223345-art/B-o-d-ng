# Sky English

Trang web luyện nghe và làm bài tập tiếng Anh cho người Việt, trình độ **A1–B2**.

- **12 bài** (A1, A2, B1, B2 mỗi cấp 3 bài), mỗi bài có bài nghe, 8–12 từ vựng, 5–6 bài tập.
- **Bài nghe** đọc bằng giọng có sẵn của máy (Anh-Mỹ hoặc Anh-Anh). Mỗi nhân vật một giọng: nữ, nam, trẻ em. Có nút câu trước/sau, ba tốc độ, ẩn/hiện lời thoại và bản dịch tiếng Việt.
- **Phiếu bài tập làm ngay trên web**, gồm 9 dạng:
  - chọn đáp án;
  - chọn một trong hai từ;
  - Đúng/Sai/Không có thông tin;
  - tích nhiều ô;
  - điền từ (có hoặc không có khung từ);
  - ghi tên vào hình;
  - đánh số thứ tự;
  - nối;
  - nghe chép.
- **Chấm điểm:** từng bài tập hoặc nộp cả bài. Câu sai có lời giải tiếng Việt và đáp án. Có điểm, sao, làm lại.
- **Bản in khổ A4** cho học viên làm trên giấy, có thể kèm lời thoại và đáp án.
- **Lưu trên máy, chạy offline:** kết quả lưu trong trình duyệt, cài được ra màn hình chính.

Mọi bài nghe, câu hỏi và lời giải được soạn mới, không chép từ sách hay đề thi có bản quyền.

## Chạy trên máy

```bash
npm run serve        # http://localhost:8080
```

## Thêm hoặc sửa bài

Mỗi bài là một tệp `data/units/<mã>.json`, định dạng trong `CONTENT-SPEC.md`. Sau khi sửa:

```bash
npm run check        # kiểm tra định dạng, viết lại data/units/index.json
```

## Kiểm thử

```bash
npm install
npm test             # chấm điểm, định dạng 12 bài, đáp án mẫu được 100%
npm run e2e          # mở app trong Chromium: làm đúng hết từng bài qua giao diện, làm sai có lời giải, bản in, giao diện tối, màn hẹp
```

## Đưa lên GitHub Pages

Đưa thư mục này lên một repo, vào **Settings → Pages**, chọn *Deploy from a branch*, nhánh `main`, thư mục `/ (root)`.
