import { createReadStream, existsSync, readdirSync, statSync, cpSync, mkdirSync, copyFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const root = import.meta.dirname;
const projectsDir = join(root, 'projects');

/** Every project folder that has an index.html. */
function projectSlugs(): string[] {
  if (!existsSync(projectsDir)) return [];
  return readdirSync(projectsDir)
    .filter((slug) => existsSync(join(projectsDir, slug, 'index.html')))
    .sort();
}

/**
 * Build inputs: the showcase pages plus every top-level .html file inside each
 * project (blogs and websites ship several pages, not just index.html).
 */
function discoverInputs(): Record<string, string> {
  const inputs: Record<string, string> = {
    main: join(root, 'index.html'),
    notes: join(root, 'notes.html'),
  };
  // The /learn hub's pages live in learn/*.html.
  const learnDir = join(root, 'learn');
  if (existsSync(learnDir)) {
    for (const file of readdirSync(learnDir)) {
      if (file.endsWith('.html')) inputs[`learn/${file.replace(/\.html$/, '')}`] = join(learnDir, file);
    }
  }
  for (const slug of projectSlugs()) {
    for (const file of readdirSync(join(projectsDir, slug))) {
      if (file.endsWith('.html')) {
        inputs[`projects/${slug}/${file.replace(/\.html$/, '')}`] = join(projectsDir, slug, file);
      }
    }
  }
  return inputs;
}

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.js': 'text/javascript',
  '.txt': 'text/plain',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

/**
 * Vite has one global publicDir, but each project keeps its own `public/`.
 * In dev we serve `projects/<slug>/public/*` at `/projects/<slug>/*`; at build
 * time we copy it (and the showcase thumbnail) next to the project's HTML.
 */
function projectAssets(): Plugin {
  let outDir = 'dist';
  return {
    name: 'coolstuff:project-assets',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/projects\/([^/]+)\/(.+)$/.exec((req.url ?? '').split('?')[0]);
        if (!match) return next();
        const [, slug, rest] = match;
        const candidates = [join(projectsDir, slug, 'public', rest)];
        if (rest === 'thumb.webp') candidates.push(join(projectsDir, slug, 'thumb.webp'));
        const file = candidates.find((p) => p.startsWith(projectsDir + sep) && existsSync(p) && statSync(p).isFile());
        if (!file) return next();
        res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
        createReadStream(file).pipe(res);
      });
    },
    writeBundle() {
      for (const slug of projectSlugs()) {
        const dest = join(outDir, 'projects', slug);
        mkdirSync(dest, { recursive: true });
        const pub = join(projectsDir, slug, 'public');
        if (existsSync(pub)) cpSync(pub, dest, { recursive: true });
        const thumb = join(projectsDir, slug, 'thumb.webp');
        if (existsSync(thumb)) copyFileSync(thumb, join(dest, 'thumb.webp'));
      }
    },
  };
}

export default defineConfig({
  // Relative base keeps every page portable: the site works at a GitHub Pages
  // sub-path, at a custom domain root, or opened from `vite preview`.
  base: './',
  plugins: [projectAssets()],
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
