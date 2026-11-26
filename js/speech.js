// Đọc tiếng Anh bằng giọng có sẵn của máy (Web Speech API).
// Mỗi người nói trong bài nghe một giọng: nữ, nam, trẻ em (giọng nữ, cao hơn).

const FEMALE = /female|woman|samantha|victoria|karen|moira|tessa|serena|kate|fiona|susan|zira|hazel|libby|sonia|jenny|aria|emma|ava|allison|nicky|joanna|salli|kimberly|amy|google us english|martha|catherine|veena/i;
const MALE = /\bmale\b|daniel|alex|fred|tom|oliver|arthur|george|ryan|guy|david|mark|james|rishi|aaron|matthew|justin|brian|thomas|gordon|lee|reed|eddy|rocko/i;

let accent = 'en-US';
let voices = [];
let listed = false;

function refresh() {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const all = synth.getVoices();
  if (all.length) listed = true;
  voices = all.filter((v) => /^en([-_]|$)/i.test(v.lang));
}

export function initSpeech() {
  if (!('speechSynthesis' in window)) return;
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

export function setAccent(a) {
  accent = a === 'en-GB' ? 'en-GB' : 'en-US';
}

export function canSpeak() {
  return 'speechSynthesis' in window;
}

/** Máy có giọng tiếng Anh không. Trình duyệt chưa liệt kê giọng xong thì coi như có. */
export function hasEnglishVoice() {
  if (!canSpeak()) return false;
  if (!voices.length) refresh();
  return voices.length > 0 || !listed;
}

const sameAccent = (v) => v.lang.replace('_', '-').toLowerCase() === accent.toLowerCase();
const quality = (v) => (/natural|enhanced|premium|neural|online/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);

/** Chọn giọng cho một kiểu người nói, ưu tiên đúng giọng Anh-Mỹ/Anh-Anh đã chọn. */
export function pickVoice(kind = 'female') {
  if (!voices.length) refresh();
  const pool = voices.filter(sameAccent).length ? voices.filter(sameAccent) : voices;
  const want = kind === 'male' ? MALE : FEMALE;
  const avoid = kind === 'male' ? FEMALE : MALE;
  const best = (list) => [...list].sort((a, b) => quality(b) - quality(a))[0] || null;
  return best(pool.filter((v) => want.test(v.name) && !avoid.test(v.name))) || best(pool.filter((v) => !avoid.test(v.name))) || best(pool);
}

/** Cao độ theo kiểu người nói; nếu máy chỉ có một giọng thì nhờ cao độ để phân biệt. */
function pitchFor(kind, voice) {
  if (kind === 'child') return 1.35;
  if (kind === 'male') return voice && MALE.test(voice.name) ? 1 : 0.75;
  return voice && FEMALE.test(voice.name) ? 1 : 1.15;
}

let token = 0;

/**
 * Đọc một câu. Trả về Promise kết thúc khi đọc xong, bị dừng hoặc lỗi.
 * kind: 'female' | 'male' | 'child'; rate: tốc độ (1 là bình thường).
 */
export function say(text, { kind = 'female', rate = 0.9 } = {}) {
  return new Promise((resolve) => {
    if (!canSpeak() || !text) return resolve(false);
    const my = ++token;
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(kind);
      u.lang = accent;
      if (voice) u.voice = voice;
      u.pitch = pitchFor(kind, voice);
      u.rate = kind === 'child' ? rate * 1.05 : rate;
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        resolve(ok && my === token);
      };
      u.onend = () => finish(true);
      u.onerror = () => finish(false);
      synth.speak(u);
      // một số trình duyệt không gọi onend
      setTimeout(() => finish(true), Math.max(5000, (text.length * 110) / rate));
    } catch {
      resolve(false);
    }
  });
}

export function stopSpeaking() {
  token += 1;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* bỏ qua */
  }
}
