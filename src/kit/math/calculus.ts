/**
 * Numerical calculus, root finding and ODE steps. Pure.
 */
import { linspace } from './scalar';

/** Central-difference derivative, O(h²) accurate. */
export const derivative = (f: (x: number) => number, x: number, h = 1e-5): number => (f(x + h) - f(x - h)) / (2 * h);
export const secondDerivative = (f: (x: number) => number, x: number, h = 1e-4): number => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);

/** Composite Simpson's rule with n (rounded up to even) sub-intervals. */
export function integrate(f: (x: number) => number, a: number, b: number, n = 200): number {
  const m = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

export type RiemannRule = 'left' | 'right' | 'mid' | 'trapezoid';

/** Riemann sum with n equal sub-intervals. */
export function riemann(f: (x: number) => number, a: number, b: number, n: number, rule: RiemannRule = 'left'): number {
  const h = (b - a) / n;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h;
    if (rule === 'left') s += f(x0);
    else if (rule === 'right') s += f(x0 + h);
    else if (rule === 'mid') s += f(x0 + h / 2);
    else s += (f(x0) + f(x0 + h)) / 2;
  }
  return s * h;
}

/** Bisection on [a, b] where f changes sign. Returns null when it doesn't. */
export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-12, maxIter = 200): number | null {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (!(fa * fb < 0)) return null;
  let lo = a;
  let hi = b;
  for (let i = 0; i < maxIter && hi - lo > tol; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (fa * fm < 0) hi = mid;
    else {
      lo = mid;
      fa = fm;
    }
  }
  return (lo + hi) / 2;
}

export interface NewtonResult {
  root: number;
  converged: boolean;
  /** Every iterate x0, x1, … (handy for animating the tangent lines). */
  steps: number[];
}

/** Newton's method from x0; uses a numeric derivative when df is omitted. */
export function newton(
  f: (x: number) => number,
  x0: number,
  opts: { df?: (x: number) => number; tol?: number; maxIter?: number } = {},
): NewtonResult {
  const { tol = 1e-12, maxIter = 50 } = opts;
  const df = opts.df ?? ((x: number) => derivative(f, x));
  const steps = [x0];
  let x = x0;
  for (let i = 0; i < maxIter; i++) {
    const fx = f(x);
    const d = df(x);
    if (!Number.isFinite(fx) || !Number.isFinite(d) || Math.abs(d) < 1e-14) return { root: x, converged: false, steps };
    const next = x - fx / d;
    steps.push(next);
    if (Math.abs(next - x) <= tol * Math.max(1, Math.abs(x))) return { root: next, converged: true, steps };
    x = next;
  }
  return { root: x, converged: Math.abs(f(x)) < 1e-9, steps };
}

/** All roots of f in [a, b], found by scanning `samples` intervals for sign changes and bisecting. Skips poles. */
export function findRoots(f: (x: number) => number, a: number, b: number, samples = 400): number[] {
  const roots: number[] = [];
  const xs = linspace(a, b, samples + 1);
  let prevX = xs[0];
  let prevY = f(prevX);
  if (prevY === 0) roots.push(prevX);
  for (let i = 1; i < xs.length; i++) {
    const x = xs[i];
    const y = f(x);
    if (y === 0) roots.push(x);
    else if (Number.isFinite(prevY) && Number.isFinite(y) && prevY * y < 0) {
      const r = bisect(f, prevX, x);
      // Skip poles (sign change through infinity, e.g. tan at π/2).
      if (r !== null && Math.abs(f(r)) < 1e-6 * Math.max(1, Math.abs(prevY), Math.abs(y))) roots.push(r);
    }
    prevX = x;
    prevY = y;
  }
  return roots;
}

/** One classic RK4 step for the system y' = f(t, y). */
export function rk4Step(f: (t: number, y: readonly number[]) => number[], t: number, y: readonly number[], h: number): number[] {
  const k1 = f(t, y);
  const k2 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k1[i]));
  const k3 = f(t + h / 2, y.map((v, i) => v + (h / 2) * k2[i]));
  const k4 = f(t + h, y.map((v, i) => v + h * k3[i]));
  return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

/** One explicit (forward) Euler step for y' = f(t, y): the method the Euler's-method lesson dissects. */
export function eulerStep(f: (t: number, y: readonly number[]) => number[], t: number, y: readonly number[], h: number): number[] {
  const k = f(t, y);
  return y.map((v, i) => v + h * k[i]);
}

/**
 * One symplectic (semi-implicit) Euler step for a mechanical system with
 * position x and velocity v: v ← v + h·a(x, v, t), then x ← x + h·v. Keeps
 * oscillators' energy bounded, unlike forward Euler.
 */
export function symplecticEulerStep(
  accel: (x: readonly number[], v: readonly number[], t: number) => number[],
  t: number,
  x: readonly number[],
  v: readonly number[],
  h: number,
): { x: number[]; v: number[] } {
  const a = accel(x, v, t);
  const v2 = v.map((vi, i) => vi + h * a[i]);
  return { x: x.map((xi, i) => xi + h * v2[i]), v: v2 };
}
