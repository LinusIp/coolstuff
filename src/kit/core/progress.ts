/**
 * Learner progress, stored locally (§5: no accounts, no servers). Lessons
 * write it through the practice components; the site reads it for subject
 * pages, "continue where you left off" and the prerequisite graph.
 *
 *   import { progress } from '@kit/core/progress';
 *   progress.visit('linalg/eigenvectors');
 *   progress.attempt('linalg/eigenvectors', 'char-poly', true);
 *   progress.problemStatus('linalg/eigenvectors', 'char-poly');   // 'solved'
 *   progress.summary(lessonIdsOfSubject);                          // counts for a subject page
 *   const stop = progress.subscribe((data) => …);                 // other tabs too
 *
 * Pure apart from the storage you hand it: `createProgressStore(memoryStorage())`
 * in tests. Storage failures (private mode, quota) are swallowed: the page
 * still works, it just forgets. Preact components use `useProgress()`.
 */
import type {
  ExamAttempt,
  LessonProgress,
  LessonSectionId,
  LessonStatus,
  ProblemProgress,
  ProblemStatus,
  ProgressData,
  ProgressSummary,
  QuizProgress,
} from '../types';
import { LESSON_SECTION_IDS } from '../types';

export const PROGRESS_KEY = 'coolstuff:progress:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** An in-memory Storage for tests and for browsers that block localStorage. */
export function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

export interface ContinueTarget {
  lessonId: string;
  section?: LessonSectionId;
  lastVisit: string;
}

export interface ProgressStore {
  /** A snapshot (do not mutate). */
  read(): ProgressData;
  lesson(lessonId: string): LessonProgress | undefined;
  visit(lessonId: string): void;
  section(lessonId: string, section: LessonSectionId): void;
  /** Record a checked answer. Solving is permanent (later wrong tries don't unsolve). */
  attempt(lessonId: string, problemId: string, correct: boolean): ProblemProgress;
  /** Record that hint `level` (1–3) was opened. */
  hint(lessonId: string, problemId: string, level: number): ProblemProgress;
  /** Record that the full solution was shown. */
  reveal(lessonId: string, problemId: string): ProblemProgress;
  example(lessonId: string, exampleId: string, revealed: number, total: number): void;
  quiz(lessonId: string, q: Omit<QuizProgress, 'best'>): void;
  predict(lessonId: string, predictId: string, correct: boolean): void;
  complete(lessonId: string): void;
  exam(subjectId: string, attempt: ExamAttempt): void;
  status(lessonId: string): LessonStatus;
  problemStatus(lessonId: string, problemId: string): ProblemStatus;
  summary(lessonIds: readonly string[]): ProgressSummary;
  /** The most recently visited unfinished lesson. */
  continueTarget(): ContinueTarget | null;
  export(): string;
  /** Replace everything with an exported backup. Returns false (and changes nothing) if it isn't one. */
  import(json: string): boolean;
  reset(): void;
  /** Drop the cache and re-read storage (another tab changed it); notifies subscribers. */
  refresh(): void;
  subscribe(cb: (data: ProgressData) => void): () => void;
}

const empty = (): ProgressData => ({ version: 1, lessons: {}, exams: {} });

function isProgress(x: unknown): x is ProgressData {
  return !!x && typeof x === 'object' && (x as ProgressData).version === 1 && typeof (x as ProgressData).lessons === 'object' && (x as ProgressData).lessons !== null;
}

export function statusOfProblem(p: ProblemProgress | undefined): ProblemStatus {
  if (!p) return 'todo';
  if (p.solved) return p.hintsUsed > 0 || p.revealed ? 'hinted' : 'solved';
  if (p.revealed) return 'revealed';
  if (p.attempts > 0 || p.hintsUsed > 0) return 'attempted';
  return 'todo';
}

export function createProgressStore(storage: StorageLike | null, now: () => Date = () => new Date()): ProgressStore {
  let cache: ProgressData | null = null;
  const listeners = new Set<(d: ProgressData) => void>();

  const load = (): ProgressData => {
    if (cache) return cache;
    let data = empty();
    try {
      const raw = storage?.getItem(PROGRESS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isProgress(parsed)) data = { ...empty(), ...parsed, exams: parsed.exams ?? {} };
      }
    } catch {
      /* corrupt or blocked: start fresh */
    }
    cache = data;
    return data;
  };

  const save = (data: ProgressData) => {
    cache = data;
    try {
      storage?.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked: keep it in memory for this page */
    }
    for (const l of listeners) l(data);
  };

  const iso = () => now().toISOString();

  /** Copy-on-write update of one lesson's record. */
  const touch = (lessonId: string, fn: (p: LessonProgress) => void): LessonProgress => {
    const data = load();
    const t = iso();
    const prev = data.lessons[lessonId];
    const p: LessonProgress = prev
      ? { ...prev, sections: [...prev.sections], problems: { ...prev.problems }, examples: { ...prev.examples }, predictions: { ...prev.predictions } }
      : { firstVisit: t, lastVisit: t, sections: [], problems: {}, examples: {}, predictions: {}, completed: false };
    fn(p);
    save({ ...data, lessons: { ...data.lessons, [lessonId]: p } });
    return p;
  };

  const problem = (lessonId: string, problemId: string, fn: (q: ProblemProgress) => void): ProblemProgress => {
    let out!: ProblemProgress;
    touch(lessonId, (p) => {
      const q: ProblemProgress = { ...(p.problems[problemId] ?? { attempts: 0, solved: false, hintsUsed: 0, revealed: false, updated: iso() }) };
      fn(q);
      q.updated = iso();
      p.problems[problemId] = q;
      out = q;
    });
    return out;
  };

  return {
    read: load,
    lesson: (id) => load().lessons[id],
    visit: (id) => void touch(id, (p) => (p.lastVisit = iso())),
    section: (id, s) =>
      void touch(id, (p) => {
        if (!LESSON_SECTION_IDS.includes(s)) return;
        if (!p.sections.includes(s)) p.sections.push(s);
        p.lastSection = s;
        p.lastVisit = iso();
      }),
    attempt: (id, pid, correct) =>
      problem(id, pid, (q) => {
        q.attempts += 1;
        if (correct && !q.solved) {
          q.solved = true;
          q.clean = q.attempts === 1 && q.hintsUsed === 0 && !q.revealed;
        }
      }),
    hint: (id, pid, level) => problem(id, pid, (q) => (q.hintsUsed = Math.max(q.hintsUsed, Math.min(3, Math.max(0, Math.round(level)))))),
    reveal: (id, pid) => problem(id, pid, (q) => (q.revealed = true)),
    example: (id, eid, revealed, total) =>
      void touch(id, (p) => {
        const prev = p.examples[eid];
        p.examples[eid] = { revealed: Math.max(prev?.revealed ?? 0, revealed), total };
      }),
    quiz: (id, q) =>
      void touch(id, (p) => {
        const best = Math.max(p.quiz?.best ?? 0, q.done ? q.correct : 0);
        p.quiz = { ...q, best };
      }),
    predict: (id, pid, correct) => void touch(id, (p) => (p.predictions[pid] = { correct })),
    complete: (id) => void touch(id, (p) => (p.completed = true)),
    exam: (subject, attempt) => {
      const data = load();
      save({ ...data, exams: { ...data.exams, [subject]: [...(data.exams[subject] ?? []), attempt] } });
    },
    status: (id) => {
      const p = load().lessons[id];
      return !p ? 'new' : p.completed ? 'done' : 'started';
    },
    problemStatus: (id, pid) => statusOfProblem(load().lessons[id]?.problems[pid]),
    summary: (ids) => {
      const data = load();
      const out: ProgressSummary = { started: 0, done: 0, problems: { attempted: 0, solved: 0, hinted: 0, revealed: 0 } };
      for (const id of ids) {
        const p = data.lessons[id];
        if (!p) continue;
        out.started++;
        if (p.completed) out.done++;
        for (const q of Object.values(p.problems)) {
          const s = statusOfProblem(q);
          if (s !== 'todo') out.problems.attempted++;
          if (s === 'solved' || s === 'hinted') out.problems.solved++;
          if (s === 'hinted') out.problems.hinted++;
          if (s === 'revealed') out.problems.revealed++;
        }
      }
      return out;
    },
    continueTarget: () => {
      const entries = Object.entries(load().lessons).filter(([, p]) => !p.completed);
      if (entries.length === 0) return null;
      entries.sort((a, b) => (a[1].lastVisit < b[1].lastVisit ? 1 : a[1].lastVisit > b[1].lastVisit ? -1 : 0));
      const [lessonId, p] = entries[0];
      return { lessonId, section: p.lastSection, lastVisit: p.lastVisit };
    },
    export: () => JSON.stringify(load()),
    import: (json) => {
      try {
        const parsed: unknown = JSON.parse(json);
        if (!isProgress(parsed)) return false;
        save({ ...empty(), ...parsed, exams: parsed.exams ?? {} });
        return true;
      } catch {
        return false;
      }
    },
    reset: () => {
      try {
        storage?.removeItem(PROGRESS_KEY);
      } catch {
        /* ignore */
      }
      cache = null;
      for (const l of listeners) l(load());
    },
    refresh: () => {
      cache = null;
      const d = load();
      for (const l of listeners) l(d);
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__coolstuff_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

let shared: ProgressStore | null = null;

/** The page's progress store (localStorage, falling back to memory). Lazily created. */
export function getProgress(): ProgressStore {
  if (shared) return shared;
  const storage = browserStorage() ?? memoryStorage();
  const store = createProgressStore(storage);
  // Another tab changed progress: drop the cache and tell subscribers.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === PROGRESS_KEY || e.key === null) store.refresh();
    });
  }
  shared = store;
  return store;
}

/** Convenience proxy: `progress.visit(id)` etc. on the shared store. */
export const progress: ProgressStore = new Proxy({} as ProgressStore, {
  get: (_, key: keyof ProgressStore) => {
    const s = getProgress();
    const v = s[key];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(s) : v;
  },
});
