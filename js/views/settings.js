// Cài đặt: giọng đọc, tốc độ, bản dịch tiếng Việt, giao diện, xóa kết quả.
import { button, h, icon, put, segmented, toast, toggle } from '../dom.js';
import { RATES } from '../player.js';
import { hasEnglishVoice, pickVoice, say, setAccent } from '../speech.js';

export function render(ctx) {
  const { store } = ctx;
  const s = () => store.state.settings;
  const row = (label, desc, control) => h('div', { class: 'set-row' }, h('span', { class: 'set-label' }, h('span', null, label), desc ? h('small', null, desc) : null), control);

  const voiceNote = h('small');
  const drawVoices = () => {
    const f = pickVoice('female');
    const m = pickVoice('male');
    voiceNote.textContent = hasEnglishVoice() ? `Giọng nữ: ${f?.name || 'mặc định'} · Giọng nam: ${m?.name || 'mặc định'}` : 'Máy chưa có giọng tiếng Anh. Hãy thêm giọng tiếng Anh trong cài đặt máy.';
  };
  drawVoices();
  setTimeout(drawVoices, 800);

  const test = () => say("Hello! Welcome to Sky English. Let's listen and practise together.", { kind: 'female', rate: s().rate });

  const audio = h(
    'section',
    { class: 'card settings-group' },
    h('h2', null, 'Giọng đọc'),
    row(
      'Giọng tiếng Anh',
      null,
      segmented(
        [
          ['en-US', 'Anh-Mỹ'],
          ['en-GB', 'Anh-Anh'],
        ],
        s().accent,
        (v) => {
          store.setSettings({ accent: v });
          setAccent(v);
          drawVoices();
          test();
        },
        'Giọng tiếng Anh',
      ),
    ),
    row('Tốc độ đọc', null, segmented(RATES, s().rate, (v) => (store.setSettings({ rate: v }), test()), 'Tốc độ đọc')),
    h('div', { class: 'set-row' }, h('span', { class: 'set-label' }, h('span', null, 'Giọng trên máy này'), voiceNote), button('Nghe thử', { icon: 'sound', variant: 'secondary', size: 'sm', onclick: test })),
  );

  const display = h(
    'section',
    { class: 'card settings-group' },
    h('h2', null, 'Hiển thị'),
    toggle('Hiện tiếng Việt', s().vi, (on) => store.setSettings({ vi: on }), 'Bản dịch lời thoại, hướng dẫn làm bài bằng tiếng Việt'),
    row(
      'Giao diện',
      null,
      segmented(
        [
          ['system', 'Tự động'],
          ['light', 'Sáng'],
          ['dark', 'Tối'],
        ],
        s().theme,
        (v) => store.setSettings({ theme: v }),
        'Giao diện sáng tối',
      ),
    ),
  );

  const resetSlot = h('div', { class: 'set-row' });
  const drawReset = (asking) => {
    if (!asking) {
      put(resetSlot, h('span', { class: 'set-label' }, h('span', null, 'Xóa kết quả làm bài'), h('small', null, 'Xóa điểm, sao và bài đang làm dở trên máy này')), button('Xóa', { variant: 'ghost', size: 'sm', onclick: () => drawReset(true) }));
      return;
    }
    const keep = button('Giữ lại', { variant: 'secondary', size: 'sm', onclick: () => drawReset(false) });
    put(resetSlot, 
      h('div', { class: 'confirm-box', role: 'alertdialog', 'aria-label': 'Xác nhận xóa kết quả' }, h('p', null, h('b', null, 'Xóa toàn bộ kết quả làm bài?'), h('br'), h('small', null, 'Không hoàn tác được.')), h('div', { class: 'confirm-actions' }, keep, button('Xóa hết', { variant: 'danger', size: 'sm', onclick: () => (store.reset(), toast('Đã xóa kết quả làm bài'), drawReset(false)) }))),
    );
    keep.focus();
  };
  drawReset(false);

  const about = h(
    'section',
    { class: 'card settings-group' },
    h('h2', null, 'Dữ liệu'),
    resetSlot,
    h('p', { class: 'small muted about' }, 'Sky English lưu kết quả ngay trên trình duyệt của máy này, không cần tài khoản. Bài nghe, bài tập và lời giải được soạn mới cho app, không lấy từ sách hay đề thi có bản quyền. Giọng đọc dùng giọng có sẵn của máy.'),
  );

  const el = h('div', { class: 'view narrow' }, h('header', { class: 'topbar' }, h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Về trang chủ' }, icon('back', 24)), h('h1', { class: 'grow' }, 'Cài đặt')), audio, display, about);
  return { el, title: 'Cài đặt' };
}
