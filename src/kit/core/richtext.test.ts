import { describe, expect, it } from 'vitest';
import { parseInline, parseRich, richTex, richToHtml, richToPlain, texToPlain } from './richtext';

describe('RichText parsing', () => {
  it('inline maths, emphasis, code, links, terms and glossary', () => {
    expect(parseInline('Let $x = 2$ and **bold** and *it* and `arr[i]`.')).toEqual([
      { t: 'text', v: 'Let ' },
      { t: 'math', tex: 'x = 2' },
      { t: 'text', v: ' and ' },
      { t: 'strong', c: [{ t: 'text', v: 'bold' }] },
      { t: 'text', v: ' and ' },
      { t: 'em', c: [{ t: 'text', v: 'it' }] },
      { t: 'text', v: ' and ' },
      { t: 'code', v: 'arr[i]' },
      { t: 'text', v: '.' },
    ]);
    expect(parseInline('[the input]{input} and [[eigenvalue|eigenvalues]] and [docs](../x/)')).toEqual([
      { t: 'term', concept: 'input', c: [{ t: 'text', v: 'the input' }] },
      { t: 'text', v: ' and ' },
      { t: 'gloss', term: 'eigenvalue', c: [{ t: 'text', v: 'eigenvalues' }] },
      { t: 'text', v: ' and ' },
      { t: 'link', href: '../x/', c: [{ t: 'text', v: 'docs' }] },
    ]);
  });

  it('leaves look-alikes alone', () => {
    expect(parseInline('an interval [0, 1] stays')).toEqual([{ t: 'text', v: 'an interval [0, 1] stays' }]);
    expect(parseInline('2 * 3 * 4')).toEqual([{ t: 'text', v: '2 * 3 * 4' }]);
    expect(parseInline('costs \\$5 and \\$6')).toEqual([{ t: 'text', v: 'costs $5 and $6' }]);
    expect(parseInline('[x]{Not A Concept}')).toEqual([{ t: 'text', v: '[x]{Not A Concept}' }]);
    // Markdown characters inside maths and code are untouched.
    expect(parseInline('$a*b*c$ `**x**`')).toEqual([
      { t: 'math', tex: 'a*b*c' },
      { t: 'text', v: ' ' },
      { t: 'code', v: '**x**' },
    ]);
  });

  it('nests: a term containing maths, bold containing a term', () => {
    expect(parseInline('[$\\lambda$, the scale]{eigenvalue}')).toEqual([
      { t: 'term', concept: 'eigenvalue', c: [{ t: 'math', tex: '\\lambda' }, { t: 'text', v: ', the scale' }] },
    ]);
    expect(parseInline('**[A]{matrix}**')).toEqual([{ t: 'strong', c: [{ t: 'term', concept: 'matrix', c: [{ t: 'text', v: 'A' }] }] }]);
  });

  it('blocks: paragraphs, display maths, lists', () => {
    const b = parseRich('First line\ncontinues.\n\n$$A\\vec v = \\lambda \\vec v$$\n\n- one\n- two $x$\n\n1. a\n2. b\n\nText $$x^2$$ more.');
    expect(b.map((x) => x.t)).toEqual(['p', 'math', 'ul', 'ol', 'p', 'math', 'p']);
    expect(b[0]).toEqual({ t: 'p', c: [{ t: 'text', v: 'First line continues.' }] });
    expect(b[1]).toEqual({ t: 'math', tex: 'A\\vec v = \\lambda \\vec v' });
  });
});

describe('RichText rendering', () => {
  it('renders KaTeX, concept classes and escapes HTML', () => {
    const html = richToHtml('If $x<2$ then <b>no</b> [v]{input}.');
    expect(html.startsWith('<p>')).toBe(true);
    expect(html).toContain('class="math-inline"');
    expect(html).toContain('class="katex"');
    expect(html).toContain('&lt;b&gt;no&lt;/b&gt;');
    expect(html).toContain('<span class="term ct ct-input" data-concept="input">v</span>');
    expect(html).not.toContain('katex-error');
  });

  it('uses notation macros and lesson macros', () => {
    const html = richToHtml('$\\cMatrix\\vec v$', { inline: true, macros: { '\\cMatrix': '\\colorTerm{matrix}{A}' } });
    expect(html).toContain('ct-matrix');
    expect(html).not.toContain('katex-error');
    expect(html.startsWith('<span class="math-inline">')).toBe(true);
  });

  it('display maths gets its own scrolling box', () => {
    expect(richToHtml('$$x^2$$')).toMatch(/^<div class="math-display"><span class="katex-display">/);
  });

  it('typography: minus signs, quotes, apostrophes', () => {
    expect(richToHtml('a -3 and "quoted" don\'t', { inline: true })).toBe('a −3 and “quoted” don’t');
  });

  it('memoises', () => {
    expect(richToHtml('**x**')).toBe(richToHtml('**x**'));
  });
});

describe('plain text', () => {
  it('reads maths roughly and drops markup', () => {
    expect(texToPlain('\\frac{1}{2}\\lambda^2')).toBe('(1)/(2)λ^2');
    expect(richToPlain('**Find** $\\sqrt{x}$ for [v]{input}.')).toBe('Find √(x) for v.');
    expect(richTex('a $x$ b $$y$$ c')).toEqual(['x', 'y']);
  });
});
