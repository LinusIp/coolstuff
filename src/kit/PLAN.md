# Kit build plan: five groups, no collisions

The foundations are done and tested (core/, math/, util/, types.ts, the pure
entry, vite-katex, vite-pwa, gallery host, barrels). The rest of the kit is
split into five groups that work **in parallel in one checkout without
coordinating**: each file has exactly one owner, the APIs are fixed in
[README.md](./README.md), and the reference data is
[gallery/samples.ts](./gallery/samples.ts). §7 records the decisions taken
on the adversarial reviews of this contract.

## 0. Ground rules (every group)

1. **Own your files, read everyone's.** Edit only files your group owns
   (§2). Need a change elsewhere? Write it in the change log (§6) and work
   around it in your own files meanwhile. Shared documents (README.md, this
   file) are edited only inside your own `<!-- region:… -->` / `<!-- status:… -->`
   markers (and by appending to §6), and you re-read the file immediately
   before each edit. The one shared code file is `core/icons.tsx` (§2).
2. **The README API is binding.** Implement the props as written. If one must
   change, keep it backward compatible where possible, update your README
   region, and log it in §6 so dependants see it.
3. **Never** run `npm install`, edit package.json/package-lock.json,
   vite.config.ts, eslint.config.js, tsconfig*.json, scripts/ (except G4's
   lesson template), the design system (theme.ts, notation.ts, DESIGN.md,
   NOTATION.md, styles/{fonts,tokens,base,layout,components}.css), types.ts
   outside your section, pure.ts, or src/content/. Never run plain
   `npm run build` (dist/ is shared), never commit or push.
4. **Build and look at your own pages only:**
   `npx tsx scripts/build-pages.ts <scratch>/dist kit/_dev/<group>.html`, then
   `npx tsx scripts/shoot.ts --dist=<scratch>/dist --out=<scratch>/shots [--w=390 --h=844] [--dark] [--full] [--selector=…] /kit/_dev/<group>.html`
   and read the PNGs. shoot.ts prints console errors/warnings: there must be none.
5. **Checks before you call a component done:**
   `npx tsc --noEmit -p tsconfig.json` · `npx tsc --noEmit -p tsconfig.node.json` ·
   `npx eslint <your paths>` · `npx vitest run <your paths> src/kit/barrels.test.ts`.
6. **Pure logic lives in `.ts` files with vitest tests** (layouts, sampling,
   simulations, parsers, state machines, layout of explain notes, FLIP
   pairing); components stay thin. Pure modules a lesson's problems.ts or
   math.ts needs go through `@kit/pure` / `@kit/math` (the architect adds the
   re-export line on request, §6).
7. **No DOM at import time.** Touch `document`, `window`, `matchMedia`,
   `Worker`, `localStorage` only inside effects, handlers or functions:
   barrels.test.ts imports every barrel in Node and fails otherwise.
8. **Styles**: only in your group's CSS file (§2), only design tokens
   (`--ink*`, `--hue-*`, `--w-*`, `--sp-*`, `--dur-*`, `--fs-*`…), reusing the
   classes components.css already has (DESIGN.md §13) before adding new ones.
   components.css is frozen: to change a rule for your component (`.tldr`,
   `.dstep`, `.choice`, `.next-grid`…), override it in your own file (it
   loads later in styles/index.css, so equal specificity wins) and log
   structural changes in §6 so the design-system owner can fold them back.
9. **No heavy imports at module top level** (three.js, d3): lazy `import()`
   inside the component. No runtime network requests.

## 1. Definition of done (every component)

- Matches its README section (props, states, DOM classes, data hooks).
- Exported from the group's barrel (`<folder>/index.ts`) and therefore from `@kit`.
- Gallery demos in `gallery/<group>.tsx` for every state worth seeing (default,
  hover-linked, focused, error/empty, solved/done, live-updating), with real
  data (samples.ts or your own).
- Screenshots of the dev page at **1280×800 and 390×844, light and dark**,
  looked at and intentional; no horizontal scroll at 390px; zero console
  errors or warnings.
- Keyboard-complete (README §1.9: every clickable thing a focusable button
  with a name, every draggable thing arrow-key movable); visible 2px ink
  focus; ≥ 44px targets (or `data-hit` with a pseudo-element hit area); aria
  per README §1.9; colour never the only signal; reduced motion respected
  (states still change); headings never skip a level.
- Hidden content (hints, solutions, unrevealed steps, inactive panels'
  bodies) mounts on first open (README §1.10); counted containers always
  exist (README §2).
- Unit tests for its pure logic; typecheck, lint and tests green, including
  barrels.test.ts.
- Smoke-relevant hooks rendered exactly (README §2).

## 2. Groups and file ownership

Every path below has exactly one owner. "Inherited" files were written by the
kit architect and are handed over with their tests: keep their public
signatures (additive changes only) and keep their tests passing.

### Kit architect (frozen after handoff)

`src/kit/index.ts` · `src/kit/pure.ts` · `src/kit/barrels.test.ts` ·
`src/kit/types.ts` (groups may add optional fields to their own section only,
logged in §6) · `src/kit/core/index.ts` · `src/kit/core/core.test.ts` ·
`src/kit/core/figures.ts` (the figures.tsx convention, `PracticeEntry`) ·
`src/kit/vite-katex.ts` + test · `src/kit/gallery/{types.ts,host.tsx,dev.tsx,core.tsx,samples.ts,gallery.css}` ·
`src/kit/styles/index.css` · `kit/_dev/{core,all}.html` · README.md and PLAN.md outside the group regions.

### G1 — formulas & text

| Owns | |
|---|---|
| New | `src/kit/text/**` (Formula.tsx, Derivation.tsx, Glossary.tsx, TLDR.tsx, Trap.tsx, Callout.tsx, explain-layout.ts + tests, index.ts) |
| Inherited | `text/anchors.ts` + test (repeated-anchor rule, FLIP pairing), `text/explain-proto.ts` (port into explain-layout.ts, then delete), `core/link.ts`, `core/richtext.ts`, `core/richtext.test.ts`, `core/RichText.tsx`, `core/Tex.tsx`, `core/live.ts`, `core/LineSwatch.tsx` |
| Styles | `src/kit/styles/text.css`, `src/kit/styles/core.css` |
| Gallery | `src/kit/gallery/text.tsx`, `kit/_dev/text.html` |
| Docs | README region `G1` (§5), PLAN region `G1` |

### G2 — visuals

| Owns | |
|---|---|
| New | `src/kit/visual/**` (Stage2D.tsx + primitives, scales.ts + tests, Plot.tsx (+ sampling.ts / series.ts + tests), MatrixGrid.tsx + `imageOf`, Stage3D.tsx + 3D primitives + MatrixGrid3D, index.ts) |
| Inherited | `src/kit/math/**` **except** `math/layout.ts` and `math/layout.test.ts` (G5's): includes `analysis.ts`, `contour.ts` and their tests. Add functions freely with tests; never change existing behaviour |
| Styles | `src/kit/styles/visual.css` |
| Gallery | `src/kit/gallery/visual.tsx`, `kit/_dev/visual.html` |
| Docs | README region `G2` (§6), PLAN region `G2` |

### G3 — practice

| Owns | |
|---|---|
| New | `src/kit/practice/**` (WorkedExample.tsx, Problem.tsx, ProblemSet.tsx, Quiz.tsx, Predict.tsx, ExamSet.tsx, inputs/* (matrix grid, complex, order, match…), any pure state machines + tests, index.ts) |
| Inherited | `core/answers.ts`, `core/answers.test.ts`, `core/expr.ts`, `core/expr.test.ts`, `core/units.ts`, `core/problems.ts`, `core/problems.test.ts`, `core/lesson-audit.ts` + test, `core/pretty.ts` + test, `core/exam.ts` + test, `core/codecheck.ts` + test, `core/progress.ts`, `core/progress.test.ts`, `core/rng.ts` |
| Styles | `src/kit/styles/practice.css` |
| Gallery | `src/kit/gallery/practice.tsx`, `kit/_dev/practice.html` |
| Docs | README region `G3` (§8), PLAN region `G3` |

### G4 — controls, code & lesson shell

| Owns | |
|---|---|
| New | `src/kit/controls/**` (Slider, Toggle + Segmented, Stepper, PlayScrub, Scrolly, CodeCell, parsers.ts + tests, sandbox.ts, sandbox.worker.ts, index.ts) · `src/kit/shell/**` (LessonPage, Section, Step, Figure + Readout/Mission/Legend/FigKeys, SiteHeader, ReadingProgress, ThemeToggle, WhereNext + References, mount.tsx, index.ts) · `scripts/lesson-template/**` (what `npm run new` copies: index.html, lesson.tsx, figures.tsx, math.ts, problems.ts, lesson.test.ts, meta.json, NOTES.md with `{{vars}}`) |
| Inherited | `core/context.tsx`, `core/hooks.ts`, `core/icons.tsx` (shared: any group may **append** an icon export, re-reading the file first and logging it in §6; only G4 changes existing icons), `core/slider-scale.ts` + test, `src/kit/util/**` (incl. `worker.ts`, `dom.ts` + test, `pwa.ts`) |
| Styles | `src/kit/styles/controls.css`, `src/kit/styles/shell.css` |
| Gallery | `src/kit/gallery/controls.tsx`, `kit/_dev/controls.html` |
| Docs | README regions `G4-shell` (§4) and `G4-controls` (§7), PLAN region `G4` |

### G5 — data structures & systems

| Owns | |
|---|---|
| New | `src/kit/structures/**` (ArrayView, TreeView, GraphView, TableView, ArchDiagram, arch-sim.ts + tests, flip.ts or similar helpers, index.ts) |
| Inherited | `src/kit/structures/types.ts` (ArchSpec & co.); types.ts §8 (state shapes: optional additions only); `src/kit/math/layout.ts` + `math/layout.test.ts` (tree, force and layered layouts: only G5's views use them; keep them pure and re-exported by `@kit/math`) |
| Styles | `src/kit/styles/structures.css` |
| Gallery | `src/kit/gallery/structures.tsx`, `kit/_dev/structures.html` |
| Docs | README region `G5` (§9), PLAN region `G5` |

### Integration (after the groups; not owned by any group)

Named so nothing is orphaned: `kit/index.html` (the public `/kit` gallery:
`<div id="app" data-group="all">` + `../src/kit/gallery/dev.tsx`, with the
theme boot script) and smoke on `/kit`; `public/icons/icon-{192,512}.png`
(maskable install icons, rendered from the favicon; `vite-pwa` picks them up);
`src/kit/vite-pwa.ts` + test and `util/pwa.ts`'s worker side (the generated
`dist/sw.js` and `dist/manifest.webmanifest`); `vite.config.ts`,
`eslint.config.js`, `tsconfig*.json`; `scripts/{smoke,build-index,meta,new-lesson,build-pages,shoot,sync-progress}.ts`;
`src/site/**` (home, subject, graph, practice and exam pages built on
README §8.6); then the flagship lessons.

## 3. Dependencies, import graph and landing order

**Import graph between group folders** (acyclic; barrels.test.ts imports each
barrel alone, so an order-dependent cycle shows up there):

```
core ◄── everyone          (core imports nothing from the groups)
controls ──► core
visual   ──► core
structures ─► core          (+ @kit/math)
text     ──► controls, core
practice ──► text, visual, controls, core
shell    ──► controls, core, and text by FILE (`../text/Glossary`), never the `../text` barrel
gallery  ──► anything
```

Rules: **text never imports shell** (Trap renders its own
`figure.trap__fig`; it doesn't use `Figure`). **Nothing imports shell**
except lessons and the gallery. controls, visual and structures import no
other group. Import another group through its barrel (`../controls`,
`../visual`), except shell → text, which imports the file directly.

```
foundations (done) ──► every group
G4 controls ─┬─► G1 Derivation (Stepper), Formula (Toggle for the switches)
             ├─► G3 WorkedExample (Slider, Segmented for live params), Problem (Slider target; CodeCell + runSandboxed for code answers), ExamSet (runSandboxed)
             └─► G5 gallery demos (PlayScrub) — views themselves don't import it
G2 Stage2D + Handle ─► G3 Problem (drag mode 'point'), G2 Plot/MatrixGrid
G1 Glossary (installGlossary) ─► G4 LessonPage (imports the file once it exists)
G4 Figure ─► everyone's gallery demos (plates); until it lands, use raw `.plate` markup in demos only
```

**Land first** (in this order, each within the first stretch of work):
G4: `Toggle`, `Segmented`, `Stepper`, `Slider`, then `runSandboxed`, `Figure`, `Step`.
G2: `Stage2D` with `Vector`, `Point`, `Handle`, `useStage`.
Everyone else: build what has no dependency first (G1 Formula logic,
explain-layout, TLDR, Trap; G3 numeric/symbolic/choice/proof inputs,
ProblemSet, Quiz; G5 ArrayView, TableView, arch-sim).

**Never stub another group's component inside a component file.** Until a
dependency exists, build the parts that don't need it, or put a clearly
marked placeholder in your *gallery demo* only. When it lands, import it from
its barrel (`../controls`, `../visual`), not from a deep path, so later
refactors don't break you.

## 4. Acceptance criteria per component

Beyond §1. Numbers are testable.

### G1 — formulas & text <!-- region:G1 -->

- **Formula**: renders `tex` with concept colours; spreads a `FormulaSpec`
  (`id` → DOM id and `data-formula`); `data-explain` present whenever
  `explain` has a note; every `\anchor` with an `explain` entry gets a note;
  **repeated anchors**: note, leader, stub and inline live value on the first
  occurrence only, every occurrence lit on hover (use `text/anchors.ts`;
  explain-layout test includes a formula with a repeated anchor); wide layout
  (≥ 560px block) places notes under their symbols with no two notes
  overlapping and no leaders crossing (pure layout function, tested on
  synthetic boxes incl. 6 crowded symbols); < 560px switches to
  `.is-stacked` key with line-style stubs; brackets span their anchor's box;
  hovering or **focusing** a note, bracket or symbol lights the concept/term
  on the link bus and back (notes are `tabindex=0`); `live` values hang under
  symbols and update on signal change without re-rendering KaTeX (only the
  `.lv` text changes; verify with a render counter); *Live values* shows
  `.lv-grid` that fits 390px for a 2×2 matrix and two vectors; switches are
  `role=switch` with `aria-checked`; layout re-runs on resize and after fonts
  load; zero layout shift > 4px when toggling.
- **Derivation**: spreads a `DerivationSpec`; one step visible by default;
  Stepper next/prev; "Show all"; new step `.is-entering` 420ms; `\chg` sweep;
  anchors shared between steps FLIP-slide **paired by `pairAnchors`** (k-th
  occurrence to k-th; the gallery has a step pair with a repeated and an
  extra anchor), vanished/new extras fade (≤ 420ms total); reduced motion:
  no movement; print/`?all` show all steps; justification below maths at
  390px; rows never overflow the text column.
- **Glossary/Term/installGlossary**: popover opens on hover (desktop), focus
  (keyboard) and tap (touch); definitions render as Rich (TeX works); Esc and
  outside-tap close it; stays within the viewport at 390px; rendered inside
  the current concept scope; "Defined in" link when the term belongs to
  another lesson; unknown terms are plain text; works on RichText's `dfn.gloss`.
- **TLDR**: three points + formula + key; Print card uses
  `printWithClass('print-card')` (class removed on `afterprint`, never
  synchronously) and prints only the card in the print ink set (check with
  `page.emulateMedia({ media: 'print' })` screenshot, as smoke does).
- **Trap**: `article.card.trap[data-trap]`; myth with ⚠, explanation, "What's
  true."; counterexample from `figure` or `figures[spec.figure]` in
  `figure.trap__fig[data-figure="trap-<id>"]` with figcaption =
  `figureCaption` and sr-only `figureDescription`; a missing renderer renders
  no `<figure>` and logs one `console.error`; stacks at 390px; never imports
  `../shell`.
- **Callout/Sidenote**: three callout kinds; sidenotes in the margin ≥ 1000px,
  fold inline with a numbered toggle below (`aria-expanded`).
- **RichText polish**: syntax stays backward compatible; link safety kept;
  new syntax documented in README §1.7 and tested.

<!-- /region:G1 -->

### G2 — visuals <!-- region:G2 -->

- **Stage2D**: world↔pixel scales are pure and tested (equal scale, aspect,
  view expansion); grid/axes/ticks use `niceStep` with U+2212 minus labels;
  static layer never repaints during a drag (assert in a test or a dev counter);
  a drag frame does ≤ 1 dynamic-layer render; pan/zoom off by default and never
  steal page scroll (wheel zoom needs ctrl/⌘; one-finger drag on empty space
  scrolls the page on phones); with pan/zoom on, the focused stage pans with
  arrows, zooms with +/−, resets with 0; handles: 44px hit, keyboard arrows
  (0.1, Shift 0.5), `role=slider` + live `aria-valuetext`, constraints (`x`,
  `y`, `curve`, `line`, `circle`, function) and magnetic snap to targets;
  `onDragEnd(value)`; `correct` turns the handle and its line green;
  first-touch breathing ring + "drag the ring" note disappear after the first
  interaction; dragging lights the handle's concept on the link bus; labels
  haloed and clamped inside the plate; works with touch (Playwright
  `hasTouch` drag) at 390px.
- **Plot**: every series kind renders, including `contour` (levels from a
  list or a count; labels optional) and `heat` (sequential and diverging,
  with a key); `function` sampling is adaptive and breaks at poles (tan x
  shows no vertical connector); `auto` y-range ignores infinities;
  **reactivity**: a `function` series whose `f` reads a signal re-samples
  when it changes and *only that series* re-samples (test with a sample
  counter), `f` may also be a `ReadonlySignal`; gallery demo: a tangent line
  driven by a Handle on the curve; live series update from signals at
  ≥ 55fps for 2,000 points; linked cursor shared between stacked plots and
  operable as a `role=slider`.
- **MatrixGrid**: drag î/ĵ (snap 0.5) updates the matrix signal and the
  entries panel; transformed grid + unit square with signed area (orientation
  flip visible without colour: hatch); eigen directions drawn when real;
  `morph` 0→1 interpolates via `lerpMat2`; keyboard can edit entries;
  `vectors[]` draw v (draggable when writable) and, with `image`, A·v as a
  derived arrow through the morph; `onDragEnd` fires once per drag;
  `imageOf()` returns the same value the image arrow shows (tested).
- **Stage3D**: orbit (drag), keys rotate, Reset view; default camera shows the
  whole `bounds`; ≥ 55fps for a 60×60 surface on the dev machine or detail
  scales down (QualityGovernor); `fallback` caption when rendering fails; no
  autorotation under reduced motion; `Point3D`/`Points3D`/`Polyline3D`/
  `Vector3D`/`Plane3D` accept signals and a signal change never rebuilds the
  `Surface` mesh (dev counter in the gallery: a ball moved by PlayScrub along
  a GD path on a loss surface); three.js only via lazy import and only if
  the SVG/canvas renderer can't do a scene (justify here).
- **MatrixGrid3D**: lattice, î/ĵ/k̂, unit cube → parallelepiped with signed
  volume `det3` in a 3×3 entries panel; negative determinant hatched and
  named in words; zero determinant flattened with a "volume 0" note; entries
  editable by keyboard; lazy like Stage3D.
- **math/** additions (landed by the architect, now G2's): `gradient2`,
  `hessian2`, `secantSlope`, `quadraticRoots`, `charPoly2`, `gdPath`,
  `contours`, `contourLevels`, tested against analytic values; add more the
  same way when a second lesson needs them.

<!-- /region:G2 -->

### G3 — practice <!-- region:G3 -->

- **WorkedExample(Set)**: step 1 visible; a pause before every later step with
  the step's `tryIt`; Reveal and "I've done it, compare" both reveal; answer
  veiled until the last step; sanity check after; live params: sliders
  (linear/log) and `choice` segmented controls; every field recomputes with
  no reload; `accept()` rejections keep the last accepted values, snap the
  control back and show the reason; reveal state is a count clamped to the
  new step count; an external `params` signal and a figure's `setParams`
  drive the same values; tabs with arrow keys, `aria-selected`, all panels in
  the DOM with `data-worked-example` (bodies after step 1 mount on first
  show); `progress.example` written.
- **Problem**: every answer kind works with mouse, keyboard and touch
  (numeric incl. `shape` matrix grid, `complex`, `equivalence` help text;
  symbolic incl. `+ C`; choice incl. multi-select and askReason; drag point/
  order/match/slider/custom; proof; code); live "We read" preview for typed
  answers; feedback in `aria-live`; the common-wrong note appears exactly when
  `Verdict.commonWrong` is set; hints unlock in order and record the highest
  level; Show solution asks once and records a reveal; Another one appears only
  with a generator and never repeats the previous seed's prompt; progress goes
  to the `lessonId` prop or `useKit().lessonId`; `data-problem` and element ids
  namespaced with `problemKey`/`domId` on mixed pages; hints, solution and
  wrong notes mount on first open; `mode="exam"` shows inputs only and writes
  `response`; `mode="review"` shows response, verdict, solution and every
  common-wrong note; code answers run in `runSandboxed` with a timeout and
  show per-test results (hidden tests' args hidden).
- **ProblemSet**: `problems` + `figures` + `customs` (lesson page) or `items`
  (mixed: each in a scoped `KitProvider`, figures from `entry.figures`, two
  lessons defining the same concept name keep their inks: gallery demo);
  dot strip reflects progress after reload; all `article[data-problem]` in the
  DOM (non-current `hidden`); `aria-current="step"` on the current dot;
  "list" mode for practice pages; missing renderers log a `console.error`.
- **Quiz**: immediate per-option feedback with the option's `why`; question
  `figure`s from `figures`; Try again / Next question; summary at the end;
  all questions in the DOM with `data-quiz-question`; `progress.quiz` +
  `progress.complete` when finished.
- **Predict**: Lock in disabled until a guess; guess immutable after locking;
  reveal + right/wrong line; custom guesses via `setGuess` (e.g. a Handle's
  or MatrixGrid vector's `onDragEnd`); `progress.predict`.
- **ExamSet**: start screen → paper from `drawExam` with a fresh seed per
  attempt → `Problem mode="exam"` questions, timer (`role=timer`, announced
  at 5 and 1 minutes only), submit with an unanswered-questions confirm and
  auto-submit at 0:00 → code graded in the sandbox → `scoreExam` → results
  and a walkthrough of `Problem mode="review"` → `progress.exam` + per-question
  attempts; "Try another paper" draws new generated instances.
- Inherited checkers and audits: keep all existing tests green; any new
  message, verdict reason or audit rule is tested.

<!-- /region:G3 -->

### G4 — controls, code & shell <!-- region:G4 -->

- **Slider**: all mapping through `core/slider-scale.ts`; `scale: 'log'`
  (resolution at both ends of 0.001…1.5), `exclude` (a slider over [−2, 2]
  with `exclude: [0]` never yields 0, by drag or key), default format
  sig-fig aware on log; thumb in concept ink; detents magnetic; value text
  tabular; keys (arrows/PageUp/PageDown/Home/End) always move; `aria-valuetext`;
  dragging lights its concept; `onCommit` on release only.
- **Toggle/Segmented/Stepper**: `role=switch` / `aria-pressed` / disabled ends;
  44px targets; labels from Rich.
- **PlayScrub**: play/pause/step/scrub/Home/End; never autoplays; pauses
  off-screen; per-frame notes announced; 2 fps max under reduced motion.
- **Scrolly**: pinned visual on desktop and phone (≤ 45vh); `step` signal
  follows the step nearest the viewport centre; reads in order without JS;
  steps carry `data-step`.
- **CodeCell + runSandboxed**: Run/Reset; logs and errors with line numbers
  relative to the visible code (prelude errors say so); infinite loop stopped
  at `timeoutMs` and the worker replaced (next run works); `fetch`/
  `importScripts` unavailable inside (test it); the worker calls
  `runSnippet`/`runCodeTests` and posts through `sanitizeReport`/`toCloneable`
  (a test returning a function doesn't throw); `helpers`/`prelude` hidden;
  `outputs` validated by `parse`: a malformed emit shows a learner-facing
  error and leaves the signal untouched (gallery demo); `from: 'all'` and
  `stream` (throttled, last emit always delivered) work; a non-cloneable input
  refuses to run with `cloneIssue`'s message; `inputs` changes re-run under
  `autorun` (debounced); concept identifiers underlined; editor: Tab indents,
  **Esc then Tab leaves** (no keyboard trap; Playwright test), visible keys
  hint; usable at 390px (horizontal scroll inside the cell only); the worker
  is typed with `workerScope()`.
- **LessonPage/Section/Step**: rail first in `.page`; sections numbered; rail
  `aria-current` follows scrolling; `progress.visit/section` written; concepts
  mounted once (page-wide); linking and glossary installed once (`glossary`
  prop or `meta.glossary`); `?thumb` hides the masthead; skip link works;
  heading order h1 → h2 → h3; `Step` renders `[data-step]` with an h3 title.
- **Figure (+ Readout, Mission, Legend, FigKeys)**: `data-figure`, figcaption,
  `aria-describedby` to caption + sr-only description; `central` adds
  `data-thumb`; wide and phone full-bleed layouts per DESIGN.md §3/§5;
  mission ticks animate ≤ 240ms and are announced.
- **SiteHeader/ReadingProgress/ThemeToggle**: crumbs collapse on tablet,
  phone shows wordmark + toggle + hairline progress; theme toggle persists
  (`setThemePreference`) and syncs `meta[name=theme-color]`.
- **WhereNext/References**: prerequisites and dependents from curriculum.ts;
  shipped lessons link, unshipped are dashed "coming soon" (not links);
  references formatted per DESIGN.md §8 in `li[data-ref]`, no fetching.
- **mountLesson**: `initTheme`, render, `registerPWA()` (URL from the
  manifest link; no argument needed at any depth).
- **Lesson template**: `npm run new -- linalg eigenvectors` produces a lesson
  (index.html, lesson.tsx, figures.tsx, math.ts, problems.ts, lesson.test.ts,
  meta.json, NOTES.md) that builds, renders every required section as a
  clearly-marked `wip` skeleton, imports `@kit/pure` in problems.ts/math.ts,
  and whose test runs `auditLesson(content, { knownLessons })`,
  `auditFigureKeys(content, FIGURES)` and a `runSnippet` check (skipped
  while the content is still a stub).

<!-- /region:G4 -->

### G5 — data structures & systems <!-- region:G5 -->

- **ArrayView/TreeView/GraphView/TableView**: render a state; animate to the
  next state by stable ids (FLIP, 420ms; instant under reduced motion); every
  `Mark` styled per README §9 with a non-colour cue; per-element aria-labels
  and a hidden frame summary; 60 cells / 31 nodes / 40 nodes + 80 edges /
  20×20 table stay ≥ 55fps while scrubbing; phone: own-box horizontal scroll,
  44px cells; layouts from `math/layout.ts` (G5's: TreeView `inorder` keeps
  BST order through rotations; GraphView `layered` for DAGs); keyboard per
  README §9.6: click handlers make elements focusable buttons (Enter/Space,
  roving tabindex, arrow navigation), editable graphs move nodes with arrows.
- **ArchDiagram + arch-sim**: sim is pure and deterministic per seed;
  tests: utilisation ≈ load/capacity below saturation (±5%), queue growth past
  saturation, Little's law L ≈ λW (±10%), cache hit rate converges to
  `hitRate`, failing one of two replicas behind a round-robin LB moves its
  traffic to the other; view shows request dots (thinned at load, none under
  reduced motion), failure injection by click/Enter, metrics strip updated at
  most every 2 s for screen readers.

<!-- /region:G5 -->

### Integration

- `/kit` renders every group with zero console messages at both sizes and in
  dark mode; smoke covers it.
- Install icons 192/512 (maskable safe zone) in `public/icons/`; the manifest
  lists them; smoke's offline step passes on a real lesson.
- Subject practice and exam pages follow README §8.6 (glob + lessons.json),
  including a lesson with `figures.tsx`.

## 5. Group status

Each group keeps a short status list here (component · state · notes),
between its `<!-- status:Gn -->` markers.

<!-- status:G1 -->
- G1: not started.
<!-- /status:G1 -->
<!-- status:G2 -->
- **Stage2D** + Vector, Segment, Line, Point, Curve, Polyline, Polygon, Label, Band, Arc, CanvasLayer, ConceptGroup, Handle, useStage · ✅ done. Static layer never re-renders during a drag (Playwright: `data-renders` counter); ≤ 1 render per subscriber per frame (rAF-coalesced writes); pan/zoom off by default, ctrl/⌘-wheel only, one finger scrolls on phones; touch drag on handles at 390px moves them without scrolling (CDP touch events).
- **Plot** (all 11 series kinds, cursor, heat key) · ✅ done. Only the series whose signals change re-samples (series.test.ts + live `data-samples` counter); 2,000-point live series measured 59–60 fps (best of three; 42–58 under load from the parallel builds on this 4-core box).
- **MatrixGrid** + `imageOf` · ✅ done (basis drag with snap, steppers, hatch on flip, eigen bands, morph, onDragEnd once per drag; imageOf tested).
- **Stage3D** + Surface, Point3D, Points3D, Polyline3D, Vector3D, Curve3D, Plane3D, VectorField3D · ✅ done. **No three.js**: canvas 2D for overlays and a small raw-WebGL path for surfaces (`stage3d-gl.ts`), because canvas path fills cost ~0.1 ms/quad on software-rendered browsers (60×60 surface: ~370 ms/frame in headless Chromium) while one z-buffered WebGL draw costs a few ms there; three.js would add ~150 KB gz for nothing this needs. Signal changes never rebuild the mesh (`data-builds` stays 1 while PlayScrub moves the ball).
  Frame rate on this dev machine (headless Chromium, SwiftShader software GPU): orbiting the 60×60 surface runs ~29–34 fps with the scene alone and ~22 fps on the full gallery page; QualityGovernor does scale detail down (mesh resolution and GL backing-store scale) as the criterion allows. A trace shows the main thread ~8% busy and the GPU process dominated by `GLContextEGL::MakeCurrent` (context switches between canvases in software GL), which a hardware GPU doesn't pay; even a WebGL-only frame tops out at ~40 fps here. Not verified on a real GPU from this box.
- **MatrixGrid3D** + `imageOf3` · ✅ done (3×3 steppers, phone tap-to-select editor, hatch + words on flip, "volume 0" on collapse, eig3 rose lines, basis drag in the camera plane, morph).
- **math/** additions: `cubicRoots`, `eig3` (math/eig3.ts, tested).
<!-- /status:G2 -->
<!-- status:G3 -->
- G3: not started.
<!-- /status:G3 -->
<!-- status:G4 -->
- G4: **done** (every G4 component; import from `../controls` / `../shell`).
  - Controls: `Toggle`, `Segmented`, `Stepper`, `Slider`, `PlayScrub`, `Scrolly`, `CodeCell` + `codeOutput` + parsers, `runSandboxed` (+ `createSandbox`, worker `sandbox.worker.ts`). Shell: `LessonPage`, `Section`, `Step`, `Figure` + `Readout`/`ReadoutPair`/`Mission`/`Legend`/`FigKeys`, `SiteHeader`, `ReadingProgress`, `ThemeToggle`, `WhereNext`/`References`/`LessonCard`, `mountLesson`. Lesson template in `scripts/lesson-template/`.
  - Tests: controls/{timeline,sandbox,highlight,editor,parsers}.test.ts, shell/shell.test.ts, core/slider-scale.test.ts (detents); Playwright interaction checks (keyboard, mouse, touch at 390px, reduced motion, Esc-then-Tab) run against the dev page and a generated lesson.
  - Open: `tsc -p tsconfig.node.json` type-checks `scripts/lesson-template/*` (it includes `scripts/`), where `@kit` aliases, JSX and `{{order}}` in meta.json can't resolve: needs an `exclude` (§6 request). Glossary popovers wait for G1's `text/Glossary.tsx` (LessonPage picks it up automatically).
<!-- /status:G4 -->
<!-- status:G5 -->
- G5: not started.
<!-- /status:G5 -->

## 6. Change log (append only)

One line per change to a public API, a shared contract, or a request to
another owner: `YYYY-MM-DD · group · what changed / what you need`.

- 2026-10-23 · architect · Foundations landed: types.ts, core/ (link bus, RichText, Tex, MathChain, answers, expressions, units, codecheck, problems + audits, progress, rng, context, hooks, icons, LineSwatch, live), math/, util/ (absorbed src/shared), vite-katex (registered in vite.config.ts), gallery host + dev pages, per-group CSS files imported by styles/index.css.
- 2026-10-23 · architect · Added `.is-linked` (term-level link highlight), `.rich`, `dfn.gloss` and `.line-swatch` rules in styles/core.css (now G1's).
- 2026-10-23 · architect · Review round: pure entry `@kit/pure` (problems.ts/math.ts import it; ESLint boundaries for lessons and pure modules; barrels.test.ts loads every barrel alone in Node).
- 2026-10-23 · architect · types.ts: `NumericAnswer.equivalence` ('scalar-multiple' | 'direction'), `shape` (matrix grid), `complex`, `check`; `WorkedExampleSpec.accept`, `ChoiceParam` (`kind: 'choice'`), `LiveParam.scale`; `StepSpec.tryIt` required by the example audit after step 1; `FormulaSpec`, `DerivationSpec`; `TrapSpec.figure` required + `figureCaption` + `figureDescription`; `QuizQuestion.figure`; `GlossaryTerm` (Rich definitions); `LessonContent` (the problems.ts export contract, incl. `SNIPPETS`); `PracticeItem`.
- 2026-10-23 · architect · core: `pretty.ts` (texNum, polyTex, polyExpr, signedTerm, sumTex, texParen, findUglyTex; `exprToTex(e, { pretty })`, `tidyExpr`); `lesson-audit.ts` (auditLesson & parts, figureKeys, auditFigureKeys, validateLessonModule, used by build-index); `exam.ts` (problemKey, domId, drawExam, scoreExam; code responses carry `source` until graded); `slider-scale.ts`; `figures.ts` (defineFigures, LessonFigures, PracticeEntry); codecheck `runSnippet`, `sanitizeReport`, `cloneIssue`, `toCloneable`, helpers/prelude; problems `drawTyped`, `forEachSeed`, `acceptParams`; answers: equivalence/shape/complex/check, `+ C`, token-level `disallow`, angle-vs-cycle units, per-item units, unitless-with-unit message, exact-form and tolerance-matched common wrongs, `writtenPrecision` fix; richtext link safety and balanced URLs; hooks re-attach observers when the element changes.
- 2026-10-23 · architect · theme: `ConceptSet.css(scope)` / `mount(doc, scope)` / `conceptRules(…, scope)` emit `[data-lesson="<id>"]`-scoped rules; `KitProvider` renders `div.kit-scope[data-lesson]` and mounts them when given `lessonId` + `concepts` (`scoped` prop).
- 2026-10-23 · architect · math: `analysis.ts` (gradient2, hessian2, secantSlope, quadraticRoots, charPoly2, gdPath) and `contour.ts` (contours, contourLevels), tested. Ownership: math/** → G2 except `math/layout.ts` + test → G5.
- 2026-10-23 · architect · util: `printWithClass` (afterprint-safe printing for TLDR), `workerScope`/`inWorker` (typed worker global). text: `anchors.ts` (anchorOccurrences, noteCarriers, pairAnchors) seeded for G1. vite-pwa plugin (manifest link per page, manifest, precache-everything sw.js; `registerPWA()` derives its URL from the manifest link).
- 2026-10-23 · architect · README API changes for the groups: G1 Formula `id`/`data-formula`/focusable notes/repeated anchors, Derivation `id` + FLIP pairing, Trap `figures` + `data-trap` + missing-renderer rule, TLDR `printWithClass`; G2 Plot `contour`/`heat`, signal-tracking series, keyboard cursor, Stage2D keyboard pan, Handle `onDragEnd(value)`, MatrixGrid `vectors[].image`/`onDragEnd` (no more ambiguous `transformed`) + `imageOf`, Stage3D signal props + `Point3D` + `Polyline3D` + no-rebuild guarantee, `MatrixGrid3D`; G3 Problem `lessonId`/`instance`/`mode` ('practice' | 'exam' | 'review')/`response`/`verdict` and matrix/complex inputs, ProblemSet `figures`/`customs`/`items`, Quiz `figures`, WorkedExample `params` signal + figure `setParams` + accept/choice/reveal-count rules, new `ExamSet`; G4 Slider `scale`/`exclude`/`sig`, CodeCell `helpers`/`prelude`/`outputs: CodeOutput` (`parse`, `from`)/`stream` + Esc-Tab escape, runSandboxed streams/onEmit/clone checks, `Step`, LessonPage `glossary`, References `li[data-ref]`; G5 keyboard parity (§9.6) and layout ownership.
- 2026-10-23 · architect · smoke: figures in hidden panels skipped (caption still checked), per-figure try/catch; counts `[data-step]` 3–6, `[data-trap]` 2–4, `[data-ref]` ≥ 2, `[data-formula][data-explain]` ≥ 1; dark + reduced-motion pass; heading order; 44px + accessible-name audit on phones (`data-hit` opt-out); print screenshot of `.tldr`; offline check; imports `CODE_SUBJECTS`/`LESSON_SECTION_IDS` from types.ts. build-index validates `C`/`PROBLEMS`, indexes `FORMULAS`/`GLOSSARY` (plain text via richToPlain), records `hasProblems`/`hasFigures`.
- 2026-10-23 · G4 · Landed Toggle, Segmented, Stepper, Slider, runSandboxed, Figure (+ Readout, ReadoutPair, Mission, Legend, FigKeys), Section, Step, PlayScrub, Scrolly, CodeCell, LessonPage, SiteHeader, ReadingProgress, ThemeToggle, WhereNext, References, mountLesson (README §4, §7). Import from `../controls` / `../shell` barrels.
- 2026-10-23 · G4 · Additive API: `Figure` `controls` prop (knobs set under the readout, `.plate__controls`); `Stepper` `name`/`onChange`; `Toggle`/`Segmented` `onChange`; `PlayScrub` `name`; `Scrolly` `label`; `Section` `n` (number when used outside LessonPage); `ReadoutPair` takes a signal/getter/number/vector or JSX. core/slider-scale.ts (G4-inherited): `magnetDetent`, `detentValue`, `sliderExtreme`, `SliderDetent`, tested.
- 2026-10-23 · G4 → G1 · LessonPage loads `text/Glossary.tsx` by file (an eager `import.meta.glob`, so it builds before the file exists) and calls `registerGlossary(entries)` with `{ term, definition, lesson }` then `installGlossary()` (whose return value it calls on unmount). Please export both names from that file as README §5.3 says.
- 2026-10-23 · G4 → integration · Lesson crumbs point at the subject on the home page (`../../../#<subject>`, `shell/links.ts` `subjectHref`) until subject pages exist; change that one function when they land. Lesson pages show prerequisite links only for shipped lessons (lessons.json); WhereNext the same.
- 2026-10-23 · G2 · Landed Stage2D and its primitives + Handle (README §6.1). Additive API: Handle `snapDirections` (+ `origin`, 3° magnet), `symbol`/`valueText` (spoken value), `disabled`; primitives `correct` (draw green when found); Vector `labelAnchor`/`labelGap`; Point `hollow`; Curve `domain`; Polygon `fill: 'none'`, `outline`; Label `gap`, `focusable`, `term`; `ConceptGroup`; StageApi `pxPerUnitY`; `[data-touch-capture]` on any custom draggable inside a stage cancels touch scrolling like a handle. A curve-constrained handle stays on the part of the curve inside its bounds (Home/End go to that piece's ends). Stage elements expose `data-renders="static:n dynamic:m"` (dev counter).
- 2026-10-23 · G4 → integration (tsconfig.node.json, owner decision) · `scripts/lesson-template/` (what `npm run new` copies; G4's) holds lesson files with `{{vars}}`: `tsconfig.node.json` includes `scripts/`, so `tsc -p tsconfig.node.json` now reports errors there (meta.json's `"order": {{order}}` isn't JSON; `@kit/*` aliases and JSX don't resolve in the Node project). Please add `"exclude": ["scripts/lesson-template"]` to tsconfig.node.json. The template is verified by generating a lesson (`npm run new -- linalg eigenvectors` in a copy of the repo): the generated lesson passes `tsc -p tsconfig.json`, ESLint, its vitest file, builds, and renders every section. Vitest also picks up `scripts/lesson-template/lesson.test.ts` (it passes in place, reading meta.json defensively); excluding it from `test.include` would be tidier.
- 2026-10-23 · G4 → integration (scripts/smoke.ts) · Smoke's main passes use `serviceWorkers: 'block'`, and Chromium then logs "Service Worker registration blocked by Playwright" (a console warning) when `mountLesson`'s `registerPWA()` runs, so every lesson fails smoke on it. Please add `/Service Worker registration blocked by Playwright/` to `IGNORED_CONSOLE` (the offline pass, with workers allowed, still checks registration).
- 2026-10-23 · G4 · A wip lesson from the template renders every §4 section with `data-wip` placeholder cards; smoke still fails it on the counted containers (examples, problems, quiz, traps, refs, formula, KaTeX, `.tldr`) by design. If wip lessons should be allowed on `main`, smoke could skip the count checks for lessons whose meta.json says `"status": "wip"` (integration decision).
- 2026-10-23 · G2 · Landed Plot (README §6.2) and MatrixGrid + `imageOf` (§6.3). Additive: PlotSeries `layer?: 'static' | 'dynamic'` (default dynamic for series with functions/signals, which may read signals; pass 'static' for a heavy constant series), Plot `cursorLabel`/`grid`/`hint`/`class`; Stage2D `axes.ticks: 'x' | 'y'`; MatrixGrid `concepts.grid`/`concepts.eigen` (defaults: the lesson's `matrix`/`eigenvalue` concepts when defined), vector `tex` labels, `symbol`, `aspect`, `hint`; exports `imageValue`, `isWritableSignal`. A Handle without a concept is ink (not input blue).
- 2026-10-23 · G2 → all · Heads-up from G2's Playwright checks: (1) on SVG elements Preact writes `tabIndex` as a case-sensitive attribute that browsers ignore, so an SVG `<g tabIndex={0}>` is NOT focusable; write lowercase `tabindex={0}` on SVG elements (G5 views, any SVG control). (2) Don't import `preact/compat` (e.g. for createPortal): it installs global option hooks (it rewrites `onChange` to `onInput` on text inputs, among others) that silently change every component on the page; G2 uses its own small portal (`visual/portal.tsx`).
- 2026-10-23 · G2 · Landed Stage3D (+ primitives) and MatrixGrid3D (`@kit/visual/Stage3D`, README §6.4). Camera angles are degrees; additive Stage3D props `box: 'equal' | 'cube'`, `aspect`, `axisNames`, `forceFallback`, `noWebGL`; Polyline3D/Vector3D `width`; MatrixGrid3D `bounds`, `symbol`, `aspect`, vector `tex`, `concepts.lattice/eigen`; `imageOf3`. Surfaces render through a small raw-WebGL path (no three.js; justified in the G2 status). `@kit/math` gains `cubicRoots` and `eig3`. MatrixGrid's CSS classes are `.mxg*` (renamed from `.mgrid*`, which G3's matrix answer input owns).

## 7. Review decisions

What the two adversarial reviews (43 issues) changed, and where the contract
deliberately differs from a suggestion. Everything not listed here was done
as suggested (see §6 and the README).

- **Exam mode (12, 24.4)**: a separate `ExamSet` component plus
  `Problem mode="exam" | "review"`, rather than `ProblemSet mode="exam"`. The
  exam is a different flow (start screen, timer, deferred grading,
  walkthrough), and keeping it out of ProblemSet keeps the lesson-page set
  simple. ProblemSet stays `'paged' | 'list'`.
- **3×3 transforms (13, 22)**: `MatrixGrid3D` in `@kit/visual/Stage3D`
  instead of `matrix: Signal<Mat2> | Signal<Mat3>` on MatrixGrid. A union
  would hide a heavy lazy 3D renderer behind a 2D component's import and
  make every prop (snap, view, editable) mean two things; the separate name
  keeps the 2D lesson's bundle small and the API honest.
- **Plot reactivity (14)**: both, as offered: series track signals read
  inside `f`, and `f` may also be a signal. The binding part is the
  re-sampling rule ("only that series, at most once per frame"), tested.
- **customs keying (1, 23)**: by the problem's `figure` key, not its id, so
  one map shape serves problems, examples, traps and quiz, and
  `auditProblems` already requires custom targets to have a `figure`.
  `auditFigureKeys` (new) checks every key has a renderer, in the lesson test.
- **Slider zero (5)**: a general `exclude: number[]` instead of `avoid0`;
  `[0]` is the common case, and the same rule keeps other singularities off
  the track.
- **CodeCell streaming (6, 29)**: `runSnippet` returns both `emits` (last)
  and `streams` (all, snapshotted); a `CodeOutput` picks `from: 'last' | 'all'`
  and the cell's `stream` option decides *when* values arrive. This replaces
  "append when the signal holds an array", which would make the meaning of
  an emit depend on the receiving signal's current value. Lessons test the
  shipped snippet with `runSnippet` in Node; the snippet's source lives in
  problems.ts `SNIPPETS`.
- **tryIt (16)**: the audit requires a `tryIt` on every worked-example step
  after the first (the first suggestion), rather than deriving a prompt from
  the next step's title: a generic "try the next step" is exactly the
  degradation the reviewer warned about.
- **math/layout.ts ownership (38)**: ownership moves to G5 but the file stays
  at `src/kit/math/layout.ts`: types.ts imports `TreeNode` from it and
  `@kit/math` re-exports the layouts, so moving it would break both for no
  gain. "Owner" is about who edits, not where the file sits.
- **components.css (38)**: stays frozen as the design-system source; groups
  override in their own CSS file (it loads later) and log structural changes.
  Letting five groups edit one 2,400-line file would break "one owner per
  file".
- **Worker typing (43a)**: a typed shim (`util/worker.ts`, `workerScope()`)
  instead of a `tsconfig.worker.json`: a second project would need its own
  include/exclude in the shared tsconfig and in CI, and `lib: webworker`
  clashes with DOM anyway. The shim is three lines of types.
- **Quality bar tooling (32)**: smoke now runs the cheap §11 checks (dark +
  reduced motion, 44px targets and accessible names on phones, heading order,
  print card, offline). Real Lighthouse scores, axe and a Firefox pass need
  `lighthouse` / `@axe-core/playwright` and Playwright's Firefox, which are
  not installed; adding them is an owner decision (no `npm install` in this
  workflow). Until then §11's Lighthouse numbers are checked by hand.
- **Lesson performance (30)**: the contract now requires only the counted
  containers at load and on-demand mounting of hidden content, which is the
  bulk of the TeX. Build-time prerendering of lesson pages would need
  `preact-render-to-string` (not installed): an owner decision, recorded here
  and worth revisiting once the flagship lessons can be measured.
- **Per-page CSS (43e)**: every page imports all group CSS for now
  (simplest, cached once for the whole site by the service worker); revisit
  if the kit CSS passes ~30 KB gzipped.
- **Trap without figure (31)**: the figure is required (type + audit), so
  "omit the figure element" applies only to a *missing renderer*, which also
  logs an error so it cannot ship silently.
- **Install icons (25)**: the plugin, manifest, precache-everything worker,
  depth-independent registration and the offline smoke step are done; the
  192/512 PNG icons are an integration task (§2) because they are binary
  assets rendered from the favicon. The SVG icon is listed meanwhile.
- **Prose terms and keyboard (37)**: prose `span.term` and raw KaTeX symbols
  stay out of the tab order (a tab stop per term would wreck keyboard
  navigation of long prose); focusable explain notes, legend rows and
  figure elements carry the same concepts and are the keyboard route.
