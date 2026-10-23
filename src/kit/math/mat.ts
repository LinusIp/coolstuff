/**
 * 2×2 and 3×3 matrices as row-major flat tuples: `Mat2 = [a, b, c, d]` is
 *   | a b |
 *   | c d |   so its columns (the images of î and ĵ) are (a, c) and (b, d).
 */
import { EPS, lerp } from './scalar';
import { norm, normalize, type Vec2, type Vec3 } from './vec';

export type Mat2 = [number, number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number];

// ── Mat2 ─────────────────────────────────────────────────────────────────────

export const IDENTITY2: Readonly<Mat2> = [1, 0, 0, 1];
export const mat2 = (a: number, b: number, c: number, d: number): Mat2 => [a, b, c, d];
/** Build a matrix from its columns (the images of î and ĵ). */
export const fromColumns2 = (i: Readonly<Vec2>, j: Readonly<Vec2>): Mat2 => [i[0], j[0], i[1], j[1]];
export const columns2 = (m: Readonly<Mat2>): [Vec2, Vec2] => [
  [m[0], m[2]],
  [m[1], m[3]],
];
export const det2 = (m: Readonly<Mat2>): number => m[0] * m[3] - m[1] * m[2];
export const trace2 = (m: Readonly<Mat2>): number => m[0] + m[3];
export const transpose2 = (m: Readonly<Mat2>): Mat2 => [m[0], m[2], m[1], m[3]];
export const apply2 = (m: Readonly<Mat2>, v: Readonly<Vec2>): Vec2 => [m[0] * v[0] + m[1] * v[1], m[2] * v[0] + m[3] * v[1]];
/** A·B: apply B first, then A. */
export const mul2 = (a: Readonly<Mat2>, b: Readonly<Mat2>): Mat2 => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
];
/** Inverse, or null when the matrix squashes the plane (det ≈ 0). */
export function inverse2(m: Readonly<Mat2>): Mat2 | null {
  const d = det2(m);
  if (Math.abs(d) < EPS) return null;
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d];
}
/** Entry-wise interpolation (1−t)·A + t·B; with A = I this is the classic "morph from identity". */
export const lerpMat2 = (a: Readonly<Mat2>, b: Readonly<Mat2>, t: number): Mat2 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
  lerp(a[3], b[3], t),
];
export const rotation2 = (theta: number): Mat2 => [Math.cos(theta), -Math.sin(theta), Math.sin(theta), Math.cos(theta)];

export interface Complex {
  re: number;
  im: number;
}

/**
 * Eigen-decomposition of a real 2×2 matrix.
 * - `real: true`: eigenvalues sorted by descending value; `vectors` holds unit
 *   eigenvectors (one per eigenvalue, or a single vector for a defective
 *   matrix like a shear). For a multiple of the identity every direction is an
 *   eigenvector and `vectors` is [î, ĵ] with `everyDirection: true`.
 * - `real: false`: a complex-conjugate pair re ± i·im (the matrix rotates every
 *   direction, so no real eigenvectors exist).
 * Eigenvector signs are canonical (first non-zero component positive).
 */
export type Eigen2 =
  | { real: true; values: [number, number]; vectors: Vec2[]; everyDirection: boolean }
  | { real: false; values: [Complex, Complex] };

export function eig2(m: Readonly<Mat2>): Eigen2 {
  const [a, b, c, d] = m;
  const tr = a + d;
  const det = a * d - b * c;
  const disc = (tr * tr) / 4 - det;
  const scaleTol = 1e-12 * Math.max(1, tr * tr);
  if (disc < -scaleTol) {
    const im = Math.sqrt(-disc);
    return { real: false, values: [{ re: tr / 2, im }, { re: tr / 2, im: -im }] };
  }
  const root = Math.sqrt(Math.max(0, disc));
  const l1 = tr / 2 + root;
  const l2 = tr / 2 - root;
  if (Math.abs(b) < EPS && Math.abs(c) < EPS && Math.abs(a - d) < EPS) {
    return { real: true, values: [l1, l2], vectors: [[1, 0], [0, 1]], everyDirection: true };
  }
  const vecFor = (l: number): Vec2 => {
    // Rows of (M − λI) are both orthogonal to the eigenvector; use the larger row for stability.
    const r1: Vec2 = [a - l, b];
    const r2: Vec2 = [c, d - l];
    const r = norm(r1) >= norm(r2) ? r1 : r2;
    const v = normalize([-r[1], r[0]]);
    return v[0] < -EPS || (Math.abs(v[0]) <= EPS && v[1] < 0) ? [-v[0] + 0, -v[1] + 0] : v;
  };
  if (root * root <= scaleTol) {
    // Repeated eigenvalue but not a multiple of I: defective (one eigen-direction).
    return { real: true, values: [l1, l2], vectors: [vecFor(l1)], everyDirection: false };
  }
  return { real: true, values: [l1, l2], vectors: [vecFor(l1), vecFor(l2)], everyDirection: false };
}

// ── Mat3 ─────────────────────────────────────────────────────────────────────

export const IDENTITY3: Readonly<Mat3> = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const fromColumns3 = (i: Readonly<Vec3>, j: Readonly<Vec3>, k: Readonly<Vec3>): Mat3 => [
  i[0], j[0], k[0],
  i[1], j[1], k[1],
  i[2], j[2], k[2],
];
export const columns3 = (m: Readonly<Mat3>): [Vec3, Vec3, Vec3] => [
  [m[0], m[3], m[6]],
  [m[1], m[4], m[7]],
  [m[2], m[5], m[8]],
];
export const apply3 = (m: Readonly<Mat3>, v: Readonly<Vec3>): Vec3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
export function mul3(a: Readonly<Mat3>, b: Readonly<Mat3>): Mat3 {
  const out = new Array<number>(9).fill(0) as Mat3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) out[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return out;
}
export const transpose3 = (m: Readonly<Mat3>): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
export const det3 = (m: Readonly<Mat3>): number =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
export function inverse3(m: Readonly<Mat3>): Mat3 | null {
  const d = det3(m);
  if (Math.abs(d) < EPS) return null;
  const [a, b, c, e, f, g, h, i, j] = m;
  return [
    (f * j - g * i) / d,
    (c * i - b * j) / d,
    (b * g - c * f) / d,
    (g * h - e * j) / d,
    (a * j - c * h) / d,
    (c * e - a * g) / d,
    (e * i - f * h) / d,
    (b * h - a * i) / d,
    (a * f - b * e) / d,
  ];
}
export const lerpMat3 = (a: Readonly<Mat3>, b: Readonly<Mat3>, t: number): Mat3 => a.map((x, k) => lerp(x, b[k], t)) as Mat3;
