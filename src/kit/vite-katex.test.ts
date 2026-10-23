import { describe, expect, it } from 'vitest';
import { katexPrerender, prerenderTex } from './vite-katex';

describe('build-time KaTeX prerender', () => {
  it('renders inline and display maths with notation macros', () => {
    const out = prerenderTex('<p>Let <span class="tex">\\vec v = 2\\ihat</span>.</p><div class="tex-block">A\\vec v = \\lambda \\vec v</div>');
    expect(out).toContain('<span class="tex math-inline" data-katex><span class="katex">');
    expect(out).toContain('<div class="tex-block math-display" data-katex><span class="katex-display">');
    expect(out).toContain('<math'); // MathML for screen readers
    expect(out).toContain('mathbf'); // \vec → bold, per NOTATION.md
    expect(out).not.toContain('katex-error');
  });

  it('decodes entities, keeps other attributes, and only touches tex classes', () => {
    const out = prerenderTex('<span id="a" class="big tex" title="t">a &lt; b &amp;&amp; c</span><span class="texture">x</span><span class="my-tex">y</span>');
    expect(out).toContain('id="a" class="big tex math-inline" title="t" data-katex');
    expect(out).toContain('<span class="texture">x</span>');
    expect(out).toContain('<span class="my-tex">y</span>');
    expect(out).toContain('&lt;'); // KaTeX escapes it again in its output
  });

  it('is idempotent and leaves html without maths alone', () => {
    const once = prerenderTex('<span class="tex">x^2</span>');
    expect(prerenderTex(once)).toBe(once);
    const plain = '<p>No maths here.</p>';
    expect(prerenderTex(plain)).toBe(plain);
  });

  it('throws with the file name in builds, renders red in dev', () => {
    expect(() => prerenderTex('<span class="tex">\\frac{1}{</span>', { throwOnError: true, filename: 'x.html' })).toThrow(/KaTeX error in x.html/);
    expect(prerenderTex('<span class="tex">\\frac{1}{</span>')).toContain('katex-error');
  });

  it('accepts page-wide macros', () => {
    expect(prerenderTex('<span class="tex">\\cFoo</span>', { macros: { '\\cFoo': '\\colorTerm{input}{x}' } })).toContain('ct-input');
  });

  it('is a pre-order transformIndexHtml plugin', () => {
    const p = katexPrerender();
    expect(p.name).toBe('coolstuff:katex-prerender');
    const t = p.transformIndexHtml as { order: string; handler: (h: string, c: { filename: string }) => string };
    expect(t.order).toBe('pre');
    expect(t.handler('<span class="tex">x</span>', { filename: 'a.html' })).toContain('data-katex');
  });
});
