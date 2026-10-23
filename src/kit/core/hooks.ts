/**
 * Small Preact hooks every component group needs. Each is safe to call during
 * a Node render (guards `window`), so tests and prerendering don't crash.
 */
import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { currentTheme, onThemeChange, type ThemeName } from '../theme';
import { getProgress } from './progress';
import type { ProgressData } from '../types';

const hasWindow = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/** Re-renders when the media query flips. */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => (hasWindow() ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!hasWindow()) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** True when the learner asked for less motion: skip tweens, jump to end states. */
export const useReducedMotion = (): boolean => useMediaQuery('(prefers-reduced-motion: reduce)');

/** True below the 700px phone breakpoint (DESIGN.md §3). */
export const usePhone = (): boolean => useMediaQuery('(max-width: 699px)');

/** True on touch-first devices (coarse pointer). */
export const useCoarsePointer = (): boolean => useMediaQuery('(pointer: coarse)');

/** The visible theme; canvas/WebGL drawers re-read concept hexes when it changes. */
export function useTheme(): ThemeName {
  const [t, setT] = useState<ThemeName>(() => currentTheme());
  useEffect(() => onThemeChange(setT), []);
  return t;
}

/**
 * What the measuring hooks observe: an element (best: from a callback ref,
 * `const [el, setEl] = useState<HTMLElement | null>(null); <div ref={setEl}>`,
 * which also catches elements that mount later), or a RefObject.
 */
export type ObserveTarget = RefObject<Element> | Element | null | undefined;

const resolve = (t: ObserveTarget): Element | null => (t && 'current' in t ? t.current : (t ?? null));

/**
 * Attach an observer to the target's element, re-attaching whenever that
 * element changes. With a RefObject the check runs after every render, so a
 * ref'd node that appears on a later render (a revealed panel, a lazy tab) is
 * still observed; a node mounted by a child without re-rendering this
 * component needs the callback-ref form.
 */
function useObserved(target: ObserveTarget, attach: (el: Element) => () => void, deps: readonly unknown[]): void {
  const current = useRef<{ el: Element | null; detach: (() => void) | null }>({ el: null, detach: null });
  const attachRef = useRef(attach);
  attachRef.current = attach;
  const el = target && !('current' in target) ? target : null;
  // Element targets: a normal dependency. RefObject targets: checked after every render.
  useEffect(() => {
    const next = resolve(target);
    if (next === current.current.el) return;
    current.current.detach?.();
    current.current = { el: next, detach: next ? attachRef.current(next) : null };
  });
  const firstRun = useRef(true);
  useEffect(() => {
    // Options changed: re-attach to the same element (not on mount: the effect above attached already).
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const c = current.current;
    if (!c.el) return;
    c.detach?.();
    c.detach = attachRef.current(c.el);
  }, [el, ...deps]);
  useEffect(
    () => () => {
      current.current.detach?.();
      current.current = { el: null, detach: null };
    },
    [],
  );
}

/** Content-box size of an element (ResizeObserver), {0, 0} until measured. Accepts an element (callback ref) or a RefObject. */
export function useElementSize(target: ObserveTarget): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useObserved(
    target,
    (el) => {
      if (typeof ResizeObserver === 'undefined') return () => {};
      const ro = new ResizeObserver((entries) => {
        const r = entries[0]?.contentRect;
        if (r) setSize((s) => (s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }));
      });
      ro.observe(el);
      return () => ro.disconnect();
    },
    [],
  );
  return size;
}

/** Whether an element is on screen (pause animations and simulations off-screen). Accepts an element (callback ref) or a RefObject. */
export function useInView(target: ObserveTarget, rootMargin = '120px'): boolean {
  const [inView, setInView] = useState(true);
  useObserved(
    target,
    (el) => {
      if (typeof IntersectionObserver === 'undefined') return () => {};
      const io = new IntersectionObserver((es) => setInView(es.some((e) => e.isIntersecting)), { rootMargin });
      io.observe(el);
      return () => io.disconnect();
    },
    [rootMargin],
  );
  return inView;
}

/** The learner's progress; re-renders when it changes (this tab or another). */
export function useProgress(): ProgressData {
  const store = getProgress();
  const [data, setData] = useState<ProgressData>(() => store.read());
  useEffect(() => store.subscribe(setData), [store]);
  return data;
}
