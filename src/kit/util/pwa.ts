/**
 * Registers the site's service worker and hands it the list of assets this
 * first visit already loaded, so the page works offline right away instead of
 * only after a second visit (CLAUDE.md §1). Pages pass the relative URL of the
 * root `sw.js` (lessons: '../../../sw.js'). No-op in dev and where service
 * workers are unavailable. The worker itself is site work, not kit work.
 */
export function registerPWA(swUrl = './sw.js'): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(swUrl);
      await navigator.serviceWorker.ready;
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => u.startsWith(location.origin));
      urls.push(location.href.split('#')[0]);
      (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'precache', urls });
    } catch (err) {
      console.info('Service worker unavailable; continuing online-only.', err);
    }
  });
}
