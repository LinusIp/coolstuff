/**
 * coolstuff kit — shared data contracts.
 *
 * Framework-agnostic: no Preact, no DOM, no runtime imports beyond pure
 * constants. A lesson's `problems.ts` and `math.ts` import these through the
 * pure entry `@kit/pure` (never the `@kit` barrel, which carries every
 * component), so every worked example, problem, solution and generator runs
 * in Node under vitest (CLAUDE.md §10). ESLint enforces the boundary.
 *
 * FROZEN after the kit-architecture handoff. Owning groups may make
 * *additive, optional* changes to their own section (marked "owner"), and must
 * log them in PLAN.md's change log. Component prop types live next to each
 * component, not here.
 */
import type { ConceptHue, ConceptSet, ConceptSpec } from './theme';
import type { Vec2 } from './math/vec';
import type { TreeNode } from './math/layout';

export type { Vec2, TreeNode };
export type { LessonMeta, Level, Status } from '../../scripts/meta';

// ═════════════════════════════════════════════════════════════════════════
// 1. Text
// ═════════════════════════════════════════════════════════════════════════

/**
 * Rich text: a plain string with inline TeX and minimal markdown, rendered by
 * `<RichText>` / `richToHtml()` (README §RichText):
 *
 *   $inline TeX$   $$display TeX$$   **bold**   *italic*   `code`
 *   [link text](url)   [term text]{concept}   [[glossary-term]] / [[term|shown text]]
 *   blank line = new paragraph · lines starting "- " or "1. " = list items · \$ = literal dollar
 *
 * Concept shorthands (\cMatrix …) and NOTATION.md macros work inside TeX.
 */
export type Rich = string;

// ═════════════════════════════════════════════════════════════════════════
// 2. Concepts (see theme.ts / DESIGN.md §4)
// ═════════════════════════════════════════════════════════════════════════

/** A lesson's 3–5 named concept colours, as passed to `defineConcepts()`. */
export type ConceptMap<N extends string = string> = Record<N, ConceptSpec | ConceptHue>;

/** Global meanings available on every page without defining them. */
export type GlobalConcept = 'input' | 'output' | 'error' | 'prob' | 'correct';

/** A concept reference: a lesson concept name or a global meaning. */
export type ConceptRef = string;

// ═════════════════════════════════════════════════════════════════════════
// 3. Lesson structure (CLAUDE.md §4; scripts/smoke.ts checks these ids)
// ═════════════════════════════════════════════════════════════════════════

/** The §4 lesson arc, in order, as `data-section` values. */
export const LESSON_SECTION_IDS = [
  'tldr',
  'hook',
  'play',
  'build',
  'formalize',
  'examples',
  'code',
  'traps',
  'practice',
  'quickcheck',
  'next',
] as const;
export type LessonSectionId = (typeof LESSON_SECTION_IDS)[number];

/** Default kicker (small-caps running head) per section; a lesson may override. */
export const SECTION_KICKERS: Readonly<Record<LessonSectionId, string>> = {
  tldr: 'In brief',
  hook: 'A question',
  play: 'Play',
  build: 'Build the idea',
  formalize: 'Make it precise',
  examples: 'Worked examples',
  code: 'Code it',
  traps: 'Common traps',
  practice: 'Practice',
  quickcheck: 'Quick check',
  next: 'Where next',
};

/** Subjects whose lessons must have a `code` section (mirrors scripts/smoke.ts). */
export const CODE_SUBJECTS: ReadonlySet<string> = new Set(['dsa', 'sysdesign', 'systems', 'ml', 'dl', 'diffusion', 'llm']);

/** The printable revision card (§4.1). */
export interface TldrSpec {
  /** Exactly three points. */
  points: readonly [Rich, Rich, Rich];
  /** The key formula, TeX (concept shorthands allowed). */
  formula: string;
  /** Symbol key beside the formula: `{ tex: '\\cMatrix', text: 'the matrix' }`. */
  key?: readonly { tex: string; text: Rich }[];
}

/** A real reference (§4.11, §10: at least two per lesson). */
export interface Reference {
  /** "Strang, G." or "Ho, J., Jain, A. and Abbeel, P." */
  authors: string;
  title: string;
  kind?: 'book' | 'paper' | 'notes' | 'video' | 'web';
  edition?: string;
  publisher?: string;
  /** Journal or conference for papers, e.g. "NeurIPS". */
  venue?: string;
  year?: number;
  /** "§6.1", "ch. 5", "pp. 12–19". */
  section?: string;
  /** Shown as text only: no runtime network calls, so references are never fetched. */
  url?: string;
  note?: Rich;
}

/**
 * One common trap (§4.8): the myth, what's actually true, and a visual
 * counterexample. Every trap has its counterexample figure (`auditTraps`
 * enforces it): `Trap` renders `figures[figure]` (or its `figure` prop) in a
 * `figure[data-figure="trap-<id>"]` with this caption and description.
 */
export interface TrapSpec {
  id: string;
  /** The misconception, in the student's words: "Every matrix has eigenvectors". */
  myth: Rich;
  explanation: Rich;
  truth: Rich;
  /** Figure key the lesson renders beside it (a small counterexample plate; see the figures.tsx convention). */
  figure: string;
  /** Caption under the counterexample figure. */
  figureCaption: Rich;
  /** Plain-text description of the figure for screen readers. */
  figureDescription: string;
}

/** A glossary term the lesson defines (meta.json `glossary`, and the Glossary component). */
export interface GlossaryTerm {
  term: string;
  /** Rich: TeX allowed (build-index strips it with richToPlain for search). */
  definition: Rich;
}

// ═════════════════════════════════════════════════════════════════════════
// 4. Formulas (owner: G1 — additive optional changes only)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Explain-this note for one tagged symbol. The symbol is tagged in TeX with
 * `\anchor{id}{…}`; the map key is that id.
 */
export interface ExplainNote {
  /** Bold concept word, in the concept's ink: "the matrix". */
  word: Rich;
  /** Plain-words gloss: "a rule that moves every vector". */
  gloss: Rich;
  /** Concept whose ink the note wears (defaults to the concept class found inside the anchor). */
  concept?: ConceptRef;
}
export type ExplainMap = Readonly<Record<string, ExplainNote>>;

/** A bracket above a group of symbols ("where A sends v"): spans the anchor `anchor`. */
export interface FormulaBracket {
  anchor: string;
  text: Rich;
  concept?: ConceptRef;
}

/** One derivation step: relation in the gutter, maths, one-line justification. */
export interface DerivationStep {
  /** Relation shown in the gutter, TeX: '', '=', '\\Leftrightarrow', '\\Rightarrow'. */
  rel?: string;
  /** The step, TeX. Wrap what changed in `\chg{…}`. */
  tex: string;
  /** "multiply both sides by dx". */
  why: Rich;
}

/**
 * A key formula as data, so it lives in problems.ts and is audited in Node
 * (TeX valid, every `\anchor{id}` explained, concept names real). Render it
 * with `<Formula {...spec} live={…} />`; live values are wired in lesson.tsx.
 *
 * Repeated anchors: an id may tag several occurrences (`\anchor{v}{…}` on
 * both sides of A v = λ v). The FIRST occurrence carries the explain note and
 * leader; every occurrence lights on hover.
 */
export interface FormulaSpec {
  /** Unique within the lesson ("eigen-definition"); also the Formula's DOM id. */
  id: string;
  /** TeX with `\anchor{id}{…}` tags and concept shorthands. */
  tex: string;
  /** Bar label: "Definition", "Key formula". */
  label?: string;
  size?: 'display' | 'key' | 'hero';
  /** One note per anchor id (required for key formulas: §11 "explain this"). */
  explain: ExplainMap;
  brackets?: readonly FormulaBracket[];
  /** The *In words* sentence. */
  inWords?: Rich;
}

/** A derivation as data (for `<Derivation steps={spec.steps} />`), audited like everything else. */
export interface DerivationSpec {
  id: string;
  label?: string;
  /** At least two steps. Symbols tagged with the same `\anchor` id in consecutive steps slide (FLIP), paired in order of occurrence. */
  steps: readonly DerivationStep[];
}

// ═════════════════════════════════════════════════════════════════════════
// 5. Worked examples (§5; owner: G3 — additive optional changes only)
// ═════════════════════════════════════════════════════════════════════════

/** Values of a worked example's live parameters, by name (a choice parameter's value is its option index). */
export type ParamValues = Record<string, number>;

/** A value that is either fixed or recomputed from live parameters. */
export type Live<T, P extends ParamValues = ParamValues> = T | ((p: P) => T);

/** A numeric live parameter: shown as a slider above the example; steps and answer recompute. */
export interface LiveParam {
  kind?: 'number';
  label: Rich;
  min: number;
  max: number;
  step: number;
  /** Starting value (the one the authored text describes). */
  value: number;
  concept?: ConceptRef;
  unit?: string;
  /** Values the slider snaps to. */
  detents?: readonly number[];
  /** 'log' for values spanning decades (a learning rate from 0.001 to 1.5); needs min > 0. Default 'linear'. */
  scale?: 'linear' | 'log';
}

/** A choice live parameter: a segmented control (pick f from a list, pick a method). Its value is the option index. */
export interface ChoiceParam {
  kind: 'choice';
  label: Rich;
  /** Option labels, shown in the control. */
  options: readonly Rich[];
  /** Starting option index. */
  value: number;
  concept?: ConceptRef;
}

export type ExampleParam = LiveParam | ChoiceParam;

/** One solution step (worked examples and problem solutions share it). */
export interface StepSpec {
  /** Short sans step title: "The characteristic polynomial". */
  title?: Rich;
  /** TeX rendered as a relation chain (NOTATION.md §8): one chain per step. */
  math?: string;
  /** Prose for the step, when maths alone isn't the point. */
  text?: Rich;
  /** Justification, always: "by the chain rule", "2×2 determinant: ad − bc". */
  why: Rich;
  /**
   * Prompt for the "try the next step yourself" pause shown before this step.
   * Required on every worked-example step after the first (auditExamples); unused in problem solutions.
   */
  tryIt?: Rich;
}

export type ExampleLevel = 'direct' | 'combined' | 'exam';

export interface WorkedExampleSpec<P extends ParamValues = ParamValues> {
  id: string;
  /** ★ direct application · ★★ combined with an earlier concept · ★★★ exam level. */
  level: ExampleLevel;
  title?: string;
  statement: Live<Rich, P>;
  /** "What do we know" (one sentence or a short list). */
  known: Live<Rich | readonly Rich[], P>;
  /** "What do we want". */
  want: Live<Rich | readonly Rich[], P>;
  /** Strategy in one sentence. */
  strategy: Live<Rich, P>;
  /** Steps, revealed one at a time with a pause before each after the first. */
  steps: Live<readonly StepSpec[], P>;
  /** The boxed final answer. */
  answer: Live<Rich, P>;
  /** Machine-checkable final answer, so tests can compare it with an independent computation. */
  value?: Live<number | readonly number[], P>;
  /** Units, limiting cases, does the picture agree? */
  sanity: Live<Rich, P>;
  /** Live parameters: change the numbers and everything above recomputes. */
  params?: { readonly [K in keyof P]: ExampleParam };
  /**
   * Guard on parameter combinations (complex eigenvalues, divergence, h = 0):
   * return true, or a learner-facing reason. WorkedExample keeps the last
   * accepted values and shows the reason by the control that caused it;
   * `paramSamples` skips rejected points; the audit requires the defaults to pass.
   */
  accept?: (p: P) => true | string;
  /** Lesson ids this example combines with (for "combined" examples); audited against curriculum.ts. */
  uses?: readonly string[];
  /** Figure key the lesson renders with the example (receives the live params). */
  figure?: string;
}

/** A worked example with every `Live` field resolved for one set of parameter values. */
export interface ResolvedExample {
  id: string;
  level: ExampleLevel;
  title?: string;
  statement: Rich;
  known: readonly Rich[];
  want: readonly Rich[];
  strategy: Rich;
  steps: readonly StepSpec[];
  answer: Rich;
  value?: number | readonly number[];
  sanity: Rich;
  params: ParamValues;
  figure?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// 6. Problems (§5; owner: G3 — additive optional changes only)
// ═════════════════════════════════════════════════════════════════════════

/** ★ warm-up · ★★ standard · ★★★ exam-level / challenge. */
export type Difficulty = 1 | 2 | 3;

/**
 * How precisely a numeric answer must be given, stated to the learner
 * ("to 2 decimal places"). Accepts ±0.5 in the last stated digit unless
 * `tolerance` overrides. 'exact' accepts exact forms like 1/3 or sqrt(2)/2.
 */
export type Precision = { decimals: number } | { sig: number } | 'exact';

export interface NumericAnswer {
  kind: 'numeric';
  /** One number, or several (comma-separated input) for a vector / set of roots. */
  value: number | readonly number[];
  /** For several values: must they come in this order? Default true (a vector); false for a set of roots. */
  ordered?: boolean;
  precision: Precision;
  /** Absolute tolerance; overrides the precision-derived one. */
  tolerance?: number;
  /** Relative tolerance, used in addition to the absolute one. */
  relTolerance?: number;
  /** Canonical unit, e.g. 'm/s^2', 'kg*m^2', 'ohm' (README §Units). Physics answers set it. */
  unit?: string;
  /** Learner must type the unit (default true when `unit` is set; false shows it after the field). */
  askUnit?: boolean;
  /** Only this exact unit (no conversion between e.g. km/h and m/s). Default false. */
  strictUnit?: boolean;
  /** TeX shown before the field: '\\lambda_{\\max} ='. */
  label?: string;
  /**
   * How a list answer is compared (default 'exact', value by value):
   * - 'scalar-multiple': any nonzero multiple of `value` (eigenvectors, normal vectors, direction ratios);
   * - 'direction': any *positive* multiple (unit-free directions, "which way does it point").
   * Both scale learner and expected so the expected's largest entry is 1, then compare entries
   * with the precision's tolerance; the zero vector is always rejected with its own message.
   */
  equivalence?: 'exact' | 'scalar-multiple' | 'direction';
  /**
   * A matrix answer: Problem renders a rows × cols grid of fields and joins them
   * row-major ("a, b, c, d" for [[a, b], [c, d]]). `value` holds rows·cols entries, row-major.
   */
  shape?: readonly [rows: number, cols: number];
  /**
   * Complex numbers: each entry is typed as `a + bi` (also `a ± bi` for a conjugate pair, `j` for `i`);
   * `value` holds [re, im] pairs flattened: λ = 1 ± 2i is `[1, 2, 1, -2]` with `ordered: false`.
   * No units.
   */
  complex?: boolean;
  /**
   * A pure custom check on the parsed values (after unit conversion), replacing the comparison
   * with `value`: return true (right), false (wrong) or a learner-facing reason (wrong).
   * `value` is still the canonical answer that is shown and audited (`check(value)` must be true).
   * Keep it pure so lesson tests exercise it.
   */
  check?: (values: readonly number[]) => boolean | string;
}

/** A sampling interval for symbolic checking. */
export interface Domain {
  lo: number;
  hi: number;
  /** Sample integers only (sums, factorials, counting). */
  integer?: boolean;
  /** Points to stay away from (|x − p| > 1e-3), e.g. poles. */
  exclude?: readonly number[];
}

export interface SymbolicAnswer {
  kind: 'symbolic';
  /** The expected expression, in answer-input syntax (README §Expressions): '2x*cos(x^2)'. */
  expr: string;
  /** Variable names the answer may use: ['x'], ['t', 'omega'], ['v_0', 't']. */
  vars: readonly string[];
  /** Sampling domain, one for all variables or per variable. Default [-3, 3] avoiding 0. */
  domain?: Domain | Readonly<Record<string, Domain>>;
  /** Antiderivatives: accept answers that differ by a constant (the + C). */
  upToConstant?: boolean;
  /** Functions or symbols the answer must not use ('abs', 'sqrt'), e.g. to require a simplified form. */
  disallow?: readonly string[];
  /** TeX shown before the field: "f'(x) =". */
  label?: string;
}

export interface ChoiceOption {
  text: Rich;
  /** Why this option is right or wrong; shown when it's picked. */
  why?: Rich;
}

export interface ChoiceAnswer {
  kind: 'choice';
  options: readonly (Rich | ChoiceOption)[];
  /** Index of the right option, or indices when several must be selected. */
  correct: number | readonly number[];
  /** Shuffle the options (seeded per problem, so it's stable across reloads). Default false. */
  shuffle?: boolean;
  /** Ask the learner for a one-line reason before checking ("multiple choice with reasoning"). */
  askReason?: boolean;
  /** Model reasoning, shown after checking. */
  reasoning?: Rich;
}

/** A 2D view: world x and y ranges. */
export interface ViewBox {
  x: readonly [number, number];
  y: readonly [number, number];
}

/** Drag a point on a small Stage2D to the right place. */
export interface PointTarget {
  mode: 'point';
  view: ViewBox;
  start: Vec2;
  /** The right place, or several acceptable places. */
  answer: Vec2 | readonly Vec2[];
  /** World-units radius that counts as right. */
  tolerance: number;
  /** Snap the handle to multiples of this. */
  snap?: number;
  /** Keep the point on a curve y = f(x) (expression in x), or on a vertical/horizontal line. */
  constrain?: { curve: string } | { x: number } | { y: number };
  /** Curves drawn for context: expression in x, coloured by concept. */
  curves?: readonly { expr: string; concept?: ConceptRef; label?: string }[];
  /** Accessible name for the handle: "the point where the tangent is flat". */
  label: string;
}

/** Put items in order (trace-the-algorithm: BFS visit order, sorting passes). */
export interface OrderTarget {
  mode: 'order';
  items: readonly Rich[];
  /** Item indices in the right order. */
  correct: readonly number[];
}

/** Drag each item into a slot (label the diagram, match terms to definitions). */
export interface MatchTarget {
  mode: 'match';
  items: readonly Rich[];
  slots: readonly Rich[];
  /** correct[i] is the slot index for item i. */
  correct: readonly number[];
}

/** Drag a slider to the right value ("set h so the secant is within 0.01 of the tangent"). */
export interface SliderTarget {
  mode: 'slider';
  label: Rich;
  min: number;
  max: number;
  step: number;
  start: number;
  answer: number;
  tolerance: number;
  unit?: string;
}

/**
 * Anything else: the lesson renders the visual (ProblemSet's `customs[figure]`
 * or Problem's `custom` render prop, keyed by the problem's `figure`) and holds
 * the state; `check` decides. Keep `check` pure so it's tested. The problem
 * must set `figure` (auditProblems enforces it). A commonWrong `answer` for a
 * custom target is the JSON of a state.
 */
export interface CustomTarget {
  mode: 'custom';
  initial: unknown;
  check: (state: unknown) => boolean;
  /** Plain-words description of a state, for screen readers and the "you answered" line. */
  describe?: (state: unknown) => string;
}

export type DragTarget = PointTarget | OrderTarget | MatchTarget | SliderTarget | CustomTarget;

export interface DragAnswer {
  kind: 'drag';
  target: DragTarget;
}

/** Proof / explanation: self-checked against a model answer with a checklist. */
export interface ProofAnswer {
  kind: 'proof';
  modelAnswer: Rich;
  /** What a complete answer contains; the learner ticks each item. All ticked = solved. */
  checklist: readonly Rich[];
}

export interface CodeTest {
  name?: string;
  /** Arguments passed to the entry function. Must be JSON-serialisable (they cross into a Worker). */
  args: readonly unknown[];
  expect: unknown;
  /** 'deep' (default) · 'approx' (numbers within tolerance, recursively) · 'unordered' (arrays as multisets) · 'set'. */
  compare?: 'deep' | 'approx' | 'unordered' | 'set';
  tolerance?: number;
  /** Hidden tests run but don't show their arguments. */
  hidden?: boolean;
}

/** Write-the-code: JavaScript run against test cases in a sandboxed Worker. */
export interface CodeAnswer {
  kind: 'code';
  language: 'javascript';
  /** Name of the function the learner writes, e.g. 'binarySearch'. */
  entry: string;
  starter: string;
  /** Reference solution (tested in Node by the lesson's tests, never shown before "Show solution"). */
  solution: string;
  tests: readonly CodeTest[];
  /** Per-run time limit in ms. Default 2000. */
  timeoutMs?: number;
}

export type AnswerSpec = NumericAnswer | SymbolicAnswer | ChoiceAnswer | DragAnswer | ProofAnswer | CodeAnswer;
export type AnswerKind = AnswerSpec['kind'];

/** Hint 1 nudges, hint 2 gives the strategy, hint 3 the first step. Exactly three. */
export type Hints = readonly [nudge: Rich, strategy: Rich, firstStep: Rich];

export interface Solution {
  /** Written like a worked example: every step justified. */
  steps: readonly StepSpec[];
  /** Final answer, boxed. */
  answer: Rich;
  /** Optional sanity check. */
  check?: Rich;
}

/**
 * The most likely wrong answer and why it's wrong. `answer` is read in the
 * problem's answer kind: a number / number list (numeric, within the problem's
 * tolerance), an expression (symbolic, by equivalence), an option index
 * (choice), a JSON-ish state string (drag). Shown when the learner's answer
 * matches, and always listed under the full solution.
 */
export interface CommonWrong {
  answer: number | string | readonly number[];
  why: Rich;
}

/** Everything a learner sees for one problem instance. */
export interface ProblemBody {
  prompt: Rich;
  answer: AnswerSpec;
  hints: Hints;
  solution: Solution;
  /** At least one (auditProblems enforces it). */
  commonWrong: readonly CommonWrong[];
  /** Figure key the lesson renders with the problem. */
  figure?: string;
}

/**
 * A parameterised problem template for "another one". `params` draws raw
 * values, `accept` is the degeneracy guard (return false or a reason string
 * to reject: division by zero, 17-digit decimals, trivial instances), `build`
 * makes the full problem from accepted values. Use `generator()` from
 * `@kit/core/problems` so `P` is inferred.
 */
export interface ProblemGenerator<P = unknown> {
  params(rng: Rng): P;
  accept(p: P): boolean | string;
  build(p: P): ProblemBody;
  /** Rejection-sampling budget. Default 500; exceeding it is a bug the tests catch. */
  maxTries?: number;
}

export interface ProblemSpec extends ProblemBody {
  /** Stable within the lesson: it is the progress key. */
  id: string;
  difficulty: Difficulty;
  /** Short label for the set strip and practice pages: "Larger eigenvalue". */
  title?: string;
  tags?: readonly string[];
  /** Template for "another one". The authored body above is the first instance. */
  generate?: ProblemGenerator;
}

/** A problem as drawn for display: the authored instance (seed 0) or a generated one. */
export interface ProblemInstance extends ProblemBody {
  id: string;
  difficulty: Difficulty;
  title?: string;
  /** 0 = the authored instance. */
  seed: number;
  params?: unknown;
}

/** Why an answer was judged as it was. */
export type VerdictReason =
  | 'correct'
  | 'wrong'
  | 'empty'
  | 'unparseable'
  /** Right value, not precise enough ("give it to 2 decimal places"). */
  | 'precision'
  | 'unit-missing'
  /** The unit measures the wrong kind of thing (m/s for an acceleration). */
  | 'unit-dimension'
  /** Right dimension, but this problem wants a specific unit (strictUnit). */
  | 'unit-exact'
  /** Wrong number of values in a list answer. */
  | 'count'
  /** Uses a disallowed function or symbol. */
  | 'form'
  /** Not finished (proof checklist, unmatched items). */
  | 'incomplete';

export interface Verdict {
  correct: boolean;
  reason: VerdictReason;
  /** Short plain-text feedback for the learner ("Not 6.", "Right: 7.", "Check the unit: …"). */
  message: string;
  /** Index into `commonWrong` when the answer matched a known mistake. */
  commonWrong?: number;
  /** What the checker understood, as TeX (a live preview: "\\tfrac{1}{3}", "9.81\\,\\mathrm{m/s^2}"). */
  understood?: string;
}

// ═════════════════════════════════════════════════════════════════════════
// 7. Quick check and predict (owner: G3 — additive optional changes only)
// ═════════════════════════════════════════════════════════════════════════

export interface QuizOption {
  text: Rich;
  /** Required: the explanation shown when this option is picked (right or wrong). */
  why: Rich;
}

export type QuizQuestion =
  | {
      id: string;
      kind: 'choice';
      prompt: Rich;
      options: readonly QuizOption[];
      correct: number | readonly number[];
      /** Figure key rendered under the prompt (Quiz's `figures` map). */
      figure?: string;
    }
  | {
      id: string;
      kind: 'drag';
      prompt: Rich;
      target: OrderTarget | MatchTarget;
      /** Shown after a wrong arrangement. */
      whyWrong: Rich;
      /** Shown after a right one. */
      whyRight: Rich;
      figure?: string;
    };

/** 4–6 fast concept checks. */
export type QuizSpec = readonly QuizQuestion[];

export type PredictGuess =
  | { kind: 'choice'; options: readonly Rich[]; answer: number }
  | { kind: 'number'; label: Rich; min: number; max: number; step: number; answer: number; tolerance: number; unit?: string }
  /** The learner guesses on the lesson's own visual (Predict passes `setGuess` to its children); `check` judges. */
  | { kind: 'custom'; check: (guess: unknown) => boolean; describe?: (guess: unknown) => string };

/** "Make your guess": lock in an answer, then the visual reveals the truth. */
export interface PredictSpec {
  id: string;
  prompt: Rich;
  guess: PredictGuess;
  /** What actually happens and why (shown after locking in, right or wrong). */
  reveal: Rich;
  /** Extra line for a right guess. */
  right?: Rich;
  /** Extra line for a wrong guess: name the likely intuition and why it fails. */
  wrong?: Rich;
}

// ═════════════════════════════════════════════════════════════════════════
// 8. Algorithm traces (PlayScrub + data-structure views; owner: G5 for the state shapes)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Built-in highlight states for data-structure views. Anything else is read
 * as a lesson concept name (drawn in that concept's ink). Chrome states are
 * ink; `done`/`found` are the green "correct" state; `error` is red.
 */
export type MarkState = 'current' | 'compare' | 'visited' | 'frontier' | 'done' | 'found' | 'dim' | 'error';
export type Mark = MarkState | (string & {});

/**
 * One frame of an algorithm, produced by pure code in the lesson's math.ts
 * (testable: "Dijkstra matches brute force"), rendered by a view, scrubbed by
 * PlayScrub. `S` is the view's state shape (ArrayState, GraphState, …).
 */
export interface TraceFrame<S> {
  state: S;
  /** What just happened, one sentence: "Compare 7 with the pivot 4: move it left." */
  note?: Rich;
  /** 1-based line of the accompanying code to highlight. */
  line?: number;
}
export type Trace<S> = readonly TraceFrame<S>[];

/** ArrayView state. */
export interface ArrayState {
  values: readonly (number | string | null)[];
  /** Stable identities so moves animate as moves (default: index). */
  ids?: readonly (string | number)[];
  marks?: Readonly<Record<number, Mark>>;
  /** Named pointers drawn under cells: { lo: 0, hi: 7, mid: 3 }. */
  pointers?: Readonly<Record<string, number>>;
  /** Active window [lo, hi] (inclusive); cells outside are dimmed. */
  window?: readonly [number, number];
}

/** TreeView state. */
export interface TreeState {
  root: TreeNode | null;
  marks?: Readonly<Record<string, Mark>>;
  /** Edge marks keyed "parentId->childId". */
  edgeMarks?: Readonly<Record<string, Mark>>;
  /** Small labels beside nodes (balance factors, heights, priorities). */
  badges?: Readonly<Record<string, string>>;
}

export interface GraphSpec {
  nodes: readonly { id: string; label?: string; x?: number; y?: number }[];
  edges: readonly { from: string; to: string; weight?: number; label?: string }[];
  directed?: boolean;
}

/** GraphView state. Edge keys are "from->to" (either order for undirected graphs). */
export interface GraphState {
  graph: GraphSpec;
  nodeMarks?: Readonly<Record<string, Mark>>;
  edgeMarks?: Readonly<Record<string, Mark>>;
  /** Labels under nodes: distances, discovery times, ∞. */
  nodeBadges?: Readonly<Record<string, string>>;
}

/** TableView state (DP tables, truth tables, hash buckets). */
export interface TableState {
  cells: readonly (readonly (number | string | null)[])[];
  rowHeaders?: readonly string[];
  colHeaders?: readonly string[];
  /** Cell marks keyed "r,c". */
  marks?: Readonly<Record<string, Mark>>;
  /** Dependency arrows between cells: where this value came from. */
  arrows?: readonly { from: readonly [number, number]; to: readonly [number, number]; mark?: Mark }[];
}

// ═════════════════════════════════════════════════════════════════════════
// 9. Randomness (generators and seeded visuals)
// ═════════════════════════════════════════════════════════════════════════

/** A seeded random source (`createRng(seed)` in `@kit/core/rng`). */
export interface Rng {
  readonly seed: number;
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [lo, hi). */
  float(lo: number, hi: number): number;
  /** Uniform integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number;
  /** Uniform integer in [lo, hi] that isn't in `except` (e.g. non-zero). */
  intExcept(lo: number, hi: number, except: readonly number[]): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
  sign(): 1 | -1;
  chance(p: number): boolean;
  /** Normal sample (Box–Muller). */
  normal(mean?: number, sd?: number): number;
  /** An independent stream derived from this seed and a label. */
  fork(label: string): Rng;
}

// ═════════════════════════════════════════════════════════════════════════
// 10. Progress (localStorage, §5; read by the site)
// ═════════════════════════════════════════════════════════════════════════

export interface ProblemProgress {
  attempts: number;
  solved: boolean;
  /** Highest hint opened, 0–3. */
  hintsUsed: number;
  /** Opened the full solution before solving (gave up). */
  revealed: boolean;
  /** Solved on the first attempt with no hints. */
  clean?: boolean;
  /** ISO time of the last change. */
  updated: string;
}

/** Problem state as the set strip and subject pages show it. */
export type ProblemStatus = 'todo' | 'attempted' | 'solved' | 'hinted' | 'revealed';

export interface QuizProgress {
  answered: number;
  correct: number;
  total: number;
  done: boolean;
  /** Best score over completed runs. */
  best: number;
}

export interface LessonProgress {
  firstVisit: string;
  lastVisit: string;
  /** Sections the learner has reached, in first-seen order. */
  sections: LessonSectionId[];
  /** Where they were last (for "continue where you left off"). */
  lastSection?: LessonSectionId;
  problems: Record<string, ProblemProgress>;
  /** Worked examples: steps revealed of total. */
  examples: Record<string, { revealed: number; total: number }>;
  quiz?: QuizProgress;
  predictions: Record<string, { correct: boolean }>;
  completed: boolean;
}

export interface ExamAttempt {
  /** ISO date. */
  date: string;
  score: number;
  total: number;
  seconds: number;
}

export interface ProgressData {
  version: 1;
  lessons: Record<string, LessonProgress>;
  /** Exam-style sets by subject id. */
  exams: Record<string, ExamAttempt[]>;
}

export type LessonStatus = 'new' | 'started' | 'done';

export interface ProgressSummary {
  /** Lessons in the summary that the learner has opened / completed. */
  started: number;
  done: number;
  problems: { attempted: number; solved: number; hinted: number; revealed: number };
}

// ═════════════════════════════════════════════════════════════════════════
// 11. The lesson content module (problems.ts exports; build-index validates)
// ═════════════════════════════════════════════════════════════════════════

/**
 * What a lesson's `problems.ts` exports, by these exact names. It is pure
 * (imports only `@kit/pure`, `@kit/math` and the lesson's own math.ts), so
 * lesson.test.ts audits it in Node with `auditLesson(content)`, and subject
 * practice / exam pages import it next to other lessons' (`import.meta.glob`
 * over `lessons/<subject>/<slug>/problems.ts`, filtered by lessons.json
 * shipped status). `scripts/build-index.ts` checks `C` and `PROBLEMS` exist
 * for every lesson folder that has a problems.ts.
 *
 * Its visual partner is `figures.tsx` (no side effects, no mountLesson):
 * `export const FIGURES = defineFigures({…})` (README §8.6), imported by lesson.tsx
 * and by the practice pages.
 */
export interface LessonContent {
  /** The lesson's concepts (`defineConcepts`). */
  C: ConceptSet;
  TLDR: TldrSpec;
  /** Key formulas (≥ 1; the Formalize definition first). */
  FORMULAS: readonly FormulaSpec[];
  DERIVATIONS?: readonly DerivationSpec[];
  EXAMPLES: readonly WorkedExampleSpec[];
  PROBLEMS: readonly ProblemSpec[];
  QUIZ: QuizSpec;
  /** 2–4. */
  TRAPS: readonly TrapSpec[];
  /** ≥ 2 (§10). */
  REFERENCES: readonly Reference[];
  PREDICTS?: readonly PredictSpec[];
  GLOSSARY?: readonly GlossaryTerm[];
  /**
   * "Code it" sources by name, so lesson.test.ts can run the shipped snippet
   * in Node with `runSnippet(SNIPPETS.gd, { inputs, helpers })` and lesson.tsx
   * passes the same string to `<CodeCell code={SNIPPETS.gd} />`.
   */
  SNIPPETS?: Readonly<Record<string, string>>;
}

/** One problem on a page that mixes lessons (subject practice, exam-style set). */
export interface PracticeItem {
  /** Owning lesson: progress key, concept-CSS scope and DOM-id namespace. */
  lessonId: string;
  spec: ProblemSpec;
  concepts: ConceptSet;
}
