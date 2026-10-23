import { describe, expect, it } from 'vitest';
import { charPoly2, gdPath, gradient2, hessian2, quadraticRoots, secantSlope } from './analysis';
import { contourLevels, contours } from './contour';
import { eig2 } from './mat';

describe('gradient, Hessian, secant', () => {
  const f = (x: number, y: number) => x * x * y + Math.sin(y);
  it('gradient2 matches the analytic gradient', () => {
    for (const [x, y] of [[1, 2], [-0.5, 0.3], [2, -1]]) {
      const [gx, gy] = gradient2(f, [x, y]);
      expect(gx).toBeCloseTo(2 * x * y, 6);
      expect(gy).toBeCloseTo(x * x + Math.cos(y), 6);
    }
  });
  it('hessian2 matches the analytic Hessian and is symmetric', () => {
    const [fxx, fxy, fyx, fyy] = hessian2(f, [1.5, 0.7]);
    expect(fxx).toBeCloseTo(2 * 0.7, 4);
    expect(fxy).toBeCloseTo(2 * 1.5, 4);
    expect(fyx).toBe(fxy);
    expect(fyy).toBeCloseTo(-Math.sin(0.7), 4);
  });
  it('secantSlope tends to the derivative and refuses h = 0', () => {
    const g = (x: number) => x ** 3;
    expect(secantSlope(g, 2, 1)).toBe(19); // (27 − 8)/1
    expect(secantSlope(g, 2, 1e-6)).toBeCloseTo(12, 4);
    expect(secantSlope(g, 2, -0.5)).toBeCloseTo((1.5 ** 3 - 8) / -0.5, 12);
    expect(secantSlope(g, 2, 0)).toBeNaN();
  });
});

describe('quadratic roots and characteristic polynomials', () => {
  it('real, repeated, complex and linear cases', () => {
    expect(quadraticRoots(1, -7, 10)).toEqual({ kind: 'real', roots: [5, 2] });
    expect(quadraticRoots(1, -4, 4)).toEqual({ kind: 'repeated', roots: [2] });
    const c = quadraticRoots(1, -2, 5);
    expect(c.kind).toBe('complex');
    if (c.kind === 'complex') expect(c.roots).toEqual([{ re: 1, im: 2 }, { re: 1, im: -2 }]);
    expect(quadraticRoots(0, 2, -6)).toEqual({ kind: 'linear', roots: [3] });
    expect(quadraticRoots(0, 0, 1)).toEqual({ kind: 'linear', roots: [] });
    expect(quadraticRoots(0, 0, 0)).toEqual({ kind: 'linear', roots: [], all: true });
  });
  it('keeps the tiny root that the textbook formula loses to cancellation', () => {
    const r = quadraticRoots(1, -1e8, 1);
    expect(r.kind).toBe('real');
    if (r.kind === 'real') {
      expect(r.roots[0]).toBeCloseTo(1e8, 0);
      expect(r.roots[1]).toBeCloseTo(1e-8, 20); // textbook (−b − √disc)/2a gives 0 or garbage here
    }
  });
  it('charPoly2 roots are the eigenvalues', () => {
    for (const m of [[4, 1, 2, 3], [2, 1, 1, 2], [0, -1, 1, 0], [3, 0, 0, 3]] as [number, number, number, number][]) {
      const [a, b, c] = charPoly2(m);
      const r = quadraticRoots(a, b, c);
      const e = eig2(m);
      if (e.real) {
        const roots = r.kind === 'repeated' ? [r.roots[0], r.roots[0]] : r.kind === 'real' ? r.roots : [];
        expect(roots[0]).toBeCloseTo(e.values[0], 10);
        expect(roots[1]).toBeCloseTo(e.values[1], 10);
      } else {
        expect(r.kind).toBe('complex');
        if (r.kind === 'complex') expect(r.roots[0].im).toBeCloseTo(Math.abs(e.values[0].im), 10);
      }
    }
    expect(charPoly2([1, 2, 3, 4])).toEqual([1, -5, -2]);
  });
});

describe('gradient descent paths', () => {
  const grad = (w: number) => 2 * (w - 3); // f(w) = (w − 3)²
  it('converges for a small rate, oscillates for η between 0.5 and 1, diverges past 1', () => {
    const small = gdPath(grad, 0, 0.1, 100);
    expect(small.points).toHaveLength(101);
    expect(small.points[100]).toBeCloseTo(3, 6);
    const zigzag = gdPath(grad, 0, 0.9, 200).points;
    expect(Math.sign(zigzag[1] - 3)).toBe(-Math.sign(zigzag[2] - 3)); // overshoots each step
    expect(zigzag[200]).toBeCloseTo(3, 6);
    const bad = gdPath(grad, 0, 1.1, 1000);
    expect(bad.stop).toBe('diverged');
    expect(bad.points.length).toBeLessThan(1000);
  });
  it('vector parameters, and early stop on convergence', () => {
    const g2 = ([x, y]: readonly number[]) => [2 * x, 20 * y]; // f = x² + 10y²
    const run = gdPath(g2, [4, 1], 0.04, 500, { tol: 1e-10 });
    expect(run.stop).toBe('converged');
    const last = run.points[run.points.length - 1] as number[];
    expect(Math.hypot(last[0], last[1])).toBeLessThan(1e-8);
  });
});

describe('contours (marching squares)', () => {
  const circle = (x: number, y: number) => x * x + y * y;
  it('traces x² + y² = 1 as one closed loop of radius 1', () => {
    const [c] = contours(circle, { x: [-2, 2], y: [-2, 2] }, [1], 64);
    expect(c.level).toBe(1);
    expect(c.lines).toHaveLength(1);
    const loop = c.lines[0];
    expect(loop.length).toBeGreaterThan(60);
    expect(loop[0]).toEqual(loop[loop.length - 1]);
    for (const [x, y] of loop) expect(Math.abs(Math.hypot(x, y) - 1)).toBeLessThan(0.01);
  });
  it('several levels, open curves at the boundary, saddles, and holes', () => {
    const levels = contours(circle, { x: [-1.8, 1.8], y: [-1.8, 1.8] }, [0.25, 1, 4], 48);
    expect(levels.map((l) => l.lines.length)).toEqual([1, 1, 4]); // r = 2 only crosses the box's corners: four open arcs
    const saddle = contours((x, y) => x * y, { x: [-1, 1], y: [-1, 1] }, [0.1], 40)[0];
    expect(saddle.lines).toHaveLength(2); // two hyperbola branches
    for (const line of saddle.lines) for (const [x, y] of line) expect(x * y).toBeCloseTo(0.1, 2);
    const holey = contours((x, y) => (x > 0 ? NaN : x * x + y * y), { x: [-2, 2], y: [-2, 2] }, [1], 40)[0];
    for (const line of holey.lines) for (const [x] of line) expect(x).toBeLessThanOrEqual(0.0001);
  });
  it('nice automatic levels', () => {
    expect(contourLevels(0, 1, 5)).toEqual([0.2, 0.4, 0.6, 0.8]);
    const auto = contours(circle, { x: [-1, 1], y: [-1, 1] }, 4, 20);
    expect(auto.length).toBeGreaterThan(1);
    for (const l of auto) expect(l.level).toBeGreaterThan(0);
  });
});
