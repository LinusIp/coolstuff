/**
 * Smoke test every page in dist/ at desktop and phone sizes.
 *
 *   npm run smoke                     # test everything (needs `npm run build` first)
 *   npm run smoke -- --only=flipline  # one project
 *   npm run smoke -- --thumbs         # also (re)capture thumb.webp for every project
 *   npm run smoke -- --thumbs=flipline
 *
 * Fails on: console errors or warnings, uncaught exceptions, same-origin 4xx/5xx,
 * blank screens, horizontal scroll on a phone, and shipped projects missing
 * meta.json / NOTES.md / a thumb.webp of the right size.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { preview } from 'vite';
import { validateMeta, type ProjectMeta } from './meta.ts';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const reportDir = join(root, 'smoke-report');
const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const flagValue = (name: string) => flag(name)?.split('=')[1];
const only = flagValue('only');
const thumbsFlag = flag('thumbs');
const thumbsFor = flagValue('thumbs');

const THUMB_W = 1200;
const THUMB_H = 750;
const THUMB_MAX_BYTES = 120 * 1024;

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
} as const;

/**
 * Messages Chromium itself prints about the headless software GPU, not about
 * our code. Each entry must say why it's safe to ignore.
 */
const IGNORED_CONSOLE: RegExp[] = [
  // SwiftShader (CI has no GPU) reports ReadPixels/flush stalls as warnings.
  /GPU stall due to ReadPixels/,
  /\[\.WebGL-[^\]]+\].*(?:performance warning|GL_CLOSE_PATH_NV)/i,
];

interface Failure {
  page: string;
  problem: string;
}

const failures: Failure[] = [];
const fail = (page: string, problem: string) => failures.push({ page, problem });

if (!existsSync(join(dist, 'index.html'))) {
  console.error('✗ dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

// ── Static checks on project folders ─────────────────────────────────────────

interface ProjectInfo {
  slug: string;
  meta: ProjectMeta;
  pages: string[];
}

const projects: ProjectInfo[] = [];
for (const slug of readdirSync(join(root, 'projects')).sort()) {
  const dir = join(root, 'projects', slug);
  if (!existsSync(join(dir, 'index.html'))) continue;
  if (only && slug !== only) continue;
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as ProjectMeta;
  for (const e of validateMeta(meta)) fail(slug, `meta.json: ${e}`);
  const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
  projects.push({ slug, meta, pages });
  if (meta.status !== 'shipped') continue;
  if (!existsSync(join(dir, 'NOTES.md')) || readFileSync(join(dir, 'NOTES.md'), 'utf8').trim().length < 400) {
    fail(slug, 'NOTES.md is missing or too thin to explain anything');
  }
  const thumb = join(dir, 'thumb.webp');
  if (!existsSync(thumb) && !thumbsFlag) fail(slug, 'thumb.webp is missing (run `npm run smoke -- --thumbs=' + slug + '`)');
  else if (existsSync(thumb) && statSync(thumb).size > THUMB_MAX_BYTES) fail(slug, 'thumb.webp is over 120 KB');
}

// ── Browser checks ───────────────────────────────────────────────────────────

const server = await preview({ root, logLevel: 'silent', preview: { port: 0, host: '127.0.0.1' } });
const address = server.httpServer.address();
const origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 4173}`;

const browser = await chromium.launch({
  executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan',
    '--use-angle=swiftshader',
    // Opt in to software WebGL explicitly, otherwise Chromium warns about the fallback.
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=user-gesture-required',
  ],
});

mkdirSync(reportDir, { recursive: true });

/** Std-dev of luminance across a screenshot; ~0 means a blank screen. */
async function screenVariance(helper: Page, png: Buffer): Promise<number> {
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
    return Math.sqrt(sq / n - (sum / n) ** 2);
  }, png.toString('base64'));
}

/** Encode a PNG screenshot to WebP in the browser, lowering quality until it fits the budget. */
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

async function checkPage(b: Browser, helper: Page, label: string, path: string, vpName: keyof typeof VIEWPORTS): Promise<void> {
  const context = await b.newContext({ ...VIEWPORTS[vpName], reducedMotion: 'no-preference' });
  const page = await context.newPage();
  const name = `${label} [${vpName}]`;

  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some((re) => re.test(text))) return;
    fail(name, `console.${msg.type()}: ${text}`);
  });
  page.on('pageerror', (err) => fail(name, `uncaught: ${err.message}`));
  page.on('response', (res) => {
    if (res.url().startsWith(origin) && res.status() >= 400) fail(name, `HTTP ${res.status()} ${res.url().slice(origin.length)}`);
  });
  page.on('requestfailed', (req) => {
    if (!req.url().startsWith(origin)) fail(name, `external request blocked by policy: ${req.url()}`);
  });
  // No runtime network calls beyond the site's own assets.
  await page.route(/^(?!http:\/\/127\.0\.0\.1)/, (route) => {
    if (/^(data|blob):/.test(route.request().url())) return route.continue();
    fail(name, `external request: ${route.request().url()}`);
    return route.abort();
  });

  try {
    await page.goto(origin + path, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForTimeout(2500);
    const png = await page.screenshot();
    const file = `${label.replace(/[^a-z0-9-]+/gi, '_')}-${vpName}.png`;
    writeFileSync(join(reportDir, file), png);
    const variance = await screenVariance(helper, png);
    if (variance < 2) fail(name, `blank screen (luminance std-dev ${variance.toFixed(2)})`);
    if (vpName === 'mobile') {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) fail(name, `horizontal scroll on a 390px phone (${overflow}px too wide)`);
    }
    const title = await page.title();
    if (!title.trim()) fail(name, 'page has no <title>');
  } catch (err) {
    fail(name, `failed to load: ${(err as Error).message.split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

async function captureThumb(b: Browser, helper: Page, slug: string): Promise<void> {
  const context = await b.newContext({ viewport: { width: THUMB_W, height: THUMB_H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${origin}/projects/${slug}/?thumb`, { waitUntil: 'load' });
  await page.waitForTimeout(4000);
  const webp = await toWebp(helper, await page.screenshot());
  writeFileSync(join(root, 'projects', slug, 'thumb.webp'), webp);
  console.log(`  ↳ captured projects/${slug}/thumb.webp (${(webp.length / 1024).toFixed(0)} KB)`);
  await context.close();
}

const helper = await browser.newPage();
await helper.goto(`${origin}/`);

const targets: [string, string][] = [];
if (!only) targets.push(['showcase', '/']);
for (const p of projects) {
  for (const html of p.pages) targets.push([`${p.slug}/${html}`, `/projects/${p.slug}/${html === 'index.html' ? '' : html}`]);
  if (p.meta.status === 'shipped') targets.push([`${p.slug}/notes`, `/notes.html?p=${p.slug}`]);
}

for (const [label, path] of targets) {
  for (const vp of Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]) {
    const before = failures.length;
    await checkPage(browser, helper, label, path, vp);
    console.log(`${failures.length === before ? '✓' : '✗'} ${label} [${vp}]`);
  }
}

if (thumbsFlag) {
  for (const p of projects) if (!thumbsFor || thumbsFor === p.slug) await captureThumb(browser, helper, p.slug);
}

await browser.close();
await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));

if (failures.length) {
  console.error(`\n✗ ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  • ${f.page}: ${f.problem}`);
  console.error(`\nScreenshots: smoke-report/`);
  process.exit(1);
}
console.log(`\n✓ ${targets.length} page(s) × ${Object.keys(VIEWPORTS).length} viewports clean. Screenshots: smoke-report/`);
