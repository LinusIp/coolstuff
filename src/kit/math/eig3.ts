/**
 * Real roots of cubics and the real eigen-directions of a 3×3 matrix
 * (MatrixGrid3D draws them; linear-algebra lessons check against them).
 * Pure; tested in eig3.test.ts.
 */
import { det3, type Mat3 } from './mat';
import { cross3, norm3, type Vec3 } from './vec';

/**
 * Real roots of a·x³ + b·x² + c·x + d = 0, ascending, repeated roots listed
 * once per multiplicity (a double root appears twice). Falls back to the
 * quadratic/linear case when a ≈ 0.
 */
export function cubicRoots(a: number, b: number, c: number, d: number): number[] {
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), 1e-300);
  if (Math.abs(a) < 1e-12 * scale) {
    if (Math.abs(b) < 1e-12 * scale) return Math.abs(c) < 1e-12 * scale ? [] : [-d / c];
    const disc = c * c - 4 * b * d;
    if (disc < -1e-12 * c * c) return [];
    const r = Math.sqrt(Math.max(0, disc));
    const q = -0.5 * (c + (c >= 0 ? r : -r));
    const roots = q !== 0 ? [q / b, d / q] : [0, 0];
    return roots.sort((x, y) => x - y);
  }
  // Depressed cubic t³ + p t + q with x = t − B/3.
  const B = b / a;
  const C = c / a;
  const D = d / a;
  const p = C - (B * B) / 3;
  const q = (2 * B * B * B) / 27 - (B * C) / 3 + D;
  const shift = -B / 3;
  const disc = (q * q) / 4 + (p * p * p) / 27;
  const size = (q * q) / 4 + Math.abs(p * p * p) / 27;
  let ts: number[];
  if (size < 1e-30 * Math.max(1, B * B * B * B * B * B)) ts = [0, 0, 0];
  else if (disc > 1e-10 * size) {
    const s = Math.sqrt(disc);
    ts = [Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s)];
  } else if (disc >= -1e-10 * size) {
    // A double root (and a simple one).
    const u = Math.cbrt(-q / 2);
    ts = [2 * u, -u, -u];
  } else {
    const r = Math.sqrt(-p / 3);
    const phi = Math.acos(Math.max(-1, Math.min(1, (3 * q) / (2 * p * r))));
    ts = [0, 1, 2].map((k) => 2 * r * Math.cos(phi / 3 - (2 * Math.PI * k) / 3));
  }
  // One Newton polish step per root on the original cubic.
  const f = (x: number) => ((a * x + b) * x + c) * x + d;
  const df = (x: number) => (3 * a * x + 2 * b) * x + c;
  return ts
    .map((t) => {
      let x = t + shift;
      const g = df(x);
      if (Math.abs(g) > 1e-12) {
        const nx = x - f(x) / g;
        if (Math.abs(f(nx)) <= Math.abs(f(x))) x = nx;
      }
      return x + 0;
    })
    .sort((x, y) => x - y);
}

export interface Eigen3 {
  /** Real eigenvalues, ascending, with multiplicity. */
  values: number[];
  /** Unit eigen-directions, one per distinct real eigenvalue (two when its eigenspace is a plane), first non-zero component positive. */
  directions: { value: number; dir: Vec3 }[];
  /** M = λI: every direction is kept. */
  everyDirection: boolean;
}

const canon = (v: Vec3): Vec3 => {
  const n = norm3(v);
  let u: Vec3 = [v[0] / n, v[1] / n, v[2] / n];
  const first = u.find((x) => Math.abs(x) > 1e-9) ?? 1;
  if (first < 0) u = [-u[0], -u[1], -u[2]];
  return [u[0] + 0, u[1] + 0, u[2] + 0];
};

/** Real eigenvalues and eigen-directions of a 3×3 matrix (row-major). */
export function eig3(M: Readonly<Mat3>): Eigen3 {
  const [a, b, c, d, e, f, g, h, i] = M;
  const tr = a + e + i;
  const minors = a * e - b * d + a * i - c * g + e * i - f * h;
  const values = cubicRoots(1, -tr, minors, -det3(M));
  const scale = Math.max(1, ...M.map(Math.abs));
  const offDiag = Math.max(Math.abs(b), Math.abs(c), Math.abs(d), Math.abs(f), Math.abs(g), Math.abs(h));
  if (offDiag < 1e-12 * scale && Math.abs(a - e) < 1e-12 * scale && Math.abs(a - i) < 1e-12 * scale) {
    return { values: [a, a, a], directions: [], everyDirection: true };
  }
  const distinct: number[] = [];
  for (const v of values) if (!distinct.some((u) => Math.abs(u - v) < 1e-7 * scale)) distinct.push(v);
  const directions: { value: number; dir: Vec3 }[] = [];
  for (const l of distinct) {
    const r: Vec3[] = [
      [a - l, b, c],
      [d, e - l, f],
      [g, h, i - l],
    ];
    const crosses = [cross3(r[0], r[1]), cross3(r[0], r[2]), cross3(r[1], r[2])];
    const best = crosses.reduce((m, v) => (norm3(v) > norm3(m) ? v : m));
    const rowMax = r.reduce((m, v) => (norm3(v) > norm3(m) ? v : m));
    if (norm3(best) > 1e-9 * scale * scale) directions.push({ value: l, dir: canon(best) });
    else if (norm3(rowMax) > 1e-9 * scale) {
      // Rank 1: the eigenspace is the plane orthogonal to the non-zero row.
      const n = rowMax;
      const t: Vec3 = Math.abs(n[0]) < 0.9 * norm3(n) ? [1, 0, 0] : [0, 1, 0];
      const u = cross3(n, t);
      const w = cross3(n, u);
      directions.push({ value: l, dir: canon(u) }, { value: l, dir: canon(w) });
    }
  }
  return { values, directions, everyDirection: false };
}
