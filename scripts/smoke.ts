/**
 * Smoke test every page in dist/ at desktop and phone sizes.
 *
 *   npm run smoke                                  # everything (run `npm run build` first)
 *   npm run smoke -- --only=linalg/eigenvectors    # pages whose label or path contains this text
 *   npm run smoke -- --thumbs=linalg/eigenvectors  # also capture that lesson's thumb.webp (--thumbs for all)
 *   npm run smoke -- --dist=/tmp/out --report=/tmp/shots
 *
 * Every page fails on: console errors or warnings, uncaught exceptions,
 * same-origin 4xx/5xx, any external request, a blank screen, horizontal scroll
 * on a 390px phone, a missing <title>, or a KaTeX error.
 * Lessons also fail on: a missing required section (CLAUDE.md §4), fewer than
 * 3 worked examples / 8 practice problems / 4 quick-check questions, no KaTeX,
 * a blank or collapsed figure, a figure without a caption, and (when shipped)
 * a missing NOTES.md or thumb.webp.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { preview } from 'vite';
import { validateMeta, type LessonMeta } from './meta.ts';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name: string) => flag(name)?.split('=').slice(1).join('=') || undefined;
const dist = resolve(root, flagValue('dist') ?? 'dist');
const reportDir = resolve(root, flagValue('report') ?? 'smoke-report');
const only = flagValue('only');
const thumbsFlag = flag('thumbs');
const thumbsFor = flagValue('thumbs');

const THUMB_W = 1200;
const THUMB_H = 750;
const THUMB_MAX_BYTES = 120 * 1024;

/** The §4 lesson arc, as `data-section` values. `code` is required for CS-flavoured subjects. */
const REQUIRED_SECTIONS = ['tldr', 'hook', 'play', 'build', 'formalize', 'examples', 'traps', 'practice', 'quickcheck', 'next'];
const CODE_SUBJECTS = new Set(['dsa', 'sysdesign', 'systems', 'ml', 'dl', 'diffusion', 'llm']);

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;
type ViewportName = keyof typeof VIEWPORTS;

/** Chromium's own messages about the headless software GPU, not about our code. */
const IGNORED_CONSOLE: RegExp[] = [/GPU stall due to ReadPixels/, /\[\.WebGL-[^\]]+\].*performance warning/i];

interface Failure {
  page: string;
  problem: string;
}
const failures: Failure[] = [];
const fail = (page: string, problem: string) => failures.push({ page, problem });

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`✗ ${dist}/index.html not found. Run \`npm run build\` first.`);
  process.exit(1);
}

// ── Static checks on lesson folders ──────────────────────────────────────────

interface LessonInfo {
  id: string;
  meta: LessonMeta;
}
const lessons: LessonInfo[] = [];
const lessonsDir = join(root, 'lessons');
for (const subject of existsSync(lessonsDir) ? readdirSync(lessonsDir).sort() : []) {
  if (!statSync(join(lessonsDir, subject)).isDirectory()) continue;
  for (const slug of readdirSync(join(lessonsDir, subject)).sort()) {
    const dir = join(lessonsDir, subject, slug);
    const id = `${subject}/${slug}`;
    if (!existsSync(join(dir, 'index.html'))) continue;
    if (!existsSync(join(dist, 'lessons', id, 'index.html'))) continue; // not part of this build
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as LessonMeta;
    for (const e of validateMeta(meta)) fail(id, `meta.json: ${e}`);
    lessons.push({ id, meta });
    if (meta.status !== 'shipped') continue;
    const notes = existsSync(join(dir, 'NOTES.md')) ? readFileSync(join(dir, 'NOTES.md'), 'utf8') : '';
    if (notes.trim().length < 600) fail(id, 'NOTES.md is missing or too thin');
    const thumb = join(dir, 'thumb.webp');
    if (!existsSync(thumb) && !thumbsFlag) fail(id, `thumb.webp is missing (run \`npm run smoke -- --thumbs=${id}\`)`);
    else if (existsSync(thumb) && statSync(thumb).size > THUMB_MAX_BYTES) fail(id, 'thumb.webp is over 120 KB');
  }
}

// ── Pages to visit ───────────────────────────────────────────────────────────

const targets: { label: string; path: string; lesson?: LessonInfo }[] = [];
for (const html of readdirSync(dist).filter((f) => f.endsWith('.html')).sort()) {
  const src = existsSync(join(root, html)) ? readFileSync(join(root, html), 'utf8') : '';
  // A page can ask to be tested with extra query strings:
  // <meta name="smoke-variants" content="?s=linalg,?s=nope">
  const variants = /<meta name="smoke-variants" content="([^"]*)"/.exec(src)?.[1].split(',').filter(Boolean) ?? [];
  const base = html === 'index.html' ? '/' : `/${html}`;
  for (const v of ['', ...variants]) targets.push({ label: `${html}${v}`, path: `${base}${v}` });
}
if (existsSync(join(dist, 'kit/index.html'))) targets.push({ label: 'kit', path: '/kit/' });
for (const l of lessons) targets.push({ label: `lessons/${l.id}`, path: `/lessons/${l.id}/`, lesson: l });
const selected = only ? targets.filter((t) => t.label.includes(only) || t.path.includes(only)) : targets;

// ── Browser checks ───────────────────────────────────────────────────────────

const server = await preview({ root, logLevel: 'silent', preview: { port: 0, host: '127.0.0.1' }, build: { outDir: dist } });
const address = server.httpServer.address();
const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 4173}`;

const browser = await chromium.launch({
  executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
mkdirSync(reportDir, { recursive: true });

/** Std-dev of luminance across a PNG; ~0 means blank. */
async function variance(helper: Page, png: Buffer): Promise<number> {
  return helper.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = new OffscreenCanvas(64, 64);
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l;
      sq += l * l;
    }
    const n = d.length / 4;
    return Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
  }, png.toString('base64'));
}

/** Encode a PNG to WebP in the browser, lowering quality until it fits the budget. */
async function toWebp(helper: Page, png: Buffer): Promise<Buffer> {
  const b64 = await helper.evaluate(
    async ({ b64, w, h, max }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(img, 0, 0, w, h);
      let out = '';
      for (let q = 0.86; q >= 0.3; q -= 0.06) {
        out = c.toDataURL('image/webp', q);
        if ((out.length - 23) * 0.75 < max) break;
      }
      return out.split(',')[1];
    },
    { b64: png.toString('base64'), w: THUMB_W, h: THUMB_H, max: THUMB_MAX_BYTES },
  );
  return Buffer.from(b64, 'base64');
}

async function checkLesson(page: Page, helper: Page, name: string, lesson: LessonInfo, vp: ViewportName): Promise<void> {
  const subject = lesson.id.split('/')[0];
  const required = CODE_SUBJECTS.has(subject) ? [...REQUIRED_SECTIONS, 'code'] : REQUIRED_SECTIONS;
  const found = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-section]')].map((e) => e.dataset.section));
  for (const s of required) if (!found.includes(s)) fail(name, `missing required section [data-section="${s}"]`);

  const counts = await page.evaluate(() => ({
    examples: document.querySelectorAll('[data-section="examples"] [data-worked-example]').length,
    problems: document.querySelectorAll('[data-section="practice"] [data-problem]').length,
    quick: document.querySelectorAll('[data-section="quickcheck"] [data-quiz-question]').length,
    katex: document.querySelectorAll('.katex').length,
  }));
  if (counts.examples < 3) fail(name, `only ${counts.examples} worked example(s); need ≥ 3`);
  if (counts.problems < 8) fail(name, `only ${counts.problems} practice problem(s); need ≥ 8`);
  if (counts.quick < 4) fail(name, `only ${counts.quick} quick-check question(s); need 4–6`);
  if (counts.katex === 0) fail(name, 'no KaTeX formulas rendered');

  if (vp !== 'desktop') return; // checking figures at one size is enough
  const figures = page.locator('figure[data-figure]');
  const n = await figures.count();
  if (n === 0) fail(name, 'no figures marked with figure[data-figure]');
  for (let i = 0; i < n; i++) {
    const fig = figures.nth(i);
    const label = (await fig.getAttribute('data-figure')) || `#${i + 1}`;
    const hasCaption = await fig.evaluate((el) => !!el.querySelector('figcaption')?.textContent?.trim());
    if (!hasCaption) fail(name, `figure "${label}" has no <figcaption>`);
    await fig.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const box = await fig.boundingBox();
    if (!box || box.width < 40 || box.height < 40) {
      fail(name, `figure "${label}" is collapsed (${box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'not rendered'})`);
      continue;
    }
    const v = await variance(helper, await fig.screenshot());
    if (v < 1.5) fail(name, `figure "${label}" looks blank (luminance std-dev ${v.toFixed(2)})`);
  }
}

async function checkPage(b: Browser, helper: Page, t: (typeof targets)[number], vp: ViewportName): Promise<void> {
  // Service workers are blocked so every run tests what the server sends, not a cache.
  const context = await b.newContext({ ...VIEWPORTS[vp], reducedMotion: 'no-preference', serviceWorkers: 'block' });
  const page = await context.newPage();
  const name = `${t.label} [${vp}]`;

  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    if (IGNORED_CONSOLE.some((re) => re.test(msg.text()))) return;
    fail(name, `console.${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => fail(name, `uncaught: ${err.message}`));
  page.on('response', (res) => {
    if (res.url().startsWith(origin) && res.status() >= 400) fail(name, `HTTP ${res.status()} ${res.url().slice(origin.length)}`);
  });
  // No runtime network calls beyond the site's own assets.
  await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (route) => {
    if (/^(data|blob):/.test(route.request().url())) return route.continue();
    fail(name, `external request: ${route.request().url()}`);
    return route.abort();
  });

  try {
    await page.goto(origin + t.path, { waitUntil: 'load', timeout: 45_000 });
    await page.waitForTimeout(1500);
    const png = await page.screenshot();
    writeFileSync(join(reportDir, `${t.label.replace(/[^a-z0-9-]+/gi, '_')}-${vp}.png`), png);
    const v = await variance(helper, png);
    if (v < 2) fail(name, `blank screen (luminance std-dev ${v.toFixed(2)})`);
    if (vp === 'mobile') {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) fail(name, `horizontal scroll on a 390px phone (${overflow}px too wide)`);
    }
    if (!(await page.title()).trim()) fail(name, 'page has no <title>');
    const texErrors = await page.evaluate(() =>
      [...document.querySelectorAll('.katex-error')].map((e) => e.getAttribute('title') ?? e.textContent ?? ''),
    );
    for (const e of texErrors) fail(name, `KaTeX error: ${e}`);
    if (t.lesson) await checkLesson(page, helper, name, t.lesson, vp);
  } catch (err) {
    fail(name, `failed to load: ${(err as Error).message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

async function captureThumb(b: Browser, helper: Page, id: string): Promise<void> {
  const context = await b.newContext({ viewport: { width: THUMB_W, height: THUMB_H }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.goto(`${origin}/lessons/${id}/?thumb`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  // Frame the lesson's central interactive if it marks one, else its Play section.
  await page.evaluate(() => {
    const el = document.querySelector('[data-thumb]') ?? document.querySelector('[data-section="play"]');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 24);
  });
  await page.waitForTimeout(1500);
  const webp = await toWebp(helper, await page.screenshot());
  writeFileSync(join(root, 'lessons', id, 'thumb.webp'), webp);
  console.log(`  ↳ captured lessons/${id}/thumb.webp (${(webp.length / 1024).toFixed(0)} KB)`);
  await context.close();
}

const helper = await browser.newPage();
await helper.goto(`${origin}/`);

for (const t of selected) {
  for (const vp of Object.keys(VIEWPORTS) as ViewportName[]) {
    const before = failures.length;
    await checkPage(browser, helper, t, vp);
    console.log(`${failures.length === before ? '✓' : '✗'} ${t.label} [${vp}]`);
  }
}

if (thumbsFlag) {
  for (const l of lessons) if (!thumbsFor || thumbsFor === l.id) await captureThumb(browser, helper, l.id);
}

await browser.close();
await new Promise<void>((done) => server.httpServer.close(() => done()));

if (failures.length) {
  console.error(`\n✗ ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  • ${f.page}: ${f.problem}`);
  console.error(`\nScreenshots: ${reportDir}`);
  process.exit(1);
}
console.log(`\n✓ ${selected.length} page(s) × ${Object.keys(VIEWPORTS).length} viewports clean. Screenshots: ${reportDir}`);
