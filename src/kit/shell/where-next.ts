/**
 * "Where this goes next" as data (pure, tested): the lessons a lesson builds
 * on and the ones that build on it, from curriculum.ts (dependents = lessons
 * that list this one as a prerequisite), with shipped status and summaries
 * from lessons.json; and references formatted per DESIGN.md §8.
 */
import type { Reference } from '../types';

export interface CurriculumLike {
  id: string;
  subject: string;
  order: number;
  title: string;
  prerequisites: readonly string[];
}

export interface IndexedLike {
  id: string;
  status: 'shipped' | 'wip';
  title?: string;
  summary?: string;
}

export interface LessonCardData {
  id: string;
  title: string;
  /** "Linear algebra · 13" */
  kicker: string;
  summary?: string;
  shipped: boolean;
  /** Relative link from a lesson page (only for shipped lessons). */
  href?: string;
}

export interface WhereNextData {
  buildsOn: LessonCardData[];
  unlocks: LessonCardData[];
}

export function whereNext(
  lessonId: string,
  lessons: readonly CurriculumLike[],
  subjects: ReadonlyMap<string, { title: string }>,
  index: readonly IndexedLike[],
  opts: { extraBuildsOn?: readonly string[]; extraUnlocks?: readonly string[] } = {},
): WhereNextData {
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const meta = new Map(index.map((m) => [m.id, m]));
  const me = byId.get(lessonId);
  const card = (id: string): LessonCardData | null => {
    const l = byId.get(id);
    if (!l) return null;
    const m = meta.get(id);
    const shipped = m?.status === 'shipped';
    return {
      id,
      title: m?.title ?? l.title,
      kicker: `${subjects.get(l.subject)?.title ?? l.subject} · ${l.order}`,
      summary: m?.summary,
      shipped,
      href: shipped ? `../../${id}/` : undefined,
    };
  };
  const uniq = (ids: readonly string[]) => [...new Set(ids)].filter((id) => id !== lessonId);
  const buildsOn = uniq([...(me?.prerequisites ?? []), ...(opts.extraBuildsOn ?? [])]);
  const unlocks = uniq([...lessons.filter((l) => l.prerequisites.includes(lessonId)).map((l) => l.id), ...(opts.extraUnlocks ?? [])]);
  return {
    buildsOn: buildsOn.map(card).filter((c): c is LessonCardData => !!c),
    unlocks: unlocks.map(card).filter((c): c is LessonCardData => !!c),
  };
}

/** One reference, split into the parts DESIGN.md §8 styles: small-caps authors, italic title, then the rest. */
export interface ReferenceParts {
  authors: string;
  title: string;
  /** Edition, venue, publisher, year, section, in that order, joined by commas. */
  rest: string;
  url?: string;
  note?: string;
}

export function referenceParts(r: Reference): ReferenceParts {
  const rest = [r.edition, r.venue, r.publisher, r.year !== undefined ? String(r.year) : undefined, r.section].filter((x): x is string => !!x && x.trim() !== '');
  return { authors: r.authors.trim(), title: r.title.trim(), rest: rest.join(', '), url: r.url, note: r.note };
}

/** Plain text of a reference ("Strang, G. Introduction to Linear Algebra. 6th ed., Wellesley-Cambridge Press, 2023, §6.1."). */
export function referenceText(r: Reference): string {
  const p = referenceParts(r);
  const end = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);
  return [end(p.authors), end(p.title), p.rest ? end(p.rest) : '', p.url ?? ''].filter(Boolean).join(' ');
}
