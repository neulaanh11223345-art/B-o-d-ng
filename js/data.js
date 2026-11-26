// Nạp danh sách bài và từng bài học (data/units/).
let indexPromise = null;
const cache = new Map();

export const LEVELS = [
  { id: 'A1', name: 'A1 · Mới bắt đầu', short: 'Mới bắt đầu', desc: 'Câu ngắn, chủ đề gần gũi, hợp cả thiếu nhi.' },
  { id: 'A2', name: 'A2 · Sơ cấp', short: 'Sơ cấp', desc: 'Giao tiếp hằng ngày: mua sắm, thời gian, thời tiết.' },
  { id: 'B1', name: 'B1 · Trung cấp', short: 'Trung cấp', desc: 'Nghe điền thông tin, hội thoại dài hơn, đúng/sai/không có.' },
  { id: 'B2', name: 'B2 · Trung cao cấp', short: 'Trung cao cấp', desc: 'Ý chính, thái độ, ý kiến của người nói.' },
];

export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('data/units/index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Không tải được danh sách bài (${r.status})`);
        return r.json();
      })
      .then((d) => d.units);
    indexPromise.catch(() => (indexPromise = null));
  }
  return indexPromise;
}

export async function loadUnit(id) {
  if (!cache.has(id)) {
    const p = fetch(`data/units/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`Không tải được bài ${id} (${r.status})`);
      return r.json();
    });
    cache.set(id, p);
    p.catch(() => cache.delete(id));
  }
  return cache.get(id);
}

/** Bài kế tiếp trong danh sách (sang cấp sau khi hết cấp). */
export async function nextUnit(id) {
  const list = await loadIndex();
  const i = list.findIndex((u) => u.id === id);
  return i >= 0 ? list[i + 1] || null : null;
}
