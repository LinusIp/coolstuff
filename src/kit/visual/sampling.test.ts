import { describe, expect, it } from 'vitest';
import { areaPolygons, autoRange, barRects, fieldArrows, gridValues, histogramBars, riemannShapes, sampleFunction, sampleParametric, uniformValues } from './sampling';
import { riemann } from '../math/calculus';

const PX = { pxX: 80, pxY: 40, yView: [-4, 4] as const };

describe('sampleFunction', () => {
  it('a smooth function is one run that ends exactly at the range ends', () => {
    const runs = sampleFunction(Math.sin, -3, 3, PX);
    expect(runs).toHaveLength(1);
    expect(runs[0][0][0]).toBe(-3);
    expect(runs[0][runs[0].length - 1][0]).toBe(3);
    for (const [x, y] of runs[0]) expect(y).toBeCloseTo(Math.sin(x), 12);
  });
  it('refines where the curve bends (chord error under the tolerance)', () => {
    const f = (x: number) => Math.sin(8 * x);
    const runs = sampleFunction(f, 0, 3, { ...PX, n: 20 });
    const pts = runs[0];
    expect(pts.length).toBeGreaterThan(100);
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1];
      const [x1, y1] = pts[k];
      const xm = (x0 + x1) / 2;
      expect(Math.abs(f(xm) - (y0 + y1) / 2) * PX.pxY).toBeLessThan(2);
    }
  });
  it('tan x breaks at every pole: no vertical connector', () => {
    const runs = sampleFunction(Math.tan, -4, 4, PX);
    // Poles at ±π/2 inside [-4, 4] → three runs (plus ±3π/2 ≈ ±4.71 outside).
    expect(runs.length).toBe(3);
    for (const run of runs) {
      for (let k = 1; k < run.length; k++) {
        // within a run, consecutive points never straddle a pole
        const between = Math.floor((run[k - 1][0] - Math.PI / 2) / Math.PI) === Math.floor((run[k][0] - Math.PI / 2) / Math.PI);
        expect(between).toBe(true);
      }
    }
  });
  it('1/x splits at 0 and each side approaches the asymptote', () => {
    const runs = sampleFunction((x) => 1 / x, -2, 2, PX);
    expect(runs.length).toBe(2);
    expect(runs[0].every(([x]) => x < 0)).toBe(true);
    expect(runs[1].every(([x]) => x > 0)).toBe(true);
  });
  it('jumps break the curve (floor has no risers)', () => {
    const runs = sampleFunction(Math.floor, 0.5, 3.5, PX);
    expect(runs.length).toBe(4);
  });
  it('domain edges: sqrt starts at 0, ln stops where it is undefined, throws are holes', () => {
    const r = sampleFunction(Math.sqrt, -1, 1, PX);
    expect(r).toHaveLength(1);
    expect(r[0][0][0]).toBeGreaterThanOrEqual(0);
    expect(r[0][0][0]).toBeLessThan(1e-3);
    const thrower = (x: number) => {
      if (Math.abs(x) < 0.5) throw new Error('no');
      return x;
    };
    expect(sampleFunction(thrower, -1, 1, PX)).toHaveLength(2);
  });
  it('a nowhere-defined function gives nothing', () => {
    expect(sampleFunction(() => NaN, 0, 1, PX)).toEqual([]);
  });
});

describe('sampleParametric', () => {
  it('a circle closes on itself as one run', () => {
    const runs = sampleParametric((t) => [Math.cos(t), Math.sin(t)], 0, 2 * Math.PI, { pxX: 100, pxY: 100 });
    expect(runs).toHaveLength(1);
    const pts = runs[0];
    expect(pts[0][0]).toBeCloseTo(1);
    expect(pts[pts.length - 1][0]).toBeCloseTo(1);
    for (const [x, y] of pts) expect(Math.hypot(x, y)).toBeCloseTo(1, 9);
  });
  it('undefined stretches split the curve', () => {
    const runs = sampleParametric((t) => (t > 0.4 && t < 0.6 ? [NaN, 0] : [t, t]), 0, 1, { pxX: 100, pxY: 100 });
    expect(runs.length).toBe(2);
  });
});

describe('autoRange', () => {
  it('pads a plain range and pulls in 0 when close', () => {
    const [lo, hi] = autoRange(uniformValues((x) => x * x, -2, 3));
    expect(lo).toBeLessThanOrEqual(0);
    expect(lo).toBeGreaterThan(-1);
    expect(hi).toBeGreaterThan(9);
    expect(hi).toBeLessThan(10.5);
  });
  it('ignores infinities and NaN', () => {
    expect(autoRange([1, 2, Infinity, NaN, -Infinity, 3])).toEqual(autoRange([1, 2, 3]));
  });
  it('trims pole spikes (tan x gets a readable range)', () => {
    const [lo, hi] = autoRange(uniformValues(Math.tan, -3, 3));
    expect(hi).toBeLessThan(40);
    expect(lo).toBeGreaterThan(-40);
    expect(hi).toBeGreaterThan(2);
  });
  it('a constant gets a symmetric window; empty gets [−1, 1]', () => {
    expect(autoRange([2, 2, 2])).toEqual([1, 3]);
    expect(autoRange([])).toEqual([-1, 1]);
  });
});

describe('shapes', () => {
  it('histogram counts and density (area 1)', () => {
    const bars = histogramBars([0, 0.1, 0.2, 0.9, 1], 2, [0, 1]);
    expect(bars.map((b) => b.y1)).toEqual([3, 2]);
    const dens = histogramBars([0, 0.1, 0.2, 0.9, 1], 2, [0, 1], true);
    expect(dens.reduce((s, b) => s + (b.x1 - b.x0) * b.y1, 0)).toBeCloseTo(1);
    expect(histogramBars([], 4)).toEqual([]);
  });
  it('bars are centred on their index; negatives hang below the axis', () => {
    expect(barRects([2, -1])).toEqual([
      { x0: -0.4, x1: 0.4, y0: 0, y1: 2 },
      { x0: 0.6, x1: 1.4, y0: -1, y1: 0 },
    ]);
  });
  it('Riemann shapes have the same total signed area as math.riemann', () => {
    const f = (x: number) => x * x;
    for (const rule of ['left', 'right', 'mid', 'trapezoid'] as const) {
      const shapes = riemannShapes(f, 0, 2, 7, rule);
      expect(shapes).toHaveLength(7);
      const area = shapes.reduce((s, q) => s + ((q[3][0] - q[0][0]) * (q[1][1] + q[2][1])) / 2, 0);
      expect(area).toBeCloseTo(riemann(f, 0, 2, 7, rule), 12);
    }
  });
  it('the area polygon closes on the x axis, in either order of limits', () => {
    const [poly] = areaPolygons((x) => x, 2, 0, { pxX: 50, pxY: 50 });
    expect(poly[0]).toEqual([0, 0]);
    expect(poly[poly.length - 1]).toEqual([2, 0]);
    expect(areaPolygons((x) => x, 1, 1)).toEqual([]);
  });
  it('field arrows: exact direction, longest fits its cell', () => {
    const arrows = fieldArrows((x, y) => [-y, x], { x: [-1, 1], y: [-1, 1] }, 4);
    expect(arrows).toHaveLength(16);
    const cell = (2 / 4) * 0.85;
    for (const a of arrows) {
      const want = Math.atan2(a.at[0], -a.at[1]);
      if (Math.hypot(...a.v) > 0) expect(Math.atan2(a.v[1], a.v[0])).toBeCloseTo(want, 9);
      expect(Math.hypot(...a.v)).toBeLessThanOrEqual(cell + 1e-12);
    }
    expect(Math.max(...arrows.map((a) => a.mag))).toBe(1);
  });
  it('grid values with finite min and max (holes stay NaN)', () => {
    const g = gridValues((x, y) => (x > 0.9 ? NaN : x + y), { x: [0, 1], y: [0, 1] }, 10, 10);
    expect(g.values).toHaveLength(100);
    expect(g.min).toBeCloseTo(0.1);
    expect(g.max).toBeCloseTo(0.85 + 0.95);
    expect(Number.isNaN(g.values[9])).toBe(true);
  });
});
