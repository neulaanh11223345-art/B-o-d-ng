// Kiểm tra các tệp bài học data/units/*.json theo CONTENT-SPEC.md, rồi viết lại data/units/index.json.
// Chạy: node tools/check_units.mjs   (thoát mã 1 nếu có lỗi)
import { readdir, readFile, writeFile } from 'node:fs/promises';

const DIR = new URL('../data/units/', import.meta.url);
const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const IMAGES = {
  face: { 1: 'eyebrows', 2: 'eyelashes', 3: 'eyes', 4: 'ears', 5: 'cheeks', 6: 'nose', 7: 'mouth', 8: 'tongue', 9: 'chin' },
  body: { 1: 'head', 2: 'neck', 3: 'shoulder', 4: 'arm', 5: 'elbow', 6: 'hand', 7: 'knee', 8: 'leg', 9: 'foot' },
};
const TYPES = ['choice', 'pick', 'truefalse', 'multi', 'gap', 'order', 'match', 'label', 'dictation'];

export function checkUnit(u, file = u?.id) {
  const errs = [];
  const err = (m) => errs.push(`${file}: ${m}`);
  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!/^(a1|a2|b1|b2)-\d\d$/.test(u.id)) err('id sai dạng');
  if (!LEVELS.includes(u.level)) err('level sai');
  if (u.id && u.level && !u.id.startsWith(u.level.toLowerCase())) err('id không khớp level');
  if (!Number.isInteger(u.order)) err('thiếu order');
  for (const k of ['icon', 'title', 'titleVi']) if (!str(u[k])) err(`thiếu ${k}`);
  if (!Array.isArray(u.goals) || u.goals.length < 1) err('thiếu goals');
  if (!Array.isArray(u.vocab) || u.vocab.length < 6) err('vocab cần ít nhất 6 từ');
  for (const [i, v] of (u.vocab || []).entries()) {
    if (!str(v.en) || !str(v.vi) || !str(v.ex)) err(`vocab ${i}: thiếu en/vi/ex`);
    if (v.ipa && !/^\/.+\/$/.test(v.ipa)) err(`vocab ${i}: ipa cần dạng /…/`);
  }
  const L = u.listening;
  if (!L || !['dialogue', 'monologue'].includes(L.kind)) err('listening.kind sai');
  else {
    if (!str(L.title) || !str(L.context)) err('listening thiếu title/context');
    const ids = new Set((L.speakers || []).map((s) => s.id));
    if (!ids.size) err('listening thiếu speakers');
    for (const s of L.speakers || []) if (!['female', 'male', 'child'].includes(s.voice) || !str(s.name)) err(`speaker ${s.id}: voice/name sai`);
    if (!Array.isArray(L.lines) || L.lines.length < 6) err('listening cần ít nhất 6 dòng');
    for (const [i, l] of (L.lines || []).entries()) {
      if (!ids.has(l.s)) err(`dòng ${i}: người nói "${l.s}" không có trong speakers`);
      if (!str(l.en) || !str(l.vi)) err(`dòng ${i}: thiếu en/vi`);
    }
  }
  if (!Array.isArray(u.exercises) || u.exercises.length < 4) err('cần ít nhất 4 bài tập');
  let listenCount = 0;
  for (const [i, x] of (u.exercises || []).entries()) {
    const at = `bài tập ${i + 1} (${x.type})`;
    if (!TYPES.includes(x.type)) {
      err(`${at}: dạng không hỗ trợ`);
      continue;
    }
    if (!str(x.title) || !str(x.instruction) || !str(x.instructionVi)) err(`${at}: thiếu title/instruction/instructionVi`);
    if (x.listen) listenCount += 1;
    const items = x.items || [];
    const needExplain = (it, j) => {
      if (!str(it.explain)) err(`${at} câu ${j + 1}: thiếu explain`);
    };
    switch (x.type) {
      case 'choice':
      case 'pick':
        items.forEach((it, j) => {
          needExplain(it, j);
          if (!str(it.q) || !Array.isArray(it.options)) err(`${at} câu ${j + 1}: thiếu q/options`);
          if (x.type === 'pick' && (it.options?.length !== 2 || !it.q?.includes('___'))) err(`${at} câu ${j + 1}: pick cần 2 lựa chọn và ___`);
          if (!Number.isInteger(it.answer) || it.answer < 0 || it.answer >= (it.options?.length || 0)) err(`${at} câu ${j + 1}: answer ngoài phạm vi`);
          if (new Set(it.options).size !== it.options?.length) err(`${at} câu ${j + 1}: lựa chọn trùng nhau`);
        });
        break;
      case 'truefalse':
        items.forEach((it, j) => {
          needExplain(it, j);
          const ok = x.ng ? ['T', 'F', 'NG'] : ['T', 'F'];
          if (!ok.includes(it.answer)) err(`${at} câu ${j + 1}: answer phải là ${ok.join('/')}`);
        });
        break;
      case 'multi':
        items.forEach((it, j) => {
          needExplain(it, j);
          const n = it.options?.length || 0;
          if (!Array.isArray(it.answers) || !it.answers.length || it.answers.some((a) => !Number.isInteger(a) || a < 0 || a >= n)) err(`${at} câu ${j + 1}: answers sai`);
        });
        break;
      case 'gap':
        items.forEach((it, j) => {
          needExplain(it, j);
          if ((it.q?.match(/___/g) || []).length !== 1) err(`${at} câu ${j + 1}: cần đúng một ___`);
          if (!Array.isArray(it.answer) || !it.answer.length) err(`${at} câu ${j + 1}: answer phải là mảng`);
          if (x.bank && !it.answer.some((a) => x.bank.some((b) => b.toLowerCase() === a.toLowerCase()))) err(`${at} câu ${j + 1}: đáp án không có trong bank`);
        });
        break;
      case 'order':
        if (items.length < 3) err(`${at}: cần ít nhất 3 bước`);
        items.forEach((it, j) => {
          needExplain(it, j);
          if (!str(it.text)) err(`${at} bước ${j + 1}: thiếu text`);
        });
        break;
      case 'match': {
        const pairs = x.pairs || [];
        if (pairs.length < 3) err(`${at}: cần ít nhất 3 cặp`);
        if (new Set(pairs.map((p) => p.right)).size !== pairs.length) err(`${at}: vế phải trùng nhau`);
        pairs.forEach((p, j) => {
          needExplain(p, j);
          if (!str(p.left) || !str(p.right)) err(`${at} cặp ${j + 1}: thiếu left/right`);
        });
        break;
      }
      case 'label': {
        const map = IMAGES[x.image];
        if (!map) {
          err(`${at}: hình "${x.image}" không có`);
          break;
        }
        (x.points || []).forEach((p, j) => {
          needExplain(p, j);
          if (map[p.n] !== p.answer) err(`${at} số ${p.n}: đáp án phải là "${map[p.n]}"`);
          if (x.bank && !x.bank.includes(p.answer)) err(`${at} số ${p.n}: đáp án không có trong bank`);
        });
        break;
      }
      case 'dictation':
        items.forEach((it, j) => {
          needExplain(it, j);
          if (!str(it.text) || /\d/.test(it.text)) err(`${at} câu ${j + 1}: thiếu text hoặc có chữ số`);
        });
        break;
    }
  }
  if (listenCount < 2) err('cần ít nhất 2 bài tập dựa vào bài nghe (listen: true)');
  return errs;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const files = (await readdir(DIR)).filter((f) => /^(a1|a2|b1|b2)-\d\d\.json$/.test(f)).sort();
  const errors = [];
  const index = [];
  for (const f of files) {
    let u;
    try {
      u = JSON.parse(await readFile(new URL(f, DIR), 'utf8'));
    } catch (e) {
      errors.push(`${f}: JSON hỏng (${e.message})`);
      continue;
    }
    if (`${u.id}.json` !== f) errors.push(`${f}: id trong tệp là ${u.id}`);
    errors.push(...checkUnit(u, f));
    index.push({ id: u.id, level: u.level, order: u.order, icon: u.icon, title: u.title, titleVi: u.titleVi, exercises: u.exercises.length, questions: u.exercises.reduce((n, x) => n + (x.items?.length || x.pairs?.length || x.points?.length || 0), 0) });
  }
  index.sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.order - b.order);
  if (errors.length) {
    console.log(errors.join('\n'));
    console.log(`\n${errors.length} lỗi trong ${files.length} bài`);
    process.exit(1);
  }
  await writeFile(new URL('index.json', DIR), `${JSON.stringify({ units: index }, null, 2)}\n`);
  console.log(`${files.length} bài hợp lệ, đã viết data/units/index.json`);
}
