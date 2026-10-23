/**
 * Tests for G3's smaller pure modules: arrange (order/match), example-state
 * (live params + reveals), quiz-state, predict-state, exam-state,
 * code-results and code-edit.
 */
import { describe, expect, it } from 'vitest';
import { defineExample } from '../core/problems';
import { runCodeTests, sanitizeReport } from '../core/codecheck';
import { EXAMPLES, PROBLEMS, QUIZ } from '../gallery/samples';
import type { CodeAnswer, PredictGuess, QuizQuestion } from '../types';
import { dropIndex, itemsInSlot, matchSummary, moveItem, orderSummary, placeMatch, placedCount } from './arrange';
import { choiceAvailability, clampReveal, cleanPatch, levelInfo, nextTab, paramEntries, proposeParams, snapParam, startValues, tabLabels } from './example-state';
import { answerQuestion, goToQuestion, judgeQuiz, judgeQuizChoice, nextQuestion, quizMisses, quizScore, quizStart, retryQuestion } from './quiz-state';
import { describeGuess, hasGuess, judgeGuess, numberGuessStart } from './predict-state';
import { attemptsSummary, defaultMinutes, formatClock, formatDuration, isAnswered, timerAnnouncement, unansweredCount } from './exam-state';
import { runVerdict, testLines, testsRan } from './code-results';
import { lineCount, newlineIndent, outdentLine } from './code-edit';

describe('arrange', () => {
  it('moves items, clamped', () => {
    expect(moveItem([0, 1, 2, 3], 0, 2)).toEqual([1, 2, 0, 3]);
    expect(moveItem([0, 1, 2, 3], 3, 0)).toEqual([3, 0, 1, 2]);
    expect(moveItem([0, 1, 2], 1, 9)).toEqual([0, 2, 1]);
    expect(moveItem([], 0, 1)).toEqual([]);
  });
  it('finds where a dragged row lands from the midpoints it crossed', () => {
    const mids = [20, 60, 100, 140];
    expect(dropIndex(mids, 25, 0)).toBe(0);
    expect(dropIndex(mids, 70, 0)).toBe(1);
    expect(dropIndex(mids, 150, 0)).toBe(3);
    expect(dropIndex(mids, 10, 3)).toBe(0);
    expect(dropIndex(mids, 90, 3)).toBe(2);
  });
  it('places match items, several per slot', () => {
    expect(placeMatch([-1, -1, -1], 1, 0)).toEqual([-1, 0, -1]);
    expect(placeMatch([0, 0, -1], 0, -1)).toEqual([-1, 0, -1]);
    expect(placeMatch([0], 5, 1)).toEqual([0]);
    expect(itemsInSlot([1, 0, 1], 1)).toEqual([0, 2]);
    expect(placedCount([1, -1, 0])).toBe(2);
  });
  it('summarises arrangements in plain words', () => {
    expect(orderSummary({ items: ['$a$', 'b'] }, [1, 0])).toBe('1. b; 2. a');
    expect(matchSummary({ items: ['x', 'y'], slots: ['$\\lambda$', 'B'] }, [0, -1])).toBe('x → λ; y → not placed');
  });
});

describe('worked-example params', () => {
  const live = EXAMPLES[1]; // a ∈ [-3, 3] step 0.5, default 2
  const guarded = defineExample<{ a: number; f: number }>({
    id: 'guarded',
    level: 'direct',
    statement: 's',
    known: 'k',
    want: 'w',
    strategy: 's',
    steps: (p) => Array.from({ length: p.a > 0 ? 3 : 2 }, (_, k) => ({ math: `x_${k}`, why: 'w', tryIt: k ? 't' : undefined })),
    answer: 'a',
    sanity: 's',
    params: {
      a: { label: 'a', min: -2, max: 2, step: 0.5, value: 1 },
      f: { kind: 'choice', label: 'f', options: ['sin', 'tan', 'log'], value: 0 },
    },
    accept: (p) => (p.a === 0 ? 'a can’t be 0: the quotient divides by it.' : p.f === 2 && p.a < 0 ? 'log needs a positive a.' : true),
  });

  it('snaps and cleans patches', () => {
    expect(snapParam({ label: 'a', min: -3, max: 3, step: 0.5, value: 2 }, 1.3)).toBe(1.5);
    expect(snapParam({ label: 'a', min: -3, max: 3, step: 0.5, value: 2 }, 9)).toBe(3);
    expect(snapParam({ label: 'a', min: 0.001, max: 1.5, step: 0.001, value: 0.1, scale: 'log' }, 0.0123)).toBe(0.0123);
    expect(cleanPatch(guarded, { a: 0.7, f: 7, nope: 3 })).toEqual({ a: 0.5, f: 2 });
  });

  it('accepts or rejects through accept(), keeping the last accepted values', () => {
    const start = startValues(guarded);
    expect(start).toEqual({ a: 1, f: 0 });
    const ok = proposeParams(guarded, start, { a: 1.5 });
    expect(ok).toEqual({ accepted: true, values: { a: 1.5, f: 0 } });
    const no = proposeParams(guarded, ok.values, { a: 0 });
    expect(no.accepted).toBe(false);
    expect(no).toMatchObject({ reason: 'a can’t be 0: the quotient divides by it.', values: { a: 1.5, f: 0 } });
    expect(proposeParams(live, startValues(live), { a: -3 }).accepted).toBe(true);
  });

  it('starts from an external value only when it passes', () => {
    expect(startValues(guarded, { a: -1 })).toEqual({ a: -1, f: 0 });
    expect(startValues(guarded, { a: 0 })).toEqual({ a: 1, f: 0 });
  });

  it('disables choice options accept() would reject, with the reason', () => {
    expect(choiceAvailability(guarded, { a: 1, f: 0 }, 'f')).toEqual([true, true, true]);
    expect(choiceAvailability(guarded, { a: -1, f: 0 }, 'f')).toEqual([true, true, 'log needs a positive a.']);
    expect(choiceAvailability(guarded, { a: -1, f: 0 }, 'a')).toEqual([]);
  });

  it('clamps the reveal count to the steps there are', () => {
    expect(clampReveal(3, 2)).toBe(2);
    expect(clampReveal(0, 4)).toBe(1);
    expect(clampReveal(2.7, 4)).toBe(2);
    expect(clampReveal(5, 0)).toBe(0);
  });

  it('lists params by control, labels levels and tabs', () => {
    expect(paramEntries(guarded).map((e) => `${e.name}:${e.kind}`)).toEqual(['a:number', 'f:choice']);
    expect(levelInfo('exam')).toEqual({ stars: '★★★', word: 'Exam level', short: 'exam level' });
    expect(tabLabels(['direct', 'combined', 'exam'])).toEqual(['Direct', 'Combined', 'Exam level']);
    expect(tabLabels(['direct', 'direct', 'exam'])).toEqual(['Direct 1', 'Direct 2', 'Exam level']);
    expect(nextTab(0, 'ArrowRight', 3)).toBe(1);
    expect(nextTab(0, 'ArrowLeft', 3)).toBe(2);
    expect(nextTab(1, 'End', 3)).toBe(2);
    expect(nextTab(1, 'Home', 3)).toBe(0);
    expect(nextTab(1, 'Enter', 3)).toBeNull();
  });
});

describe('quiz state', () => {
  const q0 = QUIZ[0] as Extract<QuizQuestion, { kind: 'choice' }>;
  it('judges choices (multi-select needs exactly the set) and drags', () => {
    expect(judgeQuizChoice(q0, [0])).toBe(true);
    expect(judgeQuizChoice(q0, [1])).toBe(false);
    const multi = { ...q0, correct: [0, 2] as readonly number[] };
    expect(judgeQuizChoice(multi, [2, 0])).toBe(true);
    expect(judgeQuizChoice(multi, [0])).toBe(false);
    expect(judgeQuiz(QUIZ[2], [1, 2, 0])).toBe(true);
    expect(judgeQuiz(QUIZ[2], [0, 1, 2])).toBe(false);
  });

  it('scores the first answer, lets you try again, and ends with a summary', () => {
    let s = quizStart(3);
    s = answerQuestion(s, 0, [1], false);
    s = retryQuestion(s, 0);
    expect(s.records[0]).toMatchObject({ shown: false, picked: [], firstCorrect: false, tries: 1 });
    s = answerQuestion(s, 0, [0], true);
    expect(s.records[0]).toMatchObject({ shown: true, correct: true, firstCorrect: false, tries: 2 });
    s = nextQuestion(s);
    expect(s.current).toBe(1);
    s = answerQuestion(s, 1, [0], true);
    s = nextQuestion(s);
    expect(s.current).toBe(2);
    s = nextQuestion(s); // the last one is unanswered: stays
    expect(s).toMatchObject({ current: 2, done: false });
    s = answerQuestion(s, 2, [3], false);
    s = nextQuestion(s);
    expect(s.done).toBe(true);
    expect(quizScore(s)).toEqual({ answered: 3, correct: 1, total: 3 });
    expect(quizMisses(s)).toEqual([0, 2]);
    expect(goToQuestion(s, 2)).toMatchObject({ current: 2, done: false });
  });

  it('after the last question, jumps back to the first unanswered one', () => {
    let s = goToQuestion(quizStart(3), 2);
    s = answerQuestion(s, 2, [0], true);
    s = nextQuestion(s);
    expect(s.current).toBe(0);
  });
});

describe('predict', () => {
  const choice: PredictGuess = { kind: 'choice', options: ['None', 'One', 'Two'], answer: 2 };
  const num: PredictGuess = { kind: 'number', label: 'x', min: 0, max: 10, step: 0.5, answer: 4, tolerance: 0.5, unit: 'm/s' };
  const custom: PredictGuess = { kind: 'custom', check: (g) => Array.isArray(g) && g[0] > 1, describe: (g) => `x = ${(g as number[])[0]}` };
  it('needs a guess before judging', () => {
    expect(hasGuess(choice, undefined)).toBe(false);
    expect(hasGuess(choice, 5)).toBe(false);
    expect(hasGuess(num, NaN)).toBe(false);
    expect(hasGuess(custom, [2])).toBe(true);
    expect(judgeGuess(choice, undefined)).toBe(false);
  });
  it('judges and describes each kind', () => {
    expect(judgeGuess(choice, 2)).toBe(true);
    expect(judgeGuess(choice, 1)).toBe(false);
    expect(judgeGuess(num, 4.5)).toBe(true);
    expect(judgeGuess(num, 5)).toBe(false);
    expect(judgeGuess(custom, [2])).toBe(true);
    expect(judgeGuess({ kind: 'custom', check: () => { throw new Error('x'); } }, 1)).toBe(false);
    expect(describeGuess(choice, 1)).toBe('One');
    expect(describeGuess(num, -2.5)).toBe('−2.5 m/s');
    expect(describeGuess(custom, [3])).toBe('x = 3');
    expect(numberGuessStart(num as Extract<PredictGuess, { kind: 'number' }>)).toBe(5);
  });
});

describe('exam state', () => {
  it('formats the clock and durations', () => {
    expect(formatClock(750)).toBe('12:30');
    expect(formatClock(59.2)).toBe('1:00');
    expect(formatClock(-3)).toBe('0:00');
    expect(formatClock(3900)).toBe('1:05:00');
    expect(formatDuration(872)).toBe('14 min 32 s');
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(3720)).toBe('1 h 2 min');
    expect(formatDuration(600)).toBe('10 min');
  });
  it('announces only at 5 and 1 minutes left', () => {
    const said: string[] = [];
    for (let t = 400; t >= 0; t--) {
      const a = timerAnnouncement(t + 1, t);
      if (a) said.push(`${t}:${a}`);
    }
    expect(said).toEqual(['300:5 minutes left.', '60:1 minute left.']);
    expect(timerAnnouncement(1000, 200)).toBe('5 minutes left.'); // a throttled tab that skipped ahead
    expect(timerAnnouncement(200, 199)).toBeNull();
  });
  it('counts answered questions and summarises attempts', () => {
    expect(defaultMinutes(8)).toBe(24);
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered({ kind: 'numeric', text: ' ' })).toBe(false);
    expect(isAnswered({ kind: 'choice', selected: [] })).toBe(false);
    expect(isAnswered({ kind: 'choice', selected: 0 })).toBe(true);
    expect(isAnswered({ kind: 'code', source: 'x' })).toBe(true);
    expect(isAnswered({ kind: 'drag', state: [1, 2] })).toBe(true);
    expect(unansweredCount([null, { kind: 'numeric', text: '3' }, undefined])).toBe(2);
    expect(attemptsSummary(undefined)).toEqual({ count: 0 });
    const a = { date: '2026-10-01', score: 5, total: 8, seconds: 600 };
    const b = { date: '2026-10-02', score: 7, total: 8, seconds: 500 };
    const c = { date: '2026-10-03', score: 6, total: 8, seconds: 400 };
    expect(attemptsSummary([a, b, c])).toEqual({ count: 3, best: b, last: c });
  });
});

describe('code results', () => {
  const answer = PROBLEMS.find((p) => p.id === 'power-iteration')!.answer as CodeAnswer;
  it('shows visible tests in full and hidden ones by number only', () => {
    const report = sanitizeReport(runCodeTests('function powerIteration(A, steps) { return 3; }', answer));
    const lines = testLines(report, answer.entry);
    expect(lines[0]).toMatchObject({ name: 'symmetric', ok: true, call: 'powerIteration([[2,1],[1,2]], 50)', expected: '3', got: '3' });
    expect(lines[1]).toMatchObject({ name: 'not symmetric', ok: false, expected: '5', got: '3' });
    expect(lines[3]).toEqual({ name: 'hidden test 4', ok: true, hidden: true });
    expect(runVerdict({ report })).toEqual({ correct: false, reason: 'wrong', message: '2 of 4 tests pass. First failure (not symmetric): expected 5, got 3.' });
    const thrown = sanitizeReport(runCodeTests('function powerIteration() { throw new Error("nope"); }', answer));
    expect(runVerdict({ report: thrown }).message).toBe('0 of 4 tests pass. nope');
    expect(testsRan({ report })).toBe(true);
  });
  it('passes the reference solution and explains runs that never finished', () => {
    const report = sanitizeReport(runCodeTests(answer.solution, answer));
    expect(runVerdict({ report })).toMatchObject({ correct: true, message: 'All 4 tests pass.' });
    const syntax = sanitizeReport(runCodeTests('function powerIteration( {', answer));
    expect(runVerdict({ report: syntax }).reason).toBe('unparseable');
    expect(testsRan({ report: syntax })).toBe(false);
    expect(runVerdict({ timedOut: true, error: { message: 'Stopped after 2 s.' } })).toEqual({ correct: false, reason: 'wrong', message: 'Stopped after 2 s.' });
    expect(testsRan({ timedOut: true })).toBe(true);
    expect(runVerdict({ error: { message: 'boom', line: 3 } })).toEqual({ correct: false, reason: 'unparseable', message: 'Line 3: boom' });
  });
});

describe('code edits', () => {
  it('outdents the caret line and keeps indentation on Enter', () => {
    expect(outdentLine('a\n    b', 7)).toEqual({ text: 'a\n  b', caret: 5 });
    expect(outdentLine('x', 1)).toEqual({ text: 'x', caret: 1 });
    expect(newlineIndent('  if (x) {', 10)).toBe('\n    ');
    expect(newlineIndent('  y = 1;', 8)).toBe('\n  ');
    expect(lineCount('a\nb\nc')).toBe(3);
  });
});
