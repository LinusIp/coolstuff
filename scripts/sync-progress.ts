/**
 * Regenerates the curriculum checklist in PROGRESS.md from
 * src/content/curriculum.ts and src/content/lessons.json (run build-index first;
 * `npm run progress:sync` does both). Text outside the markers is preserved.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUBJECTS } from '../src/content/curriculum.ts';

const root = join(import.meta.dirname, '..');
const file = join(root, 'PROGRESS.md');
const START = '<!-- progress:start -->';
const END = '<!-- progress:end -->';

const lessons = JSON.parse(readFileSync(join(root, 'src/content/lessons.json'), 'utf8')) as { id: string; status: string }[];
const status = new Map(lessons.map((l) => [l.id, l.status]));

const total = SUBJECTS.reduce((n, s) => n + s.units.reduce((m, u) => m + u.lessons.length, 0), 0);
const shippedTotal = lessons.filter((l) => l.status === 'shipped').length;
const out = [START, `**${shippedTotal} of ${total} lessons shipped.** \`[x]\` shipped · \`[ ] … [in progress]\` being built (status "wip")`, ''];
for (const s of SUBJECTS) {
  const all = s.units.flatMap((u) => u.lessons);
  const done = all.filter((l) => status.get(l.id) === 'shipped').length;
  out.push(`## ${s.title}${s.later ? ' (later expansion)' : ''} — ${done}/${all.length}`, '');
  for (const u of s.units) {
    out.push(`**${u.title}**`, '');
    for (const l of u.lessons) {
      const st = status.get(l.id);
      const box = st === 'shipped' ? 'x' : ' ';
      const tag = st === 'wip' ? ' **[in progress]**' : '';
      const hint = l.interactive ? ` — _${l.interactive}_` : '';
      out.push(`- [${box}] ${l.order}. ${l.title}${hint} \`${l.id}\`${tag}`);
    }
    out.push('');
  }
}
out.push(END);

const header = `# Progress

The full curriculum (CLAUDE.md §9) and the status of every lesson. The checklist below is generated from
\`src/content/curriculum.ts\` and each lesson's \`meta.json\`: run \`npm run progress:sync\` after shipping.

`;
const current = existsSync(file) ? readFileSync(file, 'utf8') : header + START + '\n' + END + '\n';
const a = current.indexOf(START);
const b = current.indexOf(END);
const next = a >= 0 && b >= 0 ? current.slice(0, a) + out.join('\n') + current.slice(b + END.length) : header + out.join('\n') + '\n';
writeFileSync(file, next);
console.log(`✓ PROGRESS.md: ${shippedTotal}/${total} shipped`);
