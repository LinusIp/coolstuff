/**
 * The derivative as slope and as rate: the lesson's content as data (types.ts `LessonContent`), pure so
 * lesson.test.ts audits it in Node and the subject practice pages can import
 * it. Copy the patterns in src/kit/gallery/samples.ts; the API is in
 * src/kit/README.md.
 *
 * wip skeleton: everything below is a stub. lesson.test.ts skips the audits
 * while PROBLEMS is empty and runs all of them from the first problem on.
 */
import { defineConcepts, type DerivationSpec, type FormulaSpec, type GlossaryTerm, type PredictSpec, type ProblemSpec, type QuizSpec, type Reference, type TldrSpec, type TrapSpec, type WorkedExampleSpec } from '@kit/pure';

/** 3–5 concepts: one ink and one line style each, the same in figure, formula, prose and code (DESIGN.md §4). */
export const C = defineConcepts({
  input: { hue: 'input', label: 'input', symbol: 'x' },
  output: { hue: 'output', label: 'output', symbol: 'y' },
  // wip: name this lesson's own concepts on the free inks: teal, rose, gold.
});

/** The printable revision card: exactly three points and the key formula. */
export const TLDR: TldrSpec = {
  points: ['wip: the first thing to remember.', 'wip: the second.', 'wip: the third.'],
  formula: '\\cOutput = f(\\cInput)',
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

export const PREDICTS: readonly PredictSpec[] = [];

export const GLOSSARY: readonly GlossaryTerm[] = [];

/** "Code it" sources: lesson.tsx passes them to CodeCell and lesson.test.ts runs them with runSnippet. */
export const SNIPPETS = {
  main: '// wip: the lesson\'s "Code it" snippet.\nconst xs = [1, 2, 3, 4];\nconst total = xs.reduce((a, b) => a + b, 0);\nconsole.log("total", total);\nemit("total", total);',
} as const;
