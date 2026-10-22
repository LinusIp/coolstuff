/** Feature checks shared by projects. Keep these cheap and side-effect free. */

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function hasWebGPU(): boolean {
  return 'gpu' in navigator;
}

/** Device pixel ratio clamped so phones with DPR 3 don't render 9x the pixels. */
export function clampedDpr(max = 2): number {
  return Math.min(window.devicePixelRatio || 1, max);
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
      /* storage unavailable: the project still works, it just forgets */
    }
  },
};
