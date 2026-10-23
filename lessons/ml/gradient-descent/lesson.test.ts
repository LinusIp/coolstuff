/**
 * Gradient descent: the lesson's tests (CLAUDE.md §10). While the content is a wip
 * stub (no problems yet), the audits, the answer checks and the snippet
 * check are skipped; from the first problem on they all run, and the answer
 * check fails until it is written.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LESSON_BY_ID } from '@content/curriculum';
import { auditFigureKeys, auditLesson, runSnippet } from '@kit/pure';
import { FIGURES } from './figures';
import { apply2, dist, gradient2, hessian2, norm, sub, type Mat2, type Vec2 } from '@kit/math';
import {
  ARRIVE_TOL,
  arrivedBy,
  BOWL_H,
  BOWL_M,
  LANDSCAPES,
  LANDSCAPE_IDS,
  VALLEY_ANGLE,
  VALLEY_H,
  VALLEY_LAMBDA,
  VALLEY_M,
  bestRate,
  bumpyGradRaw,
  bumpyHessian,
  contraction,
  describeRun,
  exitPoint,
  farBox,
  geometricLevels,
  maxStableRate,
  pointAt,
  quadraticHessian,
  runGD,
  stepsToShrink,
  symEigenvalues,
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

describe('ml/gradient-descent', () => {
  it('stays "wip" while it is a skeleton', () => {
    const meta = readMeta();
    if (STUB && meta) expect(meta.status).toBe('wip');
  });

  it.skipIf(STUB)('passes the kit audits', () => {
    expect(auditLesson(content, { knownLessons: LESSON_BY_ID.keys() })).toEqual([]); // §4/§5/§10/§11 in one call
    expect(auditFigureKeys(content, FIGURES)).toEqual([]); // every figure key has a renderer
  });

  it.skipIf(STUB)('every stated answer is right (computed independently)', () => {
    // wip: recompute every worked example's `value` and every problem's answer here, with an
    // independent method (README §0), and every generated problem over many seeds (forEachSeed).
    expect.fail('wip: write the independent answer checks');
  });

  it.skipIf(STUB)('the Code it snippet runs and does what the lesson says', () => {
    const r = runSnippet(content.SNIPPETS.main, { inputs: {} });
    expect(r.error).toBeUndefined();
    expect(r.ok).toBe(true);
    // wip: assert what the shipped snippet computes (it converges, it matches math.ts, …).
  });

  describe('math.ts: landscapes', () => {
    it('analytic gradients match finite differences everywhere on every map', () => {
      for (const id of LANDSCAPE_IDS) {
        const l = LANDSCAPES[id];
        for (let i = 0; i <= 6; i++) {
          for (let j = 0; j <= 6; j++) {
            const p: Vec2 = [(8 * i) / 6, (6 * j) / 6];
            const num = gradient2(l.loss, p);
            const an = l.grad(p);
            expect(dist(num, an)).toBeLessThan(1e-5 * Math.max(1, norm(an)));
          }
        }
      }
    });

    it('quadraticHessian has the stated curvatures along and across the stated direction', () => {
      const H = quadraticHessian(0.5, 4, VALLEY_ANGLE);
      expect(H).toEqual(VALLEY_H);
      expect(H[1]).toBeCloseTo(H[2], 15);
      const [hi, lo] = symEigenvalues(H);
      expect(hi).toBeCloseTo(4, 12);
      expect(lo).toBeCloseTo(0.5, 12);
      const u: Vec2 = [Math.cos(VALLEY_ANGLE), Math.sin(VALLEY_ANGLE)];
      const Hu = apply2(H, u);
      expect(Hu[0]).toBeCloseTo(0.5 * u[0], 12);
      expect(Hu[1]).toBeCloseTo(0.5 * u[1], 12);
      // The finite-difference Hessian of the loss is H itself.
      const Hn = hessian2(LANDSCAPES.valley.loss, [4.3, 1.8]);
      Hn.forEach((h, k) => expect(h).toBeCloseTo(H[k], 4));
    });

    it('each quadratic is 0 at its minimum and positive elsewhere', () => {
      expect(LANDSCAPES.valley.loss(...VALLEY_M)).toBe(0);
      expect(LANDSCAPES.bowl.loss(...BOWL_M)).toBe(0);
      expect(LANDSCAPES.bowl.loss(BOWL_M[0] + 1, BOWL_M[1])).toBeCloseTo(1, 12); // ½·2·1²
      expect(LANDSCAPES.valley.loss(...LANDSCAPES.valley.start)).toBeGreaterThan(10);
    });

    it('the two-dip map has two true minima (deeper one at loss 0) and a ridge between them', () => {
      const [g, local] = LANDSCAPES.bumpy.minima;
      expect(g.global && !local.global).toBe(true);
      for (const m of [g, local]) {
        expect(norm(bumpyGradRaw(m.at))).toBeLessThan(1e-12);
        const H = bumpyHessian(m.at);
        expect(H[0] > 0 && H[0] * H[3] - H[1] * H[2] > 0).toBe(true); // positive definite: a real minimum
      }
      expect(LANDSCAPES.bumpy.loss(...g.at)).toBeCloseTo(0, 12);
      expect(local.loss).toBeGreaterThan(1);
      expect(g.at[0]).toBeLessThan(2);
      expect(local.at[0]).toBeGreaterThan(5.5);
      // Walking straight from one dip to the other climbs over a ridge higher than both.
      let ridge = -Infinity;
      for (let t = 0; t <= 1; t += 0.01) {
        const p: Vec2 = [g.at[0] + t * (local.at[0] - g.at[0]), g.at[1] + t * (local.at[1] - g.at[1])];
        ridge = Math.max(ridge, LANDSCAPES.bumpy.loss(p[0], p[1]));
      }
      expect(ridge).toBeGreaterThan(local.loss + 0.2);
    });

    it('contour levels are increasing, tidy and below the cap', () => {
      for (const id of LANDSCAPE_IDS) {
        const lv = LANDSCAPES[id].levels;
        for (let k = 1; k < lv.length; k++) expect(lv[k]).toBeGreaterThan(lv[k - 1]);
      }
      expect(geometricLevels(0.25, 2, 40)).toEqual([0.25, 0.5, 1, 2, 4, 8, 16, 32]);
    });
  });

  describe('math.ts: running gradient descent', () => {
    it('matches the closed form θ_k − m = (I − ηH)^k (θ₀ − m) on a quadratic', () => {
      const eta = 0.13;
      const r = runGD(LANDSCAPES.valley, [1, 5], eta, 25);
      const M: Mat2 = [1 - eta * VALLEY_H[0], -eta * VALLEY_H[1], -eta * VALLEY_H[2], 1 - eta * VALLEY_H[3]];
      let e: Vec2 = sub([1, 5], VALLEY_M);
      for (let k = 0; k <= 25; k++) {
        expect(dist(sub(r.points[k], VALLEY_M), e)).toBeLessThan(1e-12);
        e = apply2(M, e);
      }
    });

    it('each step moves by exactly −η times the gradient', () => {
      const l = LANDSCAPES.bumpy;
      const r = runGD(l, l.start, 0.2, 10);
      for (let k = 0; k < 10; k++) {
        const g = l.grad(r.points[k]);
        expect(dist(r.points[k + 1], [r.points[k][0] - 0.2 * g[0], r.points[k][1] - 0.2 * g[1]])).toBeLessThan(1e-12);
        expect(r.losses[k]).toBeCloseTo(l.loss(...r.points[k]), 12);
      }
    });

    it('on the valley: tiny rates crawl, moderate ones arrive, 2/λ_max is the edge, beyond it diverges', () => {
      const v = LANDSCAPES.valley;
      const edge = maxStableRate(VALLEY_LAMBDA[1]);
      expect(edge).toBe(0.5);
      expect(runGD(v, v.start, 0.01, 40).outcome).toBe('crawling');
      expect(runGD(v, v.start, 0.1, 40).outcome).toBe('crawling');
      const good = runGD(v, v.start, 0.3, 40);
      expect(good.outcome).toBe('arrived');
      const zig = runGD(v, v.start, 0.45, 40);
      expect(zig.outcome).toBe('arrived');
      expect(zig.reversals).toBeGreaterThan(20);
      expect(runGD(v, v.start, edge, 40).outcome).toBe('bouncing'); // factor exactly −1 across the valley: bounces forever
      expect(runGD(v, v.start, 0.55, 40).outcome).toBe('diverged');
      expect(contraction(0.49, VALLEY_LAMBDA)).toBeLessThan(1);
      expect(contraction(0.51, VALLEY_LAMBDA)).toBeGreaterThan(1);
    });

    it('the mission is reachable: some rate on the slider reaches the valley floor in ≤ 20 steps', () => {
      const v = LANDSCAPES.valley;
      const ok = [0.34, 0.38, 0.42, 0.45].map((eta) => runGD(v, v.start, eta, 40));
      for (const r of ok) expect(r.outcome === 'arrived' && r.settledAt !== null && r.settledAt <= 20).toBe(true);
      // and no rate below 0.25 does it (crawling along the shallow floor is the bottleneck)
      for (const eta of [0.05, 0.1, 0.2, 0.25]) {
        const r = runGD(v, v.start, eta, 40);
        expect(r.settledAt === null || r.settledAt > 20).toBe(true);
      }
    });

    it('settledAt agrees with the step-count formula on a one-direction problem', () => {
      // Start on the bowl's horizontal through the minimum: the error is 1D, multiplied by (1 − 2η) each step.
      const l = LANDSCAPES.bowl;
      for (const eta of [0.05, 0.1, 0.2, 0.3, 0.7]) {
        const d0 = 3;
        const r = runGD(l, [BOWL_M[0] - d0, BOWL_M[1]], eta, 200);
        const rho = Math.abs(1 - 2 * eta);
        expect(r.settledAt).toBe(stepsToShrink(rho, ARRIVE_TOL / d0 - 1e-15));
      }
    });

    it('η = 1/λ on the round bowl lands exactly on the bottom in one step', () => {
      const r = runGD(LANDSCAPES.bowl, LANDSCAPES.bowl.start, 0.5, 5);
      expect(dist(r.points[1], BOWL_M)).toBeLessThan(1e-12);
      expect(r.settledAt).toBe(1);
      expect(BOWL_H).toEqual([2, 0, 0, 2]);
    });

    it('the two-dip map: the starting side decides the dip', () => {
      const l = LANDSCAPES.bumpy;
      const right = runGD(l, l.start, 0.15, 40);
      expect(right.outcome).toBe('local');
      const left = runGD(l, [3.4, 5.3], 0.15, 40);
      expect(left.outcome).toBe('arrived');
    });

    it('diverging runs are cut where they cross the far box, and never contain NaN', () => {
      const l = LANDSCAPES.valley;
      for (const eta of [0.55, 0.8, 1.2, 1.5]) {
        const r = runGD(l, l.start, eta, 40);
        expect(r.outcome).toBe('diverged');
        const box = farBox(l.view);
        const last = r.points[r.points.length - 1];
        const onEdge = [box.x[0], box.x[1]].some((x) => Math.abs(last[0] - x) < 1e-9) || [box.y[0], box.y[1]].some((y) => Math.abs(last[1] - y) < 1e-9);
        expect(onEdge).toBe(true);
        expect(r.points.flat().every(Number.isFinite)).toBe(true);
        expect(r.points.length).toBe((r.exitStep ?? -1) + 1);
      }
      expect(exitPoint([0, 0], [10, 5], { x: [-2, 2], y: [-2, 2] })).toEqual([2, 1]);
      expect(exitPoint([0, 0], [NaN, -Infinity], { x: [-2, 2], y: [-2, 2] })[1]).toBe(-2);
    });

    it('pointAt clamps frames past a truncated run to its last point', () => {
      const r = runGD(LANDSCAPES.valley, [1, 5], 1, 40);
      expect(pointAt(r, 99)).toEqual(r.points[r.points.length - 1]);
      expect(pointAt(r, 0)).toEqual([1, 5]);
    });

    it('quadratic theory helpers', () => {
      expect(bestRate(0.5, 4)).toBeCloseTo(2 / 4.5, 15);
      expect(stepsToShrink(0.5, 1 / 8)).toBe(3);
      expect(stepsToShrink(1, 0.1)).toBe(Infinity);
      expect(stepsToShrink(0, 0.1)).toBe(1);
    });

    it('describeRun says what happened in words', () => {
      const v = LANDSCAPES.valley;
      expect(describeRun(runGD(v, v.start, 0.3, 40), v, 40)).toMatch(/^Reached the bottom in \d+ steps/);
      expect(describeRun(runGD(v, v.start, 0.45, 40), v, 40)).toMatch(/zig-zagging/);
      expect(describeRun(runGD(v, v.start, 0.01, 40), v, 40)).toMatch(/^Still rolling after 40 steps, \d\.\d\d from the bottom\.$/);
      expect(describeRun(runGD(v, v.start, 0.8, 40), v, 40)).toMatch(/off the map at step \d+/);
      expect(describeRun(runGD(v, v.start, 0.5, 40), v, 40)).toMatch(/bouncing/);
      const b = LANDSCAPES.bumpy;
      expect(describeRun(runGD(b, b.start, 0.15, 40), b, 40)).toMatch(/not the lowest one/);
      // Before the ball gets there, the sentence says where it is heading, and nothing is "found" yet.
      const r = runGD(v, v.start, 0.3, 40);
      expect(describeRun(r, v, 40, 5)).toBe(`On its way: it reaches the bottom at step ${r.settledAt}.`);
      expect(arrivedBy(r, (r.settledAt ?? 0) - 1)).toBe(false);
      expect(arrivedBy(r, r.settledAt ?? 0)).toBe(true);
      expect(arrivedBy(runGD(b, b.start, 0.15, 40), 40)).toBe(false); // a shallower dip is not the bottom
    });
  });
});
