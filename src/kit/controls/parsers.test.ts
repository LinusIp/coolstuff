import { describe, expect, it } from 'vitest';
import { parseMat2, parseNumber, parseNumbers, parsePoints, parseVec2 } from './parsers';

describe('CodeCell output parsers', () => {
  it('parseNumber accepts finite numbers only, with a learner-facing message', () => {
    expect(parseNumber(2.5)).toBe(2.5);
    expect(() => parseNumber('2')).toThrow('expected a number, got the text "2"');
    expect(() => parseNumber(Number.NaN)).toThrow(/got NaN/);
    expect(() => parseNumber([1])).toThrow(/a list of 1/);
  });
  it('parseNumbers names the bad item', () => {
    expect(parseNumbers([1, 2, 3])).toEqual([1, 2, 3]);
    expect(() => parseNumbers([1, 'x'])).toThrow('item 1 is the text "x"');
    expect(() => parseNumbers(5)).toThrow(/list of numbers/);
  });
  it('parseVec2 and parsePoints', () => {
    expect(parseVec2([1, -2])).toEqual([1, -2]);
    expect(() => parseVec2([1, 2, 3])).toThrow(/vector \[x, y\]/);
    expect(parsePoints([[0, 1], { x: 2, y: 3 }])).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(() => parsePoints([[0, 1], [2]])).toThrow('expected a list of [x, y] points, but item 1 is a list of 1');
    expect(() => parsePoints({ x: 1 })).toThrow(/list of \[x, y\] points, got an object/);
  });
  it('parseMat2 accepts rows or a flat list', () => {
    expect(parseMat2([[2, 1], [1, 2]])).toEqual([2, 1, 1, 2]);
    expect(parseMat2([1, 0, 0, 1])).toEqual([1, 0, 0, 1]);
    expect(() => parseMat2([[1, 2, 3], [4, 5, 6]])).toThrow(/2×2 matrix/);
    expect(() => parseMat2([1, 0, 0, 'x'])).toThrow(/of numbers/);
  });
});
