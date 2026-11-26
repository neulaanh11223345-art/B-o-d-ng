// Chấm bài: các hàm thuần (không đụng tới DOM), dùng chung cho màn làm bài và kiểm thử.

/** Chuẩn hóa câu trả lời gõ tay: chữ thường, bỏ dấu câu, gộp khoảng trắng, thống nhất dấu nháy. */
export function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .replace(/(^|\s)'+|'+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Một câu (hoặc một chỗ trống, một số trên hình) đúng hay sai. answer: câu trả lời của người học. */
export function isCorrect(type, item, answer) {
  if (answer === undefined || answer === null || answer === '') return false;
  switch (type) {
    case 'choice':
    case 'pick':
      return answer === item.answer;
    case 'truefalse':
      return answer === item.answer;
    case 'multi': {
      const a = new Set(answer);
      return a.size === item.answers.length && item.answers.every((x) => a.has(x));
    }
    case 'gap':
      return item.answer.some((x) => normText(x) === normText(answer));
    case 'label':
      return normText(item.answer) === normText(answer);
    case 'match':
      return answer === item.right;
    case 'dictation':
      return normText(item.text) === normText(answer);
    default:
      return false;
  }
}

/**
 * Chấm một bài tập. state: câu trả lời theo từng câu (mảng, cùng thứ tự với items/pairs/points).
 * Với "order": state là mảng số thứ tự người học đặt cho từng bước (theo thứ tự đúng trong dữ liệu).
 * Trả về {results: [true/false…], correct, total}.
 */
export function gradeExercise(ex, state = []) {
  let results;
  if (ex.type === 'order') {
    results = ex.items.map((_, i) => state[i] === i + 1);
  } else if (ex.type === 'match') {
    results = ex.pairs.map((p, i) => isCorrect('match', p, state[i]));
  } else if (ex.type === 'label') {
    results = ex.points.map((p, i) => isCorrect('label', p, state[i]));
  } else {
    results = ex.items.map((it, i) => isCorrect(ex.type, it, state[i]));
  }
  const correct = results.filter(Boolean).length;
  return { results, correct, total: results.length };
}

export function questionCount(ex) {
  return (ex.items || ex.pairs || ex.points || []).length;
}

/** Số sao theo tỉ lệ đúng: từ 90% ba sao, 70% hai sao, 50% một sao. */
export function stars(score) {
  if (score >= 0.9) return 3;
  if (score >= 0.7) return 2;
  if (score >= 0.5) return 1;
  return 0;
}

/**
 * So từng từ câu nghe chép với câu gốc (dãy con chung dài nhất).
 * Trả về các từ của câu gốc kèm ok (người học viết đúng) để tô màu chỗ sai, và các từ thừa.
 */
export function wordDiff(expected, got) {
  const a = normText(expected).split(' ').filter(Boolean);
  const b = normText(got).split(' ').filter(Boolean);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const words = [];
  const extra = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      words.push({ w: a[i], ok: true });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      words.push({ w: a[i], ok: false });
      i++;
    } else {
      extra.push(b[j]);
      j++;
    }
  }
  while (i < a.length) words.push({ w: a[i++], ok: false });
  while (j < b.length) extra.push(b[j++]);
  return { words, extra };
}
