/**
 * Descriptive statistics and seedable randomness. For problem generators use
 * `createRng` from `@kit/core/rng`, which wraps `mulberry32` with helpers.
 */
import { linspace } from './scalar';

export const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
/** Population variance (divide by n). Pass `sample = true` for the n−1 version. */
export function variance(xs: readonly number[], sample = false): number {
  const n = xs.length;
  if (n - (sample ? 1 : 0) <= 0) return NaN;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (n - (sample ? 1 : 0));
}
export const stdev = (xs: readonly number[], sample = false): number => Math.sqrt(variance(xs, sample));

export interface Histogram {
  /** bins + 1 edges, from min to max. */
  edges: number[];
  counts: number[];
}

/** Equal-width histogram; values outside [min, max] are ignored, max lands in the last bin. */
export function histogram(data: readonly number[], min: number, max: number, bins: number): Histogram {
  const edges = linspace(min, max, bins + 1);
  const counts = new Array<number>(bins).fill(0);
  const w = (max - min) / bins;
  for (const x of data) {
    if (!(x >= min && x <= max)) continue;
    counts[Math.min(bins - 1, Math.floor((x - min) / w))]++;
  }
  return { edges, counts };
}

/** Small, fast, seedable PRNG (mulberry32): same seed → same sequence, in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box–Muller. */
export function randn(rng: () => number = Math.random): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
