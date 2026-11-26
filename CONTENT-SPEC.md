# Sky English — định dạng một bài học (unit)

Mỗi bài là một tệp JSON trong `data/units/<id>.json`, mã hóa UTF-8, thụt lề 2 dấu cách.
Danh sách bài nằm trong `data/units/index.json` (do `tools/build_index.mjs` tạo, không viết tay).

Mọi nội dung phải **tự soạn mới**: không chép bài nghe, đoạn văn, câu hỏi từ sách, đề thi (Cambridge, TOEIC, IELTS…)
hay phiếu bài tập có sẵn. Tiếng Anh tự nhiên, đúng trình độ; tiếng Việt có dấu đầy đủ, tự nhiên.

## Khung một bài

```json
{
  "id": "a1-01",
  "level": "A1",
  "order": 1,
  "icon": "🦴",
  "title": "Move your body!",
  "titleVi": "Cơ thể chuyển động",
  "goals": ["Gọi tên xương, khớp và cơ", "Nói cơ thể giúp ta làm gì"],
  "vocab": [
    { "en": "bone", "vi": "xương", "ipa": "/bəʊn/", "ex": "Bones are hard." }
  ],
  "listening": {
    "kind": "dialogue",
    "title": "At the science club",
    "context": "Cô Kim cho bạn Nam và Lily xem bộ xương mô hình trong câu lạc bộ khoa học.",
    "speakers": [
      { "id": "T", "name": "Ms Kim", "voice": "female" },
      { "id": "N", "name": "Nam", "voice": "child" }
    ],
    "lines": [
      { "s": "T", "en": "Look, this is a skeleton. It's made of bones.", "vi": "Nhìn này, đây là một bộ xương. Nó được làm từ các xương." }
    ]
  },
  "exercises": [ ... ]
}
```

- `id`: `a1-01`, `a1-02`, `a2-01`… (cấp viết thường, hai chữ số).
- `level`: `A1` | `A2` | `B1` | `B2`. `order`: số thứ tự trong cấp (1, 2, 3).
- `icon`: một emoji hợp chủ đề.
- `goals`: 2–3 mục tiêu, tiếng Việt.
- `vocab`: 8–12 từ của bài. `ipa` kiểu Anh-Anh, có dấu `/…/`. `ex`: câu ví dụ ngắn tiếng Anh, có chứa từ đó.
- `listening.kind`: `dialogue` (2–3 người nói) hoặc `monologue` (1 người: thông báo, bài nói, tin nhắn thoại).
  - `voice`: `female` | `male` | `child`. Mỗi người nói một giọng khác nhau.
  - `lines`: mỗi câu (hoặc 1–2 câu ngắn) một dòng; `s` là `id` người nói; `vi` là bản dịch.
  - Độ dài: A1 8–12 dòng, câu rất ngắn; A2 10–14 dòng; B1 12–16 dòng; B2 14–18 dòng, có thể dài hơn.
  - Bài nghe phải chứa đủ thông tin để trả lời các bài tập có `"listen": true`.

## Bài tập

Mỗi bài có 5–6 bài tập, xen kẽ các dạng; ít nhất 2 bài dựa vào bài nghe (`"listen": true`).
Mỗi bài tập có:

```json
{
  "type": "...",
  "title": "Listen and choose",
  "instruction": "Listen. Choose the correct answer.",
  "instructionVi": "Nghe và chọn đáp án đúng.",
  "listen": true,
  ...phần riêng của từng dạng
}
```

Mọi câu hỏi (`items`) đều có `explain`: lời giải ngắn bằng tiếng Việt (vì sao đúng; nếu là bài nghe thì trích câu trong bài nghe).

### `choice` — chọn một đáp án

```json
{ "type": "choice", "items": [
  { "q": "Where is the smallest bone?", "options": ["In the ear", "In the foot", "In the hand"], "answer": 0, "explain": "..." }
] }
```
3–4 lựa chọn (A1 có thể 3). 4–6 câu.

### `pick` — chọn một trong hai từ để hoàn thành câu (kiểu "Bones are hard / soft")

```json
{ "type": "pick", "items": [
  { "q": "Bones are ___.", "options": ["hard", "soft"], "answer": 0, "explain": "..." }
] }
```
Đúng 2 lựa chọn, `___` là chỗ trống. 5–6 câu.

### `truefalse` — Đúng / Sai (/ Không có thông tin)

```json
{ "type": "truefalse", "ng": false, "items": [
  { "q": "Lily's ankle hurts.", "answer": "T", "explain": "..." }
] }
```
`answer`: `T` | `F` | `NG`. Chỉ dùng `NG` khi `"ng": true` (dùng cho B1–B2). 5–6 câu.

### `multi` — tích tất cả đáp án đúng

```json
{ "type": "multi", "items": [
  { "q": "Which are joints? Tick ALL correct answers.", "options": ["knee", "elbow", "nose", "ankle", "ear"], "answers": [0, 1, 3], "explain": "..." }
] }
```
4–6 lựa chọn, 2–4 đáp án đúng. 2–3 câu.

### `gap` — điền từ

```json
{ "type": "gap", "bank": ["see", "hear", "smell", "taste", "touch"], "items": [
  { "q": "I use my eyes to ___.", "answer": ["see"], "explain": "..." }
] }
```
- Mỗi câu đúng một `___`. `answer`: mảng các cách viết được chấp nhận (không phân biệt hoa thường).
- Có `bank` (khung từ gợi ý) thì người học bấm chọn từ; `bank` có thể có 1–2 từ thừa.
- Không có `bank` (`"bank": null`) thì người học tự gõ: dùng cho bài nghe điền thông tin (tên, số, giờ, địa điểm). Đáp án tối đa 3 từ.
- 4–6 câu.

### `order` — đánh số thứ tự

```json
{ "type": "order", "items": [
  { "text": "Mix three things together.", "explain": "..." },
  { "text": "Cover your eyes.", "explain": "..." },
  { "text": "Smell the potion.", "explain": "..." }
] }
```
`items` viết **theo đúng thứ tự**; app tự xáo trộn khi hiện. 3–6 bước.

### `match` — nối

```json
{ "type": "match", "pairs": [
  { "left": "eyes", "right": "see", "explain": "..." }
] }
```
4–6 cặp; vế phải không trùng nhau.

### `label` — ghi tên vào hình (chỉ dùng hình có sẵn)

```json
{ "type": "label", "image": "face", "bank": ["eyes", "eyelashes", "eyebrows", "ears", "cheeks", "nose", "mouth", "tongue", "chin"], "points": [
  { "n": 1, "answer": "eyebrows", "explain": "..." }
] }
```
Hình có sẵn và các số trên hình:
- `face` (khuôn mặt): 1 eyebrows (lông mày), 2 eyelashes (lông mi), 3 eyes (mắt), 4 ears (tai), 5 cheeks (má), 6 nose (mũi), 7 mouth (miệng), 8 tongue (lưỡi), 9 chin (cằm).
- `body` (cơ thể): 1 head, 2 neck, 3 shoulder, 4 arm, 5 elbow, 6 hand, 7 knee, 8 leg, 9 foot.
Dùng đúng các số và đáp án trên (có thể dùng một phần các số).

### `dictation` — nghe và chép

```json
{ "type": "dictation", "listen": true, "items": [
  { "text": "My knees help me run.", "explain": "..." }
] }
```
3–5 câu ngắn (A1–A2: 4–8 từ; B1–B2: 8–14 từ). Không có ký tự lạ; số viết bằng chữ.

## Gợi ý phân bổ dạng bài theo cấp

- A1 (thiếu nhi / mới bắt đầu): `pick`, `label`, `gap` có `bank`, `order`, `choice` 3 lựa chọn, `match`.
- A2: `choice`, `truefalse`, `gap` có `bank`, `match`, `dictation`, `order`.
- B1: `choice` 4 lựa chọn, `truefalse` có `ng`, `gap` không `bank` (nghe điền thông tin), `multi`, `dictation`.
- B2: như B1, câu hỏi suy luận (thái độ, ý chính, ý ngụ ý), `multi`, `gap` không `bank`, `match` (ý kiến ↔ người nói).

Kiểm tra định dạng: `node tools/check_units.mjs` (báo lỗi nếu thiếu trường, đáp án sai chỉ số, bài nghe thiếu…).
