/**
 * Eigenvectors and eigenvalues: the pure functions behind the visuals (traces, simulations,
 * datasets). Node-safe: imports only @kit/pure and @kit/math (ESLint
 * enforces it), so lesson.test.ts can check them against known values.
 *
 * wip: replace these examples with the lesson's own maths.
 */
import { linspace } from '@kit/math';
import { createRng } from '@kit/pure';

/** Sample y = f(x) at n evenly spaced points of [lo, hi], as [x, y] pairs for a curve. */
export function samplePoints(f: (x: number) => number, lo: number, hi: number, n = 101): [number, number][] {
  return linspace(lo, hi, n).map((x) => [x, f(x)]);
}

/** A seeded, reproducible noisy dataset around a line y = a·x + b (the same seed always gives the same points). */
export function noisyLine(seed: number, n: number, a: number, b: number, noise = 0.3): [number, number][] {
  const rng = createRng(seed);
  return linspace(-2, 2, n).map((x) => [x, a * x + b + rng.normal(0, noise)]);
}
