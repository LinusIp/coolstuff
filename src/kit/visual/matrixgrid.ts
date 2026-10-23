/**
 * The maths behind MatrixGrid (README §6.3), pure and tested
 * (matrixgrid.test.ts): the morph, the transformed grid, the unit square and
 * its signed area, eigen-directions in words, and editing columns/entries.
 */
import { det2, eig2, IDENTITY2, lerpMat2, type Mat2 } from '../math/mat';
import type { Vec2 } from '../math/vec';
import { fmt } from '../math/axes';

/** The matrix actually shown: I at t = 0, A at t = 1 (straight-line interpolation of the entries). */
export function displayMatrix(A: Readonly<Mat2>, t?: number): Mat2 {
  if (t === undefined) return [A[0], A[1], A[2], A[3]];
  const s = Math.min(1, Math.max(0, t));
  return lerpMat2(IDENTITY2, A, s);
}

/** How many integer grid lines (each way) cover a view after the transform: enough for the shrunken direction, capped. */
export function gridReach(view: { x: readonly [number, number]; y: readonly [number, number] }, M: Readonly<Mat2>, cap = 40): number {
  const ext = Math.max(Math.abs(view.x[0]), Math.abs(view.x[1]), Math.abs(view.y[0]), Math.abs(view.y[1]));
  // Smallest singular value of M: the most a unit grid step can shrink.
  const [a, b, c, d] = M;
  const s1 = a * a + b * b + c * c + d * d;
  const dt = Math.abs(a * d - b * c);
  const disc = Math.max(0, s1 * s1 - 4 * dt * dt);
  const smin = Math.sqrt(Math.max(0, (s1 - Math.sqrt(disc)) / 2));
  const reach = smin > 1e-6 ? ext / smin : cap;
  return Math.max(2, Math.min(cap, Math.ceil(reach) + 1));
}

/** The images of the lines x = k and y = k (|k| ≤ R) as world segments (each a pair of far endpoints; clip before drawing). */
export function gridLines(M: Readonly<Mat2>, R: number): [Vec2, Vec2][] {
  const ap = (x: number, y: number): Vec2 => [M[0] * x + M[1] * y, M[2] * x + M[3] * y];
  const out: [Vec2, Vec2][] = [];
  for (let k = -R; k <= R; k++) {
    out.push([ap(k, -R), ap(k, R)]);
    out.push([ap(-R, k), ap(R, k)]);
  }
  return out;
}

/** The unit square's image: 0, M·e₁, M·(e₁ + e₂), M·e₂. */
export function unitSquare(M: Readonly<Mat2>): Vec2[] {
  return [
    [0, 0],
    [M[0], M[2]],
    [M[0] + M[1], M[2] + M[3]],
    [M[1], M[3]],
  ];
}

export interface DetNote {
  det: number;
  flipped: boolean;
  flat: boolean;
  /** "area × 3.00", "area × −1.00: orientation flipped", "area 0: the plane is squashed onto a line (or a point)". */
  words: string;
}

/** The determinant as area scaling, in words (orientation flip and collapse named, never colour alone). */
export function determinantNote(M: Readonly<Mat2>, tol = 1e-9): DetNote {
  const det = det2(M);
  const flat = Math.abs(det) < tol;
  const flipped = !flat && det < 0;
  const n = fmt(flat ? 0 : det, 2);
  const words = flat
    ? M.every((x) => Math.abs(x) < tol)
      ? 'area 0: the plane is squashed onto a point'
      : 'area 0: the plane is squashed onto a line'
    : flipped
      ? `area × ${n}: orientation flipped`
      : `area × ${n}`;
  return { det: flat ? 0 : det, flipped, flat, words };
}

export type EigenLines =
  | { kind: 'lines'; lines: { dir: Vec2; lambda: number; name: string }[] }
  | { kind: 'every'; lambda: number; name: string }
  | { kind: 'none'; why: string };

/** "stretched ×3", "unchanged ×1", "shrunk ×0.5", "flipped ×−2", "squashed ×0". */
export function eigenName(lambda: number): string {
  const n = fmt(lambda, 2);
  if (Math.abs(lambda) < 1e-9) return 'squashed ×0';
  if (Math.abs(lambda - 1) < 1e-9) return 'unchanged ×1';
  if (lambda < 0) return `flipped ×${n}`;
  return lambda > 1 ? `stretched ×${n}` : `shrunk ×${n}`;
}

/** The directions M keeps, with their stretch factors in words; or every direction (M = λI); or none (complex). */
export function eigenLines(M: Readonly<Mat2>): EigenLines {
  const e = eig2(M);
  if (!e.real) return { kind: 'none', why: 'no real eigen-directions: every arrow turns' };
  if (e.everyDirection) return { kind: 'every', lambda: e.values[0], name: eigenName(e.values[0]) };
  return { kind: 'lines', lines: e.vectors.map((dir, k) => ({ dir, lambda: e.values[k], name: eigenName(e.values[k]) })) };
}

/** M with column k (0 = î's image, 1 = ĵ's image) replaced. */
export function withColumn(M: Readonly<Mat2>, k: 0 | 1, v: Readonly<Vec2>): Mat2 {
  return k === 0 ? [v[0], M[1], v[1], M[3]] : [M[0], v[0], M[2], v[1]];
}

/** Column k of M. */
export const columnOf = (M: Readonly<Mat2>, k: 0 | 1): Vec2 => (k === 0 ? [M[0], M[2]] : [M[1], M[3]]);

/** Step one entry (row-major index 0–3) by `delta`, landing on multiples of `snap` (no float noise, no −0). */
export function stepEntry(M: Readonly<Mat2>, index: number, delta: number, snap: number): Mat2 {
  const out: Mat2 = [M[0], M[1], M[2], M[3]];
  const raw = out[index] + delta;
  const q = snap > 0 ? Math.round(raw / snap) * snap : raw;
  out[index] = Number(q.toFixed(10)) + 0;
  return out;
}

/** The entry names a₁₁ … a₂₂ for row-major indices (accessible names of the steppers). */
export const ENTRY_NAMES = ['row 1, column 1', 'row 1, column 2', 'row 2, column 1', 'row 2, column 2'] as const;
