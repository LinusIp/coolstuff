import { describe, expect, it } from 'vitest';
import { anchorOccurrences, anchorSpans, conceptInTex, firstSpans, noteCarriers, pairAnchors, stripAnchors } from './anchors';
import { DEMO_MACROS, DERIVATIONS, FORMULAS } from '../gallery/samples';

describe('repeated anchors', () => {
  it('lists every occurrence in reading order; the first of each id carries the note', () => {
    const occ = anchorOccurrences(FORMULAS[0].tex);
    expect(occ).toEqual(['Av', 'A', 'v', 'lam', 'v']);
    expect(noteCarriers(occ)).toEqual([true, true, true, true, false]);
  });

  it('pairs occurrences of the same id in order between derivation steps; extras fade', () => {
    const [s1, s2] = DERIVATIONS[0].steps.map((s) => anchorOccurrences(s.tex));
    expect(s1).toEqual(['A', 'lam']);
    expect(pairAnchors(s1, s2)).toEqual({ pairs: [[0, 0], [1, 1]], leaving: [], entering: [] });
    // x appears twice before and once after: the first pairs, the second fades out; y is new.
    expect(pairAnchors(['x', 'a', 'x'], ['a', 'x', 'y'])).toEqual({ pairs: [[1, 0], [0, 1]], leaving: [2], entering: [2] });
    // Three occurrences after, one before: the 2nd and 3rd fade in.
    expect(pairAnchors(['v'], ['v', 'v', 'v'])).toEqual({ pairs: [[0, 0]], leaving: [], entering: [1, 2] });
    expect(pairAnchors([], ['q'])).toEqual({ pairs: [], leaving: [], entering: [0] });
  });
});

describe('anchor contents (G1)', () => {
  it('brace-matches each anchor, nested ones included, in reading order', () => {
    const spans = anchorSpans(FORMULAS[0].tex);
    expect(spans.map((s) => [s.id, s.depth])).toEqual([
      ['Av', 0],
      ['A', 1],
      ['v', 1],
      ['lam', 0],
      ['v', 0],
    ]);
    expect(spans[0].content).toBe('\\anchor{A}{\\cMatrix}\\anchor{v}{\\cInput}');
    expect(spans[1].content).toBe('\\cMatrix');
    expect(spans.map((s) => s.id)).toEqual(anchorOccurrences(FORMULAS[0].tex));
    expect(firstSpans(FORMULAS[0].tex).map((s) => s.id)).toEqual(['Av', 'A', 'v', 'lam']);
    // Escaped braces and groups inside the content.
    expect(anchorSpans('\\anchor{s}{\\{x : x^{2} > 0\\}} + 1')[0].content).toBe('\\{x : x^{2} > 0\\}');
    expect(anchorSpans('\\anchor{bad}{x')).toEqual([]);
  });

  it('finds the concept a snippet colours first', () => {
    expect(conceptInTex('\\colorTerm{rate}{m}')).toBe('rate');
    expect(conceptInTex('2\\ct{output}{y}')).toBe('output');
    expect(conceptInTex('\\cMatrix\\cInput', DEMO_MACROS)).toBe('matrix');
    expect(conceptInTex('\\cEigenValue')).toBe('eigen-value');
    expect(conceptInTex('\\cos x + \\cdot')).toBeNull();
    expect(conceptInTex('\\cUnknown', DEMO_MACROS)).toBeNull();
  });

  it('strips anchor wrappers but keeps their contents', () => {
    expect(stripAnchors(FORMULAS[0].tex)).toBe('{{\\cMatrix}{\\cInput}} = {\\cEigenvalue}{\\cInput}');
  });
});
