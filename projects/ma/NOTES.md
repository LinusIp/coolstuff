# Ma

- **Pitch:** A Japanese-minimal long-read blog theme where pull quotes turn vertical and hang in the margin like a line brushed down the edge of a scroll.
- **Feeling:** Quiet and unhurried, like opening a well-made book in a room with the window open. You should want to read slowly.
- **Core:** A 34em reading column inside a calm 12-column grid. Margins are working space: vertical pull quotes on the right, margin notes on the left, the essay's kanji stamped like a seal above them.
- **Look:** Paper-white (#f7f4ee) and warm ink-black (#161513), one accent, *shu* (朱) vermilion seal red. Shippori Mincho for display, Fraunces for text, Zen Kaku Gothic New for labels. Procedural sumi-e ink paintings.
- **Done means:** Home, article, archive with tag filtering and about pages; seven original essays in markdown; responsive generated images; no-flash dark mode; reading progress; prev/next; a "use this theme" guide; clean smoke test at 390px and desktop.

## Why it looks and works this way

*Ma* (間) is the Japanese sense of an interval with a shape: the rest that turns two notes into a phrase, the gutter that lets a book lie open. The whole theme tries to use space as material rather than leftover. The reading column is deliberately narrow (34em, about 66 characters) and the page around it is wide and mostly empty, but that emptiness is structured. Everything aligns to one 12-column grid, and the margins have jobs: on desktop, pull quotes hang in the right margin in vertical writing, footnotes become margin notes on the left, and each essay's kanji sits at the top of the right margin like a collector's seal.

The vertical pull quote is the signature because it is the one thing a Western blog theme would never do. In Japanese, `writing-mode: vertical-rl` is how text is *meant* to run, so setting a single sentence of English that way reads as a quotation brushed onto a scroll rather than a gimmick. It degrades in three steps: hung in the margin above 1120px, floated into the column (with prose wrapping round it) on tablets, and a plain horizontal quote between hairlines on phones, where there is no margin to hang it in.

The colour is restrained to make the one accent mean something. Vermilion appears only where a Japanese page would have a seal: the logo, the essay's kanji, section numerals, the reading-progress hairline, the marker on pull quotes and figure captions, and the "end of essay" stamp. Section headings are numbered in kanji numerals (一 二 三) with CSS `counter(section, cjk-decimal)`, so the markdown stays plain.

Typography was chosen for long reading. Fraunces has an optical-size axis, so with `font-optical-sizing: auto` its hairlines thicken at 19px and sharpen at headline sizes, and it has a true italic, which Shippori Mincho lacks. Shippori Mincho carries the headings and pull quotes because its Latin has the same high-contrast mincho brush logic as its kanji, so a title and its seal look cut from the same block. The page has a faint SVG paper grain behind everything, curly quotes are set automatically (the markdown is written with keyboard quotes), `text-wrap: balance` and `pretty` handle headings and widows, and `hanging-punctuation` is on where browsers support it.

Dark mode is "warm ink-black", not grey: the paper becomes #161513, the ink #ebe5d9, and the generated paintings are dimmed slightly (`brightness(0.84)`), like prints under lamplight, rather than inverted. The theme is set by a six-line inline script in `<head>` before any CSS loads (saved choice, else `prefers-color-scheme`), so there is never a flash of the wrong theme. It follows the OS setting live until the reader picks one.

The content is reusable by design: posts are markdown files with frontmatter in `content/posts/`, pulled in with `import.meta.glob` at build time, so "drop in a file" is the whole publishing workflow. Three small markdown extensions cover what a long read needs: `::: pull` blocks, image names that become responsive `<figure>`s, and `[^1]` footnotes. The about page and the "Use this theme" guide are markdown too, rendered from `content/about.md` and `USE-THIS-THEME.md`.

## The hardest problem

**Vertical text next to a picture.** On the home page, the latest essay's title runs vertically beside its painting. In CSS, a vertical-writing box's width depends on its height (more height means fewer columns), and in a grid row its height depends on the tallest item, which was the title itself. The first version let the long title stretch the row to 790px, which pushed the kanji stamp off the bottom of the thumbnail. A `height: 0; min-height: 100%` trick then created a worse loop: the grid sized the title's track from its max-content width at zero height (dozens of one-word columns), squeezing the image to 135px. The fix was to break the loop at the source: the feature gets one definite height (`--feature-h`, clamped to the viewport), shared by the image (with `object-fit: cover`) and the vertical column. With a definite inline size, the vertical title wraps into exactly as many columns as it needs. A follow-on detail: because `object-fit: cover` shows a 3:2 painting in a tall frame, the `sizes` attribute has to describe the *drawn* width (about 1.5 times the frame height), not the frame width, or the browser downloads the small image and upscales it.

**Margin notes that line up with their reference.** Pull quotes and sidenotes are `position: absolute` with no `top`, so they keep their *static position*, level with where they appear in the text, while leaving the column's flow untouched. That works for the block-level pull quote, but sidenotes appeared a full line too low. The cause is a subtle spec rule: an absolutely positioned box's static position is computed from its *original* `display` value. I had set `display: block`, so its hypothetical position was a new line after the paragraph line. Leaving it `display: inline` (absolute positioning blockifies it anyway, so `width` still works) puts the note level with its reference.

**Japanese glyphs without shipping megabytes.** Fontsource splits Shippori Mincho's Japanese into about 120 unicode-range chunks per weight; importing its CSS makes Vite copy all of them, plus `.woff` fallbacks, into the build (around 8 MB per weight). `tools/pick-kanji.py` scans the content, pages and styles for CJK characters, finds which chunk holds each, and writes `src/fonts-ja.css` declaring only those (19 small files for 28 characters, including the 一 二 三 numerals that only exist in CSS counters). Each face declares `font-weight: 300 800` so one file serves every heading weight. One casualty: subset chunks drop vertical metrics, so the 「」 corner brackets I first put around vertical pull quotes overlapped the first letter. They were removed in favour of the vermilion marker.

## Techniques worth stealing

- **Margin furniture with `position: absolute` and no `top`.** The element stays level with its place in the text, the column flows on unbroken, and on small screens you just drop the positioning. Remember the original-display rule for inline elements.
- **`writing-mode: vertical-rl` + `inline-size: max-content` + `max-inline-size: 17em`** gives a vertical quote that is one column when short and wraps into neat columns when long.
- **A definite size breaks orthogonal-flow sizing loops.** If vertical text sits next to anything, give one of them an explicit height.
- **No-flash themes:** set `data-theme` on `<html>` from an inline script in `<head>`, read storage in a `try`, and only listen for OS changes when the reader hasn't chosen.
- **Section numbers in kanji** with `counter(section, cjk-decimal)`. Zero markup.
- **Smart quotes in `walkTokens`.** Rewriting only leaf `text` tokens in marked leaves code spans and blocks untouched.
- **Procedural watercolour is just multiply blending.** Every layer in `tools/gen-images.py` is applied as `out = under × (1 − a × (1 − colour))`, so overlapping washes darken like real pigment. "Wet edges" come from subtracting a blurred mask from itself, ridges from 1D fractal noise, and dry-brush from per-bristle ink loads that run out along the stroke.
- **A seal as data.** The 間 logo is sixteen rectangles on a 100-unit grid, used for the SVG symbol, the favicon and the stamps baked into the paintings, roughened by an `feTurbulence` displacement filter.

## Content

Seven essays (666–925 words) by Mio Kurasawa, an invented bookbinder in an invented valley town: walking the long way to the post office, making hoshigaki (dried persimmons), the seventy-two micro-seasons of the old calendar, sharpening a knife every Sunday, raking a temple's gravel garden, rain in the rainy season, and *ma* itself. All writing is original. The people, the town and the journal are fictional; the about page says so. Cultural details (hoshigaki, *tsuyu* and its rain vocabulary, the 72 *kō*, whetstone technique) are real and were written to be accurate.

## Credits

- **Shippori Mincho** by FONTDASU, SIL Open Font License 1.1, via `@fontsource/shippori-mincho`.
- **Fraunces** by Undercase Type (Phaedra Charles, Flavia Zimbardi), SIL Open Font License 1.1, via `@fontsource-variable/fraunces`.
- **Zen Kaku Gothic New** by Yoshimichi Ohira, SIL Open Font License 1.1, via `@fontsource/zen-kaku-gothic-new`.
- **IBM Plex Mono** by IBM (Mike Abbink, Bold Monday), SIL Open Font License 1.1, via `@fontsource/ibm-plex-mono` (code in the guide only).
- **marked** (MIT) for markdown.
- **Images:** all eight ink paintings (mountains, ensō, persimmon, hanging persimmons, rain, gravel garden, moon, knife) are generated by `tools/gen-images.py` with Pillow and NumPy. No photographs or third-party artwork.
- Writing, design and code: original to this project.
