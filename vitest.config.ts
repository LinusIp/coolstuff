import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = import.meta.dirname;

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  resolve: {
    alias: { '@kit': join(root, 'src/kit'), '@content': join(root, 'src/content') },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'lessons/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
