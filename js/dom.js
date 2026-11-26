// Tiện ích dựng DOM, biểu tượng và vài thành phần giao diện dùng chung.

/**
 * h('button', {class: 'btn', onclick: fn}, 'Nhãn', child)
 * Thuộc tính bắt đầu bằng "on" được gắn làm sự kiện; null/false bị bỏ qua.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  append(el, children);
  return el;
}

/** Thay toàn bộ nội dung của el (bỏ qua null/false, trải mảng). */
export function put(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  back: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  next: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  prev: '<path d="M18 5v14l-9-7z" fill="currentColor"/><path d="M6 5v14"/>',
  skip: '<path d="M6 5v14l9-7z" fill="currentColor"/><path d="M18 5v14"/>',
  sound: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.8"/>',
  headphones: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/><path d="M3 15a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.9 1 6.7 2.7L21 8"/><path d="M21 3v5h-5"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6a2 2 0 0 1-.9.5l-2.9.8.8-2.9a2 2 0 0 1 .5-.8z"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  translate: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
};

/** Biểu tượng nét mảnh (aria-hidden). */
export function icon(name, size = 22) {
  const span = document.createElement('span');
  span.className = 'ic';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${ICONS[name] || ''}</svg>`;
  return span;
}

/** Nút hoặc liên kết có biểu tượng. */
export function button(label, { icon: iconName, onclick, href, variant = 'primary', size, ariaLabel, cls = '', disabled } = {}) {
  const props = { class: `btn btn-${variant} ${size ? `btn-${size}` : ''} ${cls}`.trim(), 'aria-label': ariaLabel || null, disabled: disabled || null };
  const kids = [iconName ? icon(iconName, size === 'sm' ? 18 : 20) : null, label ? h('span', null, label) : null];
  if (href) return h('a', { ...props, href }, kids);
  return h('button', { ...props, type: 'button', onclick }, kids);
}

/** Nhóm nút chọn một (segmented control). */
export function segmented(options, value, onchange, label) {
  const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map(([val, text]) =>
    h(
      'button',
      {
        type: 'button',
        class: 'seg-btn',
        role: 'radio',
        'aria-checked': String(val === value),
        onclick: () => {
          buttons.forEach((b, i) => b.setAttribute('aria-checked', String(options[i][0] === val)));
          onchange(val);
        },
      },
      text,
    ),
  );
  el.append(...buttons);
  return el;
}

/** Công tắc bật/tắt có nhãn. */
export function toggle(label, checked, onchange, desc) {
  const input = h('input', { type: 'checkbox', class: 'switch-input', role: 'switch' });
  input.checked = Boolean(checked);
  input.addEventListener('change', () => onchange(input.checked));
  return h('label', { class: 'switch-row' }, h('span', { class: 'switch-text' }, h('span', null, label), desc ? h('small', null, desc) : null), input, h('span', { class: 'switch', 'aria-hidden': 'true' }));
}

let toastTimer = null;
export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/** Xáo trộn có hạt giống (để mỗi lần mở cùng một bài thứ tự giống nhau, làm lại thì khác). */
export function shuffle(list, seed = Math.random() * 1e9) {
  const a = [...list];
  let s = Math.floor(seed) % 2147483647 || 1;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#2563eb', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  for (let i = 0; i < 40; i++) {
    box.append(h('i', { style: { left: `${Math.random() * 100}%`, background: colors[i % colors.length], animationDelay: `${Math.random() * 0.4}s`, animationDuration: `${1.2 + Math.random() * 0.9}s` } }));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 2600);
}
