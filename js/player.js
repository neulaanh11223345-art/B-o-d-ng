// Trình nghe bài: đọc lần lượt từng câu, mỗi người nói một giọng; tua câu trước/sau, đổi tốc độ, hiện lời thoại.
import { h, icon, put, segmented } from './dom.js';
import { say, stopSpeaking } from './speech.js';

export const RATES = [
  [0.7, 'Chậm'],
  [0.9, 'Vừa'],
  [1.05, 'Nhanh'],
];

/**
 * listening: {kind, title, context, speakers, lines}
 * opts: {store, compact, transcript (hiện lời thoại sẵn), onEnd}
 */
export function createPlayer(listening, opts) {
  const { store } = opts;
  const speakers = Object.fromEntries(listening.speakers.map((s, i) => [s.id, { ...s, i }]));
  let index = 0;
  let playing = false;
  let runId = 0;
  let showText = Boolean(opts.transcript);

  const counter = h('span', { class: 'pl-count', 'aria-live': 'polite' });
  const bar = h('div', { class: 'pl-bar', role: 'progressbar', 'aria-label': 'Tiến độ bài nghe', 'aria-valuemin': '0', 'aria-valuemax': String(listening.lines.length) }, h('span', { class: 'pl-fill' }));
  const playBtn = h('button', { type: 'button', class: 'pl-play', onclick: () => (playing ? pause() : play()) });
  const prevBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Câu trước', onclick: () => jump(index - 1) }, icon('prev', 20));
  const nextBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Câu sau', onclick: () => jump(index + 1) }, icon('skip', 20));
  const now = h('p', { class: 'pl-now' });
  const lines = h('ol', { class: 'pl-lines' });

  function speakerOf(line) {
    return speakers[line.s] || { name: line.s, voice: 'female', i: 0 };
  }

  function drawLines() {
    const vi = store.state.settings.vi;
    lines.hidden = !showText;
    if (!showText) return;
    put(lines, 
      ...listening.lines.map((line, i) => {
        const sp = speakerOf(line);
        return h(
          'li',
          { class: `pl-line sp${sp.i % 3} ${i === index && (playing || i > 0) ? 'current' : ''}` },
          h('button', { type: 'button', class: 'pl-line-btn', 'aria-label': `Nghe câu ${i + 1}`, onclick: () => playOne(i) }, icon('sound', 16)),
          h('div', null, listening.kind === 'dialogue' ? h('b', { class: 'pl-who' }, sp.name) : null, h('p', { class: 'pl-en', lang: 'en' }, line.en), vi ? h('p', { class: 'pl-vi' }, line.vi) : null),
        );
      }),
    );
  }

  function drawState() {
    const n = listening.lines.length;
    counter.textContent = `Câu ${Math.min(index + 1, n)}/${n}`;
    bar.firstChild.style.width = `${((playing ? index : Math.min(index, n)) / n) * 100}%`;
    bar.setAttribute('aria-valuenow', String(index));
    put(playBtn, icon(playing ? 'pause' : 'play', 26));
    playBtn.setAttribute('aria-label', playing ? 'Tạm dừng' : index > 0 && index < n ? 'Nghe tiếp' : 'Nghe bài');
    const line = listening.lines[Math.min(index, n - 1)];
    const sp = speakerOf(line);
    put(now, playing && listening.kind === 'dialogue' ? h('span', { class: `pl-speaking sp${sp.i % 3}` }, icon('sound', 14), sp.name) : null);
    lines.querySelectorAll('.pl-line').forEach((li, i) => li.classList.toggle('current', i === index && playing));
    lines.querySelector('.pl-line.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  async function play() {
    const my = ++runId;
    if (index >= listening.lines.length) index = 0;
    playing = true;
    drawState();
    while (index < listening.lines.length && my === runId) {
      const line = listening.lines[index];
      drawState();
      await say(line.en, { kind: speakerOf(line).voice, rate: store.state.settings.rate });
      if (my !== runId) return;
      await new Promise((r) => setTimeout(r, listening.kind === 'dialogue' ? 380 : 260));
      if (my !== runId) return;
      index += 1;
    }
    if (my !== runId) return;
    playing = false;
    drawState();
    opts.onEnd?.();
  }

  function pause() {
    runId += 1;
    playing = false;
    stopSpeaking();
    drawState();
  }

  function jump(i) {
    const wasPlaying = playing;
    pause();
    index = Math.max(0, Math.min(listening.lines.length - 1, i));
    drawState();
    if (wasPlaying) play();
  }

  async function playOne(i) {
    pause();
    index = i;
    drawState();
    const line = listening.lines[i];
    await say(line.en, { kind: speakerOf(line).voice, rate: store.state.settings.rate });
  }

  const textBtn = h('button', { type: 'button', class: 'chip chip-btn', 'aria-pressed': String(showText) });
  const drawTextBtn = () => {
    put(textBtn, icon('eye', 16), showText ? 'Ẩn lời thoại' : 'Hiện lời thoại');
    textBtn.setAttribute('aria-pressed', String(showText));
  };
  textBtn.addEventListener('click', () => {
    showText = !showText;
    drawTextBtn();
    drawLines();
  });
  drawTextBtn();

  const rateSeg = segmented(RATES, store.state.settings.rate, (v) => store.setSettings({ rate: v }), 'Tốc độ đọc');

  const controls = h('div', { class: 'pl-controls' }, prevBtn, playBtn, nextBtn, h('div', { class: 'pl-meta' }, counter, bar, now));
  const el = opts.compact
    ? h('div', { class: 'player compact' }, controls)
    : h('div', { class: 'player card' }, controls, h('div', { class: 'pl-tools' }, rateSeg, textBtn), lines);

  drawLines();
  drawState();

  return {
    el,
    play,
    pause,
    destroy: pause,
    showTranscript(on = true) {
      showText = on;
      drawTextBtn();
      drawLines();
    },
  };
}
