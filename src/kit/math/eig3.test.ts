import { describe, expect, it } from 'vitest';
import { cubicRoots, eig3 } from './eig3';
import { apply3, type Mat3 } from './mat';

describe('cubicRoots', () => {
  it('three distinct real roots', () => {
    const r = cubicRoots(1, -6, 11, -6); // (x−1)(x−2)(x−3)
    expect(r.map((x) => Number(x.toFixed(12)))).toEqual([1, 2, 3]);
  });
  it('one real root', () => {
    const r = cubicRoots(1, 0, 1, 2); // x³ + x + 2 = (x + 1)(x² − x + 2)
    expect(r).toHaveLength(1);
    expect(r[0]).toBeCloseTo(-1, 12);
  });
  it('double and triple roots keep their multiplicity', () => {
    const d = cubicRoots(1, -4, 5, -2); // (x−1)²(x−2)
    expect(d).toHaveLength(3);
    expect(d[0]).toBeCloseTo(1, 6);
    expect(d[1]).toBeCloseTo(1, 6);
    expect(d[2]).toBeCloseTo(2, 9);
    expect(cubicRoots(2, -6, 6, -2)).toEqual([1, 1, 1]); // 2(x−1)³
  });
  it('degenerates to quadratic and linear', () => {
    expect(cubicRoots(0, 1, -3, 2)).toEqual([1, 2]);
    expect(cubicRoots(0, 0, 2, -4)).toEqual([2]);
    expect(cubicRoots(0, 1, 0, 1)).toEqual([]);
  });
  it('every returned root satisfies the cubic, across random cubics', () => {
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 10 - 5;
    for (let k = 0; k < 300; k++) {
      const [a, b, c, d] = [rnd() || 1, rnd(), rnd(), rnd()];
      for (const x of cubicRoots(a, b, c, d)) {
        const scale = Math.abs(a * x ** 3) + Math.abs(b * x * x) + Math.abs(c * x) + Math.abs(d) + 1;
        expect(Math.abs(((a * x + b) * x + c) * x + d) / scale).toBeLessThan(1e-9);
      }
    }
  });
});

describe('eig3', () => {
  const check = (M: Mat3) => {
    const e = eig3(M);
    for (const { value, dir } of e.directions) {
      const Mv = apply3(M, dir);
      for (let k = 0; k < 3; k++) expect(Mv[k]).toBeCloseTo(value * dir[k], 8);
    }
    return e;
  };
  it('a diagonal matrix: the axes', () => {
    const e = check([2, 0, 0, 0, 3, 0, 0, 0, -1]);
    expect(e.values.map((x) => Number(x.toFixed(10)))).toEqual([-1, 2, 3]);
    expect(e.directions).toHaveLength(3);
  });
  it('a symmetric matrix: three orthogonal directions', () => {
    const e = check([2, 1, 0, 1, 2, 0, 0, 0, 5]);
    expect(e.directions).toHaveLength(3);
  });
  it('a rotation about z: one real direction (the axis)', () => {
    const c = Math.cos(0.7);
    const s = Math.sin(0.7);
    const e = check([c, -s, 0, s, c, 0, 0, 0, 1]);
    expect(e.values).toHaveLength(1);
    expect(e.directions.map((d) => d.dir.map((x) => Number(x.toFixed(9))))).toEqual([[0, 0, 1]]);
  });
  it('a repeated eigenvalue with a plane of eigenvectors', () => {
    const e = check([2, 0, 0, 0, 2, 0, 0, 0, 5]);
    expect(e.directions.filter((d) => Math.abs(d.value - 2) < 1e-9)).toHaveLength(2);
  });
  it('a scalar matrix keeps every direction', () => {
    expect(eig3([3, 0, 0, 0, 3, 0, 0, 0, 3])).toMatchObject({ everyDirection: true, values: [3, 3, 3] });
  });
  it('random matrices: every reported direction is an eigenvector', () => {
    let s = 11;
    const rnd = () => Math.round((((s = (s * 48271) % 2147483647) / 2147483647) * 8 - 4) * 2) / 2;
    for (let k = 0; k < 200; k++) check(Array.from({ length: 9 }, rnd) as Mat3);
  });
});
