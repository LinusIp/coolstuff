import { describe, expect, it } from 'vitest';
import { apply2, det2, type Mat2 } from '../math/mat';
import { columnOf, determinantNote, displayMatrix, eigenLines, eigenName, gridLines, gridReach, stepEntry, unitSquare, withColumn } from './matrixgrid';

const A: Mat2 = [2, 1, 1, 2];

describe('MatrixGrid maths', () => {
  it('morph: identity at 0, the matrix at 1, entries interpolated between', () => {
    expect(displayMatrix(A, 0)).toEqual([1, 0, 0, 1]);
    expect(displayMatrix(A, 1)).toEqual(A);
    expect(displayMatrix(A, 0.5)).toEqual([1.5, 0.5, 0.5, 1.5]);
    expect(displayMatrix(A)).toEqual(A);
    expect(displayMatrix(A, 7)).toEqual(A);
  });
  it('grid lines are images of x = k and y = k', () => {
    const lines = gridLines(A, 2);
    expect(lines).toHaveLength(10);
    expect(lines[0]).toEqual([apply2(A, [-2, -2]), apply2(A, [-2, 2])]);
  });
  it('grid reach grows when the matrix shrinks a direction, and is capped when singular', () => {
    const v = { x: [-4, 4] as const, y: [-3, 3] as const };
    expect(gridReach(v, [1, 0, 0, 1])).toBe(5);
    expect(gridReach(v, [0.5, 0, 0, 1])).toBe(9);
    expect(gridReach(v, [1, 2, 0.5, 1])).toBe(40);
  });
  it('the unit square maps to the parallelogram on the columns; its signed area is det', () => {
    const sq = unitSquare(A);
    expect(sq).toEqual([[0, 0], [2, 1], [3, 3], [1, 2]]);
    const shoelace = sq.reduce((s, p, i) => {
      const q = sq[(i + 1) % sq.length];
      return s + (p[0] * q[1] - q[0] * p[1]) / 2;
    }, 0);
    expect(shoelace).toBeCloseTo(det2(A));
  });
  it('determinant in words: scaling, flip, collapse', () => {
    expect(determinantNote(A)).toMatchObject({ det: 3, flipped: false, flat: false, words: 'area × 3' });
    expect(determinantNote([0, 1, 1, 0])).toMatchObject({ flipped: true, words: 'area × −1: orientation flipped' });
    expect(determinantNote([1, 2, 0.5, 1])).toMatchObject({ flat: true, det: 0, words: 'area 0: the plane is squashed onto a line' });
    expect(determinantNote([0, 0, 0, 0]).words).toBe('area 0: the plane is squashed onto a point');
  });
  it('eigen-directions with their factors in words', () => {
    const e = eigenLines(A);
    expect(e.kind).toBe('lines');
    if (e.kind === 'lines') {
      expect(e.lines.map((l) => l.name)).toEqual(['stretched ×3', 'unchanged ×1']);
      for (const l of e.lines) {
        const Av = apply2(A, l.dir);
        expect(Av[0]).toBeCloseTo(l.lambda * l.dir[0]);
        expect(Av[1]).toBeCloseTo(l.lambda * l.dir[1]);
      }
    }
    expect(eigenLines([0, -1, 1, 0])).toMatchObject({ kind: 'none' });
    expect(eigenLines([2, 0, 0, 2])).toMatchObject({ kind: 'every', lambda: 2, name: 'stretched ×2' });
    expect(eigenName(-2)).toBe('flipped ×−2');
    expect(eigenName(0.5)).toBe('shrunk ×0.5');
    expect(eigenName(0)).toBe('squashed ×0');
  });
  it('columns and entry steps', () => {
    expect(withColumn(A, 0, [5, 6])).toEqual([5, 1, 6, 2]);
    expect(withColumn(A, 1, [5, 6])).toEqual([2, 5, 1, 6]);
    expect(columnOf(A, 1)).toEqual([1, 2]);
    expect(stepEntry(A, 1, 0.5, 0.5)).toEqual([2, 1.5, 1, 2]);
    expect(stepEntry([0.1, 0, 0, 0], 0, 0.2, 0.1)).toEqual([0.3, 0, 0, 0]);
    expect(Object.is(stepEntry([0.5, 0, 0, 0], 0, -0.5, 0.5)[0], -0)).toBe(false);
  });
});

describe('imageOf (the value the image arrow draws)', () => {
  it('is A·v through the morph and follows every signal', async () => {
    const { signal } = await import('@preact/signals');
    const { imageOf, imageValue, isWritableSignal } = await import('./MatrixGrid');
    const m = signal<Mat2>([2, 1, 1, 2]);
    const v = signal<[number, number]>([1, 0.5]);
    const t = signal(0.5);
    const img = imageOf(m, v, t);
    expect(img.value).toEqual(apply2(displayMatrix(m.value, 0.5), v.value));
    expect(img.value).toEqual(imageValue(m.value, v.value, 0.5));
    t.value = 1;
    expect(img.value).toEqual([2.5, 2]);
    m.value = [0, -1, 1, 0];
    v.value = [1, 0];
    expect(img.value).toEqual([0, 1]);
    expect(imageOf(m, v).value).toEqual([0, 1]);
    expect(isWritableSignal(v)).toBe(true);
    expect(isWritableSignal(img)).toBe(false);
  });
});
