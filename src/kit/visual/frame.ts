/**
 * At most one update per animation frame. Two tools, both DOM-free (the
 * frame scheduler is injected, so tests drive them with a fake clock):
 *
 * - `createFrameWriter(write)`: a drag produces many pointer events per frame
 *   on some devices; the writer keeps only the last value and writes it once
 *   in the next frame, so a signal (and everything that reads it) updates at
 *   most once per frame.
 * - `frameEffect(run)`: like a signals `effect`, it re-runs when a signal that
 *   `run` read changes, but coalesces changes into one run per frame
 *   (CanvasLayer's `draw`, Stage3D's scene). The first run is synchronous.
 */
import { effect, untracked } from '@preact/signals';

export interface FrameScheduler {
  request(cb: () => void): number;
  cancel(id: number): void;
}

/** The browser's requestAnimationFrame, resolved when called (never at import time). */
export const rafScheduler: FrameScheduler = {
  request: (cb) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number)),
  cancel: (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id)),
};

export interface FrameWriter<T> {
  /** Queue a value; only the latest queued value is written, in the next frame. */
  push(value: T): void;
  /** Write the pending value now (e.g. on pointerup, so the final position is exact). */
  flush(): void;
  /** Drop the pending value. */
  cancel(): void;
  readonly pending: boolean;
}

export function createFrameWriter<T>(write: (value: T) => void, scheduler: FrameScheduler = rafScheduler): FrameWriter<T> {
  let id = 0;
  let has = false;
  let value: T;
  const run = () => {
    id = 0;
    if (!has) return;
    has = false;
    write(value);
  };
  return {
    push(v) {
      value = v;
      has = true;
      if (!id) id = scheduler.request(run);
    },
    flush() {
      if (id) scheduler.cancel(id);
      run();
    },
    cancel() {
      if (id) scheduler.cancel(id);
      id = 0;
      has = false;
    },
    get pending() {
      return has;
    },
  };
}

/**
 * Run `run` now (tracking the signals it reads), then again at most once per
 * frame after any of them changes. Returns a disposer.
 */
export function frameEffect(run: () => void, scheduler: FrameScheduler = rafScheduler): () => void {
  let disposed = false;
  let id = 0;
  let stop: (() => void) | null = null;
  const start = () => {
    id = 0;
    if (disposed) return;
    stop?.();
    let first = true;
    stop = effect(() => {
      if (first) {
        first = false;
        run();
        return;
      }
      // A dependency changed: schedule one fresh tracked run next frame.
      untracked(() => {
        if (!id && !disposed) id = scheduler.request(start);
      });
    });
  };
  start();
  return () => {
    disposed = true;
    if (id) scheduler.cancel(id);
    stop?.();
    stop = null;
  };
}
