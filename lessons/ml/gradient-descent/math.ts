/**
 * Gradient descent: the pure maths behind the lesson's visuals. Node-safe
 * (imports only @kit/pure and @kit/math), tested in lesson.test.ts.
 *
 * Everything here is plain gradient descent with a fixed learning rate η:
 *
 *     θ_{t+1} = θ_t − η ∇L(θ_t)
 *
 * on small two-parameter loss surfaces with exact (analytic) gradients. There
 * is no physics: the "ball" jumps from iterate to iterate; the figures only
 * tween between them for the eye. NOTES.md lists the exact loss functions.
 */
import { add, dist, dot, eig2, gdPath, norm, rotation2, scale, sub, type Mat2, type Vec2 } from '@kit/math';
import { formatNumber, type ViewBox } from '@kit/pure';

// ── Landscapes ──────────────────────────────────────────────────────────────

export type LandscapeId = 'bowl' | 'valley' | 'bumpy';

export interface Minimum {
  at: Vec2;
  /** Loss at the minimum (the global one is 0 by construction). */
  loss: number;
  global: boolean;
}

export interface Landscape {
  id: LandscapeId;
  /** Short name for the segmented control. */
  name: string;
  loss: (x: number, y: number) => number;
  grad: (p: Readonly<Vec2>) => Vec2;
  /** The world rectangle the map shows. */
  view: ViewBox;
  /** Where the ball starts until the learner drags it. */
  start: Vec2;
  minima: readonly Minimum[];
  /** Contour levels (loss values), low to high. */
  levels: readonly number[];
  /** Loss at which the heat shading saturates. */
  heatMax: number;
}

/**
 * A quadratic bowl L(θ) = ½ (θ − m)ᵀ H (θ − m) with H = R diag(λ₁, λ₂) Rᵀ,
 * R the rotation by `angle` (radians): λ₁ is the curvature along the
 * direction (cos angle, sin angle), λ₂ across it.
 */
export function quadraticHessian(l1: number, l2: number, angle: number): Mat2 {
  const R = rotation2(angle);
  const [c, s] = [R[0], R[2]];
  // R diag(l1, l2) Rᵀ, written out (symmetric).
  const a = l1 * c * c + l2 * s * s;
  const b = (l1 - l2) * c * s;
  const d = l1 * s * s + l2 * c * c;
  return [a, b, b, d];
}

export function quadraticLoss(H: Readonly<Mat2>, m: Readonly<Vec2>) {
  const loss = (x: number, y: number) => {
    const u = x - m[0];
    const v = y - m[1];
    return 0.5 * (H[0] * u * u + (H[1] + H[2]) * u * v + H[3] * v * v);
  };
  const grad = (p: Readonly<Vec2>): Vec2 => {
    const u = p[0] - m[0];
    const v = p[1] - m[1];
    return [H[0] * u + H[1] * v, H[2] * u + H[3] * v];
  };
  return { loss, grad };
}

/** Geometric contour levels base·r^k below `max` (dense near the bottom, sparse up the walls). */
export function geometricLevels(base: number, ratio: number, max: number): number[] {
  const out: number[] = [];
  for (let L = base; L <= max * (1 + 1e-9); L *= ratio) out.push(Number(L.toPrecision(3)));
  return out;
}

/** Every map shows θ₁ ∈ [0, 8], θ₂ ∈ [0, 6], so the axes run along the plate's edges, out of the way. */
export const MAP_VIEW: ViewBox = { x: [0, 8], y: [0, 6] };

/** The round bowl: the same curvature (2) in every direction. */
export const BOWL_M: Vec2 = [4.5, 2.75];
export const BOWL_H: Mat2 = quadraticHessian(2, 2, 0);

/** The long valley: curvature 0.5 along a valley floor tilted 20°, 4 across it (condition number 8). */
export const VALLEY_M: Vec2 = [5, 3.5];
export const VALLEY_ANGLE = (20 * Math.PI) / 180;
export const VALLEY_LAMBDA: readonly [number, number] = [0.5, 4];
export const VALLEY_H: Mat2 = quadraticHessian(VALLEY_LAMBDA[0], VALLEY_LAMBDA[1], VALLEY_ANGLE);

/**
 * Two dips: with u = θ₁ − 4 and v = θ₂ − 3 (the map's centre),
 * L = (u² − 4)²/16 + 0.3u + 1.5(v − 0.2u)² − c: a quartic ridge in u with a
 * tilt (so the left dip is deeper) and a tilted parabola in v; c makes the
 * deeper (global) minimum exactly 0.
 */
export const BUMPY_CENTRE: Vec2 = [4, 3];
function bumpyRaw(x: number, y: number): number {
  const u = x - BUMPY_CENTRE[0];
  const q = u * u - 4;
  const r = y - BUMPY_CENTRE[1] - 0.2 * u;
  return (q * q) / 16 + 0.3 * u + 1.5 * r * r;
}
export function bumpyGradRaw(p: Readonly<Vec2>): Vec2 {
  const u = p[0] - BUMPY_CENTRE[0];
  const r = p[1] - BUMPY_CENTRE[1] - 0.2 * u;
  // ∂/∂θ₁: u(u² − 4)/4 + 0.3 − 0.6 r ;  ∂/∂θ₂: 3 r
  return [(u * (u * u - 4)) / 4 + 0.3 - 0.6 * r, 3 * r];
}
export function bumpyHessian(p: Readonly<Vec2>): Mat2 {
  const u = p[0] - BUMPY_CENTRE[0];
  // ∂²/∂θ₁² = (3u² − 4)/4 + 0.12 ; ∂²/∂θ₁∂θ₂ = −0.6 ; ∂²/∂θ₂² = 3
  return [(3 * u * u - 4) / 4 + 0.12, -0.6, -0.6, 3];
}

/** Newton's method on the gradient (a stationary point near `guess`). */
export function newtonStationary(grad: (p: Readonly<Vec2>) => Vec2, hess: (p: Readonly<Vec2>) => Mat2, guess: Vec2, iters = 50): Vec2 {
  let p: Vec2 = [guess[0], guess[1]];
  for (let k = 0; k < iters; k++) {
    const g = grad(p);
    const [a, b, c, d] = hess(p);
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-14) break;
    const step: Vec2 = [(d * g[0] - b * g[1]) / det, (-c * g[0] + a * g[1]) / det];
    p = sub(p, step);
    if (norm(step) < 1e-14) break;
  }
  return p;
}

const BUMPY_LEFT = newtonStationary(bumpyGradRaw, bumpyHessian, [1.9, 2.6]);
const BUMPY_RIGHT = newtonStationary(bumpyGradRaw, bumpyHessian, [5.9, 3.4]);
const BUMPY_SHIFT = bumpyRaw(BUMPY_LEFT[0], BUMPY_LEFT[1]);
export const bumpyLoss = (x: number, y: number) => bumpyRaw(x, y) - BUMPY_SHIFT;

function quadraticLandscape(id: LandscapeId, name: string, H: Mat2, m: Vec2, start: Vec2, levels: number[], heatMax: number): Landscape {
  const { loss, grad } = quadraticLoss(H, m);
  return { id, name, loss, grad, view: MAP_VIEW, start, minima: [{ at: m, loss: 0, global: true }], levels, heatMax };
}

export const LANDSCAPES: Readonly<Record<LandscapeId, Landscape>> = {
  bowl: quadraticLandscape('bowl', 'Round bowl', BOWL_H, BOWL_M, [1.4, 4.9], geometricLevels(0.25, 2, 40), 24),
  valley: quadraticLandscape('valley', 'Long valley', VALLEY_H, VALLEY_M, [1, 5], geometricLevels(0.125, 2, 40), 24),
  bumpy: {
    id: 'bumpy',
    name: 'Two dips',
    loss: bumpyLoss,
    grad: bumpyGradRaw,
    view: MAP_VIEW,
    start: [4.9, 5.3],
    minima: [
      { at: BUMPY_LEFT, loss: 0, global: true },
      { at: BUMPY_RIGHT, loss: bumpyLoss(BUMPY_RIGHT[0], BUMPY_RIGHT[1]), global: false },
    ],
    levels: [0.1, 0.3, 0.6, 1, 1.2, 1.45, 1.8, 2.4, 3.2, 4.5, 6.5, 9.5, 14],
    heatMax: 20,
  },
};

export const LANDSCAPE_IDS: readonly LandscapeId[] = ['bowl', 'valley', 'bumpy'];

// ── Running gradient descent ────────────────────────────────────────────────

/** How close (world units) the ball must stay to a minimum to count as "at the bottom". */
export const ARRIVE_TOL = 0.1;

export type RunOutcome =
  /** Settled within ARRIVE_TOL of the deepest minimum. */
  | 'arrived'
  /** Settled within ARRIVE_TOL of a minimum that isn't the deepest. */
  | 'local'
  /** Left the map's neighbourhood or blew up. */
  | 'diverged'
  /** Still bouncing across the valley at the end (steps alternate direction). */
  | 'bouncing'
  /** Still heading downhill at the end, not there yet. */
  | 'crawling';

export interface Run {
  /** θ₀ … θ_n (truncated at the step that left the map, which is replaced by the point where it crosses the map's far edge). */
  points: Vec2[];
  /** L(θ_k) for each kept point (the crossing point gets the loss of the step it stands for). */
  losses: number[];
  outcome: RunOutcome;
  /** First step k after which every iterate stays within ARRIVE_TOL of the minimum it settles in (null if none). */
  settledAt: number | null;
  /** Index of the minimum it settled in (into landscape.minima), or null. */
  minimum: number | null;
  /** The step whose iterate left the map (diverged runs only). */
  exitStep: number | null;
  /** Steps whose direction reverses (angle > 90° to the previous step), counted over the whole run. */
  reversals: number;
}

/** The view grown by `k` times its size on every side: points beyond it have "left the map". */
export function farBox(view: ViewBox, k = 0.5): ViewBox {
  const w = view.x[1] - view.x[0];
  const h = view.y[1] - view.y[0];
  return { x: [view.x[0] - k * w, view.x[1] + k * w], y: [view.y[0] - k * h, view.y[1] + k * h] };
}

export const inBox = (p: Readonly<Vec2>, b: ViewBox) => p[0] >= b.x[0] && p[0] <= b.x[1] && p[1] >= b.y[0] && p[1] <= b.y[1];

/** Where the segment from `a` (inside b) towards `p` (outside or non-finite) crosses b's edge. */
export function exitPoint(a: Readonly<Vec2>, p: Readonly<Vec2>, b: ViewBox): Vec2 {
  let d = sub(p, a);
  if (!Number.isFinite(d[0]) || !Number.isFinite(d[1])) d = [Math.sign(d[0]) || 0, Math.sign(d[1]) || 0];
  let t = Infinity;
  if (d[0] > 0) t = Math.min(t, (b.x[1] - a[0]) / d[0]);
  if (d[0] < 0) t = Math.min(t, (b.x[0] - a[0]) / d[0]);
  if (d[1] > 0) t = Math.min(t, (b.y[1] - a[1]) / d[1]);
  if (d[1] < 0) t = Math.min(t, (b.y[0] - a[1]) / d[1]);
  if (!Number.isFinite(t)) return [a[0], a[1]];
  return add(a, scale(d, Math.max(0, t)));
}

/**
 * Run n steps of gradient descent with learning rate η from θ₀ on a
 * landscape and describe what happened (the Play figure's readout and
 * mission read this).
 */
export function runGD(land: Landscape, theta0: Readonly<Vec2>, eta: number, n: number): Run {
  const box = farBox(land.view);
  const raw = gdPath<Vec2>((p) => land.grad(p), [theta0[0], theta0[1]], eta, n, { divergeAt: 1e9 }).points;
  const points: Vec2[] = [];
  const losses: number[] = [];
  let exitStep: number | null = null;
  for (let k = 0; k < raw.length; k++) {
    const p = raw[k];
    if (k > 0 && (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !inBox(p, box))) {
      const q = exitPoint(points[k - 1], p, box);
      points.push(q);
      const L = land.loss(p[0], p[1]);
      losses.push(Number.isFinite(L) ? L : Number.MAX_VALUE);
      exitStep = k;
      break;
    }
    points.push([p[0], p[1]]);
    losses.push(land.loss(p[0], p[1]));
  }
  let reversals = 0;
  for (let k = 2; k < points.length; k++) {
    if (dot(sub(points[k], points[k - 1]), sub(points[k - 1], points[k - 2])) < 0) reversals++;
  }
  if (exitStep !== null) return { points, losses, outcome: 'diverged', settledAt: null, minimum: null, exitStep, reversals };

  // Settled: the first step after which every iterate stays near one minimum.
  const last = points.length - 1;
  for (let i = 0; i < land.minima.length; i++) {
    const m = land.minima[i];
    if (dist(points[last], m.at) >= ARRIVE_TOL) continue;
    let k = last;
    while (k > 0 && dist(points[k - 1], m.at) < ARRIVE_TOL) k--;
    return { points, losses, outcome: m.global ? 'arrived' : 'local', settledAt: k, minimum: i, exitStep: null, reversals };
  }
  // Not settled: bouncing if the last few steps keep reversing, else crawling.
  let recent = 0;
  for (let k = Math.max(2, last - 3); k <= last; k++) {
    if (dot(sub(points[k], points[k - 1]), sub(points[k - 1], points[k - 2])) < 0) recent++;
  }
  return { points, losses, outcome: recent >= 2 ? 'bouncing' : 'crawling', settledAt: null, minimum: null, exitStep: null, reversals };
}

/**
 * One sentence for a run, as seen at timeline frame `frame` (default: the
 * end): the Play figure's readout status. Before the ball gets where the run
 * ends up, it says where it is heading.
 */
export function describeRun(r: Run, l: Landscape, n: number, frame = n): string {
  const end = r.points[r.points.length - 1];
  const steps = (k: number) => `${k} ${k === 1 ? 'step' : 'steps'}`;
  switch (r.outcome) {
    case 'arrived': {
      const k = r.settledAt ?? 0;
      const zig = r.reversals >= 3 ? ', zig-zagging' : '';
      return frame >= k ? `Reached the bottom in ${steps(k)}${zig}.` : `On its way${zig}: it reaches the bottom at step ${k}.`;
    }
    case 'local': {
      const k = r.settledAt ?? 0;
      return frame >= k ? `Settled in a dip after ${steps(k)}, but not the lowest one.` : `On its way into a dip it reaches at step ${k}, but not the lowest one.`;
    }
    case 'diverged':
      return frame >= (r.exitStep ?? 0) ? `Overshot further every step: off the map at step ${r.exitStep}.` : `Overshooting further every step: off the map at step ${r.exitStep}.`;
    case 'bouncing':
      return `Still bouncing from wall to wall after ${steps(n)}.`;
    case 'crawling': {
      const d = Math.min(...l.minima.map((m) => dist(end, m.at)));
      return `Still rolling after ${steps(n)}, ${formatNumber(d, 2)} from the bottom.`;
    }
  }
}

/** The ball has settled at the deepest minimum by timeline frame `frame` (the "found it" state). */
export const arrivedBy = (r: Run, frame: number) => r.outcome === 'arrived' && r.settledAt !== null && frame >= r.settledAt;

/** The ball at frame k (frames past the end of a truncated run stay on its last point). */
export function pointAt(run: Run, k: number): Vec2 {
  const i = Math.max(0, Math.min(run.points.length - 1, Math.round(k)));
  return run.points[i];
}

// ── Quadratic theory (the convergence condition and step counts) ───────────

/** Eigenvalues of a symmetric 2×2 matrix, largest first. */
export function symEigenvalues(H: Readonly<Mat2>): [number, number] {
  const e = eig2(H);
  if (!e.real) throw new Error('symEigenvalues: not symmetric');
  const [a, b] = e.values;
  return a >= b ? [a, b] : [b, a];
}

/** Gradient descent on a quadratic with curvatures λ converges iff 0 < η < 2/λ_max. */
export const maxStableRate = (lambdaMax: number) => 2 / lambdaMax;

/** The per-step factor along a direction of curvature λ: the error there is multiplied by (1 − ηλ) each step. */
export const stepFactor = (eta: number, lambda: number) => 1 - eta * lambda;

/** The learning rate that makes the slowest direction as fast as possible: 2/(λ_min + λ_max). */
export const bestRate = (lambdaMin: number, lambdaMax: number) => 2 / (lambdaMin + lambdaMax);

/** The worst per-step factor max_i |1 − ηλ_i| (the run converges iff this is < 1). */
export function contraction(eta: number, lambdas: readonly number[]): number {
  return Math.max(...lambdas.map((l) => Math.abs(stepFactor(eta, l))));
}

/** Smallest k with ρ^k ≤ ratio (how many steps shrink an error by `ratio` when each step multiplies it by ρ). */
export function stepsToShrink(rho: number, ratio: number): number {
  if (!(rho > 0)) return rho === 0 ? 1 : Infinity;
  if (rho >= 1) return Infinity;
  return Math.max(0, Math.ceil(Math.log(ratio) / Math.log(rho) - 1e-12));
}
