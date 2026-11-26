// Vẽ từng dạng bài tập thành thẻ làm bài tương tác.
// Mỗi bài tập trả về {el, check(), reset(), score} — check() chấm và hiện đúng/sai kèm lời giải.
import { h, icon, put, shuffle } from './dom.js';
import { gradeExercise, wordDiff } from './grade.js';
import { imageSvg } from './images.js';

const LETTERS = 'ABCDEFGH';
const TF_LABELS = { T: ['True', 'Đúng'], F: ['False', 'Sai'], NG: ['Not given', 'Không có thông tin'] };

/** Câu có chỗ trống "___" → các đoạn chữ và chỗ để gắn ô trả lời. */
function splitGap(q, slot) {
  const [a, b] = q.split('___');
  return [a, slot, b ?? ''];
}

/**
 * opts: {index, unitId, store, draft, seed, onChange, onListen, vi}
 * draft: {state: [...], checked: bool} đã lưu lần trước.
 */
export function renderExercise(ex, opts) {
  const { index, seed = 1, vi = true } = opts;
  const state = Array.isArray(opts.draft?.state) ? [...opts.draft.state] : [];
  let checked = Boolean(opts.draft?.checked);
  let lastGrade = null;
  const body = h('div', { class: 'ex-body' });
  const footer = h('div', { class: 'ex-foot' });
  const scoreEl = h('span', { class: 'ex-score', role: 'status' });

  const save = () => opts.onChange?.({ state: [...state], checked });
  const set = (i, v) => {
    if (checked) return;
    state[i] = v;
    save();
    draw();
  };

  // ---------- từng dạng ----------
  const feedback = (ok, explain, extra) =>
    checked ? h('div', { class: `fb ${ok ? 'ok' : 'no'}` }, icon(ok ? 'check' : 'close', 16), h('div', null, extra || null, explain ? h('p', null, explain) : null)) : null;

  function itemCls(i) {
    if (!checked || !lastGrade) return 'q';
    return `q ${lastGrade.results[i] ? 'right' : 'wrong'}`;
  }

  function drawChoice() {
    put(body, 
      ...ex.items.map((it, i) =>
        h(
          'div',
          { class: itemCls(i) },
          h('p', { class: 'q-text' }, h('b', { class: 'q-num' }, `${i + 1}`), it.q),
          h(
            'div',
            { class: 'opts', role: 'radiogroup', 'aria-label': `Câu ${i + 1}` },
            it.options.map((o, k) =>
              h(
                'button',
                {
                  type: 'button',
                  role: 'radio',
                  class: `opt ${checked && k === it.answer ? 'is-answer' : ''} ${checked && state[i] === k && k !== it.answer ? 'is-wrong' : ''}`,
                  'aria-checked': String(state[i] === k),
                  disabled: checked || null,
                  onclick: () => set(i, k),
                },
                h('span', { class: 'opt-key' }, LETTERS[k]),
                h('span', null, o),
              ),
            ),
          ),
          feedback(lastGrade?.results[i], it.explain, lastGrade && !lastGrade.results[i] ? h('p', null, h('b', null, 'Đáp án: '), `${LETTERS[it.answer]}. ${it.options[it.answer]}`) : null),
        ),
      ),
    );
  }

  function drawPick() {
    put(body, 
      h(
        'div',
        { class: 'pick-table' },
        ex.items.map((it, i) => {
          const choices = h(
            'span',
            { class: 'pick-opts', role: 'radiogroup', 'aria-label': `Câu ${i + 1}` },
            it.options.map((o, k) => [
              k ? h('span', { class: 'slash', 'aria-hidden': 'true' }, '/') : null,
              h(
                'button',
                {
                  type: 'button',
                  role: 'radio',
                  class: `pick ${checked && k === it.answer ? 'is-answer' : ''} ${checked && state[i] === k && k !== it.answer ? 'is-wrong' : ''}`,
                  'aria-checked': String(state[i] === k),
                  disabled: checked || null,
                  onclick: () => set(i, k),
                },
                o,
              ),
            ]),
          );
          const [a, , b] = splitGap(it.q);
          return h('div', { class: `${itemCls(i)} pick-row` }, h('p', { class: 'q-text' }, h('b', { class: 'q-num' }, `${i + 1}`), a, h('span', { class: 'pick-blank' }, state[i] !== undefined ? it.options[state[i]] : '_____'), b), choices, feedback(lastGrade?.results[i], it.explain));
        }),
      ),
    );
  }

  function drawTrueFalse() {
    const keys = ex.ng ? ['T', 'F', 'NG'] : ['T', 'F'];
    put(body, 
      ...ex.items.map((it, i) =>
        h(
          'div',
          { class: `${itemCls(i)} tf-row` },
          h('p', { class: 'q-text' }, h('b', { class: 'q-num' }, `${i + 1}`), it.q),
          h(
            'div',
            { class: 'tf-opts', role: 'radiogroup', 'aria-label': `Câu ${i + 1}` },
            keys.map((k) =>
              h(
                'button',
                {
                  type: 'button',
                  role: 'radio',
                  class: `tf ${checked && k === it.answer ? 'is-answer' : ''} ${checked && state[i] === k && k !== it.answer ? 'is-wrong' : ''}`,
                  'aria-checked': String(state[i] === k),
                  disabled: checked || null,
                  onclick: () => set(i, k),
                },
                h('b', null, TF_LABELS[k][0]),
                vi ? h('small', null, TF_LABELS[k][1]) : null,
              ),
            ),
          ),
          feedback(lastGrade?.results[i], it.explain, lastGrade && !lastGrade.results[i] ? h('p', null, h('b', null, 'Đáp án: '), `${TF_LABELS[it.answer][0]} (${TF_LABELS[it.answer][1]})`) : null),
        ),
      ),
    );
  }

  function drawMulti() {
    put(body, 
      ...ex.items.map((it, i) => {
        const picked = new Set(state[i] || []);
        return h(
          'div',
          { class: itemCls(i) },
          h('p', { class: 'q-text' }, h('b', { class: 'q-num' }, `${i + 1}`), it.q),
          h(
            'div',
            { class: 'checks', role: 'group', 'aria-label': `Câu ${i + 1}` },
            it.options.map((o, k) => {
              const isAns = it.answers.includes(k);
              const cls = checked ? (isAns ? 'is-answer' : picked.has(k) ? 'is-wrong' : '') : '';
              return h(
                'label',
                { class: `check-row ${cls}` },
                h('input', {
                  type: 'checkbox',
                  class: 'check-input',
                  checked: picked.has(k) || null,
                  disabled: checked || null,
                  onchange: (e) => {
                    const next = new Set(state[i] || []);
                    if (e.target.checked) next.add(k);
                    else next.delete(k);
                    set(i, [...next].sort((a, b) => a - b));
                  },
                }),
                h('span', { class: 'box', 'aria-hidden': 'true' }, icon('check', 14)),
                h('span', null, o),
              );
            }),
          ),
          feedback(lastGrade?.results[i], it.explain, lastGrade && !lastGrade.results[i] ? h('p', null, h('b', null, 'Đáp án đúng: '), it.answers.map((k) => it.options[k]).join(', ')) : null),
        );
      }),
    );
  }

  // chỗ trống có khung từ: chọn ô rồi bấm từ; không có khung từ: gõ
  let active = 0;
  function bankBar(bank, used) {
    return h(
      'div',
      { class: 'bank', role: 'group', 'aria-label': 'Khung từ gợi ý' },
      h('span', { class: 'bank-label' }, 'Word box'),
      bank.map((w) =>
        h(
          'button',
          {
            type: 'button',
            class: `chip ${used.has(w) ? 'used' : ''}`,
            disabled: checked || null,
            onclick: () => {
              const n = slotsCount();
              let target = state[active] ? -1 : active;
              if (target < 0) target = [...Array(n).keys()].find((k) => !state[k]) ?? active;
              state[target] = w;
              const nextEmpty = [...Array(n).keys()].find((k) => !state[k]);
              active = nextEmpty ?? target;
              save();
              draw();
            },
          },
          w,
        ),
      ),
    );
  }
  const slotsCount = () => (ex.type === 'label' ? ex.points.length : ex.items.length);

  function blankSlot(i) {
    if (!ex.bank) {
      const input = h('input', {
        type: 'text',
        class: `blank-input ${checked ? (lastGrade?.results[i] ? 'is-answer' : 'is-wrong') : ''}`,
        value: state[i] || '',
        disabled: checked || null,
        autocomplete: 'off',
        autocapitalize: 'none',
        spellcheck: 'false',
        'aria-label': `Chỗ trống ${i + 1}`,
      });
      input.addEventListener('input', () => {
        state[i] = input.value;
        save();
      });
      return input;
    }
    return h(
      'button',
      {
        type: 'button',
        class: `blank ${state[i] ? 'filled' : ''} ${!checked && i === active ? 'active' : ''} ${checked ? (lastGrade?.results[i] ? 'is-answer' : 'is-wrong') : ''}`,
        disabled: checked || null,
        'aria-label': state[i] ? `Chỗ trống ${i + 1}: ${state[i]}. Bấm để xóa` : `Chỗ trống ${i + 1}`,
        onclick: () => {
          if (state[i]) state[i] = '';
          active = i;
          save();
          draw();
        },
      },
      state[i] || ' ',
    );
  }

  function drawGap() {
    const used = new Set(state.filter(Boolean));
    put(body, 
      ex.bank ? bankBar(ex.bank, used) : null,
      ...ex.items.map((it, i) => {
        const [a, slot, b] = splitGap(it.q, blankSlot(i));
        return h('div', { class: itemCls(i) }, h('p', { class: 'q-text gap-text' }, h('b', { class: 'q-num' }, `${i + 1}`), a, slot, b), feedback(lastGrade?.results[i], it.explain, lastGrade && !lastGrade.results[i] ? h('p', null, h('b', null, 'Đáp án: '), it.answer.join(' / ')) : null));
      }),
    );
  }

  function drawLabel() {
    const used = new Set(state.filter(Boolean));
    const art = h('div', { class: 'label-art' });
    art.innerHTML = imageSvg(ex.image, ex.points.map((p) => p.n), ex.title);
    art.querySelectorAll('.lbl-mark').forEach((g) => {
      const i = ex.points.findIndex((p) => String(p.n) === g.dataset.n);
      if (checked && lastGrade) g.classList.add(lastGrade.results[i] ? 'ok' : 'no');
      else if (i === active) g.classList.add('active');
    });
    put(body, 
      ex.bank ? bankBar(ex.bank, used) : null,
      h(
        'div',
        { class: 'label-grid' },
        art,
        h(
          'ol',
          { class: 'label-list' },
          ex.points.map((p, i) => h('li', { class: itemCls(i) }, h('span', { class: 'lbl-n' }, p.n), blankSlot(i), checked && lastGrade && !lastGrade.results[i] ? h('span', { class: 'lbl-ans' }, p.answer) : null)),
        ),
      ),
      checked ? h('div', { class: 'fb-list' }, ex.points.map((p, i) => (lastGrade.results[i] ? null : h('p', { class: 'fb no small' }, h('b', null, `${p.n}. ${p.answer}: `), p.explain)))) : null,
    );
  }

  // đánh số thứ tự: chạm lần lượt các bước theo đúng thứ tự
  const orderView = shuffle(
    (ex.items || []).map((_, i) => i),
    seed,
  );
  function drawOrder() {
    const next = Math.max(0, ...state.filter(Boolean)) + 1;
    put(body, 
      h('p', { class: 'hint' }, 'Chạm lần lượt từng bước theo đúng thứ tự. Chạm lại để bỏ số.'),
      h(
        'div',
        { class: 'order-list' },
        orderView.map((i) => {
          const it = ex.items[i];
          const n = state[i];
          return h(
            'button',
            {
              type: 'button',
              class: `order-row ${n ? 'set' : ''} ${checked ? (lastGrade?.results[i] ? 'is-answer' : 'is-wrong') : ''}`,
              disabled: checked || null,
              onclick: () => {
                if (state[i]) {
                  // bỏ số này, các số sau lùi lại
                  const removed = state[i];
                  state[i] = undefined;
                  state.forEach((v, k) => {
                    if (v > removed) state[k] = v - 1;
                  });
                } else state[i] = next;
                save();
                draw();
              },
            },
            h('span', { class: 'order-box' }, n || ''),
            h('span', { class: 'order-text' }, it.text),
            checked && !lastGrade?.results[i] ? h('span', { class: 'order-ans' }, `→ ${i + 1}`) : null,
          );
        }),
      ),
      checked ? h('div', { class: 'fb-list' }, ex.items.map((it, i) => (lastGrade.results[i] ? null : h('p', { class: 'fb no small' }, h('b', null, `Bước ${i + 1}: `), it.explain)))) : null,
    );
  }

  const rightOptions = shuffle(
    (ex.pairs || []).map((p) => p.right),
    seed + 7,
  );
  function drawMatch() {
    put(body, 
      ...ex.pairs.map((p, i) => {
        const sel = h(
          'select',
          { class: `match-select ${checked ? (lastGrade?.results[i] ? 'is-answer' : 'is-wrong') : ''}`, disabled: checked || null, 'aria-label': `Nối với ${p.left}` },
          h('option', { value: '' }, 'Chọn…'),
          rightOptions.map((r) => h('option', { value: r, selected: state[i] === r || null }, r)),
        );
        sel.addEventListener('change', () => {
          state[i] = sel.value;
          save();
          draw();
        });
        return h('div', { class: `${itemCls(i)} match-row` }, h('span', { class: 'match-left' }, h('b', { class: 'q-num' }, `${i + 1}`), p.left), icon('next', 18), sel, feedback(lastGrade?.results[i], p.explain, lastGrade && !lastGrade.results[i] ? h('p', null, h('b', null, 'Đáp án: '), p.right) : null));
      }),
    );
  }

  function drawDictation() {
    put(body, 
      ...ex.items.map((it, i) => {
        const input = h('textarea', { class: `dict-input ${checked ? (lastGrade?.results[i] ? 'is-answer' : 'is-wrong') : ''}`, rows: 2, disabled: checked || null, spellcheck: 'false', autocapitalize: 'sentences', 'aria-label': `Câu ${i + 1}: gõ câu bạn nghe được` });
        input.value = state[i] || '';
        input.addEventListener('input', () => {
          state[i] = input.value;
          save();
        });
        let diff = null;
        if (checked && lastGrade && !lastGrade.results[i]) {
          const d = wordDiff(it.text, state[i] || '');
          diff = h('p', { class: 'diff' }, h('b', null, 'Câu đúng: '), d.words.map((w) => [h('span', { class: w.ok ? 'w-ok' : 'w-miss' }, w.w), ' ']), d.extra.length ? h('small', null, ` (thừa: ${d.extra.join(', ')})`) : null);
        }
        return h(
          'div',
          { class: `${itemCls(i)} dict-row` },
          h('div', { class: 'dict-head' }, h('b', { class: 'q-num' }, `${i + 1}`), h('button', { type: 'button', class: 'btn btn-soft btn-sm', onclick: () => opts.onSay?.(it.text, 0.85) }, icon('sound', 18), h('span', null, 'Nghe')), h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => opts.onSay?.(it.text, 0.65) }, h('span', null, 'Nghe chậm'))),
          input,
          feedback(lastGrade?.results[i], checked && lastGrade?.results[i] ? it.text : it.explain, diff),
        );
      }),
    );
  }

  const DRAW = { choice: drawChoice, pick: drawPick, truefalse: drawTrueFalse, multi: drawMulti, gap: drawGap, label: drawLabel, order: drawOrder, match: drawMatch, dictation: drawDictation };

  function draw() {
    lastGrade = checked ? gradeExercise(ex, state) : null;
    DRAW[ex.type]();
    if (checked) {
      scoreEl.textContent = `Đúng ${lastGrade.correct}/${lastGrade.total}`;
      scoreEl.className = `ex-score ${lastGrade.correct === lastGrade.total ? 'full' : ''}`;
      put(footer, scoreEl, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: reset }, icon('rotate', 18), h('span', null, 'Làm lại bài này')));
    } else {
      put(footer, h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: check }, icon('check', 18), h('span', null, 'Kiểm tra')));
    }
  }

  function check() {
    checked = true;
    save();
    draw();
    opts.onChecked?.(lastGrade);
    return lastGrade;
  }

  function reset() {
    state.length = 0;
    checked = false;
    lastGrade = null;
    active = 0;
    save();
    draw();
    opts.onChecked?.(null);
  }

  draw();

  const el = h(
    'section',
    { class: `card ex ex-${ex.type}`, id: `ex-${index + 1}`, 'data-type': ex.type },
    h(
      'header',
      { class: 'ex-head' },
      h('span', { class: `ex-badge c${index % 6}` }, index + 1),
      h('div', { class: 'ex-titles' }, h('h3', null, ex.title), h('p', { class: 'ex-ins' }, ex.instruction), vi ? h('p', { class: 'ex-ins-vi' }, ex.instructionVi) : null),
      ex.listen ? h('button', { type: 'button', class: 'btn btn-soft btn-sm ex-listen', onclick: () => opts.onListen?.() }, icon('headphones', 18), h('span', null, 'Nghe bài')) : null,
    ),
    body,
    footer,
  );

  return {
    el,
    check,
    reset,
    get grade() {
      return checked ? gradeExercise(ex, state) : null;
    },
    get checked() {
      return checked;
    },
  };
}
