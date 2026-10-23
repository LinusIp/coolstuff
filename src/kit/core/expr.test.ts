import { describe, expect, it } from 'vitest';
import {
  ExprError,
  equivalent,
  evalNumber,
  evaluateExpr,
  exprFunctions,
  exprToTex,
  exprVars,
  factorial,
  gamma,
  parseExpr,
  tryParseExpr,
} from './expr';
import { texToHtml } from '../notation';

const ev = (src: string, scope: Record<string, number> = {}, vars = Object.keys(scope)) => evaluateExpr(parseExpr(src, { vars }), scope);

describe('parsing and evaluation', () => {
  it('numbers, constants and precedence', () => {
    expect(ev('1+2*3')).toBe(7);
    expect(ev('(1+2)*3')).toBe(9);
    expect(ev('2^3^2')).toBe(512); // right-associative
    expect(ev('-2^2')).toBe(-4); // unary minus binds looser than ^
    expect(ev('2^-1')).toBe(0.5);
    expect(ev('.5 + 1e-3')).toBeCloseTo(0.501, 12);
    expect(ev('3.0e8')).toBe(3e8);
    expect(ev('pi')).toBe(Math.PI);
    expect(ev('e')).toBe(Math.E);
    expect(ev('1/2/4')).toBe(0.125); // left-associative
    expect(ev('10-3-2')).toBe(5);
    expect(ev('--3')).toBe(3);
    expect(ev('+3')).toBe(3);
  });

  it('implicit multiplication', () => {
    expect(ev('2x', { x: 3 })).toBe(6);
    expect(ev('2(x+1)', { x: 3 })).toBe(8);
    expect(ev('(x+1)(x-1)', { x: 3 })).toBe(8);
    expect(ev('x(x+1)', { x: 3 })).toBe(12);
    expect(ev('xy', { x: 3, y: 4 })).toBe(12);
    expect(ev('x y', { x: 3, y: 4 })).toBe(12);
    expect(ev('2pi')).toBeCloseTo(2 * Math.PI, 12);
    expect(ev('1/2x', { x: 4 })).toBe(2); // (1/2)·x, same precedence, left to right
    expect(ev('x^2y', { x: 3, y: 2 })).toBe(18); // (x²)·y
    expect(ev('-2x', { x: 3 })).toBe(-6);
    expect(ev('x2', { x: 3 })).toBe(6);
  });

  it('functions with and without brackets', () => {
    const x = 0.7;
    expect(ev('sin(x)', { x })).toBeCloseTo(Math.sin(x), 14);
    expect(ev('sin x', { x })).toBeCloseTo(Math.sin(x), 14);
    expect(ev('sinx', { x })).toBeCloseTo(Math.sin(x), 14);
    expect(ev('sin 2x', { x })).toBeCloseTo(Math.sin(2 * x), 14);
    expect(ev('sin x cos x', { x })).toBeCloseTo(Math.sin(x) * Math.cos(x), 14);
    expect(ev('sin x^2', { x })).toBeCloseTo(Math.sin(x * x), 14);
    expect(ev('sin^2 x + cos^2 x', { x })).toBeCloseTo(1, 14);
    expect(ev('sin(x)^2', { x })).toBeCloseTo(Math.sin(x) ** 2, 14);
    expect(ev('2 sin x', { x })).toBeCloseTo(2 * Math.sin(x), 14);
    expect(ev('x sin x', { x })).toBeCloseTo(x * Math.sin(x), 14);
    expect(ev('exp(x)', { x })).toBeCloseTo(Math.exp(x), 14);
    expect(ev('expx', { x })).toBeCloseTo(Math.exp(x), 14);
    expect(ev('e^x', { x })).toBeCloseTo(Math.exp(x), 14);
    expect(ev('ln(e^2)')).toBeCloseTo(2, 14);
    expect(ev('log(e)')).toBeCloseTo(1, 14); // natural log, per NOTATION.md
    expect(ev('log10(1000)')).toBeCloseTo(3, 12);
    expect(ev('log2(8)')).toBeCloseTo(3, 12);
    expect(ev('log_2(8)')).toBeCloseTo(3, 12);
    expect(ev('log_3 81')).toBeCloseTo(4, 12);
    expect(ev('sqrt(16)')).toBe(4);
    expect(ev('√16')).toBe(4);
    expect(ev('cbrt(-8)')).toBe(-2);
    expect(ev('(-8)^(1/3)')).toBeCloseTo(-2, 12);
    expect(ev('arctan(1)')).toBeCloseTo(Math.PI / 4, 14);
    expect(ev('sec(0) + csc(pi/2) + cot(pi/4)')).toBeCloseTo(3, 12);
    expect(ev('max(1, 5, 3) - min(2, -1)')).toBe(6);
    expect(ev('floor(2.7) + ceil(2.1) + sign(-3)')).toBe(4);
  });

  it('absolute value bars and factorials', () => {
    expect(ev('|x|', { x: -3 })).toBe(3);
    expect(ev('2|x|', { x: -3 })).toBe(6);
    expect(ev('|x||y|', { x: -3, y: 2 })).toBe(6);
    expect(ev('|x - |y||', { x: 1, y: -4 })).toBe(3);
    expect(ev('|2x - 1|', { x: 0 })).toBe(1);
    expect(ev('5!')).toBe(120);
    expect(ev('n!', { n: 6 })).toBe(720);
    expect(ev('(n+1)!/n!', { n: 4 })).toBeCloseTo(5, 12);
    expect(ev('binom(5, 2)')).toBe(10);
    expect(factorial(0)).toBe(1);
    expect(gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 12);
    expect(gamma(5)).toBeCloseTo(24, 10);
  });

  it('typography: Unicode operators, superscripts, Greek', () => {
    expect(ev('3 × 4 − 2 ÷ 2')).toBe(11);
    expect(ev('x² + x³', { x: 2 })).toBe(12);
    expect(ev('x⁻¹', { x: 4 })).toBe(0.25);
    expect(ev('2·π')).toBeCloseTo(2 * Math.PI, 12);
    expect(ev('θ^2', { theta: 3 })).toBe(9);
    expect(ev('omega t', { omega: 2, t: 5 })).toBe(10);
    expect(ev('v_0 t', { v_0: 3, t: 2 })).toBe(6);
    expect(ev('v_{0}t', { v_0: 3, t: 2 })).toBe(6);
    expect(ev('x**2', { x: 5 })).toBe(25);
    expect(ev('[x+1]{2}', { x: 1 })).toBe(4);
  });

  it('domain errors give NaN or Infinity, never throw', () => {
    expect(ev('sqrt(-1)')).toBeNaN();
    expect(ev('ln(0)')).toBe(-Infinity);
    expect(ev('1/0')).toBe(Infinity);
    expect(ev('asin(2)')).toBeNaN();
    expect(ev('(-1)!')).toBeNaN();
  });

  it('errors explain themselves', () => {
    const err = (src: string, vars: string[] = []) => {
      const r = tryParseExpr(src, { vars });
      if (r.ok) throw new Error(`expected "${src}" to fail`);
      return r.error;
    };
    expect(err('').code).toBe('empty');
    expect(err('2 + ').code).toBe('syntax');
    expect(err('(x + 1', ['x']).code).toBe('unbalanced');
    expect(err('x + 1)', ['x']).code).toBe('unbalanced');
    expect(err('|x', ['x']).code).toBe('unbalanced');
    expect(err('2 3').message).toMatch(/operator between/);
    expect(err('q + 1', ['x']).code).toBe('unknown-symbol');
    expect(err('q + 1', ['x']).message).toMatch(/variables: x/);
    expect(err('x_1', ['x']).code).toBe('unknown-symbol');
    expect(err('sin', ['x']).message).toMatch(/needs an argument/);
    expect(err('binom(5)').code).toBe('arity');
    expect(err('()').code).toBe('syntax');
    expect(err('2 $ 3').code).toBe('syntax');
    expect(() => parseExpr('y', { vars: ['x'] })).toThrow(ExprError);
  });

  it('collects variables and functions', () => {
    const e = parseExpr('sin(x) + |y| + n!', { vars: ['x', 'y', 'n'] });
    expect([...exprVars(e)].sort()).toEqual(['n', 'x', 'y']);
    expect([...exprFunctions(e)].sort()).toEqual(['!', 'abs', 'sin']);
  });
});

describe('TeX preview', () => {
  const tex = (src: string, vars: string[] = ['x', 'y', 'theta', 'v_0', 't']) => exprToTex(parseExpr(src, { vars }));

  it('shows how the input was read', () => {
    expect(tex('1/2x')).toBe('\\frac{1}{2}\\,x');
    expect(tex('1/(2x)')).toBe('\\frac{1}{2\\,x}');
    expect(tex('2x^2')).toBe('2\\,{x}^{2}');
    expect(tex('-x^2')).toBe('-{x}^{2}');
    expect(tex('(x+1)^2')).toBe('{\\left(x + 1\\right)}^{2}');
    expect(tex('sqrt(x)')).toBe('\\sqrt{x}');
    expect(tex('sin^2 x')).toBe('{\\left(\\sin\\left(x\\right)\\right)}^{2}');
    expect(tex('x - (y - 1)')).toBe('x - \\left(y - 1\\right)');
    expect(tex('theta v_0 t')).toBe('\\theta\\,v_{0}\\,t');
    expect(tex('2*3')).toBe('2 \\cdot 3');
    expect(tex('|x|')).toBe('\\left|x\\right|');
    expect(tex('3.0e8')).toBe('3.0\\times 10^{8}');
  });

  it('every preview is valid KaTeX', () => {
    for (const s of ['1/2x', 'sin x cos x', 'log_2(x)', 'binom(x, 2)', 'e^(-x^2/2)/sqrt(2pi)', '(x+1)!', '|x - |y||', 'floor(x)', 'max(x, y)', 'cbrt(x)', 'x⁻¹', 'sign(x)']) {
      const html = texToHtml(tex(s));
      expect(html, s).not.toMatch(/katex-error/);
    }
  });
});

describe('equivalence by random evaluation', () => {
  const eq = (a: string, b: string, opts: Partial<Parameters<typeof equivalent>[2]> = {}) =>
    equivalent(a, b, { vars: ['x'], ...opts }).equivalent;

  it('accepts equivalent forms', () => {
    expect(eq('2x+2', '2(x+1)')).toBe(true);
    expect(eq('(x+1)^2', 'x^2 + 2x + 1')).toBe(true);
    expect(eq('1', 'sin^2 x + cos^2 x')).toBe(true);
    expect(eq('2x cos(x^2)', 'cos(x^2)*2*x')).toBe(true);
    expect(eq('x/2', '1/2x')).toBe(true);
    expect(eq('e^(2x)', '(e^x)^2')).toBe(true);
    expect(eq('1/(1+x^2)', '(1+x^2)^-1')).toBe(true);
  });

  it('rejects different expressions, with a witness point', () => {
    const r = equivalent('2x', 'x^2', { vars: ['x'] });
    expect(r.equivalent).toBe(false);
    if (r.equivalent) return;
    expect(r.reason).toBe('different');
    expect(r.at?.x).toBeDefined();
    expect(eq('sqrt(x^2)', 'x')).toBe(false); // |x| ≠ x on [−3, 3]
    expect(eq('x^2+1', 'x^2+1.001')).toBe(false);
  });

  it('respects the domain', () => {
    // ln(x²) = 2 ln x only for x > 0.
    expect(eq('ln(x^2)', '2ln(x)')).toBe(false);
    expect(eq('ln(x^2)', '2ln(x)', { domain: { lo: 0.1, hi: 5 } })).toBe(true);
    const r = equivalent('ln(x^2)', '2ln(x)', { vars: ['x'] });
    expect(!r.equivalent && r.reason).toBe('undefined-here');
    // Points where the expected answer is undefined are skipped, not failed.
    expect(eq('sqrt(x)', 'x^(1/2)')).toBe(true);
    expect(eq('1/x', 'x^-1')).toBe(true);
  });

  it('integer domains and several variables', () => {
    expect(equivalent('n(n+1)/2', '(n^2+n)/2', { vars: ['n'], domain: { lo: 0, hi: 30, integer: true } }).equivalent).toBe(true);
    expect(equivalent('binom(n, 2)', 'n(n-1)/2', { vars: ['n'], domain: { lo: 2, hi: 20, integer: true } }).equivalent).toBe(true);
    expect(equivalent('x y + y', 'y(x+1)', { vars: ['x', 'y'] }).equivalent).toBe(true);
    expect(
      equivalent('v_0 t + g t^2/2', 't(v_0 + g t/2)', { vars: ['v_0', 't', 'g'], domain: { t: { lo: 0, hi: 5 }, v_0: { lo: -10, hi: 10 }, g: { lo: 9, hi: 10 } } }).equivalent,
    ).toBe(true);
  });

  it('up to a constant, for antiderivatives', () => {
    expect(eq('x^2/2', 'x^2/2 + 7', { upToConstant: true })).toBe(true);
    expect(eq('-cos(x)', '1 - cos(x)', { upToConstant: true })).toBe(true);
    expect(eq('sin(x)^2/2', '-cos(x)^2/2', { upToConstant: true })).toBe(true);
    expect(eq('x^2/2', 'x^2', { upToConstant: true })).toBe(false);
    expect(eq('x^2/2', 'x^2/2 + 7')).toBe(false);
  });

  it('reports parse errors and impossible domains', () => {
    const r = equivalent('x', 'x +', { vars: ['x'] });
    expect(!r.equivalent && r.reason).toBe('parse');
    const none = equivalent('sqrt(x)', 'sqrt(x)', { vars: ['x'], domain: { lo: -5, hi: -1 } });
    expect(!none.equivalent && none.reason).toBe('no-points');
  });

  it('is deterministic', () => {
    const a = equivalent('x^3', 'x^3 + 1e-3 sin(40x)', { vars: ['x'] });
    const b = equivalent('x^3', 'x^3 + 1e-3 sin(40x)', { vars: ['x'] });
    expect(a).toEqual(b);
  });
});

describe('numbers typed as expressions', () => {
  it('evaluates constant expressions', () => {
    const v = (s: string) => {
      const r = evalNumber(s);
      return r.ok ? r.value : NaN;
    };
    expect(v('1/3')).toBeCloseTo(1 / 3, 14);
    expect(v('sqrt(2)/2')).toBeCloseTo(Math.SQRT1_2, 14);
    expect(v('2pi')).toBeCloseTo(2 * Math.PI, 14);
    expect(v('−4.5')).toBe(-4.5);
    expect(v('12,500')).toBe(12500);
    expect(evalNumber('x').ok).toBe(false);
  });
});
