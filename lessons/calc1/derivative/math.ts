/**
 * The derivative as slope and as rate: the pure functions behind the visuals.
 * Node-safe (only @kit/math), so lesson.test.ts checks every one of them
 * against known values.
 *
 * The central interactive is a car in stop-and-go traffic. Its position is
 *
 *   s(t) = 4t − (12/π)·sin(πt/3)   metres, t in seconds, 0 ≤ t ≤ 12,
 *
 * chosen because its speed s′(t) = 4 − 4·cos(πt/3) is never negative (the
 * car never reverses, so speed = velocity and the dashboard needle is the
 * slope), it starts from rest, peaks at 8 m/s at t = 3 and t = 9, and stands
 * still for an instant at t = 6; the speeds at whole seconds are round
 * numbers (2, 6, 8, 6, 2, 0, …), and every full cycle averages exactly 4 m/s,
 * which makes "average speed ≠ speedometer reading" easy to see.
 */
import { secantSlope, type Vec2 } from '@kit/math';

export type Fn = (x: number) => number;

// ── The car ─────────────────────────────────────────────────────────────────

/** The trip lasts 12 s. */
export const TRIP_END = 12;
/** The largest h the play figure allows (s). */
export const H_MAX = 2;
/** The smallest h the play figure allows (s): the slider is logarithmic down to here. */
export const H_MIN = 0.001;
/** The speedometer's full scale (m/s). */
export const GAUGE_MAX = 10;

/** Position along the road (m) at time t (s). */
export function tripPosition(t: number): number {
  return 4 * t - (12 / Math.PI) * Math.sin((Math.PI * t) / 3);
}

/** The exact speed s′(t) (m/s): what the car's speedometer reads. */
export function tripSpeed(t: number): number {
  return 4 - 4 * Math.cos((Math.PI * t) / 3);
}

/** The exact acceleration s″(t) (m/s²). */
export function tripAcceleration(t: number): number {
  return ((4 * Math.PI) / 3) * Math.sin((Math.PI * t) / 3);
}

// ── Secants and tangents ───────────────────────────────────────────────────

export interface Secant {
  /** (x, f(x)) */
  p: Vec2;
  /** (x + h, f(x + h)) */
  q: Vec2;
  /** The run h. */
  run: number;
  /** The rise f(x + h) − f(x). */
  rise: number;
  /** rise / run: NaN at h = 0. */
  slope: number;
}

/** The secant of f through x and x + h. */
export function secant(f: Fn, x: number, h: number): Secant {
  const fx = f(x);
  const fxh = f(x + h);
  return { p: [x, fx], q: [x + h, fxh], run: h, rise: fxh - fx, slope: secantSlope(f, x, h) };
}

/** The tangent line to f at a, given the slope there: y = f(a) + m·(x − a). */
export function tangentLine(f: Fn, a: number, m: number): Fn {
  const fa = f(a);
  return (x) => fa + m * (x - a);
}

/**
 * How far the secant slope is from the tangent slope. For a smooth f this
 * is about f″(x)·h/2 when h is small (Taylor), so halving h halves the gap.
 */
export function secantGap(f: Fn, fPrime: Fn, x: number, h: number): number {
  return secantSlope(f, x, h) - fPrime(x);
}

// ── Display helpers ─────────────────────────────────────────────────────────

/**
 * Decimals worth showing for a difference quotient computed with step h:
 * more as h shrinks (2 at h ≥ 0.1, 3 down to 0.01, 4 below), so the reader
 * watches digits settle from the left without seeing floating-point noise.
 */
export function settledDecimals(h: number): number {
  const a = Math.abs(h);
  if (!(a > 0)) return 4;
  return Math.max(2, Math.min(4, 1 - Math.floor(Math.log10(a) + 1e-9)));
}

/**
 * How close the average speed must come to the speedometer for the play
 * figure to call it a match (m/s). A tolerance rather than "the same to 2
 * decimal places": two readings 0.0002 apart can round differently forever
 * if the speedometer sits on a rounding boundary.
 */
export const MATCH_TOLERANCE = 0.01;

/** |a − b| < tol. */
export function closeWithin(a: number, b: number, tol = MATCH_TOLERANCE): boolean {
  return Math.abs(a - b) < tol;
}

/** Keep the moment t inside [0, end − h], so the later point t + h stays on the trip. */
export function clampMoment(t: number, h: number, end = TRIP_END): number {
  return Math.min(Math.max(t, 0), end - h);
}

/**
 * The needle angle for a speed on a half-dial: π (pointing left) at 0,
 * 0 (pointing right) at `max`; out-of-range speeds pin to the stops.
 */
export function gaugeAngle(v: number, max = GAUGE_MAX): number {
  const f = Math.min(Math.max(v / max, 0), 1);
  return Math.PI * (1 - f);
}

/** A point on a dial of radius r centred at (cx, cy) at angle a (radians, y up, so SVG y is flipped). */
export function dialPoint(cx: number, cy: number, r: number, a: number): Vec2 {
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}
