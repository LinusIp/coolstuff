/**
 * The PURE entry: everything a lesson's `problems.ts` and `math.ts` may import.
 *
 *   import { defineConcepts, defineExample, generator, polyTex, type ProblemSpec } from '@kit/pure';
 *   import { eig2, linspace } from '@kit/math';
 *
 * Node-safe by construction: the design-system constants, notation, the data
 * contracts, and the pure foundations (answers, expressions, units, pretty
 * TeX, problems and audits, exam drawing, code running, rich text, rng,
 * slider scales). No Preact, no DOM, no Worker, so lesson tests never break
 * when a component module touches `document` at load time. ESLint forbids
 * `@kit` (the full barrel) and `.tsx` imports in lessons' math.ts/problems.ts.
 */
export * from './theme';
export * from './notation';
export * from './types';
export * from './structures/types';
export * from './core/rng';
export * from './core/expr';
export * from './core/units';
export * from './core/answers';
export * from './core/codecheck';
export * from './core/richtext';
export * from './core/pretty';
export * from './core/problems';
export * from './core/lesson-audit';
export * from './core/exam';
export * from './core/slider-scale';
