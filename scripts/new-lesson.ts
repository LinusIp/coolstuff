/**
 * Scaffolds a lesson from scripts/lesson-template/:
 *   npm run new -- <subject> <slug>        e.g. npm run new -- linalg svd
 * The lesson must exist in src/content/curriculum.ts; its title, unit, order
 * and prerequisites come from there. New lessons start as status "wip", which
 * the site shows as "coming soon".
 */
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { LESSON_BY_ID, SUBJECT_BY_ID } from '../src/content/curriculum.ts';

const root = join(import.meta.dirname, '..');
const template = join(root, 'scripts/lesson-template');
const [subject, slug] = process.argv.slice(2);

function fail(msg: string): never {
  console.error(`✗ ${msg}\n  usage: npm run new -- <subject> <slug>   (e.g. npm run new -- linalg svd)`);
  process.exit(1);
}

if (!subject || !SUBJECT_BY_ID.has(subject)) fail(`unknown subject "${subject ?? ''}"; one of ${[...SUBJECT_BY_ID.keys()].join(', ')}`);
const id = `${subject}/${slug ?? ''}`;
const lesson = LESSON_BY_ID.get(id);
if (!lesson) {
  const options = SUBJECT_BY_ID.get(subject)!.units.flatMap((u) => u.lessons.map((l) => l.slug));
  fail(`"${id}" is not in the curriculum; ${subject} lessons are: ${options.join(', ')}`);
}
if (!existsSync(template)) fail('scripts/lesson-template/ is missing');
const to = join(root, 'lessons', subject, lesson.slug);
if (existsSync(to)) fail(`lessons/${id} already exists`);

const vars: Record<string, string> = {
  id,
  subject,
  slug: lesson.slug,
  title: lesson.title,
  unit: lesson.unit,
  order: String(lesson.order),
  prerequisites: JSON.stringify(lesson.prerequisites),
  interactive: lesson.interactive ?? 'the central interactive',
  date: new Date().toISOString().slice(0, 10),
};
const TEXT = new Set(['.html', '.ts', '.tsx', '.css', '.json', '.md']);

cpSync(template, to, { recursive: true });
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
console.log(`✓ created lessons/${id} (${lesson.title})`);
console.log('  next: plan it in five lines at the top of NOTES.md, then write math.ts + problems.ts with tests');
