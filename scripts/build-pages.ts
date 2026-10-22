/**
 * Build only some pages into a private folder, so parallel work can't break or
 * clobber each other's builds:
 *   npx tsx scripts/build-pages.ts <outDir> kit/_dev/formula.html lessons/linalg/eigenvectors/index.html
 * The home page (index.html) is always included so smoke/preview have an entry.
 * Pages may be any .html file in the repo, including dev-only ones under kit/_dev/.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';

const root = join(import.meta.dirname, '..');
const [outDir, ...pages] = process.argv.slice(2);
if (!outDir || pages.length === 0) {
  console.error('usage: npx tsx scripts/build-pages.ts <outDir> <page.html> [more.html…]');
  process.exit(1);
}
const input: Record<string, string> = { index: join(root, 'index.html') };
for (const p of pages) {
  const abs = resolve(root, p);
  if (!existsSync(abs)) {
    console.error(`✗ ${p} does not exist`);
    process.exit(1);
  }
  input[p.replace(/\.html$/, '')] = abs;
}
await build({
  root,
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'warn',
  build: { outDir: resolve(outDir), emptyOutDir: true, rollupOptions: { input } },
});
console.log(`✓ built ${pages.length + 1} page(s) → ${resolve(outDir)}`);
