import { describe, expect, it } from 'vitest';
import { asFraction, exprNum, findUglyTex, polyExpr, polyTex, signedTerm, sumTex, texNum, texParen } from './pretty';
import { equivalent, evaluateExpr, exprToTex, parseExpr, tidyExpr } from './expr';
import { texToHtml } from '../notation';

describe('pretty numbers and terms', () => {
  it('texNum trims noise, never prints -0, and makes simple fractions', () => {
    expect(texNum(0.1 + 0.2)).toBe('0.3');
    expect(texNum(-0)).toBe('0');
    expect(texNum(-1e-15)).toBe('0');
    expect(texNum(3)).toBe('3');
    expect(texNum(-0.5, { frac: true })).toBe('-\\tfrac{1}{2}');
    expect(texNum(2 / 6, { frac: true })).toBe('\\tfrac{1}{3}');
    expect(texNum(Math.PI, { frac: true })).toBe('3.141592654');
    expect(texNum(1.23456, { decimals: 2 })).toBe('1.23');
    expect(texNum(3e-9)).toBe('3 \\times 10^{-9}');
    expect(() => texNum(NaN)).toThrow();
    expect(texParen(-2)).toBe('(-2)');
    expect(texParen(2)).toBe('2');
    expect(asFraction(0.75)).toEqual([3, 4]);
    expect(exprNum(-2 / 3, { frac: true })).toBe('-(2/3)');
  });

  it('signedTerm and sumTex fold signs and drop 1 and 0', () => {
    expect(signedTerm(-1, 'x')).toBe('- x');
    expect(signedTerm(1, 'x', true)).toBe('x');
    expect(signedTerm(-1, 'x', true)).toBe('-x');
    expect(signedTerm(3, '')).toBe('+ 3');
    expect(signedTerm(-1, '')).toBe('- 1');
    expect(signedTerm(0, 'x')).toBe('');
    expect(sumTex([{ c: 0, body: 'x^{2}' }, { c: -1, body: 'x' }, { c: 4, body: '' }])).toBe('-x + 4');
    expect(sumTex([{ c: 0, body: 'x' }])).toBe('0');
  });

  it('polyTex / polyExpr from coefficients (highest power first)', () => {
    expect(polyTex([3, -2, 1])).toBe('3x^{2} - 2x + 1');
    expect(polyTex([1, 0, -5], 't')).toBe('t^{2} - 5');
    expect(polyTex([-1, 1, 0], '\\lambda')).toBe('-\\lambda^{2} + \\lambda');
    expect(polyTex([0, 0, 0])).toBe('0');
    expect(polyTex([0.5, 0, -1 / 3], 'x', { frac: true })).toBe('\\tfrac{1}{2}x^{2} - \\tfrac{1}{3}');
    expect(polyExpr([3, -2, 1])).toBe('3x^2 - 2x + 1');
    expect(polyExpr([1, 0, -5], 't')).toBe('t^2 - 5');
    expect(polyExpr([0.5, 0, 0], 'x', { frac: true })).toBe('(1/2)*x^2');
    for (const coeffs of [[3, -2, 1], [1, 0, -5], [-1, 1, 0], [0.5, -0.25, 2]]) {
      // The answer-input form means the same polynomial…
      const f = (x: number) => coeffs.reduce((acc, c) => acc * x + c, 0);
      for (const opts of [{}, { frac: true }]) {
        const e = parseExpr(polyExpr(coeffs, 'x', opts), { vars: ['x'] });
        for (const x of [-2, 0.5, 3]) expect(evaluateExpr(e, { x })).toBeCloseTo(f(x), 10);
      }
      // …and the TeX is clean and valid.
      const tex = polyTex(coeffs, 'x', { frac: true });
      expect(findUglyTex(tex)).toEqual([]);
      expect(texToHtml(tex)).not.toMatch(/katex-error/);
    }
  });

  it('tidyExpr / pretty exprToTex', () => {
    const tidy = (s: string) => exprToTex(parseExpr(s, { vars: ['x'] }), { pretty: true });
    expect(tidy('3x^2 + -2x + 1')).toBe('3x^{2} - 2x + 1');
    expect(tidy('1x^3 - 0x^2 + 5')).toBe('x^{3} + 5');
    expect(tidy('x - -3')).toBe('x + 3');
    expect(tidy('x^1 / 1')).toBe('x');
    expect(tidy('0 + x*1')).toBe('x');
    expect(tidy('-(-x)')).toBe('x');
    expect(tidy('-1x + 2')).toBe('-x + 2');
    // The literal preview is unchanged (it shows how the learner's input was read).
    expect(exprToTex(parseExpr('3x^2 + -2x + 1', { vars: ['x'] }))).toBe('3\\,{x}^{2} + \\left(-2\\right)\\,x + 1');
    const e = parseExpr('1x^3 - 0x^2 + -2', { vars: ['x'] });
    expect(equivalent(e, tidyExpr(e), { vars: ['x'] }).equivalent).toBe(true);
  });
});

describe('findUglyTex', () => {
  it('flags double signs, coefficients 1 and 0, zero terms, exponent 1, times one, over one', () => {
    expect(findUglyTex('x + -3')).toHaveLength(1);
    expect(findUglyTex('x - -3')).toHaveLength(1);
    expect(findUglyTex('(a - \\lambda) - -2\\cdot 0')[0]).toMatch(/double sign/);
    expect(findUglyTex('1x^{2} + 3')[0]).toMatch(/coefficient 1/);
    expect(findUglyTex('2x + 1\\lambda')[0]).toMatch(/coefficient 1/);
    expect(findUglyTex('0x^{2} + x')[0]).toMatch(/coefficient 0/);
    expect(findUglyTex('x^{2} + 0')[0]).toMatch(/zero term/);
    expect(findUglyTex('x^1 + y^{1}')).toHaveLength(2);
    expect(findUglyTex('3 \\cdot 1')[0]).toMatch(/times one/);
    expect(findUglyTex('\\frac{x}{1}')[0]).toMatch(/over one/);
  });
  it('leaves clean maths alone', () => {
    for (const ok of [
      'x - (-3)',
      '\\left(-2\\right)',
      '10x + 21y',
      'x_1 + x_{10}',
      '\\frac{1}{x}',
      'x^{1/2}',
      'x^{-1}',
      '(1, 1)',
      '1 + x',
      '1\\,\\mathrm{m}',
      '0.5x',
      '{1}x',
      'e^{-x} - 1',
      '\\lambda = \\pm 1',
      '\\begin{bmatrix} 1 & -2 \\\\ -3 & 4 \\end{bmatrix}',
      '3 \\times 10^{8}',
      '\\lim_{x \\to 0^+} f',
      '1 \\le x',
    ]) {
      expect(findUglyTex(ok), ok).toEqual([]);
    }
  });
  it('non-strict mode checks double signs only (authored text)', () => {
    expect(findUglyTex('(4-\\lambda)(3-\\lambda) - 2\\cdot 1', { strict: false })).toEqual([]);
    expect(findUglyTex('x - -1', { strict: false })).toHaveLength(1);
  });
});
