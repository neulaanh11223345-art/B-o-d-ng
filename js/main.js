// Khởi động app, điều hướng giữa các màn hình.
import { h, put } from './dom.js';
import { initSpeech, setAccent, stopSpeaking } from './speech.js';
import { createStore } from './store.js';

const routes = [
  { re: /^\/?$/, view: () => import('./views/home.js') },
  { re: /^\/unit\/([\w-]+)$/, view: () => import('./views/unit.js') },
  { re: /^\/print\/([\w-]+)$/, view: () => import('./views/print.js') },
  { re: /^\/settings$/, view: () => import('./views/settings.js') },
];

const store = createStore();
let current = null;
let token = 0;
let hostTheme = document.documentElement.getAttribute('data-theme');
let applied = hostTheme;

function parseHash() {
  let raw = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  if (!raw.startsWith('/')) raw = `/${raw}`;
  const [path, qs] = raw.split('?');
  return { path, query: new URLSearchParams(qs || '') };
}

export function navigate(hash, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', hash);
    route();
  } else if (location.hash === hash) route();
  else location.hash = hash;
}

function applyTheme() {
  const t = store.state.settings.theme;
  const want = t === 'system' ? hostTheme : t;
  applied = want;
  const root = document.documentElement;
  if (root.getAttribute('data-theme') !== want) {
    if (want) root.setAttribute('data-theme', want);
    else root.removeAttribute('data-theme');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
}

async function route() {
  const my = ++token;
  const { path, query } = parseHash();
  const found = routes.map((r) => [r, path.match(r.re)]).find(([, m]) => m);
  if (!found) return navigate('#/', { replace: true });
  const [r, m] = found;
  const mod = await r.view();
  if (my !== token) return;
  try {
    current?.destroy?.();
  } catch (e) {
    console.warn(e);
  }
  stopSpeaking();
  const result = mod.render({ store, params: m.slice(1), query, navigate });
  const main = document.querySelector('.main');
  put(main, result.el);
  document.body.classList.toggle('printing', Boolean(result.print));
  document.title = result.title ? `${result.title} · Sky English` : 'Sky English · Luyện nghe tiếng Anh';
  current = result;
  window.scrollTo(0, 0);
  result.mounted?.();
}

function boot() {
  applyTheme();
  setAccent(store.state.settings.accent);
  initSpeech();
  store.subscribe(() => {
    applyTheme();
    setAccent(store.state.settings.accent);
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  new MutationObserver(() => {
    const cur = document.documentElement.getAttribute('data-theme');
    if (cur === applied) return;
    hostTheme = cur;
    applyTheme();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.addEventListener('hashchange', () => route());
  window.addEventListener('pagehide', () => store.flush());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && store.flush());
  route();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    let had = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had) {
        had = true;
        return;
      }
      if (document.querySelector('.update-bar')) return;
      document.body.append(h('div', { class: 'update-bar', role: 'status' }, h('span', null, 'Đã có bản mới.'), h('button', { type: 'button', class: 'btn btn-primary btn-sm', onclick: () => location.reload() }, 'Tải lại')));
    });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
