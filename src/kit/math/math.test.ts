import { describe, expect, it } from 'vitest';
import {
  apply2,
  apply3,
  angleBetween,
  bisect,
  easeOut,
  eulerStep,
  roundSig,
  stdev,
  symplecticEulerStep,
  closestOnLine,
  closestOnPolyline,
  closestOnSegment,
  columns2,
  cross,
  decimalsFor,
  derivative,
  det2,
  det3,
  dot,
  eig2,
  findRoots,
  fmt,
  fromColumns2,
  fromColumns3,
  histogram,
  IDENTITY2,
  IDENTITY3,
  integrate,
  inverse2,
  inverse3,
  lerpMat2,
  linspace,
  mean,
  mul2,
  mul3,
  mulberry32,
  newton,
  niceStep,
  norm3,
  orbitBasis,
  project,
  projectOrbit,
  randn,
  range,
  reject,
  riemann,
  rk4Step,
  rotate,
  rotation2,
  secondDerivative,
  snapTo,
  ticks,
  variance,
  type Mat2,
  type Mat3,
  type Vec2,
} from './index';

const close = (a: number, b: number, digits = 9) => expect(a).toBeCloseTo(b, digits);
const closeVec = (a: readonly number[], b: readonly number[], digits = 9) => {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => close(x, b[i], digits));
};

describe('scalars and sampling', () => {
  it('linspace includes both ends exactly', () => {
    expect(linspace(0, 1, 5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(linspace(-1, 1, 3)).toEqual([-1, 0, 1]);
    expect(linspace(2, 3, 1)).toEqual([2]);
    const xs = linspace(0, 0.3, 4);
    expect(xs[3]).toBe(0.3);
  });

  it('range stops before the end', () => {
    expect(range(0, 3)).toEqual([0, 1, 2]);
    expect(range(3, 0, -1)).toEqual([3, 2, 1]);
    expect(range(0, 1, 0)).toEqual([]);
  });

  it('snapTo removes float dust', () => {
    expect(snapTo(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(snapTo(-0.04, 0.1)).toBe(0);
    expect(Object.is(snapTo(-0.04, 0.1), -0)).toBe(false);
    expect(snapTo(1.26, 0.25)).toBe(1.25);
  });
});

describe('vectors', () => {
  it('projection and rejection decompose v', () => {
    const v: Vec2 = [3, 4];
    const u: Vec2 = [1, 0];
    expect(project(v, u)).toEqual([3, 0]);
    expect(reject(v, u)).toEqual([0, 4]);
    const p = project([2, 3], [1, 1]);
    closeVec(p, [2.5, 2.5]);
    close(dot(reject([2, 3], [1, 1]), [1, 1]), 0);
    expect(project([1, 2], [0, 0])).toEqual([0, 0]);
  });

  it('cross gives signed area / orientation', () => {
    expect(cross([1, 0], [0, 1])).toBe(1);
    expect(cross([0, 1], [1, 0])).toBe(-1);
  });

  it('rotate by 90° turns x into y', () => {
    closeVec(rotate([1, 0], Math.PI / 2), [0, 1]);
  });

  it('closest points on segments, lines and polylines', () => {
    expect(closestOnSegment([5, 5], [0, 0], [2, 0])).toEqual([2, 0]);
    expect(closestOnSegment([1, 5], [0, 0], [2, 0])).toEqual([1, 0]);
    expect(closestOnLine([5, 5], [0, 0], [2, 0])).toEqual([5, 0]);
    const square: Vec2[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    closeVec(closestOnPolyline([-1, 0.5], square, true), [0, 0.5]);
    closeVec(closestOnPolyline([-1, 0.5], square, false), [0, 0]);
  });
});

describe('2×2 matrices', () => {
  const A: Mat2 = [2, 1, 1, 3];

  it('columns are the images of î and ĵ', () => {
    expect(apply2(A, [1, 0])).toEqual([2, 1]);
    expect(apply2(A, [0, 1])).toEqual([1, 3]);
    expect(columns2(A)).toEqual([[2, 1], [1, 3]]);
    expect(fromColumns2([2, 1], [1, 3])).toEqual(A);
  });

  it('determinant, inverse and composition', () => {
    expect(det2(A)).toBe(5);
    const inv = inverse2(A)!;
    closeVec(mul2(A, inv), [...IDENTITY2]);
    expect(inverse2([1, 2, 2, 4])).toBeNull();
    // Composition order: (AB)v = A(Bv)
    const B: Mat2 = [0, -1, 1, 0];
    const v: Vec2 = [1, 2];
    expect(apply2(mul2(A, B), v)).toEqual(apply2(A, apply2(B, v)));
    // det(AB) = det(A) det(B)
    close(det2(mul2(A, B)), det2(A) * det2(B));
  });

  it('lerpMat2 morphs from identity', () => {
    expect(lerpMat2(IDENTITY2, A, 0)).toEqual([...IDENTITY2]);
    expect(lerpMat2(IDENTITY2, A, 1)).toEqual(A);
    expect(lerpMat2(IDENTITY2, A, 0.5)).toEqual([1.5, 0.5, 0.5, 2]);
  });

  it('eig2: symmetric matrix has orthogonal real eigenvectors', () => {
    const e = eig2([2, 1, 1, 2]);
    expect(e.real).toBe(true);
    if (!e.real) return;
    closeVec(e.values, [3, 1]);
    closeVec(e.vectors[0], [Math.SQRT1_2, Math.SQRT1_2]);
    closeVec(e.vectors[1], [Math.SQRT1_2, -Math.SQRT1_2]);
    // Av = λv for each pair
    e.vectors.forEach((v, i) => closeVec(apply2([2, 1, 1, 2], v), [v[0] * e.values[i], v[1] * e.values[i]]));
  });

  it('eig2: non-symmetric matrix satisfies Av = λv', () => {
    const M: Mat2 = [3, 1, 0, 2];
    const e = eig2(M);
    if (!e.real) throw new Error('expected real eigenvalues');
    closeVec(e.values, [3, 2]);
    e.vectors.forEach((v, i) => closeVec(apply2(M, v), [v[0] * e.values[i], v[1] * e.values[i]]));
  });

  it('eig2: rotation has complex eigenvalues', () => {
    const e = eig2(rotation2(Math.PI / 2));
    expect(e.real).toBe(false);
    if (e.real) return;
    close(e.values[0].re, 0);
    close(Math.abs(e.values[0].im), 1);
  });

  it('eig2: shear is defective, scalar matrix has every direction', () => {
    const shear = eig2([1, 1, 0, 1]);
    if (!shear.real) throw new Error('shear has real eigenvalues');
    closeVec(shear.values, [1, 1]);
    expect(shear.vectors).toHaveLength(1);
    closeVec(shear.vectors[0], [1, 0]);
    const s = eig2([2, 0, 0, 2]);
    if (!s.real) throw new Error('scalar matrix has real eigenvalues');
    expect(s.everyDirection).toBe(true);
  });

  it('eig2: diagonal matrix with zero eigenvalue', () => {
    const e = eig2([0, 0, 0, 1]);
    if (!e.real) throw new Error('real');
    closeVec(e.values, [1, 0]);
    closeVec(e.vectors[0], [0, 1]);
    closeVec(e.vectors[1], [1, 0]);
  });
});

describe('3×3 matrices', () => {
  const M: Mat3 = [2, 0, 1, 1, 3, 2, 1, 1, 2];

  it('determinant matches cofactor expansion and triple product', () => {
    expect(det3(M)).toBe(6); // 2(6−2) − 0 + 1(1−3)
    expect(det3(IDENTITY3)).toBe(1);
    // det = volume of parallelepiped spanned by the columns
    expect(det3(fromColumns3([1, 0, 0], [0, 2, 0], [0, 0, 3]))).toBe(6);
  });

  it('inverse and multiplication', () => {
    closeVec(mul3(M, inverse3(M)!), [...IDENTITY3]);
    expect(inverse3([1, 2, 3, 2, 4, 6, 0, 0, 1])).toBeNull();
    expect(apply3(M, [1, 0, 0])).toEqual([2, 1, 1]);
  });
});

describe('orbit camera', () => {
  it('basis is orthonormal and right-handed', () => {
    const b = orbitBasis(0.7, 0.4);
    close(norm3(b.right), 1);
    close(norm3(b.up), 1);
    close(norm3(b.back), 1);
    // right × up = back (toward the viewer)
    const rxu = [b.right[1] * b.up[2] - b.right[2] * b.up[1], b.right[2] * b.up[0] - b.right[0] * b.up[2], b.right[0] * b.up[1] - b.right[1] * b.up[0]];
    closeVec(rxu, b.back);
  });

  it('looking along −y from the front, x is right and z is up', () => {
    const b = orbitBasis(-Math.PI / 2, 0);
    const px = projectOrbit([1, 0, 0], b);
    const pz = projectOrbit([0, 0, 1], b);
    close(px.x, 1);
    close(px.y, 0);
    close(pz.x, 0);
    close(pz.y, 1);
  });

  it('perspective shrinks far points', () => {
    const b = orbitBasis(0, 0); // camera on +x looking at origin
    const near = projectOrbit([1, 0, 1], b, [0, 0, 0], 10);
    const far = projectOrbit([-1, 0, 1], b, [0, 0, 0], 10);
    expect(near.y).toBeGreaterThan(far.y);
  });
});

describe('calculus', () => {
  it('numeric derivative matches the analytic one', () => {
    for (const x of [-2, -0.5, 0, 1, 3]) {
      close(derivative(Math.sin, x), Math.cos(x), 8);
      close(derivative((t) => t ** 3, x), 3 * x * x, 6);
      close(secondDerivative(Math.exp, x), Math.exp(x), 3);
    }
  });

  it('Simpson integrates polynomials and sin exactly enough', () => {
    close(integrate((x) => x * x, 0, 3), 9, 10);
    close(integrate(Math.sin, 0, Math.PI), 2, 8);
    close(integrate(Math.exp, 0, 1, 51), Math.E - 1, 8);
  });

  it('Riemann sums: rules and convergence', () => {
    const f = (x: number) => x;
    expect(riemann(f, 0, 1, 4, 'left')).toBe(0.375);
    expect(riemann(f, 0, 1, 4, 'right')).toBe(0.625);
    expect(riemann(f, 0, 1, 4, 'mid')).toBe(0.5);
    expect(riemann(f, 0, 1, 4, 'trapezoid')).toBe(0.5);
    const err = (n: number) => Math.abs(riemann((x) => x * x, 0, 1, n, 'left') - 1 / 3);
    expect(err(100)).toBeLessThan(err(10));
  });

  it('bisect and newton find √2', () => {
    const f = (x: number) => x * x - 2;
    close(bisect(f, 0, 2)!, Math.SQRT2, 10);
    expect(bisect(f, 2, 3)).toBeNull();
    const r = newton(f, 1, { df: (x) => 2 * x });
    expect(r.converged).toBe(true);
    close(r.root, Math.SQRT2, 12);
    // Quadratic convergence: very few steps.
    expect(r.steps.length).toBeLessThan(8);
    expect(r.steps[1]).toBe(1.5);
  });

  it('newton reports failure at a flat tangent', () => {
    const r = newton((x) => x * x + 1, 0, { df: (x) => 2 * x });
    expect(r.converged).toBe(false);
  });

  it('findRoots finds all roots and skips poles', () => {
    const roots = findRoots(Math.sin, -0.5, 7);
    closeVec(roots, [0, Math.PI, 2 * Math.PI], 8);
    const tanRoots = findRoots(Math.tan, 0.5, 4);
    closeVec(tanRoots, [Math.PI], 8);
  });

  it('rk4 integrates exponential decay accurately', () => {
    let y = [1];
    const h = 0.1;
    for (let i = 0; i < 10; i++) y = rk4Step((_t, v) => [-v[0]], i * h, y, h);
    close(y[0], Math.exp(-1), 6);
  });

  it('rk4 keeps a harmonic oscillator on its circle', () => {
    let s = [1, 0];
    const h = 0.01;
    for (let i = 0; i < 628; i++) s = rk4Step((_t, v) => [v[1], -v[0]], i * h, s, h);
    close(s[0] ** 2 + s[1] ** 2, 1, 6);
  });
});

describe('axes and formatting', () => {
  it('niceStep picks 1/2/5 × 10^k', () => {
    expect(niceStep(0.9)).toBe(1);
    expect(niceStep(1.7)).toBe(2);
    expect(niceStep(4)).toBe(5);
    expect(niceStep(8)).toBe(10);
    expect(niceStep(0.03)).toBe(0.02);
    expect(niceStep(260)).toBe(200);
  });

  it('ticks are clean multiples', () => {
    expect(ticks(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(ticks(0.05, 0.35, 0.1)).toEqual([0.1, 0.2, 0.3]);
    expect(ticks(0, 1, 0)).toEqual([]);
  });

  it('decimalsFor and fmt', () => {
    expect(decimalsFor(1)).toBe(0);
    expect(decimalsFor(0.5)).toBe(1);
    expect(decimalsFor(0.02)).toBe(2);
    expect(decimalsFor(10)).toBe(0);
    expect(fmt(1.5)).toBe('1.5');
    expect(fmt(2)).toBe('2');
    expect(fmt(-0.001)).toBe('0');
    expect(fmt(-1.25)).toBe('−1.25');
    expect(fmt(1 / 3, 3)).toBe('0.333');
    expect(fmt(Infinity)).toBe('∞');
    expect(fmt(2.5e7)).toBe('2.50e7');
  });
});

describe('statistics', () => {
  it('mean and variance', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(variance([1, 2, 3, 4])).toBe(1.25);
    close(variance([1, 2, 3, 4], true), 5 / 3);
  });

  it('histogram counts with closed last bin', () => {
    const h = histogram([0, 0.1, 0.5, 0.99, 1, 2], 0, 1, 2);
    expect(h.edges).toEqual([0, 0.5, 1]);
    expect(h.counts).toEqual([2, 3]);
  });

  it('seeded RNG is deterministic and Box–Muller is standard normal', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const rng = mulberry32(1);
    const xs = Array.from({ length: 20000 }, () => randn(rng));
    expect(Math.abs(mean(xs))).toBeLessThan(0.03);
    expect(Math.abs(variance(xs) - 1)).toBeLessThan(0.05);
  });
});

describe('additions', () => {
  it('angleBetween, roundSig, easeOut, stdev', () => {
    close(angleBetween([1, 0], [0, 2]), Math.PI / 2);
    expect(angleBetween([0, 0], [1, 1])).toBe(0);
    expect(roundSig(123.456, 3)).toBe(123);
    expect(roundSig(0.0012345, 2)).toBe(0.0012);
    expect(roundSig(0, 3)).toBe(0);
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it('forward Euler is first order; symplectic Euler keeps an oscillator bounded', () => {
    const decay = (_t: number, y: readonly number[]) => [-y[0]];
    const run = (h: number) => {
      let y = [1];
      for (let i = 0; i < Math.round(1 / h); i++) y = eulerStep(decay, i * h, y, h);
      return Math.abs(y[0] - Math.exp(-1));
    };
    // Halving h roughly halves the error.
    expect(run(0.01) / run(0.005)).toBeGreaterThan(1.8);
    expect(run(0.01) / run(0.005)).toBeLessThan(2.2);
    let s = { x: [1], v: [0] };
    const h = 0.05;
    let maxE = 0;
    for (let i = 0; i < 4000; i++) {
      s = symplecticEulerStep((x) => [-x[0]], i * h, s.x, s.v, h);
      maxE = Math.max(maxE, 0.5 * (s.x[0] ** 2 + s.v[0] ** 2));
    }
    expect(maxE).toBeLessThan(0.52);
  });
});
