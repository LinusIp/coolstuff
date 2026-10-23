/**
 * Registers the site's service worker (CLAUDE.md §1: the whole site works
 * offline after the first visit). The worker and its precache manifest are
 * generated at build time by the integration-owned PWA plugin (PLAN.md
 * "Integration"); this only registers it and hands it the assets this first
 * visit already loaded, so the page works offline right away.
 *
 * The worker lives at the site root next to `manifest.webmanifest`. Every
 * page links the manifest with a correct relative href (lessons:
 * `../../../manifest.webmanifest`), so the default URL is derived from that
 * link and works at any depth and under a GitHub Pages sub-path. Pass `swUrl`
 * only to override. No-op in dev and where service workers are unavailable.
 */
export function serviceWorkerUrl(doc: Pick<Document, 'querySelector' | 'baseURI'> | undefined = typeof document === 'undefined' ? undefined : document): string | null {
  const href = doc?.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
  if (!href) return null;
  return new URL('sw.js', href).href;
}

export function registerPWA(swUrl?: string): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const url = swUrl ?? serviceWorkerUrl();
  if (!url) {
    console.info('No <link rel="manifest"> on this page; skipping offline support.');
    return;
  }
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register(url);
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
