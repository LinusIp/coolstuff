/**
 * Scalars and sampling. Pure: no DOM, no globals.
 */

export const EPS = 1e-9;

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Inverse of lerp: where x sits between a and b (0 at a, 1 at b). */
export const invLerp = (a: number, b: number, x: number): number => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x: number, a0: number, a1: number, b0: number, b1: number): number => lerp(b0, b1, invLerp(a0, a1, x));
/** Relative-or-absolute closeness: |a − b| ≤ eps · max(1, |a|, |b|). */
export const approxEqual = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
/** Smooth ease used by animations (cubic in-out). */
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Cubic ease-out, the "ink settling" curve of DESIGN.md §10. */
export const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/** Round to the nearest multiple of `step` (and kill −0 and float dust). */
export function snapTo(x: number, step: number): number {
  if (!(step > 0)) return x;
  const r = Math.round(x / step) * step;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)) + 1);
  return Number(r.toFixed(Math.min(12, decimals))) + 0;
}

/** Round to `digits` significant figures (0 stays 0). */
export function roundSig(x: number, digits: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(Math.max(1, Math.min(17, Math.round(digits)))));
}

/** n evenly spaced samples from a to b, inclusive (n ≥ 2), like numpy.linspace. */
export function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [a];
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = i === n - 1 ? b : a + ((b - a) * i) / (n - 1);
  return out;
}

/** Values a, a+step, … strictly below b (or above b when step < 0). */
export function range(a: number, b: number, step = 1): number[] {
  const out: number[] = [];
  if (step === 0) return out;
  for (let x = a; step > 0 ? x < b - EPS : x > b + EPS; x += step) out.push(x);
  return out;
}
