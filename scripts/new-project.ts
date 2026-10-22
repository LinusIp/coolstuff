/**
 * Scaffolds a project from its category template:
 *   npm run new -- <category> <slug> ["Display Title"]
 * The copy starts as status "wip", so it stays hidden from the showcase until shipped.
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { LESSON_BY_SLUG } from '../src/learn/curriculum.ts';
import { CATEGORIES, type Category } from './meta.ts';

const root = join(import.meta.dirname, '..');
const [category, slug, ...titleWords] = process.argv.slice(2);

function fail(msg: string): never {
  console.error(`✗ ${msg}\n  usage: npm run new -- <${CATEGORIES.join('|')}> <slug> ["Title"]`);
  process.exit(1);
}

if (!CATEGORIES.includes(category as Category)) fail(`unknown category "${category ?? ''}"`);
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail('slug must be kebab-case, e.g. "orbit-golf"');

const from = join(root, 'templates', category);
const to = join(root, 'projects', slug);
if (existsSync(to)) fail(`projects/${slug} already exists`);

// Explainers take their title, unit, order and prerequisites from the curriculum.
const lesson = category === 'explainer' ? LESSON_BY_SLUG.get(slug) : undefined;
if (category === 'explainer' && !lesson) {
  fail(`"${slug}" is not in src/learn/curriculum.ts; explainer slugs look like learn-<subject>-<topic>`);
}

const title =
  titleWords.join(' ') || lesson?.title || slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
const vars: Record<string, string> = {
  slug,
  title,
  date: new Date().toISOString().slice(0, 10),
  subject: lesson?.subject ?? '',
  unit: lesson?.unit ?? '',
  order: String(lesson?.order ?? 1),
  prerequisites: JSON.stringify(lesson?.prerequisites ?? []),
};
const TEXT = new Set(['.html', '.ts', '.css', '.json', '.md', '.js', '.webmanifest', '.svg', '.txt']);

cpSync(from, to, { recursive: true });

function fill(dir: string): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) fill(p);
    else if (TEXT.has(extname(p))) {
      writeFileSync(p, readFileSync(p, 'utf8').replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m));
    }
  }
}
fill(to);

console.log(`✓ created projects/${slug} from templates/${category}`);
console.log('  next: fill the five lines at the top of NOTES.md, then `npm run dev`');
