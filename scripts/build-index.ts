/**
 * Collects every projects/<slug>/meta.json into src/showcase/projects.json,
 * which the showcase bundles. Fails loudly on invalid metadata so a typo can't
 * silently hide a project.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateMeta, type ProjectMeta } from './meta.ts';

const root = join(import.meta.dirname, '..');
const projectsDir = join(root, 'projects');
const outFile = join(root, 'src/showcase/projects.json');

export interface IndexedProject extends ProjectMeta {
  slug: string;
  hasThumb: boolean;
}

const projects: IndexedProject[] = [];
let failed = false;

for (const slug of existsSync(projectsDir) ? readdirSync(projectsDir).sort() : []) {
  const dir = join(projectsDir, slug);
  const metaPath = join(dir, 'meta.json');
  if (!existsSync(join(dir, 'index.html'))) continue;
  if (!existsSync(metaPath)) {
    console.error(`✗ ${slug}: missing meta.json`);
    failed = true;
    continue;
  }
  let meta: unknown;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch (err) {
    console.error(`✗ ${slug}: meta.json is not valid JSON (${(err as Error).message})`);
    failed = true;
    continue;
  }
  const errors = validateMeta(meta);
  if (errors.length) {
    for (const e of errors) console.error(`✗ ${slug}: ${e}`);
    failed = true;
    continue;
  }
  projects.push({ ...(meta as ProjectMeta), slug, hasThumb: existsSync(join(dir, 'thumb.webp')) });
}

if (failed) process.exit(1);

projects.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
writeFileSync(outFile, JSON.stringify(projects, null, 2) + '\n');
const shipped = projects.filter((p) => p.status === 'shipped').length;
console.log(`indexed ${projects.length} project(s), ${shipped} shipped → src/showcase/projects.json`);
