// Hình vẽ cho bài "ghi tên vào hình" (label): khuôn mặt và cơ thể, có số chỉ vào từng bộ phận.
// Số và đáp án phải khớp với CONTENT-SPEC.md và tools/check_units.mjs.

const SKIN = '#ffd9b5';
const SKIN_LINE = '#e3a77a';

const FACE = {
  viewBox: '0 0 360 300',
  art: `
  <path d="M95 120 Q100 42 180 40 Q262 42 266 122 Q238 74 180 76 Q120 76 95 120Z" fill="#4b3a8c"/>
  <ellipse cx="88" cy="165" rx="15" ry="23" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="3"/>
  <ellipse cx="272" cy="165" rx="15" ry="23" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="3"/>
  <ellipse cx="180" cy="162" rx="92" ry="106" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="3"/>
  <path d="M100 118 Q112 70 180 68 Q250 70 262 118 Q236 86 180 86 Q126 86 100 118Z" fill="#4b3a8c"/>
  <path d="M130 118 Q148 107 166 117 M194 117 Q212 107 230 118" fill="none" stroke="#5a3d2b" stroke-width="5" stroke-linecap="round"/>
  <circle cx="148" cy="143" r="13" fill="#fff" stroke="#3b2a20" stroke-width="2.5"/>
  <circle cx="212" cy="143" r="13" fill="#fff" stroke="#3b2a20" stroke-width="2.5"/>
  <circle cx="150" cy="145" r="6" fill="#2a2140"/><circle cx="214" cy="145" r="6" fill="#2a2140"/>
  <path d="M138 132 l-4 -7 M148 129 v-8 M158 132 l4 -7 M202 132 l-4 -7 M212 129 v-8 M222 132 l4 -7" stroke="#3b2a20" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M180 150 L170 182 Q180 189 191 182" fill="none" stroke="${SKIN_LINE}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="128" cy="190" r="15" fill="#ff9aa8" opacity=".55"/><circle cx="232" cy="190" r="15" fill="#ff9aa8" opacity=".55"/>
  <ellipse cx="180" cy="222" rx="28" ry="17" fill="#8b1e2d"/>
  <ellipse cx="180" cy="231" rx="15" ry="7" fill="#f28da0"/>`,
  points: {
    1: { label: [330, 62], at: [214, 111] },
    2: { label: [30, 62], at: [148, 124] },
    3: { label: [330, 128], at: [224, 143] },
    4: { label: [30, 165], at: [75, 165] },
    5: { label: [30, 215], at: [122, 194] },
    6: { label: [330, 178], at: [190, 178] },
    7: { label: [330, 222], at: [207, 220] },
    8: { label: [330, 268], at: [192, 233] },
    9: { label: [30, 272], at: [170, 266] },
  },
};

const BODY = {
  viewBox: '0 0 360 420',
  art: `
  <g stroke="${SKIN}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M136 136 L106 200 L99 262" stroke-width="22"/>
    <path d="M224 136 L254 200 L261 262" stroke-width="22"/>
    <path d="M160 288 L158 346 L156 392" stroke-width="24"/>
    <path d="M200 288 L202 346 L204 392" stroke-width="24"/>
  </g>
  <circle cx="98" cy="272" r="13" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="2.5"/>
  <circle cx="262" cy="272" r="13" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="2.5"/>
  <ellipse cx="147" cy="402" rx="22" ry="10" fill="#334155"/><ellipse cx="214" cy="402" rx="22" ry="10" fill="#334155"/>
  <rect x="169" y="100" width="22" height="26" rx="6" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="2.5"/>
  <path d="M132 136 Q132 120 150 120 H210 Q228 120 228 136 V252 H132Z" fill="#3b82f6"/>
  <path d="M132 136 Q132 120 150 120 H158 V160 H132Z M228 136 Q228 120 210 120 H202 V160 H228Z" fill="#2563eb"/>
  <path d="M136 250 H224 L220 292 H184 L180 270 L176 292 H140Z" fill="#1e3a8a"/>
  <circle cx="180" cy="64" r="40" fill="${SKIN}" stroke="${SKIN_LINE}" stroke-width="3"/>
  <path d="M142 58 Q146 22 180 22 Q216 22 219 58 Q204 38 180 38 Q158 38 142 58Z" fill="#4b3a8c"/>
  <circle cx="166" cy="66" r="4.5" fill="#2a2140"/><circle cx="194" cy="66" r="4.5" fill="#2a2140"/>
  <path d="M168 82 Q180 91 192 82" fill="none" stroke="#8b1e2d" stroke-width="3" stroke-linecap="round"/>`,
  points: {
    1: { label: [30, 50], at: [146, 52] },
    2: { label: [330, 104], at: [192, 112] },
    3: { label: [30, 120], at: [136, 128] },
    4: { label: [330, 170], at: [244, 172] },
    5: { label: [30, 200], at: [104, 200] },
    6: { label: [30, 272], at: [86, 272] },
    7: { label: [30, 346], at: [154, 346] },
    8: { label: [330, 316], at: [206, 316] },
    9: { label: [330, 402], at: [236, 402] },
  },
};

export const IMAGES = { face: FACE, body: BODY };

/** SVG của hình, chỉ vẽ các số có trong bài (numbers). */
export function imageSvg(id, numbers, title) {
  const img = IMAGES[id];
  if (!img) return '';
  const marks = numbers
    .map((n) => {
      const p = img.points[n];
      if (!p) return '';
      const [lx, ly] = p.label;
      const [ax, ay] = p.at;
      return `<g class="lbl-mark" data-n="${n}"><line x1="${lx}" y1="${ly}" x2="${ax}" y2="${ay}"/><circle class="dot" cx="${ax}" cy="${ay}" r="4"/><circle class="num" cx="${lx}" cy="${ly}" r="15"/><text x="${lx}" y="${ly + 5}" text-anchor="middle">${n}</text></g>`;
    })
    .join('');
  return `<svg viewBox="${img.viewBox}" role="img" aria-label="${title || ''}">${img.art}${marks}</svg>`;
}
