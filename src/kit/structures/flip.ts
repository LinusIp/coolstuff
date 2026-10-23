/**
 * FLIP for the data-structure views, as pure maths: elements keep stable ids,
 * so when a new state arrives each id slides from where it is *shown* now to
 * where the new state puts it (README §9: 420ms, instant under reduced
 * motion). Ids that are new fade in; ids that left simply go. The views'
 * `useFlip` hook (motion.ts) runs these over animation frames.
 */
import { easeInOut } from '../math/scalar';

export type Pos = readonly [number, number];

export interface FlipPlan {
  /** Ids whose shown position differs from their target. */
  moves: { key: string; from: Pos; to: Pos }[];
  /** Ids with no shown position yet (they fade in at their target). */
  entered: string[];
  /** Ids shown before that the new state no longer has. */
  exited: string[];
}

/** Compare where things are shown with where the new state puts them (moves under `eps` px are ignored). */
export function planFlip(shown: ReadonlyMap<string, Pos>, targets: ReadonlyMap<string, Pos>, eps = 0.5): FlipPlan {
  const moves: FlipPlan['moves'] = [];
  const entered: string[] = [];
  for (const [key, to] of targets) {
    const from = shown.get(key);
    if (!from) entered.push(key);
    else if (Math.abs(from[0] - to[0]) > eps || Math.abs(from[1] - to[1]) > eps) moves.push({ key, from, to });
  }
  const exited = [...shown.keys()].filter((k) => !targets.has(k));
  return { moves, entered, exited };
}

/** Positions at progress t ∈ [0, 1] (eased); ids that don't move sit at their target. */
export function flipFrame(plan: FlipPlan, targets: ReadonlyMap<string, Pos>, t: number, ease: (t: number) => number = easeInOut): Map<string, Pos> {
  const k = ease(Math.min(1, Math.max(0, t)));
  const out = new Map<string, Pos>(targets);
  for (const m of plan.moves) out.set(m.key, [m.from[0] + (m.to[0] - m.from[0]) * k, m.from[1] + (m.to[1] - m.from[1]) * k]);
  return out;
}

/** Does the plan need any animation frames? */
export const flipMoves = (plan: FlipPlan): boolean => plan.moves.length > 0;

/** Keys that are new since the previous render (they get the enter fade). */
export function enteredKeys(prev: ReadonlySet<string> | null, next: Iterable<string>): Set<string> {
  const out = new Set<string>();
  if (!prev) return out; // first render: nothing "enters"
  for (const k of next) if (!prev.has(k)) out.add(k);
  return out;
}
