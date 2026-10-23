import { describe, expect, it } from 'vitest';
import { domId, drawExam, problemKey, scoreExam, type ExamResponse } from './exam';
import { formatAtPrecision } from './answers';
import { DEMO, PROBLEMS } from '../gallery/samples';
import type { NumericAnswer, PracticeItem } from '../types';

const items: PracticeItem[] = [
  ...PROBLEMS.map((spec) => ({ lessonId: 'linalg/eigenvectors', spec, concepts: DEMO })),
  ...PROBLEMS.map((spec) => ({ lessonId: 'linalg/determinant', spec, concepts: DEMO })),
];

describe('exam papers', () => {
  it('keys and DOM ids are namespaced by lesson', () => {
    expect(problemKey('calc1/derivative', 'p-1')).toBe('calc1/derivative:p-1');
    expect(problemKey(undefined, 'p-1')).toBe('p-1');
    expect(domId('calc1/derivative:p-1')).toBe('calc1-derivative--p-1');
  });

  it('draws a deterministic, mixed paper per attempt seed', () => {
    const a = drawExam(items, { seed: 7, count: 8 });
    const b = drawExam(items, { seed: 7, count: 8 });
    expect(a.map((q) => q.key)).toEqual(b.map((q) => q.key));
    expect(a).toHaveLength(8);
    expect(new Set(a.map((q) => q.key)).size).toBe(8);
    expect(a.some((q) => q.spec.answer.kind === 'proof')).toBe(false); // can't be auto-scored
    expect(new Set(a.map((q) => q.lessonId)).size).toBe(2);
    const c = drawExam(items, { seed: 8, count: 8 });
    expect(c.map((q) => q.key)).not.toEqual(a.map((q) => q.key));
    // Generated problems are re-seeded per attempt.
    const gen = [...a, ...c].filter((q) => q.spec.generate);
    expect(gen.length).toBeGreaterThan(0);
    for (const q of gen) expect(q.instance.seed).toBeGreaterThan(0);
  });

  it('scores with the practice checkers; unanswered counts as wrong', () => {
    const paper = drawExam(items, { seed: 3, count: 6 });
    const responses = paper.map((q, k) => {
      if (k === 0) return null;
      const a = q.instance.answer;
      if (a.kind === 'numeric') {
        const vals = typeof a.value === 'number' ? [a.value] : a.value;
        const txt = vals.map((v) => (a.precision === 'exact' ? String(v) : formatAtPrecision(v, a.precision).replace('−', '-'))).join(', ');
        return { kind: 'numeric' as const, text: (a as NumericAnswer).unit ? `${txt} ${(a as NumericAnswer).unit}` : txt };
      }
      if (a.kind === 'choice') return { kind: 'choice' as const, selected: a.correct };
      if (a.kind === 'symbolic') return { kind: 'symbolic' as const, text: a.expr };
      if (a.kind === 'code') return { kind: 'code' as const, verdict: { correct: true, reason: 'correct' as const, message: 'ok' } };
      if (a.kind === 'drag' && a.target.mode === 'order') return { kind: 'drag' as const, state: a.target.correct };
      if (a.kind === 'drag' && a.target.mode === 'point') return { kind: 'drag' as const, state: a.target.answer };
      return null;
    });
    const r = scoreExam(paper, responses);
    expect(r.total).toBe(6);
    expect(r.verdicts[0]).toMatchObject({ correct: false, reason: 'empty' });
    expect(r.score).toBe(responses.filter((x, k) => x && k > 0).length);
  });

  it('code answers need a sandbox verdict before scoring', () => {
    const paper = drawExam(items, { seed: 3, count: 6 });
    const k = paper.findIndex((q) => q.instance.answer.kind === 'code');
    if (k < 0) return;
    const rs = paper.map(() => null as ExamResponse);
    rs[k] = { kind: 'code', source: 'function f() {}' };
    expect(scoreExam(paper, rs).verdicts[k]).toMatchObject({ correct: false, reason: 'incomplete' });
    rs[k] = { kind: 'code', source: '  ' };
    expect(scoreExam(paper, rs).verdicts[k]).toMatchObject({ reason: 'empty' });
  });
});
