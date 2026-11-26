import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { checkUnit } from '../tools/check_units.mjs';
import { gradeExercise, isCorrect, normText, stars, wordDiff } from '../js/grade.js';

test('chuẩn hóa câu gõ tay: hoa thường, dấu câu, dấu nháy, khoảng trắng', () => {
  assert.equal(normText('  Hello,   World! '), 'hello world');
  assert.equal(normText('I don’t know.'), "i don't know");
  assert.equal(normText("'quoted' word"), 'quoted word');
  assert.equal(normText('eight-fifty'), 'eight-fifty');
});

test('chấm từng dạng', () => {
  assert.equal(isCorrect('choice', { answer: 2 }, 2), true);
  assert.equal(isCorrect('choice', { answer: 2 }, 0), false);
  assert.equal(isCorrect('choice', { answer: 0 }, undefined), false);
  assert.equal(isCorrect('truefalse', { answer: 'NG' }, 'NG'), true);
  assert.equal(isCorrect('multi', { answers: [0, 3] }, [3, 0]), true);
  assert.equal(isCorrect('multi', { answers: [0, 3] }, [0]), false);
  assert.equal(isCorrect('multi', { answers: [0, 3] }, [0, 1, 3]), false);
  assert.equal(isCorrect('gap', { answer: ['14th', 'fourteenth'] }, ' Fourteenth '), true);
  assert.equal(isCorrect('gap', { answer: ['see'] }, 'sea'), false);
  assert.equal(isCorrect('label', { answer: 'eyebrows' }, 'Eyebrows'), true);
  assert.equal(isCorrect('match', { right: 'see' }, 'see'), true);
  assert.equal(isCorrect('dictation', { text: 'My knees help me run.' }, 'my knees help me run'), true);
});

test('chấm bài đánh số thứ tự và tính tổng', () => {
  const ex = { type: 'order', items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] };
  assert.deepEqual(gradeExercise(ex, [1, 2, 3]), { results: [true, true, true], correct: 3, total: 3 });
  assert.deepEqual(gradeExercise(ex, [2, 1, 3]).correct, 1);
  assert.deepEqual(gradeExercise(ex, []).correct, 0);
});

test('số sao theo điểm', () => {
  assert.equal(stars(1), 3);
  assert.equal(stars(0.9), 3);
  assert.equal(stars(0.75), 2);
  assert.equal(stars(0.5), 1);
  assert.equal(stars(0.2), 0);
});

test('so từng từ câu nghe chép', () => {
  const d = wordDiff('My knees help me run', 'my knee help run fast');
  assert.deepEqual(
    d.words.map((w) => w.ok),
    [true, false, true, false, true],
  );
  assert.ok(d.extra.includes('knee') && d.extra.includes('fast'));
});

test('mọi bài học đúng định dạng và đáp án khớp chính bài (chấm đáp án mẫu được 100%)', async () => {
  const dir = new URL('../data/units/', import.meta.url);
  const files = (await readdir(dir)).filter((f) => /^(a1|a2|b1|b2)-\d\d\.json$/.test(f));
  assert.ok(files.length >= 12, `mới có ${files.length} bài`);
  for (const f of files) {
    const u = JSON.parse(await readFile(new URL(f, dir), 'utf8'));
    assert.deepEqual(checkUnit(u, f), []);
    for (const ex of u.exercises) {
      let state;
      if (ex.type === 'order') state = ex.items.map((_, i) => i + 1);
      else if (ex.type === 'match') state = ex.pairs.map((p) => p.right);
      else if (ex.type === 'label') state = ex.points.map((p) => p.answer);
      else if (ex.type === 'gap') state = ex.items.map((it) => it.answer[0]);
      else if (ex.type === 'multi') state = ex.items.map((it) => it.answers);
      else if (ex.type === 'dictation') state = ex.items.map((it) => it.text);
      else state = ex.items.map((it) => it.answer);
      const g = gradeExercise(ex, state);
      assert.equal(g.correct, g.total, `${f} ${ex.type}: đáp án mẫu chấm chưa đủ điểm`);
    }
  }
});
