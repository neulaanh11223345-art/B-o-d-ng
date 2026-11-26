// Dựng trang xem trước trên Claude (artifact): dist/artifact/index.html + danh sách tệp kèm theo.
// Chạy: node tools/build_artifact.mjs [--list]
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', ROOT), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .split('\n')
  .filter((l) => !/<meta charset|name="viewport"|name="theme-color"|apple-mobile-web-app|mobile-web-app-capable|rel="manifest"|rel="icon"|rel="apple-touch-icon"/.test(l))
  .join('\n')
  .replace('<title>Sky English</title>', '<title>Sky English</title>\n<meta name="claude:viewport-fit-sides" content="cover">');
const page = `${keep.trim()}\n<script>window.SKY_EMBED = true;</script>\n${body.trim()}\n`;
await mkdir(new URL('dist/artifact/', ROOT), { recursive: true });
await writeFile(new URL('dist/artifact/index.html', ROOT), page);

export async function files() {
  const list = ['css/app.css'];
  for (const dir of ['js', 'js/views', 'data/units']) for (const f of await readdir(new URL(`${dir}/`, ROOT))) if (/\.(js|json)$/.test(f)) list.push(`${dir}/${f}`);
  return list.sort();
}
if (process.argv.includes('--list')) console.log(JSON.stringify(Object.fromEntries((await files()).map((f) => [f, f]))));
else console.log('đã tạo dist/artifact/index.html');
