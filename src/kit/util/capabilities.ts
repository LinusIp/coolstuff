/**
 * Feature checks. Cheap, side-effect free, and safe to call in Node (they
 * report "no" instead of throwing when `window` is missing).
 */

const hasWindow = (): boolean => typeof window !== 'undefined';

export function prefersReducedMotion(): boolean {
  return hasWindow() && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isTouchDevice(): boolean {
  if (!hasWindow()) return false;
  return (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
}

export function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/** Device pixel ratio clamped so phones with DPR 3 don't render 9× the pixels. */
export function clampedDpr(max = 2): number {
  return hasWindow() ? Math.min(window.devicePixelRatio || 1, max) : 1;
}

/** localStorage that never throws (private mode, blocked storage, quota). */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable: the page still works, it just forgets */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
