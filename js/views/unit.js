// Một bài học: tab Nghe, Từ vựng, Bài tập (phiếu bài tập làm trên web, chấm điểm).
import { LEVELS, loadUnit, nextUnit } from '../data.js';
import { button, confetti, h, icon, put, segmented, toast } from '../dom.js';
import { questionCount, stars } from '../grade.js';
import { renderExercise } from '../exercises.js';
import { createPlayer } from '../player.js';
import { say, stopSpeaking } from '../speech.js';
import { starRow } from './home.js';

const tabByUnit = new Map();

export function render(ctx) {
  const { store, params, query, navigate } = ctx;
  const id = params[0];
  const el = h('div', { class: 'view' }, h('p', { class: 'muted', role: 'status' }, 'Đang mở bài…'));
  let cleanup = () => {};

  loadUnit(id)
    .then((u) => {
      cleanup = draw(u);
    })
    .catch((e) => put(el, h('p', { class: 'muted' }, `${e.message}.`), button('Về trang chủ', { href: '#/', icon: 'home', variant: 'secondary' })));

  function draw(u) {
    const level = LEVELS.find((l) => l.id === u.level);
    let tab = query.get('tab') || tabByUnit.get(u.id) || 'listen';
    const vi = () => store.state.settings.vi;
    const players = [];
    const total = u.exercises.reduce((n, x) => n + questionCount(x), 0);

    const head = h(
      'header',
      { class: 'topbar' },
      h('a', { class: 'icon-btn', href: '#/', 'aria-label': 'Về danh sách bài' }, icon('back', 24)),
      h('span', { class: 'topbar-title' }, `Level ${u.level} · Unit ${u.order}`),
      h('a', { class: 'icon-btn', href: `#/print/${u.id}`, 'aria-label': 'In phiếu bài tập', title: 'In phiếu bài tập' }, icon('print', 22)),
    );

    const hero = h(
      'section',
      { class: `unit-hero lv-${u.level.toLowerCase()}` },
      h('span', { class: 'unit-hero-icon', 'aria-hidden': 'true' }, u.icon),
      h('div', null, h('span', { class: 'level-chip' }, level?.name || u.level), h('h1', null, u.title), h('p', { class: 'unit-hero-vi' }, u.titleVi), h('ul', { class: 'goals' }, u.goals.map((g) => h('li', null, icon('target', 14), g)))),
    );

    const tabs = segmented(
      [
        ['listen', h('span', { class: 'tab-lbl' }, icon('headphones', 18), 'Nghe')],
        ['vocab', h('span', { class: 'tab-lbl' }, icon('book', 18), 'Từ vựng')],
        ['work', h('span', { class: 'tab-lbl' }, icon('pencil', 18), 'Bài tập')],
      ],
      tab,
      (v) => setTab(v),
      'Phần của bài',
    );
    tabs.classList.add('tabs');
    const body = h('div', { class: 'unit-body' });
    put(el, head, hero, tabs, body);

    function setTab(v) {
      tab = v;
      tabByUnit.set(u.id, v);
      history.replaceState(null, '', `#/unit/${u.id}?tab=${v}`);
      tabs.querySelectorAll('.seg-btn').forEach((b, i) => b.setAttribute('aria-checked', String(['listen', 'vocab', 'work'][i] === v)));
      for (const p of players.splice(0)) p.destroy();
      stopSpeaking();
      if (v === 'listen') drawListen();
      else if (v === 'vocab') drawVocab();
      else drawWork();
    }

    // ---------- Nghe ----------
    function drawListen() {
      const L = u.listening;
      const player = createPlayer(L, { store, onEnd: () => store.markListened(u.id) });
      players.push(player);
      put(body, 
        h(
          'section',
          { class: 'card listen-intro' },
          h('h2', null, icon('headphones', 22), L.title),
          vi() ? h('p', { class: 'muted' }, L.context) : null,
          L.kind === 'dialogue' ? h('div', { class: 'cast' }, L.speakers.map((s, i) => h('span', { class: `cast-chip sp${i % 3}` }, h('i', { 'aria-hidden': 'true' }), s.name, h('small', null, s.voice === 'male' ? 'giọng nam' : s.voice === 'child' ? 'giọng trẻ em' : 'giọng nữ')))) : null,
          h('p', { class: 'tip' }, icon('bulb', 16), 'Nghe trước một lần mà không xem lời thoại. Sau đó làm bài tập, rồi quay lại nghe kèm lời thoại để đối chiếu.'),
        ),
        player.el,
        h('div', { class: 'next-step' }, button('Làm bài tập', { icon: 'pencil', onclick: () => setTab('work') })),
      );
    }

    // ---------- Từ vựng ----------
    function drawVocab() {
      put(body, 
        h(
          'div',
          { class: 'vocab-list' },
          u.vocab.map((w) =>
            h(
              'article',
              { class: 'card vocab' },
              h('button', { type: 'button', class: 'say-btn', 'aria-label': `Nghe từ ${w.en}`, onclick: (e) => playBtn(e.currentTarget, w.en) }, icon('sound', 20)),
              h('div', { class: 'grow' }, h('p', { class: 'vocab-word' }, h('b', { lang: 'en' }, w.en), w.ipa ? h('span', { class: 'ipa' }, w.ipa) : null), h('p', { class: 'vocab-vi' }, w.vi), h('p', { class: 'vocab-ex', lang: 'en' }, w.ex)),
              h('button', { type: 'button', class: 'icon-btn soft', 'aria-label': `Nghe câu ví dụ: ${w.ex}`, onclick: (e) => playBtn(e.currentTarget, w.ex) }, icon('sound', 18)),
            ),
          ),
        ),
        h('div', { class: 'next-step' }, button('Làm bài tập', { icon: 'pencil', onclick: () => setTab('work') })),
      );
    }

    async function playBtn(btn, text) {
      document.querySelectorAll('.playing').forEach((b) => b.classList.remove('playing'));
      btn.classList.add('playing');
      await say(text, { kind: 'female', rate: store.state.settings.rate });
      btn.classList.remove('playing');
    }

    // ---------- Bài tập ----------
    function drawWork() {
      const saved = store.unit(u.id);
      const seed = (saved.attempts + 1) * 7919 + u.id.length;
      const dock = h('div', { class: 'dock', hidden: true });
      let dockPlayer = null;
      const openDock = () => {
        if (!dockPlayer) {
          dockPlayer = createPlayer(u.listening, { store, compact: true });
          players.push(dockPlayer);
          put(dock, h('div', { class: 'dock-inner' }, h('span', { class: 'dock-title' }, icon('headphones', 18), u.listening.title), dockPlayer.el, h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Đóng trình nghe', onclick: () => ((dock.hidden = true), dockPlayer.pause()) }, icon('close', 20))));
        }
        dock.hidden = false;
        dockPlayer.play();
      };
      const summary = h('section', { class: 'summary', 'aria-live': 'polite' });
      const cards = u.exercises.map((ex, i) =>
        renderExercise(ex, {
          index: i,
          seed: seed + i,
          vi: vi(),
          draft: saved.draft?.[i],
          onChange: (d) => store.saveDraft(u.id, i, d),
          onListen: openDock,
          onSay: (text, rate) => say(text, { kind: 'female', rate }),
          onChecked: (g) => {
            if (!g) recorded = false;
            drawSummary();
          },
        }),
      );

      // điểm được ghi một lần khi mọi bài tập đã chấm (làm lại một bài thì ghi lại khi chấm xong)
      let recorded = false;
      function drawSummary(initial = false) {
        const graded = cards.map((c) => c.grade);
        const done = graded.filter(Boolean);
        const correct = done.reduce((n, g) => n + g.correct, 0);
        if (done.length < cards.length) {
          put(summary, 
            h('div', { class: 'card submit-card' }, h('p', null, h('b', null, `Đã kiểm tra ${done.length}/${cards.length} bài tập`), done.length ? ` · đúng ${correct} câu` : null), h('p', { class: 'muted small' }, 'Bấm "Nộp cả bài" để chấm tất cả bài tập còn lại và nhận sao.'), button('Nộp cả bài', { icon: 'check', cls: 'btn-block', onclick: submitAll })),
          );
          return;
        }
        const score = correct / total;
        if (!recorded) {
          recorded = true;
          if (initial) return drawResult(score, correct);
          const better = store.recordScore(u.id, score);
          if (score >= 0.9) confetti();
          if (better && store.unit(u.id).attempts > 1) toast('Điểm cao nhất mới!');
        }
        drawResult(score, correct);
      }

      function drawResult(score, correct) {
        const n = stars(score);
        const msg = n === 3 ? 'Xuất sắc!' : n === 2 ? 'Làm tốt lắm!' : n === 1 ? 'Khá rồi, cố thêm chút nữa!' : 'Hãy nghe lại bài và làm lại nhé!';
        const nextBox = h('span');
        nextUnit(u.id).then((nx) => nx && put(nextBox, button(`Bài tiếp: ${nx.title}`, { href: `#/unit/${nx.id}`, icon: 'next', variant: 'secondary' })));
        put(summary, 
          h(
            'div',
            { class: 'card result-card' },
            starRow(n, 30),
            h('h2', null, msg),
            h('p', { class: 'result-score' }, h('b', null, `${correct}/${total}`), ` câu đúng · ${Math.round(score * 100)}%`),
            h('p', { class: 'muted small' }, 'Câu sai có lời giải ngay dưới câu. Mở lời thoại để đối chiếu bài nghe.'),
            h(
              'div',
              { class: 'result-actions' },
              button('Xem lời thoại', { icon: 'eye', variant: 'secondary', onclick: () => setTab('listen') }),
              button('Làm lại cả bài', { icon: 'rotate', variant: 'secondary', onclick: redo }),
              nextBox,
            ),
          ),
        );
      }

      function submitAll() {
        for (const c of cards) if (!c.checked) c.check();
        drawSummary();
        summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }

      function redo() {
        store.clearDraft(u.id);
        drawWork();
        window.scrollTo({ top: body.offsetTop - 80, behavior: 'smooth' });
      }

      put(body, 
        h('div', { class: 'sheet-head' }, h('span', { class: 'level-pill' }, `LEVEL ${u.level}`), h('div', null, h('b', null, `UNIT ${u.order} · ${u.title.toUpperCase()}`), h('small', null, `Student worksheet · ${u.exercises.length} bài tập · ${total} câu`))),
        ...cards.map((c) => c.el),
        summary,
        dock,
      );
      drawSummary(true);
    }

    setTab(tab);
    return () => {
      for (const p of players) p.destroy();
      stopSpeaking();
    };
  }

  return {
    el,
    title: 'Bài học',
    destroy() {
      cleanup();
    },
  };
}
