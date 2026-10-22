/**
 * Validates every lessons/<subject>/<slug>/meta.json against the curriculum
 * and writes two generated files the site bundles:
 *   src/content/lessons.json       — every lesson folder's meta (shipped and wip)
 *   src/content/search-index.json  — lessons (all curriculum entries), formulas and glossary terms
 * Fails loudly on bad metadata so a typo can't silently hide or misplace a lesson.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LESSONS, LESSON_BY_ID, SUBJECT_BY_ID } from '../src/content/curriculum.ts';
import { validateMeta, type LessonMeta } from './meta.ts';

const root = join(import.meta.dirname, '..');
const lessonsDir = join(root, 'lessons');

export interface IndexedLesson extends LessonMeta {
  id: string;
  slug: string;
  hasThumb: boolean;
}

export interface SearchEntry {
  kind: 'lesson' | 'formula' | 'term';
  /** Lesson id the entry points to. */
  lesson: string;
  title: string;
  /** Subject title, for display. */
  subject: string;
  text: string;
  tex?: string;
  shipped: boolean;
}

const lessons: IndexedLesson[] = [];
let failed = false;
const fail = (id: string, msg: string) => {
  console.error(`✗ ${id}: ${msg}`);
  failed = true;
};

for (const subject of existsSync(lessonsDir) ? readdirSync(lessonsDir).sort() : []) {
  const subjectDir = join(lessonsDir, subject);
  if (!statSync(subjectDir).isDirectory()) continue;
  for (const slug of readdirSync(subjectDir).sort()) {
    const dir = join(subjectDir, slug);
    if (!existsSync(join(dir, 'index.html'))) continue;
    const id = `${subject}/${slug}`;
    const entry = LESSON_BY_ID.get(id);
    if (!entry) {
      fail(id, 'not in src/content/curriculum.ts (lesson folders must match a curriculum entry)');
      continue;
    }
    let meta: LessonMeta;
    try {
      meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as LessonMeta;
    } catch (err) {
      fail(id, `meta.json missing or invalid JSON (${(err as Error).message})`);
      continue;
    }
    const errors = validateMeta(meta);
    for (const e of errors) fail(id, e);
    if (errors.length) continue;
    if (meta.subject !== subject) fail(id, `meta.subject "${meta.subject}" doesn't match folder "${subject}"`);
    if (meta.unit !== entry.unit) fail(id, `meta.unit "${meta.unit}" doesn't match curriculum unit "${entry.unit}"`);
    if (meta.order !== entry.order) fail(id, `meta.order ${meta.order} doesn't match curriculum order ${entry.order}`);
    for (const p of meta.prerequisites) if (!LESSON_BY_ID.has(p)) fail(id, `prerequisite "${p}" is not in the curriculum`);
    const missing = entry.prerequisites.filter((p) => !meta.prerequisites.includes(p));
    if (missing.length) console.warn(`! ${id}: curriculum also lists prerequisites ${missing.join(', ')}`);
    lessons.push({ ...meta, id, slug, hasThumb: existsSync(join(dir, 'thumb.webp')) });
  }
}

if (failed) process.exit(1);

const byId = new Map(lessons.map((l) => [l.id, l]));
const search: SearchEntry[] = [];
for (const l of LESSONS) {
  const meta = byId.get(l.id);
  const shipped = meta?.status === 'shipped';
  const subject = SUBJECT_BY_ID.get(l.subject)!.title;
  search.push({
    kind: 'lesson',
    lesson: l.id,
    title: meta?.title ?? l.title,
    subject,
    text: [l.unit, meta?.summary ?? '', l.interactive ?? ''].join(' · '),
    shipped,
  });
  if (!shipped || !meta) continue;
  for (const f of meta.formulas ?? []) search.push({ kind: 'formula', lesson: l.id, title: f.label, subject, text: meta.title, tex: f.tex, shipped });
  for (const g of meta.glossary ?? []) search.push({ kind: 'term', lesson: l.id, title: g.term, subject, text: g.definition, shipped });
}

writeFileSync(join(root, 'src/content/lessons.json'), JSON.stringify(lessons, null, 2) + '\n');
writeFileSync(join(root, 'src/content/search-index.json'), JSON.stringify(search) + '\n');
const shipped = lessons.filter((l) => l.status === 'shipped').length;
console.log(`indexed ${lessons.length} lesson folder(s), ${shipped} shipped; search index has ${search.length} entries`);
