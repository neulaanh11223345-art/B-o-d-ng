// Lưu cài đặt và kết quả làm bài trong trình duyệt (localStorage).

const KEY = 'skyenglish:v1';

export const DEFAULT_SETTINGS = {
  accent: 'en-US',
  rate: 0.9,
  // hiện bản dịch tiếng Việt của lời thoại và hướng dẫn
  vi: true,
  theme: 'system',
};

function empty() {
  return { version: 1, settings: { ...DEFAULT_SETTINGS }, units: {} };
}

function storage() {
  try {
    const t = '__sky_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
}

export function createStore(store = storage(), now = () => Date.now()) {
  let state;
  try {
    const raw = JSON.parse(store.getItem(KEY) || 'null');
    state = raw && typeof raw === 'object' ? { ...empty(), ...raw, settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) }, units: raw.units || {} } : empty();
  } catch {
    state = empty();
  }
  const listeners = new Set();
  let timer = null;
  const persist = () => {
    timer = null;
    try {
      store.setItem(KEY, JSON.stringify(state));
    } catch {
      /* bộ nhớ đầy hoặc bị chặn */
    }
  };
  const changed = () => {
    if (!timer) timer = setTimeout(persist, 150);
    for (const fn of listeners) fn(state);
  };
  const unit = (id) => (state.units[id] ||= { best: null, last: 0, attempts: 0, draft: {} });

  return {
    get state() {
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        persist();
      }
    },
    setSettings(patch) {
      state.settings = { ...state.settings, ...patch };
      changed();
    },
    unit(id) {
      return state.units[id] || { best: null, last: 0, attempts: 0, draft: {} };
    },
    /** Lưu câu trả lời đang làm của một bài tập (để thoát ra vào lại vẫn còn). */
    saveDraft(id, exIndex, draft) {
      unit(id).draft[exIndex] = draft;
      unit(id).last = now();
      changed();
    },
    clearDraft(id) {
      unit(id).draft = {};
      changed();
    },
    /** Ghi điểm khi nộp cả bài (score 0–1). Trả về true nếu là điểm cao nhất mới. */
    recordScore(id, score) {
      const u = unit(id);
      u.attempts += 1;
      u.last = now();
      u.lastScore = score;
      const better = u.best === null || score > u.best;
      if (better) u.best = score;
      changed();
      return better;
    },
    markListened(id) {
      unit(id).listened = now();
      changed();
    },
    reset() {
      const settings = state.settings;
      state = empty();
      state.settings = settings;
      changed();
      persist();
    },
  };
}
