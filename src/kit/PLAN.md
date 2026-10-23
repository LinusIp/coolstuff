# Kit build plan: five groups, no collisions

The foundations are done and tested (core/, math/, util/, types.ts,
vite-katex, gallery host, barrels). The rest of the kit is split into five
groups that work **in parallel in one checkout without coordinating**: each
file has exactly one owner, the APIs are fixed in [README.md](./README.md),
and the reference data is [gallery/samples.ts](./gallery/samples.ts).

## 0. Ground rules (every group)

1. **Own your files, read everyone's.** Edit only files your group owns
   (§2). Need a change elsewhere? Write it in the change log (§6) and work
   around it in your own files meanwhile. Shared documents (README.md, this
   file) are edited only inside your own `<!-- region:… -->` / `<!-- status:… -->`
   markers (and by appending to §6), and you re-read the file immediately
   before each edit.
2. **The README API is binding.** Implement the props as written. If one must
   change, keep it backward compatible where possible, update your README
   region, and log it in §6 so dependants see it.
3. **Never** run `npm install`, edit package.json/package-lock.json,
   vite.config.ts, scripts/ (except G4's lesson template), the design system
   (theme.ts, notation.ts, DESIGN.md, NOTATION.md, styles/{fonts,tokens,base,
   layout,components}.css), types.ts outside your section, or src/content/.
   Never run plain `npm run build` (dist/ is shared), never commit or push.
4. **Build and look at your own pages only:**
   `npx tsx scripts/build-pages.ts <scratch>/dist kit/_dev/<group>.html`, then
   `npx tsx scripts/shoot.ts --dist=<scratch>/dist --out=<scratch>/shots [--w=390 --h=844] [--dark] [--full] [--selector=…] /kit/_dev/<group>.html`
   and read the PNGs. shoot.ts prints console errors/warnings: there must be none.
5. **Checks before you call a component done:**
   `npx tsc --noEmit -p tsconfig.json` · `npx tsc --noEmit -p tsconfig.node.json` ·
   `npx eslint <your paths>` · `npx vitest run <your paths>`.
6. **Pure logic lives in `.ts` files with vitest tests** (layouts, sampling,
   simulations, parsers, state machines); components stay thin.
7. **Styles**: only in your group's CSS file (§2), only design tokens
   (`--ink*`, `--hue-*`, `--w-*`, `--sp-*`, `--dur-*`, `--fs-*`…), reusing the
   classes components.css already has (DESIGN.md §13) before adding new ones.
8. **No heavy imports at module top level** (three.js, d3-force): lazy
   `import()` inside the component. No runtime network requests.

## 1. Definition of done (every component)

- Matches its README section (props, states, DOM classes, data hooks).
- Exported from the group's barrel (`<folder>/index.ts`) and therefore from `@kit`.
- Gallery demos in `gallery/<group>.tsx` for every state worth seeing (default,
  hover-linked, focused, error/empty, solved/done, live-updating), with real
  data (samples.ts or your own).
- Screenshots of the dev page at **1280×800 and 390×844, light and dark**,
  looked at and intentional; no horizontal scroll at 390px; zero console
  errors or warnings.
- Keyboard-complete; visible 2px ink focus; ≥ 44px targets; aria per README
  §1.9; colour never the only signal; reduced motion respected (states still change).
- Unit tests for its pure logic; typecheck, lint and tests green.
- Smoke-relevant hooks rendered exactly (README §2).

## 2. Groups and file ownership

Every path below has exactly one owner. "Inherited" files were written by the
kit architect and are handed over with their tests: keep their public
signatures (additive changes only) and keep their tests passing.

### Kit architect (frozen after handoff)

`src/kit/index.ts` · `src/kit/types.ts` (groups may add optional fields to their
own section only, logged in §6) · `src/kit/core/index.ts` · `src/kit/core/core.test.ts` ·
`src/kit/vite-katex.ts` + test · `src/kit/gallery/{types.ts,host.tsx,dev.tsx,core.tsx,samples.ts,gallery.css}` ·
`src/kit/styles/index.css` · `kit/_dev/{core,all}.html` · README.md and PLAN.md outside the group regions.

### G1 — formulas & text

| Owns | |
|---|---|
| New | `src/kit/text/**` (Formula.tsx, Derivation.tsx, Glossary.tsx, TLDR.tsx, Trap.tsx, Callout.tsx, explain-layout.ts + tests, index.ts) |
| Inherited | `core/link.ts`, `core/richtext.ts`, `core/richtext.test.ts`, `core/RichText.tsx`, `core/Tex.tsx`, `core/live.ts`, `core/LineSwatch.tsx` |
| Styles | `src/kit/styles/text.css`, `src/kit/styles/core.css` |
| Gallery | `src/kit/gallery/text.tsx`, `kit/_dev/text.html` |
| Docs | README region `G1` (§5), PLAN region `G1` |

### G2 — visuals

| Owns | |
|---|---|
| New | `src/kit/visual/**` (Stage2D.tsx + primitives, scales.ts + tests, Plot.tsx, MatrixGrid.tsx, Stage3D.tsx, index.ts) |
| Inherited | `src/kit/math/**` (add functions freely with tests; never change existing behaviour) |
| Styles | `src/kit/styles/visual.css` |
| Gallery | `src/kit/gallery/visual.tsx`, `kit/_dev/visual.html` |
| Docs | README region `G2` (§6), PLAN region `G2` |

### G3 — practice

| Owns | |
|---|---|
| New | `src/kit/practice/**` (WorkedExample.tsx, Problem.tsx, ProblemSet.tsx, Quiz.tsx, Predict.tsx, inputs/*, any pure state machines + tests, index.ts) |
| Inherited | `core/answers.ts`, `core/answers.test.ts`, `core/expr.ts`, `core/expr.test.ts`, `core/units.ts`, `core/problems.ts`, `core/problems.test.ts`, `core/codecheck.ts`, `core/progress.ts`, `core/progress.test.ts`, `core/rng.ts` |
| Styles | `src/kit/styles/practice.css` |
| Gallery | `src/kit/gallery/practice.tsx`, `kit/_dev/practice.html` |
| Docs | README region `G3` (§8), PLAN region `G3` |

### G4 — controls, code & lesson shell

| Owns | |
|---|---|
| New | `src/kit/controls/**` (Slider, Toggle + Segmented, Stepper, PlayScrub, Scrolly, CodeCell, sandbox.ts, sandbox.worker.ts, index.ts) · `src/kit/shell/**` (LessonPage, Section, Figure + Readout/Mission/Legend/FigKeys, SiteHeader, ReadingProgress, ThemeToggle, WhereNext + References, mount.tsx, index.ts) · `scripts/lesson-template/**` (what `npm run new` copies: index.html, lesson.tsx, math.ts, problems.ts, lesson.test.ts, meta.json, NOTES.md with `{{vars}}`) |
| Inherited | `core/context.tsx`, `core/hooks.ts`, `core/icons.tsx`, `src/kit/util/**` |
| Styles | `src/kit/styles/controls.css`, `src/kit/styles/shell.css` |
| Gallery | `src/kit/gallery/controls.tsx`, `kit/_dev/controls.html` |
| Docs | README regions `G4-shell` (§4) and `G4-controls` (§7), PLAN region `G4` |

### G5 — data structures & systems

| Owns | |
|---|---|
| New | `src/kit/structures/**` (ArrayView, TreeView, GraphView, TableView, ArchDiagram, arch-sim.ts + tests, flip.ts or similar helpers, types.ts (inherited, see below), index.ts) |
| Inherited | `src/kit/structures/types.ts` (ArchSpec & co.); types.ts §8 (state shapes: optional additions only) |
| Styles | `src/kit/styles/structures.css` |
| Gallery | `src/kit/gallery/structures.tsx`, `kit/_dev/structures.html` |
| Docs | README region `G5` (§9), PLAN region `G5` |

### Integration (after the groups, not owned by any)

`kit/index.html` (the public `/kit` gallery: `<div id="app" data-group="all">` +
`../src/kit/gallery/dev.tsx`, with the theme boot script), smoke on `/kit`,
then the flagship lessons.

## 3. Dependencies and landing order

```
foundations (done) ──► every group
G4 controls ─┬─► G1 Derivation (Stepper), Formula (Toggle for the switches)
             ├─► G3 WorkedExample (Slider for live params), Problem (Slider target; CodeCell + runSandboxed for code answers)
             └─► G5 gallery demos (PlayScrub) — views themselves don't import it
G2 Stage2D + Handle ─► G3 Problem (drag mode 'point'), G2 Plot/MatrixGrid
G1 installGlossary ─► G4 LessonPage (calls it once exported)
G4 Figure ─► everyone's gallery demos (plates); until it lands, use raw `.plate` markup in demos only
```

**Land first** (in this order, each within the first stretch of work):
G4: `Toggle`, `Segmented`, `Stepper`, `Slider`, then `runSandboxed`, `Figure`.
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

- **Formula**: renders `tex` with concept colours; every `\anchor` with an
  `explain` entry gets a note; wide layout (≥ 560px block) places notes under
  their symbols with no two notes overlapping and no leaders crossing (pure
  layout function, tested on synthetic boxes incl. 6 crowded symbols); < 560px
  switches to `.is-stacked` key with line-style stubs; brackets span their
  anchor's box; hovering a note, bracket or symbol lights the concept/term on
  the link bus and back; `live` values hang under symbols and update on signal
  change without re-rendering KaTeX (only the `.lv` text changes; verify with a
  render counter); *Live values* shows `.lv-grid` that fits 390px for a 2×2
  matrix and two vectors; switches are `role=switch` with `aria-checked`;
  layout re-runs on resize and after fonts load; zero layout shift > 4px when
  toggling.
- **Derivation**: one step visible by default; Stepper next/prev; "Show all";
  new step `.is-entering` 420ms; `\chg` sweep; anchors shared between steps
  FLIP-slide, vanished anchors fade (≤ 420ms total); reduced motion: no
  movement; print/`?all` show all steps; justification below maths at 390px;
  rows never overflow the text column.
- **Glossary/Term/installGlossary**: popover opens on hover (desktop), focus
  (keyboard) and tap (touch); Esc and outside-tap close it; stays within the
  viewport at 390px; "Defined in" link when the term belongs to another
  lesson; unknown terms are plain text; works on RichText's `dfn.gloss`.
- **TLDR**: three points + formula + key; Print card prints only the card in
  the print ink set (check with `page.emulateMedia({ media: 'print' })` screenshot).
- **Trap**: myth with ⚠, explanation, "What's true."; counterexample in
  `figure.trap__fig[data-figure]` with figcaption; stacks at 390px.
- **Callout/Sidenote**: three callout kinds; sidenotes in the margin ≥ 1000px,
  fold inline with a numbered toggle below (`aria-expanded`).
- **RichText polish**: syntax stays backward compatible; new syntax documented
  in README §1.7 and tested.

<!-- /region:G1 -->

### G2 — visuals <!-- region:G2 -->

- **Stage2D**: world↔pixel scales are pure and tested (equal scale, aspect,
  view expansion); grid/axes/ticks use `niceStep` with U+2212 minus labels;
  static layer never repaints during a drag (assert in a test or a dev counter);
  a drag frame does ≤ 1 dynamic-layer render; pan/zoom off by default and never
  steal page scroll (wheel zoom needs ctrl/⌘; one-finger drag on empty space
  scrolls the page on phones); handles: 44px hit, keyboard arrows (0.1, Shift
  0.5), `role=slider` + live `aria-valuetext`, constraints (`x`, `y`, `curve`,
  `line`, `circle`, function) and magnetic snap to targets; `correct` turns the
  handle and its line green; first-touch breathing ring + "drag the ring"
  note disappear after the first interaction; dragging lights the handle's
  concept on the link bus; labels haloed and clamped inside the plate; works
  with touch (Playwright `hasTouch` drag) at 390px.
- **Plot**: every series kind renders; `function` sampling is adaptive and
  breaks at poles (tan x shows no vertical connector); `auto` y-range ignores
  infinities; live series update from signals at ≥ 55fps for 2,000 points;
  linked cursor shared between stacked plots.
- **MatrixGrid**: drag î/ĵ (snap 0.5) updates the matrix signal and the
  entries panel; transformed grid + unit square with signed area (orientation
  flip visible without colour: hatch); eigen directions drawn when real;
  `morph` 0→1 interpolates via `lerpMat2`; keyboard can edit entries.
- **Stage3D**: orbit (drag), keys rotate, Reset view; default camera shows the
  whole `bounds`; ≥ 55fps for a 60×60 surface on the dev machine or detail
  scales down (QualityGovernor); `fallback` caption when rendering fails; no
  autorotation under reduced motion; three.js only via lazy import and only if
  the SVG/canvas renderer can't do a scene (justify in your PLAN region).

<!-- /region:G2 -->

### G3 — practice <!-- region:G3 -->

- **WorkedExample(Set)**: step 1 visible; a pause before every later step with
  the step's `tryIt`; Reveal and "I've done it, compare" both reveal; answer
  veiled until the last step; sanity check after; live params recompute every
  field with no reload and keep revealed steps; tabs with arrow keys,
  `aria-selected`, all panels in the DOM with `data-worked-example`;
  `progress.example` written.
- **Problem**: every answer kind works with mouse, keyboard and touch
  (numeric, symbolic, choice incl. multi-select and askReason, drag point/
  order/match/slider/custom, proof, code); live "We read" preview for typed
  answers; feedback in `aria-live`; the common-wrong note appears exactly when
  `Verdict.commonWrong` is set; hints unlock in order and record the highest
  level; Show solution asks once and records a reveal; Another one appears only
  with a generator and never repeats the previous seed's prompt; all progress
  calls go to `useKit().lessonId`; code answers run in `runSandboxed` with a
  timeout and show per-test results (hidden tests' args hidden).
- **ProblemSet**: dot strip reflects progress after reload; all problems in
  the DOM (non-current `hidden`); `aria-current="step"` on the current dot;
  "list" mode for practice pages.
- **Quiz**: immediate per-option feedback with the option's `why`; Try again /
  Next question; summary at the end; all questions in the DOM with
  `data-quiz-question`; `progress.quiz` + `progress.complete` when finished.
- **Predict**: Lock in disabled until a guess; guess immutable after locking;
  reveal + right/wrong line; custom guesses via `setGuess`; `progress.predict`.
- Inherited checkers: keep all existing tests green; any new message or
  verdict reason is tested.

<!-- /region:G3 -->

### G4 — controls, code & shell <!-- region:G4 -->

- **Slider**: thumb in concept ink; detents magnetic; value text tabular; keys
  (arrows/PageUp/PageDown/Home/End); `aria-valuetext`; dragging lights its
  concept; `onCommit` on release only.
- **Toggle/Segmented/Stepper**: `role=switch` / `aria-pressed` / disabled ends;
  44px targets; labels from Rich.
- **PlayScrub**: play/pause/step/scrub/Home/End; never autoplays; pauses
  off-screen; per-frame notes announced; 2 fps max under reduced motion.
- **Scrolly**: pinned visual on desktop and phone (≤ 45vh); `step` signal
  follows the step nearest the viewport centre; reads in order without JS.
- **CodeCell + runSandboxed**: Run/Reset; logs and errors with line numbers;
  infinite loop stopped at `timeoutMs` and the worker replaced (next run
  works); `fetch`/`importScripts` unavailable inside (test it); `emit` updates
  `outputs` signals; `inputs` changes re-run under `autorun` (debounced);
  concept identifiers underlined; editor usable at 390px (horizontal scroll
  inside the cell only).
- **LessonPage/Section**: rail first in `.page`; sections numbered; rail
  `aria-current` follows scrolling; `progress.visit/section` written; concepts
  mounted once; linking installed once; `?thumb` hides the masthead; skip link
  works; heading order h1 → h2 → h3.
- **Figure (+ Readout, Mission, Legend, FigKeys)**: `data-figure`, figcaption,
  `aria-describedby` to caption + sr-only description; `central` adds
  `data-thumb`; wide and phone full-bleed layouts per DESIGN.md §3/§5;
  mission ticks animate ≤ 240ms and are announced.
- **SiteHeader/ReadingProgress/ThemeToggle**: crumbs collapse on tablet,
  phone shows wordmark + toggle + hairline progress; theme toggle persists
  (`setThemePreference`) and syncs `meta[name=theme-color]`.
- **WhereNext/References**: prerequisites and dependents from curriculum.ts;
  shipped lessons link, unshipped are dashed "coming soon" (not links);
  references formatted per DESIGN.md §8, no fetching.
- **Lesson template**: `npm run new -- linalg eigenvectors` produces a lesson
  that builds, renders every required section as a clearly-marked `wip`
  skeleton, and whose test file runs the three audits.

<!-- /region:G4 -->

### G5 — data structures & systems <!-- region:G5 -->

- **ArrayView/TreeView/GraphView/TableView**: render a state; animate to the
  next state by stable ids (FLIP, 420ms; instant under reduced motion); every
  `Mark` styled per README §9 with a non-colour cue; per-element aria-labels
  and a hidden frame summary; 60 cells / 31 nodes / 40 nodes + 80 edges /
  20×20 table stay ≥ 55fps while scrubbing; phone: own-box horizontal scroll,
  44px cells; layouts from `@kit/math` (TreeView `inorder` keeps BST order
  through rotations; GraphView `layered` for DAGs).
- **ArchDiagram + arch-sim**: sim is pure and deterministic per seed;
  tests: utilisation ≈ load/capacity below saturation (±5%), queue growth past
  saturation, Little's law L ≈ λW (±10%), cache hit rate converges to
  `hitRate`, failing one of two replicas behind a round-robin LB moves its
  traffic to the other; view shows request dots (thinned at load, none under
  reduced motion), failure injection by click/Enter, metrics strip updated at
  most every 2 s for screen readers.

<!-- /region:G5 -->

## 5. Group status

Each group keeps a short status list here (component · state · notes),
between its `<!-- status:Gn -->` markers.

<!-- status:G1 -->
- G1: not started.
<!-- /status:G1 -->
<!-- status:G2 -->
- G2: not started.
<!-- /status:G2 -->
<!-- status:G3 -->
- G3: not started.
<!-- /status:G3 -->
<!-- status:G4 -->
- G4: not started.
<!-- /status:G4 -->
<!-- status:G5 -->
- G5: not started.
<!-- /status:G5 -->

## 6. Change log (append only)

One line per change to a public API, a shared contract, or a request to
another owner: `YYYY-MM-DD · group · what changed / what you need`.

- 2026-10-23 · architect · Foundations landed: types.ts, core/ (link bus, RichText, Tex, MathChain, answers, expressions, units, codecheck, problems + audits, progress, rng, context, hooks, icons, LineSwatch, live), math/, util/ (absorbed src/shared), vite-katex (registered in vite.config.ts), gallery host + dev pages, per-group CSS files imported by styles/index.css.
- 2026-10-23 · architect · Added `.is-linked` (term-level link highlight), `.rich`, `dfn.gloss` and `.line-swatch` rules in styles/core.css (now G1's).
