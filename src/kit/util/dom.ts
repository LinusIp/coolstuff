/**
 * Tiny DOM helpers for components that draw imperatively (SVG/canvas layers,
 * animations). Browser-only unless noted.
 */
import { easeInOut } from '../math/scalar';
import { prefersReducedMotion } from './capabilities';

let counter = 0;
/** Unique id for aria wiring outside Preact (inside components prefer `useId()` from preact/hooks). */
export const uid = (prefix = 'k'): string => `${prefix}-${(++counter).toString(36)}`;

/**
 * Animate t from 0 to 1 over `ms` (DESIGN.md §10 durations), calling
 * `step(eased t)` each frame. Under reduced motion it jumps straight to 1.
 * Resolves when done or aborted.
 */
export function tween(ms: number, step: (t: number) => void, opts: { ease?: (t: number) => number; signal?: AbortSignal } = {}): Promise<void> {
  const ease = opts.ease ?? easeInOut;
  return new Promise((resolve) => {
    if (prefersReducedMotion() || ms <= 0 || typeof requestAnimationFrame === 'undefined') {
      step(1);
      resolve();
      return;
    }
    const t0 = performance.now();
    const frame = (now: number) => {
      if (opts.signal?.aborted) return resolve();
      const t = Math.min(1, (now - t0) / ms);
      step(ease(t));
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/** Coalesce many calls into one per animation frame (drag handlers, resize). */
export function rafThrottle(fn: () => void): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

/** Run `fn` once calls stop for `ms` (trailing edge). Works in Node. */
export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

let liveRegion: HTMLElement | null = null;
/**
 * Announce a short message to screen readers through one shared polite live
 * region ("Swapped 8 and 1", "Step 3 of 5"). Visual feedback should also be
 * in an aria-live element; this is for changes that have no text on screen.
 */
export function announce(message: string): void {
  if (typeof document === 'undefined') return;
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    document.body.append(liveRegion);
  }
  // Clearing first makes repeated identical messages announce again.
  liveRegion.textContent = '';
  const region = liveRegion;
  setTimeout(() => (region.textContent = message), 30);
}

/** The bits of `window` that `printWithClass` touches (injectable for tests). */
export interface PrintHost {
  document: { body: { classList: { add(c: string): void; remove(c: string): void } } };
  print(): void;
  addEventListener(type: 'afterprint', fn: () => void, opts?: { once?: boolean }): void;
  removeEventListener(type: 'afterprint', fn: () => void): void;
  matchMedia?(q: string): { matches: boolean; addEventListener(t: 'change', fn: (e: { matches: boolean }) => void): void; removeEventListener(t: 'change', fn: (e: { matches: boolean }) => void): void };
}

/**
 * Print with a body class on (TLDR's "Print card": `printWithClass('print-card')`).
 * `print()` doesn't block on iOS Safari or Firefox Android, so the class is
 * removed on `afterprint` (or when the print media query turns off), never
 * synchronously; the returned function removes it early if needed.
 */
export function printWithClass(className: string, host: PrintHost | undefined = typeof window === 'undefined' ? undefined : (window as unknown as PrintHost)): () => void {
  if (!host) return () => {};
  const body = host.document.body;
  body.classList.add(className);
  const mq = host.matchMedia?.('print');
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    body.classList.remove(className);
    host.removeEventListener('afterprint', cleanup);
    mq?.removeEventListener('change', onMedia);
  };
  const onMedia = (e: { matches: boolean }) => {
    if (!e.matches) cleanup();
  };
  host.addEventListener('afterprint', cleanup, { once: true });
  mq?.addEventListener('change', onMedia);
  host.print();
  return cleanup;
}

/** Set SVG/HTML attributes, skipping unchanged writes; numbers are rounded to 0.01. null removes. */
export function attr(el: Element, attrs: Record<string, string | number | null | undefined>): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) {
      if (el.hasAttribute(k)) el.removeAttribute(k);
      continue;
    }
    const sv = typeof v === 'number' ? (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0') : v;
    if (el.getAttribute(k) !== sv) el.setAttribute(k, sv);
  }
}

/** A canvas sized for the device pixel ratio (clamped), returning its 2D context scaled to CSS pixels. */
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number, maxDpr = 2): CanvasRenderingContext2D | null {
  const dpr = Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1, maxDpr);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
