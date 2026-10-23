/**
 * Smoke test every page in dist/ at desktop and phone sizes.
 *
 *   npm run smoke                                  # everything (run `npm run build` first)
 *   npm run smoke -- --only=linalg/eigenvectors    # pages whose label or path contains this text
 *   npm run smoke -- --thumbs=linalg/eigenvectors  # also capture that lesson's thumb.webp (--thumbs for all)
 *   npm run smoke -- --dist=/tmp/out --report=/tmp/shots
 *
 * Every page, at 1280×800, at 390×844 (touch) and in a dark + reduced-motion
 * pass, fails on: console errors or warnings, uncaught exceptions, same-origin
 * 4xx/5xx, any external request, a blank screen, horizontal scroll on a 390px
 * phone, a missing <title>, a KaTeX error, heading levels that skip (h2 → h4)
 * or more than one h1, and (on the phone) a control smaller than 44×44px or
 * without an accessible name.
 * Lessons also fail on: a missing required section (CLAUDE.md §4), fewer than
 * 3 worked examples / 8 practice problems, a quick check outside 4–6
 * questions, Build steps outside 3–6, traps outside 2–4, fewer than 2 references, no explained key
 * formula in Formalize, no KaTeX, a blank or collapsed visible figure, a
 * figure without a caption, a print revision card that doesn't render, and
 * (when shipped) a missing NOTES.md or thumb.webp. Figures inside hidden
 * panels (inactive example tabs, non-current problems) are skipped; they are
 * checked by the gallery and when shown.
 * Finally, when dist/sw.js exists, the site is loaded once with the service
 * worker allowed, the network is cut, and a lesson must still open.
 *
 *   npm run smoke -- --no-offline     # skip the offline check
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { preview } from 'vite';
import { validateMeta, type LessonMeta } from './meta.ts';
import { CODE_SUBJECTS, LESSON_SECTION_IDS } from '../src/kit/types.ts';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name: string) => flag(name)?.split('=').slice(1).join('=') || undefined;
const dist = resolve(root, flagValue('dist') ?? 'dist');
const reportDir = resolve(root, flagValue('report') ?? 'smoke-report');
const only = flagValue('only');
const thumbsFlag = flag('thumbs');
const thumbsFor = flagValue('thumbs');
const offlineCheck = !flag('no-offline');

const THUMB_W = 1200;
const THUMB_H = 750;
const THUMB_MAX_BYTES = 120 * 1024;

/** The §4 lesson arc, as `data-section` values (src/kit/types.ts). `code` is required for CS-flavoured subjects (CODE_SUBJECTS). */
const REQUIRED_SECTIONS: readonly string[] = LESSON_SECTION_IDS.filter((id) => id !== 'code');

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'no-preference' },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', reducedMotion: 'no-preference' },
  // Dark mode and reduced motion must work too (§11): console, blank screen, KaTeX and figures again.
  dark: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce' },
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
    traps: document.querySelectorAll('[data-section="traps"] [data-trap]').length,
    refs: document.querySelectorAll('[data-section="next"] [data-ref]').length,
    formulas: document.querySelectorAll('[data-section="formalize"] [data-formula][data-explain]').length,
    steps: document.querySelectorAll('[data-section="build"] [data-step]').length,
    katex: document.querySelectorAll('.katex').length,
  }));
  if (counts.examples < 3) fail(name, `only ${counts.examples} worked example(s); need ≥ 3`);
  if (counts.problems < 8) fail(name, `only ${counts.problems} practice problem(s); need ≥ 8`);
  if (counts.quick < 4 || counts.quick > 6) fail(name, `${counts.quick} quick-check question(s); need 4–6`);
  if (counts.traps < 2 || counts.traps > 4) fail(name, `${counts.traps} common trap(s) [data-trap]; need 2–4`);
  if (counts.refs < 2) fail(name, `${counts.refs} reference(s) [data-ref] in "next"; need ≥ 2`);
  if (counts.formulas < 1) fail(name, 'no key formula with "explain this" ([data-formula][data-explain]) in Formalize');
  if (counts.steps < 3 || counts.steps > 6) fail(name, `${counts.steps} "build the idea" step(s) [data-step]; need 3–6`);
  if (counts.katex === 0) fail(name, 'no KaTeX formulas rendered');

  if (vp === 'mobile') return; // figures at desktop size, light and dark
  const figures = page.locator('figure[data-figure]');
  const n = await figures.count();
  if (n === 0) fail(name, 'no figures marked with figure[data-figure]');
  let checked = 0;
  for (let i = 0; i < n; i++) {
    const fig = figures.nth(i);
    const label = (await fig.getAttribute('data-figure').catch(() => null)) || `#${i + 1}`;
    try {
      const hasCaption = await fig.evaluate((el) => !!el.querySelector('figcaption')?.textContent?.trim(), undefined, { timeout: 5000 });
      if (!hasCaption) fail(name, `figure "${label}" has no <figcaption>`);
      // Figures inside hidden panels (inactive tabs, non-current problems) can't be measured; they're checked when shown.
      const shown = await fig.evaluate((el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility() : !el.closest('[hidden]')), undefined, { timeout: 5000 });
      if (!shown) continue;
      checked++;
      await fig.scrollIntoViewIfNeeded({ timeout: 5000 });
      await page.waitForTimeout(250);
      const box = await fig.boundingBox({ timeout: 5000 });
      if (!box || box.width < 40 || box.height < 40) {
        fail(name, `figure "${label}" is collapsed (${box ? `${Math.round(box.width)}×${Math.round(box.height)}` : 'not rendered'})`);
        continue;
      }
      const v = await variance(helper, await fig.screenshot({ timeout: 10_000 }));
      if (v < 1.5) fail(name, `figure "${label}" looks blank (luminance std-dev ${v.toFixed(2)})`);
    } catch (err) {
      fail(name, `figure "${label}" couldn't be checked: ${(err as Error).message.split('\n')[0]}`);
    }
  }
  if (n > 0 && checked === 0) fail(name, 'every figure is hidden; nothing visible to check');

  if (vp !== 'desktop') return;
  // The TL;DR prints as a one-card revision sheet (§4.1).
  try {
    await page.evaluate(() => document.body.classList.add('print-card'));
    await page.emulateMedia({ media: 'print' });
    const card = page.locator('[data-section="tldr"] .tldr').first();
    if ((await card.count()) === 0) fail(name, 'no .tldr revision card in the tldr section');
    else {
      const png = await page.screenshot({ fullPage: false });
      writeFileSync(join(reportDir, `${name.replace(/[^a-z0-9-]+/gi, '_')}-print.png`), png);
      if (!(await card.isVisible())) fail(name, 'the revision card is hidden in print');
      else if ((await variance(helper, png)) < 2) fail(name, 'the print view looks blank');
    }
  } catch (err) {
    fail(name, `print check failed: ${(err as Error).message.split('\n')[0]}`);
  } finally {
    await page.emulateMedia({ media: 'screen' }).catch(() => {});
    await page.evaluate(() => document.body.classList.remove('print-card')).catch(() => {});
  }
}

/** Runs in the page: every visible control ≥ 44×44 px (radios/checkboxes count their label; `data-hit` opts out) with an accessible name. */
const TAP_TARGET_AUDIT = `(() => {
  const out = [];
  const sel = 'button, input:not([type=hidden]), select, textarea, summary, a.btn, a.icon-btn, [role=button], [role=slider], [role=switch], [role=tab], [role=checkbox], [role=radio], [role=menuitem]';
  function nameOf(el) {
    const aria = (el.getAttribute('aria-label') || '').trim();
    if (aria) return aria;
    const by = el.getAttribute('aria-labelledby');
    if (by) return by.split(/\\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    if (el.labels && el.labels.length) return Array.from(el.labels).map((l) => l.textContent || '').join(' ').trim();
    const own = (el.textContent || '').trim() || el.getAttribute('title') || el.placeholder || '';
    if (own) return own;
    const t = el.querySelector('svg title');
    if (t) return t.textContent || '';
    return el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '';
  }
  function where(el) {
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    const ctx = el.closest('[data-figure], [data-problem], [data-section]');
    let at = '';
    if (ctx) at = ctx.getAttribute('data-figure') ? ' in figure ' + ctx.getAttribute('data-figure') : ctx.getAttribute('data-problem') ? ' in problem ' + ctx.getAttribute('data-problem') : ' in section ' + ctx.getAttribute('data-section');
    return '<' + el.tagName.toLowerCase() + id + cls + '>' + at;
  }
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkVisibilityCSS: true })) continue;
    let r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const label = el.closest('label');
    if (label && (el.matches('input[type=radio], input[type=checkbox]') || r.width < 4 || r.height < 4)) r = label.getBoundingClientRect();
    if (!el.hasAttribute('data-hit') && (r.width < 43.5 || r.height < 43.5)) out.push('tap target ' + Math.round(r.width) + '×' + Math.round(r.height) + ' < 44×44: ' + where(el));
    if (!nameOf(el)) out.push('no accessible name: ' + where(el));
  }
  return out.slice(0, 20);
})()`;

/**
 * Cheap §11 checks every page gets: heading order, and on the phone every
 * control ≥ 44×44 px with an accessible name. A control that enlarges its
 * hit area with a pseudo-element declares it with `data-hit`; a radio or
 * checkbox counts its <label>. Inline text links are exempt (WCAG 2.5.8).
 */
async function checkQuality(page: Page, name: string, vp: ViewportName): Promise<void> {
  const headings = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent ?? '').trim().slice(0, 40) })));
  const h1s = headings.filter((h) => h.level === 1).length;
  if (h1s > 1) fail(name, `${h1s} <h1> elements; a page has one`);
  for (let k = 1; k < headings.length; k++) {
    if (headings[k].level > headings[k - 1].level + 1) fail(name, `heading skips a level: h${headings[k - 1].level} "${headings[k - 1].text}" → h${headings[k].level} "${headings[k].text}"`);
  }
  if (vp !== 'mobile') return;
  // Plain-string browser code: tsx's esbuild would wrap named helpers in `__name()`, which doesn't exist in the page.
  const problems = (await page.evaluate(TAP_TARGET_AUDIT)) as string[];
  for (const p of problems) fail(name, p);
}

async function checkPage(b: Browser, helper: Page, t: (typeof targets)[number], vp: ViewportName): Promise<void> {
  // Service workers are blocked so every run tests what the server sends, not a cache.
  const context = await b.newContext({ ...VIEWPORTS[vp], serviceWorkers: 'block' });
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
    await checkQuality(page, name, vp);
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

/** Load the site once with the service worker on, cut the network, and open a lesson (CLAUDE.md §1: offline after the first visit). */
async function checkOffline(b: Browser, helper: Page): Promise<void> {
  if (!existsSync(join(dist, 'sw.js'))) return;
  const target = lessons.find((l) => selected.some((t) => t.lesson === l)) ?? lessons[0];
  const path = target ? `/lessons/${target.id}/` : '/';
  const name = `offline ${path}`;
  const context = await b.newContext({ ...VIEWPORTS.desktop, serviceWorkers: 'allow' });
  const page = await context.newPage();
  try {
    // First visit: the page itself registers the worker (registerPWA in mountLesson / site pages).
    await page.goto(`${origin}${path}`, { waitUntil: 'load', timeout: 45_000 });
    const registered = await page.evaluate(async () => {
      for (let k = 0; k < 40; k++) {
        if (await navigator.serviceWorker.getRegistration()) return true;
        await new Promise((r) => setTimeout(r, 250));
      }
      return false;
    });
    if (!registered) {
      if (target) {
        fail(name, 'the page never registered the service worker (mountLesson should call registerPWA)');
        return;
      }
      // No lessons yet (placeholder home page): register the generated worker directly so it is still exercised.
      await page.evaluate(() => navigator.serviceWorker.register('sw.js').then(() => true));
    }
    await page.evaluate(() =>
      Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((_, no) => setTimeout(() => no(new Error('service worker never became ready')), 20_000))]),
    );
    // Wait until the precache holds the page we'll open offline.
    await page.waitForFunction(
      async (url) => {
        for (const key of await caches.keys()) if (await (await caches.open(key)).match(url, { ignoreSearch: true })) return true;
        return false;
      },
      `${origin}${path}${path.endsWith('/') ? 'index.html' : ''}`,
      { timeout: 30_000, polling: 500 },
    );
    await context.setOffline(true);
    await page.goto(`${origin}${path}`, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForTimeout(1500);
    const title = (await page.title()).trim();
    if (!title || title === 'Offline') fail(name, `the page didn't open offline (title "${title}")`);
    const v = await variance(helper, await page.screenshot());
    if (v < 2) fail(name, `blank screen offline (luminance std-dev ${v.toFixed(2)})`);
  } catch (err) {
    fail(name, `offline check failed: ${(err as Error).message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
  console.log(`${failures.some((f) => f.page === name) ? '✗' : '✓'} ${name}`);
}

if (offlineCheck) await checkOffline(browser, helper);

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
