/**
 * Registers a project's service worker (`./sw.js`, scoped to the project
 * folder) and hands it the list of assets this first visit already loaded, so
 * the project works offline right away instead of only after a second visit.
 */
export function registerPWA(swUrl = './sw.js'): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
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
