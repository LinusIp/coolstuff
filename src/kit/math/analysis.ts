/**
 * Multivariable and root-finding helpers that several lessons share
 * (gradient descent, calc3 gradient and Lagrange, DL optimizers, eigenvalues,
 * the derivative's secant): kept here so lessons never import each other's
 * math.ts. Pure; tested against analytic values in analysis.test.ts.
 */
import type { Complex, Mat2 } from './mat';
import type { Vec2 } from './vec';

export type Fn2 = (x: number, y: number) => number;

/** ∇f at p by central differences: [∂f/∂x, ∂f/∂y]. */
export function gradient2(f: Fn2, p: Readonly<Vec2>, h = 1e-5): Vec2 {
  const [x, y] = p;
  return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
}

/** The Hessian at p by central differences, row-major [fxx, fxy, fyx, fyy] (symmetric). */
export function hessian2(f: Fn2, p: Readonly<Vec2>, h = 1e-4): Mat2 {
  const [x, y] = p;
  const f0 = f(x, y);
  const fxx = (f(x + h, y) - 2 * f0 + f(x - h, y)) / (h * h);
  const fyy = (f(x, y + h) - 2 * f0 + f(x, y - h)) / (h * h);
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h);
  return [fxx, fxy, fxy, fyy];
}

/**
 * The secant slope (f(x + h) − f(x)) / h, the derivative's difference
 * quotient. NaN at h = 0 by design: a slider for h must exclude 0
 * (SliderScale `exclude: [0]`), and the lesson should say why.
 */
export function secantSlope(f: (x: number) => number, x: number, h: number): number {
  if (h === 0) return NaN;
  return (f(x + h) - f(x)) / h;
}

/** Roots of a·x² + b·x + c, computed without cancellation. */
export type QuadraticRoots =
  /** Two distinct real roots, larger first. */
  | { kind: 'real'; roots: [number, number] }
  /** One double root. */
  | { kind: 'repeated'; roots: [number] }
  /** A complex-conjugate pair re ± i·im (im > 0). */
  | { kind: 'complex'; roots: [Complex, Complex] }
  /** a = 0: the line b·x + c (no root if b = 0, unless c = 0 too, when every x is a root: `all`). */
  | { kind: 'linear'; roots: number[]; all?: boolean };

/**
 * Stable quadratic formula: q = −(b + sign(b)·√disc)/2, roots q/a and c/q,
 * so a tiny root of x² − 1e8 x + 1 isn't lost to cancellation. `tol` is the
 * relative discriminant threshold below which the root counts as repeated.
 */
export function quadraticRoots(a: number, b: number, c: number, tol = 1e-12): QuadraticRoots {
  if (a === 0) {
    if (b === 0) return c === 0 ? { kind: 'linear', roots: [], all: true } : { kind: 'linear', roots: [] };
    return { kind: 'linear', roots: [-c / b] };
  }
  const disc = b * b - 4 * a * c;
  const scale = Math.max(b * b, Math.abs(4 * a * c), 1e-300);
  if (Math.abs(disc) <= tol * scale) return { kind: 'repeated', roots: [-b / (2 * a)] };
  if (disc < 0) {
    const re = -b / (2 * a);
    const im = Math.sqrt(-disc) / (2 * Math.abs(a));
    return { kind: 'complex', roots: [{ re, im }, { re, im: -im }] };
  }
  const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(disc));
  const r1 = q / a;
  const r2 = q !== 0 ? c / q : -r1;
  return { kind: 'real', roots: r1 >= r2 ? [r1, r2] : [r2, r1] };
}

/**
 * The characteristic polynomial of a 2×2 matrix, det(M − λI) = λ² − tr(M)·λ + det(M),
 * as coefficients from the highest power down: [1, −tr, det] (feed it to
 * `quadraticRoots(...)` or core/pretty `polyTex(coeffs, '\\lambda')`).
 */
export function charPoly2(m: Readonly<Mat2>): [number, number, number] {
  const tr = m[0] + m[3];
  const det = m[0] * m[3] - m[1] * m[2];
  return [1, -tr + 0, det + 0];
}

export interface GdOptions {
  /** Stop early when ‖x‖ or |f| passes this (the run diverged). Default 1e6. */
  divergeAt?: number;
  /** Stop early when a step moves less than this (converged). Default 0 (never). */
  tol?: number;
}

export interface GdPath<P> {
  /** Iterates x₀, x₁, …, including the start. */
  points: P[];
  /** 'diverged' if the iterates blew past `divergeAt` (or went non-finite), 'converged' if a step fell below `tol`, else 'steps'. */
  stop: 'steps' | 'diverged' | 'converged';
}

const normOf = (p: number | readonly number[]): number => (typeof p === 'number' ? Math.abs(p) : Math.hypot(...p));

/**
 * Plain gradient descent: x_{k+1} = x_k − η ∇f(x_k), for a scalar or a vector
 * parameter, n steps (or until it diverges / converges). The iterates are
 * what visuals draw (the ball's path on the loss surface) and what tests
 * check ("η = 0.1 converges to the minimum; η = 1.1 diverges").
 */
export function gdPath<P extends number | Vec2 | readonly number[]>(grad: (x: P) => P, x0: P, eta: number, n: number, opts: GdOptions = {}): GdPath<P> {
  const divergeAt = opts.divergeAt ?? 1e6;
  const tol = opts.tol ?? 0;
  const points: P[] = [x0];
  let x = x0;
  for (let k = 0; k < n; k++) {
    const g = grad(x);
    const next = (typeof x === 'number' ? x - eta * (g as number) : (x as readonly number[]).map((xi, i) => xi - eta * (g as readonly number[])[i])) as P;
    points.push(next);
    const size = normOf(next);
    if (!Number.isFinite(size) || size > divergeAt) return { points, stop: 'diverged' };
    const moved = typeof x === 'number' ? Math.abs((next as number) - x) : Math.hypot(...(next as readonly number[]).map((v, i) => v - (x as readonly number[])[i]));
    x = next;
    if (tol > 0 && moved < tol) return { points, stop: 'converged' };
  }
  return { points, stop: 'steps' };
}
