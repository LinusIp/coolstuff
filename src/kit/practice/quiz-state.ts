/**
 * Quick-check state (README §8.4), pure and tested (quiz-state.test.ts).
 * The FIRST answer to a question is its score; "Try again" lets the learner
 * pick again for practice without changing it.
 */
import { checkDrag } from '../core/answers';
import type { QuizQuestion } from '../types';

export interface QuizRecord {
  /** Choice: original option indices picked. Drag: the arrangement (item order, or slot per item). */
  picked: readonly number[];
  /** Is the answer on screen right? */
  correct: boolean;
  /** The first answer: this is what the score counts. */
  firstCorrect: boolean;
  tries: number;
  /** The answer is on screen (false after "Try again", until the next answer). */
  shown: boolean;
}

export interface QuizState {
  current: number;
  records: readonly (QuizRecord | null)[];
  /** The summary is showing. */
  done: boolean;
}

export const quizStart = (n: number): QuizState => ({ current: 0, records: Array.from({ length: n }, () => null), done: false });

/** Is this pick right? (Multi-select: exactly the right set.) */
export function judgeQuizChoice(q: Extract<QuizQuestion, { kind: 'choice' }>, picked: readonly number[]): boolean {
  const want = typeof q.correct === 'number' ? [q.correct] : [...q.correct];
  const got = [...new Set(picked)];
  return got.length === want.length && want.every((w) => got.includes(w));
}

/** Is this arrangement right? */
export function judgeQuizDrag(q: Extract<QuizQuestion, { kind: 'drag' }>, state: readonly number[]): boolean {
  return checkDrag(state, q.target).correct;
}

export function judgeQuiz(q: QuizQuestion, picked: readonly number[]): boolean {
  return q.kind === 'choice' ? judgeQuizChoice(q, picked) : judgeQuizDrag(q, picked);
}

/** Record an answer to question `i` (the first one sets the score). */
export function answerQuestion(s: QuizState, i: number, picked: readonly number[], correct: boolean): QuizState {
  const prev = s.records[i];
  const rec: QuizRecord = prev
    ? { picked: [...picked], correct, firstCorrect: prev.firstCorrect, tries: prev.tries + 1, shown: true }
    : { picked: [...picked], correct, firstCorrect: correct, tries: 1, shown: true };
  return { ...s, records: s.records.map((r, k) => (k === i ? rec : r)) };
}

/** "Try again": clear what's on screen for question `i` (its score stays). */
export function retryQuestion(s: QuizState, i: number): QuizState {
  const prev = s.records[i];
  if (!prev) return s;
  return { ...s, records: s.records.map((r, k) => (k === i ? { ...prev, picked: [], shown: false } : r)) };
}

/** Next question; after the last one, the first unanswered one, or the summary when all are answered. */
export function nextQuestion(s: QuizState): QuizState {
  const n = s.records.length;
  for (let k = s.current + 1; k < n; k++) if (!s.records[k]) return { ...s, current: k };
  const first = s.records.findIndex((r) => !r);
  if (first >= 0 && first !== s.current) return { ...s, current: first };
  return s.records.every(Boolean) ? { ...s, done: true } : s;
}

export function goToQuestion(s: QuizState, i: number): QuizState {
  return { ...s, current: Math.max(0, Math.min(s.records.length - 1, i)), done: false };
}

export function quizScore(s: QuizState): { answered: number; correct: number; total: number } {
  const answered = s.records.filter(Boolean).length;
  const correct = s.records.filter((r) => r?.firstCorrect).length;
  return { answered, correct, total: s.records.length };
}

/** Questions whose first answer was wrong (for "review your misses"). */
export function quizMisses(s: QuizState): number[] {
  const out: number[] = [];
  s.records.forEach((r, k) => r && !r.firstCorrect && out.push(k));
  return out;
}
