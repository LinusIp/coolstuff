import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'projects/*/src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
