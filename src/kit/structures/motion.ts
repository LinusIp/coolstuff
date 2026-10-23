/**
 * `useFlip`: animate a view from where its elements are shown to where the
 * new state puts them (FLIP on stable ids, README §9). The component renders
 * the final positions; this hook, before paint, draws the old positions and
 * tweens to the new ones over `MOTION.step` (420ms) by calling `draw` with
 * every id's position each frame. `draw` writes attributes straight to the
 * DOM (no re-render per frame). A new state mid-tween starts from what is on
 * screen, so fast scrubbing chases smoothly. Reduced motion: no frames.
 * `instant` (a resize, a drag) jumps straight to the targets.
 */
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { MOTION } from '../theme';
import { flipFrame, flipMoves, planFlip, type Pos } from './flip';

export function useFlip(
  targets: ReadonlyMap<string, Pos>,
  draw: (pos: ReadonlyMap<string, Pos>) => void,
  reduced: boolean,
  opts: { duration?: number; instant?: boolean } = {},
): void {
  const duration = opts.duration ?? MOTION.step;
  const instant = !!opts.instant;
  const shown = useRef<Map<string, Pos> | null>(null);
  const raf = useRef(0);
  const running = useRef(false);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useLayoutEffect(() => {
    const prev = shown.current;
    const wasRunning = running.current;
    if (wasRunning) {
      cancelAnimationFrame(raf.current);
      running.current = false;
    }
    // `instant`: a resize or a drag moved things, not the algorithm, so don't animate it.
    const plan = prev && !reduced && !instant ? planFlip(prev, targets) : null;
    if (!plan || !flipMoves(plan) || typeof requestAnimationFrame === 'undefined') {
      shown.current = new Map(targets);
      // A cancelled tween may have left in-between attributes that the render didn't rewrite.
      if (wasRunning) drawRef.current(targets);
      return;
    }
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const first = flipFrame(plan, targets, 0);
    shown.current = first;
    drawRef.current(first);
    running.current = true;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const pos = flipFrame(plan, targets, t);
      shown.current = pos;
      drawRef.current(pos);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else running.current = false;
    };
    raf.current = requestAnimationFrame(tick);
  }, [targets, reduced, duration, instant]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      running.current = false;
    },
    [],
  );
}
