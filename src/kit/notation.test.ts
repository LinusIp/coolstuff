/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { TEX_MACROS, formatNumber, formatVector, mathChainHtml, splitRelations, texOptions, texToHtml } from './notation';

/** One use of every macro, as NOTATION.md shows it. */
const SAMPLES: Record<string, string> = {
  '\\colorTerm': '\\colorTerm{input}{x}',
  '\\ct': '\\ct{output}{y}',
  '\\anchor': '\\anchor{lam}{\\lambda}',
  '\\chg': '\\chg{A - \\lambda I}',
  '\\vec': '\\vec{v}',
  '\\bm': '\\bm{\\theta}',
  '\\uvec': '\\uvec{u}',
  '\\ihat': '\\ihat',
  '\\jhat': '\\jhat',
  '\\khat': '\\khat',
  '\\zerovec': '\\zerovec',
  '\\T': 'A^\\T',
  '\\inv': 'A\\inv',
  '\\norm': '\\norm{\\vec x}',
  '\\abs': '\\abs{x}',
  '\\inner': '\\inner{\\vec u}{\\vec v}',
  '\\rank': '\\rank A',
  '\\tr': '\\tr A',
  '\\diag': '\\diag(1, 2)',
  '\\spn': '\\spn\\{\\vec v\\}',
  '\\nullsp': '\\nullsp A',
  '\\colsp': '\\colsp A',
  '\\proj': '\\proj_{\\vec u} \\vec v',
  '\\R': '\\R^n',
  '\\N': '\\N',
  '\\Z': '\\Z',
  '\\Q': '\\Q',
  '\\C': '\\C',
  '\\d': '\\int f(x)\\,\\d x',
  '\\dv': '\\dv{y}{x}',
  '\\pdv': '\\pdv{f}{x}',
  '\\grad': '\\grad f',
  '\\divg': '\\divg \\vec F',
  '\\curl': '\\curl \\vec F',
  '\\eval': '\\eval{f(x)}_{x=0}',
  '\\E': '\\E[X]',
  '\\Var': '\\Var(X)',
  '\\Cov': '\\Cov(X, Y)',
  '\\Prob': '\\Prob(A)',
  '\\given': '\\Prob\\left(A \\given B\\right)',
  '\\Normal': 'X \\sim \\Normal(\\mu, \\sigma^2)',
  '\\KL': '\\KL(p \\,\\|\\, q)',
  '\\iid': 'X_i \\iid p',
  '\\argmin': '\\argmin_\\theta \\loss',
  '\\argmax': '\\argmax_x f(x)',
  '\\softmax': '\\softmax(\\vec z)',
  '\\loss': '\\loss(\\theta)',
  '\\bigO': '\\bigO(n \\log n)',
  '\\defeq': 'f(x) \\defeq x^2',
  '\\unit': 'g = \\unit{9.8}{m/s^2}',
};

const strict = (tex: string, display = false) => katex.renderToString(tex, { ...texOptions(display), throwOnError: true });

describe('notation macros', () => {
  it('has a sample for every macro', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(Object.keys(TEX_MACROS).sort());
  });
  for (const [macro, sample] of Object.entries(SAMPLES)) {
    it(`${macro} renders without error`, () => {
      expect(() => strict(sample)).not.toThrow();
    });
  }
  it('\\vec is bold upright, not an arrow', () => {
    const html = strict('\\vec{v}');
    expect(html).toContain('mathbf');
    expect(html).not.toContain('accent');
  });
  it('\\colorTerm produces concept classes, never inline colour', () => {
    const html = strict('\\colorTerm{matrix}{A}');
    expect(html).toContain('class="enclosing ct ct-matrix"');
    expect(html).not.toMatch(/style="[^"]*color/);
  });
  it('lesson macros merge with the notation macros', () => {
    const html = katex.renderToString('\\cMatrix', { ...texOptions(false, { macros: { '\\cMatrix': '\\colorTerm{matrix}{A}' } }), throwOnError: true });
    expect(html).toContain('ct-matrix');
  });
  it('texToHtml includes MathML for screen readers', () => {
    expect(texToHtml('x^2')).toContain('<math');
  });
  it('every macro is documented in NOTATION.md', () => {
    const doc = readFileSync(join(import.meta.dirname, 'NOTATION.md'), 'utf8');
    for (const m of Object.keys(TEX_MACROS)) {
      const used = new RegExp('`[^`]*' + m.replace(/\\/g, '\\\\') + '(?![a-zA-Z])[^`]*`');
      expect(used.test(doc), m).toBe(true);
    }
  });
});

describe('splitRelations', () => {
  it('chains equalities: lhs, then each relation with its right-hand side', () => {
    expect(splitRelations('\\det(B - \\lambda I) = (4-\\lambda)(3-\\lambda) - 2 = \\lambda^2 - 7\\lambda + 10')).toEqual([
      { lhs: '\\det(B - \\lambda I)', segs: ['= (4-\\lambda)(3-\\lambda) - 2', '= \\lambda^2 - 7\\lambda + 10'] },
    ]);
  });
  it('starts a new clause at an implication and splits list items, never leaving a lone "= 0"', () => {
    expect(splitRelations('(\\lambda-5)(\\lambda-2) = 0 \\implies \\lambda_1 = 5,\\ \\lambda_2 = 2')).toEqual([
      { lhs: '(\\lambda-5)(\\lambda-2)', segs: ['= 0'] },
      { lhs: '\\implies \\lambda_1', segs: ['= 5,'] },
      { lhs: '\\lambda_2', segs: ['= 2'], joined: true },
    ]);
  });
  it('keeps a tiny right-hand side with the segment before it', () => {
    expect(splitRelations('\\lambda^2 - 7\\lambda + 10 = (\\lambda-5)(\\lambda-2) = 0')).toEqual([
      { lhs: '\\lambda^2 - 7\\lambda + 10', segs: ['= (\\lambda-5)(\\lambda-2) = 0'] },
    ]);
    expect(splitRelations('x = 0')).toEqual([{ lhs: 'x', segs: ['= 0'] }]);
  });
  it('never splits inside braces, brackets, \\left…\\right or environments', () => {
    expect(splitRelations('{a = b} = c')).toEqual([{ lhs: '{a = b}', segs: ['= c'] }]);
    expect(splitRelations('f(x = 1) = 2')).toEqual([{ lhs: 'f(x = 1)', segs: ['= 2'] }]);
    expect(splitRelations('\\left( x = 1 \\right) = 2')).toEqual([{ lhs: '\\left( x = 1 \\right)', segs: ['= 2'] }]);
    expect(splitRelations('\\begin{cases} x = 1 \\end{cases} = 2')).toEqual([{ lhs: '\\begin{cases} x = 1 \\end{cases}', segs: ['= 2'] }]);
    expect(splitRelations('\\text{so } x = 1')).toEqual([{ lhs: '\\text{so } x', segs: ['= 1'] }]);
  });
  it('handles inequalities and \\quad-separated alternatives', () => {
    expect(splitRelations('a < b + c \\le d + e')).toEqual([{ lhs: 'a', segs: ['< b + c', '\\le d + e'] }]);
    expect(splitRelations('0 < x \\le 1')).toEqual([{ lhs: '0', segs: ['< x \\le 1'] }]);
    expect(splitRelations('x = 1 \\quad\\text{or}\\quad x = 2')).toEqual([
      { lhs: 'x', segs: ['= 1'] },
      { lhs: '\\text{or}\\quad x', segs: ['= 2'], joined: true },
    ]);
  });
  it('keeps a formula with no relation whole', () => {
    expect(splitRelations('\\lambda^2 - 7\\lambda + 10')).toEqual([{ lhs: '\\lambda^2 - 7\\lambda + 10', segs: [] }]);
  });
  it('a chain re-joins to the original maths (nothing lost)', () => {
    const tex = 'a = b + c \\implies d \\le e,\\ f = g';
    const squash = (s: string) => s.replace(/\\ |\s/g, '');
    const back = splitRelations(tex)
      .map((c) => [c.lhs, ...c.segs].join(''))
      .join('');
    expect(squash(back)).toBe(squash(tex));
  });
});

describe('mathChainHtml', () => {
  const html = mathChainHtml('\\det(B - \\lambda I) = \\lambda^2 - 7\\lambda + 10 = (\\lambda - 5)(\\lambda - 2)');
  it('renders one segment per relation, each with display-size maths', () => {
    expect(html.match(/class="mchain__seg"/g)?.length).toBe(2);
    expect(html.match(/class="mchain__lhs"/g)?.length).toBe(1);
  });
  it('gives screen readers one MathML copy and hides the visual pieces', () => {
    expect(html.match(/<math/g)?.length).toBe(1);
    expect(html).toContain('class="mchain__visual" aria-hidden="true"');
  });
  it('keeps list items together in one group', () => {
    const h = mathChainHtml('(\\lambda-5)(\\lambda-2) = 0 \\implies \\lambda_1 = 5,\\ \\lambda_2 = 2');
    expect(h.match(/class="mchain__group"/g)?.length).toBe(1);
    expect(h.match(/class="mchain__clause"/g)?.length).toBe(3);
  });
  it('renders colour terms inside segments', () => {
    expect(mathChainHtml('\\colorTerm{output}{A\\vec v} = \\colorTerm{eigenvalue}{\\lambda}\\vec v')).toContain('ct-eigenvalue');
  });
});

describe('formatNumber', () => {
  it('uses a true minus sign and fixed decimals', () => {
    expect(formatNumber(-1.234)).toBe('−1.23');
    expect(formatNumber(3)).toBe('3.00');
    expect(formatNumber(22.84, 1)).toBe('22.8');
  });
  it('never prints negative zero', () => {
    expect(formatNumber(-0.001)).toBe('0.00');
    expect(formatNumber(-0)).toBe('0.00');
    expect(formatNumber(-0.4, 0)).toBe('0');
  });
  it('handles non-finite values', () => {
    expect(formatNumber(Infinity)).toBe('∞');
    expect(formatNumber(-Infinity)).toBe('−∞');
    expect(formatNumber(NaN)).toBe('—');
  });
  it('formats vectors as tuples', () => {
    expect(formatVector([1.4, -0.2])).toBe('(1.40, −0.20)');
  });
});
