/**
 * Eigenvectors and eigenvalues: the lesson's content as data (types.ts `LessonContent`), pure so
 * lesson.test.ts audits it in Node and the subject practice pages can import
 * it. Copy the patterns in src/kit/gallery/samples.ts; the API is in
 * src/kit/README.md.
 *
 * wip skeleton: everything below is a stub. lesson.test.ts skips the audits
 * while PROBLEMS is empty and runs all of them from the first problem on.
 */
import type { Vec2 } from '@kit/math';
import { defineConcepts, type DerivationSpec, type FormulaSpec, type GlossaryTerm, type PredictSpec, type ProblemSpec, type QuizSpec, type Reference, type TldrSpec, type TrapSpec, type WorkedExampleSpec } from '@kit/pure';
import { describeDirectionGuess, GUESS_TOL, HOOK_A, judgeDirections } from './math';

/** 3–5 concepts: one ink and one line style each, the same in figure, formula, prose and code (DESIGN.md §4). */
export const C = defineConcepts({
  input: { hue: 'input', label: 'input vector', symbol: '\\vec v' },
  output: { hue: 'output', label: 'its image', symbol: 'A\\vec v' },
  matrix: { hue: 'teal', label: 'the matrix', symbol: 'A' },
  eigenvalue: { hue: 'rose', label: 'stretch factor', symbol: '\\lambda' },
});

/** The printable revision card: exactly three points and the key formula. */
export const TLDR: TldrSpec = {
  points: ['wip: the first thing to remember.', 'wip: the second.', 'wip: the third.'],
  formula: '\\cMatrix\\cInput = \\cEigenvalue\\cInput',
};

/** Key formulas, the Formalize definition first; every `\anchor{id}{…}` needs an explain note. */
export const FORMULAS: readonly FormulaSpec[] = [];

export const DERIVATIONS: readonly DerivationSpec[] = [];

/** ≥ 3: ★ direct, ★★ combined with an earlier lesson (`uses`), ★★★ exam level. */
export const EXAMPLES: readonly WorkedExampleSpec[] = [];

/** ≥ 8: 3 ★, 3 ★★, 2 ★★★, at least two answer kinds, three hints each, full solutions. */
export const PROBLEMS: readonly ProblemSpec[] = [];

/** 4–6 quick concept checks, with a `why` on every option. */
export const QUIZ: QuizSpec = [];

/** 2–4 common traps, each with a counterexample figure. */
export const TRAPS: readonly TrapSpec[] = [];

/** ≥ 2 real references (also in NOTES.md). */
export const REFERENCES: readonly Reference[] = [];

/** The Hook: guess A's two unturned directions by dragging, before anything shows them. */
export const PREDICTS: readonly PredictSpec[] = [
  {
    id: 'predict-directions',
    prompt:
      'This matrix $\\cMatrix$ sends $\\ihat$ to $(2, 1)$ and $\\jhat$ to $(1, 2)$: the grid shows what it does to the whole plane. Almost every arrow comes out pointing a new way, but **two directions don’t**. Drag the two arrows to where you think they are, then lock in.',
    guess: {
      kind: 'custom',
      check: (g) => Array.isArray(g) && judgeDirections(HOOK_A, g as Vec2[], GUESS_TOL).ok,
      describe: (g) => (Array.isArray(g) ? describeDirectionGuess(HOOK_A, g as Vec2[]) : ''),
    },
    reveal:
      'The two diagonals (the rose lines). Along $y = x$, $\\cMatrix$ stretches every arrow $\\times 3$; along $y = -x$ it leaves arrows exactly as they were, $\\times 1$. Look at the orange images of your arrows: off those two lines, every arrow is turned.',
    right: 'Within 10° on both. Symmetry is a good guide here: $\\cMatrix$ treats $x$ and $y$ alike, so the lines that swap $x$ and $y$ into each other are special.',
    wrong:
      'A tempting guess is the columns $(2, 1)$ and $(1, 2)$. But those are where $\\ihat$ and $\\jhat$ *land*, and look: $\\ihat$ had to turn to get there. The Play section below lets you hunt for the real ones.',
  },
];

export const GLOSSARY: readonly GlossaryTerm[] = [];

/** "Code it" sources: lesson.tsx passes them to CodeCell and lesson.test.ts runs them with runSnippet. */
export const SNIPPETS = {
  main: '// wip: the lesson\'s "Code it" snippet.\nconst xs = [1, 2, 3, 4];\nconst total = xs.reduce((a, b) => a + b, 0);\nconsole.log("total", total);\nemit("total", total);',
} as const;
