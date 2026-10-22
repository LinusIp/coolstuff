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
  return errors;
}
