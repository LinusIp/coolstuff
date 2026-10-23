/**
 * Where a dragged handle may go: constraints, snapping, bounds and keyboard
 * steps. Pure (tested in constraints.test.ts); `Handle` runs every pointer
 * position and key press through `resolveHandle` / `keyMove`.
 */
import { closestOnLine, type Vec2 } from '../math/vec';
import type { ViewBox } from '../types';
import { clipLine } from './scales';

export type Constraint =
  | 'free'
  | { x: number }
  | { y: number }
  | { curve: (x: number) => number }
  | { line: readonly [Readonly<Vec2>, Readonly<Vec2>] }
  | { circle: { c: Readonly<Vec2>; r: number } }
  | ((p: Vec2) => Vec2);

const finite = (p: Readonly<Vec2>): boolean => Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** Project a point onto the constraint (the nearest allowed point). */
export function applyConstraint(p: Readonly<Vec2>, c: Constraint | undefined): Vec2 {
  if (!c || c === 'free') return [p[0], p[1]];
  if (typeof c === 'function') {
    const q = c([p[0], p[1]]);
    return finite(q) ? [q[0], q[1]] : [p[0], p[1]];
  }
  if ('x' in c) return [c.x, p[1]];
  if ('y' in c) return [p[0], c.y];
  if ('curve' in c) return [p[0], c.curve(p[0])];
  if ('line' in c) {
    const [a, b] = c.line;
    if (a[0] === b[0] && a[1] === b[1]) return [a[0], a[1]];
    return closestOnLine(p, a, b);
  }
  const { c: o, r } = c.circle;
  const dx = p[0] - o[0];
  const dy = p[1] - o[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-12) return [o[0] + r, o[1]];
  return [o[0] + (dx / L) * r, o[1] + (dy / L) * r];
}

/** Round each coordinate to a multiple of `step` (only the free axis of an x/y constraint). */
export function snapGrid(p: Readonly<Vec2>, step: number, c?: Constraint): Vec2 {
  if (!(step > 0)) return [p[0], p[1]];
  const s = (v: number) => {
    const r = Math.round(v / step) * step;
    return Math.abs(r) < step * 1e-9 ? 0 : Number(r.toFixed(10));
  };
  if (c && c !== 'free' && typeof c !== 'function') {
    if ('x' in c) return [c.x, s(p[1])];
    if ('y' in c) return [s(p[0]), c.y];
    if ('curve' in c) {
      const x = s(p[0]);
      return [x, c.curve(x)];
    }
  }
  return [s(p[0]), s(p[1])];
}

/** The nearest target within `radius` world units, else the point unchanged. */
export function snapTargets(p: Readonly<Vec2>, targets: readonly Readonly<Vec2>[], radius: number): Vec2 {
  let best: Readonly<Vec2> | null = null;
  let bestD = radius;
  for (const t of targets) {
    const d = Math.hypot(t[0] - p[0], t[1] - p[1]);
    if (d <= bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ? [best[0], best[1]] : [p[0], p[1]];
}

/**
 * Magnetic direction snap: if the arrow from `origin` to `p` is within
 * `maxDeg` of one of `dirs` (either way along it), rotate it onto that line,
 * keeping its length.
 */
export function snapDirections(p: Readonly<Vec2>, dirs: readonly Readonly<Vec2>[], maxDeg = 3, origin: Readonly<Vec2> = [0, 0]): Vec2 {
  const vx = p[0] - origin[0];
  const vy = p[1] - origin[1];
  const L = Math.hypot(vx, vy);
  if (L < 1e-9) return [p[0], p[1]];
  const lim = Math.cos((maxDeg * Math.PI) / 180);
  let best: Vec2 | null = null;
  let bestCos = lim;
  for (const d of dirs) {
    const dl = Math.hypot(d[0], d[1]);
    if (dl < 1e-12) continue;
    const ux = d[0] / dl;
    const uy = d[1] / dl;
    const cos = (vx * ux + vy * uy) / L;
    if (Math.abs(cos) >= bestCos) {
      bestCos = Math.abs(cos);
      const s = cos >= 0 ? L : -L;
      best = [origin[0] + ux * s, origin[1] + uy * s];
    }
  }
  return best ?? [p[0], p[1]];
}

/** Clamp a point into a view. */
export function clampToView(p: Readonly<Vec2>, b: ViewBox): Vec2 {
  return [Math.min(b.x[1], Math.max(b.x[0], p[0])), Math.min(b.y[1], Math.max(b.y[0], p[1]))];
}

/** The piece of a line constraint inside the bounds, or null. */
function lineInBounds(c: { line: readonly [Readonly<Vec2>, Readonly<Vec2>] }, b: ViewBox): [Vec2, Vec2] | null {
  return clipLine(c.line[0], c.line[1], { x0: b.x[0], y0: b.y[0], x1: b.x[1], y1: b.y[1] });
}

const inY = (y: number, b: ViewBox) => Number.isFinite(y) && y >= b.y[0] && y <= b.y[1];

/** Bisect between a visible x (`good`) and an invisible one (`bad`) for the last x where the curve is inside the bounds. */
function curveEdge(f: (x: number) => number, good: number, bad: number, b: ViewBox): number {
  for (let k = 0; k < 48; k++) {
    const m = (good + bad) / 2;
    if (inY(f(m), b)) good = m;
    else bad = m;
  }
  return good;
}

/**
 * The x nearest to `x` (within the bounds' x-range) where the curve is inside
 * the bounds' y-range, searching inward from `from` when that is visible, else
 * from the nearest visible sample. Returns x itself when the curve never shows.
 */
export function visibleCurveX(f: (x: number) => number, x: number, b: ViewBox, from?: number): number {
  const xc = Math.min(b.x[1], Math.max(b.x[0], x));
  if (inY(f(xc), b)) return xc;
  if (from !== undefined && from >= b.x[0] && from <= b.x[1] && inY(f(from), b)) return curveEdge(f, from, xc, b);
  const n = 400;
  let best: number | null = null;
  for (let k = 0; k <= n; k++) {
    const t = b.x[0] + ((b.x[1] - b.x[0]) * k) / n;
    if (inY(f(t), b) && (best === null || Math.abs(t - xc) < Math.abs(best - xc))) best = t;
  }
  return best === null ? xc : curveEdge(f, best, xc, b);
}

/**
 * Keep a constrained point inside the bounds without leaving its constraint.
 * A curve handle stays on the part of the curve inside the bounds (`prev`,
 * the handle's last position, decides which piece when the curve leaves and
 * re-enters).
 */
export function clampConstrained(p: Readonly<Vec2>, c: Constraint | undefined, b: ViewBox, prev?: Readonly<Vec2>): Vec2 {
  if (!c || c === 'free' || typeof c === 'function') return clampToView(p, b);
  if ('curve' in c) {
    const x = visibleCurveX(c.curve, p[0], b, prev?.[0]);
    return [x, c.curve(x)];
  }
  if ('x' in c) return [c.x, Math.min(b.y[1], Math.max(b.y[0], p[1]))];
  if ('y' in c) return [Math.min(b.x[1], Math.max(b.x[0], p[0])), c.y];
  if ('line' in c) {
    const seg = lineInBounds(c, b);
    if (!seg) return [p[0], p[1]];
    const [a, e] = seg;
    const dx = e[0] - a[0];
    const dy = e[1] - a[1];
    const L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    return [a[0] + t * dx, a[1] + t * dy];
  }
  return [p[0], p[1]]; // a circle stays a circle (the author picks bounds that contain it)
}

export interface ResolveOptions {
  constrain?: Constraint;
  /** Grid step, or magnetic point targets. */
  snap?: number | readonly Readonly<Vec2>[];
  /** Magnetic directions from `origin` (within `snapDeg`, default 3°). */
  snapDirections?: readonly Readonly<Vec2>[];
  origin?: Readonly<Vec2>;
  snapDeg?: number;
  /** World radius for point targets (Handle passes 12px in world units). */
  targetRadius?: number;
  bounds?: ViewBox;
  /** The handle's current position (keeps a curve handle on the visible piece it is on). */
  prev?: Readonly<Vec2>;
}

/** The full pipeline for a raw pointer position: constrain → snap → keep in bounds → constrain again. */
export function resolveHandle(raw: Readonly<Vec2>, o: ResolveOptions): Vec2 {
  if (!finite(raw)) return [0, 0];
  let q = applyConstraint(raw, o.constrain);
  if (typeof o.snap === 'number') q = applyConstraint(snapGrid(q, o.snap, o.constrain), o.constrain);
  else if (o.snap && o.snap.length) q = snapTargets(q, o.snap, o.targetRadius ?? 0);
  if (o.snapDirections?.length) q = snapDirections(q, o.snapDirections, o.snapDeg ?? 3, o.origin ?? [0, 0]);
  if (o.bounds) q = clampConstrained(q, o.constrain, o.bounds, o.prev);
  return finite(q) ? q : [raw[0], raw[1]];
}

export type KeyDir = 'left' | 'right' | 'up' | 'down';

/**
 * One keyboard step. Free handles move by (±step, 0) / (0, ±step). A handle
 * on a constraint moves *along* it: right/up go forward (increasing x on a
 * curve or horizontal line, increasing y on a vertical one, counter-clockwise
 * on a circle), left/down go back.
 */
export function keyMove(p: Readonly<Vec2>, dir: KeyDir, step: number, c: Constraint | undefined): Vec2 {
  const sgn = dir === 'right' || dir === 'up' ? 1 : -1;
  if (!c || c === 'free' || typeof c === 'function') {
    const d: Vec2 = dir === 'left' ? [-step, 0] : dir === 'right' ? [step, 0] : dir === 'up' ? [0, step] : [0, -step];
    return applyConstraint([p[0] + d[0], p[1] + d[1]], c);
  }
  if ('x' in c) return [c.x, p[1] + sgn * step];
  if ('y' in c) return [p[0] + sgn * step, c.y];
  if ('curve' in c) {
    const x = p[0] + sgn * step;
    return [x, c.curve(x)];
  }
  if ('line' in c) {
    const [a, b] = c.line;
    let ux = b[0] - a[0];
    let uy = b[1] - a[1];
    const L = Math.hypot(ux, uy);
    if (L < 1e-12) return [p[0], p[1]];
    ux /= L;
    uy /= L;
    if (ux < -1e-12 || (Math.abs(ux) <= 1e-12 && uy < 0)) {
      ux = -ux;
      uy = -uy;
    }
    const q = applyConstraint(p, c);
    return [q[0] + ux * sgn * step, q[1] + uy * sgn * step];
  }
  const { c: o, r } = c.circle;
  const a = Math.atan2(p[1] - o[1], p[0] - o[0]) + (sgn * step) / Math.max(r, 1e-9);
  return [o[0] + r * Math.cos(a), o[1] + r * Math.sin(a)];
}

/** Home and End for a handle on a curve, line or x/y constraint: the two ends inside the bounds. Null otherwise. */
export function constraintEnds(c: Constraint | undefined, b: ViewBox): [Vec2, Vec2] | null {
  if (!c || c === 'free' || typeof c === 'function' || 'circle' in c) return null;
  if ('curve' in c) {
    const lo = visibleCurveX(c.curve, b.x[0], b);
    const hi = visibleCurveX(c.curve, b.x[1], b);
    return [
      [lo, c.curve(lo)],
      [hi, c.curve(hi)],
    ];
  }
  if ('x' in c) return [[c.x, b.y[0]], [c.x, b.y[1]]];
  if ('y' in c) return [[b.x[0], c.y], [b.x[1], c.y]];
  const seg = lineInBounds(c, b);
  if (!seg) return null;
  // Home = the end with the smaller x (or smaller y on a vertical line), matching keyMove's "back".
  const [a, e] = seg;
  return a[0] < e[0] - 1e-12 || (Math.abs(a[0] - e[0]) <= 1e-12 && a[1] <= e[1]) ? [a, e] : [e, a];
}
