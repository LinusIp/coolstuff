/**
 * Seeded randomness for problem generators, Monte Carlo demos and anything
 * that must look the same on every reload. Pure (works in Node tests).
 *
 *   const rng = createRng(42);
 *   rng.int(1, 6); rng.pick(['a', 'b']); rng.shuffle(xs); rng.fork('noise').normal();
 */
import { mulberry32 } from '../math/stats';
import type { Rng } from '../types';

/** FNV-1a 32-bit hash: a stable seed from a string ("linalg/eigenvectors#p3"). */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A fresh, non-deterministic seed (for "another one"). Never 0, which means "the authored instance". */
export function randomSeed(): number {
  const s = (Math.random() * 0xffffffff) >>> 0;
  return s === 0 ? 1 : s;
}

export function createRng(seed: number | string): Rng {
  const s = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  const next = mulberry32(s);
  const int = (lo: number, hi: number): number => {
    const a = Math.ceil(Math.min(lo, hi));
    const b = Math.floor(Math.max(lo, hi));
    return a + Math.floor(next() * (b - a + 1));
  };
  const rng: Rng = {
    seed: s,
    next,
    float: (lo, hi) => lo + (hi - lo) * next(),
    int,
    intExcept(lo, hi, except) {
      const pool: number[] = [];
      for (let k = Math.ceil(lo); k <= Math.floor(hi); k++) if (!except.includes(k)) pool.push(k);
      if (pool.length === 0) throw new Error(`rng.intExcept: nothing left in [${lo}, ${hi}] after excluding ${except.join(', ')}`);
      return pool[Math.floor(next() * pool.length)];
    },
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new Error('rng.pick: empty list');
      return xs[Math.floor(next() * xs.length)];
    },
    shuffle<T>(xs: readonly T[]): T[] {
      const out = xs.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    sign: () => (next() < 0.5 ? -1 : 1),
    chance: (p) => next() < p,
    normal(mean = 0, sd = 1) {
      let u = 0;
      while (u === 0) u = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
    fork: (label) => createRng(hashSeed(`${s}:${label}`)),
  };
  return rng;
}
