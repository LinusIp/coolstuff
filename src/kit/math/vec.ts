/**
 * 2D and 3D vectors as plain tuples: `Vec2 = [x, y]`, `Vec3 = [x, y, z]`.
 * Every function returns new values; nothing is mutated in place.
 */
import { EPS, clamp, lerp } from './scalar';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

// ── Vec2 ─────────────────────────────────────────────────────────────────────

export const add = (a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 => [a[0] - b[0], a[1] - b[1]];
export const scale = (a: Readonly<Vec2>, k: number): Vec2 => [a[0] * k, a[1] * k];
export const dot = (a: Readonly<Vec2>, b: Readonly<Vec2>): number => a[0] * b[0] + a[1] * b[1];
/** z-component of the 3D cross product: positive when b is counter-clockwise from a. */
export const cross = (a: Readonly<Vec2>, b: Readonly<Vec2>): number => a[0] * b[1] - a[1] * b[0];
export const norm = (a: Readonly<Vec2>): number => Math.hypot(a[0], a[1]);
export const dist = (a: Readonly<Vec2>, b: Readonly<Vec2>): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const perp = (a: Readonly<Vec2>): Vec2 => [-a[1], a[0]];
export const angleOf = (a: Readonly<Vec2>): number => Math.atan2(a[1], a[0]);
/** Unsigned angle between two vectors, in radians (0 when either is zero). */
export function angleBetween(a: Readonly<Vec2>, b: Readonly<Vec2>): number {
  const n = norm(a) * norm(b);
  return n < EPS ? 0 : Math.acos(clamp(dot(a, b) / n, -1, 1));
}
export const lerpVec = (a: Readonly<Vec2>, b: Readonly<Vec2>, t: number): Vec2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export function normalize(a: Readonly<Vec2>): Vec2 {
  const n = norm(a);
  return n < EPS ? [0, 0] : [a[0] / n, a[1] / n];
}
export function rotate(a: Readonly<Vec2>, theta: number): Vec2 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [c * a[0] - s * a[1], s * a[0] + c * a[1]];
}
/** Orthogonal projection of v onto the line spanned by u (the "shadow" of v on u). */
export function project(v: Readonly<Vec2>, u: Readonly<Vec2>): Vec2 {
  const uu = dot(u, u);
  return uu < EPS ? [0, 0] : scale(u, dot(v, u) / uu);
}
/** The part of v perpendicular to u: v − proj_u(v). */
export const reject = (v: Readonly<Vec2>, u: Readonly<Vec2>): Vec2 => sub(v, project(v, u));

/** Closest point to p on segment ab. */
export function closestOnSegment(p: Readonly<Vec2>, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  if (len2 < EPS) return [a[0], a[1]];
  const t = clamp(dot(sub(p, a), ab) / len2, 0, 1);
  return add(a, scale(ab, t));
}

/** Closest point to p on the infinite line through a and b. */
export function closestOnLine(p: Readonly<Vec2>, a: Readonly<Vec2>, b: Readonly<Vec2>): Vec2 {
  return add(a, project(sub(p, a), sub(b, a)));
}

/** Closest point to p on a polyline (open, or closed when `closed`). */
export function closestOnPolyline(p: Readonly<Vec2>, pts: readonly Readonly<Vec2>[], closed = false): Vec2 {
  if (pts.length === 0) return [p[0], p[1]];
  let best: Vec2 = [pts[0][0], pts[0][1]];
  let bestD = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const q = closestOnSegment(p, pts[i], pts[(i + 1) % pts.length]);
    const d = dist(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

// ── Vec3 ─────────────────────────────────────────────────────────────────────

export const add3 = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: Readonly<Vec3>, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: Readonly<Vec3>, b: Readonly<Vec3>): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm3 = (a: Readonly<Vec3>): number => Math.hypot(a[0], a[1], a[2]);
export function normalize3(a: Readonly<Vec3>): Vec3 {
  const n = norm3(a);
  return n < EPS ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
}
