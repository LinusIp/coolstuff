/**
 * Screenshot built pages, for looking at work in progress:
 *   npx tsx scripts/shoot.ts --dist=<dir> --out=<dir> /kit/ /lessons/linalg/eigenvectors/
 * Options: --w=390 --h=844 (default 1280×800; widths < 600 emulate a touch phone),
 *          --dark (prefers-color-scheme: dark), --full (whole page),
 *          --selector=<css> (screenshot just that element), --wait=<ms> (default 1200).
 * Prints console errors/warnings it sees so they can't hide behind a pretty picture.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const has = (k: string) => args.includes(`--${k}`);
const dist = resolve(opt('dist') ?? 'dist');
const out = resolve(opt('out') ?? 'smoke-report/shots');
const w = Number(opt('w') ?? 1280);
const h = Number(opt('h') ?? 800);
const wait = Number(opt('wait') ?? 1200);
const selector = opt('selector');
const pages = args.filter((a) => !a.startsWith('--'));
if (pages.length === 0) {
  console.error('usage: npx tsx scripts/shoot.ts --dist=<dir> [--out=<dir>] [--w= --h= --dark --full --selector= --wait=] <path>…');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const server = await preview({ root, logLevel: 'silent', preview: { port: 0, host: '127.0.0.1' }, build: { outDir: dist } });
const address = server.httpServer.address();
const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 4173}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const mobile = w < 600;
const context = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
  colorScheme: has('dark') ? 'dark' : 'light',
  serviceWorkers: 'block',
});
for (const p of pages) {
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`  console.${m.type()} on ${p}: ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`  uncaught on ${p}: ${e.message}`));
  await page.goto(origin + p, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  const name = `${p.replace(/[^a-z0-9-]+/gi, '_')}-${w}x${h}${has('dark') ? '-dark' : ''}${selector ? '-el' : ''}.png`;
  const file = join(out, name);
  if (selector) await page.locator(selector).first().screenshot({ path: file });
  else await page.screenshot({ path: file, fullPage: has('full') });
  console.log(`✓ ${file}`);
  await page.close();
}
await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));
