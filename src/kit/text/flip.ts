/**
 * What moves when a Derivation reveals its next step (README §5.2): symbols
 * tagged with the same `\anchor` id slide from where they sat in the step
 * above to where they sit in the new one (FLIP), the k-th occurrence of an id
 * to the k-th (`pairAnchors`); unpaired symbols of the old step drop away and
 * fade, unpaired symbols of the new step fade in. Pure and tested; the
 * component only measures rects and runs the animations.
 */
import { pairAnchors } from './anchors';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlipMove {
  /** Occurrence index in the old step. */
  from: number;
  /** Occurrence index in the new step. */
  to: number;
  /** Start offset of the new symbol relative to its final place (old − new). */
  dx: number;
  dy: number;
  /** Start scale (old size ÷ new size), clamped to [0.5, 2]. */
  sx: number;
  sy: number;
}

export interface FlipPlan {
  moves: FlipMove[];
  leaving: number[];
  entering: number[];
}

/** Timings (ms): every part of a step change ends within FLIP_TOTAL_MS (DESIGN.md §10: --dur-3). */
export const FLIP_MS = 420;
export const LEAVE_MS = 300;
export const ENTER_DELAY_MS = 180;
export const ENTER_MS = 240;
export const FLIP_TOTAL_MS = Math.max(FLIP_MS, LEAVE_MS, ENTER_DELAY_MS + ENTER_MS);

const scale = (a: number, b: number): number => (a > 0 && b > 0 ? Math.min(2, Math.max(0.5, a / b)) : 1);

/** Pair the two steps' anchor occurrences and work out each slide. */
export function flipPlan(fromIds: readonly string[], toIds: readonly string[], fromRects: readonly Rect[], toRects: readonly Rect[]): FlipPlan {
  const { pairs, leaving, entering } = pairAnchors(fromIds, toIds);
  const moves = pairs
    .filter(([i, j]) => fromRects[i] && toRects[j])
    .map(([i, j]) => {
      const a = fromRects[i];
      const b = toRects[j];
      return { from: i, to: j, dx: a.left - b.left, dy: a.top - b.top, sx: scale(a.width, b.width), sy: scale(a.height, b.height) };
    });
  return { moves, leaving, entering };
}

/** The CSS transform a slide starts from (transform-origin: top left). */
export const flipTransform = (m: Pick<FlipMove, 'dx' | 'dy' | 'sx' | 'sy'>): string =>
  `translate(${Math.round(m.dx * 10) / 10}px, ${Math.round(m.dy * 10) / 10}px) scale(${Math.round(m.sx * 1000) / 1000}, ${Math.round(m.sy * 1000) / 1000})`;

/**
 * How many steps are visible: `?all` in the URL and printing show every
 * step; otherwise the current index + 1, clamped.
 */
export function visibleSteps(current: number, count: number, showAll: boolean): number {
  if (count <= 0) return 0;
  if (showAll) return count;
  return Math.min(count, Math.max(1, Math.floor(current) + 1));
}
