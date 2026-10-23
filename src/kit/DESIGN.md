# coolstuff design system: "Paper"

A premium textbook on a screen. Warm paper, iron-gall ink, a serif made for
long reading, Tufte margin notes, and figures set as quiet plates. **Chrome is
ink; hue is meaning.** When colour appears, it always says something: this is
the input, this is what comes out, this is right.

This file is the spec. The code that enforces it:

| File | What it holds |
|---|---|
| [`theme.ts`](./theme.ts) | Every colour as typed data, `defineConcepts()`, line styles, theme preference (`coolstuff:theme`), the pre-paint boot script, contrast maths, motion/grid tokens |
| [`theme.test.ts`](./theme.test.ts) | WCAG AA for every text, ink, wash, highlighter, print and subject pairing in **both** themes; `tokens.css` ≡ `theme.ts`; `defineConcepts` rules |
| [`styles/`](./styles/) | `index.css` imports, in order: `fonts.css` → KaTeX CSS → `tokens.css` → `base.css` → `layout.css` → `components.css` |
| [`notation.ts`](./notation.ts) · [`NOTATION.md`](./NOTATION.md) | KaTeX macros, shared KaTeX options, relation chains (`mathChainHtml`), `formatNumber` |
| `kit/_dev/design.html` | The living style sheet (dev-only): every token, ratio, figure state and card, built from these files |

Every page does three things: inline `THEME_BOOT_SCRIPT` in `<head>` (no theme
flash), `import '@kit/styles/index.css'`, and, for a lesson,
`defineConcepts({...}).mount()`.

---

## 1. Principles

1. **Ink for structure, hue for meaning.** Rules, labels, buttons, toggles,
   progress, tabs, stars and the focus ring are ink tones. A hue appears only
   on a *concept* (input, output, error, probability, a lesson concept) or a
   *verdict* (correct, wrong).
2. **The book is the interface.** Kickers, card labels and figure numbers are
   set like running heads, in serif small caps. Controls are a quiet sans, so
   a reader can tell what to read from what to press.
3. **One focal point per figure.** The thing that changes is 2.5px and fully
   inked; everything else steps back by weight, opacity or both.
4. **The margin is for asides.** On wide screens, sidenotes and captions sit in
   the margin so the text column stays one unbroken argument; on phones they
   fold inline.
5. **Colour never travels alone.** Every concept has a line style as well as an
   ink; every verdict has an icon and a word (✓ Right · × Not quite · ⚠ Why
   6 is wrong).
6. **Invite, then get out of the way.** The first interaction is announced
   (a breathing ring, a hand-lettered "drag the ring", a two-goal *Try it*),
   and the announcement disappears after the first touch.

## 2. Typography

### Families (self-hosted, OFL, Latin + Latin Extended + Greek subsets only)

| Role | Family | Fontsource package and files used |
|---|---|---|
| Prose, headings, labels, notes | **Source Serif 4 Variable** (opsz 8–60, wght 200–900, roman + italic) | `@fontsource-variable/source-serif-4` → `files/*-{latin,latin-ext,greek}-opsz-normal.woff2`, `*-{latin,latin-ext}-opsz-italic.woff2` |
| UI: buttons, meta, ticks, legends | **Inter Variable** (wght, roman) | `@fontsource-variable/inter` → `files/inter-{latin,latin-ext,greek}-wght-normal.woff2` |
| Live values, readouts, code, answer fields | **JetBrains Mono** 400, 500 | `@fontsource/jetbrains-mono` → `files/jetbrains-mono-{latin,greek}-{400,500}-normal.woff2` |
| Maths | **KaTeX** fonts | `katex/dist/katex.min.css` (bundled by Vite) |

`fonts.css` declares the `@font-face` rules itself (pointing at those files), so
no Cyrillic or Vietnamese files ship, and `unicode-range` means a browser
fetches a subset only when the page uses it.

**Removed** (were candidates during design): `@fontsource-variable/literata`,
`@fontsource-variable/inter-tight`.

### Scale

Ratio ≈ 1.25 around the reading size. Tokens live in `tokens.css`; phone values
apply below 700px.

| Token | Desktop | Phone | Family / setting | Use |
|---|---|---|---|---|
| `--fs-h1` | 56px / 1.02, 620, −0.022em | 40px | serif, display cut (opsz auto) | lesson title |
| `--fs-h1-sub` | 30px italic | 23px | serif | "the directions a matrix doesn't turn" |
| `--fs-h2` | 32px / 1.15, 600, −0.014em | 26px | serif | section titles |
| `--fs-h3` | 22px / 1.25, 600 | 20px | serif | sub-heads |
| `--fs-lead` | 21px / 1.5 | 18.5px | serif | problem and question statements |
| `--fs-body` | **19px / 1.6** | **17px / 1.58** | serif, old-style proportional figures | reading text |
| `--fs-label` | 18.5px small caps, 600, +0.06em | 17.5px | serif `all-small-caps` (glyphs ≈ 9.5px tall), lining tabular figures | kickers, card labels, "Figure 1", "Try it" |
| `--fs-small` | 16.5px | 16px | serif | card prose, hints, traps |
| `--fs-note` | 15.5px / 1.5 | 15px | serif (italic for justifications) | sidenotes, captions, derivation "why" |
| `--fs-ui` | 15px, 560 | 15px | Inter | buttons, inputs, readout status |
| `--fs-meta` | 13.5px | 13.5px | Inter | meta, counters, legends — **the smallest reading text** |
| `--fs-code` | 15px / 1.55 | 14px | JetBrains Mono, tabular | code, readouts, live values |
| figure text | labels 18px serif; notes 13px Inter; ticks 12px Inter | same | SVG | figures |

- **Measure.** Text column `--text: 608px` = 72 characters of 19px Source
  Serif 4 (measured in the browser). On a 390px phone the column is 350px
  (20px gutters) ≈ 45 characters at 17px.
- **Weights.** Body 400; dark mode drops prose to **380** (`--prose-wght`)
  because light-on-dark serif blooms. Bold is 650.
- **Numerals.** Prose uses old-style proportional figures; anything compared
  or changing (labels, meta, tables, readouts) uses lining tabular figures.
- **Never** set running text in sans or mono, never use ALL CAPS sans
  eyebrows (the small-caps serif label is the only label voice), and never go
  below 13.5px for anything a reader must read (figure ticks at 12px are
  graphics, labelled again in the readout).
- `text-wrap: pretty` on paragraphs, `balance` on headings; hyphenation on
  for prose, off for notes.

### Maths

- KaTeX at **1.1em** inline (`--math-inline`): KaTeX Main has a smaller
  x-height than Source Serif 4. Display maths 1.21em (`--math-display`) with
  24px above and below; key formulas 1.9em (`--math-key`), the definition
  formula 2.15em (`--math-hero`; 1.75 / 1.95em on phones).
- **Inline maths never breaks** mid-expression (`white-space: nowrap`): it
  moves to the next line whole. Keep inline maths short.
- **Display maths scrolls inside its own box** (`.math-display`, `.scroll-x`),
  never the page. Every scroll box is `position: relative` so absolutely
  positioned children (screen-reader text, MathML) can't widen the page.
- **Multi-line steps are relation chains** (`mathChainHtml`, `.mchain`). A step
  is split at its top-level relations; on a phone each *relation + right-hand
  side* wraps as a unit and lines up under the first relation, so a line never
  ends in "=" or "⟹" and no "= 0" sits alone (a tiny right-hand side stays
  with the segment before it). `\implies` starts a new clause; list items
  (`\lambda_1 = 5,\ \lambda_2 = 2`) wrap together. If the left side is too wide,
  the chain hangs 1.5em under it. Worked-example steps and solutions always
  use chains; authors never hand-break for phones. See NOTATION.md §8.
- Greek letters in prose always go through KaTeX. Small caps turn λ into Λ, so
  never put maths in a label.

## 3. Space and layout

### Spacing (4px base)

`--sp-1…9` = 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96px. Sections are 96px
apart (64px on phones) and open with a hairline rule, a kicker (italic
old-style number + small-caps name) and the h2. Cards are 24/32px padded
(16px on phones, reaching 6px closer to the screen edge).

### The grid

| Width | Columns | Margin notes | Figures |
|---|---|---|---|
| **≥ 1240px** | rail 164 · gap 56 · **text 608** · gutter 56 · **margin 248** | float into the margin beside the line that calls them; captions of text-width figures float there too and stack with notes (`float: right; clear: right`) | text-width by default; `.is-wide` spans text + margin = **912px**, with mission/keys under it in the text column and legend/caption beside them in the margin (no dead space) |
| 1000–1239px | text 608 · gutter 56 · margin 248 (rail hidden) | as above | as above |
| 700–999px | text column only, max 608 | fold inline: a numbered chip opens the note as a sunk panel under the line | everything text-width; caption under the plate |
| **< 700px (phone)** | one column, 20px gutters | fold inline (tap to open) | plates go **full-bleed** with a near-square stage for a bigger touch area; readout, mission and legend stack under it |

- The contents rail (≥ 1240px) is sticky, ink-only: current section in ink
  with a 2px ink rule, done sections in ink-2.
- Masthead: wordmark · breadcrumb · section progress (ink segments) · theme
  toggle. On phones it shrinks to wordmark + theme toggle and the progress
  becomes a full-width segmented hairline on its bottom edge; on tablets the
  breadcrumb keeps its first and last item.
- Phone section kickers get a 14px ink rule before them and full ink, so a
  skimming thumb finds "Practice" and "Quick check" fast.

### Shape and rules

Radius 2px (cards, controls), 3px (plates). Hairlines 1px; emphasis rules are
ink: 1.5px (solution, boxed answer), 2px (current step, hints, notes), 3px
(TL;DR top, trap edge, key idea). No drop shadows on cards: paper is flat.

## 4. Colour

### Surfaces and ink

All ratios computed by `theme.ts`; `theme.test.ts` fails below the bar.

| Token | Role | Light | Dark | Contrast (light / dark) |
|---|---|---|---|---|
| `--paper` | page | `#f8f5ee` | `#191714` | — |
| `--raised` | cards, revision card | `#fdfbf6` | `#211e1a` | — |
| `--sunk` | hints, folded notes, wells | `#f1ece1` | `#141210` | — |
| `--plate` | figure stage | `#fdfbf6` | `#1d1a17` | — |
| `--ink` | body text, headings, primary buttons, **focus ring** | `#1e1b16` | `#ece6d9` | 14.57 / 13.35 (worst of paper, raised, sunk) |
| `--ink-2` | secondary text, kickers, notes | `#4a443a` | `#c5bcac` | 8.18 / 8.82 |
| `--ink-3` | captions, meta, ticks | `#6b6356` | `#a0978a` | 5.03 / 5.76 |
| `--ink-4` | decoration and disabled only (never text a reader needs) | `#a39a8b` | `#6a6255` | — |
| `--rule` · `--rule-strong` | hairlines · dividers (decorative) | `#ddd5c6` · `#bdb29e` | `#36312a` · `#524a3f` | — |
| `--grid` | figure grid (decorative) | `#e9e2d4` | `#2a2621` | — |
| `--axis` | figure axes | `#8d8473` | `#757062` | 3.14 / 3.36 (graphic ≥ 3) |
| `--ui-line` | text-field and checkbox borders | `#8a8070` | `#7c7364` | 3.30 / 3.55 (UI boundary ≥ 3) |
| `--on-ink` | text on ink or on a filled key | `#fdfbf6` | `#191714` | 16.60 / 14.38 on ink |
| `--marker` | highlighter pen, laid at 30% / 22% (`--marker-wash`) | `#f2c94c` | `#dba52c` | ink over it 14.59 / 8.63 |

Dark mode is a **lamp-lit desk**, re-tuned rather than inverted: warm charcoal,
bone ink, lifted inks at matching ratios, cards *lighter* than the page, and a
faint glow (`--focal-glow`) on a figure's focal pair only.

### The eight inks

Five carry **global meanings, identical in every lesson**. Three are **free**
for a lesson's own concepts. Each has a default **line style**.

| Ink | Means | Light | Dark | Print | Worst text contrast on a surface (L / D) | On its own wash | Under the marker | Line |
|---|---|---|---|---|---|---|---|---|
| blue | **input / independent** | `#1f62b0` | `#7caff1` | `#174c8c` | 5.19 / 7.32 | 4.73 / 5.92 | 5.01 / 4.73 | solid |
| orange | **output / dependent** | `#974f09` | `#ea9a53` | `#8c3e06` | 5.18 / 7.31 | 4.73 / 5.88 | 5.00 / 4.73 | dashed |
| red | **error / gradient / force**; wrong | `#b92a2d` | `#fe8b85` | `#9a2219` | 5.19 / 7.31 | 4.67 / 5.90 | 5.01 / 4.73 | dash-dot |
| green | **correct / solution** (a state) | `#19712e` | `#79bc80` | `#1f5f2b` | 5.18 / 7.36 | 4.72 / 5.92 | 4.99 / 4.76 | solid + ✓ |
| purple | **probability / uncertainty** | `#754aba` | `#ba9ff3` | `#573896` | 5.17 / 7.38 | 4.72 / 5.97 | 4.99 / 4.78 | dotted |
| teal | free (e.g. operator, matrix, function-as-machine) | `#0f6d69` | `#50bdb4` | `#0a5a56` | 5.22 / 7.33 | 4.78 / 5.94 | 5.04 / 4.74 | dotted |
| rose | free (e.g. scalar, eigenvalue, rate constant) | `#a63481` | `#ec8dce` | `#88255f` | 5.20 / 7.32 | 4.72 / 5.93 | 5.01 / 4.74 | double |
| gold | free (third choice) | `#705e0c` | `#d3ba4e` | `#614b00` | 5.41 / 8.62 | 4.96 / 6.74 | 5.22 / 5.57 | long dash |

- **Every ink passes 4.5:1 as text** on paper, raised, sunk and plate, on its
  own 12% wash, and fully under the highlighter, in both themes; text on a
  filled ink (`--on-ink`) passes too. So one token can colour a stroke, a
  symbol and a word.
- Light inks sit at OKLab L ≈ 0.50 (equal visual weight, deep and ink-like);
  dark inks at L ≈ 0.75. Every pair is ≥ 0.07 apart in OKLab in both themes
  (tested). Tightest pairs: orange–gold, green–teal, blue–purple.
- **Pairing rules.** Don't put gold and orange in one figure. Rose and red may
  share a figure only with their (different) line styles visible. Teal next
  to green is fine because green only appears as a ✓ state.

### Concepts: how a lesson names its colours

```ts
const C = defineConcepts({
  input:      { hue: 'input',  label: 'input vector', symbol: '\\vec v' },
  output:     { hue: 'output', label: 'its image',    symbol: 'A\\vec v' },
  matrix:     { hue: 'teal',   label: 'the matrix',   symbol: 'A' },
  eigenvalue: { hue: 'rose',   label: 'scale factor', symbol: '\\lambda' },
});
C.mount();                          // injects .ct-matrix etc. once per page
<span class={C.className('matrix')}>A</span>      // HTML or SVG
<path {...C.stroke('output', 2.5)} />             // colour + dash pattern
\colorTerm{matrix}{A}   or   \cMatrix              // KaTeX (pass C.macros())
C.hex('matrix')                                    // canvas/WebGL; re-read on onThemeChange
```

Rules (enforced by `defineConcepts`, which throws):

- **3–5 concepts per lesson** (at most 5).
- A concept wears a **meaning** (`input`, `output`, `error`, `prob`) or a
  **free ink** (`teal`, `rose`, `gold`). You cannot ask for "blue": blue is
  only ever "input".
- **No concept may be green.** Green is the colour of "correct", a state the
  learner earns: a ✓ verdict, a boxed answer, a sanity check, a mission tick,
  and *a figure element the learner has just found* (the handle and the line
  it snapped to turn green, and turn back when it leaves).
- One ink per concept; one line style per concept (defaults per ink; a clash
  takes the next free style automatically).
- The same concept wears the same ink and line style in the figure, the
  formula, the prose, the readout, the legend and the code.

### Line styles: colour never travels alone

| Style | Figure stroke (scales with width *w*) | Underline / swatch | Default ink |
|---|---|---|---|
| solid | — | 1.5px rule | blue (input) |
| dashed | 3.2w on, 2w off, butt caps | 5/3px dashes | orange (output) |
| dotted | round dots every 2.4w | 2px dots every 4px | purple, teal |
| double | two parallel lines (casing: ink at ~3.6px, plate at ~1.3px on top) | two 1px rules 3px apart | rose |
| dash-dot | 2.6w dash, dot, round caps | dash-dot | red (error) |
| long dash | 6w on, 2.4w off | 10/4px dashes | gold |

- Line style appears on the concept's **lines and arrows** in figures, as the
  **swatch** in every legend, as the **stub** under a symbol in the phone
  explain-this key and the exploded live-values view, and as the **underline**
  of a linked prose term (`.term`). It is *not* drawn under every formula term
  all the time: that would be noise across a 25-minute lesson.
- A dashed output arrow over a solid input arrow stays readable when the two
  coincide (an eigenvector), which is the point.
- Areas are hatched in the concept's ink; context layers (a transformed grid)
  may stay as faint solid hairlines when the legend names them.

### Washes, the highlighter, verdict panels

- `--w-<ink>` = 12% of the ink over its surface: concept chips, linked-hover
  highlight, the wrong-answer panel (red), the correct badge (green).
- `--marker-wash` is a **highlighter pen**, not a concept: it marks what changed
  in a derivation step, laid over the lower half of the glyphs. It is tuned
  so every concept ink and the body ink stay ≥ 4.5:1 fully over it (tested).

### Chrome is monochrome

Buttons, switches, segmented controls, tabs, steppers, progress segments,
difficulty stars and the focus ring are ink. The only hues on a page are
concepts and verdicts. The focus ring is a **2px ink outline, 2px offset**
everywhere, so it is never lost against a blue term or a blue arrow.

### Subject identity (site pages only)

`subjectInk(hue, theme)` turns `curriculum.ts`'s per-subject hue into a
low-chroma ink at fixed lightness (OKLCH L 0.50 / 0.78) that passes AA as text
in both themes (tested for every subject). It marks subjects on the home grid,
subject pages and the prerequisite graph. **It never appears inside a lesson**,
where hue is reserved for concepts.

### Themes

- `data-theme="light" | "dark"` on `<html>` pins a theme; no attribute follows
  the OS (`prefers-color-scheme`). `tokens.css` has the pinned-dark block and an
  identical OS-dark block (tested identical).
- The choice is stored in `localStorage['coolstuff:theme']` and applied before
  first paint by `THEME_BOOT_SCRIPT` (inline it in every page's `<head>`).
  `toggleTheme()`, `setThemePreference('system')`, `onThemeChange(cb)` (also
  fires on OS changes and other tabs), and `<meta name="theme-color">` is kept
  in sync.

## 5. Figures: the plate grammar

- **Plate.** A `--plate` panel, 1px `--rule` border, 3px radius. 1px `--grid`,
  1.25px `--axis`, 12px Inter ticks in `--ink-3` with U+2212 minus signs.
- **Stroke weights** (`--sw-*`): grid 1 · axis 1.25 · guide 1.5 (dotted, ink-3)
  · supporting marks 2 at 62% (`.fig-quiet`) · **focal 2.5**. Context layers in
  a concept's ink at 22% (`.fig-context`), 50% while that concept is hovered.
- **One focal pair.** The draggable input and its result are the only 2.5px,
  fully inked marks, with filled arrowheads that scale with stroke width.
- **The answer is earned.** What the learner is hunting for is drawn in its
  concept's ink and line style (the kept directions: rose, double rule, a 16px
  band at 8%, named along the line: "stretched ×3"). When the learner lands
  on it, a dynamic overlay redraws that line in green, the handle turns green,
  and the readout and mission say so.
- **Labels** are set in Source Serif (bold for vectors, italic for scalars and
  matrices, so `A**v**` in the figure matches KaTeX), haloed with the plate
  colour (`paint-order: stroke`), placed on the side away from their partner,
  and clamped inside the plate. Names along lines are 12.5px Inter 620.
- **Readout strip.** Live numbers live *outside* the drawing, in a mono strip
  joined under the plate: `v = (1.40, 0.20) ↦ Av = (3.00, 1.80) · turned 22.8°`,
  `aria-live="polite"`, status turning green with ✓ and words on success.
- **Try it.** Under the central interactive, a two-goal mission checklist
  (`.mission`): boxes tick green on success, and one status sentence names the
  result in words ("Same line: Av = 3.00 v. A only stretched it.").
- **Keyboard line** under every interactive figure (`.fig-keys`): "Tab to the
  ring, then ← ↑ → ↓ to move it; hold Shift for bigger steps."
- **Legend** (`.legend`): line-style swatch + symbol + words for every mark.
- **Caption**: small-caps "Figure n" plus one or two sentences, in the margin
  beside text-width plates, under wide ones; every figure also has an SVG
  `<title>` and a prose description (`aria-describedby`).
- **Phones**: full-bleed, stage aspect ≈ 1 : 0.94 (`.plate__stage--wide`).
- **3D** only when the concept is genuinely 3D (surfaces, fields, rotations),
  with orbit controls, the same inks, and a 2D fallback caption.

### Performance rule (Stage2D must do this)

A figure is **two stacked layers**: a static plane (grid, axes, context
layers, fixed lines, ticks) rasterised once per resize on its own compositor
layer (`.plate__layer--static`: `contain: strict; will-change: transform`), and a
light dynamic layer (focal pair, guides, handle, found overlays) that repaints
during a drag. Never touch the static layer during interaction. Clip long
dashed lines to the view before drawing (dash caps are expensive). Budget: a
drag frame ≤ 16ms on a mid phone; scale detail down to hold ≥ 55fps
(`QualityGovernor`).

## 6. Draggable handles

- A 5.5px solid dot in the concept ink with a 2px plate halo, inside a 14px ring
  on a 13% wash of the ink (stroke at 60%), over a **44px transparent hit
  area**. Hover and drag grow the ring to 17px at full stroke;
  `cursor: grab / grabbing`; `touch-action: none` on the handle only, so the
  page still scrolls around the figure.
- **First touch is announced:** the ring breathes three times (1.8s cycles,
  skipped under reduced motion) and a hand-lettered italic serif note, "drag
  the ring", with a pen-stroke arrow sits beside it. Both disappear for good on
  the first drag or key press.
- Magnetic snap within 3° of a target direction; on a target the handle turns
  green (`.is-correct`).
- Keyboard: focusable (`role="slider"`, live `aria-label` and
  `aria-valuetext`), arrows move by 0.1 (Shift 0.5), 2px ink focus ring
  (`.fig-handle__focus`).

## 7. Formulas that come alive

- **Formula block** (`.formula`): a hairline above and below, a bar with a
  small-caps label on the left and switches on the right ("Live values",
  "Explain this").
- **Explain this, wide** (≥ 560px block): notes sit under their symbols, each a
  **bold concept word in the concept's ink + a plain gloss** in serif, joined
  by **curved leaders** in that ink from a dot under the glyph. Notes are
  packed in a row so they never overlap and leaders never cross; group
  **brackets** above the formula name groups ("where *A* sends **v**", in
  output orange). Leaders draw in over 600ms the first time.
- **Explain this, phone**: the notes become a **dotted-rule key** (symbol ·
  bold word · gloss), and a short stub in each term's line style sits under
  the symbol in the formula, tying the key back to it.
- **In words** (`.in-words`): one italic sentence under every key formula with
  its terms in their inks ("Applying *the matrix* to *the vector* gives back
  the same vector, only stretched by *the number λ*").
- **Live values**: a current number hangs under its symbol on a 6px tick, mono
  **≥ 15px**, in the symbol's ink (`.lv`). The *Live values* switch shows the
  **exploded view** (`.lv-grid`): one column per symbol, each with its
  line-style stub and its value as a mono column vector or matrix (`.lv-vec`);
  it fits 390px.
- **Derivation** (`.derivation`, `.dstep`): three columns — relation (short
  arrows `\Leftrightarrow`, `\Rightarrow`, `=`) in a gutter · maths · italic
  one-line justification (below the maths on phones). What changed is swept
  with the highlighter (`\chg`, 420ms left to right after 120ms); the current
  step gets a 2px ink rule on its left edge; rows and rules stay inside the
  text column. A stepper (‹ Step 2 of 3 ›) walks it.
- **Sliders that drive maths** use the concept's ink for the thumb (styled
  like a handle) and **detent ticks** at meaningful values (the eigenvalues),
  labelled below the track; the result turns green at a root with a ✓ badge.

## 8. Cards

All cards: `--raised`, 1px `--rule`, 2px radius, a head row (small-caps label ·
meta on the right) over a hairline. Phones: 16px padding.

| Card | Signature |
|---|---|
| **TL;DR / revision card** (`.tldr`) | 3px ink top rule like an index card; three points with italic old-style numerals; the key formula with a symbol key in a column beside them (stacked below 1000px); **Print card** prints only this card (§12) |
| **Worked example** (`.example`) | **difficulty tabs** `★ Direct · ★★ Combined · ★★★ Exam level` (ink underline, 44px; a 3-up grid with stars over labels on phones) → lead-size statement → *What we know / What we want* (two small-caps columns, stacked on phones) → **Strategy.** run-in italic → numbered steps (circled numerals, a sans step title, a relation chain, an italic justification) → **pause** (dashed box: "Try the next step yourself", primary *Reveal step 3* + quiet *I've done it, compare*; full-width buttons on phones) → **boxed answer** (dashed and hatched while hidden; a 1.5px green border with a 3px green inner rule once revealed) → ✓ **Sanity check** |
| **Practice problem** (`.problem`) | a **set progress row** of 1–8 dots (solved = green fill with ✓, solved with hints = green hatch, attempted = dashed ink, current = ink ring, to do = rule) → label · ★★☆ difficulty with a word · "4 of 8" → statement → answer row (symbol = field, **Check**) + stated precision → feedback (× red / ✓ green, with words) → **hint ladder** labelled by purpose: **① Nudge · ② Strategy · ③ First step** (each unlocks the next; open = ink; stacked number-over-label on phones), hints on sunk paper with a 2px ink rule → **"Why 6 is the common wrong answer"** on a red wash with ⚠ → foot: **Show solution** (button) · **Another one** (quiet button) · "2 attempts · 1 hint" |
| **Common trap** (`.trap`) | 3px red left edge; ⚠ + the myth in red serif quotes; explanation and a small counterexample plate side by side (stacked on phones); "What's true." under a hairline |
| **Quick check** (`.quiz`) | a dot strip (right = green, wrong = red hatch, current = ink ring) + "Question 2 of 5"; 54px option rows with circled letter keys; a wrong pick turns red (filled key, ×, inset rule) with its explanation right under it ("Not quite." + why); a right pick the same in green; foot **Try again** · **Next question** |
| **Callouts** (`.callout`) | *Note*: sunk + 2px ink rule. *Key idea* (`--key`): 3px ink rule, body size, no fill. *Simplification* (`--simplify`): dashed box ("We're ignoring air resistance here") |
| **Where next** (`.lesson-cards`) | two lists (← Builds on / Unlocks →) of cards: "Subject · lesson number" kicker, serif title, sans one-liner, arrow; **unshipped lessons are dashed with "coming soon"** and not links |
| **References** (`.refs`) | numbered; small-caps author, italic title, edition, publisher, year, section |
| **Code cell** (`.codecell`) | bar (small-caps label, **Run**), sunk code area in JetBrains Mono, output strip below; syntax colour is ink weight and italics, never hue (hue is for concepts) |

## 9. Controls

- **Buttons** (`.btn`, Inter 15px/560, ≥ 44px): default (rule border), primary
  (ink fill, `--on-ink` text), quiet (no border), disabled (ink-4). `.btn--sm`
  is 36px to look at with a 44px hit area (44px tall under `pointer: coarse`).
  Press = 1px drop; hover = 6% ink wash.
- **Switch** (`role="switch"`): ink track and thumb.
- **Segmented** (`.seg`): hairline group, open/pressed = ink fill; used for the
  hint ladder and view choices.
- **Field** (`.field`): mono 17px, 1.5px `--ui-line` border (≥ 3:1), wrong =
  red border + 2px inner underline, right = green.
- **Slider** (`.slider`): thumb in the concept ink (`--c`), 44px tall input,
  detent ticks (`.slider__ticks`).
- **Chips** (`.chip`, `.chip.ct` = concept ink on its wash with swatch),
  **badges** (`.badge--correct`, `.badge--wrong`, always icon + word),
  **stars** (ink, with a word: "standard"), `kbd`.

## 10. Motion

| Token | Duration | Use |
|---|---|---|
| `--dur-1` | 140ms | state feedback (hover, press): colour and border only — not motion |
| `--dur-2` | 240ms | reveals: hint, explanation, solution (fade + 4px rise) |
| `--dur-3` | 420ms | a derivation step entering; figure tweens |
| `--dur-4` | 600ms | emphasis: highlighter sweep, leaders drawing in, snap flash |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | "ink settling": arrivals |
| `--ease-inout` | `cubic-bezier(.45,0,.2,1)` | A → B moves, the breathing ring |
| `--ease-snap` | `cubic-bezier(.3,1.35,.5,1)` | small settles only (handle snap, mission tick), ≤ 240ms |

Motion only shows change, causality or sequence. Nothing loops (the ring
breathes three times, once). Under `prefers-reduced-motion: reduce` every
duration collapses to 1ms, the breathing and leader draw-in are skipped,
smooth scrolling is off, and every state still changes.

## 11. Accessibility

- **Focus**: one 2px ink outline, 2px offset, on everything focusable; inside
  segmented controls the offset is −3px so it stays visible.
- **Targets**: ≥ 44×44px for every control, hint segment, tab, quiz row (54px),
  set-progress dot and figure handle; sidenote markers and small buttons grow
  an invisible hit area (`::after`) without moving the text.
- **Structure**: real headings (h1 → h2 per section → h3), `figure` +
  `figcaption`, a skip link, `role="switch"`, `aria-expanded` on hints and
  solutions, `aria-selected` on tabs, `aria-current` on the current step and
  dot, `aria-live` on readouts and feedback.
- **Maths**: KaTeX emits MathML; relation chains hide their visual pieces and
  expose one MathML copy.
- **Contrast exemptions** (decorative, never carrying information alone):
  `--rule`, `--rule-strong`, `--grid`, `--ink-4`, washes as fills, context
  layers at 22%, figure ticks repeated in the readout.

## 12. Print: the revision sheet

`body.print-card` + `window.print()` prints only the lesson head and the TL;DR
card: ink on white, the **print ink set** (darker inks, all ≥ 7:1 on white),
11.5pt serif, a 17cm card with a 2.5pt top rule, points in a wide left column
and the formula + key in a 5.4cm right column, `text-wrap: pretty` and
`orphans/widows: 3` so no bullet ends on a one-word line. Buttons, masthead,
rail and sidenotes never print.

## 13. Class and API map (for kit components)

| Component | Uses |
|---|---|
| `Stage2D` / `Plot` | `.plate`, `.plate__stage(--wide)`, `.plate__layer(--static)`, `.fig-grid/axis/tick/guide/note/label/line/head/band/quiet/context/focal/line-label`, `.fig-handle*`, `.fig-annot`, `.readout*`, `.mission*`, `.fig-keys`, `.legend`, `.caption`; colours via `C.stroke()` / `.ct-<concept>` |
| `Formula` | `.formula*`, `.bracket`, `.note__word`, `.leader(-dot)`, `.is-stacked`, `.term-stub`, `.lv`, `.lv-grid/col/vec/op`, `.in-words`; `texToHtml(tex, display, { macros: C.macros() })` |
| `Derivation` | `.derivation*`, `.dstep*`, `.is-current`, `.is-entering`, `\chg` |
| `WorkedExample` | `.example`, `.ex-tabs/.ex-tab`, `.knowwant`, `.strategy`, `.steps/.step(--pause)`, `.step__title/__math/__why`, `.pause*`, `.answer(--hidden)`, `.answer__veil`, `.sanity*`; steps via `mathChainHtml()` |
| `Problem` / `ProblemSet` | `.problem`, `.pset/.pset__dot` (+ `is-solved/is-hinted/is-attempted`, `aria-current="step"`), `.problem__meta`, `.answer-row*`, `.field(.is-wrong/.is-correct)`, `.feedback--*`, `.hints .seg`, `.hint*`, `.wrong-note*`, `.solution`, `.card__foot` |
| `Quiz` | `.quiz__top/__dots/__count`, `.quiz__set/__q`, `.choice(.is-wrong/.is-correct)`, `.choice__key/__mark/__why/__verdict` |
| `TLDR` | `.tldr*`, `.key`, `body.print-card` |
| Controls | `.btn(--primary/--quiet/--sm/--block)`, `.icon-btn`, `.switch`, `.seg/.seg__btn/.seg__n`, `.slider*`, `.stepper`, `.chip`, `.pill`, `.badge(--correct/--wrong)`, `.difficulty/.stars` |
| Lesson shell | `.masthead*`, `.wordmark`, `.crumbs`, `.progress*`, `.theme-toggle`, `.page`, `.rail`, `.lesson`, `.lesson-head`, `.lesson-title*`, `.lesson-meta`, `.section(--first)`, `.section__head`, `.kicker(__num)`, `.label`, `.sn-ref/.sidenote`, `.is-wide`, `.callout(--key/--simplify)`, `.lesson-cards/.lesson-card(.is-soon)`, `.refs`, `.colophon` |
| Hover-linking | set `data-hl="<concept>"` on `<html>` while a `.ct-<concept>` is hovered or focused; CSS lights every match (wash in text, +1px stroke in SVG via `--lit`) |
| Numbers | `formatNumber(x, decimals)` / `formatVector(v)` from `notation.ts` (U+2212, fixed decimals, no −0.00) |

## 14. Decisions and open questions

Decided while turning the winning proposal into the system, addressing every
judge note:

- **Green is a state, never a concept** (system judge). The eigen-directions
  moved from green to the eigenvalue's rose with a double rule; the green
  payoff the learner judges liked stays as the *found* state (line, handle,
  readout, mission all turn green together, so there is one success colour).
- **Three free inks** (teal, rose, gold) instead of two, and every concept
  gets a **line style** (Studio graft), enforced by `defineConcepts`.
- **Relation chains** replace hand-broken wrap mode: steps align at the
  relation on phones, never end in "=", never strand "= 0" or a list item.
- **Hint ladder labelled Nudge / Strategy / First step**; problem set progress
  dots and an attempts · hints line; example difficulty tabs; quiz dot strip
  with Try again + Next question; where-next cards with subject · number and a
  dashed coming-soon state (Explorable and Studio grafts).
- **Invitation to play**: breathing ring + hand-lettered "drag the ring" +
  *Try it* mission + keyboard line; the hook figure breaks out to 912px at
  ≥ 1000px with mission/keys and legend/caption tucked beside each other.
- **Curved, colour-matched explain-this leaders** with bold concept word +
  gloss (Explorable), the phone dotted-rule key with line-style stubs (Paper),
  an exploded live-values view at ≥ 15px (Studio, with the size fix), an *In
  words* sentence (Studio).
- **Chrome strictly monochrome**, including the focus ring, progress and stars;
  a print ink set; a pre-paint theme script; dark-mode prose weight 380; a
  faint focal glow in dark mode only.
- Kickers get an ink rule and full ink on phones; small buttons get 44px hit
  areas; "Show solution" and "Another one" are real buttons; derivation rules
  stay inside the column; the print card has no single-word widows.
- `subjectInk()` gives site pages subject colours without leaking hue into
  lessons.

Open:

- **Firefox/Safari**: verified in Chromium only (Playwright's Firefox isn't
  installed here). The CSS uses `color-mix()`, `:has()`, `text-wrap`,
  `contain`; all are supported in current Firefox and Safari, but a pass is due.
- **Build-time KaTeX prerender**: done. `src/kit/vite-katex.ts` (registered in
  vite.config.ts) uses the shared `texOptions()`, so `<span class="tex">` /
  `<div class="tex-block">` in HTML render identically to runtime KaTeX.
- A lesson that truly needs **six** concepts must split or merge concepts;
  `defineConcepts` refuses a sixth by design.
