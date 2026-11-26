// Trang chủ: học tiếp, các cấp độ và danh sách bài.
import { LEVELS, loadIndex } from '../data.js';
import { h, icon, put, segmented } from '../dom.js';
import { stars } from '../grade.js';

let lastLevel = null;

export function logo(size = 44) {
  const el = h('span', { class: 'logo', 'aria-hidden': 'true' });
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 48 48"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#lg)"/><path d="M14 31a6 6 0 0 1 1-11.9A9 9 0 0 1 32 17a7 7 0 0 1 2 13.7" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M17 33v-3a7 7 0 0 1 14 0v3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><rect x="14" y="30" width="5" height="8" rx="2" fill="#fff"/><rect x="29" y="30" width="5" height="8" rx="2" fill="#fff"/></svg>`;
  return el;
}

export function starRow(n, size = 16) {
  return h('span', { class: 'stars', role: 'img', 'aria-label': `${n} trên 3 sao` }, [0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : '' }, icon('star', size))));
}

export function render(ctx) {
  const { store } = ctx;
  const list = h('div', { class: 'unit-grid' }, h('p', { class: 'muted', role: 'status' }, 'Đang tải bài học…'));
  const levelArea = h('div', { class: 'level-area' });
  const resume = h('div');
  const stats = h('div', { class: 'stat-row' });

  loadIndex()
    .then((units) => {
      const progress = store.state.units;
      const done = units.filter((u) => progress[u.id]?.best !== null && progress[u.id]?.best !== undefined);
      const avg = done.length ? Math.round((done.reduce((s, u) => s + progress[u.id].best, 0) / done.length) * 100) : null;
      put(stats, 
        h('div', { class: 'stat' }, h('strong', null, `${done.length}/${units.length}`), h('small', null, 'bài đã làm')),
        h('div', { class: 'stat' }, h('strong', null, avg === null ? '—' : `${avg}%`), h('small', null, 'điểm trung bình')),
        h('div', { class: 'stat' }, h('strong', null, String(done.reduce((s, u) => s + stars(progress[u.id].best), 0))), h('small', null, 'sao đã nhận')),
      );

      // bài đang làm dở hoặc bài kế tiếp chưa làm
      const recent = Object.entries(progress)
        .filter(([id]) => units.some((u) => u.id === id))
        .sort((a, b) => (b[1].last || 0) - (a[1].last || 0))[0];
      const pick = recent ? units.find((u) => u.id === recent[0]) : units[0];
      if (pick) {
        const p = progress[pick.id];
        put(resume, 
          h(
            'a',
            { class: 'resume card', href: `#/unit/${pick.id}` },
            h('span', { class: 'resume-icon', 'aria-hidden': 'true' }, pick.icon),
            h('span', { class: 'grow' }, h('small', null, p ? 'Học tiếp' : 'Bắt đầu với'), h('b', null, pick.title), h('span', { class: 'muted small' }, `${pick.level} · ${pick.titleVi}`)),
            h('span', { class: 'resume-go' }, icon('play', 20)),
          ),
        );
      }

      let level = lastLevel || pick?.level || 'A1';
      const drawLevel = () => {
        lastLevel = level;
        const info = LEVELS.find((l) => l.id === level);
        const items = units.filter((u) => u.level === level);
        put(list, 
          h('p', { class: 'level-desc' }, info.desc),
          ...items.map((u) => {
            const p = progress[u.id];
            const best = p && p.best !== null && p.best !== undefined ? p.best : null;
            return h(
              'a',
              { class: `unit-card card lv-${u.level.toLowerCase()}`, href: `#/unit/${u.id}` },
              h('span', { class: 'unit-icon', 'aria-hidden': 'true' }, u.icon),
              h('span', { class: 'unit-main' }, h('small', { class: 'unit-no' }, `Unit ${u.order}`), h('b', { class: 'unit-title' }, u.title), h('span', { class: 'unit-vi' }, u.titleVi), h('span', { class: 'unit-meta' }, `${u.exercises} bài tập · ${u.questions} câu`)),
              h('span', { class: 'unit-end' }, best === null ? h('span', { class: 'badge' }, p ? 'Đang làm' : 'Mới') : [starRow(stars(best)), h('small', null, `${Math.round(best * 100)}%`)]),
            );
          }),
        );
      };
      put(levelArea, 
        segmented(
          LEVELS.filter((l) => units.some((u) => u.level === l.id)).map((l) => [l.id, h('span', { class: 'seg-two' }, h('b', null, l.id), h('small', null, l.short))]),
          level,
          (v) => {
            level = v;
            drawLevel();
          },
          'Chọn cấp độ',
        ),
      );
      drawLevel();
    })
    .catch((e) => put(list, h('p', { class: 'muted' }, `${e.message}. Hãy kiểm tra mạng rồi tải lại trang.`)));

  const el = h(
    'div',
    { class: 'view' },
    h('header', { class: 'top' }, h('a', { class: 'brand', href: '#/' }, logo(), h('span', null, h('b', null, 'Sky English'), h('small', null, 'Luyện nghe & làm bài tập tiếng Anh'))), h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Cài đặt', title: 'Cài đặt' }, icon('settings', 22))),
    h(
      'section',
      { class: 'hero' },
      h('div', { class: 'hero-text' }, h('h1', null, 'Listen. Practise. Grow.'), h('p', null, 'Nghe hội thoại bằng giọng Anh-Mỹ hoặc Anh-Anh, làm phiếu bài tập ngay trên web và được chấm điểm tức thì.')),
      h('div', { class: 'hero-art', 'aria-hidden': 'true' }),
    ),
    resume,
    stats,
    h('section', { class: 'section' }, h('h2', { class: 'section-title' }, 'Chọn cấp độ'), levelArea, list),
  );
  return { el };
}
