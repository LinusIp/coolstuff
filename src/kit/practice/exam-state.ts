/**
 * The timed exam-style set's pure rules (README §8.7), tested in
 * exam-state.test.ts: the clock text, when to announce the time (5 and 1
 * minutes left, never every second), what counts as answered, and the
 * summary of earlier attempts.
 */
import type { ExamResponse } from '../core/exam';
import type { ExamAttempt } from '../types';

/** 12:30 · 1:05:00 (never negative). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`;
}

/** "14 min 32 s" · "45 s" · "1 h 2 min". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h${m ? ` ${m} min` : ''}`;
  if (m > 0) return `${m} min${r ? ` ${r} s` : ''}`;
  return `${r} s`;
}

/** The announcement to make when the clock goes from `prev` to `now` seconds left: at 5 minutes and at 1 minute only. */
export function timerAnnouncement(prev: number, now: number): string | null {
  if (prev > 300 && now <= 300 && now > 60) return '5 minutes left.';
  if (prev > 60 && now <= 60 && now > 0) return '1 minute left.';
  return null;
}

/** Default time limit: three minutes a question. */
export const defaultMinutes = (count: number): number => 3 * Math.max(1, count);

/** Has this question been answered? (Code counts once it differs from nothing.) */
export function isAnswered(r: ExamResponse): boolean {
  if (!r) return false;
  if (r.kind === 'code') return !!r.source?.trim();
  if (r.kind === 'numeric' || r.kind === 'symbolic') return r.text.trim() !== '';
  if (r.kind === 'choice') return typeof r.selected === 'number' || r.selected.length > 0;
  return true;
}

export const unansweredCount = (rs: readonly ExamResponse[]): number => rs.filter((r) => !isAnswered(r)).length;

/** "Best 7 of 8 · last 6 of 8 (14 min 32 s)" for the start screen. */
export function attemptsSummary(attempts: readonly ExamAttempt[] | undefined): { count: number; best?: ExamAttempt; last?: ExamAttempt } {
  const list = attempts ?? [];
  if (list.length === 0) return { count: 0 };
  const best = list.reduce((b, a) => (a.score / Math.max(1, a.total) > b.score / Math.max(1, b.total) ? a : b));
  return { count: list.length, best, last: list[list.length - 1] };
}
