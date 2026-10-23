import { describe, expect, it } from 'vitest';
import { applyConstraint, clampConstrained, constraintEnds, keyMove, resolveHandle, snapDirections, snapGrid, snapTargets, visibleCurveX } from './constraints';

const V = { x: [-5, 5], y: [-5, 5] } as const;
const near = (a: readonly number[], b: readonly number[], d = 9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], d));

describe('constraints', () => {
  it('free, x and y', () => {
    expect(applyConstraint([1, 2], 'free')).toEqual([1, 2]);
    expect(applyConstraint([1, 2], { x: 3 })).toEqual([3, 2]);
    expect(applyConstraint([1, 2], { y: -1 })).toEqual([1, -1]);
  });
  it('a curve keeps x and sets y = f(x)', () => {
    expect(applyConstraint([2, 99], { curve: (x) => x * x })).toEqual([2, 4]);
  });
  it('a line projects perpendicularly', () => {
    near(applyConstraint([2, 0], { line: [[0, 0], [1, 1]] }), [1, 1]);
    expect(applyConstraint([2, 0], { line: [[1, 1], [1, 1]] })).toEqual([1, 1]);
  });
  it('a circle projects radially (the centre maps to angle 0)', () => {
    near(applyConstraint([0, 3], { circle: { c: [0, 0], r: 2 } }), [0, 2]);
    near(applyConstraint([0, 0], { circle: { c: [0, 0], r: 2 } }), [2, 0]);
  });
  it('a custom function, ignoring non-finite output', () => {
    expect(applyConstraint([1, 1], (p) => [p[0] * 2, 0])).toEqual([2, 0]);
    expect(applyConstraint([1, 1], () => [NaN, 0])).toEqual([1, 1]);
  });
});

describe('snapping', () => {
  it('grid snap rounds the free axes and keeps a curve on the curve', () => {
    expect(snapGrid([0.74, -0.26], 0.5)).toEqual([0.5, -0.5]);
    expect(snapGrid([0.74, 9], 0.5, { x: 9 })).toEqual([9, 9]);
    expect(snapGrid([1.26, 0], 0.5, { curve: (x) => 2 * x })).toEqual([1.5, 3]);
    expect(Object.is(snapGrid([-0.1, 0], 0.5)[0], -0)).toBe(false);
  });
  it('magnetic targets within a radius', () => {
    expect(snapTargets([1.05, 0.98], [[1, 1], [3, 3]], 0.1)).toEqual([1, 1]);
    expect(snapTargets([1.5, 1.5], [[1, 1], [3, 3]], 0.1)).toEqual([1.5, 1.5]);
  });
  it('magnetic directions within 3°, either way along the line, keeping length', () => {
    const p = snapDirections([Math.cos(0.03) * 2, Math.sin(0.03) * 2], [[1, 0]], 3);
    near(p, [2, 0]);
    const q = snapDirections([-2, 0.05], [[1, 0]], 3);
    near(q, [-Math.hypot(2, 0.05), 0]);
    expect(snapDirections([1, 1], [[1, 0]], 3)).toEqual([1, 1]);
  });
});

describe('bounds and the full pipeline', () => {
  it('clamps free points into the view', () => {
    expect(clampConstrained([9, -9], 'free', V)).toEqual([5, -5]);
  });
  it('a curve handle stays on the part of the curve inside the bounds', () => {
    const p = clampConstrained([7, 49], { curve: (x) => x * x }, V);
    near(p, [Math.sqrt(5), 5], 6);
    // From a previous position on the left branch it stops at the left edge of the visible piece.
    const q = clampConstrained([-7, 49], { curve: (x) => x * x }, V, [-1, 1]);
    near(q, [-Math.sqrt(5), 5], 6);
    // A curve that never enters the bounds keeps x clamped.
    expect(clampConstrained([9, 0], { curve: () => 100 }, V)[0]).toBe(5);
  });
  it('visibleCurveX searches inward from the previous position', () => {
    const f = (x: number) => 1 / x; // two visible pieces in [-5, 5]² with |x| ≥ 0.2
    expect(visibleCurveX(f, 0.01, V, 1)).toBeCloseTo(0.2, 6);
    expect(visibleCurveX(f, -0.01, V, -1)).toBeCloseTo(-0.2, 6);
  });
  it('a line is clamped to its piece inside the view', () => {
    near(clampConstrained([9, 9], { line: [[0, 0], [1, 1]] }, V), [5, 5]);
  });
  it('resolveHandle: constrain → snap → bounds', () => {
    expect(resolveHandle([0.74, 3], { constrain: { y: 0 }, snap: 0.5, bounds: V })).toEqual([0.5, 0]);
    expect(resolveHandle([12, 1], { snap: 1, bounds: V })).toEqual([5, 1]);
    expect(resolveHandle([1.02, 1.01], { snap: [[1, 1]], targetRadius: 0.1, bounds: V })).toEqual([1, 1]);
    expect(resolveHandle([NaN, 1], { bounds: V })).toEqual([0, 0]);
  });
});

describe('keyboard', () => {
  it('free handles step on their axis', () => {
    near(keyMove([1, 1], 'left', 0.1, 'free'), [0.9, 1]);
    near(keyMove([1, 1], 'up', 0.5, undefined), [1, 1.5]);
  });
  it('constrained handles step along the constraint', () => {
    near(keyMove([1, 1], 'right', 0.5, { curve: (x) => x * x }), [1.5, 2.25]);
    near(keyMove([0, 2], 'down', 0.5, { x: 0 }), [0, 1.5]);
    near(keyMove([0, 2], 'left', 0.5, { y: 2 }), [-0.5, 2]);
    const s = Math.SQRT1_2 * 0.5;
    near(keyMove([0, 0], 'up', 0.5, { line: [[1, 1], [0, 0]] }), [s, s]); // forward = increasing x, whichever way the line was given
    near(keyMove([2, 0], 'up', Math.PI, { circle: { c: [0, 0], r: 2 } }), [0, 2]); // counter-clockwise by arc length π/2·2
  });
  it('Home/End go to the ends of a curve, line or x/y constraint', () => {
    expect(constraintEnds({ curve: (x) => x }, V)).toEqual([[-5, -5], [5, 5]]);
    const cubic = constraintEnds({ curve: (x) => x * x * x }, V)!;
    near(cubic[0], [-Math.cbrt(5), -5], 6); // the ends of the visible piece, not off the plate
    near(cubic[1], [Math.cbrt(5), 5], 6);
    expect(constraintEnds({ x: 1 }, V)).toEqual([[1, -5], [1, 5]]);
    const e = constraintEnds({ line: [[1, 0], [0, 0]] }, V)!;
    near(e[0], [-5, 0]);
    near(e[1], [5, 0]);
    expect(constraintEnds('free', V)).toBeNull();
    expect(constraintEnds({ circle: { c: [0, 0], r: 1 } }, V)).toBeNull();
  });
});
