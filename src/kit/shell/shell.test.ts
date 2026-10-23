import { describe, expect, it } from 'vitest';
import { LESSON_BY_ID, LESSONS, SUBJECT_BY_ID } from '@content/curriculum';
import { REFERENCES } from '../gallery/samples';
import { Fragment, h } from 'preact';
import { lessonHref, rootFrom, subjectHref } from './links';
import { scanSections, Section } from './Section';
import { referenceParts, referenceText, whereNext } from './where-next';

describe('links', () => {
  it('lesson links are relative between lesson pages', () => {
    expect(lessonHref('calc1/derivative')).toBe('../../calc1/derivative/');
    expect(subjectHref('linalg')).toBe('../../../#linalg');
  });
  it('the site root comes from the manifest link, else from the path', () => {
    expect(rootFrom('../../../manifest.webmanifest')).toBe('../../../');
    expect(rootFrom('manifest.webmanifest')).toBe('./');
    expect(rootFrom('/manifest.webmanifest', '/lessons/linalg/eigenvectors/')).toBe('../../../');
    expect(rootFrom(null, '/coolstuff/lessons/linalg/eigenvectors/')).toBe('../../../');
    expect(rootFrom(null, '/kit/_dev/controls.html')).toBe('../../');
    expect(rootFrom(null, '/kit/')).toBe('../');
    expect(rootFrom(null, '/')).toBe('./');
  });
});

describe('whereNext', () => {
  const index = [
    { id: 'linalg/determinant', status: 'shipped' as const, summary: 'How much a matrix scales area.' },
    { id: 'linalg/diagonalization', status: 'wip' as const },
  ];
  it('builds on the curriculum prerequisites and unlocks the lessons that list this one', () => {
    const d = whereNext('linalg/eigenvectors', LESSONS, SUBJECT_BY_ID, index);
    const me = LESSON_BY_ID.get('linalg/eigenvectors')!;
    expect(d.buildsOn.map((c) => c.id)).toEqual(me.prerequisites);
    const dependents = LESSONS.filter((l) => l.prerequisites.includes('linalg/eigenvectors')).map((l) => l.id);
    expect(d.unlocks.map((c) => c.id)).toEqual(dependents);
    expect(dependents.length).toBeGreaterThan(0);
  });
  it('shipped lessons link; unshipped ones are "coming soon" without a link', () => {
    const d = whereNext('linalg/eigenvectors', LESSONS, SUBJECT_BY_ID, index, { extraBuildsOn: ['linalg/determinant'] });
    const det = d.buildsOn.find((c) => c.id === 'linalg/determinant')!;
    expect(det).toMatchObject({ shipped: true, href: '../../linalg/determinant/', summary: 'How much a matrix scales area.' });
    expect(det.kicker).toMatch(/^Linear algebra · \d+$/);
    for (const c of d.unlocks) if (c.id !== 'linalg/determinant') expect(c.href).toBeUndefined();
  });
  it('extras are added once, never the lesson itself, unknown ids dropped', () => {
    const d = whereNext('linalg/eigenvectors', LESSONS, SUBJECT_BY_ID, [], { extraUnlocks: ['ml/pca', 'ml/pca', 'linalg/eigenvectors', 'nope/x'] });
    const ids = d.unlocks.map((c) => c.id);
    expect(ids.filter((x) => x === 'ml/pca')).toHaveLength(ids.includes('ml/pca') ? 1 : 0);
    expect(ids).not.toContain('linalg/eigenvectors');
    expect(ids).not.toContain('nope/x');
  });
});

describe('references', () => {
  it('splits a book reference for styling and reads as plain text', () => {
    const p = referenceParts(REFERENCES[0]);
    expect(p).toMatchObject({ authors: 'Strang, G.', title: 'Introduction to Linear Algebra', rest: '6th ed., Wellesley-Cambridge Press, 2023, §6.1' });
    expect(referenceText(REFERENCES[0])).toBe('Strang, G. Introduction to Linear Algebra. 6th ed., Wellesley-Cambridge Press, 2023, §6.1.');
  });
  it('papers carry their venue; URLs are kept as text', () => {
    const r = { authors: 'Ho, J., Jain, A. and Abbeel, P.', title: 'Denoising Diffusion Probabilistic Models', venue: 'NeurIPS', year: 2020, url: 'https://arxiv.org/abs/2006.11239' };
    expect(referenceParts(r).rest).toBe('NeurIPS, 2020');
    expect(referenceText(r)).toBe('Ho, J., Jain, A. and Abbeel, P. Denoising Diffusion Probabilistic Models. NeurIPS, 2020. https://arxiv.org/abs/2006.11239');
  });
});

describe('scanSections (LessonPage numbering)', () => {
  it('finds Sections among children, inside fragments and arrays, in order, with default kickers', () => {
    const kids = [
      h(Section, { id: 'tldr', title: 'In three lines' }),
      h('p', null, 'not a section'),
      h(Fragment, null, h(Section, { id: 'hook', title: 'A question', kicker: 'Puzzle' }), [h(Section, { id: 'play', title: 'Play' })]),
      false,
      null,
    ];
    expect(scanSections(kids)).toEqual([
      { id: 'tldr', title: 'In three lines', kicker: 'In brief' },
      { id: 'hook', title: 'A question', kicker: 'Puzzle' },
      { id: 'play', title: 'Play', kicker: 'Play' },
    ]);
  });
});
