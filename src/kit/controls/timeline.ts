/**
 * Pure stepping and timing rules behind Stepper and PlayScrub (tested in
 * timeline.test.ts). No DOM.
 */

/** One step from `i` in direction `dir` over `count` positions; clamps, or wraps around with `wrap`. */
export function stepIndex(i: number, dir: number, count: number, wrap = false): number {
  if (count <= 0) return 0;
  const cur = clampIndex(i, count);
  const next = cur + Math.sign(dir) * Math.max(1, Math.round(Math.abs(dir)));
  if (wrap) return ((next % count) + count) % count;
  return clampIndex(next, count);
}

/** `i` rounded and kept inside 0…count − 1. */
export function clampIndex(i: number, count: number): number {
  if (count <= 0 || !Number.isFinite(i)) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(i)));
}

/** Frames per second never exceed this under reduced motion: play still steps (it's discrete), slowly. */
export const REDUCED_MOTION_MAX_FPS = 2;
/** The fastest any timeline plays. */
export const MAX_FPS = 60;

/** Milliseconds between frames for `fps`, capped at 2 fps under reduced motion. */
export function frameInterval(fps: number, reducedMotion: boolean): number {
  const f = Math.min(Number.isFinite(fps) && fps > 0 ? fps : 2, reducedMotion ? REDUCED_MOTION_MAX_FPS : MAX_FPS);
  return 1000 / f;
}

/**
 * What playing does on the next tick: advance a frame, wrap to 0 with `loop`,
 * or stop on the last frame. Pressing play on the last frame (without loop)
 * restarts from 0, the convention of every media player.
 */
export function playTick(frame: number, count: number, loop: boolean): { frame: number; stop: boolean } {
  if (count <= 1) return { frame: 0, stop: true };
  const f = clampIndex(frame, count);
  if (f < count - 1) {
    const next = f + 1;
    return { frame: next, stop: !loop && next === count - 1 };
  }
  return loop ? { frame: 0, stop: false } : { frame: f, stop: true };
}

/** The frame play starts from: the current one, or 0 if it is already at the end (and not looping). */
export function playStart(frame: number, count: number): number {
  const f = clampIndex(frame, count);
  return f >= count - 1 ? 0 : f;
}

/** "3 / 12", the default PlayScrub counter (the visible frame number is 1-based). */
export function frameCounter(i: number, count: number): string {
  return count > 0 ? `${clampIndex(i, count) + 1} / ${count}` : '0 / 0';
}

/**
 * Scrolly: the step whose box is nearest a horizontal reading line (the
 * viewport centre, or the centre of what the pinned visual leaves free). A
 * box the line passes through wins outright; otherwise the closest edge.
 */
export function nearestToLine(boxes: readonly { top: number; bottom: number }[], line: number): number {
  let best = 0;
  let bestD = Infinity;
  boxes.forEach((b, k) => {
    const d = line < b.top ? b.top - line : line > b.bottom ? line - b.bottom : 0;
    if (d < bestD) {
      best = k;
      bestD = d;
    }
  });
  return best;
}
