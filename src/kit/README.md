# coolstuff kit — API reference

The Preact component kit every lesson is built from (CLAUDE.md §6). This file
is the contract: five builder groups implement against it in parallel
([PLAN.md](./PLAN.md) says who owns what, and its "Review decisions" section
records why the contract looks the way it does), and lesson authors build
every §4 section with it. The design system it renders is
[DESIGN.md](./DESIGN.md) (look and classes) and [NOTATION.md](./NOTATION.md)
(maths). The data contracts are [types.ts](./types.ts).

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

A lesson folder has five files that matter. ESLint enforces who may import what (§1.1).

| File | What | May import |
|---|---|---|
| `problems.ts` | pure content with the exact export names of `LessonContent` (types.ts §11): `C`, `TLDR`, `FORMULAS`, `DERIVATIONS`, `EXAMPLES`, `PROBLEMS`, `QUIZ`, `TRAPS`, `REFERENCES`, optional `PREDICTS`, `GLOSSARY`, `SNIPPETS` | `@kit/pure`, `@kit/math`, `./math` |
| `math.ts` | pure functions behind the visuals (traces, simulations, datasets) | `@kit/pure`, `@kit/math` |
| `figures.tsx` | the small visuals that problems.ts names by `figure` key (examples, problems, custom drags, traps, quiz), with **no side effects** (§8.6) | `@kit`, `./math`, `./problems` |
| `lesson.test.ts` | `auditLesson` + every stated answer recomputed independently + the shipped code snippet run in Node | anything |
| `lesson.tsx` | the page: `mountLesson(<LessonPage>…)` | `@kit`, `./problems`, `./figures`, `./math` |

```ts
// lessons/linalg/eigenvectors/problems.ts — pure: runs in Node under vitest
import { defineConcepts, defineExample, generator, polyTex, type FormulaSpec, type ProblemSpec, type QuizSpec, type TldrSpec, type TrapSpec } from '@kit/pure';
import { charPoly2 } from '@kit/math';

export const C = defineConcepts({
  input:      { hue: 'input',  label: 'input vector', symbol: '\\vec v' },
  output:     { hue: 'output', label: 'its image',    symbol: 'A\\vec v' },
  matrix:     { hue: 'teal',   label: 'the matrix',   symbol: 'A' },
  eigenvalue: { hue: 'rose',   label: 'scale factor', symbol: '\\lambda' },
});

export const TLDR: TldrSpec = { points: ['…', '…', '…'], formula: '\\cMatrix\\cInput = \\cEigenvalue\\cInput' };
export const FORMULAS: readonly FormulaSpec[] = [{ id: 'eigen-definition', label: 'Definition', size: 'hero', tex: '\\anchor{A}{\\cMatrix}\\anchor{v}{\\cInput} = …', explain: { /* one note per \anchor id */ } }];
export const EXAMPLES = [defineExample({ id: 'ex-direct', level: 'direct', /* … */ })];
export const PROBLEMS: readonly ProblemSpec[] = [/* ≥ 8: 3 ★, 3 ★★, 2 ★★★, mixed answer kinds */];
export const QUIZ: QuizSpec = [/* 4–6 */];
export const TRAPS: readonly TrapSpec[] = [/* 2–4, each with figure, figureCaption, figureDescription */];
export const REFERENCES = [/* ≥ 2 */];
export const SNIPPETS = { power: 'let v = v0;\nfor (let k = 0; k < 20; k++) { v = normalize(apply(A, v)); emit("v", v); }' };
```

```ts
// lessons/linalg/eigenvectors/lesson.test.ts
import { describe, expect, it } from 'vitest';
import { auditFigureKeys, auditLesson, forEachSeed, resolveExample, runSnippet } from '@kit/pure';
import { LESSON_BY_ID } from '@content/curriculum';
import * as content from './problems';
import { FIGURES } from './figures';                 // no side effects, so Node can import it
import { eigenvalues } from './math';

describe('eigenvectors', () => {
  it('passes the kit audits', () => {
    expect(auditLesson(content, { knownLessons: LESSON_BY_ID.keys() })).toEqual([]);   // §4/§5/§10/§11 in one call
    expect(auditFigureKeys(content, FIGURES)).toEqual([]);                               // every figure key has a renderer
  });
  it('every stated answer is right (computed independently)', () => {
    expect(resolveExample(content.EXAMPLES[0]).value).toEqual(eigenvalues([4, 1, 2, 3]));
    // problems.ts also exports its generators (`export const triangular = generator({…})`) so tests can type the params:
    forEachSeed(content.PROBLEMS[0], content.triangular, (inst, p) => expect(inst.answer).toMatchObject({ value: [p.a, p.d] }));
  });
  it('the Code it snippet converges', () => {
    const r = runSnippet(content.SNIPPETS.power, { inputs: { A: [2, 1, 1, 2], v0: [1, 0] }, helpers: { apply: '…', normalize: '…' } });
    expect(r.ok).toBe(true);
  });
});
```

```tsx
// lessons/linalg/eigenvectors/figures.tsx — no side effects: imported by lesson.tsx AND the subject practice pages
import { defineFigures, Stage2D, Vector, MatrixGrid } from '@kit';
export const FIGURES = defineFigures({
  examples: { 'eigen-live': (p, set) => <EigenFig a={p.a} onA={(a) => set({ a })} /> },
  problems: { 'find-direction': (inst) => <DirectionFig params={inst.params} /> },
  customs:  { 'drag-v': (state, inst) => <DragEigen state={state} matrix={inst.params} /> },
  traps:    { rotation: () => <RotationFig />, 'zero-vector': () => <ZeroFig /> },
});
```

```tsx
// lessons/linalg/eigenvectors/lesson.tsx
import '@kit/styles/index.css';
import meta from './meta.json';
import { signal } from '@preact/signals';
import {
  mountLesson, LessonPage, Section, Step, TLDR, Figure, Formula, Derivation, WorkedExampleSet, CodeCell, codeOutput,
  Trap, ProblemSet, Quiz, WhereNext, MatrixGrid, imageOf, type LessonMeta,
} from '@kit';
import type { Mat2, Vec2 } from '@kit/math';
import * as content from './problems';
import { FIGURES } from './figures';

const { C, TLDR: TLDR_SPEC, FORMULAS, DERIVATIONS, EXAMPLES, PROBLEMS, QUIZ, TRAPS, REFERENCES, SNIPPETS } = content;
const A = signal<Mat2>([2, 1, 1, 2]);
const v = signal<Vec2>([1, 0.3]);
const Av = imageOf(A, v);                        // computed A·v for formulas and readouts

mountLesson(
  <LessonPage id="linalg/eigenvectors" meta={meta as LessonMeta} concepts={C} glossary={content.GLOSSARY} subtitle="the directions a matrix doesn’t turn">
    <Section id="tldr" title="Eigenvectors in three lines"><TLDR spec={TLDR_SPEC} /></Section>
    <Section id="hook" title="Which arrows survive?">…</Section>
    <Section id="play" title="Drag the arrow">
      <Figure name="eigen-play" central wide caption="…" description="…" readout={…} mission={…} legend={…}>
        <MatrixGrid matrix={A} title="An arrow and its image under A" vectors={[{ value: v, concept: 'input', label: 'the input arrow v', image: { concept: 'output', label: 'its image Av' } }]} />
      </Figure>
    </Section>
    <Section id="build" title="…"><Step n={1} title="…">…</Step>{/* 3–6 Steps (or a Scrolly) */}</Section>
    <Section id="formalize" title="Writing it down"><Formula {...FORMULAS[0]} live={{ v, Av }} /><Derivation {...DERIVATIONS[0]} /></Section>
    <Section id="examples" title="See one done"><WorkedExampleSet examples={EXAMPLES} figures={FIGURES.examples} /></Section>
    <Section id="traps" title="Where students slip">{TRAPS.map((t, i) => <Trap spec={t} n={i + 1} figures={FIGURES.traps} />)}</Section>
    <Section id="practice" title="Your turn"><ProblemSet problems={PROBLEMS} figures={FIGURES.problems} customs={FIGURES.customs} /></Section>
    <Section id="quickcheck" title="Thirty seconds"><Quiz questions={QUIZ} figures={FIGURES.quiz} /></Section>
    <Section id="next" title="Where this goes"><WhereNext lessonId="linalg/eigenvectors" references={REFERENCES} /></Section>
  </LessonPage>,
);
```

The complete reference data (one of everything in types.ts, audited by the
tests: `auditLesson(samples)` passes) is [`gallery/samples.ts`](./gallery/samples.ts).
Copy its patterns. The lesson template (`npm run new -- <subject> <slug>`,
G4) produces these files with a `wip` skeleton and this test.

---

## 1. Conventions

### 1.1 Imports and files

| Import | What |
|---|---|
| `@kit/pure` | **the Node-safe subset**: theme, notation, types, and the pure foundations (answers, expressions, units, pretty TeX, problems + audits, lesson audits, exam drawing, code running, rich text, rng, slider scales). What `problems.ts` and `math.ts` import. No Preact, no DOM, no Worker. ([pure.ts](./pure.ts)) |
| `@kit` | everything: the above plus every component (barrel: [index.ts](./index.ts)). For `lesson.tsx`, `figures.tsx` and site pages. |
| `@kit/math` | pure maths: vectors, `Mat2`/`Mat3`, `eig2`, calculus, gradients, quadratic roots, contours, gradient descent, ODE steps, ticks, stats, tree/force/layered layouts |
| `@kit/util` | browser helpers: `QualityGovernor`, `tween`, `announce`, `fitCanvas`, `printWithClass`, `registerPWA`, `workerScope`, capabilities |
| `@kit/visual/Stage3D` | 3D, including `MatrixGrid3D` (kept out of the barrel so only 3D lessons pay for it) |
| `@kit/styles/index.css` | the whole design system; every page imports it once |
| `@kit/vite-katex`, `@kit/vite-pwa` | build plugins (vite.config.ts only) |

**Import boundaries** (eslint.config.js, enforced in CI):

- `lessons/**`: no relative import leaves the lesson folder (`../` is an error:
  lessons never import each other), and the kit is imported only as
  `@kit`, `@kit/pure`, `@kit/math`, … never by file path.
- `lessons/**/{math,problems}.ts`: only `@kit/pure` and `@kit/math` from the
  kit (not the `@kit` barrel), no `.tsx`, no `preact`/`three`, no DOM globals.
  The kit's own pure modules (everything `@kit/pure` and `@kit/math`
  re-export) follow the same rule.
- [barrels.test.ts](./barrels.test.ts) imports every barrel on its own in
  Node: a component module that touches `document`, `window`, `matchMedia` or
  `Worker` at import time (instead of inside an effect) fails it, as does an
  import cycle that only bites in one evaluation order.

Folders: `core/` foundations · `text/` G1 · `visual/` G2 · `practice/` G3 ·
`controls/` + `shell/` G4 · `structures/` G5 · `gallery/` demos · `styles/`
one CSS file per group (`text.css`, `visual.css`, …) after the design-system
files. If something is useful to two lessons, it belongs in the kit.

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
| Page CSS (one lesson) | `LessonPage` calls `C.mount()`: page-wide `.ct-<name>` and `--ct-<name>` |
| Page CSS (pages that mix lessons) | `<KitProvider lessonId concepts>` renders `div.kit-scope[data-lesson="<lessonId>"]` (`display: contents`) and mounts `C.css(lessonId)`, rules limited to `[data-lesson="<lessonId>"]`. Two lessons that both define `rate` keep their own inks; the scoped rules out-rank any page-wide ones. Popovers and other portalled UI render inside the scope element (`useKit().scope`) |
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
Every concept name a lesson writes (`\colorTerm{x}`, `[text]{x}`,
`concept: 'x'` in explain notes, params, curves) is checked against `C` by
`auditLesson` (§3.10), so a typo fails the lesson's test, not the page.

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

**Keyboard path.** Focus publishes like hover, so the linkable things a
keyboard user can reach are the ones that carry the same concepts in
focusable form: Formula's explain notes and key stubs (`li[tabindex=0]`),
legend rows, Stage2D handles and labelled marks, Slider thumbs, and the
data-structure elements. Prose `span.term` and raw KaTeX symbols are *not*
in the tab order (every sentence would become a tab stop); their keyboard
counterpart is the formula's *Explain this* notes and the figure legend.

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
symbols and an *In words* sentence (`inWords`). Key formulas live as data
(`FormulaSpec` in problems.ts) so `auditLesson` checks that every `\anchor`
has a note and every note an anchor. See §5.1.

**Repeated anchors.** An id may tag several occurrences (`\anchor{v}{…}` on
both sides of $A\vec v = \lambda\vec v$). The **first** occurrence carries the
explain note, its leader and the inline live value; **every** occurrence
lights on hover. In a Derivation, the k-th occurrence of an id in one step
slides to the k-th occurrence in the next; unpaired extras fade
(`text/anchors.ts`: `anchorOccurrences`, `noteCarriers`, `pairAnchors`, tested).

### 1.7 Rich text ✅

`Rich` (types.ts) is the one prose format for statements, hints, solutions,
options, captions and notes. Rendered by `<RichText>` / `richToHtml()`:

| Syntax | Renders |
|---|---|
| `$\cMatrix\vec v$` | inline KaTeX (never breaks mid-expression) |
| `$$A\vec v = \lambda\vec v$$` | display KaTeX in its own `.math-display` box (scrolls on phones, never the page) |
| `**bold**`, `*italic*`, `` `code` `` | strong, em, code (markdown never touches maths or code) |
| `[link text](../calc1/limits/)` | link: relative, `http(s):` or `mailto:` only (anything else, e.g. `javascript:`, renders as plain text); parentheses inside the URL balance (`…/Bessel_(function)`) |
| `[the matrix]{matrix}` | concept term: ink + line-style underline, hover-linked |
| `[[eigenvalue]]`, `[[eigenvalue\|eigenvalues]]` | glossary term (`dfn.gloss`; G1's Glossary makes it a popover) |
| blank line · `- item` · `1. item` | paragraph · bullet list · numbered list |
| `\$` | a literal dollar (the audits flag `$5 and $6`-style prose caught between two dollar signs) |

Prose gets typographic minus signs, curly quotes and en-dash ranges
automatically. Concept shorthands and NOTATION.md macros work in every TeX
snippet. `richToPlain()` gives plain text for aria-labels and search.

### 1.8 Answer input syntax ✅ (expressions, numbers, units)

What a learner can type (core/expr.ts, core/units.ts, core/answers.ts).
Problem shows a live "We read: …" TeX preview (`Verdict.understood`) so they
can see how it was read.

- **Numbers**: `3`, `−4.5`, `.5`, `3.0e8`, `12,500`, and constant expressions
  `1/3`, `sqrt(2)/2`, `2pi`, `3 × 10^8`. Precision: `{ decimals: 2 }`,
  `{ sig: 3 }` or `'exact'`; tolerance is ±0.5 in the last stated digit; an
  answer that is right but too rough gets "Close. Give it to 2 decimal places."
- **Lists**: `(1, −2)` or `5, 2` (vectors in order; `ordered: false` for sets of roots).
- **Vectors up to scale** (`equivalence`): `'scalar-multiple'` accepts any
  nonzero multiple, so an eigenvector `(1, 1)` is also `(2, 2)` or `(−1, −1)`;
  `'direction'` accepts positive multiples only ("right line, wrong way" for
  the opposite). The zero vector is always rejected with its own message.
- **Matrices** (`shape: [rows, cols]`): Problem renders a grid of fields, so
  nobody guesses row- versus column-major order; typed as a list it is
  row-major (`a, b, c, d` for $\begin{bmatrix}a&b\\c&d\end{bmatrix}$).
- **Complex numbers** (`complex: true`): `1 + 2i`, `−3i`, `j` for `i`, and
  `1 ± 2i` counts as the pair; `value` holds `[re, im]` pairs.
- **Custom numeric checks** (`check(values)`): a pure function returning
  true, false or a reason, when equality isn't the question ("any vector on
  this line", "any x with f(x) < 0.01"). The audit requires `check(value)`.
- **Units**: `9.81 m/s^2`, `9.81 m/s²`, `981 cm/s^2` (converted), `36 km/h`,
  `1.2 MΩ`, `5 eV`, `2.5 ms`, `J/(kg K)`, `N·m`, `°C`, `%`, `GB/s`. Wrong
  dimension: "“m/s” measures speed, but the answer is an acceleration."
  Missing unit: "The number is right; now add the unit (m/s²)." Each list
  item converts with its own unit (`3 m, 400 cm`); one unit after the last
  value applies to all. A unitless answer typed with a unit is told "this
  answer has no unit" (radians and `%` excepted).
- **Angles vs cycles**: `rad`, `°` and `rev` carry an angle pseudo-dimension
  and `Hz` counts cycles, so ω in rad/s rejects `1 Hz` ("counts cycles per
  second … ω = 2πf") and f in Hz rejects rad/s ("f = ω/2π"), while
  revolution units convert both ways (`60 rpm` = 2π rad/s = 1 Hz).
- **Expressions**: `+ − * / ^` (also `** × · ÷ ²`), implicit multiplication
  (`2x`, `2(x+1)`, `x y`, `2 sin x`), `sin cos tan sec csc cot asin acos atan
  sinh cosh tanh exp ln log (natural) log10 log2 log_b(x) sqrt √ cbrt abs |x|
  floor ceil sign min max binom(n,k) n!`, constants `pi π e`, Greek names or
  letters (`theta`, `θ`), subscripted variables (`v_0`). `sin^2 x` = (sin x)²;
  `sin 2x` = sin(2x); `1/2x` = (1/2)·x. A leading `f'(x) =` or `v =` is ignored.
- **Equivalence**: evaluated at 24 seeded random points of the domain;
  points where the expected answer is undefined are skipped.
  `upToConstant` (antiderivatives) accepts a written `+ C` (`C`, `c`, `K`, `k`
  unless that letter is a variable; shown as "… + C" in the preview); a
  `+ C` elsewhere gets "No + C here". `disallow` (to demand a simplified
  form) matches the parsed functions, variables and constants by token, so
  disallowing `e` doesn't reject `sec x`.
- **Common wrong answers** match the way answers do: numeric strings may be
  exact forms (`'1/3'`), list answers up to the problem's `equivalence`, point
  and slider drags within the target's tolerance.

### 1.9 Accessibility baseline (every component)

- Real elements first: `button`, `input`, `fieldset/legend`, `figure/figcaption`,
  `ol` for steps. ARIA only where HTML has nothing (`role="switch"`,
  `role="slider"` on SVG handles, `role="tablist"`).
- **Focus**: never remove the 2px ink outline (`:focus-visible`), never trap
  focus. The one place Tab means something else, the CodeCell editor, has the
  standard escape: **Esc, then Tab** leaves it (§7.6), stated in a visible
  hint.
- **Targets** ≥ 44×44px (`HIT` in theme.ts), including SVG handles (transparent
  44px hit circle). Smoke measures every control at 390px; a control whose hit
  area is a larger pseudo-element (`::before { inset: -12px }`) declares it
  with `data-hit`. Radios and checkboxes count their `<label>`.
- **Keyboard parity**: everything draggable moves with arrows (Shift = bigger
  steps), Home/End where meaningful; documented in a `.fig-keys` line. Every
  clickable thing is a focusable button with an accessible name, activated by
  Enter/Space: data-structure cells, nodes and edges (§9), Plot's cursor
  (`role=slider`, §6.2), a pannable Stage2D (arrows pan when the stage has
  focus, §6.1), quiz options, set dots, example tabs.
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
- **Headings**: one `h1` (the lesson title), sections are `h2`, anything inside
  them `h3`; never skip a level (smoke checks).

### 1.10 Performance

- A figure is two layers (DESIGN.md §5): a static layer drawn once per resize
  and a light dynamic layer repainted during drags. Budget: ≤ 16ms per drag
  frame on a mid phone. Long-running visuals use `QualityGovernor` (≥ 55fps
  or scale detail down) and pause off-screen (`useInView`).
- Heavy libraries load lazily inside the component (`await import('three')`,
  `const { forceSimulation } = await import('d3')`), never at the barrel's top
  level. (Only the `d3` package is a direct dependency; don't import its
  `d3-*` sub-packages by name. The kit's own `forceLayout` usually suffices.)
- **Render what's visible, typeset on demand.** Lessons are client-rendered
  and a lesson holds 400–600 TeX snippets, most of them in hints, solutions
  and unrevealed steps. Only the counted containers must exist at load (§2);
  hints, full solutions, wrong-answer notes, unrevealed example steps, quiz
  explanations and non-current problems' bodies render on first open (or in
  `requestIdleCallback` once the page is idle). This keeps the first paint
  within Lighthouse performance ≥ 85 (CLAUDE.md §11).
- KaTeX output is memoised (RichText, Tex) per macros object; don't create a
  new `macros` object per render.
- No runtime network requests, ever (smoke fails on any).

---

## 2. The DOM contract (scripts/smoke.ts)

`npm run smoke` loads every page at 1280×800, at 390×844 (touch), and in a
dark + reduced-motion pass, and fails on any console error or warning, an
uncaught exception, a 4xx/5xx or external request, a KaTeX error, horizontal
scroll on the phone, a blank screen, skipped heading levels or more than one
`h1`, and (on the phone) a control smaller than 44×44px or without an
accessible name. It then cuts the network after one visit and opens a lesson
again (offline, §3.16). Components must render exactly these hooks:

| Hook | Rendered by | Smoke rule |
|---|---|---|
| `<section data-section="<id>" id="<id>">` with id ∈ `tldr hook play build formalize examples code traps practice quickcheck next` | `Section` | all present (`code` required for `CODE_SUBJECTS` in types.ts: dsa, sysdesign, systems, ml, dl, diffusion, llm; smoke imports the list) |
| `.tldr` inside `[data-section="tldr"]` | `TLDR` | visible in print media with `body.print-card` (a print screenshot is taken) |
| `[data-step]` inside `[data-section="build"]` | `Step`, or each step of `Scrolly` | 3–6 |
| `[data-formula="<id>"][data-explain]` inside `[data-section="formalize"]` | `Formula` with at least one explain note | ≥ 1 |
| `[data-worked-example="<id>"]` inside `[data-section="examples"]` | `WorkedExample` (its `<article>`), or each tab panel of `WorkedExampleSet` | ≥ 3 |
| `[data-trap="<id>"]` inside `[data-section="traps"]` | `Trap` (its `<article>`) | 2–4 |
| `[data-problem="<key>"]` inside `[data-section="practice"]` | `Problem` (its `<article>`) | ≥ 8 |
| `[data-quiz-question="<id>"]` inside `[data-section="quickcheck"]` | each question of `Quiz` | 4–6 |
| `[data-ref]` inside `[data-section="next"]` | each `li` of `References` (in `WhereNext`) | ≥ 2 |
| `.katex` anywhere | Tex/Formula/RichText | ≥ 1; zero `.katex-error` |
| `<figure data-figure="<name>">` with a non-empty `<figcaption>` | `Figure` (also `Trap`'s counterexample) | every one has a caption; every **visible** one is ≥ 40×40px and not blank (luminance std-dev ≥ 1.5) |
| `[data-thumb]` | `Figure central` | frames the 1200×750 thumbnail (else the play section) |
| `<title>` | lesson `index.html` | non-empty |

**Counted containers are always in the DOM; their contents may wait.** A
paged `ProblemSet` renders every `article[data-problem]` (header and prompt)
and marks the non-current ones `hidden`; `Quiz` renders every
`fieldset[data-quiz-question]` (prompt and options), `hidden` when not
current; `WorkedExampleSet` renders every tab panel (statement, known/want,
strategy and step 1), `hidden` when inactive. Hints, solutions, wrong-answer
notes, later steps and a hidden problem's input mount when first opened
(§1.10). Never lazy-mount the containers themselves.

**Figures in hidden panels** (an inactive example tab, a non-current problem)
can't be measured, so smoke checks their caption but skips the size and
blankness checks; the gallery and the visible instances cover them. Smoke
fails if *every* figure on a page is hidden.

**Keys on pages that mix lessons** (subject practice, exam set): `data-problem`
is `problemKey(lessonId, id)` = `"calc1/derivative:p-2"`, and element ids
derived from it go through `domId()` (`calc1-derivative--p-2`), so two
lessons' `p-2` never collide (§8.6).

Each figure also needs a prose description for screen readers: `Figure`'s
`description` (a visually hidden paragraph referenced by `aria-describedby`),
`TrapSpec.figureDescription` for a trap's counterexample.

---

## 3. Foundations (core, math, util) ✅

All implemented and unit-tested now (`src/kit/**/*.test.ts`). Pure modules
work in Node and are re-exported by `@kit/pure`; `.tsx` ones are small
Preact components.

### 3.1 Context — `KitProvider`, `useKit`, `useMacros` (core/context.tsx)

```ts
interface KitContextValue {
  lessonId?: string;                         // progress key prefix, e.g. 'linalg/eigenvectors'
  subject?: string;                          // derived from lessonId
  concepts?: ConceptSet;
  macros: Readonly<Record<string, string>>;  // concept shorthands (+ extras); NOTATION macros are always on
  scope?: string;                            // lesson id whose scoped concept CSS is active here
}
<KitProvider lessonId? concepts? macros? scoped?>{children}</KitProvider>   // nests: inner values override
useKit(): KitContextValue
useMacros(extra?): macros                    // memoised merge, for KaTeX caching
```

`LessonPage` provides it (unscoped: it mounts its one lesson's concepts
page-wide). Given both `lessonId` and `concepts`, a provider is **scoped** by
default: it renders `div.kit-scope[data-lesson]` (`display: contents`) and
mounts `concepts.css(lessonId)` limited to it (ref-counted; removed on
unmount). Pages that mix lessons wrap each problem in its own scoped
provider, so progress lands on the right lesson and inks stay per lesson.

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
//   IconPrev IconNext IconPlay IconPause IconMoon IconSun IconBook   (any group may add one: PLAN §2)
useMediaQuery(q) · useReducedMotion() · usePhone() (< 700px) · useCoarsePointer()
useTheme(): 'light' | 'dark' · useProgress(): ProgressData
useElementSize(target: ObserveTarget) · useInView(target: ObserveTarget, margin?)
type ObserveTarget = RefObject<Element> | Element | null | undefined
```

The measuring hooks take an element or a ref and **re-attach whenever the
element changes**, so a Stage2D inside a panel that mounts later (a Predict
reveal, a lazily rendered tab) still measures itself. Best form: a callback
ref, `const [el, setEl] = useState<HTMLElement | null>(null); <div ref={setEl}>`.

### 3.7 Answer checking (core/answers.ts)

```ts
checkNumeric(input: string, spec: NumericAnswer, commonWrong?): Verdict      // numbers, lists, matrices, complex, units, equivalence, check()
checkSymbolic(input: string, spec: SymbolicAnswer, commonWrong?): Verdict    // + C, token-level disallow
checkChoice(selected: number | number[], spec: ChoiceAnswer, commonWrong?): Verdict
checkDrag(state: unknown, target: DragTarget, commonWrong?): Verdict
   // state: Vec2 (point) · number (slider) · number[] item order (order) · number[] slot per item, −1 = unplaced (match) · anything (custom)
checkProof(ticked: boolean[], spec: ProofAnswer): Verdict
checkAnswer(spec, response: AnswerResponse, commonWrong?): Verdict      // dispatch (not code)
type AnswerResponse = { kind: 'numeric' | 'symbolic'; text } | { kind: 'choice'; selected } | { kind: 'drag'; state } | { kind: 'proof'; ticked }
toleranceFor(precision, value) · describePrecision(precision) · formatAtPrecision(value, precision) · writtenPrecision(text)
multipleOf(got, want, spec): 'match' | 'opposite' | 'zero' | 'no' · parseComplex(text) · stripIntegrationConstant(text, vars) · dragStateOf(commonWrong)

interface Verdict {
  correct: boolean;
  reason: 'correct' | 'wrong' | 'empty' | 'unparseable' | 'precision' | 'unit-missing' | 'unit-dimension' | 'unit-exact' | 'count' | 'form' | 'incomplete';
  message: string;          // "Not 6." · "Right: 7.00." · "Close. Give it to 2 decimal places."
  commonWrong?: number;     // index into the problem's commonWrong: show that note
  understood?: string;      // TeX preview of what was parsed
}
```

Expressions (core/expr.ts): `parseExpr(src, { vars })`, `tryParseExpr`,
`evaluateExpr(expr, scope)`, `compileExpr(expr)`, `exprToTex(expr, { pretty? })`
(the literal "we read" preview, or tidy display TeX with `pretty`), `tidyExpr`,
`equivalent(expected, got, { vars, domain?, samples?, upToConstant?, rtol?, atol? })`,
`evalNumber(src)`, `exprVars`, `exprFunctions`, `exprConstants`, `gamma`,
`factorial`. Errors are `ExprError { code, pos, message }` with learner-facing
messages. Units (core/units.ts): `parseUnit`, `sameDimension`, `angleCompat`,
`convert`, `dimensionName`, `splitQuantity`, `unitToTex`, `prettyUnit`, `UnitError`.

### 3.8 Running code (core/codecheck.ts)

Pure and synchronous, so **lesson tests and the sandbox Worker run exactly the
same functions**:

```ts
runSnippet(code: string, { inputs?, helpers?, prelude?, onEmit?, maxStream? }?): SnippetResult    // a "Code it" cell
interface SnippetResult {
  ok: boolean; logs: string[];
  emits: Record<string, unknown>;      // LAST value per emitted name (what a visual shows when the run ends)
  streams: Record<string, unknown[]>;  // EVERY value per name, in order, each a snapshot (capped at maxStream, default 10,000)
  returned?: unknown;                  // a top-level `return`
  error?: { message: string; line?: number /* 1-based in the visible code */; where: 'code' | 'prelude' };
}
runCodeTests(source, { entry, tests }, { helpers?, prelude? }?): CodeRunReport   // a write-the-code problem
codeVerdict(report): Verdict
sanitizeReport(report): CodeRunReport  // safe to postMessage and show: hidden tests keep only name + pass/fail; `got` becomes text
cloneIssue(value, path?): string | null  // why a value can't cross into a Worker (functions, symbols, DOM nodes, class instances, signals), with its path
toCloneable(value)                     // the value, or its display text when it can't be cloned
compareValues(got, expected, 'deep' | 'approx' | 'unordered' | 'set', tolerance?) · stable(v) · formatValue(v)
interface CodePrelude { prelude?: string; helpers?: Record<string, string | ((...a: never[]) => unknown)> }
```

Inside a snippet: `emit(name, value)` publishes plain data (emitting a
function throws a learner-facing error), `console.*` is captured, `inputs`
are read-only (deep-frozen clones), and `helpers` / `prelude` are hidden
source that runs first (a helper is a source string, or a self-contained
function sent as its `toString()`). Error lines are relative to the visible
code even after a prelude; an error inside the prelude says so. `-0` counts
as `0` in comparisons. Lesson tests assert what the shipped snippet does
(`runSnippet(SNIPPETS.gd, { inputs, helpers })` converges). Never run learner
code on the main thread: in the browser it goes through `runSandboxed`
(§7.7), which calls these functions in a Worker with a time limit.

### 3.9 Problems and worked examples (core/problems.ts)

```ts
generator<P>(g: ProblemGenerator<P>): ProblemGenerator<P>      // identity, for type inference
drawProblem(spec: ProblemSpec, seed: number): ProblemInstance  // seed 0 = authored; else rejection-sample the generator
drawTyped<P>(spec, gen: ProblemGenerator<P>, seed): ProblemInstance & { params: P }   // throws unless spec.generate === gen
forEachSeed<P>(spec, gen, (inst, params: P, seed) => void, n = 200)                   // recompute every generated answer, typed
defineExample<P>(spec: WorkedExampleSpec<P>): WorkedExampleSpec // erases P so examples share an array
resolveExample(spec, params?): ResolvedExample                 // every Live field computed
exampleDefaults(spec) · acceptParams(spec, params): true | string · paramSamples(spec): ParamValues[]   // samples skip what accept() rejects
auditProblems(specs, { concepts?, macros?, seeds? = 60, minProblems? = 8, knownLessons? }): string[]
auditExamples(specs, { concepts?, macros?, minExamples? = 3, knownLessons? }): string[]
auditQuiz(quiz, { concepts?, macros? }): string[]
auditRich(where, text, opts, out) · auditTex(where, tex, opts, out) · findUglyNumbers(text)
class DegenerateGeneratorError
```

The problem audits encode CLAUDE.md §5/§10: counts and difficulty mix, and at
least two answer kinds among 8+ problems ("mix the types"); unique ids;
exactly 3 distinct hints; a justified solution; a common-wrong note that the
checker does **not** accept (drag common wrongs must be well-formed states);
the canonical answer that the checker **does** accept (as typed, scaled under
`equivalence`, through `check`); valid units and TeX (rendered with KaTeX,
lesson macros included); real concept names; no float noise, NaN or `-0`;
in generated output no ugly typesetting either (`+ -`, `1x`, `x^1`: §3.11);
choice/drag indices in range and not pre-solved; a custom drag target only on
a problem with a `figure`; code solutions that pass and starters that don't;
generators that never exhaust their rejection budget over 60 seeds and
actually vary. The example audits require ★/★★/★★★ levels, a `uses` lesson
for combined examples (checked against curriculum ids), a `tryIt` prompt on
every step after the first, `accept()` passing at the defaults, and clean,
finite output at every sampled parameter setting.

### 3.10 Lesson content and lesson audits (core/lesson-audit.ts)

`problems.ts` exports the `LessonContent` names (types.ts §11). One call
audits all of it:

```ts
auditLesson(content: Partial<LessonContent>, { knownLessons?, seeds? }?): string[]   // each message prefixed by its section
auditTldr · auditFormulas · auditDerivations · auditTraps · auditReferences · auditPredicts · auditGlossary   // the parts
anchorIds(tex): string[]                                                              // unique \anchor ids, in order
figureKeys(content): { examples; problems; customs; traps; quiz }                     // every figure key the content uses
auditFigureKeys(content, FIGURES): string[]                                           // each key has a renderer; none orphaned
validateLessonModule(mod): string[]                                                   // the minimal contract build-index checks: C + PROBLEMS
```

`auditLesson` runs the three audits above and adds: TL;DR (3 points, valid
formula and key), ≥ 1 key formula whose every `\anchor` has an explain note
and vice versa (brackets on real anchors), derivations with ≥ 2 steps each
justified, 2–4 traps each with a figure key, caption and description, ≥ 2
references with authors, title and year (or URL), predictions with a
judgeable guess, glossary terms, non-empty snippets, and every concept name
resolved against `C`. `scripts/build-index.ts` imports every lesson's
problems.ts in Node (so it must stay pure) and fails a shipped lesson without
`C` and `PROBLEMS`.

### 3.11 Pretty TeX for generators and live examples (core/pretty.ts)

Generated problems are never ugly (CLAUDE.md §5). Build TeX and answer
strings from random coefficients with these, never by string templates:

```ts
texNum(x, { frac?, maxDen?, decimals? })   // '3', '0.3' (noise trimmed), '-\tfrac{1}{2}' with frac; never '-0'
exprNum(x, opts)                            // the same in answer-input syntax: '-(1/2)'
signedTerm(c, body, first?, opts)           // '+ 3x', '- x', '' for 0; first: '3x', '-x'
sumTex([{ c, body }, …], opts)              // a tidy sum: signs folded, zero terms dropped, '0' if empty
polyTex([3, -2, 1], 'x')                    // '3x^{2} - 2x + 1'      (coefficients from the highest power)
polyExpr([3, -2, 1], 'x')                   // '3x^2 - 2x + 1'        (for SymbolicAnswer.expr / commonWrong)
texParen(x)                                 // '(-2)' for substituting into a product
exprToTex(parseExpr(s), { pretty: true })   // tidy any expression: folds unary minus, drops 1· and +0
findUglyTex(tex, { strict? })               // ['double sign "+ -"', 'coefficient 1 in "1x"', 'exponent 1 "^1"', …]
```

The audits run `findUglyTex` on everything: double signs in authored text,
the full check (coefficient 1 or 0, `x + 0`, `x^1`, `\cdot 1`, `\frac{…}{1}`)
on everything a generator or live parameter produced.

### 3.12 Progress (core/progress.ts)

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
quick check is finished · `Predict` → predict · `ExamSet` → exam, plus an
attempt per answered question. Problems always write under their **own**
lesson id (the `lessonId` prop or the nearest `KitProvider`), never the page's.

### 3.13 Randomness (core/rng.ts)

```ts
createRng(seed: number | string): Rng   // next float int intExcept pick shuffle sign chance normal fork
hashSeed(text): number · randomSeed(): number (never 0)
```

### 3.14 Slider scales (core/slider-scale.ts)

The value ↔ track mapping behind `Slider` (§7.1), pure and tested:

```ts
interface SliderScale { min; max; step?; scale?: 'linear' | 'log'; exclude?: readonly number[]; sig?: number }
validateSliderScale(s)                       // throws on max ≤ min, log with min ≤ 0, step ≤ 0
sliderPosition(value, s): number             // 0…1
sliderValue(pos, s, prev?): number           // snapped, clamped, never on an excluded value
snapSliderValue(raw, s, prev?) · stepSliderValue(value, ±1, s, big?)   // keys always move on a log scale
formatSliderValue(value, s): string          // step decimals (linear) or significant figures (log); U+2212 minus
decimalsForStep(step)
```

A log scale gives equal track distance to equal ratios (a learning rate from
0.001 to 1.5 has resolution at both ends); `exclude: [0]` keeps $h$ off zero,
so a difference quotient never divides by it.

### 3.15 Maths (`@kit/math`) and utilities (`@kit/util`)

`@kit/math`: `clamp lerp invLerp remap approxEqual easeInOut easeOut snapTo
roundSig linspace range` · `Vec2/Vec3: add sub scale dot cross norm dist perp
angleOf angleBetween lerpVec normalize rotate project reject closestOnSegment
closestOnLine closestOnPolyline add3 … cross3 normalize3` · `Mat2/Mat3:
fromColumns2 columns2 det2 trace2 transpose2 apply2 mul2 inverse2 lerpMat2
rotation2 eig2 (+ Mat3: fromColumns3 columns3 apply3 mul3 transpose3 det3
inverse3 lerpMat3)` · `orbitBasis projectOrbit` · `derivative
secondDerivative integrate riemann bisect newton findRoots rk4Step eulerStep
symplecticEulerStep` · **analysis**: `gradient2(f, p, h?)`, `hessian2(f, p, h?)`,
`secantSlope(f, x, h)` (NaN at h = 0, by design), `quadraticRoots(a, b, c)`
(stable; real / repeated / complex / linear), `charPoly2(M)` (→ `[1, −tr, det]`),
`gdPath(grad, x0, eta, n, { divergeAt?, tol? })` (scalar or vector; reports
`'diverged' | 'converged' | 'steps'`) · **contours**: `contours(f, view,
levels | n, res)` (marching squares, closed loops joined),
`contourLevels(min, max, n)` · `niceStep ticks decimalsFor fmt` · `mean
variance stdev histogram mulberry32 randn` · `layoutInorder layoutTidy
forceLayout layeredLayout`.

`@kit/util`: `prefersReducedMotion isTouchDevice hasWebGL2 hasWebGPU clampedDpr
safeStorage` · `FpsMeter QualityGovernor` · `registerPWA serviceWorkerUrl` ·
`uid tween rafThrottle debounce announce attr fitCanvas` ·
`printWithClass(className)` (adds a body class, prints, and removes it on
`afterprint`, because `print()` returns immediately on iOS Safari and Firefox
Android) · `workerScope()` / `inWorker()` (a typed dedicated-worker global
without the clashing `webworker` lib).

### 3.16 Build plugins: KaTeX prerender and offline (src/kit/vite-katex.ts, vite-pwa.ts)

**KaTeX.** Registered in vite.config.ts. In any HTML page, `<span class="tex">…</span>`
(inline) and `<div class="tex-block">…</div>` (display) become KaTeX at build
time with the same options and macros as runtime; a TeX error fails the build.
(Lessons are client-rendered, so this helps static pages; lesson performance
comes from §1.10.)

**Offline and install** (CLAUDE.md §1). `pwaPlugin()` adds
`<link rel="manifest">` (relative to each page's depth) and a `theme-color`
meta to every page, writes `dist/manifest.webmanifest` (icons from
`public/icons/icon-{192,512}.png` when present, else the SVG favicon) and
`dist/sw.js`, whose precache list is **every page and asset in dist/** (HTML,
JS, CSS, woff2, images, JSON; not KaTeX's duplicate .woff/.ttf, source maps
or huge files), so every lesson and every lazily imported chunk works offline
after the first visit. Pages are network-first, hashed assets cache-first; a
new deploy replaces the cache. `registerPWA()` (called by `mountLesson` and
site pages) derives the worker URL from the manifest link, so it works at any
depth and under a GitHub Pages sub-path. Smoke checks it offline.

---

<!-- region:G4-shell -->
## 4. Lesson shell (G4)

### 4.1 `LessonPage` ⏳ G4

The page frame every lesson uses. Provides context, linking, progress,
concepts CSS, glossary, masthead, contents rail, lesson head and colophon.

```ts
interface LessonPageProps {
  id: string;                       // 'linalg/eigenvectors' (must match curriculum.ts)
  meta: LessonMeta;                 // the lesson's meta.json (cast: `meta as LessonMeta`)
  concepts: ConceptSet;             // C from problems.ts
  glossary?: readonly GlossaryTerm[];   // GLOSSARY from problems.ts (default: meta.glossary); registered for popovers
  subtitle?: string;                // "the directions a matrix doesn’t turn"
  children: ComponentChildren;      // <Section>s in §4 order
}
mountLesson(vnode, el?: string | HTMLElement = '#app'): void   // initTheme, render, registerPWA() (URL from the manifest link)
```

DOM (layout.css): `a.skip-link` → `header.masthead` (`SiteHeader`) →
`div.page` > **`nav.rail`** (must come first: `.page` is a two-column grid at
≥ 1240px) + `main.lesson#main` > `header.lesson-head` (kicker "Subject ·
Lesson n", `h1.lesson-title` with `__main`/`__sub`, `ul.lesson-meta`: minutes,
level pill, prerequisite links) → sections → `footer.colophon`.

Behaviour: `C.mount()` once (page-wide); `KitProvider { lessonId: id,
concepts, scoped: false }`; `installLinking()`; `installGlossary()` with the
lesson's terms registered; `progress.visit(id)`; an IntersectionObserver
marks each section seen (`progress.section`) and drives the rail's
`aria-current` and the masthead progress; `?thumb` in the URL hides the
masthead for thumbnail capture. Title: `document.title = "<title> — coolstuff"`
when missing. LessonPage imports `../text/Glossary` directly, never the
`../text` barrel (PLAN §3: no barrel cycles).

### 4.2 `Section` and `Step` ⏳ G4

```ts
interface SectionProps {
  id: LessonSectionId;              // one per page; the §4 id
  title: string;                    // the h2
  kicker?: string;                  // default SECTION_KICKERS[id]
  children: ComponentChildren;
}
interface StepProps {               // one "Build the idea" step (§4.4: 3–6 per lesson)
  n?: number;                       // shown as the step number; default: position among the section's steps
  title?: Rich;                     // a short h3
  children: ComponentChildren;      // a sentence or two + one focused interactive (usually a small Figure)
}
```

`Section` → `<section class="section" id data-section aria-labelledby>` with
`header.section__head` (`p.kicker` with `span.kicker__num` = position among
the page's sections, then `h2`). The first section gets `section--first`.
Registers itself with LessonPage for the rail and progress.
`Step` → `div.build-step[data-step]` with an optional `h3.build-step__title`
prefixed by its number; Scrolly steps carry `data-step` too (§7.5), so smoke
counts either form.

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
`p.label` "References" + `ol.refs` with one `li[data-ref]` per reference
(small-caps authors, italic title, edition, publisher, year, section; URLs as
text, never fetched). Links are relative (`../../<subject>/<slug>/`).

<!-- /region:G4-shell -->

---

<!-- region:G1 -->
## 5. Formulas & text (G1)

### 5.1 `Formula` ⏳ G1

KaTeX with colour-linked terms, live values and explain-this. Key formulas
are `FormulaSpec`s in problems.ts (types.ts §4, audited); spread one in and
add the live values: `<Formula {...FORMULAS[0]} live={{ v, Av }} />`.

```ts
interface FormulaProps {
  tex: string;                                  // tag symbols with \anchor{id}{…}; colour with \cX shorthands
  id?: string;                                  // FormulaSpec.id: the DOM id and data-formula value
  label?: string;                               // bar label: "Definition", "Key formula"; default "Formula"
  size?: 'display' | 'key' | 'hero';            // default 'key' (math-key); 'hero' for the Formalize definition
  explain?: ExplainMap;                         // { [anchorId]: { word, gloss, concept? } } → "Explain this" switch
  brackets?: readonly FormulaBracket[];         // labels above groups: { anchor, text, concept? }
  explainDefault?: boolean;                     // default false
  live?: Readonly<Record<string, LiveValue | { value: LiveValue; decimals?: number; unit?: string }>>;  // → "Live values" switch
  liveDefault?: boolean;                        // default false; inline .lv values show whenever `live` is set
  inWords?: Rich;                               // italic "In words" sentence with [terms]{concept}
  macros?: Readonly<Record<string, string>>;
}
```

States: plain · explain on (wide: notes under symbols, curved leaders in the
concept's ink, packed with no overlaps or crossings, brackets above; < 560px
block width: `.is-stacked` dotted-rule key + `.term-stub` under each symbol) ·
live on (`.lv-grid` exploded view) · hover-linked (any symbol, note or bracket
lights its concept/term everywhere via the link bus).
Repeated anchors (§1.6): the note, leader, stub and inline live value attach
to the **first** occurrence of an id; every occurrence carries
`data-anchor` and lights; use `text/anchors.ts` (`noteCarriers`).
A11y: switches are `button.switch[role=switch][aria-checked]`; notes are a
real `ol` whose items are focusable (`tabindex=0`, publishing their concept
and term on focus: the keyboard route to hover-linking) with the symbol's
MathML; leaders/brackets are aria-hidden decoration; live values are
announced politely at most once per second.
DOM: `.formula[data-formula=<id>][data-explain]` (`data-explain` present
whenever `explain` has a note; smoke counts it in Formalize) >
`.formula__bar` (`p.label` + `.formula__toggles`) + `.formula__stage`
(`.formula__over` brackets, the KaTeX, `ol.formula__notes`
`li[data-for][data-concept]`, `svg.formula__leaders`) + `.lv-grid` + `p.in-words`.
Explain layout is pure and tested (`text/explain-layout.ts`, from the
prototype in `text/explain-proto.ts`).

```tsx
<Formula
  label="Definition" size="hero"
  tex="\anchor{Av}{\anchor{A}{\cMatrix}\anchor{v}{\cInput}} = \anchor{lam}{\cEigenvalue}\anchor{v}{\cInput}"
  explain={{ A: { word: 'the matrix', gloss: 'a rule that moves every vector', concept: 'matrix' },
             v: { word: 'a nonzero vector', gloss: 'the same one on both sides', concept: 'input' },
             lam: { word: 'a plain number', gloss: 'how much $\\vec v$ is stretched', concept: 'eigenvalue' },
             Av: { word: 'the image', gloss: 'where $A$ sends $\\vec v$', concept: 'output' } }}
  brackets={[{ anchor: 'Av', text: 'where $A$ sends $\\vec v$', concept: 'output' }]}
  live={{ v, lam }}
  inWords="Applying [the matrix]{matrix} to [the vector]{input} gives back the same vector, only stretched by [the number $\lambda$]{eigenvalue}."
/>
```

### 5.2 `Derivation` ⏳ G1

```ts
interface DerivationProps {
  steps: readonly DerivationStep[];   // { rel?: TeX relation, tex, why: Rich }; mark changes with \chg{…}
  id?: string;                        // DerivationSpec.id (spread a spec: <Derivation {...DERIVATIONS[0]} />)
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
their old position to the new one (FLIP, ≤ 420ms), paired in order of
occurrence (`pairAnchors`): the k-th `v` goes to the k-th `v`, unpaired
extras fade out (old step) or in (new step)**. The current step has
`.is-current` (2px ink rule). Reduced motion: no slides or sweeps, states
still change. Print and `?all`: every step shown.
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
popover (definition as Rich, so TeX shows; "Defined in *Lesson*" link; Esc
closes; never covers the term itself; stays on screen at 390px; rendered
inside the current concept scope, `useKit().scope`). Unknown terms render as
plain text and log nothing. `LessonPage` calls `installGlossary()` and
registers the lesson's `GLOSSARY` (or `meta.glossary`). Definitions are Rich
everywhere (problems.ts `GLOSSARY`, meta.json `glossary`); build-index strips
them to plain text for search.

### 5.4 `TLDR` ⏳ G1

```ts
<TLDR spec: TldrSpec />   // { points: [3 × Rich], formula: TeX, key?: { tex, text }[] }
```

`.card.tldr.is-wide`: head (label "In brief · revision card" + **Print card**
`btn--sm`, which calls `printWithClass('print-card')` from `@kit/util`: the
class is removed on `afterprint`, never synchronously, because `print()`
returns immediately on iOS Safari and Firefox Android), `ol.tldr__points`
(italic old-style numerals), `.tldr__formula` (the formula at `math-key` + a
`dl.key`). Prints as the revision sheet (DESIGN.md §12); smoke screenshots
it in print media.

### 5.5 `Trap`, `Callout`, `Sidenote` ⏳ G1

```ts
interface TrapProps {
  spec: TrapSpec;                              // myth, explanation, truth, figure key, figureCaption, figureDescription
  n?: number;
  figures?: LessonFigures['traps'];           // FIGURES.traps from figures.tsx: renders figures[spec.figure]()
  figure?: ComponentChildren;                  // or the counterexample directly (wins over `figures`)
}
<Callout kind?: 'note' | 'key' | 'simplify' label?: string>{children}</Callout>
<Sidenote>{children}</Sidenote>                                 // numbered sn-ref + .sidenote (margin ≥ 1000px, folds inline below)
```

`Trap` → `article.card.trap[data-trap=<id>]`: ⚠ + the myth in quotes
(`.trap__title`), `.trap__body` with `.trap__text` (explanation, then "What's
true." `.trap__truth`) and `figure.trap__fig[data-figure="trap-<id>"]` with
`figcaption` = `figureCaption` and a visually hidden `figureDescription`
(`aria-describedby`). Every trap has its visual counterexample (§4.8;
`auditTraps` requires the key, caption and description). If no renderer is
found for the key, Trap renders **no** `<figure>` (an empty one would be a
blank figure) and logs a `console.error` naming the key, which fails smoke
and the gallery, so it can't ship. `Callout kind="simplify"` is how lessons
say "we're ignoring air resistance here" (§10). Trap renders its own figure
markup; it never imports the shell's `Figure` (PLAN §3).

### 5.6 RichText polish ⏳ G1

G1 owns core/richtext.ts after handoff: keep the syntax in §1.7 backward
compatible (only add), keep `richToHtml` pure and memoised and its link
safety (`safeHref`), add glossary popover wiring through `installGlossary`.

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
  onDragStart?(): void
  onDragEnd?(value: Vec2): void                  // e.g. a Predict guess: onDragEnd={setGuess}
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

**Reactivity.** Every primitive that takes `Vec2 | ReadonlySignal<Vec2>` (and
`Curve`'s `f`, `CanvasLayer`'s `draw`) reads its signals inside the dynamic
layer's render: a signal change re-renders only that primitive, at most once
per animation frame; the static layer never repaints for a signal.
**Keyboard.** Handles: arrows (Shift ×5), Home/End along a `curve`/`line`
constraint. When `pan` or `zoom` is on, the stage itself is focusable
(`tabindex=0`, `aria-label` = title + "use arrow keys to pan"): arrows pan
by a tenth of the view, `+`/`−` zoom, `0` resets the view; the stage's own
`.fig-keys` line says so.

### 6.2 `Plot` ⏳ G2

Charts on Stage2D: functions, parametric curves, points, live series,
histograms, bars, vector fields, contour maps, heat maps, shaded areas and
Riemann sums.

```ts
type Fn1 = (x: number) => number;
type Fn2 = (x: number, y: number) => number;
type MaybeSignal<T> = T | ReadonlySignal<T>;
interface PlotProps {
  title: string;
  x: readonly [number, number];
  y: readonly [number, number] | 'auto';
  series: readonly PlotSeries[];
  xLabel?: Rich; yLabel?: Rich;
  cursor?: Signal<number>;           // draggable vertical cursor at this x (linked plots share one signal)
  equalScale?: boolean;              // default false for plots (true for contour/heat maps of a 2D domain)
  aspect?: Stage2DProps['aspect'];
  children?: ComponentChildren;      // extra primitives on top (Handle, Point, Label…)
}
type PlotSeries =
  | { kind: 'function'; f: MaybeSignal<Fn1>; concept?: string; label?: Rich }
  | { kind: 'parametric'; f: MaybeSignal<(t: number) => Vec2>; t: readonly [number, number]; concept?: string; label?: Rich }
  | { kind: 'points'; data: MaybeSignal<readonly Vec2[]>; concept?: string; label?: Rich }
  | { kind: 'line'; data: MaybeSignal<readonly Vec2[]>; concept?: string; label?: Rich }   // live series (training loss, an iterate path)
  | { kind: 'histogram'; data: MaybeSignal<readonly number[]>; bins: number; range?: readonly [number, number]; density?: boolean; concept?: string }
  | { kind: 'bars'; values: MaybeSignal<readonly number[]>; labels?: readonly string[]; concept?: string }
  | { kind: 'field'; F: MaybeSignal<(x: number, y: number) => Vec2>; density?: number; concept?: string }
  | { kind: 'contour'; f: MaybeSignal<Fn2>; levels?: readonly number[] | number; resolution?: number; concept?: string; labels?: boolean; label?: Rich }
  | { kind: 'heat'; f: MaybeSignal<Fn2>; range?: readonly [number, number]; resolution?: number; scheme?: 'sequential' | 'diverging'; concept?: string; label?: Rich }
  | { kind: 'area'; f: Fn1; from: MaybeSignal<number>; to: MaybeSignal<number>; concept?: string }
  | { kind: 'riemann'; f: Fn1; a: number; b: number; n: MaybeSignal<number>; rule: MaybeSignal<RiemannRule>; concept?: string };
```

**Reactivity (binding, tested).** Each series is sampled inside its own
`computed`. A series whose `f` *reads signals when called* (a tangent line
at a dragged `x0`, the secant for a slider `h`, a Taylor partial sum with `n`
terms) or that is given signals (`f` as a `ReadonlySignal<Fn1>`, `data`,
`n`, `from`, …) re-samples **only that series**, on the dynamic layer, at most
once per frame; series that read no signals are sampled once per resize on
the static layer. Never rebuild the `series` array per render to "refresh"
a curve: write a signal. Adaptive sampling (`function`) breaks at poles
(tan x shows no vertical connector) and `auto` y-ranges ignore infinities.

```tsx
const x0 = signal<Vec2>([1, 1]);                         // a handle on the curve
const tangent = (x: number) => f(x0.value[0]) + derivative(f, x0.value[0]) * (x - x0.value[0]);
<Plot title="f and its tangent" x={[-2, 3]} y="auto" series={[
  { kind: 'function', f, concept: 'output' },
  { kind: 'function', f: tangent, concept: 'rate' },        // re-sampled whenever x0 moves
]}>
  <Handle value={x0} constrain={{ curve: f }} label="the point of tangency" concept="rate" />
</Plot>
```

**Contour and heat maps.** `contour` draws `contours(f, view, levels, resolution)`
(`@kit/math`, marching squares) as polylines in the concept's ink and line
style, with optional level labels (haloed, along the line); `levels` is a list
or a count of nice levels (`contourLevels`). `heat` fills the plot with a
sequential (paper → concept ink) or diverging ramp at `resolution` cells per
axis on the canvas layer, with a small key; colour is never the only signal,
so pair a heat map with contours or labels. Used for loss landscapes (GD's 2D
view), calc3 contour maps, Lagrange constraint curves, L1/L2 balls and
covariance ellipses.

**Keyboard.** The `cursor` is a `role=slider` (`aria-valuetext` "x = 1.40"):
arrows move it by 1/100 of the x range (Shift ×10), Home/End to the ends.
Stacked linked plots (f, f′, f″) share `x` and a `cursor` signal. Surfaces
are Stage3D's job.

### 6.3 `MatrixGrid` ⏳ G2

A 2×2 transform acting on the plane, with î and ĵ highlighted. (A 3×3 acting
on space is `MatrixGrid3D`, §6.4.)

```ts
interface MatrixGridProps {
  matrix: Signal<Mat2>;
  title: string;
  editable?: 'basis' | 'entries' | 'both' | false;   // drag î/ĵ tips, or step the entries; default 'basis'
  snap?: number;                                      // default 0.5 (entries and basis tips)
  morph?: ReadonlySignal<number>;                     // 0 = identity … 1 = the matrix (animate with a Slider/PlayScrub)
  show?: { grid?: boolean; basis?: boolean; unitSquare?: boolean; determinant?: boolean; eigen?: boolean };
  vectors?: readonly MatrixGridVector[];
  view?: ViewBox;
  concepts?: { i?: string; j?: string; area?: string };   // which concepts î, ĵ and the area wear
}
interface MatrixGridVector {
  value: Signal<Vec2> | ReadonlySignal<Vec2>;   // the input vector v, drawn as itself (never transformed)
  concept: string;
  label: string;                                 // accessible name of its handle: "the input arrow v"
  draggable?: boolean;                           // default: true when `value` is a writable Signal
  snap?: number;
  image?: { concept: string; label: string };    // ALSO draw A·v: a derived, non-draggable arrow that follows `morph`
  onDragEnd?: (v: Vec2) => void;                 // e.g. a Predict guess: onDragEnd={setGuess}
}
imageOf(matrix: ReadonlySignal<Mat2>, v: ReadonlySignal<Vec2>, morph?: ReadonlySignal<number>): ReadonlySignal<Vec2>
   // computed A·v (through the morph when given): the same value the image arrow shows, for Formula live values and readouts
```

Shows the transformed grid as a context layer, î/ĵ arrows, an entries panel
(`.lv-vec--mat`, editable as steppers when `editable` includes entries),
optional unit square with signed area (orientation flip hatched), and eigen
directions (rose double rule) when real. The eigen lesson's central visual is
one `vectors` entry with an `image`: drag v, watch Av, and the two line up
exactly on an eigen direction. Keyboard: î/ĵ tips and vector handles are
`role=slider` handles (arrows, Shift ×5); entries are steppers.

### 6.4 `Stage3D` and `MatrixGrid3D` ⏳ G2 (`@kit/visual/Stage3D`)

Only for genuinely 3D concepts (surfaces, fields, rotations, 3×3 transforms).

```ts
type V3 = Vec3 | ReadonlySignal<Vec3>;
type V3s = readonly Vec3[] | ReadonlySignal<readonly Vec3[]>;
interface Stage3DProps {
  title: string;
  bounds: { x: readonly [number, number]; y: readonly [number, number]; z: readonly [number, number] };
  camera?: { azimuth: number; elevation: number; distance?: number } | Signal<{ azimuth: number; elevation: number; distance?: number }>;
  autoRotate?: boolean;            // never under reduced motion
  axes?: boolean; grid?: boolean;
  fallback: Rich;                  // caption shown if 3D can't render
  children: ComponentChildren;     // the primitives below
}
<Surface f={(x, y) => z} x y resolution? concept? contours?: boolean colorBy?: 'height' | 'concept' opacity? />
<Point3D at: V3 concept r? label? />                       // the GD ball
<Points3D data: V3s concept r? />
<Polyline3D points: V3s concept closed? />                  // an iterate path on the loss surface
<Vector3D from?: V3 to: V3 concept label? />
<Curve3D f={(t) => Vec3} t concept samples? />
<Plane3D normal: V3 point: V3 concept size? />
<VectorField3D F density? concept />

interface MatrixGrid3DProps {
  matrix: Signal<Mat3>;
  title: string;
  fallback: Rich;
  editable?: 'entries' | 'basis' | 'both' | false;   // 'basis': drag î/ĵ/k̂ tips in the plane facing the camera; default 'entries'
  snap?: number;                                      // default 0.5
  morph?: ReadonlySignal<number>;
  show?: { lattice?: boolean; basis?: boolean; unitCube?: boolean; determinant?: boolean; eigen?: boolean };
  vectors?: readonly { value: Signal<Vec3> | ReadonlySignal<Vec3>; concept: string; label: string; image?: { concept: string; label: string } }[];
  concepts?: { i?: string; j?: string; k?: string; volume?: string };
  camera?: Stage3DProps['camera'];
}
```

**Signals and rebuilds (binding).** Points, vectors and paths accept signals;
a signal change updates only those dynamic objects (moving a ball or
appending to a path never rebuilds the scene). A `Surface` mesh is built once
per `(f, x, y, resolution)` identity, so keep `f` stable (module level or
`useMemo`); a surface that must change shape takes a new `f`. A PlayScrub
driving `Point3D at={ballSignal}` costs one cheap update per frame.

Orbit by drag, zoom by pinch/ctrl-wheel, arrow keys rotate, a "Reset view"
button; sensible default camera (azimuth −60°, elevation 25°). Renderer: SVG/
canvas with `orbitBasis` for light scenes; three.js (lazy-imported) only when
a scene needs it, justified in G2's PLAN region and that lesson's NOTES.md.

`MatrixGrid3D` (linear algebra: determinant as volume, 3D rotations) shows the
transformed lattice as context, î/ĵ/k̂ arrows, the unit cube mapped to a
parallelepiped with its signed volume (`det3`) in the entries panel (a 3×3
`.lv-vec--mat` of steppers); a negative determinant hatches the faces and
says "orientation flipped" in words, zero flattens it with "volume 0: space
squashed onto a plane (or line)". Eigen directions draw as rose double rules
when real.

<!-- /region:G2 -->

---

<!-- region:G4-controls -->
## 7. Controls & code (G4)

### 7.1 `Slider` ⏳ G4

```ts
interface SliderProps {
  value: Signal<number>;
  min: number; max: number; step?: number;          // linear default step (max − min)/100
  scale?: 'linear' | 'log';                         // log: min > 0; equal track distance = equal ratio (a learning rate 0.001…1.5)
  exclude?: readonly number[];                      // values never landed on, by drag or key (h never reaches 0)
  sig?: number;                                     // log without step: snap to this many significant figures (default 2)
  label: Rich;                                      // shown left; also the accessible name (plain text)
  concept?: string;                                 // thumb in the concept ink; dragging lights it on the link bus
  detents?: readonly (number | { value: number; label?: string })[];   // ticks below; magnetic within snapRadius
  snapRadius?: number;                              // world units; default 1.5 steps
  format?: (v: number) => string;                   // value text; default formatSliderValue (step decimals, or sig figs on log)
  valueText?: (v: number) => string;                // aria-valuetext ("lambda 3.00, determinant 0.00")
  disabled?: boolean;
  onCommit?: (v: number) => void;                   // pointer up / key up
}
```

All mapping goes through `core/slider-scale.ts` (§3.14: `sliderValue`,
`sliderPosition`, `stepSliderValue`, `formatSliderValue`), which is tested;
the component holds no maths of its own and throws (via
`validateSliderScale`) on an impossible scale in dev. A two-sided quantity
that must avoid 0 (the secant's $h$) is either a linear slider with
`exclude: [0]`, or a `Segmented` sign (±) beside a positive `log` slider
that never reaches 0.
DOM: `.slider[.ct.ct-<concept>]` > `.slider__label` + `.slider__track`
(`input[type=range]` 44px tall, `--fill`, `.slider__ticks`) + `.slider__value`.
The native range input runs on track positions (0…1000) mapped through the
scale, and the component handles arrows, PageUp/PageDown and Home/End with
`stepSliderValue`, so every key press lands on a new allowed value, on log
scales too.

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

Each Scrolly step renders as `article.scrolly__step[data-step]`, so a Build
section written as a Scrolly counts its steps for smoke like `Step`s do.

### 7.6 `CodeCell` ⏳ G4

An editable, runnable snippet whose output updates the visual (§4.7 "Code it").

```ts
interface CodeCellProps {
  code: string;                                         // initial source (JavaScript); keep it in problems.ts SNIPPETS so tests run it
  label?: string;                                       // default "Code it"
  editable?: boolean;                                   // default true
  autorun?: boolean;                                    // run on mount and after edits (debounced 400ms); default false (Run button)
  inputs?: Readonly<Record<string, ReadonlySignal<unknown> | unknown>>;   // read-only globals; current values, plain data only (see below); re-run on change under autorun
  helpers?: CodePrelude['helpers'];                     // hidden named functions: { loss: 'function loss(w) { return (w - 3) ** 2; }', grad: '(w) => 2 * (w - 3)' }
  prelude?: string;                                     // hidden setup run first (datasets, constants); error lines stay relative to the visible code
  outputs?: Readonly<Record<string, CodeOutput<any>>>;  // emit('name', v) → validated → the signal → visuals update
  stream?: boolean | { throttleMs?: number };           // deliver emits DURING the run (default false: once, when it ends)
  concepts?: Readonly<Record<string, string>>;          // identifier → concept: underlined in the concept's line style
  timeoutMs?: number;                                   // default 2000
  onResult?: (r: SandboxResult) => void;
  lines?: number;                                       // min visible rows
}
interface CodeOutput<T> {
  signal: Signal<T>;
  parse: (v: unknown) => T | null;   // validate what learner code emitted; null (or a thrown Error, whose message is shown) rejects it
  from?: 'last' | 'all';             // 'last' (default): the latest emit(name, v); 'all': the array of every value emitted under name
}
codeOutput<T>(signal, parse, from?): CodeOutput<T>
// ready-made parsers (controls/parsers.ts): parseNumber, parseVec2, parsePoints (Vec2[]), parseNumbers (number[]), parseMat2
```

**Emit semantics.** `emit(name, v)` records a snapshot each time it is
called. Without `stream`, outputs update once when the run ends: `from:
'last'` gets the final value, `from: 'all'` the whole sequence (every GD
iterate). With `stream`, each emit is delivered as it happens, throttled
(default 50ms, the last emit always arrives), so a loop animates its
visual while it runs. **A bad emit never reaches a visual**: when `parse`
rejects a value, the cell shows a learner-facing error under the code
("`emit("path", …)`: expected a list of [x, y] points") and the output
signal keeps its previous value, so Plot never receives a malformed path
(smoke fails on console errors).

**Inputs cross into a Worker**, so they must be structured-cloneable plain
data (numbers, strings, arrays, plain objects, typed arrays). Functions such
as the loss go in `helpers` as source strings; signals in `inputs` are read
for their current value. A non-cloneable input is a lesson bug: the cell
refuses to run and shows `cloneIssue`'s message naming the bad path (and
logs a `console.error`, so smoke catches it).

**Keyboard (no trap, WCAG 2.1.2).** In the editor, Tab inserts two spaces
and Shift+Tab outdents; **Esc, then Tab** (or Shift+Tab) moves focus out of
the editor, the CodeMirror convention. A visible `.fig-keys` line under the
editor says "Tab indents · Esc, then Tab, leaves the editor". A read-only
cell (`editable: false`) never captures Tab.

DOM: `.codecell` > `.codecell__bar` (label, **Run**, **Reset**) +
`pre.codecell__code` (editor: a `textarea` over a highlighted `pre`; syntax by
ink weight and italics only) + `.fig-keys` + `.codecell__out` (logs, errors
with line numbers, "Stopped after 2 s"), `aria-live="polite"`. Scrolls
horizontally inside the cell at 390px, never the page.

### 7.7 `runSandboxed` (controls/sandbox.ts) ⏳ G4

```ts
interface SandboxRequest {
  code: string;
  inputs?: Record<string, unknown>;                     // checked with cloneIssue before posting
  helpers?: CodePrelude['helpers']; prelude?: string;   // functions are sent as their toString()
  tests?: { entry: string; tests: readonly CodeTest[] };   // a write-the-code problem: runCodeTests instead of runSnippet
  timeoutMs?: number;
  stream?: boolean | { throttleMs?: number };
}
interface SandboxResult {
  ok: boolean; logs: string[];
  emits: Record<string, unknown>; streams: Record<string, unknown[]>; returned?: unknown;
  error?: { message: string; line?: number; where: 'code' | 'prelude' };
  timedOut?: boolean;
  report?: CodeRunReport;                               // already sanitizeReport'ed: hidden tests show only name + ✓/×
}
runSandboxed(req, opts?: { onEmit?: (name: string, value: unknown) => void; signal?: AbortSignal }): Promise<SandboxResult>
```

A module Worker (`new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })`)
that removes `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`importScripts` and `indexedDB` before running anything, then calls the
**same pure functions lesson tests call** (`runSnippet` or `runCodeTests`,
§3.8), posts every result through `sanitizeReport` / `toCloneable` (so a
test that returns a function or a cyclic object can't throw
`DataCloneError`), streams emits when asked, and is terminated (and
replaced) on timeout. The worker types its global with `workerScope()`
(`@kit/util`) instead of the `webworker` lib. Problem's code answers and
ExamSet's submit-time grading use it too.

<!-- /region:G4-controls -->

---

<!-- region:G3 -->
## 8. Practice (G3)

### 8.1 `WorkedExample`, `WorkedExampleSet` ⏳ G3

```ts
interface WorkedExampleProps {
  spec: WorkedExampleSpec;
  n?: number;                                                   // "Worked example 2"
  figure?: ExampleFigure;                                       // (params, setParams) => …: its own small interactive
  params?: Signal<ParamValues>;                                 // external live params (a figure elsewhere drives them); default internal
}
interface WorkedExampleSetProps {
  examples: readonly WorkedExampleSpec[];                       // ★ direct · ★★ combined · ★★★ exam level
  figures?: LessonFigures['examples'];                          // FIGURES.examples, by spec.figure key
}
```

Flow (DESIGN.md §8): statement (`.lead`) → `dl.knowwant` → `.strategy` →
`ol.steps`: step 1 shown; before each further step a **pause**
(`.step--pause` > `.pause`: "Try the next step yourself" + the step's `tryIt`,
which the audit requires on every step after the first; **Reveal step k**
primary + *I've done it, compare* quiet) → boxed answer (`.answer--hidden`
with veil until the last step, then `.answer` green rule) → ✓ `.sanity`.
Steps render with `MathChain`. Writes `progress.example`.

**Live parameters.** Controls above the statement: a `Slider` per numeric
param (honouring `scale: 'log'` and `detents`), a `Segmented` per `choice`
param (its value is the option index: pick $f$ from a list). Every `Live`
field recomputes via `resolveExample`. The example's `accept(p)` guard runs
on every change: a rejected setting is never shown; the example keeps the
last accepted values, the control that caused it snaps back on release and
shows the reason beside it (`.param__why`, `aria-live`), and choice options
that `accept` would reject with the current other values are disabled with
the reason as their description. A figure receives `(params, setParams)`, so
dragging $x_0$ in the figure writes the same params the sliders show
(`setParams` goes through `accept` too). **Reveal state is a count**: "k
steps revealed" survives parameter changes, clamped to the new number of
steps when `steps` is `Live` and its length changes.
`WorkedExampleSet`: one `article.card.example` with `.ex-tabs[role=tablist]`
(`★ Direct · ★★ Combined · ★★★ Exam level`, arrow keys move between tabs) and
one `[role=tabpanel][data-worked-example]` per example (inactive ones
`hidden`, holding statement, known/want, strategy and step 1; the rest mounts
when first shown, §1.10).
A standalone `WorkedExample` puts `data-worked-example` on its `article`.

### 8.2 `Problem` ⏳ G3

```ts
interface ProblemProps {
  spec: ProblemSpec;
  n?: number; total?: number;                                   // "Problem 4 · numeric · 4 of 8"
  figure?: ProblemFigure;                                       // (instance) => …; in a set: figures[spec.figure]
  custom?: ProblemCustom;                                       // (state, instance) => … for drag mode 'custom'; in a set: customs[spec.figure]
  lessonId?: string;                                            // default useKit().lessonId: progress key (and DOM namespace on mixed pages)
  instance?: ProblemInstance;                                   // a pre-drawn instance (ExamSet's paper); default drawProblem(spec, 0)
  mode?: 'practice' | 'exam' | 'review';                        // default 'practice'
  response?: Signal<ExamResponse>;                              // exam: the answer as it stands (written on every edit)
  verdict?: Verdict;                                            // review: the scored verdict to show
  onSolved?: (instance: ProblemInstance) => void;
}
```

`article.card.problem[data-problem=<key>]`, `id="p-<domId(key)>"`, where
`key` is the problem id on a lesson page and `problemKey(lessonId, id)` on a
page that mixes lessons (§2). Answer inputs by kind:
numeric/symbolic → `form.answer-row` (`label` with the TeX `label`, `.field`
mono input, **Check**, `.answer-row__help` with the stated precision via
`describePrecision`, live "We read: …" preview from `Verdict.understood`);
numeric with `shape` → a `rows × cols` grid of fields in matrix brackets
(row-major, arrow keys move between cells), joined for the checker; numeric
with `complex` → one field per number with an "a + bi" placeholder (or one
field accepting `1 ± 2i`); `equivalence` says so in the help line ("any
nonzero multiple works"); choice → radio/checkbox `.choice` rows (+ a
one-line reason field when `askReason`); drag → point (a small Stage2D +
Handle from G2), order (a reorderable list: drag *or* move-up/down buttons),
match (items → slots: drag *or* select menus), slider (G4 Slider), custom
(the `custom` render prop); proof → optional textarea, then the model answer
and a checklist the learner ticks; code → CodeCell editor + **Run tests**
(sandboxed, per-test results, hidden tests shown as "hidden test 4 ✓/×").
A problem with a `figure` key renders `figure(instance)` above the input and
again in the solution.
States (`mode: 'practice'`): unanswered · typing · wrong (`.field.is-wrong`,
`.feedback--wrong` × + message, and the matching `.wrong-note` "Why 6 is the
common wrong answer" ⚠) · right (`.is-correct`, ✓) · hints opened 1–3
(`.hints .seg`: ① Nudge ② Strategy ③ First step; each unlocks the next;
`aria-expanded`) · solution shown (after a right answer, or **Show solution**
= giving up, which asks once and records `progress.reveal`; the solution
lists every common-wrong note) · **Another one** (only if `spec.generate`:
draws a new seed with `drawProblem`, resets the card, keeps attempt counts).
Foot meta: "2 attempts · 1 hint". Writes `progress.attempt/hint/reveal`
under its lesson id. Hints, the solution and wrong notes mount when first
opened (§1.10).
`mode: 'exam'`: the input only. No Check, verdicts, hints, solution or
Another one; every edit writes `response` (code answers write
`{ kind: 'code', source }`; ExamSet runs them at submit). `mode: 'review'`:
read-only, shows the learner's response, `verdict` (✓/× + message), the full
solution, the matching common-wrong note and every other one.

### 8.3 `ProblemSet` ⏳ G3

```ts
interface ProblemSetProps {
  problems?: readonly ProblemSpec[];            // one lesson (the lesson page): keys are problem ids
  figures?: LessonFigures['problems'];          // FIGURES.problems, by spec.figure
  customs?: LessonFigures['customs'];           // FIGURES.customs, by spec.figure, for drag mode 'custom'
  items?: readonly PracticeEntry[];             // several lessons (subject practice): { lessonId, spec, concepts, figures? }
  mode?: 'paged' | 'list';                      // default 'paged' (one card + dot strip); 'list' for practice pages
  title?: string;
}
```

Give exactly one of `problems` or `items`. With `items`, each problem is
wrapped in its own scoped `KitProvider { lessonId, concepts }` (§3.1: its
concept inks, macros and progress key), keyed `problemKey(lessonId, id)`,
and gets its figure and custom renderer from `entry.figures`. A problem whose
`figure` key has no renderer logs a `console.error` (so smoke catches it);
a custom drag without one can't be answered and is left out of a practice
page with a note.
Paged: `ol.pset` dot strip (one `button.pset__dot` per problem, 44px;
`is-solved` ✓ / `is-hinted` hatch / `is-attempted` dashed / to do; current
`aria-current="step"`; status from progress) above the current `Problem`;
**every `article[data-problem]` stays in the DOM** (`hidden` when not current;
its body mounts when first shown). Next/previous via the dots or after
solving ("Next problem →").

### 8.4 `Quiz` ⏳ G3

```ts
interface QuizProps { questions: QuizSpec; title?: string; figures?: LessonFigures['quiz'] }
```

`article.card.quiz`: `.quiz__top` (dot strip `ol.quiz__dots`: right = green,
wrong = red hatch, current = ink ring; "Question 2 of 5") → one
`fieldset.quiz__set[data-quiz-question=<id>]` per question (non-current
`hidden`), `legend.quiz__q`, then the question's `figure` (from `figures`)
when it has one. Choice: 54px `.choice` rows with circled letter
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

### 8.6 `figures.tsx` and pages that mix lessons ✅ contracts · ⏳ G3 components

CLAUDE.md §5 asks for a mixed practice page and an exam-style set per
subject, drawing problems from every shipped lesson. Three contracts make
that work without a page ever importing a lesson's `lesson.tsx` (which
mounts itself):

1. **`problems.ts` exports `LessonContent`** (types.ts §11) by those exact
   names. It is pure, so it imports in Node (build-index validates `C` and
   `PROBLEMS` for every lesson) and in any page.
2. **`figures.tsx` exports `FIGURES = defineFigures({ examples, problems,
   customs, traps, quiz })`** (core/figures.ts), keyed by the `figure`
   strings in problems.ts. **No side effects**: no `mountLesson`, no
   top-level page signals; each renderer builds its own local state from its
   arguments. `lesson.tsx` and the practice pages both import it, and the
   lesson test checks the keys (`auditFigureKeys(content, FIGURES)`).
3. **Discovery** by Vite glob, filtered by `@content/lessons.json`
   (`status === 'shipped' && hasProblems`; `hasFigures` says whether
   figures.tsx exists):

```ts
// src/site/practice.tsx (site work) — every shipped lesson of one subject
import lessons from '@content/lessons.json';
import type { LessonContent } from '@kit/pure';
import { ProblemSet, ExamSet, type LessonFigures, type PracticeEntry } from '@kit';

const contents = import.meta.glob<LessonContent>('/lessons/*/*/problems.ts');
const figures = import.meta.glob<{ FIGURES: LessonFigures }>('/lessons/*/*/figures.tsx');

async function entriesFor(subject: string): Promise<PracticeEntry[]> {
  const shipped = lessons.filter((l) => l.subject === subject && l.status === 'shipped' && l.hasProblems);
  const out: PracticeEntry[] = [];
  for (const l of shipped) {
    const c = await contents[`/lessons/${l.id}/problems.ts`]();
    const f = l.hasFigures ? (await figures[`/lessons/${l.id}/figures.tsx`]()).FIGURES : undefined;
    for (const spec of c.PROBLEMS) out.push({ lessonId: l.id, spec, concepts: c.C, figures: f });
  }
  return out;
}
// <ProblemSet items={entries} mode="list" title="Linear algebra: mixed practice" />
// <ExamSet subjectId="linalg" items={entries} count={8} />
```

Each item renders inside its own scoped `KitProvider` (its inks, macros and
progress key), DOM keys are `problemKey(lessonId, id)` / `domId(key)` (§2),
and progress lands on the owning lesson. Pure helpers (core/exam.ts):
`problemKey`, `domId`, `drawExam(items, { seed, count?, mix?, exclude? })`
(difficulty mix, lessons interleaved, generated problems re-seeded per
attempt, deterministic per seed), `scoreExam(paper, responses)` (the same
checkers as practice), types `PracticeItem` (types.ts) and `PracticeEntry`
(+ `figures`, core/figures.ts).

### 8.7 `ExamSet` ⏳ G3

The timed, mixed exam-style set with a full solutions walkthrough at the end.

```ts
interface ExamSetProps {
  subjectId: string;                     // progress.exam key, e.g. 'linalg'
  items: readonly PracticeEntry[];       // the pool: every shipped lesson's PROBLEMS in the subject (§8.6)
  count?: number;                        // questions per paper; default 8
  minutes?: number;                      // time limit; default 3 × count
  mix?: ExamOptions['mix'];              // difficulty shares; default { 1: 0.25, 2: 0.5, 3: 0.25 }
  exclude?: readonly AnswerKind[];       // kinds that can't be auto-scored; default ['proof']
  title?: string;
}
```

Flow: **start** (number of questions, time, "no hints and no feedback until
you submit", previous attempts from `progress.read().exams[subjectId]`) →
**Start** draws a paper with `drawExam(items, { seed: randomSeed(), … })` →
**paper**: every question as `Problem mode="exam"` (numbered, each in its
lesson's scoped provider, figure shown), a sticky timer (`role="timer"`,
"12:30 left", announced politely at 5 and 1 minutes, never every second),
an answered count and jump links → **Submit all** (confirms if questions
are unanswered; auto-submits at 0:00) → code answers run through
`runSandboxed` → `scoreExam` → **results**: score, time taken, a ✓/× strip,
then the **walkthrough**: each question as `Problem mode="review"` (the
learner's answer, the verdict, the full worked solution, the matching
common-wrong note and every other one) → **Try another paper** (a new seed:
generated problems change too). Writes `progress.exam(subjectId, { date,
score, total, seconds })` and `progress.attempt(lessonId, id, correct)` for
each answered question (no hints are recorded: none were available).
DOM: `article.card.exam[data-exam=<subjectId>]`; questions keep
`[data-problem=<key>]`. Keyboard: everything is a native control; the timer
never steals focus. Reduced motion: no countdown animation.

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

### 9.6 Keyboard and layouts (every view) ⏳ G5

- **Clickable elements are buttons.** When a view gets `onCellClick`,
  `onNodeClick` or `onEdgeClick`, every such element is focusable and
  activates with Enter/Space: ArrayView cells and TableView cells are
  `<button>`s inside their cells; TreeView and GraphView nodes and edges are
  SVG `g[role=button][tabindex=0]` with aria-labels ("node 7, left child of
  9", "edge A→B, weight 3"). One tab stop per view (roving tabindex): arrow
  keys move between cells (ArrayView ←/→, TableView all four), TreeView ↑
  parent / ← → children, GraphView nodes in id order with edges after their
  source; Home/End jump to the ends.
- **Editable graphs**: arrows move the focused node (Shift ×5).
- **Without click handlers** the elements are plain labelled marks (not tab
  stops); the frame summary carries the state for screen readers.
- **Layouts** come from `math/layout.ts` (`layoutTidy`, `layoutInorder`,
  `forceLayout`, `layeredLayout`), which G5 owns (PLAN §2): fixes for BST
  rotations or DAG crossings land there, with tests.

<!-- /region:G5 -->

---

## 10. Building each §4 section

| § | Section (`id`) | Kit pieces |
|---|---|---|
| 1 | TL;DR (`tldr`) | `TLDR` with the `TldrSpec` from problems.ts |
| 2 | Hook (`hook`) | prose (`RichText` or JSX), a `Figure` with a striking visual, often `Predict` |
| 3 | Play (`play`) | `Figure central wide` + `Stage2D`/`Plot`/`MatrixGrid`/`Stage3D`/a structure view, `Mission`, `Readout`, `Legend`; **no formulas** |
| 4 | Build the idea (`build`) | 3–6 `Step`s, each a sentence or two + one focused `Figure`, or a `Scrolly`; `Slider`/`Toggle`/`Segmented` for focused knobs; `Predict` before reveals |
| 5 | Formalize (`formalize`) | `<Formula {...FORMULAS[0]} live={…} />` (explain this, live values, in words) + `<Derivation {...DERIVATIONS[0]} />`; `Callout kind="key"`; `Callout kind="simplify"` for simplifications |
| 6 | Worked examples (`examples`) | `WorkedExampleSet examples={EXAMPLES} figures={FIGURES.examples}` (≥ 3: direct, combined, exam) |
| 7 | Code it (`code`) | `CodeCell code={SNIPPETS.x}` with `inputs`/`helpers`/`outputs` wired to the section's visual; physics/maths: a "simulate it" CodeCell |
| 8 | Common traps (`traps`) | `Trap spec figures={FIGURES.traps}` × 2–4, each with its counterexample figure |
| 9 | Practice (`practice`) | `ProblemSet problems={PROBLEMS} figures={FIGURES.problems} customs={FIGURES.customs}` (≥ 8: 3 ★, 3 ★★, 2 ★★★, mixed kinds) |
| 10 | Quick check (`quickcheck`) | `Quiz questions={QUIZ} figures={FIGURES.quiz}` (4–6) |
| 11 | Where next (`next`) | `WhereNext` with ≥ 2 `Reference`s; optional `Glossary` |

Subject pages add `ProblemSet items mode="list"` (mixed practice) and
`ExamSet` (§8.6–8.7).

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
