import { describe, expect, it } from 'vitest';
import { manifestTags, precacheList, precacheVersion, serviceWorkerSource, webManifest } from './vite-pwa';

describe('PWA build plugin helpers', () => {
  it('precaches pages and assets, skipping duplicates browsers never use', () => {
    const files = [
      { path: 'index.html', bytes: 1000 },
      { path: 'lessons/linalg/eigenvectors/index.html', bytes: 2000 },
      { path: 'assets/index-abc123.js', bytes: 50_000 },
      { path: 'assets/index-abc123.js.map', bytes: 50_000 },
      { path: 'assets/style-x.css', bytes: 9000 },
      { path: 'assets/KaTeX_Main-Regular-1.woff2', bytes: 26_000 },
      { path: 'assets/KaTeX_Main-Regular-1.woff', bytes: 30_000 },
      { path: 'assets/KaTeX_Main-Regular-1.ttf', bytes: 50_000 },
      { path: 'lessons/linalg/eigenvectors/thumb.webp', bytes: 90_000 },
      { path: 'sw.js', bytes: 3000 },
      { path: 'manifest.webmanifest', bytes: 400 },
      { path: 'huge/video.webp', bytes: 20 * 1024 * 1024 },
      { path: '.DS_Store', bytes: 10 },
    ];
    const list = precacheList(files);
    expect(list.slice(0, 2)).toEqual(['index.html', 'lessons/linalg/eigenvectors/index.html']); // pages first
    expect(list).toContain('assets/KaTeX_Main-Regular-1.woff2');
    expect(list).toContain('manifest.webmanifest');
    for (const no of ['assets/index-abc123.js.map', 'assets/KaTeX_Main-Regular-1.woff', 'assets/KaTeX_Main-Regular-1.ttf', 'sw.js', 'huge/video.webp', '.DS_Store']) expect(list).not.toContain(no);
    expect(precacheList(files, { exclude: [/thumb\.webp$/] })).not.toContain('lessons/linalg/eigenvectors/thumb.webp');
  });

  it('generates a parseable worker with a versioned cache', () => {
    const v = precacheVersion(['a.html'], ['h1']);
    expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(precacheVersion(['a.html'], ['h2'])).not.toBe(v);
    const src = serviceWorkerSource(['index.html', 'assets/a.js'], v);
    expect(src).toContain(`const CACHE = 'coolstuff-${v}'`);
    expect(src).toContain('["index.html","assets/a.js"]');
    expect(() => new Function(src)).not.toThrow(); // syntactically valid script
  });

  it('manifest and per-page tags', () => {
    const m = webManifest({}, [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }]);
    expect(m).toMatchObject({ start_url: './', scope: './', display: 'standalone', short_name: 'coolstuff' });
    expect(manifestTags('index.html')).toContain('href="manifest.webmanifest"');
    expect(manifestTags('lessons/linalg/eigenvectors/index.html')).toContain('href="../../../manifest.webmanifest"');
    expect(manifestTags('kit/index.html', '#000', true)).toBe('<link rel="manifest" href="../manifest.webmanifest">');
  });
});
