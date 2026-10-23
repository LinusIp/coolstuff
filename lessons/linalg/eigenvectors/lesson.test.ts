/**
 * Eigenvectors and eigenvalues: the lesson's tests (CLAUDE.md §10). While the content is a wip
 * stub (no problems yet), the audits, the answer checks and the snippet
 * check are skipped; from the first problem on they all run, and the answer
 * check fails until it is written.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LESSON_BY_ID } from '@content/curriculum';
import { apply2, eig2, type Mat2, type Vec2 } from '@kit/math';
import { auditFigureKeys, auditLesson, createRng, runSnippet } from '@kit/pure';
import { FIGURES } from './figures';
import {
  BIN_COUNT,
  BIN_DEG,
  coverage,
  eigenPicture,
  emptySweep,
  fitArrow,
  judgeDirections,
  keptLineNear,
  lineDeg,
  lineGap,
  PLAY_MATRICES,
  powerIterates,
  stretchAlong,
  stretchWords,
  sweep,
  sweptRuns,
  turnCurve,
  turnDeg,
  unitAt,
} from './math';
import * as content from './problems';

/** The skeleton `npm run new` made: no problems written yet. */
const STUB = content.PROBLEMS.length === 0;

/** meta.json, read as text so this file also loads inside scripts/lesson-template, where it still has {{placeholders}}. */
function readMeta(): { status?: string } | null {
  try {
    return JSON.parse(readFileSync(new URL('./meta.json', import.meta.url), 'utf8')) as { status?: string };
  } catch {
    return null;
  }
}

/** Independent eigenvalues: roots of λ² − (a + d)λ + (ad − bc), by the plain quadratic formula (no kit code). */
function charRoots([a, b, c, d]: Readonly<Mat2>): number[] | null {
  const tr = a + d;
  const det = a * d - b * c;
  const disc = tr * tr - 4 * det;
  if (disc < -1e-12) return null;
  const r = Math.sqrt(Math.max(0, disc));
  return [(tr + r) / 2, (tr - r) / 2];
}

/** Independent eigenvector for λ: a nonzero vector in the null space of A − λI, read off a row. */
function nullVector([a, b, c, d]: Readonly<Mat2>, l: number): Vec2 {
  const r1: Vec2 = [a - l, b];
  const r2: Vec2 = [c, d - l];
  const r = Math.hypot(...r1) >= Math.hypot(...r2) ? r1 : r2;
  if (Math.hypot(...r) < 1e-12) return [1, 0];
  return [-r[1], r[0]];
}

const STRETCH: Mat2 = [2, 1, 1, 2];
const SHEAR: Mat2 = [1, 1, 0, 1];
const TURN: Mat2 = [0, -1, 1, 0];
const FLIP: Mat2 = [0, 1, 1, 0];
const SQUASH: Mat2 = [1, 2, 0.5, 1];

describe('linalg/eigenvectors', () => {
  it('stays "wip" while it is a skeleton', () => {
    const meta = readMeta();
    if (STUB && meta) expect(meta.status).toBe('wip');
  });

  it.skipIf(STUB)('passes the kit audits', () => {
    expect(auditLesson(content, { knownLessons: LESSON_BY_ID.keys() })).toEqual([]); // §4/§5/§10/§11 in one call
    expect(auditFigureKeys(content, FIGURES)).toEqual([]); // every figure key has a renderer
  });

  it.skipIf(STUB)('every stated answer is right (computed independently)', () => {
    expect.fail('wip: write the independent answer checks');
  });

  it.skipIf(STUB)('the Code it snippet runs and does what the lesson says', () => {
    const r = runSnippet(content.SNIPPETS.main, { inputs: {} });
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
  });
});

describe('math.ts: the turn of a line', () => {
  it('is 0 exactly along the eigen-directions (independent eigenvectors), for many random matrices', () => {
    const rng = createRng(20261023);
    let tested = 0;
    for (let k = 0; k < 400; k++) {
      const A: Mat2 = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
      const roots = charRoots(A);
      if (!roots || Math.abs(roots[0] - roots[1]) < 1e-6) continue;
      for (const l of roots) {
        const v = nullVector(A, l);
        expect(Math.abs(turnDeg(A, v))).toBeLessThan(1e-6);
        expect(Math.abs(turnDeg(A, [-2 * v[0], -2 * v[1]]))).toBeLessThan(1e-6); // the whole line, either way
        expect(stretchAlong(A, v)).toBeCloseTo(l, 9);
      }
      // A direction halfway between the two kept lines is turned (unless A is a multiple of I).
      tested++;
    }
    expect(tested).toBeGreaterThan(100);
  });

  it('measures real turns: a rotation by θ < 90° turns every line by θ; a quarter turn by 90°', () => {
    for (const deg of [10, 30, 60, 89]) {
      const t = (deg * Math.PI) / 180;
      const R: Mat2 = [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t)];
      for (const v of [unitAt(0), unitAt(37), unitAt(123), [-2, 0.5] as Vec2]) expect(turnDeg(R, v)).toBeCloseTo(deg, 9);
    }
    for (const v of [unitAt(0), unitAt(71), [3, -4] as Vec2]) expect(turnDeg(TURN, v)).toBeCloseTo(90, 9);
  });

  it('counts a flip (Av = −v) and a squash (Av = 0) as "not turned"; v = 0 has no direction', () => {
    expect(turnDeg(FLIP, [1, -1])).toBe(0);
    expect(stretchAlong(FLIP, [1, -1])).toBe(-1);
    expect(turnDeg(SQUASH, [2, -1])).toBe(0);
    expect(stretchAlong(SQUASH, [2, -1])).toBe(0);
    expect(turnDeg(STRETCH, [0, 0])).toBeNaN();
  });

  it('is the same for v and any multiple of v (it is a property of the line)', () => {
    const rng = createRng(7);
    for (let k = 0; k < 100; k++) {
      const A: Mat2 = [rng.float(-3, 3), rng.float(-3, 3), rng.float(-3, 3), rng.float(-3, 3)];
      const v: Vec2 = [rng.float(-2, 2), rng.float(-2, 2)];
      const s = rng.float(0.2, 3) * (rng.next() < 0.5 ? -1 : 1);
      const a = turnDeg(A, v);
      const b = turnDeg(A, [s * v[0], s * v[1]]);
      // Equal, up to the ±90° seam where +90 and −90 are the same line.
      expect(Math.min(Math.abs(a - b), 180 - Math.abs(a - b))).toBeLessThan(1e-7);
    }
  });

  it('turns A = [[2, 1], [1, 2]] the way the figure says: v = (1.4, 0.2) ↦ (3.0, 1.8), turned ≈ 22.8° counter-clockwise', () => {
    const v: Vec2 = [1.4, 0.2];
    const w = apply2(STRETCH, v);
    expect(w[0]).toBeCloseTo(3.0, 12);
    expect(w[1]).toBeCloseTo(1.8, 12);
    const expected = (Math.atan2(1.8, 3.0) - Math.atan2(0.2, 1.4)) * (180 / Math.PI);
    expect(turnDeg(STRETCH, v)).toBeCloseTo(expected, 9);
    expect(expected).toBeCloseTo(22.83, 2);
  });
});

describe('math.ts: words and kept lines', () => {
  it('names stretches in words', () => {
    expect(stretchWords(3)).toBe('stretched ×3');
    expect(stretchWords(1)).toBe('left as it is ×1');
    expect(stretchWords(-1)).toBe('flipped ×−1');
    expect(stretchWords(0)).toBe('squashed to zero ×0');
    expect(stretchWords(0.5)).toBe('shrunk ×0.50');
    expect(stretchWords(-2)).toBe('flipped and stretched ×−2');
    expect(stretchWords(-0.25)).toBe('flipped and shrunk ×−0.25');
    expect(stretchWords(2.999999999)).toBe('stretched ×3');
  });

  it('finds the kept lines of each Play matrix, agreeing with independent eigenvalues', () => {
    const s = eigenPicture(STRETCH);
    expect(s.kind).toBe('lines');
    if (s.kind === 'lines') {
      expect(s.lines.map((l) => [Math.round(l.deg * 1e6) / 1e6, Math.round(l.lambda * 1e9) / 1e9])).toEqual([
        [45, 3],
        [135, 1],
      ]);
    }
    const sh = eigenPicture(SHEAR);
    expect(sh.kind === 'lines' && sh.lines.length === 1 && sh.lines[0].deg === 0 && Math.abs(sh.lines[0].lambda - 1) < 1e-12).toBe(true);
    const t = eigenPicture(TURN);
    expect(t).toEqual({ kind: 'none', re: 0, im: 1 });
    const f = eigenPicture(FLIP);
    expect(f.kind === 'lines' && f.lines.map((l) => Math.round(l.lambda)).sort()).toEqual([-1, 1]);
    expect(eigenPicture([2, 0, 0, 2])).toEqual({ kind: 'every', lambda: 2 });
    for (const m of PLAY_MATRICES) {
      const roots = charRoots(m.A);
      const pic = eigenPicture(m.A);
      if (!roots) expect(pic.kind).toBe('none');
      else if (pic.kind === 'lines') for (const l of pic.lines) expect(roots.some((r) => Math.abs(r - l.lambda) < 1e-9)).toBe(true);
    }
  });

  it('measures line directions and gaps between lines (0° and 180° are the same line)', () => {
    expect(lineDeg([1, 1])).toBeCloseTo(45, 12);
    expect(lineDeg([-1, -1])).toBeCloseTo(45, 12);
    expect(lineDeg([1, -1])).toBeCloseTo(135, 12);
    expect(lineDeg([-3, 0])).toBe(0);
    expect(lineGap(2, 178)).toBeCloseTo(4, 12);
    expect(lineGap(10, 100)).toBe(90);
    const pic = eigenPicture(STRETCH);
    expect(keptLineNear(pic, [1, 1.04], 3)?.lambda).toBeCloseTo(3, 9);
    expect(keptLineNear(pic, [1, 1.2], 3)).toBeNull();
    expect(keptLineNear(pic, [-1, 1], 0.01)?.lambda).toBeCloseTo(1, 9);
  });
});

describe('math.ts: keeping v and Av on the plate', () => {
  const fit = { hx: 3.6, hy: 3.2, minLength: 0.45 };

  it('keeps the direction, keeps v and Av inside the plate, and never lets v vanish', () => {
    const rng = createRng(11);
    for (const m of [...PLAY_MATRICES.map((p) => p.A), SQUASH]) {
      for (let k = 0; k < 200; k++) {
        const p: Vec2 = [rng.float(-5, 5), rng.float(-5, 5)];
        const q = fitArrow(m, p, fit);
        expect(lineGap(lineDeg(p), lineDeg(q))).toBeLessThan(1e-9);
        expect(Math.sign(p[0] * q[0] + p[1] * q[1])).toBe(1);
        const w = apply2(m, q);
        for (const [x, y] of [q, w]) {
          expect(Math.abs(x)).toBeLessThanOrEqual(fit.hx + 1e-9);
          expect(Math.abs(y)).toBeLessThanOrEqual(fit.hy + 1e-9);
        }
        expect(Math.hypot(...q)).toBeGreaterThanOrEqual(fit.minLength - 1e-9);
      }
    }
  });

  it('leaves a short arrow alone, and lets v be 3 times longer along y = −x than along y = x for [[2, 1], [1, 2]]', () => {
    expect(fitArrow(STRETCH, [1, 0.2], fit)).toEqual([1, 0.2]);
    const along1 = Math.hypot(...fitArrow(STRETCH, [10, 10], fit));
    const along3 = Math.hypot(...fitArrow(STRETCH, [10, -10], fit));
    expect(along3 / along1).toBeCloseTo(3, 9);
  });
});

describe('math.ts: sweeping every direction', () => {
  it('marks the directions passed through the short way round, with no gaps, and wraps at 180° = 0°', () => {
    let b: readonly boolean[] = emptySweep();
    b = sweep(b, null, 10);
    expect(coverage(b)).toBeCloseTo(1 / BIN_COUNT, 12);
    b = sweep(b, 10, 30);
    expect(b.slice(5, 16).every(Boolean)).toBe(true);
    expect(b[4]).toBe(false);
    b = sweep(emptySweep(), 176, 4); // across the seam: 176° → 180° = 0° → 4°
    expect(b[BIN_COUNT - 1] && b[0] && b[1] && b[BIN_COUNT - 2]).toBe(true);
    expect(b[BIN_COUNT / 2]).toBe(false);
    expect(coverage(b)).toBeCloseTo(5 / BIN_COUNT, 12);
    const same = sweep(b, 0, 2);
    expect(same).toBe(b); // nothing new: the same array
  });

  it('draws a turn curve whose zeros are the kept lines: two crossings, one touch (shear), none (turn)', () => {
    const zeros = (A: Mat2) => {
      const c = turnCurve(A, 0.5);
      const out: number[] = [];
      for (let k = 0; k + 1 < c.length; k++) {
        const [d0, t0] = c[k];
        const [, t1] = c[k + 1];
        if (Math.abs(t0) < 1e-9) out.push(d0);
        else if (t0 * t1 < 0 && Math.abs(t0 - t1) < 90) out.push(d0);
      }
      return out.filter((d) => d < 180);
    };
    expect(zeros(STRETCH)).toEqual([45, 135]);
    expect(zeros(SHEAR)).toEqual([0]);
    expect(turnCurve(SHEAR).every(([, t]) => t <= 1e-9)).toBe(true); // touches 0, never crosses: one kept line
    expect(zeros(TURN)).toEqual([]);
    expect(turnCurve(TURN).every(([, t]) => Math.abs(t - 90) < 1e-9)).toBe(true);
    expect(zeros(FLIP)).toEqual([45, 135]);
  });

  it('turns the explored bins into polylines on the curve, broken at the ±90° seam', () => {
    expect(sweptRuns(STRETCH, emptySweep())).toEqual([]);
    const all = new Array<boolean>(BIN_COUNT).fill(true);
    const runs = sweptRuns(STRETCH, all);
    expect(runs).toHaveLength(1);
    expect(runs[0][0][0]).toBe(0);
    expect(runs[0][runs[0].length - 1][0]).toBeCloseTo(180, 9);
    for (const [d, t] of runs[0]) expect(t).toBeCloseTo(turnDeg(STRETCH, unitAt(d)), 9);
    const flipRuns = sweptRuns(FLIP, all);
    expect(flipRuns.length).toBeGreaterThan(1); // Flip's curve wraps from +90° to −90°
    for (const r of flipRuns) for (let k = 1; k < r.length; k++) expect(Math.abs(r[k][1] - r[k - 1][1])).toBeLessThan(90);
    const some = emptySweep();
    some[3] = some[4] = some[10] = true;
    const parts = sweptRuns(STRETCH, some);
    expect(parts).toHaveLength(2);
    expect(parts[0][0][0]).toBe(3 * BIN_DEG);
  });
});

describe('math.ts: power iteration', () => {
  it('converges to the dominant eigen-direction (λ = 3 along y = x for [[2, 1], [1, 2]]), error shrinking ×1/3 per step', () => {
    const it = powerIterates(STRETCH, [1, 0], 20);
    expect(it).toHaveLength(21);
    const last = it[20];
    expect(Math.abs(last[0] - Math.SQRT1_2)).toBeLessThan(1e-9);
    expect(Math.abs(last[1] - Math.SQRT1_2)).toBeLessThan(1e-9);
    const e = eig2(STRETCH);
    if (e.real) {
      const gap = (v: Vec2) => lineGap(lineDeg(v), lineDeg(e.vectors[0]));
      expect(gap(it[6]) / gap(it[5])).toBeCloseTo(1 / 3, 1);
    }
  });
});

describe('math.ts: judging a guess of the kept directions', () => {
  const A: Mat2 = [2, 1, 1, 2];
  it('accepts both diagonals in either order and either way along them, within the tolerance', () => {
    expect(judgeDirections(A, [[1, 1], [1, -1]], 10).ok).toBe(true);
    expect(judgeDirections(A, [[-2, 2], [-3, -3]], 10).ok).toBe(true);
    const near = judgeDirections(A, [unitAt(52), unitAt(128)], 10);
    expect(near.ok).toBe(true);
    expect(near.gaps[0]).toBeCloseTo(7, 9);
    expect(near.gaps[1]).toBeCloseTo(7, 9);
  });
  it('rejects the common wrong guess (the columns (2, 1) and (1, 2)), one line guessed twice, and far guesses', () => {
    const cols = judgeDirections(A, [[2, 1], [1, 2]], 10);
    expect(cols.ok).toBe(false);
    expect(Math.max(...cols.gaps)).toBeGreaterThan(10);
    expect(judgeDirections(A, [[1, 1], [2, 2]], 10).ok).toBe(false);
    expect(judgeDirections(A, [unitAt(60), unitAt(135)], 10).ok).toBe(false);
    expect(judgeDirections(A, [[0, 0], [1, -1]], 10).ok).toBe(false);
  });
  it('never accepts a guess for a matrix with no kept lines', () => {
    expect(judgeDirections([0, -1, 1, 0], [[1, 0], [0, 1]], 90).ok).toBe(false);
  });
});

describe('NOTES.md plan: the exam-level problem’s numbers', () => {
  it('A = [[5, −2], [1, 2]] has eigenpairs (4, (2, 1)) and (3, (1, 1)), and A¹⁰(3, 2) = 4¹⁰(2, 1) + 3¹⁰(1, 1)', () => {
    const A: Mat2 = [5, -2, 1, 2];
    expect(charRoots(A)).toEqual([4, 3]);
    expect(apply2(A, [2, 1])).toEqual([8, 4]);
    expect(apply2(A, [1, 1])).toEqual([3, 3]);
    let v: Vec2 = [3, 2];
    for (let k = 0; k < 10; k++) v = apply2(A, v);
    expect(v).toEqual([2 * 4 ** 10 + 3 ** 10, 4 ** 10 + 3 ** 10]);
  });
});
