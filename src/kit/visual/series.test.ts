import { signal } from '@preact/signals';
import { describe, expect, it } from 'vitest';
import { derivative } from '../math/calculus';
import type { Vec2 } from '../math/vec';
import { makeScale } from './scales';
import { autoYRange, createSeriesSampler, hasSignalProps, sampleSeries, seriesLayer, type PlotSeries } from './series';

const scale = makeScale({ x: [-2, 3], y: [-2, 6] }, 600, 400, false);
const f = (x: number) => x * x - 1;

describe('series reactivity (README §6.2)', () => {
  it('a function series that reads a signal re-samples when it changes, and only that series does', () => {
    const x0 = signal<Vec2>([1, 0]);
    const tangent = (x: number) => f(x0.value[0]) + derivative(f, x0.value[0]) * (x - x0.value[0]);
    const counts = { curve: 0, tangent: 0 };
    const curve = createSeriesSampler({ kind: 'function', f, concept: 'output' }, scale, () => counts.curve++);
    const tan = createSeriesSampler({ kind: 'function', f: tangent, concept: 'rate' }, scale, () => counts.tangent++);
    void curve.value;
    void tan.value;
    expect(counts).toEqual({ curve: 1, tangent: 1 });
    // Reading again without changes: cached.
    void curve.value;
    void tan.value;
    expect(counts).toEqual({ curve: 1, tangent: 1 });
    x0.value = [2, 0];
    void curve.value;
    const g = tan.value;
    expect(counts).toEqual({ curve: 1, tangent: 2 });
    // The re-sampled tangent passes through (2, f(2)) with slope 4.
    const pts = g.kind === 'lines' ? g.lines[0] : [];
    const p = pts.find(([x]) => Math.abs(x - 2) < 0.02)!;
    expect(p[1]).toBeCloseTo(f(2) + 4 * (p[0] - 2), 4);
  });
  it('f may itself be a signal', () => {
    const fs = signal<(x: number) => number>((x) => x);
    let n = 0;
    const s = createSeriesSampler({ kind: 'function', f: fs }, scale, () => n++);
    void s.value;
    fs.value = (x) => 2 * x;
    const g = s.value;
    expect(n).toBe(2);
    expect(g.kind === 'lines' && g.lines[0][0][1]).toBe(-4);
  });
  it('signal-valued props (data, n, rule, from/to) re-sample their series', () => {
    const data = signal<readonly Vec2[]>([[0, 0], [1, 1]]);
    const n = signal(4);
    const rule = signal<'left' | 'right'>('left');
    let a = 0;
    let b = 0;
    const line = createSeriesSampler({ kind: 'line', data }, scale, () => a++);
    const rs = createSeriesSampler({ kind: 'riemann', f, a: 0, b: 2, n, rule }, scale, () => b++);
    void line.value;
    void rs.value;
    data.value = [...data.value, [2, 4]];
    n.value = 8;
    const g = rs.value;
    void line.value;
    expect([a, b]).toEqual([2, 2]);
    expect(g.kind === 'polys' && g.polys.length).toBe(8);
    rule.value = 'right';
    void rs.value;
    expect(b).toBe(3);
  });
  it('layers: functions and signals are dynamic, plain data static, `layer` overrides', () => {
    expect(seriesLayer({ kind: 'function', f })).toBe('dynamic');
    expect(seriesLayer({ kind: 'points', data: [[0, 0]] })).toBe('static');
    expect(seriesLayer({ kind: 'points', data: signal<readonly Vec2[]>([]) })).toBe('dynamic');
    expect(seriesLayer({ kind: 'contour', f: (x, y) => x + y, layer: 'static' })).toBe('static');
    expect(hasSignalProps({ kind: 'area', f, from: signal(0), to: 1 })).toBe(true);
  });
});

describe('sampleSeries kinds', () => {
  const kinds: PlotSeries[] = [
    { kind: 'function', f: Math.tan },
    { kind: 'parametric', f: (t) => [Math.cos(t), Math.sin(t)], t: [0, 6.3] },
    { kind: 'points', data: [[0, 1], [1, 2]] },
    { kind: 'line', data: [[0, 1], [1, 2]] },
    { kind: 'histogram', data: [0, 1, 1, 2], bins: 3 },
    { kind: 'bars', values: [1, 2, 3] },
    { kind: 'field', F: (x, y) => [y, -x] },
    { kind: 'contour', f: (x, y) => x * x + y * y, levels: 4 },
    { kind: 'heat', f: (x, y) => x * y, scheme: 'diverging' },
    { kind: 'area', f, from: 0, to: 2 },
    { kind: 'riemann', f, a: 0, b: 2, n: 5, rule: 'mid' },
  ];
  for (const s of kinds) {
    it(`${s.kind} produces geometry`, () => {
      const g = sampleSeries(s, scale);
      const size =
        g.kind === 'lines' ? g.lines.length : g.kind === 'points' ? g.points.length : g.kind === 'rects' ? g.rects.length : g.kind === 'polys' ? g.polys.length : g.kind === 'arrows' ? g.arrows.length : g.kind === 'contours' ? g.levels.length : g.values.length;
      expect(size).toBeGreaterThan(0);
    });
  }
  it('contour levels from a list or a count; heat range from data or given', () => {
    const c = sampleSeries({ kind: 'contour', f: (x, y) => x * x + y * y, levels: [1, 4] }, scale);
    expect(c.kind === 'contours' && c.levels.map((l) => l.level)).toEqual([1, 4]);
    const h = sampleSeries({ kind: 'heat', f: (x, y) => x + y, range: [-10, 10] }, scale);
    expect(h.kind === 'grid' && [h.min, h.max]).toEqual([-10, 10]);
  });
});

describe('autoYRange', () => {
  it('covers every series and ignores pole spikes', () => {
    const [lo, hi] = autoYRange([{ kind: 'function', f: Math.tan }, { kind: 'points', data: [[0, 3]] }], [-3, 3]);
    expect(hi).toBeGreaterThan(3);
    expect(hi).toBeLessThan(40);
    expect(lo).toBeLessThan(-2);
  });
  it('bars and histograms start at 0', () => {
    const [lo] = autoYRange([{ kind: 'bars', values: [3, 4, 5] }], [0, 3]);
    expect(lo).toBeLessThanOrEqual(0);
  });
});
