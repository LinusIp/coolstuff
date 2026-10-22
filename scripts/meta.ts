/** The meta.json contract shared by build-index, new-project and smoke. */
export const CATEGORIES = [
  'game',
  'blog-design',
  'website',
  'ui-concept',
  'tool',
  'experiment',
  'ai',
  'audio',
  'explainer',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ProjectMeta {
  title: string;
  tagline: string;
  category: Category;
  tags: string[];
  tech: string[];
  date: string;
  status: 'shipped' | 'wip';
  mobile: boolean;
  // Explainers only (CLAUDE.md §4, §8):
  subject?: string;
  unit?: string;
  order?: number;
  prerequisites?: string[];
  minutes?: number;
  level?: 'intro' | 'core' | 'advanced';
}

/** Returns a list of problems; empty means the meta is valid. */
export function validateMeta(m: unknown): string[] {
  const errors: string[] = [];
  if (typeof m !== 'object' || m === null) return ['meta.json is not an object'];
  const o = m as Record<string, unknown>;
  const str = (k: string) => {
    if (typeof o[k] !== 'string' || (o[k] as string).trim() === '') errors.push(`"${k}" must be a non-empty string`);
  };
  const strArr = (k: string) => {
    if (!Array.isArray(o[k]) || !(o[k] as unknown[]).every((x) => typeof x === 'string')) {
      errors.push(`"${k}" must be an array of strings`);
    }
  };
  str('title');
  str('tagline');
  strArr('tags');
  strArr('tech');
  if (!CATEGORIES.includes(o.category as Category)) errors.push(`"category" must be one of ${CATEGORIES.join(', ')}`);
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) errors.push('"date" must be YYYY-MM-DD');
  if (o.status !== 'shipped' && o.status !== 'wip') errors.push('"status" must be "shipped" or "wip"');
  if (o.mobile !== true) errors.push('"mobile" must be true (every project works on phones)');
  if (o.category === 'explainer') {
    str('subject');
    str('unit');
    strArr('prerequisites');
    if (typeof o.order !== 'number' || o.order < 1) errors.push('"order" must be a positive number');
    if (typeof o.minutes !== 'number' || o.minutes < 1) errors.push('"minutes" must be a positive number');
    if (!['intro', 'core', 'advanced'].includes(o.level as string)) errors.push('"level" must be intro, core or advanced');
  }
  return errors;
}
