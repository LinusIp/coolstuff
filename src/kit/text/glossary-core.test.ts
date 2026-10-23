import { describe, expect, it } from 'vitest';
import { createGlossaryRegistry, lessonLink, lessonOfPath, normalizeTerm, placePopover, rootFromManifest, termCandidates } from './glossary-core';

describe('glossary registry', () => {
  it('matches terms case-insensitively and by simple singular forms', () => {
    const g = createGlossaryRegistry();
    g.add([
      { term: 'Eigenvalue', definition: 'The stretch factor.' },
      { term: 'basis', definition: 'Independent and spanning.' },
      { term: 'probability', definition: 'A measure.' },
    ]);
    expect(g.get('eigenvalue')?.definition).toBe('The stretch factor.');
    expect(g.get('  EIGENVALUES ')?.term).toBe('Eigenvalue');
    expect(g.get('probabilities')?.term).toBe('probability');
    expect(g.get('bases')?.term).toBeUndefined(); // "bases" → "bas" / "base": not "basis"
    expect(g.get('unknown')).toBeUndefined();
    expect(normalizeTerm('Gauss’s  law')).toBe("gauss's law");
    expect(termCandidates('classes')).toEqual(['classes', 'class', 'classe']);
  });

  it('a site-index (plain) entry never replaces a lesson definition', () => {
    const g = createGlossaryRegistry();
    g.add([{ term: 'gradient', definition: '$\\grad f$ points uphill.', lesson: 'calc3/gradient' }]);
    const v = g.version;
    g.add([{ term: 'gradient', definition: 'plain', plain: true }]);
    expect(g.get('gradient')?.definition).toBe('$\\grad f$ points uphill.');
    expect(g.version).toBe(v + 1);
    g.add([{ term: 'divergence', definition: 'plain', plain: true }]);
    expect(g.get('divergence')?.plain).toBe(true);
  });
});

describe('popover placement', () => {
  const vp = { width: 390, height: 844 };
  const overlaps = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  it('sits below its term, centred, clamped on screen; above when there is no room below', () => {
    const term = { left: 300, right: 380, top: 400, bottom: 424 };
    const p = placePopover(term, { width: 320, height: 120 }, vp);
    expect(p.side).toBe('below');
    expect(p.top).toBe(432);
    expect(p.left).toBe(390 - 8 - 320);
    const low = { left: 20, right: 90, top: 780, bottom: 804 };
    const q = placePopover(low, { width: 320, height: 120 }, vp);
    expect(q.side).toBe('above');
    expect(q.top + 120).toBeLessThanOrEqual(low.top);
    expect(q.left).toBe(8);
  });

  it('never covers its term and never leaves the viewport sideways (random terms at 390px)', () => {
    for (let k = 0; k < 400; k++) {
      const left = (k * 37) % 360;
      const top = (k * 53) % 820;
      const term = { left, right: left + 20 + (k % 60), top, bottom: top + 24 };
      const pop = { width: 200 + (k % 200), height: 60 + (k % 180) };
      const p = placePopover(term, pop, vp);
      expect(p.left).toBeGreaterThanOrEqual(8);
      expect(p.left + p.width).toBeLessThanOrEqual(382);
      expect(overlaps({ left: p.left, right: p.left + p.width, top: p.top, bottom: p.top + pop.height }, term)).toBe(false);
    }
  });
});

describe('links to the defining lesson', () => {
  it('finds the site root from the manifest link or the path', () => {
    expect(rootFromManifest('../../../manifest.webmanifest')).toBe('../../../');
    expect(rootFromManifest('manifest.webmanifest')).toBe('./');
    expect(rootFromManifest(null, '/coolstuff/lessons/linalg/eigenvectors/')).toBe('../../../');
    expect(rootFromManifest(null, '/kit/_dev/text.html')).toBe('../../');
    expect(lessonLink('linalg/determinant', '../../../')).toBe('../../../lessons/linalg/determinant/');
    expect(lessonOfPath('/x/lessons/linalg/eigenvectors/index.html')).toBe('linalg/eigenvectors');
    expect(lessonOfPath('/kit/')).toBeNull();
  });
});
