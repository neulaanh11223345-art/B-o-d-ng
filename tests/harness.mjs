// Chạy Code.gs trong Node với bộ giả lập Google Apps Script (src/demo/gas-shim.js) — dùng cho kiểm thử máy chủ.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

// now: giờ giả lập (ISO, UTC). seed: 'demo' = dữ liệu mẫu như bản xem thử; 'empty' = chỉ caiDatBanDau
export function loadBackend({ seed = 'empty', now = '2026-10-20T03:00:00Z' } = {}) {
  const ctx = vm.createContext({ console, TextEncoder, TextDecoder, atob, btoa, URL });
  vm.runInContext(rd('src/demo/gas-shim.js') + '\n' + rd('src/Code.gs') + '\n', ctx, { filename: 'Code.gs' });
  ctx.__tz.off = 7 * 3600000;
  setNow(ctx, now);
  if (seed === 'demo') {
    const extra = rd('src/demo/demo-extra.js').replace(/\n__tz\.off = [^\n]*/, '').replace(/\nreturn \{[\s\S]*$/, '\n');
    vm.runInContext(extra, ctx, { filename: 'demo-extra.js' });
  } else {
    vm.runInContext('caiDatBanDau();', ctx);
  }
  const call = (action, payload, token, opId) =>
    JSON.parse(JSON.stringify(ctx.xuLy({ action, payload: payload || {}, token, device: 'test-device', opId })));
  const login = (maNV, pin) => {
    const r = call('login', { maNV, pin });
    if (!r.ok) throw new Error('login ' + maNV + ': ' + r.code);
    return r.data.token;
  };
  return { ctx, call, login, setNow: (iso) => setNow(ctx, iso) };
}
function setNow(ctx, iso) { ctx.__clock.off = Date.parse(iso) - Date.now(); }
