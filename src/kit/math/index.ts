/**
 * Pure maths for visuals, lessons and tests: `import { eig2, linspace } from '@kit/math'`.
 *
 * Conventions
 * - Vectors are plain tuples: `Vec2 = [x, y]`, `Vec3 = [x, y, z]`.
 * - Matrices are row-major flat tuples: `Mat2 = [a, b, c, d]` is | a b ; c d |,
 *   so its columns (the images of î and ĵ) are (a, c) and (b, d).
 * - Every function returns new values; nothing is mutated in place.
 * - No DOM, no globals: everything is unit-tested in math.test.ts / layout.test.ts.
 *
 * Not re-exported from the root `@kit` barrel (names like `add`, `scale` and
 * `range` are too generic for a page-wide namespace).
 */
export * from './scalar';
export * from './vec';
export * from './mat';
export * from './camera';
export * from './calculus';
export * from './analysis';
export * from './contour';
export * from './axes';
export * from './stats';
export * from './layout';
export * from './eig3';
