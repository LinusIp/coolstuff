# coolstuff kit — API reference

The Preact component kit every lesson is built from (CLAUDE.md §6). This file
is the contract: five builder groups implement against it in parallel
([PLAN.md](./PLAN.md) says who owns what), and lesson authors build every §4
section with it. The design system it renders is [DESIGN.md](./DESIGN.md)
(look and classes) and [NOTATION.md](./NOTATION.md) (maths). The data
contracts are [types.ts](./types.ts).

Status marks: **✅ ready** (implemented and tested now) · **⏳ G1–G5** (planned;
the API below is binding, the owner implements it).

> **Editing this file.** Each group edits only between its own
> `<!-- region:Gn -->` markers, re-reading the file right before each edit
> (other groups are editing other regions). Everything outside the markers is
> owned by the kit architect. A change to a public signature is logged in
> PLAN.md's change log.

**Contents**
[0 Quick start](#0-quick-start) ·
[1 Conventions](#1-conventions) ·
[2 DOM contract](#2-the-dom-contract-scriptssmokets) ·
[3 Foundations](#3-foundations-core-math-util) ·
[4 Lesson shell](#4-lesson-shell-g4) ·
[5 Formulas & text](#5-formulas--text-g1) ·
[6 Visuals](#6-visuals-g2) ·
[7 Controls & code](#7-controls--code-g4) ·
[8 Practice](#8-practice-g3) ·
[9 Data structures & systems](#9-data-structures--systems-g5) ·
[10 Building each §4 section](#10-building-each-4-section) ·
[11 Gallery](#11-the-gallery)

---

## 0. Quick start

A lesson is four files that matter: `problems.ts` (pure data: concepts,
examples, problems, quiz), `math.ts` (pure functions behind the visuals),
`lesson.test.ts`, and `lesson.tsx` (the page).

```ts
// lessons/linalg/eigenvectors/problems.ts — pure: runs in Node under vitest
import { defineConcepts, defineExample, generator, type ProblemSpec, type QuizSpec, type TldrSpec, type WorkedExampleSpec } from '@kit';

export const C = defineConcepts({
  input:      { hue: 'input',  label: 'input vector', symbol: '\\vec v' },
  output:     { hue: 'output', label: 'its image',    symbol: 'A\\vec v' },
  matrix:     { hue: 'teal',   label: 'the matrix',   symbol: 'A' },
  eigenvalue: { hue: 'rose',   label: 'scale factor', symbol: '\\lambda' },
});

export const TLDR: TldrSpec = { points: ['…', '…', '…'], formula: '\\cMatrix\\cInput = \\cEigenvalue\\cInput' };
export const EXAMPLES: readonly WorkedExampleSpec[] = [defineExample({ id: 'ex-direct', level: 'direct', /* … */ })];
export const PROBLEMS: readonly ProblemSpec[] = [/* ≥ 8: 3 ★, 3 ★★, 2 ★★★ */];
export const QUIZ: QuizSpec = [/* 4–6 */];
```

```ts
// lessons/linalg/eigenvectors/lesson.test.ts
import { describe, expect, it } from 'vitest';
import { auditExamples, auditProblems, auditQuiz, drawProblem, resolveExample } from '@kit';
import { C, EXAMPLES, PROBLEMS, QUIZ } from './problems';
import { eigenvalues } from './math';

const macros = C.macros();
describe('eigenvectors', () => {
  it('passes the kit audits', () => {
    expect(auditProblems(PROBLEMS, { macros })).toEqual([]);   // §5: counts, hints, solutions, TeX, generators
    expect(auditExamples(EXAMPLES, { macros })).toEqual([]);
    expect(auditQuiz(QUIZ, { macros })).toEqual([]);
  });
  it('every stated answer is right (computed independently)', () => {
    expect(resolveExample(EXAMPLES[0]).value).toEqual(eigenvalues([4, 1, 2, 3]));
    for (let seed = 1; seed <= 200; seed++) { const p = drawProblem(PROBLEMS[0], seed); /* recompute, compare */ }
  });
});
```

```tsx
// lessons/linalg/eigenvectors/lesson.tsx
import '@kit/styles/index.css';
import meta from './meta.json';
import { signal, computed } from '@preact/signals';
import {
  mountLesson, LessonPage, Section, TLDR, Figure, Formula, Derivation, WorkedExampleSet,
  Trap, ProblemSet, Quiz, WhereNext, CodeCell, Stage2D, Vector, Handle, type LessonMeta,
} from '@kit';
import { C, TLDR as TLDR_SPEC, EXAMPLES, PROBLEMS, QUIZ, TRAPS, REFERENCES } from './problems';

const v = signal<[number, number]>([1, 0.3]);
const Av = computed(() => apply2([2, 1, 1, 2], v.value));

mountLesson(
  <LessonPage id="linalg/eigenvectors" meta={meta as LessonMeta} concepts={C} subtitle="the directions a matrix doesn’t turn">
    <Section id="tldr" title="Eigenvectors in three lines"><TLDR spec={TLDR_SPEC} /></Section>
    <Section id="hook" title="Which arrows survive?">…</Section>
    <Section id="play" title="Drag the arrow">
      <Figure name="eigen-play" central wide caption="…" description="…" readout={…} mission={…} legend={…}>
        <Stage2D view={{ x: [-4, 4], y: [-3, 3] }} title="An arrow and its image under A">
          <Vector to={Av} concept="output" />
          <Handle value={v} concept="input" label="the input arrow v" />
        </Stage2D>
      </Figure>
    </Section>
    <Section id="build" title="…">…</Section>
    <Section id="formalize" title="Writing it down"><Formula tex="…" explain={…} live={{ v, Av }} /><Derivation steps={…} /></Section>
    <Section id="examples" title="See one done"><WorkedExampleSet examples={EXAMPLES} /></Section>
    <Section id="traps" title="Where students slip">{TRAPS.map((t, i) => <Trap spec={t} n={i + 1} />)}</Section>
    <Section id="practice" title="Your turn"><ProblemSet problems={PROBLEMS} /></Section>
    <Section id="quickcheck" title="Thirty seconds"><Quiz questions={QUIZ} /></Section>
    <Section id="next" title="Where this goes"><WhereNext lessonId="linalg/eigenvectors" references={REFERENCES} /></Section>
  </LessonPage>,
);
```

The complete reference data (one of everything in types.ts, audited by the
tests) is [`gallery/samples.ts`](./gallery/samples.ts). Copy its patterns.

---

## 1. Conventions

### 1.1 Imports and files

| Import | What |
|---|---|
| `@kit` | everything a lesson needs: theme, notation, types, foundations, every component (barrel: [index.ts](./index.ts)) |
| `@kit/math` | pure maths: vectors, `Mat2`/`Mat3`, `eig2`, calculus, ODE steps, ticks, stats, tree/force/layered layouts |
| `@kit/util` | browser helpers: `QualityGovernor`, `tween`, `announce`, `fitCanvas`, `registerPWA`, capabilities |
| `@kit/visual/Stage3D` | 3D (kept out of the barrel so only 3D lessons pay for it) |
| `@kit/styles/index.css` | the whole design system; every page imports it once |
| `@kit/vite-katex` | build-time KaTeX prerender plugin (vite.config.ts only) |

Folders: `core/` foundations · `text/` G1 · `visual/` G2 · `practice/` G3 ·
`controls/` + `shell/` G4 · `structures/` G5 · `gallery/` demos · `styles/`
one CSS file per group (`text.css`, `visual.css`, …) after the design-system
files. Lessons never import from each other, only from the kit.

### 1.2 State: signals, controlled by the lesson

Interactive state lives in **signals** (`@preact/signals`) that the lesson
owns. A control that changes a value takes `value: Signal<T>` (type alias
`Bindable<T>`) and writes `.value`; anything that shows a value reads it
(`LiveValue`: a signal, a computed, or a getter). Preact re-renders exactly the
parts that read a changed signal, so a dragged handle updates the formula,
the readout and the plot without the lesson wiring callbacks.

```tsx
const h = signal(0.5);                                  // lesson state
const slope = computed(() => (f(x0 + h.value) - f(x0)) / h.value);
<Slider value={h} min={0.01} max={2} label="$h$" concept="rate" />   // writes h
<Formula tex="…\anchor{m}{m}…" live={{ m: slope }} />               // reads slope
<Plot … series={[{ kind: 'function', f, concept: 'output' }]} />
```

Rules for every component:

- **Never copy a bound signal into local state.** Read `value.value` in render.
- Optional `onChange` callbacks exist only for side effects (logging progress).
- Components never write signals they weren't given.
- Module-level `signal()` for page state; `useSignal()` inside a component.
- `formatLive(v)` (core/live.ts) is the one readout formatter: fixed decimals,
  U+2212 minus, `(1.40, −0.20)` for vectors.

### 1.3 Concept colours: one concept, one colour, everywhere

A lesson names 3–5 concepts once, with `defineConcepts()` (theme.ts) in
`problems.ts`. Each concept gets an ink **and** a line style, and that pair
follows it through every representation:

| Where | How |
|---|---|
| Page CSS | `LessonPage` calls `C.mount()` (injects `.ct-<name>`, `--ct-<name>`) |
| KaTeX | `\colorTerm{matrix}{A}`, or the shorthand `\cMatrix` (from `C.macros()`, supplied to every Tex/Formula/RichText by `KitProvider`) |
| Prose | RichText `[the matrix]{matrix}` → `<span class="term ct ct-matrix">` (ink + line-style underline) |
| SVG figures | `class="ct ct-matrix"` on marks, or spread `C.stroke('matrix', 2.5)` for ink + dash pattern; primitives take `concept="matrix"` |
| Canvas / WebGL | `C.hex('matrix')`, re-read in `useTheme()` changes |
| Legends, explain-this key | `<LineSwatch concept="matrix" />` |
| Readouts, live values | wrap in `class="ct ct-matrix"` |
| Code (CodeCell) | identifiers listed in `concepts={{ A: 'matrix' }}` are underlined in the concept's line style (hue never colours syntax) |
| Data-structure marks | a `Mark` that isn't a built-in state is read as a concept name |

Global meanings need no definition: `input` (blue), `output` (orange),
`error` (red), `prob` (purple), and the state `correct` (green, never a
concept). Chrome (buttons, rules, focus ring, progress) is always ink.

### 1.4 Hover-linking: the link bus ✅

`core/link.ts`. One page-wide signal says what is lit: a **concept**
(colour-level) and optionally a **term** (one symbol). `installLinking()` —
called once by `LessonPage` and the gallery host — delegates events:

- **mouse**: hovering any element with a `ct-<concept>` class or
  `data-concept`, or with `data-term` / `data-anchor`, lights it; leaving clears;
- **keyboard**: focus does the same;
- **touch/pen**: a tap pins the highlight until the next tap elsewhere.

The DOM mirror writes `<html data-hl="concept …">` (components.css then lights
every `.ct-<concept>`: a 14% wash in text, +1px stroke in SVG) and adds
`.is-linked` to every `[data-term="t"]` / `[data-anchor="t"]`. So:

- prose `[v]{input}`, KaTeX `\cInput` and an SVG arrow with `class="ct ct-input"`
  light each other with **no code**;
- a symbol tagged `\anchor{lam}{\cEigenvalue}` in a formula and an SVG label
  with `data-term="lam"` light each other *individually* (term level);
- programmatic: `highlight({ concept: 'matrix' }, { source: 'slider-a' })`
  while dragging, `clearHighlight('slider-a')` after; `isLit('matrix')` inside a
  render or canvas draw subscribes to changes; `linkProps({ concept, term })`
  spreads publish handlers onto an element without classes.

`data-term` and `data-anchor` share one key space. Several concepts can be lit
at once: `highlight({ concept: 'input output' })`.

### 1.5 Live values

A formula, readout or label shows the current numbers of the interactive:
pass signals. `Formula`'s `live` prop maps anchor ids to `LiveValue`s: each
value hangs under its symbol (`.lv`, mono ≥ 15px, in the symbol's ink), and the
*Live values* switch shows the exploded view (`.lv-grid`: one column per
symbol, vectors and matrices as columns). Readouts (`Figure`'s `readout`) and
`Stage2D` labels read the same signals. Formatting: `formatLive`.

### 1.6 Explain this

Every key formula tags its symbols with `\anchor{id}{…}` and passes
`explain={{ id: { word, gloss, concept? } }}`. The *Explain this* switch shows
each note under its symbol (wide: bold concept word in the concept's ink +
plain gloss, joined by curved leaders that never cross; phone: a dotted-rule
key with line-style stubs under the symbols), plus `brackets` above groups of
symbols and an *In words* sentence (`inWords`). See §5.1.

### 1.7 Rich text ✅

`Rich` (types.ts) is the one prose format for statements, hints, solutions,
options, captions and notes. Rendered by `<RichText>` / `richToHtml()`:

| Syntax | Renders |
|---|---|
| `$\cMatrix\vec v$` | inline KaTeX (never breaks mid-expression) |
| `$$A\vec v = \lambda\vec v$$` | display KaTeX in its own `.math-display` box (scrolls on phones, never the page) |
| `**bold**`, `*italic*`, `` `code` `` | strong, em, code (markdown never touches maths or code) |
| `[link text](../calc1/limits/)` | link |
| `[the matrix]{matrix}` | concept term: ink + line-style underline, hover-linked |
| `[[eigenvalue]]`, `[[eigenvalue\|eigenvalues]]` | glossary term (`dfn.gloss`; G1's Glossary makes it a popover) |
| blank line · `- item` · `1. item` | paragraph · bullet list · numbered list |
| `\$` | a literal dollar |

Prose gets typographic minus signs, curly quotes and en-dash ranges
automatically. Concept shorthands and NOTATION.md macros work in every TeX
snippet. `richToPlain()` gives plain text for aria-labels and search.

### 1.8 Answer input syntax ✅ (expressions, numbers, units)

What a learner can type (core/expr.ts, core/units.ts). Problem shows a live
"We read: …" TeX preview (`Verdict.understood`) so they can see how it was read.

- **Numbers**: `3`, `−4.5`, `.5`, `3.0e8`, `12,500`, and constant expressions
  `1/3`, `sqrt(2)/2`, `2pi`, `3 × 10^8`. Precision: `{ decimals: 2 }`,
  `{ sig: 3 }` or `'exact'`; tolerance is ±0.5 in the last stated digit; an
  answer that is right but too rough gets "Close. Give it to 2 decimal places."
- **Lists**: `(1, −2)` or `5, 2` (vectors in order; `ordered: false` for sets of roots).
- **Units**: `9.81 m/s^2`, `9.81 m/s²`, `981 cm/s^2` (converted), `36 km/h`,
  `1.2 MΩ`, `5 eV`, `2.5 ms`, `J/(kg K)`, `N·m`, `°C`, `%`, `GB/s`. Wrong
  dimension: "“m/s” measures speed, but the answer is an acceleration."
  Missing unit: "The number is right; now add the unit (m/s²)."
- **Expressions**: `+ − * / ^` (also `** × · ÷ ²`), implicit multiplication
  (`2x`, `2(x+1)`, `x y`, `2 sin x`), `sin cos tan sec csc cot asin acos atan
  sinh cosh tanh exp ln log (natural) log10 log2 log_b(x) sqrt √ cbrt abs |x|
  floor ceil sign min max binom(n,k) n!`, constants `pi π e`, Greek names or
  letters (`theta`, `θ`), subscripted variables (`v_0`). `sin^2 x` = (sin x)²;
  `sin 2x` = sin(2x); `1/2x` = (1/2)·x. A leading `f'(x) =` or `v =` is ignored.
- **Equivalence**: evaluated at 24 seeded random points of the domain;
  `upToConstant` for antiderivatives; points where the expected answer is
  undefined are skipped; `disallow` forbids functions (to demand a simplified form).

### 1.9 Accessibility baseline (every component)

- Real elements first: `button`, `input`, `fieldset/legend`, `figure/figcaption`,
  `ol` for steps. ARIA only where HTML has nothing (`role="switch"`,
  `role="slider"` on SVG handles, `role="tablist"`).
- **Focus**: never remove the 2px ink outline (`:focus-visible`), never trap focus.
- **Targets** ≥ 44×44px (`HIT` in theme.ts), including SVG handles (transparent 44px hit circle).
- **Keyboard parity**: everything draggable moves with arrows (Shift = bigger
  steps), Home/End where meaningful; documented in a `.fig-keys` line.
- **Announcements**: result text in `aria-live="polite"` elements (readouts,
  feedback, step counters); `announce()` (util/dom) for changes with no visible text.
- **Colour never alone**: concepts have line styles; verdicts have an icon and a word.
- **Figures**: `<figure>` with caption, an SVG `<title>`, and a prose
  description (`aria-describedby`). Maths is KaTeX with MathML.
- **Motion**: honour `prefers-reduced-motion` (`useReducedMotion()`): tweens
  jump to the end state, nothing autoplays, the breathing ring and leader
  draw-in are skipped, every state still changes. Durations come from
  `MOTION` / `--dur-*` (140/240/420/600ms).
- **Phones (390×844)**: no horizontal page scroll; wide things (matrices,
  tables, long equations) scroll inside their own box; plates go full-bleed.

### 1.10 Performance

- A figure is two layers (DESIGN.md §5): a static layer drawn once per resize
  and a light dynamic layer repainted during drags. Budget: ≤ 16ms per drag
  frame on a mid phone. Long-running visuals use `QualityGovernor` (≥ 55fps
  or scale detail down) and pause off-screen (`useInView`).
- Heavy libraries load lazily inside the component (`await import('three')`,
  `import('d3-force')`), never at the barrel's top level.
- KaTeX output is memoised (RichText, Tex) per macros object; don't create a
  new `macros` object per render.
- No runtime network requests, ever (smoke fails on any).

---

## 2. The DOM contract (scripts/smoke.ts)

`npm run smoke` loads every lesson at 1280×800 and 390×844 and fails on any
console error/warning, a KaTeX error, horizontal scroll on the phone, a blank
screen, or a missing section. Components must render exactly these hooks:

| Hook | Rendered by | Smoke rule |
|---|---|---|
| `<section data-section="<id>" id="<id>">` with id ∈ `tldr hook play build formalize examples code traps practice quickcheck next` | `Section` | all present (`code` required for dsa, sysdesign, systems, ml, dl, diffusion, llm: `CODE_SUBJECTS` in types.ts) |
| `[data-worked-example="<id>"]` inside `[data-section="examples"]` | `WorkedExample` (its `<article>`), or each tab panel of `WorkedExampleSet` | ≥ 3 |
| `[data-problem="<id>"]` inside `[data-section="practice"]` | `Problem` (its `<article>`) | ≥ 8 |
| `[data-quiz-question="<id>"]` inside `[data-section="quickcheck"]` | each question of `Quiz` | 4–6 (≥ 4 checked) |
| `.katex` anywhere | Tex/Formula/RichText | ≥ 1; zero `.katex-error` |
| `<figure data-figure="<name>">` with a non-empty `<figcaption>` | `Figure` (also `Trap`'s counterexample) | every one: caption present, ≥ 40×40px, not blank (luminance std-dev ≥ 1.5) |
| `[data-thumb]` | `Figure central` | frames the 1200×750 thumbnail (else the play section) |
| `<title>` | lesson `index.html` | non-empty |

**Everything counted must be in the DOM, even when not shown.** A paged
`ProblemSet` renders all problems and marks the non-current ones `hidden`;
`Quiz` renders every question (`hidden` when not current); `WorkedExampleSet`
renders every tab panel (`hidden` when inactive). Never lazy-mount them.

Each figure also needs a prose description for screen readers: `Figure`'s
`description` (a visually hidden paragraph referenced by `aria-describedby`).

---

## 3. Foundations (core, math, util) ✅

All implemented and unit-tested now (`src/kit/**/*.test.ts`). Pure modules
work in Node; `.tsx` ones are small Preact components.

### 3.1 Context — `KitProvider`, `useKit`, `useMacros` (core/context.tsx)

```ts
interface KitContextValue {
  lessonId?: string;                         // progress key prefix, e.g. 'linalg/eigenvectors'
  subject?: string;                          // derived from lessonId
  concepts?: ConceptSet;
  macros: Readonly<Record<string, string>>;  // concept shorthands (+ extras); NOTATION macros are always on
}
<KitProvider lessonId? concepts? macros?>{children}</KitProvider>   // nests: inner values override
useKit(): KitContextValue
useMacros(extra?): macros                    // memoised merge, for KaTeX caching
```

`LessonPage` provides it; practice pages wrap each problem in a provider with
the problem's own `lessonId`, so progress lands on the right lesson.

### 3.2 `Tex`, `MathChain` (core/Tex.tsx)

```ts
<Tex tex: string display?: boolean class?: string macros? id? />
<MathChain tex: string class?: string /* default 'step__math' */ macros? />
```

`Tex` → `span.math-inline` / `div.math-display` (+ `math-key`/`math-hero` via
`class`). `MathChain` renders a relation chain (`mathChainHtml`, NOTATION.md
§8): one MathML copy for screen readers, visual pieces that wrap per relation
on phones. Worked-example and solution steps always use `MathChain`.

### 3.3 `RichText` (core/RichText.tsx, core/richtext.ts)

```ts
<RichText text: Rich inline?: boolean as?: 'div'|'span'|'p'|'li'|'dd'|'figcaption'|'legend'|'label' class? id? macros? />
richToHtml(text, { macros?, inline? }): string     // pure, memoised; usable in Node
parseRich(text): Block[] · parseInline(text): Inline[] · richToPlain(text) · richTex(text): string[] · texToPlain(tex)
```

Wrapper gets class `rich`. Syntax: §1.7.

### 3.4 Link bus (core/link.ts) — see §1.4

```ts
link: Signal<{ concept: string | null; term: string | null; source: string | null; sticky: boolean }>
highlight({ concept?, term? }, { source?, sticky? }?): void
clearHighlight(source?: string, force?: boolean): void
isLit(concept?, term?): boolean
linkTargetOf(el: Element): { concept, term } | null
linkProps({ concept?, term? }, source?): { 'data-concept', 'data-term', onPointerEnter, onPointerLeave, onFocus, onBlur }
installLinking(doc?): () => void        // ref-counted; LessonPage and the gallery call it
```

### 3.5 Live values (core/live.ts)

```ts
type Bindable<T> = Signal<T>;
type LiveData = number | string | readonly number[] | readonly (readonly number[])[];
type LiveValue = ReadonlySignal<LiveData> | (() => LiveData);
readLive(v: LiveValue): LiveData          // subscribes when called in render
formatLive(v: LiveData, decimals = 2): string
isSignalLike(v): boolean
```

### 3.6 `LineSwatch`, icons, hooks

```ts
<LineSwatch concept?: string hue?: Hue | 'ink' line?: LineStyle width?: number /* 28 */ />
// icons (aria-hidden, currentColor): IconCheck IconCross IconWarn IconRefresh IconPrint
//   IconPrev IconNext IconPlay IconPause IconMoon IconSun IconBook
useMediaQuery(q) · useReducedMotion() · usePhone() (< 700px) · useCoarsePointer()
useTheme(): 'light' | 'dark' · useElementSize(ref) · useInView(ref, margin?) · useProgress(): ProgressData
```

### 3.7 Answer checking (core/answers.ts)

```ts
checkNumeric(input: string, spec: NumericAnswer, commonWrong?): Verdict
checkSymbolic(input: string, spec: SymbolicAnswer, commonWrong?): Verdict
checkChoice(selected: number | number[], spec: ChoiceAnswer, commonWrong?): Verdict
checkDrag(state: unknown, target: DragTarget, commonWrong?): Verdict
   // state: Vec2 (point) · number (slider) · number[] item order (order) · number[] slot per item, −1 = unplaced (match) · anything (custom)
checkProof(ticked: boolean[], spec: ProofAnswer): Verdict
checkAnswer(spec, response: AnswerResponse, commonWrong?): Verdict      // dispatch (not code)
toleranceFor(precision, value) · describePrecision(precision) · formatAtPrecision(value, precision)

interface Verdict {
  correct: boolean;
  reason: 'correct' | 'wrong' | 'empty' | 'unparseable' | 'precision' | 'unit-missing' | 'unit-dimension' | 'unit-exact' | 'count' | 'form' | 'incomplete';
  message: string;          // "Not 6." · "Right: 7.00." · "Close. Give it to 2 decimal places."
  commonWrong?: number;     // index into the problem's commonWrong: show that note
  understood?: string;      // TeX preview of what was parsed
}
```

Expressions (core/expr.ts): `parseExpr(src, { vars })`, `tryParseExpr`,
`evaluateExpr(expr, scope)`, `compileExpr(expr)`, `exprToTex(expr)`,
`equivalent(expected, got, { vars, domain?, samples?, upToConstant?, rtol?, atol? })`,
`evalNumber(src)`, `exprVars`, `exprFunctions`, `gamma`, `factorial`. Errors are
`ExprError { code, pos, message }` with learner-facing messages.
Units (core/units.ts): `parseUnit`, `sameDimension`, `convert`,
`dimensionName`, `splitQuantity`, `unitToTex`, `prettyUnit`, `UnitError`.

### 3.8 Code checking (core/codecheck.ts)

```ts
runCodeTests(source: string, { entry, tests }): CodeRunReport   // synchronous; Node tests + inside the sandbox Worker ONLY
codeVerdict(report): Verdict
compareValues(got, expected, 'deep' | 'approx' | 'unordered' | 'set', tolerance?) · stable(v) · formatValue(v)
interface CodeRunReport { ok; passed; total; results: CodeTestResult[]; compileError?; logs: string[] }
```

Never run learner code on the main thread: in the browser it goes through
`runSandboxed` (§7.7), which runs `runCodeTests` in a Worker with a time limit.

### 3.9 Problems, examples and audits (core/problems.ts)

```ts
generator<P>(g: ProblemGenerator<P>): ProblemGenerator<P>      // identity, for type inference
drawProblem(spec: ProblemSpec, seed: number): ProblemInstance  // seed 0 = authored; else rejection-sample the generator
defineExample<P>(spec: WorkedExampleSpec<P>): WorkedExampleSpec // erases P so examples share an array
resolveExample(spec, params?): ResolvedExample                 // every Live field computed
exampleDefaults(spec) · paramSamples(spec): ParamValues[]      // grid for tests
auditProblems(specs, { macros?, seeds? = 60, minProblems? = 8 }): string[]
auditExamples(specs, { macros?, minExamples? = 3 }): string[]
auditQuiz(quiz, { macros? }): string[]
findUglyNumbers(text): string[]
class DegenerateGeneratorError
```

The audits encode CLAUDE.md §5/§10: counts and difficulty mix; unique ids;
exactly 3 distinct hints; a justified solution; a common-wrong note that the
checker does **not** accept; the canonical answer that the checker **does**
accept; valid units and TeX (rendered with KaTeX, lesson macros included); no
float noise, NaN or `-0` in any text; choice/drag indices in range and not
pre-solved; code solutions that pass and starters that don't; generators that
never exhaust their rejection budget over 60 seeds and actually vary.

### 3.10 Progress (core/progress.ts)

```ts
progress: ProgressStore              // shared store (localStorage, memory fallback)
getProgress(): ProgressStore · createProgressStore(storage, now?) · memoryStorage() · statusOfProblem(p)
interface ProgressStore {
  read(): ProgressData; lesson(id): LessonProgress | undefined;
  visit(lessonId); section(lessonId, sectionId);
  attempt(lessonId, problemId, correct): ProblemProgress;   // solving is permanent
  hint(lessonId, problemId, level 1–3); reveal(lessonId, problemId);
  example(lessonId, exampleId, revealed, total); quiz(lessonId, { answered, correct, total, done });
  predict(lessonId, id, correct); complete(lessonId); exam(subjectId, attempt);
  status(lessonId): 'new' | 'started' | 'done';
  problemStatus(lessonId, problemId): 'todo' | 'attempted' | 'solved' | 'hinted' | 'revealed';
  summary(lessonIds): { started; done; problems: { attempted; solved; hinted; revealed } };
  continueTarget(): { lessonId; section?; lastVisit } | null;
  export(): string; import(json): boolean; reset(); refresh(); subscribe(cb): () => void;
}
```

Key `coolstuff:progress:v1`; cross-tab changes arrive via `storage` events.
Who writes what: `LessonPage` → visit, section · `Problem` → attempt, hint,
reveal · `WorkedExample` → example · `Quiz` → quiz, and `complete` when the
quick check is finished · `Predict` → predict. Practice pages write under the
problem's own lesson id.

### 3.11 Randomness (core/rng.ts)

```ts
createRng(seed: number | string): Rng   // next float int intExcept pick shuffle sign chance normal fork
hashSeed(text): number · randomSeed(): number (never 0)
```

### 3.12 Maths (`@kit/math`) and utilities (`@kit/util`)

`@kit/math`: `clamp lerp invLerp remap approxEqual easeInOut easeOut snapTo
roundSig linspace range` · `Vec2/Vec3: add sub scale dot cross norm dist perp
angleOf angleBetween lerpVec normalize rotate project reject closestOnSegment
closestOnLine closestOnPolyline add3 … cross3 normalize3` · `Mat2/Mat3:
fromColumns2 columns2 det2 trace2 transpose2 apply2 mul2 inverse2 lerpMat2
rotation2 eig2 (+ Mat3 versions)` · `orbitBasis projectOrbit` ·
`derivative secondDerivative integrate riemann bisect newton findRoots rk4Step
eulerStep symplecticEulerStep` · `niceStep ticks decimalsFor fmt` · `mean
variance stdev histogram mulberry32 randn` · `layoutInorder layoutTidy
forceLayout layeredLayout`.

`@kit/util`: `prefersReducedMotion isTouchDevice hasWebGL2 hasWebGPU clampedDpr
safeStorage` · `FpsMeter QualityGovernor` · `registerPWA` · `uid tween
rafThrottle debounce announce attr fitCanvas`.

### 3.13 Build-time KaTeX (src/kit/vite-katex.ts)

Registered in vite.config.ts. In any HTML page, `<span class="tex">…</span>`
(inline) and `<div class="tex-block">…</div>` (display) become KaTeX at build
time with the same options and macros as runtime; a TeX error fails the build.

---

<!-- region:G4-shell -->
## 4. Lesson shell (G4)

### 4.1 `LessonPage` ⏳ G4

The page frame every lesson uses. Provides context, linking, progress,
concepts CSS, masthead, contents rail, lesson head and colophon.

```ts
interface LessonPageProps {
  id: string;                       // 'linalg/eigenvectors' (must match curriculum.ts)
  meta: LessonMeta;                 // the lesson's meta.json (cast: `meta as LessonMeta`)
  concepts: ConceptSet;             // from problems.ts
  subtitle?: string;                // "the directions a matrix doesn’t turn"
  children: ComponentChildren;      // <Section>s in §4 order
}
mountLesson(vnode, el?: string | HTMLElement = '#app'): void   // initTheme, render, registerPWA
```

DOM (layout.css): `a.skip-link` → `header.masthead` (`SiteHeader`) →
`div.page` > **`nav.rail`** (must come first: `.page` is a two-column grid at
≥ 1240px) + `main.lesson#main` > `header.lesson-head` (kicker "Subject ·
Lesson n", `h1.lesson-title` with `__main`/`__sub`, `ul.lesson-meta`: minutes,
level pill, prerequisite links) → sections → `footer.colophon`.

Behaviour: `C.mount()` once; `KitProvider { lessonId: id, concepts }`;
`installLinking()`; `progress.visit(id)`; an IntersectionObserver marks each
section seen (`progress.section`) and drives the rail's `aria-current` and the
masthead progress; `?thumb` in the URL hides the masthead for thumbnail capture.
Title: `document.title = "<title> — coolstuff"` when missing.

### 4.2 `Section` ⏳ G4

```ts
interface SectionProps {
  id: LessonSectionId;              // one per page; the §4 id
  title: string;                    // the h2
  kicker?: string;                  // default SECTION_KICKERS[id]
  children: ComponentChildren;
}
```

`<section class="section" id data-section aria-labelledby>` with
`header.section__head` (`p.kicker` with `span.kicker__num` = position among
the page's sections, then `h2`). The first section gets `section--first`.
Registers itself with LessonPage for the rail and progress.

### 4.3 `Figure` and its strip: `Readout`, `Mission`, `Legend`, `FigKeys` ⏳ G4

The plate around any visual (DESIGN.md §5). Stages (Stage2D, Plot,
GraphView…) go inside as children.

```ts
interface FigureProps {
  name: string;                       // data-figure; unique per page, kebab-case
  caption: Rich;                      // figcaption (required)
  description: string;                // longer plain-text description for screen readers
  label?: string;                     // default "Figure n" (auto-numbered in page order)
  wide?: boolean;                     // .is-wide: text + margin (912px) at ≥ 1000px
  central?: boolean;                  // data-thumb: the lesson's central interactive
  readout?: ComponentChildren;        // mono strip joined under the stage (aria-live="polite")
  mission?: MissionProps;             // "Try it" goals
  keys?: ComponentChildren;           // keyboard help line; defaults to the standard handle text when `interactive`
  interactive?: boolean;              // shows the default keys line
  legend?: readonly LegendItem[];
  children: ComponentChildren;
}
interface LegendItem { concept?: string; line?: LineStyle; hue?: Hue; label: Rich }
interface MissionProps { title?: string; goals: readonly { text: Rich; done: boolean | ReadonlySignal<boolean> }[]; status?: Rich | ReadonlySignal<Rich>; correct?: boolean | ReadonlySignal<boolean> }
<Readout status? correct?>…<ReadoutPair concept sym value /> …</Readout>
<FigKeys>…</FigKeys>
```

DOM: `<figure class="plate[ is-wide]" data-figure aria-describedby="<name>-cap <name>-desc">`
children → `.readout` → `.plate__below` > `.plate__main` (`.mission`,
`.fig-keys`) + `.plate__side` (`ul.legend`, `figcaption.caption#<name>-cap`
with `span.label.caption__label`) → `p.sr-only#<name>-desc`.

### 4.4 `SiteHeader`, `ReadingProgress`, `ThemeToggle` ⏳ G4

```ts
interface SiteHeaderProps {
  crumbs: readonly { label: string; href?: string }[];   // last one is aria-current="page"
  progress?: boolean;                                     // show ReadingProgress (lesson pages)
  home?: string;                                          // wordmark href (relative; default computed from depth)
}
<ReadingProgress />   // segmented hairline: one segment per [data-section]; role="progressbar"
<ThemeToggle />       // icon-btn.theme-toggle; toggleTheme(); aria-label "Switch light or dark"
```

Used by site pages too (home, subject, graph, practice). Phones: wordmark +
toggle; progress becomes a full-width hairline on the masthead's bottom edge.

### 4.5 `WhereNext`, `References` ⏳ G4

```ts
interface WhereNextProps { lessonId: string; references: readonly Reference[]; extraBuildsOn?: string[]; extraUnlocks?: string[] }
<References items={refs} />
```

Reads `@content/curriculum` (prerequisites; dependents = lessons listing this
one) and `@content/lessons.json` (shipped status, summaries). Renders
`.next-grid` with "← Builds on" / "Unlocks →" `.lesson-cards`; unshipped
lessons are `div.lesson-card.is-soon` "coming soon" (not links). Then
`p.label` "References" + `ol.refs` (small-caps authors, italic title, edition,
publisher, year, section; URLs as text, never fetched). Links are relative
(`../../<subject>/<slug>/`).

<!-- /region:G4-shell -->

---

<!-- region:G1 -->
## 5. Formulas & text (G1)

### 5.1 `Formula` ⏳ G1

KaTeX with colour-linked terms, live values and explain-this.

```ts
interface FormulaProps {
  tex: string;                                  // tag symbols with \anchor{id}{…}; colour with \cX shorthands
  label?: string;                               // bar label: "Definition", "Key formula"; default "Formula"
  size?: 'display' | 'key' | 'hero';            // default 'key' (math-key); 'hero' for the Formalize definition
  explain?: ExplainMap;                         // { [anchorId]: { word, gloss, concept? } } → "Explain this" switch
  brackets?: readonly FormulaBracket[];         // labels above groups: { anchor, text, concept? }
  explainDefault?: boolean;                     // default false
  live?: Readonly<Record<string, LiveValue | { value: LiveValue; decimals?: number; unit?: string }>>;  // → "Live values" switch
  liveDefault?: boolean;                        // default false; inline .lv values show whenever `live` is set
  inWords?: Rich;                               // italic "In words" sentence with [terms]{concept}
  macros?: Readonly<Record<string, string>>;
  id?: string;
}
```

States: plain · explain on (wide: notes under symbols, curved leaders in the
concept's ink, packed with no overlaps or crossings, brackets above; < 560px
block width: `.is-stacked` dotted-rule key + `.term-stub` under each symbol) ·
live on (`.lv-grid` exploded view) · hover-linked (any symbol, note or bracket
lights its concept/term everywhere via the link bus).
A11y: switches are `button.switch[role=switch][aria-checked]`; notes are a
real `ol` with the symbol's MathML; leaders/brackets are aria-hidden
decoration; live values are announced politely at most once per second.
DOM: `.formula[data-explain]` > `.formula__bar` (`p.label` + `.formula__toggles`)
+ `.formula__stage` (`.formula__over` brackets, the KaTeX, `ol.formula__notes`
`li[data-for][data-concept]`, `svg.formula__leaders`) + `.lv-grid` + `p.in-words`.
Explain layout is pure and tested (`text/explain-layout.ts`, from the
prototype in kit/_dev/design/explain.ts).

```tsx
<Formula
  label="Definition" size="hero"
  tex="\anchor{Av}{\anchor{A}{\cMatrix}\anchor{v}{\cInput}} = \anchor{lam}{\cEigenvalue}\anchor{v}{\cInput}"
  explain={{ A: { word: 'the matrix', gloss: 'a rule that moves every vector', concept: 'matrix' },
             v: { word: 'a nonzero vector', gloss: 'the same one on both sides', concept: 'input' },
             lam: { word: 'a plain number', gloss: 'how much $\\vec v$ is stretched', concept: 'eigenvalue' } }}
  brackets={[{ anchor: 'Av', text: 'where $A$ sends $\\vec v$', concept: 'output' }]}
  live={{ v, lam }}
  inWords="Applying [the matrix]{matrix} to [the vector]{input} gives back the same vector, only stretched by [the number $\lambda$]{eigenvalue}."
/>
```

### 5.2 `Derivation` ⏳ G1

```ts
interface DerivationProps {
  steps: readonly DerivationStep[];   // { rel?: TeX relation, tex, why: Rich }; mark changes with \chg{…}
  label?: string;                     // default "Derivation"
  start?: number;                     // steps visible at first (default 1)
  step?: Signal<number>;              // external control (e.g. a Scrolly)
  macros?;
}
```

Steps reveal one at a time with a `Stepper` ("‹ Step 2 of 3 ›"; G4's
component) and a "Show all" control. A new step enters (`.is-entering`,
`--dur-3`); `\chg{}` content gets the highlighter sweep (420ms after 120ms);
**symbols tagged with the same `\anchor` id in consecutive steps slide from
their old position to the new one (FLIP, ≤ 420ms) and anchors that disappear
fade out**. The current step has `.is-current` (2px ink rule). Reduced motion:
no slides or sweeps, states still change. Print and `?all`: every step shown.
DOM: `.derivation` > `.derivation__bar` + `ol.derivation__steps` >
`li.dstep` (`.dstep__rel`, `.dstep__math`, `.dstep__why`); justification below
the maths on phones.

### 5.3 `Glossary`, `Term`, `installGlossary` ⏳ G1

```ts
interface GlossaryEntry { term: string; definition: Rich; lesson?: string /* defining lesson id */ }
registerGlossary(entries: readonly GlossaryEntry[]): void     // site-wide terms come from @content/search-index.json
<Term id="eigenvalue">eigenvalues</Term>                     // inline, explicit
installGlossary(root?): () => void                           // enhances RichText's dfn.gloss[data-gloss]
<Glossary entries={…} />                                     // a <dl> of the lesson's terms (optional, e.g. in "next")
```

A term is a focusable button-like `dfn`; hover/focus/tap opens a small
popover (definition + "Defined in *Lesson*" link; Esc closes; never covers the
term itself; stays on screen at 390px). Unknown terms render as plain text and
log nothing. `LessonPage` calls `installGlossary()` and registers the lesson's
`meta.glossary`.

### 5.4 `TLDR` ⏳ G1

```ts
<TLDR spec: TldrSpec />   // { points: [3 × Rich], formula: TeX, key?: { tex, text }[] }
```

`.card.tldr.is-wide`: head (label "In brief · revision card" + **Print card**
`btn--sm`: adds `body.print-card`, `window.print()`, removes it), `ol.tldr__points`
(italic old-style numerals), `.tldr__formula` (the formula at `math-key` + a
`dl.key`). Prints as the revision sheet (DESIGN.md §12).

### 5.5 `Trap`, `Callout`, `Sidenote` ⏳ G1

```ts
<Trap spec: TrapSpec n?: number figure?: ComponentChildren />   // counterexample plate beside the text
<Callout kind?: 'note' | 'key' | 'simplify' label?: string>{children}</Callout>
<Sidenote>{children}</Sidenote>                                 // numbered sn-ref + .sidenote (margin ≥ 1000px, folds inline below)
```

`Trap` → `article.card.trap`: ⚠ + the myth in quotes (`.trap__title`),
`.trap__body` with `.trap__text` (explanation, then "What's true." `.trap__truth`)
and `figure.trap__fig[data-figure="trap-<id>"]` with a figcaption (so smoke
checks it). `Callout kind="simplify"` is how lessons say "we're ignoring air
resistance here" (§10).

### 5.6 RichText polish ⏳ G1

G1 owns core/richtext.ts after handoff: keep the syntax in §1.7 backward
compatible (only add), keep `richToHtml` pure and memoised, add glossary
popover wiring through `installGlossary`.

<!-- /region:G1 -->

---

<!-- region:G2 -->
## 6. Visuals (G2)

### 6.1 `Stage2D` and primitives ⏳ G2

A coordinate plane with grid, axes, pan/zoom and draggable handles.

```ts
interface Stage2DProps {
  view: ViewBox | Signal<ViewBox>;          // { x: [xmin, xmax], y: [ymin, ymax] } in world units
  title: string;                            // SVG <title> (accessible name)
  aspect?: number | { desktop: number; phone: number };   // height/width; default { desktop: 0.62, phone: 0.94 }
  equalScale?: boolean;                     // default true: 1 unit is the same length on both axes (view grows to fit)
  grid?: boolean | { step?: number };       // default true; nice steps from niceStep()
  axes?: boolean | { x?: Rich; y?: Rich; ticks?: boolean };   // default true
  pan?: boolean;                            // drag empty space / two fingers; default false
  zoom?: boolean | { min: number; max: number };   // ctrl/⌘-wheel, pinch, +/− keys; default false; never hijacks page scroll
  hint?: string | false;                    // first-touch note beside the first handle; default "drag the ring"
  static?: ComponentChildren;               // primitives for the static layer (drawn once per resize)
  children?: ComponentChildren;             // primitives for the dynamic layer
  class?: string;
}
useStage(): StageApi
interface StageApi { view: ViewBox; width: number; height: number; pxPerUnit: number; toPx(p: Vec2): Vec2; toWorld(px: Vec2): Vec2 }
```

Primitives (all accept `concept?: string`, `emphasis?: 'focal' | 'quiet' |
'context'` (2.5px / 2px@62% / 22%), `label?: Rich`, and `Vec2 | ReadonlySignal<Vec2>`
wherever a point is expected):

```ts
<Vector from?={[0,0]} to concept label? />                    // arrowheads scale with stroke
<Segment a b concept /> · <Line through={[p, q]} concept />   // Line is infinite, clipped to the view
<Point at concept r? label? />
<Curve f={(x) => y} concept samples? /> · <Curve param={(t) => [x, y]} t={[a, b]} concept />   // adaptive; breaks at discontinuities
<Polyline points closed? concept /> · <Polygon points fill?: 'wash' | 'hatch' concept />
<Label at text: Rich concept? anchor?: 'n'|'ne'|'e'|… />      // haloed, clamped inside the plate; KaTeX allowed (HTML overlay)
<Band through direction width? concept />                      // the "found" band (DESIGN.md §5)
<Arc center from to r? label? />                               // angle marks
<Handle
  value: Signal<Vec2>
  label: string                                  // accessible name: "the input arrow v"
  concept?: string
  constrain?: 'free' | { x: number } | { y: number } | { curve: (x: number) => number } | { line: [Vec2, Vec2] } | { circle: { c: Vec2; r: number } } | ((p: Vec2) => Vec2)
  snap?: number | readonly Vec2[]                // grid step, or magnetic targets (within 12px / 3°)
  step?: number                                  // arrow-key step (default 0.1; Shift ×5)
  bounds?: ViewBox
  correct?: boolean | ReadonlySignal<boolean>    // green "found" state
  onDragStart?() onDragEnd?()
/>
<CanvasLayer draw={(ctx: CanvasRenderingContext2D, api: StageApi) => void} />   // heavy content; re-draws when signals it reads change
```

Handles: 5.5px dot + 14px ring on a 13% wash over a **44px** transparent hit
area; ring grows on hover/drag; `cursor: grab/grabbing`; `touch-action: none`
on the handle only (the page still scrolls around the figure);
`role="slider"`, `aria-valuetext="v = (1.40, 0.20)"`, arrows move it; the
first handle breathes three times and shows the hand-lettered hint until the
first interaction (skipped under reduced motion). Dragging a handle lights its
concept on the link bus.
Layers: static SVG (`.plate__layer--static`, never touched during a drag) +
dynamic SVG + optional canvas + HTML label overlay. Long dashed lines are
clipped to the view.

### 6.2 `Plot` ⏳ G2

Charts on Stage2D: functions, parametric curves, points, live series,
histograms, bars, vector fields, shaded areas and Riemann sums.

```ts
interface PlotProps {
  title: string;
  x: readonly [number, number];
  y: readonly [number, number] | 'auto';
  series: readonly PlotSeries[];
  xLabel?: Rich; yLabel?: Rich;
  cursor?: Signal<number>;           // draggable vertical cursor at this x (linked plots share one signal)
  equalScale?: boolean;              // default false for plots
  aspect?: Stage2DProps['aspect'];
  children?: ComponentChildren;      // extra primitives on top
}
type PlotSeries =
  | { kind: 'function'; f: (x: number) => number; concept?: string; label?: Rich }
  | { kind: 'parametric'; f: (t: number) => Vec2; t: readonly [number, number]; concept?: string; label?: Rich }
  | { kind: 'points'; data: readonly Vec2[] | ReadonlySignal<readonly Vec2[]>; concept?: string; label?: Rich }
  | { kind: 'line'; data: readonly Vec2[] | ReadonlySignal<readonly Vec2[]>; concept?: string; label?: Rich }   // live series (training loss)
  | { kind: 'histogram'; data: readonly number[] | ReadonlySignal<readonly number[]>; bins: number; range?: readonly [number, number]; density?: boolean; concept?: string }
  | { kind: 'bars'; values: readonly number[] | ReadonlySignal<readonly number[]>; labels?: readonly string[]; concept?: string }
  | { kind: 'field'; F: (x: number, y: number) => Vec2; density?: number; concept?: string }
  | { kind: 'area'; f: (x: number) => number; from: number | ReadonlySignal<number>; to: number | ReadonlySignal<number>; concept?: string }
  | { kind: 'riemann'; f: (x: number) => number; a: number; b: number; n: number | ReadonlySignal<number>; rule: RiemannRule | ReadonlySignal<RiemannRule>; concept?: string };
```

Stacked linked plots (f, f′, f″) share `x` and a `cursor` signal. Surfaces
are Stage3D's job.

### 6.3 `MatrixGrid` ⏳ G2

A 2×2 transform acting on the plane, with î and ĵ highlighted.

```ts
interface MatrixGridProps {
  matrix: Signal<Mat2>;
  title: string;
  editable?: 'basis' | 'entries' | 'both' | false;   // drag î/ĵ tips, or step the entries; default 'basis'
  snap?: number;                                      // default 0.5 (entries and basis tips)
  morph?: ReadonlySignal<number>;                     // 0 = identity … 1 = the matrix (animate with a Slider/PlayScrub)
  show?: { grid?: boolean; basis?: boolean; unitSquare?: boolean; determinant?: boolean; eigen?: boolean };
  vectors?: readonly { value: Signal<Vec2> | ReadonlySignal<Vec2>; concept: string; label: string; draggable?: boolean; transformed?: boolean }[];
  view?: ViewBox;
  concepts?: { i?: string; j?: string; area?: string };   // which concepts î, ĵ and the area wear
}
```

Shows the transformed grid as a context layer, î/ĵ arrows, an entries panel
(`.lv-vec--mat`, editable as steppers when `editable` includes entries),
optional unit square with signed area (orientation flip hatched), and eigen
directions (rose double rule) when real.

### 6.4 `Stage3D` ⏳ G2 (`@kit/visual/Stage3D`)

Only for genuinely 3D concepts (surfaces, fields, rotations).

```ts
interface Stage3DProps {
  title: string;
  bounds: { x: readonly [number, number]; y: readonly [number, number]; z: readonly [number, number] };
  camera?: { azimuth: number; elevation: number; distance?: number } | Signal<{ azimuth: number; elevation: number; distance?: number }>;
  autoRotate?: boolean;            // never under reduced motion
  axes?: boolean; grid?: boolean;
  fallback: Rich;                  // caption shown if 3D can't render
  children: ComponentChildren;     // Surface, Points3D, Vector3D, Curve3D, Plane3D, VectorField3D
}
<Surface f={(x, y) => z} x y resolution? concept? contours?: boolean colorBy?: 'height' | 'concept' />
<Vector3D from? to concept /> · <Points3D data concept /> · <Curve3D f={(t) => Vec3} t concept /> · <Plane3D normal point concept /> · <VectorField3D F density? concept />
```

Orbit by drag, zoom by pinch/ctrl-wheel, arrow keys rotate, a "Reset view"
button; sensible default camera (azimuth −60°, elevation 25°). Renderer: SVG/
canvas with `orbitBasis` for light scenes; three.js (lazy-imported) only when
a scene needs it, justified in that lesson's NOTES.md.

<!-- /region:G2 -->

---

<!-- region:G4-controls -->
## 7. Controls & code (G4)

### 7.1 `Slider` ⏳ G4

```ts
interface SliderProps {
  value: Signal<number>;
  min: number; max: number; step?: number;          // default step (max − min)/100
  label: Rich;                                      // shown left; also the accessible name (plain text)
  concept?: string;                                 // thumb in the concept ink; dragging lights it on the link bus
  detents?: readonly (number | { value: number; label?: string })[];   // ticks below; magnetic within snapRadius
  snapRadius?: number;                              // world units; default 1.5 steps
  format?: (v: number) => string;                   // value text; default formatNumber(v, decimals from step)
  valueText?: (v: number) => string;                // aria-valuetext ("lambda 3.00, determinant 0.00")
  disabled?: boolean;
  onCommit?: (v: number) => void;                   // pointer up / key up
}
```

DOM: `.slider[.ct.ct-<concept>]` > `.slider__label` + `.slider__track`
(`input[type=range]` 44px tall, `--fill`, `.slider__ticks`) + `.slider__value`.

### 7.2 `Toggle`, `Segmented` ⏳ G4

```ts
<Toggle value: Signal<boolean> label: Rich disabled? />                       // button.switch[role=switch]
<Segmented value: Signal<T> options: readonly { value: T; label: Rich; disabled?: boolean }[] label: string /* group name */ />   // .seg, aria-pressed
```

### 7.3 `Stepper` ⏳ G4

```ts
<Stepper value: Signal<number> /* 0-based */ count: number label?: (i: number, count: number) => string /* "Step 2 of 3" */ wrap?: boolean />
```

`.stepper`: prev/next `icon-btn`s (disabled at the ends), live label.
Keyboard: ←/→ when focused. Used by Derivation and WorkedExample.

### 7.4 `PlayScrub` ⏳ G4

A timeline for stepping through algorithms and simulations frame by frame.

```ts
interface PlayScrubProps {
  frame: Signal<number>;            // 0-based
  count: number;
  playing?: Signal<boolean>;
  fps?: number;                     // frames per second when playing; default 2
  loop?: boolean;
  label?: (i: number) => string;    // "Pass 2 · compare 7 and 4"
  notes?: readonly Rich[];          // per-frame narration (a Trace's notes), aria-live
  marks?: readonly number[];        // notable frames shown as ticks
}
```

Play/pause, step back/forward, a scrubber, frame counter. Keyboard: Space
play/pause, ←/→ step, Home/End. Never autoplays; under reduced motion "play"
still steps frames (it's discrete), at most 2 fps. Pauses off-screen.
Pattern with a trace (types.ts §8):

```tsx
const frame = signal(0);
const state = computed(() => TRACE[frame.value].state);
<PlayScrub frame={frame} count={TRACE.length} notes={TRACE.map((f) => f.note ?? '')} />
<ArrayView state={state} label="The array being sorted" />
```

### 7.5 `Scrolly` ⏳ G4

```ts
interface ScrollyProps {
  steps: readonly { id: string; content: ComponentChildren }[];
  step?: Signal<number>;            // current step (written by scrolling; can be read by visuals)
  children: (step: number) => ComponentChildren;   // the pinned visual
}
```

Desktop: visual pinned (sticky) beside/above the text column while steps
scroll past; phone: visual sticky at the top (≤ 45vh) with steps below. The
current step gets `.is-current` and lights nothing by itself (steps can call
`highlight`). Without JS or under reduced motion, all steps and the visual
still read top to bottom. Keyboard users reach every step by Tab.

### 7.6 `CodeCell` ⏳ G4

An editable, runnable snippet whose output updates the visual (§4.7 "Code it").

```ts
interface CodeCellProps {
  code: string;                                         // initial source (JavaScript)
  label?: string;                                       // default "Code it"
  editable?: boolean;                                   // default true (a plain textarea-based editor, mono, tab inserts 2 spaces)
  autorun?: boolean;                                    // run on mount and after edits (debounced 400ms); default false (Run button)
  inputs?: Readonly<Record<string, ReadonlySignal<unknown> | unknown>>;   // read-only globals in the sandbox; re-run on change when autorun
  outputs?: Readonly<Record<string, Signal<unknown>>>;  // `emit('name', value)` in the code writes these signals → visuals update
  concepts?: Readonly<Record<string, string>>;          // identifier → concept: underlined in the concept's line style
  timeoutMs?: number;                                   // default 2000
  onResult?: (r: SandboxResult) => void;
  lines?: number;                                       // min visible rows
}
```

DOM: `.codecell` > `.codecell__bar` (label, **Run**, **Reset**) +
`pre.codecell__code` (editor; syntax by ink weight and italics only) +
`.codecell__out` (logs, errors with line numbers, "Stopped after 2 s"),
`aria-live="polite"`.

### 7.7 `runSandboxed` (controls/sandbox.ts) ⏳ G4

```ts
interface SandboxRequest { code: string; inputs?: Record<string, unknown>; tests?: { entry: string; tests: readonly CodeTest[] }; timeoutMs?: number }
interface SandboxResult { ok: boolean; logs: string[]; emits: Record<string, unknown>; error?: { message: string; line?: number }; timedOut?: boolean; report?: CodeRunReport }
runSandboxed(req): Promise<SandboxResult>
```

A module Worker (`new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })`)
that removes `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`importScripts` and `indexedDB` before running anything, exposes `emit` and a
captured `console`, runs `runCodeTests` for test requests, and is terminated
(and replaced) on timeout. Problem's code answers use it too.

<!-- /region:G4-controls -->

---

<!-- region:G3 -->
## 8. Practice (G3)

### 8.1 `WorkedExample`, `WorkedExampleSet` ⏳ G3

```ts
interface WorkedExampleProps {
  spec: WorkedExampleSpec;
  n?: number;                                                   // "Worked example 2"
  figure?: (params: ParamValues) => ComponentChildren;          // its own small interactive (receives live params)
}
interface WorkedExampleSetProps {
  examples: readonly WorkedExampleSpec[];                       // ★ direct · ★★ combined · ★★★ exam level
  figures?: Readonly<Record<string, (params: ParamValues) => ComponentChildren>>;   // by spec.figure key
}
```

Flow (DESIGN.md §8): statement (`.lead`) → `dl.knowwant` → `.strategy` →
`ol.steps`: step 1 shown; before each further step a **pause**
(`.step--pause` > `.pause`: "Try the next step yourself" + the step's `tryIt`,
**Reveal step k** primary + *I've done it, compare* quiet) → boxed answer
(`.answer--hidden` with veil until the last step, then `.answer` green rule) →
✓ `.sanity`. Live params: Sliders above the statement; every `Live` field
recomputes via `resolveExample`, revealed steps stay revealed. Steps render
with `MathChain`. Writes `progress.example`.
`WorkedExampleSet`: one `article.card.example` with `.ex-tabs[role=tablist]`
(`★ Direct · ★★ Combined · ★★★ Exam level`, arrow keys move between tabs) and
one `[role=tabpanel][data-worked-example]` per example (inactive ones `hidden`).
A standalone `WorkedExample` puts `data-worked-example` on its `article`.

### 8.2 `Problem` ⏳ G3

```ts
interface ProblemProps {
  spec: ProblemSpec;
  n?: number; total?: number;                                   // "Problem 4 · numeric · 4 of 8"
  figure?: (instance: ProblemInstance) => ComponentChildren;
  custom?: (state: Signal<unknown>, instance: ProblemInstance) => ComponentChildren;   // visual for drag mode 'custom'
  onSolved?: (instance: ProblemInstance) => void;
}
```

`article.card.problem[data-problem=<id>]`. Answer inputs by kind:
numeric/symbolic → `form.answer-row` (`label` with the TeX `label`, `.field`
mono input, **Check**, `.answer-row__help` with the stated precision via
`describePrecision`, live "We read: …" preview from `Verdict.understood`);
choice → radio/checkbox `.choice` rows (+ a one-line reason field when
`askReason`); drag → point (a small Stage2D + Handle from G2), order (a
reorderable list: drag *or* move-up/down buttons), match (items → slots:
drag *or* select menus), slider (G4 Slider), custom (the `custom` render
prop); proof → optional textarea, then the model answer and a checklist the
learner ticks; code → CodeCell editor + **Run tests** (sandboxed, per-test
results, hidden tests shown as "hidden test 4 ✓/×").
States: unanswered · typing · wrong (`.field.is-wrong`, `.feedback--wrong` × +
message, and the matching `.wrong-note` "Why 6 is the common wrong answer" ⚠)
· right (`.is-correct`, ✓) · hints opened 1–3 (`.hints .seg`: ① Nudge ②
Strategy ③ First step; each unlocks the next; `aria-expanded`) · solution
shown (after a right answer, or **Show solution** = giving up, which asks
once and records `progress.reveal`; the solution lists every common-wrong
note) · **Another one** (only if `spec.generate`: draws a new seed with
`drawProblem`, resets the card, keeps attempt counts). Foot meta: "2 attempts
· 1 hint". Writes `progress.attempt/hint/reveal` under `useKit().lessonId`.

### 8.3 `ProblemSet` ⏳ G3

```ts
interface ProblemSetProps {
  problems: readonly ProblemSpec[];
  mode?: 'paged' | 'list';             // default 'paged' (one card + dot strip); 'list' for practice pages
  title?: string;
}
```

Paged: `ol.pset` dot strip (one `button.pset__dot` per problem, 44px;
`is-solved` ✓ / `is-hinted` hatch / `is-attempted` dashed / to do; current
`aria-current="step"`; status from progress) above the current `Problem`;
**every Problem stays in the DOM** (`hidden` when not current). Next/previous
via the dots or after solving ("Next problem →").

### 8.4 `Quiz` ⏳ G3

```ts
interface QuizProps { questions: QuizSpec; title?: string }
```

`article.card.quiz`: `.quiz__top` (dot strip `ol.quiz__dots`: right = green,
wrong = red hatch, current = ink ring; "Question 2 of 5") → one
`fieldset.quiz__set[data-quiz-question=<id>]` per question (non-current
`hidden`), `legend.quiz__q`. Choice: 54px `.choice` rows with circled letter
keys; picking checks immediately: wrong → red, ×, "Not quite." + that
option's `why` right under it; right → green, ✓, "Right." + why. Drag
questions reuse the order/match inputs, with `whyRight`/`whyWrong`. Foot:
**Try again** · **Next question**. The end shows the score and a "review your
misses" list; writes `progress.quiz` and, when finished, `progress.complete`.

### 8.5 `Predict` ⏳ G3

```ts
interface PredictProps {
  spec: PredictSpec;
  children: (s: { locked: boolean; guess: unknown; setGuess: (g: unknown) => void; correct: boolean | null }) => ComponentChildren;
}
```

A "make your guess" wrapper: prompt → guess input (choice rows, a Slider for
`number`, or the children's own visual via `setGuess` for `custom`) → **Lock
in my guess** (disabled until a guess exists) → the children render the
reveal (they decide what to hide while `!locked`), then `reveal` plus the
`right`/`wrong` line with ✓/×. The guess can't change after locking (a
*Try again later* link resets it). Writes `progress.predict`.

<!-- /region:G3 -->

---

<!-- region:G5 -->
## 9. Data structures & systems (G5)

All views render a **state** (types.ts §8) and animate the change from the
previous state (FLIP on stable ids, `--dur-3`, instant under reduced motion).
Algorithms produce states as pure traces in the lesson's `math.ts` (tested:
"Dijkstra matches brute force"); `PlayScrub` scrubs them (§7.4).

**Marks** (`Mark`): `current` 2px ink ring · `compare` dashed ink ring ·
`visited` sunk fill, ink-2 text · `frontier` dotted ink outline · `done` /
`found` green wash + ✓ (the "correct" state) · `dim` 40% · `error` red wash
+ × · any other string = a lesson concept (its ink, wash and line style).
Marks always pair colour with a shape or icon. Every view has a text
alternative: an `aria-label` per element ("index 3: 7, compared with the
pivot") and a visually hidden summary of the current frame.

### 9.1 `ArrayView` ⏳ G5

```ts
interface ArrayViewProps {
  state: ArrayState | ReadonlySignal<ArrayState>;   // values, ids?, marks?, pointers?, window?
  label: string;                                    // accessible name
  showIndices?: boolean;                            // default true (0-based; say so in prose)
  cellSize?: number;                                // px, default 48 (≥ 44)
  onCellClick?: (index: number) => void;            // makes cells buttons
}
```

Cells move as cells when ids are given (swaps glide); pointers (`lo`, `mid`,
`hi`) sit under their cells and slide; `window` dims outside cells; long
arrays scroll inside their own box on phones.

### 9.2 `TreeView` ⏳ G5

```ts
interface TreeViewProps {
  state: TreeState | ReadonlySignal<TreeState>;     // root, marks?, edgeMarks?, badges?
  label: string;
  layout?: 'tidy' | 'inorder';                      // default 'tidy'; BSTs/AVL/red–black use 'inorder' (sorted left to right)
  nodeSize?: number;                                // default 44
  onNodeClick?: (id: string) => void;
}
```

Uses `layoutTidy` / `layoutInorder` (`@kit/math`); rotations animate as node
moves; `null` children keep left/right distinct; badges (balance factor,
height, colour) sit beside nodes.

### 9.3 `GraphView` ⏳ G5

```ts
interface GraphViewProps {
  state: GraphState | ReadonlySignal<GraphState>;   // graph, nodeMarks?, edgeMarks?, nodeBadges?
  label: string;
  layout?: 'given' | 'force' | 'layered' | 'circle';   // default: 'given' when every node has x, y (0..1), else 'force'
  showWeights?: boolean;
  editable?: boolean;                               // drag nodes (keyboard: arrows)
  onNodeClick?: (id: string) => void;
  onEdgeClick?: (key: string) => void;              // "from->to"
}
```

Directed edges get arrowheads; edge keys are `"from->to"` (either order for
undirected graphs); `layered` uses `layeredLayout` (DAGs, computation graphs,
topological sort); `force` uses `forceLayout` (seeded, stable).

### 9.4 `TableView` ⏳ G5

```ts
interface TableViewProps {
  state: TableState | ReadonlySignal<TableState>;   // cells, row/col headers, marks ("r,c"), arrows
  label: string;                                    // also the <caption>
  cellSize?: number;
  onCellClick?: (r: number, c: number) => void;
}
```

A real `<table>` (headers as `th scope`), dependency arrows drawn in an SVG
overlay (DP tables filling in), scrolls inside its own box on phones, tabular
mono figures.

### 9.5 `ArchDiagram` and `arch-sim` ⏳ G5

```ts
interface ArchDiagramProps {
  spec: ArchSpec;                                   // structures/types.ts: nodes (kind, x, y on a 12×8 grid, capacity, latencyMs, hitRate, policy), links, entry
  label: string;
  load?: Signal<number>;                            // offered requests per second
  running?: Signal<boolean>;
  failures?: Signal<ReadonlySet<string>>;           // failed node ids
  injectFailures?: boolean;                         // click/Enter on a node toggles its failure
  onMetrics?: (m: ArchMetrics) => void;             // also shown in a metrics strip
  seed?: number;
}
createArchSim(spec, { seed?, load }): { step(dtSeconds): ArchMetrics; setLoad(rps); fail(id, down: boolean); reset() }   // pure, deterministic
```

Animated request dots flow along links (thinned automatically at high load;
none under reduced motion, where links show a load-proportional stroke
instead); failed nodes are hatched red with ×; a metrics strip shows
throughput, p50/p95/p99, error rate and cache hit rate, `aria-live` at most
every 2 s. `arch-sim` is a discrete-event simulation tested against queueing
theory (utilisation = load/capacity; Little's law within tolerance; a failed
replica's traffic moves to the others).

<!-- /region:G5 -->

---

## 10. Building each §4 section

| § | Section (`id`) | Kit pieces |
|---|---|---|
| 1 | TL;DR (`tldr`) | `TLDR` with a `TldrSpec` |
| 2 | Hook (`hook`) | prose (`RichText` or JSX), a `Figure` with a striking visual, often `Predict` |
| 3 | Play (`play`) | `Figure central wide` + `Stage2D`/`Plot`/`MatrixGrid`/`Stage3D`/a structure view, `Mission`, `Readout`, `Legend`; **no formulas** |
| 4 | Build the idea (`build`) | 3–6 steps: `Scrolly`, or paragraphs each with a small `Figure`; `Slider`/`Toggle`/`Segmented` for focused knobs; `Predict` before reveals |
| 5 | Formalize (`formalize`) | `Formula` (explain this, live values, in words) + `Derivation`; `Callout kind="key"`; `Callout kind="simplify"` for simplifications |
| 6 | Worked examples (`examples`) | `WorkedExampleSet` (≥ 3: direct, combined, exam) |
| 7 | Code it (`code`) | `CodeCell` with `inputs`/`outputs` wired to the section's visual; physics/maths: a "simulate it" CodeCell |
| 8 | Common traps (`traps`) | `Trap` × 2–4, each with a counterexample figure |
| 9 | Practice (`practice`) | `ProblemSet` (≥ 8: 3 ★, 3 ★★, 2 ★★★) |
| 10 | Quick check (`quickcheck`) | `Quiz` (4–6) |
| 11 | Where next (`next`) | `WhereNext` with ≥ 2 `Reference`s; optional `Glossary` |

---

## 11. The gallery

Each group exports a `GalleryGroup` (gallery/types.ts) from
`src/kit/gallery/<group>.tsx`: `core` (architect), `text` (G1), `visual` (G2),
`practice` (G3), `controls` (G4), `structures` (G5). One demo per component
state worth seeing, using the reference specs in gallery/samples.ts.

- Dev pages (gitignored): `kit/_dev/<group>.html` and `kit/_dev/all.html`,
  each just `<div id="app" data-group="<group>">` + `gallery/dev.tsx`.
- Build and look:
  `npx tsx scripts/build-pages.ts <scratch>/dist kit/_dev/text.html` then
  `npx tsx scripts/shoot.ts --dist=<scratch>/dist --out=<scratch>/shots [--w=390 --h=844] [--dark] [--full] /kit/_dev/text.html`.
- The public `/kit` page (kit/index.html, all groups) is wired at integration.
