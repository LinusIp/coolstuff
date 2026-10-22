/** The lessons/<subject>/<slug>/meta.json contract, shared by build-index, new-lesson and smoke. */

export type Level = 'intro' | 'core' | 'advanced';
export type Status = 'shipped' | 'wip';

export interface LessonMeta {
  title: string;
  subject: string;
  unit: string;
  order: number;
  prerequisites: string[];
  minutes: number;
  level: Level;
  status: Status;
  /** One-sentence takeaway, shown on cards and in search. */
  summary?: string;
  /** Key formulas, indexed by site search. */
  formulas?: { label: string; tex: string }[];
  /** Terms this lesson defines, indexed by search and used by Glossary links. */
  glossary?: { term: string; definition: string }[];
}

/** Returns a list of problems; empty means the meta is valid. */
export function validateMeta(m: unknown): string[] {
  const errors: string[] = [];
  if (typeof m !== 'object' || m === null) return ['meta.json is not an object'];
  const o = m as Record<string, unknown>;
  const str = (k: string) => {
    if (typeof o[k] !== 'string' || (o[k] as string).trim() === '') errors.push(`"${k}" must be a non-empty string`);
  };
  str('title');
  str('subject');
  str('unit');
  if (!Array.isArray(o.prerequisites) || !o.prerequisites.every((x) => typeof x === 'string')) {
    errors.push('"prerequisites" must be an array of lesson ids');
  }
  if (!Number.isInteger(o.order) || (o.order as number) < 1) errors.push('"order" must be a positive integer');
  if (typeof o.minutes !== 'number' || o.minutes < 5 || o.minutes > 90) errors.push('"minutes" must be a number of minutes (5–90)');
  if (!['intro', 'core', 'advanced'].includes(o.level as string)) errors.push('"level" must be intro, core or advanced');
  if (o.status !== 'shipped' && o.status !== 'wip') errors.push('"status" must be "shipped" or "wip"');
  if (o.summary !== undefined && typeof o.summary !== 'string') errors.push('"summary" must be a string');
  const pairs = (k: string, a: string, b: string) => {
    const v = o[k];
    if (v === undefined) return;
    if (!Array.isArray(v) || !v.every((x) => x && typeof x[a] === 'string' && typeof x[b] === 'string')) {
      errors.push(`"${k}" must be an array of { ${a}, ${b} }`);
    }
  };
  pairs('formulas', 'label', 'tex');
  pairs('glossary', 'term', 'definition');
  return errors;
}
