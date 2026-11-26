// Mở Chromium cho Playwright: dùng CHROMIUM_PATH nếu có (máy chạy thử có sẵn Chromium riêng).
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export function launch() {
  const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch(exe ? { executablePath: exe } : {});
}
