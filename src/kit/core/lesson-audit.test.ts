import { describe, expect, it } from 'vitest';
import * as samples from '../gallery/samples';
import { anchorIds, auditDerivations, auditFormulas, auditLesson, auditReferences, auditTraps, validateLessonModule } from './lesson-audit';
import type { FormulaSpec, TrapSpec } from '../types';

const known = ['linalg/determinant', 'linalg/eigenvectors'];

describe('auditLesson', () => {
  it('the reference samples pass the whole lesson audit', () => {
    expect(auditLesson(samples, { knownLessons: known })).toEqual([]);
  });

  it('reports each missing or thin section, tagged by section', () => {
    const errs = auditLesson({ C: samples.C, PROBLEMS: samples.PROBLEMS }, { knownLessons: known });
    expect(errs).toEqual(
      expect.arrayContaining([
        'tldr: TLDR is missing',
        expect.stringMatching(/^formalize: no key formula/),
        'examples: EXAMPLES is missing',
        'traps: 0 common traps; need 2–4',
        'quickcheck: QUIZ is missing',
        'next: 0 reference(s); cite at least 2 (§10)',
      ]),
    );
    expect(auditLesson({})).toEqual([expect.stringMatching(/export the lesson's concepts as `C`/)]);
  });
});

describe('formulas, traps, references, derivations', () => {
  const f = samples.FORMULAS[0];
  it('every anchor needs an explain note and every note an anchor', () => {
    expect(anchorIds(f.tex)).toEqual(['Av', 'A', 'v', 'lam']);
    const { lam: _drop, ...rest } = f.explain;
    expect(auditFormulas([{ ...f, explain: rest }], { macros: samples.DEMO_MACROS }).join()).toMatch(/\\anchor\{lam\} has no explain note/);
    expect(auditFormulas([{ ...f, explain: { ...f.explain, mu: { word: 'x', gloss: 'y' } } }], { macros: samples.DEMO_MACROS }).join()).toMatch(/note "mu" has no \\anchor/);
    const bad: FormulaSpec = { ...f, brackets: [{ anchor: 'nope', text: 'x' }], explain: { ...f.explain, A: { word: 'w', gloss: 'g', concept: 'matrx' } } };
    const errs = auditFormulas([bad], { concepts: samples.C }).join();
    expect(errs).toMatch(/anchor "nope" isn't in the TeX/);
    expect(errs).toMatch(/unknown concept "matrx"/);
    expect(auditFormulas([{ ...f, tex: '\\cMatrix\\cInput' }], { macros: samples.DEMO_MACROS }).join()).toMatch(/tag its symbols/);
  });

  it('traps need 2–4 entries, each with figure, caption and description', () => {
    const t = samples.TRAPS[0];
    expect(auditTraps([t]).join()).toMatch(/1 common traps; need 2–4/);
    const noFig = { ...t, figure: '', figureDescription: '' } as TrapSpec;
    const errs = auditTraps([noFig, samples.TRAPS[1]], { macros: samples.DEMO_MACROS }).join();
    expect(errs).toMatch(/needs a counterexample figure key/);
    expect(errs).toMatch(/figureDescription \(for screen readers\) is empty/);
  });

  it('references and derivations', () => {
    expect(auditReferences([samples.REFERENCES[0]]).join()).toMatch(/cite at least 2/);
    expect(auditReferences([{ authors: '', title: 'T' }, { authors: 'A', title: 'T', year: 3000 }]).join()).toMatch(/authors missing.*odd year/);
    expect(auditDerivations([{ id: 'd', steps: [{ tex: 'x', why: '' }] }]).join()).toMatch(/at least 2 steps/);
    expect(auditDerivations([{ id: 'd', steps: [{ tex: 'x', why: '' }, { tex: 'y', why: '' }] }]).join()).toMatch(/step 2 why: empty/);
  });
});

describe('the problems.ts module contract (build-index)', () => {
  it('accepts a module with C and PROBLEMS', () => {
    expect(validateLessonModule(samples as unknown as Record<string, unknown>)).toEqual([]);
  });
  it('names what is missing or wrong', () => {
    expect(validateLessonModule({})).toEqual([expect.stringMatching(/export `C`/), expect.stringMatching(/export `PROBLEMS`/)]);
    expect(validateLessonModule({ C: samples.C, PROBLEMS: [{ id: 'A b', difficulty: 4 }] }).join()).toMatch(/bad id.*difficulty 1, 2 or 3/);
    expect(validateLessonModule({ C: samples.C, PROBLEMS: samples.PROBLEMS, PROBLEM: [] }).join()).toMatch(/did you mean "PROBLEMS"/);
  });
});
