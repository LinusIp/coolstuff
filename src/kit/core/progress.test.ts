import { describe, expect, it } from 'vitest';
import { createProgressStore, memoryStorage, PROGRESS_KEY, statusOfProblem } from './progress';

describe('progress store', () => {
  let t = 0;
  const clock = () => new Date(Date.UTC(2026, 9, 23, 12, 0, t++));
  const fresh = () => createProgressStore(memoryStorage(), clock);

  it('visits, sections, completion and status', () => {
    const p = fresh();
    expect(p.status('linalg/eigenvectors')).toBe('new');
    p.visit('linalg/eigenvectors');
    p.section('linalg/eigenvectors', 'hook');
    p.section('linalg/eigenvectors', 'play');
    p.section('linalg/eigenvectors', 'hook');
    const l = p.lesson('linalg/eigenvectors')!;
    expect(l.sections).toEqual(['hook', 'play']);
    expect(l.lastSection).toBe('hook');
    expect(p.status('linalg/eigenvectors')).toBe('started');
    p.complete('linalg/eigenvectors');
    expect(p.status('linalg/eigenvectors')).toBe('done');
  });

  it('problem attempts, hints, reveals and derived status', () => {
    const p = fresh();
    const L = 'calc1/derivative';
    expect(p.problemStatus(L, 'p1')).toBe('todo');
    p.attempt(L, 'p1', false);
    expect(p.problemStatus(L, 'p1')).toBe('attempted');
    const q = p.attempt(L, 'p1', true);
    expect(q).toMatchObject({ attempts: 2, solved: true, clean: false });
    p.attempt(L, 'p1', false); // solving is permanent
    expect(p.problemStatus(L, 'p1')).toBe('solved');
    expect(p.attempt(L, 'p2', true).clean).toBe(true);
    p.hint(L, 'p3', 2);
    p.hint(L, 'p3', 1); // keeps the highest
    expect(p.lesson(L)!.problems.p3.hintsUsed).toBe(2);
    p.attempt(L, 'p3', true);
    expect(p.problemStatus(L, 'p3')).toBe('hinted');
    p.reveal(L, 'p4');
    expect(p.problemStatus(L, 'p4')).toBe('revealed');
    expect(statusOfProblem(undefined)).toBe('todo');
    expect(p.summary([L, 'nope/never'])).toEqual({ started: 1, done: 0, problems: { attempted: 4, solved: 3, hinted: 1, revealed: 1 } });
  });

  it('examples, quiz best, predictions and exams', () => {
    const p = fresh();
    const L = 'ml/gradient-descent';
    p.example(L, 'ex1', 2, 4);
    p.example(L, 'ex1', 1, 4); // keeps the furthest
    expect(p.lesson(L)!.examples.ex1).toEqual({ revealed: 2, total: 4 });
    p.quiz(L, { answered: 5, correct: 4, total: 5, done: true });
    p.quiz(L, { answered: 5, correct: 2, total: 5, done: true });
    expect(p.lesson(L)!.quiz).toMatchObject({ correct: 2, best: 4 });
    p.predict(L, 'guess1', false);
    expect(p.lesson(L)!.predictions.guess1).toEqual({ correct: false });
    p.exam('ml', { date: '2026-10-23', score: 7, total: 10, seconds: 1200 });
    expect(p.read().exams.ml).toHaveLength(1);
  });

  it('continue where you left off', () => {
    const p = fresh();
    expect(p.continueTarget()).toBeNull();
    p.visit('a/one');
    p.section('b/two', 'examples');
    expect(p.continueTarget()).toMatchObject({ lessonId: 'b/two', section: 'examples' });
    p.complete('b/two');
    expect(p.continueTarget()?.lessonId).toBe('a/one');
  });

  it('persists, survives corruption, exports/imports, resets, notifies', () => {
    const storage = memoryStorage();
    const a = createProgressStore(storage, clock);
    const seen: number[] = [];
    const stop = a.subscribe((d) => seen.push(Object.keys(d.lessons).length));
    a.visit('x/y');
    expect(seen).toEqual([1]);
    stop();
    const b = createProgressStore(storage, clock);
    expect(b.status('x/y')).toBe('started');
    const backup = b.export();
    b.reset();
    expect(b.status('x/y')).toBe('new');
    expect(b.import('{"nope": true}')).toBe(false);
    expect(b.import('not json')).toBe(false);
    expect(b.import(backup)).toBe(true);
    expect(b.status('x/y')).toBe('started');
    storage.setItem(PROGRESS_KEY, '{corrupt');
    expect(createProgressStore(storage).read()).toEqual({ version: 1, lessons: {}, exams: {} });
    // Blocked storage: everything still works in memory.
    const blocked = createProgressStore({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} });
    blocked.visit('q/r');
    expect(blocked.status('q/r')).toBe('started');
    // refresh() re-reads storage written elsewhere.
    const c = createProgressStore(storage, clock);
    c.read();
    createProgressStore(storage, clock).visit('z/z');
    expect(c.status('z/z')).toBe('new');
    c.refresh();
    expect(c.status('z/z')).toBe('started');
  });
});
