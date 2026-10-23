import { describe, expect, it } from 'vitest';
import { FLIP_TOTAL_MS, flipPlan, flipTransform, visibleSteps } from './flip';
import { anchorOccurrences } from './anchors';

const r = (left: number, top: number, width = 20, height = 24) => ({ left, top, width, height });

describe('derivation FLIP plan', () => {
  it('slides the k-th occurrence to the k-th, fades the extras', () => {
    // λ appears twice in the old step and once in the new one: the first slides, the second drops away.
    const from = anchorOccurrences('A^2\\anchor{v}{\\vec v} = \\anchor{lam}{\\lambda}\\,\\anchor{lam}{\\lambda}\\anchor{v}{\\vec v}');
    const to = anchorOccurrences('A^2\\anchor{v}{\\vec v} = \\anchor{lam}{\\lambda}^2\\anchor{v}{\\vec v}');
    expect(from).toEqual(['v', 'lam', 'lam', 'v']);
    expect(to).toEqual(['v', 'lam', 'v']);
    const plan = flipPlan(from, to, [r(10, 0), r(60, 0), r(80, 0), r(100, 0)], [r(10, 50), r(60, 50, 20, 24), r(90, 50)]);
    expect(plan.moves.map((m) => [m.from, m.to])).toEqual([
      [0, 0],
      [1, 1],
      [3, 2],
    ]);
    expect(plan.leaving).toEqual([2]);
    expect(plan.entering).toEqual([]);
    expect(plan.moves[2]).toMatchObject({ dx: 10, dy: -50, sx: 1, sy: 1 });
  });

  it('new extras fade in; sizes scale within limits', () => {
    const plan = flipPlan(['v'], ['v', 'v'], [r(0, 0, 40, 40)], [r(0, 30, 10, 10), r(30, 30)]);
    expect(plan.entering).toEqual([1]);
    expect(plan.moves[0].sx).toBe(2);
    expect(flipTransform({ dx: 1.234, dy: -5, sx: 1, sy: 0.5 })).toBe('translate(1.2px, -5px) scale(1, 0.5)');
    expect(FLIP_TOTAL_MS).toBeLessThanOrEqual(420);
  });

  it('visible steps: current + 1, or every step when showing all', () => {
    expect(visibleSteps(0, 4, false)).toBe(1);
    expect(visibleSteps(2, 4, false)).toBe(3);
    expect(visibleSteps(9, 4, false)).toBe(4);
    expect(visibleSteps(-3, 4, false)).toBe(1);
    expect(visibleSteps(0, 4, true)).toBe(4);
    expect(visibleSteps(0, 0, false)).toBe(0);
  });
});
