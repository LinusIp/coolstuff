/**
 * Pages that mix lessons: subject practice and the timed exam-style set
 * (CLAUDE.md §5 "per-subject problem banks"). Pure: drawing a paper,
 * namespacing ids, and scoring are tested in Node; G3's `ExamSet` and
 * `ProblemSet items` render on top of them.
 *
 *   const paper = drawExam(items, { seed: attemptSeed, count: 8 });
 *   … learner answers (no feedback, no hints) …
 *   const result = scoreExam(paper, responses);     // then the walkthrough
 *   progress.exam(subjectId, { date, score: result.score, total: result.total, seconds });
 */
import { checkAnswer, type AnswerResponse } from './answers';
import { drawProblem } from './problems';
import { createRng } from './rng';
import type { AnswerKind, Difficulty, PracticeItem, ProblemInstance, Verdict } from '../types';

/** `${lessonId}:${problemId}`: a problem's identity on a page that mixes lessons (data-problem, progress lookups). */
export const problemKey = (lessonId: string | undefined, problemId: string): string => (lessonId ? `${lessonId}:${problemId}` : problemId);

/** A string made safe for an HTML id / aria reference: 'calc1/derivative:p-1' → 'calc1-derivative--p-1'. */
export const domId = (key: string): string => key.replace(/[^A-Za-z0-9_-]/g, (c) => (c === ':' ? '--' : '-'));

export interface ExamQuestion extends PracticeItem {
  /** problemKey(lessonId, spec.id). */
  key: string;
  /** The instance drawn for this attempt (generated problems get a fresh seed per attempt). */
  instance: ProblemInstance;
}

export interface ExamOptions {
  /** The attempt's seed: the same seed redraws the same paper. Use `randomSeed()` per attempt. */
  seed: number;
  /** Questions on the paper. Default 8. */
  count?: number;
  /** Share of each difficulty. Default { 1: 0.25, 2: 0.5, 3: 0.25 }. */
  mix?: Partial<Record<Difficulty, number>>;
  /** Answer kinds that can't be scored automatically are left out. Default: proof. */
  exclude?: readonly AnswerKind[];
}

/**
 * Draw a timed paper from many lessons' problems: difficulty mix, lessons
 * interleaved so one lesson doesn't dominate, generated problems re-seeded
 * per attempt (so a retake isn't a memory test). Deterministic per seed.
 */
export function drawExam(items: readonly PracticeItem[], opts: ExamOptions): ExamQuestion[] {
  const rng = createRng(`exam#${opts.seed}`);
  const exclude = new Set(opts.exclude ?? ['proof']);
  const pool = items.filter((it) => !exclude.has(it.spec.answer.kind));
  const count = Math.min(opts.count ?? 8, pool.length);
  const mix = { 1: 0.25, 2: 0.5, 3: 0.25, ...(opts.mix ?? {}) };
  const total = mix[1] + mix[2] + mix[3];
  const want: Record<Difficulty, number> = {
    1: Math.round((count * mix[1]) / total),
    2: 0,
    3: Math.round((count * mix[3]) / total),
  };
  want[2] = Math.max(0, count - want[1] - want[3]);
  const chosen: PracticeItem[] = [];
  const take = (d: Difficulty, n: number) => {
    // Interleave lessons: shuffle within each lesson, then round-robin.
    const byLesson = new Map<string, PracticeItem[]>();
    for (const it of rng.shuffle(pool.filter((p) => p.spec.difficulty === d && !chosen.includes(p)))) {
      const l = byLesson.get(it.lessonId) ?? [];
      l.push(it);
      byLesson.set(it.lessonId, l);
    }
    const queues = rng.shuffle([...byLesson.values()]);
    while (n > 0 && queues.some((q) => q.length)) {
      for (const q of queues) {
        if (n === 0) break;
        const it = q.shift();
        if (it) {
          chosen.push(it);
          n--;
        }
      }
    }
    return n; // shortfall
  };
  let short = 0;
  for (const d of [3, 1, 2] as Difficulty[]) short += take(d, want[d]);
  if (short > 0) {
    let s = take(2, short);
    if (s > 0) s = take(1, s);
    if (s > 0) take(3, s);
  }
  return rng.shuffle(chosen.slice(0, count)).map((it, k) => {
    const seed = it.spec.generate ? createRng(`${opts.seed}#${problemKey(it.lessonId, it.spec.id)}#${k}`).int(1, 2 ** 30) : 0;
    return { ...it, key: problemKey(it.lessonId, it.spec.id), instance: drawProblem(it.spec, seed) };
  });
}

/** What the learner submitted for one question: a checkable response, a code verdict (from the sandbox), or nothing. */
export type ExamResponse = AnswerResponse | { kind: 'code'; verdict: Verdict } | null | undefined;

export interface ExamResult {
  score: number;
  total: number;
  /** One per question, in paper order (unanswered → reason 'empty'). */
  verdicts: Verdict[];
}

/** Score a submitted paper with the same checkers practice uses. */
export function scoreExam(paper: readonly ExamQuestion[], responses: readonly ExamResponse[]): ExamResult {
  const verdicts = paper.map((q, k): Verdict => {
    const r = responses[k];
    if (!r) return { correct: false, reason: 'empty', message: 'Not answered.' };
    if (r.kind === 'code') return r.verdict;
    if (r.kind !== q.instance.answer.kind) return { correct: false, reason: 'unparseable', message: 'That answer is the wrong kind for this question.' };
    return checkAnswer(q.instance.answer, r, q.instance.commonWrong);
  });
  return { score: verdicts.filter((v) => v.correct).length, total: paper.length, verdicts };
}
