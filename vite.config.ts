import { copyFileSync, cpSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { katexPrerender } from './src/kit/vite-katex.ts';
import { pwaPlugin } from './src/kit/vite-pwa.ts';

const root = import.meta.dirname;
const lessonsDir = join(root, 'lessons');

// COOLSTUFF_ONLY=linalg/eigenvectors[,calc1/derivative] limits which lessons are
// built (handy while other lessons are mid-edit). Site pages are always built.
const only = process.env.COOLSTUFF_ONLY?.split(',').filter(Boolean);
// COOLSTUFF_SKIP_WIP=1 (set by the Pages deploy) leaves "wip" lessons out of the
// published site; they show as "coming soon" until they ship.
const skipWip = process.env.COOLSTUFF_SKIP_WIP === '1';

function isShipped(id: string): boolean {
  try {
    return JSON.parse(readFileSync(join(lessonsDir, id, 'meta.json'), 'utf8')).status === 'shipped';
  } catch {
    return false;
  }
}

/** Every lesson folder (`<subject>/<slug>`) that has an index.html. */
export function lessonIds(): string[] {
  if (!existsSync(lessonsDir)) return [];
  const ids: string[] = [];
  for (const subject of readdirSync(lessonsDir)) {
    const subjectDir = join(lessonsDir, subject);
    if (!statSync(subjectDir).isDirectory()) continue;
    for (const slug of readdirSync(subjectDir)) {
      if (existsSync(join(subjectDir, slug, 'index.html'))) ids.push(`${subject}/${slug}`);
    }
  }
  return ids
    .filter((id) => !only || only.includes(id))
    .filter((id) => !skipWip || isShipped(id))
    .sort();
}

/**
 * Build inputs: every top-level .html page (home, subject, graph, practice…),
 * the /kit gallery, and one page per lesson.
 */
function discoverInputs(): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const file of readdirSync(root)) {
    if (file.endsWith('.html')) inputs[file.replace(/\.html$/, '')] = join(root, file);
  }
  if (existsSync(join(root, 'kit/index.html'))) inputs['kit/index'] = join(root, 'kit/index.html');
  for (const id of lessonIds()) inputs[`lessons/${id}/index`] = join(lessonsDir, id, 'index.html');
  return inputs;
}

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

/**
 * Lessons keep their own assets: `lessons/<s>/<slug>/public/*` and the
 * thumbnail are served next to the lesson page in dev and copied there at
 * build time (Vite only knows one global public/ folder).
 */
function lessonAssets(): Plugin {
  let outDir = 'dist';
  return {
    name: 'coolstuff:lesson-assets',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/lessons\/([^/]+)\/([^/]+)\/(.+)$/.exec((req.url ?? '').split('?')[0]);
        if (!match) return next();
        const [, subject, slug, rest] = match;
        const dir = join(lessonsDir, subject, slug);
        const candidates = [join(dir, 'public', rest)];
        if (rest === 'thumb.webp') candidates.push(join(dir, 'thumb.webp'));
        const file = candidates.find((p) => p.startsWith(lessonsDir + sep) && existsSync(p) && statSync(p).isFile());
        if (!file) return next();
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    writeBundle() {
      for (const id of lessonIds()) {
        const src = join(lessonsDir, id);
        const dest = join(outDir, 'lessons', id);
        mkdirSync(dest, { recursive: true });
        if (existsSync(join(src, 'public'))) cpSync(join(src, 'public'), dest, { recursive: true });
        if (existsSync(join(src, 'thumb.webp'))) copyFileSync(join(src, 'thumb.webp'), join(dest, 'thumb.webp'));
      }
    },
  };
}

export default defineConfig({
  // A relative base keeps every page portable: GitHub Pages sub-path, custom
  // domain root, or `vite preview` all work unchanged.
  base: './',
  // katexPrerender: <span class="tex"> / <div class="tex-block"> in HTML become KaTeX at build time.
  // pwaPlugin: manifest link in every page; dist/manifest.webmanifest and dist/sw.js (precache of all of dist/).
  plugins: [lessonAssets(), katexPrerender(), pwaPlugin()],
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  resolve: {
    alias: { '@kit': join(root, 'src/kit'), '@content': join(root, 'src/content') },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 2048,
    rollupOptions: { input: discoverInputs() },
  },
  server: { host: true },
  preview: { host: true },
});
