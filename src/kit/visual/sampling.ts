/**
 * Turning functions and data into drawable geometry, in world coordinates.
 * Pure and tested (sampling.test.ts): adaptive sampling that refines where a
 * curve bends and BREAKS at poles, jumps and domain edges (tan x draws no
 * vertical connector), a robust automatic y-range that ignores infinities and
 * pole spikes, and the shapes behind histograms, bars, Riemann sums, shaded
 * areas and vector fields.
 */
import type { RiemannRule } from '../math/calculus';
import { histogram } from '../math/stats';
import type { Vec2 } from '../math/vec';

export type Fn1 = (x: number) => number;
export type Fn2 = (x: number, y: number) => number;

export interface SampleOptions {
  /** Initial uniform samples across the range (refinement adds more where needed). Default 160. */
  n?: number;
  /** Maximum bisection depth per initial interval. Default 9. */
  depth?: number;
  /** Pixels per world unit, used to set the tolerances in pixels. Default 1. */
  pxX?: number;
  pxY?: number;
  /** The visible y range: segments wholly off-screen on one side aren't refined. */
  yView?: readonly [number, number];
  /** Max deviation from a straight chord, in px, before refining. Default 0.35. */
  tolPx?: number;
  /** A vertical step bigger than this (px) across a fully refined interval is a jump: the curve breaks there. Default 6. */
  jumpPx?: number;
}

const isNum = (y: number): boolean => Number.isFinite(y);

/**
 * Sample y = f(x) on [x0, x1] as one or more polylines (world coordinates).
 * Runs break where f is undefined (NaN, ±∞, a throw) and across jumps/poles.
 */
export function sampleFunction(f: Fn1, x0: number, x1: number, opts: SampleOptions = {}): Vec2[][] {
  const n = Math.max(2, Math.round(opts.n ?? 160));
  const depth = opts.depth ?? 9;
  const pxY = opts.pxY ?? 1;
  const tol = (opts.tolPx ?? 0.35) / pxY;
  const jump = (opts.jumpPx ?? 6) / pxY;
  const [yLo, yHi] = opts.yView ?? [-Infinity, Infinity];
  const ySpan = Number.isFinite(yHi - yLo) ? yHi - yLo : Infinity;
  const ev = (x: number): number => {
    try {
      const y = f(x);
      return isNum(y) ? y : NaN;
    } catch {
      return NaN;
    }
  };
  const runs: Vec2[][] = [];
  let cur: Vec2[] = [];
  const brk = () => {
    if (cur.length > 1) runs.push(cur);
    else if (cur.length === 1) runs.push(cur); // an isolated point is kept (drawn as a dot by callers that want it)
    cur = [];
  };
  const push = (x: number, y: number) => {
    if (Number.isNaN(y)) brk();
    else cur.push([x, y]);
  };
  const offSameSide = (a: number, b: number, c: number): boolean =>
    Number.isFinite(ySpan) && ((a > yHi + ySpan && b > yHi + ySpan && c > yHi + ySpan) || (a < yLo - ySpan && b < yLo - ySpan && c < yLo - ySpan));

  /** Emit the points in (a, b], refining as needed. */
  const seg = (a: number, fa: number, b: number, fb: number, d: number): void => {
    const aOk = !Number.isNaN(fa);
    const bOk = !Number.isNaN(fb);
    if (!aOk && !bOk) {
      push(b, fb);
      return;
    }
    if (aOk !== bOk) {
      // A domain edge: bisect to the last defined point so the curve reaches it.
      let lo = a;
      let hi = b;
      let flo = fa;
      let fhi = fb;
      for (let k = 0; k < depth + 6; k++) {
        const m = (lo + hi) / 2;
        const fm = ev(m);
        if (Number.isNaN(fm) === Number.isNaN(flo)) {
          lo = m;
          flo = fm;
        } else {
          hi = m;
          fhi = fm;
        }
      }
      if (aOk) {
        push(lo, flo);
        brk();
        push(b, fb);
      } else {
        brk();
        push(hi, fhi);
        push(b, fb);
      }
      return;
    }
    const m = (a + b) / 2;
    const fm = ev(m);
    if (d >= depth) {
      // A big step across a fully refined interval is a pole or a jump when the
      // midpoint is NOT strictly between the ends (a steep but continuous rise,
      // like tan x climbing towards its asymptote, keeps it between).
      const between = (fm > fa && fm < fb) || (fm < fa && fm > fb);
      if (Math.abs(fb - fa) > jump && !between) brk();
      push(b, fb);
      return;
    }
    if (Number.isNaN(fm)) {
      seg(a, fa, m, fm, d + 1);
      seg(m, fm, b, fb, d + 1);
      return;
    }
    if (offSameSide(fa, fm, fb)) {
      push(b, fb);
      return;
    }
    if (Math.abs(fm - (fa + fb) / 2) > tol) {
      seg(a, fa, m, fm, d + 1);
      seg(m, fm, b, fb, d + 1);
      return;
    }
    push(b, fb);
  };

  const h = (x1 - x0) / n;
  let pa = x0;
  let fa = ev(x0);
  push(pa, fa);
  for (let i = 1; i <= n; i++) {
    const b = i === n ? x1 : x0 + i * h;
    const fb = ev(b);
    seg(pa, fa, b, fb, 0);
    pa = b;
    fa = fb;
  }
  brk();
  return runs;
}

/** Sample a parametric curve t ↦ (x, y) adaptively; breaks on undefined points and huge jumps. */
export function sampleParametric(g: (t: number) => Readonly<Vec2>, t0: number, t1: number, opts: SampleOptions = {}): Vec2[][] {
  const n = Math.max(2, Math.round(opts.n ?? 200));
  const depth = opts.depth ?? 7;
  const pxX = opts.pxX ?? 1;
  const pxY = opts.pxY ?? 1;
  const tolPx = opts.tolPx ?? 0.35;
  const jumpPx = (opts.jumpPx ?? 6) * 8;
  const ev = (t: number): Vec2 | null => {
    try {
      const p = g(t);
      return isNum(p[0]) && isNum(p[1]) ? [p[0], p[1]] : null;
    } catch {
      return null;
    }
  };
  const runs: Vec2[][] = [];
  let cur: Vec2[] = [];
  const brk = () => {
    if (cur.length) runs.push(cur);
    cur = [];
  };
  const dpx = (p: Vec2, q: Vec2) => Math.hypot((p[0] - q[0]) * pxX, (p[1] - q[1]) * pxY);
  const seg = (ta: number, pa: Vec2 | null, tb: number, pb: Vec2 | null, d: number): void => {
    if (!pa || !pb) {
      if (!pb) brk();
      else cur.push(pb);
      return;
    }
    const tm = (ta + tb) / 2;
    const pm = ev(tm);
    if (d >= depth || !pm) {
      if (d >= depth && dpx(pa, pb) > jumpPx) brk();
      if (!pm && d < depth) {
        seg(ta, pa, tm, pm, d + 1);
        seg(tm, pm, tb, pb, d + 1);
        return;
      }
      cur.push(pb);
      return;
    }
    const mid: Vec2 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
    if (dpx(pm, mid) > tolPx) {
      seg(ta, pa, tm, pm, d + 1);
      seg(tm, pm, tb, pb, d + 1);
      return;
    }
    cur.push(pb);
  };
  const h = (t1 - t0) / n;
  let ta = t0;
  let pa = ev(t0);
  if (pa) cur.push(pa);
  for (let i = 1; i <= n; i++) {
    const tb = i === n ? t1 : t0 + i * h;
    const pb = ev(tb);
    seg(ta, pa, tb, pb, 0);
    ta = tb;
    pa = pb;
  }
  brk();
  return runs.filter((r) => r.length > 0);
}

/**
 * A y-range for `auto` plots from sample values: ignores non-finite values,
 * trims pole spikes (when the extremes are far outside the bulk of the data,
 * the 4th–96th percentiles are used instead), pulls in 0 when the data sit
 * close to it, and pads by 8%.
 */
export function autoRange(values: readonly number[], pad = 0.08): [number, number] {
  const ys = values.filter(isNum).sort((a, b) => a - b);
  if (ys.length === 0) return [-1, 1];
  const q = (p: number) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(p * (ys.length - 1))))];
  let lo = ys[0];
  let hi = ys[ys.length - 1];
  const bulk = q(0.96) - q(0.04);
  if (bulk > 0 && hi - lo > 6 * bulk) {
    lo = q(0.04);
    hi = q(0.96);
  }
  if (hi - lo < 1e-12) {
    const c = lo;
    const w = Math.max(1, Math.abs(c) * 0.5);
    return [c - w, c + w];
  }
  if (lo > 0 && lo < (hi - lo) * 0.35) lo = 0;
  if (hi < 0 && -hi < (hi - lo) * 0.35) hi = 0;
  const p = (hi - lo) * pad;
  return [lo === 0 ? -p * 0.5 : lo - p, hi === 0 ? p * 0.5 : hi + p];
}

/** Uniform samples of f for range estimation. */
export function uniformValues(f: Fn1, x0: number, x1: number, n = 241): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    let y: number;
    try {
      y = f(x0 + ((x1 - x0) * i) / n);
    } catch {
      y = NaN;
    }
    out.push(y);
  }
  return out;
}

export interface BarRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Histogram bars over `range` (default: the data's min and max); `density` scales so the total area is 1. */
export function histogramBars(data: readonly number[], bins: number, range?: readonly [number, number], density = false): BarRect[] {
  const fin = data.filter(isNum);
  if (fin.length === 0 || bins < 1) return [];
  let [lo, hi] = range ?? [Math.min(...fin), Math.max(...fin)];
  if (!(hi > lo)) {
    lo -= 0.5;
    hi += 0.5;
  }
  const hst = histogram(fin, lo, hi, Math.round(bins));
  const w = (hi - lo) / hst.counts.length;
  const total = hst.counts.reduce((s, c) => s + c, 0);
  return hst.counts.map((c, i) => ({ x0: hst.edges[i], x1: hst.edges[i + 1], y0: 0, y1: density ? c / (total * w || 1) : c }));
}

/** Bars for a list of values: bar k is centred on x = k, width 0.8 (negative values hang below the axis). */
export function barRects(values: readonly number[], width = 0.8): BarRect[] {
  return values.map((v, k) => ({ x0: k - width / 2, x1: k + width / 2, y0: Math.min(0, isNum(v) ? v : 0), y1: Math.max(0, isNum(v) ? v : 0) }));
}

/** The shapes of a Riemann sum: rectangles (left/right/mid) or trapezoids, as closed polygons. */
export function riemannShapes(f: Fn1, a: number, b: number, n: number, rule: RiemannRule): Vec2[][] {
  const k = Math.max(1, Math.min(2000, Math.round(n)));
  const h = (b - a) / k;
  const out: Vec2[][] = [];
  const val = (x: number) => {
    const y = f(x);
    return isNum(y) ? y : 0;
  };
  for (let i = 0; i < k; i++) {
    const x0 = a + i * h;
    const x1 = x0 + h;
    if (rule === 'trapezoid') {
      out.push([
        [x0, 0],
        [x0, val(x0)],
        [x1, val(x1)],
        [x1, 0],
      ]);
    } else {
      const y = val(rule === 'left' ? x0 : rule === 'right' ? x1 : x0 + h / 2);
      out.push([
        [x0, 0],
        [x0, y],
        [x1, y],
        [x1, 0],
      ]);
    }
  }
  return out;
}

/** The region between y = f(x) and the x axis from `from` to `to` (either order), as closed polygons split where f is undefined. */
export function areaPolygons(f: Fn1, from: number, to: number, opts: SampleOptions = {}): Vec2[][] {
  const a = Math.min(from, to);
  const b = Math.max(from, to);
  if (!(b > a)) return [];
  const runs = sampleFunction(f, a, b, { ...opts, n: opts.n ?? 120 });
  return runs.filter((r) => r.length > 1).map((r) => [[r[0][0], 0] as Vec2, ...r, [r[r.length - 1][0], 0] as Vec2]);
}

export interface FieldArrow {
  at: Vec2;
  /** The arrow's vector, already scaled to fit its grid cell. */
  v: Vec2;
  /** |F| relative to the largest arrow in view (0…1). */
  mag: number;
}

/**
 * Arrows for a vector field on a `density × density` grid (cells square in
 * pixels when the scales differ), each scaled so the longest fits ~85% of a
 * cell: direction is exact, length is relative.
 */
export function fieldArrows(F: (x: number, y: number) => Readonly<Vec2>, view: { x: readonly [number, number]; y: readonly [number, number] }, density = 15, aspectPx = 1): FieldArrow[] {
  const nx = Math.max(2, Math.round(density));
  const ny = Math.max(2, Math.round(density * aspectPx));
  const dx = (view.x[1] - view.x[0]) / nx;
  const dy = (view.y[1] - view.y[0]) / ny;
  const raw: { at: Vec2; v: Vec2; m: number }[] = [];
  let max = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const at: Vec2 = [view.x[0] + (i + 0.5) * dx, view.y[0] + (j + 0.5) * dy];
      let v: Readonly<Vec2>;
      try {
        v = F(at[0], at[1]);
      } catch {
        continue;
      }
      if (!isNum(v[0]) || !isNum(v[1])) continue;
      const m = Math.hypot(v[0], v[1]);
      if (m > max) max = m;
      raw.push({ at, v: [v[0], v[1]], m });
    }
  }
  if (!(max > 0)) return raw.map((r) => ({ at: r.at, v: [0, 0] as Vec2, mag: 0 }));
  const cell = Math.min(dx, dy) * 0.85;
  return raw.map((r) => {
    const rel = r.m / max;
    // sqrt keeps weak regions readable while preserving order.
    const len = cell * Math.sqrt(rel);
    const s = r.m > 0 ? len / r.m : 0;
    return { at: r.at, v: [r.v[0] * s, r.v[1] * s], mag: rel };
  });
}

/** Values of f on a grid of `nx × ny` cell centres over a view (row 0 = bottom), with the finite min and max. */
export function gridValues(f: Fn2, view: { x: readonly [number, number]; y: readonly [number, number] }, nx: number, ny: number): { values: Float64Array; min: number; max: number } {
  const values = new Float64Array(nx * ny);
  let min = Infinity;
  let max = -Infinity;
  const dx = (view.x[1] - view.x[0]) / nx;
  const dy = (view.y[1] - view.y[0]) / ny;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let z: number;
      try {
        z = f(view.x[0] + (i + 0.5) * dx, view.y[0] + (j + 0.5) * dy);
      } catch {
        z = NaN;
      }
      values[j * nx + i] = z;
      if (isNum(z)) {
        if (z < min) min = z;
        if (z > max) max = z;
      }
    }
  }
  return { values, min, max };
}
