import { describe, expect, it } from 'vitest';
import {
  anchorBox,
  anchorForDirection,
  arrowGeometry,
  axisLayout,
  clampToPlate,
  clampZoomFactor,
  clipLine,
  clipSegment,
  fitView,
  gridStep,
  hintPlacement,
  makeScale,
  normalizeView,
  panView,
  polylinePath,
  simplifyPx,
  sameView,
  tickLabel,
  zoomLevel,
  zoomView,
} from './scales';

const close = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(eps)));

describe('fitView / makeScale', () => {
  it('equal scale grows the axis with spare room, around its centre', () => {
    const v = fitView({ x: [-1, 1], y: [-1, 1] }, 200, 100, true);
    expect(v.x).toEqual([-2, 2]);
    expect(v.y).toEqual([-1, 1]);
    const tall = fitView({ x: [0, 4], y: [0, 1] }, 100, 100, true);
    expect(tall.x).toEqual([0, 4]);
    expect(tall.y).toEqual([-1.5, 2.5]);
  });
  it('without equal scale the view is kept as given', () => {
    expect(fitView({ x: [0, 10], y: [0, 1] }, 300, 100, false)).toEqual({ x: [0, 10], y: [0, 1] });
  });
  it('one unit is the same number of pixels on both axes', () => {
    const s = makeScale({ x: [-3, 3], y: [-1, 1] }, 600, 400, true);
    expect(s.pxPerUnit).toBeCloseTo(s.pxPerUnitY);
    expect(s.pxPerUnit).toBeCloseTo(100);
    expect(s.view.y).toEqual([-2, 2]);
  });
  it('toPx and toWorld are inverses; y points up in the world, down on screen', () => {
    const s = makeScale({ x: [-1, 1], y: [-1, 1] }, 200, 100, true);
    expect(s.toPx([0, 0])).toEqual([100, 50]);
    expect(s.toPx([2, 1])).toEqual([200, 0]);
    expect(s.toPx([-2, -1])).toEqual([0, 100]);
    for (const p of [[0.3, -0.7], [1.9, 0.99], [-1.2, 0.01]] as const) close(s.toWorld(s.toPx(p)), p);
  });
  it('separate scales without equal scale', () => {
    const s = makeScale({ x: [0, 10], y: [0, 1] }, 500, 100, false);
    expect(s.pxPerUnit).toBe(50);
    expect(s.pxPerUnitY).toBe(100);
    expect(s.toPx([5, 0.5])).toEqual([250, 50]);
  });
  it('degenerate and inverted views are repaired', () => {
    expect(normalizeView({ x: [2, 2], y: [3, 1] })).toEqual({ x: [1.5, 2.5], y: [1, 3] });
    expect(normalizeView({ x: [NaN, 1], y: [0, 1] }).x).toEqual([-1, 1]);
  });
});

describe('pan and zoom', () => {
  const v0 = { x: [-2, 2], y: [-1, 1] } as const;
  it('pans by a world offset', () => {
    expect(panView(v0, 1, -0.5)).toEqual({ x: [-1, 3], y: [-1.5, 0.5] });
  });
  it('zooms around an anchor that stays put', () => {
    const z = zoomView(v0, 2, [1, 0]);
    expect(z.x).toEqual([-0.5, 1.5]);
    expect(z.y).toEqual([-0.5, 0.5]);
    expect(zoomLevel(v0, z)).toBe(2);
    expect(zoomView(v0, 2).x).toEqual([-1, 1]);
  });
  it('clamps the zoom level', () => {
    const z = zoomView(v0, 4);
    expect(clampZoomFactor(v0, z, 4, 0.5, 8)).toBeCloseTo(2);
    expect(clampZoomFactor(v0, v0, 0.1, 0.5, 8)).toBeCloseTo(0.5);
  });
  it('sameView compares within float noise', () => {
    expect(sameView(v0, { x: [-2, 2 + 1e-14], y: [-1, 1] })).toBe(true);
    expect(sameView(v0, { x: [-2, 2.1], y: [-1, 1] })).toBe(false);
  });
});

describe('grid, ticks and axes', () => {
  it('grid steps are nice and about the target spacing', () => {
    expect(gridStep(10, 640, 64)).toBe(1);
    expect(gridStep(1, 400, 64)).toBe(0.2);
    expect(gridStep(1000, 500, 60)).toBe(100);
  });
  it('tick labels use the real minus and no float noise or −0', () => {
    expect(tickLabel(-2, 1)).toBe('−2');
    expect(tickLabel(0.30000000000000004, 0.1)).toBe('0.3');
    expect(tickLabel(-1e-17, 0.5)).toBe('0');
    expect(tickLabel(2.5, 0.5)).toBe('2.5');
  });
  it('axes sit at 0 when in view, else on the nearest edge, with labels inside the plate', () => {
    const s = makeScale({ x: [-2, 2], y: [-1, 1] }, 400, 200, true);
    const L = axisLayout(s);
    expect(L.xAxisPx).toBe(100);
    expect(L.yAxisPx).toBe(200);
    expect(L.xLabelSide).toBe('below');
    expect(L.xTicks.some((t) => t.value === 0)).toBe(false); // the origin's label is dropped
    expect(L.xTicks.find((t) => t.value === -1)?.label).toBe('−1');
    const up = makeScale({ x: [0, 10], y: [2, 5] }, 400, 200, false);
    const L2 = axisLayout(up);
    expect(L2.xAxisPx).toBe(200); // y-axis range above 0: the x axis hugs the bottom
    expect(L2.xLabelSide).toBe('above');
    expect(L2.yAxisPx).toBe(0);
    expect(L2.yLabelSide).toBe('right');
  });
  it('a fixed step overrides the automatic one', () => {
    const s = makeScale({ x: [-3, 3], y: [-3, 3] }, 300, 300, true);
    expect(axisLayout(s, { step: 0.5 }).gridX).toHaveLength(13);
  });
});

describe('clipping', () => {
  const R = { x0: 0, y0: 0, x1: 10, y1: 10 };
  it('clips a segment to the rectangle', () => {
    expect(clipSegment([-5, 5], [15, 5], R)).toEqual([[0, 5], [10, 5]]);
    expect(clipSegment([2, 2], [3, 3], R)).toEqual([[2, 2], [3, 3]]);
    expect(clipSegment([-5, -5], [-1, 20], R)).toBeNull();
  });
  it('clips an infinite line through two points', () => {
    const c = clipLine([1, 1], [2, 2], R)!;
    close(c[0], [0, 0]);
    close(c[1], [10, 10]);
    expect(clipLine([1, 1], [1, 1], R)).toBeNull();
    expect(clipLine([20, 0], [20, 1], R)).toBeNull();
    const far = clipLine([-1000, 5], [-999, 5], R)!;
    close(far[0], [0, 5]);
    close(far[1], [10, 5]);
  });
});

describe('marks and labels', () => {
  it('arrowheads scale with the stroke and never overshoot a short arrow', () => {
    const thin = arrowGeometry([0, 0], [100, 0], 1)!;
    const thick = arrowGeometry([0, 0], [100, 0], 3)!;
    expect(thick.head[0]).toEqual([100, 0]);
    expect(100 - thick.head[2][0]).toBeGreaterThan(100 - thin.head[2][0]);
    const tiny = arrowGeometry([0, 0], [6, 0], 2.5)!;
    expect(Math.min(...tiny.head.map((p) => p[0]))).toBeGreaterThanOrEqual(0);
    expect(arrowGeometry([0, 0], [1, 1], 2)).toBeNull();
  });
  it('polylinePath skips empty runs and rounds to 0.01px', () => {
    expect(polylinePath([[[0, 0], [1.23456, 2]], [[5, 5]]])).toBe('M0 0L1.23 2');
    expect(polylinePath([[[0, 0], [1, 0], [1, 1]]], true)).toBe('M0 0L1 0L1 1Z');
  });
  it('anchorBox puts the label on the requested side', () => {
    expect(anchorBox([100, 100], 'n', 20, 10, 8)).toEqual([90, 82]);
    expect(anchorBox([100, 100], 'e', 20, 10, 8)).toEqual([108, 95]);
    expect(anchorBox([100, 100], 'c', 20, 10)).toEqual([90, 95]);
  });
  it('labels are clamped inside the plate', () => {
    expect(clampToPlate(-10, 5, 40, 20, 300, 200)).toEqual([6, 6]);
    expect(clampToPlate(290, 190, 40, 20, 300, 200)).toEqual([254, 174]);
    expect(clampToPlate(100, 100, 40, 20, 300, 200)).toEqual([100, 100]);
  });
  it('direction anchors point away from the arrow', () => {
    expect(anchorForDirection(1, 0)).toBe('e');
    expect(anchorForDirection(0, -1)).toBe('n'); // screen up
    expect(anchorForDirection(-1, 1)).toBe('sw');
  });
  it('the first-touch hint stays inside the plate and flips above near the bottom', () => {
    const below = hintPlacement([200, 100], 400, 300, 100);
    expect(below.y).toBeGreaterThan(100);
    const above = hintPlacement([200, 280], 400, 300, 100);
    expect(above.y).toBeLessThan(280);
    const edge = hintPlacement([395, 100], 400, 300, 100);
    expect(edge.x + 100).toBeLessThanOrEqual(400 - 8 + 1e-9);
  });
});

describe('simplifyPx', () => {
  it('drops sub-pixel points, keeps both ends and every visible bend', () => {
    const dense = Array.from({ length: 2001 }, (_, i) => [i * 0.15, 100 + 20 * Math.sin(i * 0.01)] as [number, number]);
    const s = simplifyPx(dense, 0.5);
    expect(s.length).toBeLessThan(dense.length / 2.5);
    expect(s[0]).toEqual(dense[0]);
    expect(s[s.length - 1]).toEqual(dense[dense.length - 1]);
    // every dropped point lies within 0.5px of the kept polyline's vertices
    for (const p of dense) expect(Math.min(...s.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])))).toBeLessThan(0.6);
    expect(simplifyPx([[0, 0], [0.1, 0.1]])).toEqual([[0, 0], [0.1, 0.1]]);
  });
});
