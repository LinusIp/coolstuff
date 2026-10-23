import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Import boundaries (CLAUDE.md §7, src/kit/PLAN.md §3).
const LESSON_BOUNDARY = [
  { group: ['../*', '../**'], message: 'Lessons never import from each other or from outside their own folder (keep a lesson flat); import shared code from @kit, @kit/pure or @kit/math.' },
  { group: ['**/src/kit/**', '**/lessons/**', '**/src/site/**'], message: 'Import the kit through @kit / @kit/pure / @kit/math, never by file path.' },
];
const NO_UI = [
  { group: ['preact', 'preact/*', '@preact/*', 'three', 'three/*'], message: 'Pure modules stay framework-free so they run in Node tests.' },
  { group: ['*.tsx', '**/*.tsx', './figures', './lesson'], message: 'Pure modules never import components (.tsx), figures.tsx or lesson.tsx.' },
];
const DOM_GLOBALS = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'matchMedia', 'requestAnimationFrame', 'Worker', 'HTMLElement'].map((name) => ({
  name,
  message: 'Pure modules are Node-safe: no DOM at import time or in logic.',
}));

export default tseslint.config(
  // projects/ only exists in old checkouts (the pre-pivot showcase lives on the archive/lab branch).
  { ignores: ['dist/**', 'node_modules/**', '**/public/**', 'smoke-report/**', 'projects/**', 'kit/_dev/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['scripts/**', 'vite.config.ts', 'vitest.config.ts', 'eslint.config.js', 'src/**/vite-*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  // Lessons never import from each other: no relative import may leave the lesson folder.
  {
    files: ['lessons/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: LESSON_BOUNDARY }] },
  },
  // A lesson's math.ts and problems.ts are pure: @kit/pure and @kit/math only, no components, no DOM.
  {
    files: ['lessons/**/math.ts', 'lessons/**/problems.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@kit', message: 'math.ts / problems.ts import @kit/pure (and @kit/math): the @kit barrel carries every component.' }],
          patterns: [...LESSON_BOUNDARY, { group: ['@kit/*', '!@kit/pure', '!@kit/math'], message: 'math.ts / problems.ts import only @kit/pure and @kit/math.' }, ...NO_UI],
        },
      ],
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
    },
  },
  // The kit's own pure modules (what @kit/pure and @kit/math re-export) follow the same rule.
  {
    files: [
      'src/kit/pure.ts',
      'src/kit/types.ts',
      'src/kit/structures/types.ts',
      'src/kit/core/{rng,expr,units,answers,codecheck,richtext,pretty,problems,lesson-audit,exam,slider-scale}.ts',
      'src/kit/math/**/*.ts',
    ],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: NO_UI }],
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
    },
  },
);
