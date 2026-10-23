import { describe, expect, it } from 'vitest';
import { anchorOccurrences, noteCarriers, pairAnchors } from './anchors';
import { DERIVATIONS, FORMULAS } from '../gallery/samples';

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
