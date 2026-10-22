/**
 * Lesson progress, stored locally (no accounts, no servers). Shared contract
 * between explain-kit (lessons write it) and the /learn hub (reads it).
 */
const KEY = 'coolstuff:learn:progress';

export interface LessonProgress {
  /** ISO time of the first and latest visit. */
  firstVisit: string;
  lastVisit: string;
  /** Section ids the learner has scrolled through or completed. */
  sections: string[];
  /** Best "check yourself" result. */
  quiz?: { correct: number; total: number };
  /** Set once the learner finishes the quiz (any score) or marks the lesson done. */
  completed: boolean;
}

export type ProgressMap = Record<string, LessonProgress>;

export function readProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as ProgressMap;
  } catch {
    return {};
  }
}

export function updateProgress(slug: string, patch: (p: LessonProgress) => void): LessonProgress {
  const all = readProgress();
  const now = new Date().toISOString();
  const p = all[slug] ?? { firstVisit: now, lastVisit: now, sections: [], completed: false };
  p.lastVisit = now;
  patch(p);
  all[slug] = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked: progress just isn't remembered */
  }
  return p;
}

export type LessonStatus = 'done' | 'started' | 'new';

export function statusOf(slug: string, map: ProgressMap = readProgress()): LessonStatus {
  const p = map[slug];
  if (!p) return 'new';
  return p.completed ? 'done' : 'started';
}
