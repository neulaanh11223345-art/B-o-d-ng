// Chạy thử app trong Chromium: mở từng bài, làm đúng hết qua giao diện, nộp bài phải được 100%;
// làm sai thì có lời giải; bản in; giao diện tối; màn hẹp không tràn ngang.
// Chạy: npm run e2e   (SCREENS=1 để lưu ảnh vào tests/screens/)
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { launch } from '../tools/browser.mjs';
import { startServer } from '../tools/serve.mjs';

const ROOT = new URL('../', import.meta.url);
const SHOTS = process.env.SCREENS ? new URL('tests/screens/', ROOT) : null;
if (SHOTS) await mkdir(SHOTS, { recursive: true });
const index = JSON.parse(await readFile(new URL('data/units/index.json', ROOT), 'utf8')).units;
const unitData = async (id) => JSON.parse(await readFile(new URL(`data/units/${id}.json`, ROOT), 'utf8'));

const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch();
let failed = 0;

async function step(name, fn) {
  const t = Date.now();
  try {
    await fn();
    console.log(`✓ ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    failed += 1;
    console.log(`✗ ${name}\n  ${e.stack || e}`);
  }
}

async function open({ width = 390, height = 844, scheme = 'light' } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: scheme, locale: 'vi-VN' });
  // giọng đọc giả: ghi lại câu được đọc, đọc xong ngay
  await context.addInitScript(() => {
    window.__said = [];
    const voices = [
      { lang: 'en-US', name: 'Samantha', localService: true },
      { lang: 'en-US', name: 'Alex', localService: true },
      { lang: 'en-GB', name: 'Daniel', localService: true },
      { lang: 'en-GB', name: 'Kate', localService: true },
    ];
    const synth = { getVoices: () => voices, cancel() {}, addEventListener() {}, speak(u) { window.__said.push({ text: u.text, lang: u.lang, voice: u.voice?.name, pitch: u.pitch }); setTimeout(() => u.onend?.(), 5); } };
    Object.defineProperty(window, 'speechSynthesis', { value: synth });
    window.SpeechSynthesisUtterance = function (t) {
      this.text = t;
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|ERR_NAME|ERR_CONNECTION/.test(m.text() + (m.location()?.url || ''))) errors.push(`console: ${m.text()}`);
  });
  return { context, page, errors };
}

async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: new URL(`${name}.png`, SHOTS).pathname });
}

async function go(page, hash) {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(300);
}

async function noSideScroll(page, where) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw, `${where}: trang bị cuộn ngang (${sw} > ${iw})`);
}

/** Làm đúng (hoặc cố ý sai ở câu đầu) một bài tập qua giao diện. */
async function answer(card, ex, { wrongFirst = false } = {}) {
  const q = (i) => card.locator('.q').nth(i);
  switch (ex.type) {
    case 'choice':
    case 'pick':
      for (const [i, it] of ex.items.entries()) {
        const k = wrongFirst && i === 0 ? (it.answer + 1) % it.options.length : it.answer;
        await q(i).locator('[role="radio"]').nth(k).click();
      }
      break;
    case 'truefalse': {
      const keys = ex.ng ? ['T', 'F', 'NG'] : ['T', 'F'];
      for (const [i, it] of ex.items.entries()) {
        const k = keys.indexOf(it.answer);
        await q(i).locator('[role="radio"]').nth(wrongFirst && i === 0 ? (k + 1) % keys.length : k).click();
      }
      break;
    }
    case 'multi':
      for (const [i, it] of ex.items.entries()) {
        const picks = wrongFirst && i === 0 ? it.answers.slice(1) : it.answers;
        for (const a of picks) await q(i).locator('.check-row').nth(a).click();
      }
      break;
    case 'gap':
      for (const [i, it] of ex.items.entries()) {
        if (ex.bank) {
          await card.locator('.blank').nth(i).click();
          let word = ex.bank.find((b) => it.answer.some((a) => a.toLowerCase() === b.toLowerCase()));
          if (wrongFirst && i === 0) word = ex.bank.find((b) => b !== word);
          await card.locator('.bank .chip', { hasText: new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
        } else {
          await card.locator('.blank-input').nth(i).fill(wrongFirst && i === 0 ? 'zzz' : it.answer[0]);
        }
      }
      break;
    case 'label':
      for (const [i, p] of ex.points.entries()) {
        await card.locator('.label-list .blank').nth(i).click();
        const word = wrongFirst && i === 0 ? ex.bank.find((b) => b !== p.answer) : p.answer;
        await card.locator('.bank .chip', { hasText: new RegExp(`^${word}$`) }).first().click();
      }
      break;
    case 'order': {
      const seq = ex.items.map((_, i) => i);
      if (wrongFirst) [seq[0], seq[1]] = [seq[1], seq[0]];
      for (const i of seq) await card.locator('.order-row', { hasText: ex.items[i].text }).first().click();
      break;
    }
    case 'match':
      for (const [i, p] of ex.pairs.entries()) {
        const right = wrongFirst && i === 0 ? ex.pairs[1].right : p.right;
        await card.locator('.match-select').nth(i).selectOption(right);
      }
      break;
    case 'dictation':
      for (const [i, it] of ex.items.entries()) await card.locator('.dict-input').nth(i).fill(wrongFirst && i === 0 ? 'hello' : it.text);
      break;
    default:
      throw new Error(`dạng ${ex.type} chưa có trong kiểm thử`);
  }
}

const phone = await open();
const { page } = phone;

await step('trang chủ: có 4 cấp và đủ bài', async () => {
  await page.goto(BASE);
  await page.waitForSelector('.unit-card');
  assert.match(await page.title(), /Sky English/);
  for (const lv of ['A1', 'A2', 'B1', 'B2']) {
    await page.getByRole('radio', { name: new RegExp(`^${lv}`) }).click();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.unit-card').count(), index.filter((u) => u.level === lv).length, `cấp ${lv}`);
  }
  await page.getByRole('radio', { name: /^A1/ }).click();
  await noSideScroll(page, 'trang chủ');
  await shot(page, '01-home');
});

await step('nghe: đọc cả bài theo đúng thứ tự, mỗi người nói một giọng; hiện lời thoại', async () => {
  const u = await unitData('a1-01');
  await go(page, '#/unit/a1-01?tab=listen');
  await page.waitForSelector('.pl-play');
  await page.evaluate(() => (window.__said = []));
  await page.click('.pl-play');
  await page.waitForFunction((n) => window.__said.length >= n, u.listening.lines.length, { timeout: 15000 });
  const said = await page.evaluate(() => window.__said);
  assert.deepEqual(said.map((s) => s.text), u.listening.lines.map((l) => l.en));
  const kinds = new Map(u.listening.speakers.map((s) => [s.id, s.voice]));
  const male = u.listening.lines.findIndex((l) => kinds.get(l.s) === 'male');
  const child = u.listening.lines.findIndex((l) => kinds.get(l.s) === 'child');
  if (male >= 0) assert.equal(said[male].voice, 'Alex', 'người nói nam chưa dùng giọng nam');
  if (child >= 0) assert.ok(said[child].pitch > 1.2, 'giọng trẻ em chưa cao hơn');
  await page.getByRole('button', { name: 'Hiện lời thoại' }).click();
  assert.equal(await page.locator('.pl-line').count(), u.listening.lines.length);
  assert.ok(!(await page.locator('.unit-body').innerText()).includes('null'), 'có chữ "null" trên màn nghe');
  await noSideScroll(page, 'nghe');
  await shot(page, '02-listen');
  await page.getByRole('radio', { name: /Từ vựng/ }).click();
  await page.waitForSelector('.vocab');
  assert.equal(await page.locator('.vocab').count(), u.vocab.length);
});

for (const meta of index) {
  await step(`bài ${meta.id} (${meta.title}): làm đúng hết qua giao diện, nộp bài được 100%`, async () => {
    const u = await unitData(meta.id);
    await go(page, `#/unit/${meta.id}?tab=work`);
    await page.waitForSelector('.ex');
    const cards = page.locator('.ex');
    assert.equal(await cards.count(), u.exercises.length);
    for (const [i, ex] of u.exercises.entries()) await answer(cards.nth(i), ex);
    await page.getByRole('button', { name: 'Nộp cả bài' }).click();
    await page.waitForSelector('.result-card');
    const total = u.exercises.reduce((n, x) => n + (x.items || x.pairs || x.points).length, 0);
    assert.match(await page.locator('.result-score').innerText(), new RegExp(`${total}/${total}`));
    assert.equal(await page.locator('.result-card .stars .on').count(), 3);
    assert.ok(!(await page.locator('.unit-body').innerText()).includes('null'), 'có chữ "null" trên phiếu bài tập');
    await noSideScroll(page, meta.id);
    if (meta.id === 'a1-01') await shot(page, '03-result');
  });
}

await step('làm sai thì chấm sai, có lời giải và đáp án; làm lại cả bài xóa câu trả lời', async () => {
  const u = await unitData('a1-02');
  await go(page, '#/unit/a1-02?tab=work');
  await page.getByRole('button', { name: 'Làm lại cả bài' }).click();
  await page.waitForTimeout(300);
  const cards = page.locator('.ex');
  for (const [i, ex] of u.exercises.entries()) await answer(cards.nth(i), ex, { wrongFirst: true });
  await shot(page, '04-work-answering');
  await page.getByRole('button', { name: 'Nộp cả bài' }).click();
  await page.waitForSelector('.result-card');
  const total = u.exercises.reduce((n, x) => n + (x.items || x.pairs || x.points).length, 0);
  const got = Number((await page.locator('.result-score b').innerText()).split('/')[0]);
  assert.ok(got < total && got >= total - u.exercises.length * 2, `điểm ${got}/${total} không hợp lý`);
  assert.ok((await page.locator('.fb.no').count()) >= u.exercises.length - 1, 'thiếu lời giải cho câu sai');
  await page.locator('.ex').first().scrollIntoViewIfNeeded();
  await shot(page, '05-work-feedback');
  // điểm cao nhất vẫn giữ 100% từ lần trước
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem('skyenglish:v1')).units['a1-02'].best);
  assert.equal(best, 1);
});

await step('bài đang làm dở được giữ khi thoát ra vào lại', async () => {
  const u = await unitData('a2-01');
  await go(page, '#/unit/a2-01?tab=work');
  await page.getByRole('button', { name: 'Làm lại cả bài' }).click();
  await page.waitForTimeout(200);
  const first = page.locator('.ex').first();
  await answer(first, u.exercises[0]);
  await page.waitForTimeout(400);
  await go(page, '#/');
  await go(page, '#/unit/a2-01?tab=work');
  await page.waitForSelector('.ex');
  await page.locator('.ex').first().getByRole('button', { name: 'Kiểm tra' }).click();
  const n = (u.exercises[0].items || u.exercises[0].pairs || u.exercises[0].points).length;
  assert.equal(await page.locator('.ex').first().locator('.ex-score').innerText(), `Đúng ${n}/${n}`);
});

await step('nghe chép và nút Nghe bài trong phiếu đọc đúng câu', async () => {
  const u = await unitData('b1-01');
  const di = u.exercises.findIndex((x) => x.type === 'dictation');
  await go(page, '#/unit/b1-01?tab=work');
  await page.evaluate(() => (window.__said = []));
  await page.locator('.ex').nth(di).getByRole('button', { name: 'Nghe', exact: true }).first().click();
  await page.waitForFunction(() => window.__said.length > 0);
  assert.equal((await page.evaluate(() => window.__said[0].text)), u.exercises[di].items[0].text);
  const li = u.exercises.findIndex((x) => x.listen);
  await page.locator('.ex').nth(li).getByRole('button', { name: 'Nghe bài' }).click();
  await page.waitForSelector('.dock:not([hidden])');
  await shot(page, '06-dock');
});

await step('bản in: phiếu đủ bài tập, bật đáp án và lời thoại', async () => {
  const u = await unitData('a1-01');
  await go(page, '#/print/a1-01');
  await page.waitForSelector('.paper');
  assert.equal(await page.locator('.p-ex').count(), u.exercises.length);
  await page.getByText('Kèm đáp án').click();
  await page.getByText('Kèm lời thoại').click();
  await page.waitForSelector('.p-key');
  assert.ok((await page.locator('.p-script p').count()) === u.listening.lines.length);
  await noSideScroll(page, 'bản in');
  await shot(page, '07-print');
});

await step('cài đặt: đổi Anh-Anh thì đọc giọng Anh', async () => {
  await go(page, '#/settings');
  await page.evaluate(() => (window.__said = []));
  await page.getByRole('radio', { name: 'Anh-Anh' }).click();
  await page.waitForFunction(() => window.__said.length > 0);
  const s = await page.evaluate(() => window.__said.at(-1));
  assert.equal(s.lang, 'en-GB');
  assert.equal(s.voice, 'Kate');
  await shot(page, '08-settings');
});

await step('không có lỗi JavaScript trên điện thoại', async () => {
  assert.deepEqual(phone.errors, []);
});

await step('chạy offline sau lần mở đầu', async () => {
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('.unit-card');
  await phone.context.setOffline(true);
  await page.reload();
  await page.waitForSelector('.unit-card', { timeout: 8000 });
  await go(page, '#/unit/a1-01?tab=work');
  await page.waitForSelector('.ex', { timeout: 8000 });
  await phone.context.setOffline(false);
});
await phone.context.close();

const dark = await open({ scheme: 'dark' });
await step('giao diện tối', async () => {
  await dark.page.goto(`${BASE}#/unit/a1-02?tab=work`);
  await dark.page.waitForSelector('.ex');
  assert.equal(await dark.page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(11, 18, 32)');
  await shot(dark.page, '09-dark');
  assert.deepEqual(dark.errors, []);
});
await dark.context.close();

const narrow = await open({ width: 340, height: 720 });
await step('màn 340px không tràn ngang', async () => {
  await narrow.page.goto(BASE);
  await narrow.page.waitForSelector('.unit-card');
  for (const u of index) {
    await go(narrow.page, `#/unit/${u.id}?tab=work`);
    await narrow.page.waitForSelector('.ex');
    await noSideScroll(narrow.page, u.id);
  }
  for (const h of ['#/', '#/settings', '#/print/b2-02', '#/unit/b2-02?tab=listen', '#/unit/b2-02?tab=vocab']) {
    await go(narrow.page, h);
    await narrow.page.waitForTimeout(300);
    await noSideScroll(narrow.page, h);
  }
  assert.deepEqual(narrow.errors, []);
});
await narrow.context.close();

const desk = await open({ width: 1280, height: 860 });
await step('màn hình rộng', async () => {
  await desk.page.goto(BASE);
  await desk.page.waitForSelector('.unit-card');
  await shot(desk.page, '10-desktop-home');
  await go(desk.page, '#/unit/a1-01?tab=work');
  await desk.page.waitForSelector('.ex');
  await shot(desk.page, '11-desktop-work');
  assert.deepEqual(desk.errors, []);
});
await desk.context.close();

await browser.close();
server.close();
console.log(failed ? `\n${failed} bước lỗi` : '\nTất cả các bước đều qua');
process.exit(failed ? 1 : 0);
