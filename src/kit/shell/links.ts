/**
 * Relative links between site pages (pure, tested). Every link is relative,
 * so the site works under a GitHub Pages sub-path and offline. A lesson page
 * lives at `lessons/<subject>/<slug>/index.html`, three folders below the
 * site root.
 */

/** From a lesson page to the site root: '../../../'. */
export const LESSON_TO_ROOT = '../../../';

/** From one lesson page to another: '../../<subject>/<slug>/'. */
export function lessonHref(toLessonId: string): string {
  return `../../${toLessonId}/`;
}

/**
 * A subject's page, relative to the site root. Subject pages are integration
 * work (src/site); until they exist this points at the subject on the home
 * page, which always exists.
 */
export function subjectHref(subjectId: string, root = LESSON_TO_ROOT): string {
  return `${root}#${encodeURIComponent(subjectId)}`;
}

/**
 * The site root, relative to the current page, from the page's manifest link
 * (`<link rel="manifest" href="../../../manifest.webmanifest">`, written by
 * the PWA plugin at every depth). Falls back to counting the path below
 * `/lessons/`, then to './'.
 */
export function rootFrom(manifestHref: string | null | undefined, pathname = ''): string {
  if (manifestHref) {
    const dir = manifestHref.replace(/[^/]*$/, '');
    if (!/^[a-z]+:|^\//i.test(dir)) return dir || './';
  }
  const m = /\/lessons\/[^/]+\/[^/]+\//.exec(pathname);
  if (m) return LESSON_TO_ROOT;
  const k = /\/kit\/(?:_dev\/)?/.exec(pathname);
  if (k) return k[0].split('/').filter(Boolean).map(() => '../').join('');
  return './';
}

/** `rootFrom` for the current document (Node: './'). */
export function siteRoot(): string {
  if (typeof document === 'undefined') return './';
  return rootFrom(document.querySelector('link[rel="manifest"]')?.getAttribute('href'), location.pathname);
}
