// Phiếu bài tập để in (giấy A4): làm bằng bút, có thể kèm lời thoại và đáp án cho giáo viên.
import { loadUnit } from '../data.js';
import { button, h, icon, put, shuffle, toggle } from '../dom.js';
import { imageSvg } from '../images.js';

const LETTERS = 'ABCDEFGH';
const TF = { T: 'True', F: 'False', NG: 'Not given' };
const line = (w = 'long') => h('span', { class: `p-line ${w}` });

function gapText(q, blank) {
  const [a, b] = q.split('___');
  return [a, blank, b ?? ''];
}

function exercise(ex, i, seed) {
  const head = h('header', { class: 'p-head' }, h('span', { class: `ex-badge c${i % 6}` }, i + 1), h('div', null, h('h3', null, ex.title, ex.listen ? h('span', { class: 'p-listen' }, ' 🎧') : null), h('p', null, ex.instruction)));
  let body;
  switch (ex.type) {
    case 'choice':
      body = h('ol', { class: 'p-items' }, ex.items.map((it) => h('li', null, h('p', null, it.q), h('p', { class: 'p-opts' }, it.options.map((o, k) => h('span', null, `${LETTERS[k]}. ${o}`))))));
      break;
    case 'pick':
      body = h('table', { class: 'p-table' }, ex.items.map((it, k) => h('tr', null, h('td', null, `${k + 1}  `, gapText(it.q, '______')), h('td', { class: 'p-pick' }, it.options.join(' / ')))));
      break;
    case 'truefalse':
      body = h('table', { class: 'p-table' }, h('tr', null, h('th', null, ''), (ex.ng ? ['T', 'F', 'NG'] : ['T', 'F']).map((k) => h('th', { class: 'p-tf' }, TF[k]))), ex.items.map((it, k) => h('tr', null, h('td', null, `${k + 1}  ${it.q}`), (ex.ng ? ['T', 'F', 'NG'] : ['T', 'F']).map(() => h('td', { class: 'p-tf' }, h('span', { class: 'p-box' }))))));
      break;
    case 'multi':
      body = h('ol', { class: 'p-items' }, ex.items.map((it) => h('li', null, h('p', null, it.q), h('p', { class: 'p-opts' }, it.options.map((o) => h('span', null, h('span', { class: 'p-box' }), ` ${o}`))))));
      break;
    case 'gap':
      body = [ex.bank ? h('p', { class: 'p-bank' }, ex.bank.join(' · ')) : null, h('ol', { class: 'p-items' }, ex.items.map((it) => h('li', null, gapText(it.q, line('mid')))))];
      break;
    case 'label': {
      const art = h('div', { class: 'p-art' });
      art.innerHTML = imageSvg(ex.image, ex.points.map((p) => p.n), ex.title);
      body = [ex.bank ? h('p', { class: 'p-bank' }, ex.bank.join(' · ')) : null, h('div', { class: 'p-label' }, art, h('ol', { class: 'p-lines' }, ex.points.map((p) => h('li', { value: p.n }, line('mid')))))];
      break;
    }
    case 'order':
      body = h('div', { class: 'p-items' }, shuffle(ex.items.map((_, k) => k), seed).map((k) => h('p', { class: 'p-order' }, h('span', { class: 'p-box big' }), ex.items[k].text)));
      break;
    case 'match': {
      const rights = shuffle(ex.pairs.map((p) => p.right), seed + 7);
      body = h('div', { class: 'p-match' }, h('ol', null, ex.pairs.map((p) => h('li', null, p.left, ' ', h('span', { class: 'p-dot' })))), h('ol', { type: 'a' }, rights.map((r) => h('li', null, h('span', { class: 'p-dot' }), ' ', r))));
      break;
    }
    case 'dictation':
      body = h('ol', { class: 'p-items' }, ex.items.map(() => h('li', null, line('full'))));
      break;
    default:
      body = null;
  }
  return h('section', { class: 'p-ex' }, head, body);
}

function answerKey(u) {
  return h(
    'section',
    { class: 'p-key' },
    h('h2', null, 'Answer key · Đáp án'),
    u.exercises.map((ex, i) => {
      let ans;
      if (ex.type === 'choice') ans = ex.items.map((it, k) => `${k + 1}${LETTERS[it.answer]}`);
      else if (ex.type === 'pick') ans = ex.items.map((it, k) => `${k + 1} ${it.options[it.answer]}`);
      else if (ex.type === 'truefalse') ans = ex.items.map((it, k) => `${k + 1} ${TF[it.answer]}`);
      else if (ex.type === 'multi') ans = ex.items.map((it, k) => `${k + 1} ${it.answers.map((a) => it.options[a]).join(', ')}`);
      else if (ex.type === 'gap') ans = ex.items.map((it, k) => `${k + 1} ${it.answer[0]}`);
      else if (ex.type === 'label') ans = ex.points.map((p) => `${p.n} ${p.answer}`);
      else if (ex.type === 'order') ans = ex.items.map((it, k) => `${k + 1}. ${it.text}`);
      else if (ex.type === 'match') ans = ex.pairs.map((p, k) => `${k + 1} ${p.left} – ${p.right}`);
      else if (ex.type === 'dictation') ans = ex.items.map((it, k) => `${k + 1} ${it.text}`);
      return h('p', null, h('b', null, `${i + 1}. ${ex.title}: `), (ans || []).join(' · '));
    }),
  );
}

export function render(ctx) {
  const { params } = ctx;
  const el = h('div', { class: 'view print-view' }, h('p', { class: 'muted' }, 'Đang chuẩn bị phiếu…'));
  let withKey = false;
  let withScript = false;

  loadUnit(params[0]).then((u) => {
    const paper = h('div', { class: 'paper' });
    const drawPaper = () => {
      put(paper, 
        h('header', { class: 'p-top' }, h('span', { class: 'level-pill' }, `LEVEL ${u.level}`), h('div', { class: 'grow' }, h('h1', null, `UNIT ${u.order} · ${u.title.toUpperCase()}`), h('p', null, 'Student worksheet · Name: ', line('mid'), ' Date: ', line('short'))), h('span', { class: 'p-brand' }, 'Sky English')),
        u.exercises.map((ex, i) => exercise(ex, i, i * 31 + 7)),
        withScript ? h('section', { class: 'p-script' }, h('h2', null, `Transcript · ${u.listening.title}`), u.listening.lines.map((l) => h('p', null, u.listening.kind === 'dialogue' ? h('b', null, `${u.listening.speakers.find((s) => s.id === l.s)?.name || l.s}: `) : null, l.en))) : null,
        withKey ? answerKey(u) : null,
        h('footer', { class: 'p-foot' }, 'Sky English · bài nghe tại trang web, mục ', `Level ${u.level} · Unit ${u.order}`),
      );
    };
    drawPaper();
    put(el, 
      h(
        'div',
        { class: 'print-tools no-print' },
        h('a', { class: 'icon-btn', href: `#/unit/${u.id}?tab=work`, 'aria-label': 'Quay lại bài học' }, icon('back', 24)),
        h('div', { class: 'grow' }, h('b', null, 'Phiếu bài tập để in'), h('p', { class: 'small muted' }, 'Cho học viên làm trên giấy. Phần nghe phát từ trang web.')),
        toggle('Kèm lời thoại', withScript, (on) => ((withScript = on), drawPaper())),
        toggle('Kèm đáp án', withKey, (on) => ((withKey = on), drawPaper())),
        // trang xem trước trên Claude không mở được hộp thoại in
        globalThis.SKY_EMBED ? h('p', { class: 'small muted' }, 'Mở bản trên web để in.') : button('In', { icon: 'print', onclick: () => window.print() }),
      ),
      paper,
    );
  });

  return { el, title: 'In phiếu bài tập', print: true };
}
