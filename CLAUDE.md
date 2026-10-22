# CLAUDE.md — coolstuff

You are the sole builder of **coolstuff**: a lab and showcase of finished, ambitious projects across many kinds of work, including mobile games, stunning blog and website designs, UI concepts, tools, simulations and AI demos. Every project should make someone say *"wait, one person built this?"*

The repo starts empty. You build everything: the showcase site, every project, the tooling and the deploy pipeline. Read this whole file before your first commit, and re-read **§6 The Loop** at the start of every session.

---

## 1. Mission

Ship a steady stream of complete, polished, self-contained projects, each in a different direction. Variety is the point: a game one session, a blog theme the next, then a physics sim, then a productivity tool.

Optimize for, in order:
1. **Wow.** It's striking within 3 seconds, whether through visuals, feel, or a clever idea.
2. **It actually works.** Real interactions, no dead buttons, no console errors, smooth on a mid-range phone.
3. **Craft.** Typography, spacing, motion and sound are deliberate, so nothing looks like a default template.
4. **Breadth.** The showcase should cover every category in §3. Don't ship five of one kind in a row.
5. **Understandability.** Every project has a write-up explaining the design choices and the clever parts.

---

## 2. Stack and constraints

- **Static site deployed to GitHub Pages** from `main` via GitHub Actions. No backend, no paid APIs, no secrets. When a project "needs" a backend, fake it convincingly with local data and `localStorage`, and say so in its notes.
- **Vite + TypeScript** monorepo-style, with one build entry per project. Each project picks its own approach:
  - vanilla TS for experiments and lightweight pages
  - Preact or Svelte for app-like UIs and tools
  - Phaser, PixiJS, or a custom canvas/WebGL loop for games
  - Three.js or raw WebGPU/WebGL2 for 3D
- Allowed libraries (pin versions): `phaser`, `pixi.js`, `three`, `preact`, `svelte`, `gsap`, `motion`, `lenis`, `howler`, `tone`, `matter-js`, `rapier3d-compat`, `d3`, `@tensorflow/tfjs`, `onnxruntime-web`, `simplex-noise`, `lil-gui`, `marked`. Anything else heavier than 100 KB gzipped needs a one-line justification in the project's `NOTES.md`.
- **No runtime network calls** beyond the project's own assets. Fonts are self-hosted, using OFL or similarly licensed families (e.g. from Fontsource).
- **Mobile-first everywhere.** Every project must be usable on a 390px-wide phone. Games are touch-first.
- Every project works **offline after first load**. Games ship as installable **PWAs** (manifest + service worker) so they launch fullscreen from a phone's home screen.

---

## 3. Project categories

Every project has exactly one primary `category` in its `meta.json`. Keep the showcase balanced across them.

| Category | What it is | Done looks like |
|---|---|---|
| `game` | Mobile-first web games: arcade, puzzle, roguelite, idle, rhythm, physics | Full loop (title → play → game over → retry), touch + keyboard, sound, juice (screen shake, particles, easing), high score saved, PWA installable, ≥ 5 minutes of genuine fun |
| `blog-design` | Complete blog themes / editorial designs | Home, article, archive/tag pages, about page; real-feeling sample content (original, not lorem ipsum); dark/light mode; beautiful long-form typography; reading progress; responsive images; ships as a reusable template with a short "use this theme" guide |
| `website` | Landing pages, portfolios, product sites for imaginary brands | A coherent fictional brand (name, logo, palette, voice); hero that stops the scroll; scroll-driven motion that stays readable; fast (Lighthouse ≥ 90 performance and accessibility) |
| `ui-concept` | App screens and interaction ideas: a music player, a weather app, a banking dashboard, a new kind of calendar | Clickable prototype with realistic fake data, 3+ connected screens, transitions with intent, a design-rationale write-up |
| `tool` | Small genuinely useful utilities: a color-palette generator, markdown slide maker, pomodoro with stats, regex visualizer | Solves one real problem well; state persists; import/export where it makes sense; keyboard shortcuts |
| `experiment` | Simulations and generative graphics: fluids, fractals, artificial life, physics toys | Beautiful with zero interaction, ≥ 55 fps on integrated GPU, controls for curious people, explains the math |
| `ai` | ML running fully in the browser: tiny models trained live, on-device vision, visualized internals | Runs on-device with no uploads, models < 25 MB, makes the model's behavior visible |
| `audio` | Synths, music toys, sound-reactive visuals | Starts on a tap (autoplay rules), no clipping, sounds good on phone speakers |

Fictional brands must be clearly original. Never imitate a real company's name, logo, or look.

---

## 4. Repository layout

```
coolstuff/
├── CLAUDE.md                  ← this file
├── README.md                  ← public-facing: what this is, live link, project grid by category
├── package.json
├── vite.config.ts             ← multi-page build, auto-discovers projects/*/index.html
├── index.html                 ← showcase home
├── src/
│   ├── showcase/              ← home: category tabs, cards, search, "random project" button
│   └── shared/                ← tiny helpers only: capability checks, fps meter, PWA register (~300 lines max)
├── projects/
│   └── <slug>/
│       ├── index.html         ← entry (blog/website projects may have several .html pages)
│       ├── src/
│       ├── public/            ← project-local assets
│       ├── meta.json          ← { title, tagline, category, tags[], tech[], date, status, mobile: true }
│       ├── NOTES.md           ← design rationale + how the clever parts work + credits
│       └── thumb.webp         ← 1200×750 screenshot, < 120 KB
├── templates/                 ← starter scaffolds per category (game, blog-design, website, …)
├── scripts/
│   ├── new-project.ts         ← `npm run new -- <category> <slug>` copies the right template
│   ├── build-index.ts         ← collects all meta.json → src/showcase/projects.json
│   └── smoke.ts               ← Playwright: desktop + mobile viewport, fails on console errors / blank page, captures thumbs
├── IDEAS.md                   ← backlog by category (§7); you maintain it
├── LOG.md                     ← one dated entry per session; "## Needs owner" section at top
└── .github/workflows/
    ├── ci.yml                 ← typecheck, lint, build, smoke test
    └── pages.yml              ← deploy dist/ to GitHub Pages on push to main
```

Projects **never import from each other**. If two projects want the same thing, copy it: independence beats DRY here.

---

## 5. Bootstrap (first session only)

Commit after each step:

1. Scaffold Vite + TS with a multi-page config that auto-discovers `projects/*/index.html` and any extra `.html` pages inside a project.
2. Write `scripts/new-project.ts`, `scripts/build-index.ts`, and one template per category in `templates/`.
3. Build the showcase home. It should itself be a design piece, with category tabs, a card grid, search, and a "surprise me" button. Each card shows the category, the tagline and the thumbnail.
4. Add `ci.yml` and `pages.yml`. If the deploy fails because Pages isn't enabled, note it under `## Needs owner` in `LOG.md` (owner sets Settings → Pages → Source → GitHub Actions) and continue.
5. Write `scripts/smoke.ts` (Playwright, Chromium with WebGPU flag, plus a 390×844 mobile viewport).
6. Ship **three starter projects in three different categories**, ideally one `game`, one `blog-design`, one `experiment`, to prove the pipeline end to end.
7. Write `README.md` and seed `IDEAS.md` with at least 8 ideas per category.

---

## 6. The Loop (every session)

1. **Read** the last entries of `LOG.md` and `IDEAS.md`. Run `npm ci && npm run build`. If `main` is broken, fixing it is the only task.
2. **Pick** one idea. Prefer the category with the fewest shipped projects, then the highest wow-per-effort. Mark it `[in progress]`.
3. **Define it in five lines** at the top of `NOTES.md`: the one-sentence pitch, the target feeling, the core mechanic or layout, the visual direction (palette, type, mood), and what "done" means for this one.
4. **Prototype the core**:
   - game: the main mechanic with grey boxes. Is it fun in 30 seconds? If not, change the mechanic or drop it.
   - blog-design / website: one key page at full fidelity (hero or article page). Does it look premium? If not, rethink the direction.
   - experiment / ai / audio: the raw effect. Is it amazing before polish?
   - tool / ui-concept: the main flow end to end with fake data.
   If the core doesn't hold up, record why in `IDEAS.md` and pick another idea.
5. **Build it out** to the category's "done" column in §3.
6. **Polish**: loading state, empty states, error states, motion timing, sound levels, focus styles, dark mode, resize, pause on tab hidden.
7. **Write `NOTES.md`**: why it looks and works the way it does, the hardest problem and how you solved it, the techniques a student could reuse, and credits for every asset and reference.
8. **Verify** (§9). Everything passes.
9. **Ship**: one commit per project, `feat(<category>/<slug>): <tagline>`. Update `meta.json`, move the idea to Shipped in `IDEAS.md`, and append to `LOG.md`.
10. Time left? Go back to step 2, in a **different category**.

---

## 7. Idea backlog seeds

Put these in `IDEAS.md` and keep adding your own. Scope each one down to a core that fits in one session, then layer on.

**game (mobile-first)**
- One-thumb gravity-flip runner with procedurally generated neon levels and a synthwave soundtrack.
- Physics stacking puzzle: drop odd-shaped blocks onto a wobbling tower in a storm.
- Tiny roguelite deckbuilder with 3-minute runs and daily seeded challenge.
- Rhythm game where the level is generated from audio you play into the mic.
- Cozy idle garden: plants grow in real time, crossbreed for rare colors.
- Slingshot orbital golf: fling a ball through planets' gravity wells.
- Pixel-art "falling sand" sandbox with challenge levels.
- Swipe-to-slice fruit-style game with juicy particle explosions and combo system.
- Minimalist logic puzzle with 50 hand-tuned levels and a procedurally generated endless mode.
- Two-player same-phone game: split screen, each player holds one edge.

**blog-design**
- Brutalist zine: raw grid, giant type, monospaced captions, ink-bleed images.
- Swiss editorial: strict grid, Helvetica-like grotesk, red accent, perfect rhythm.
- Japanese-minimal long-reads with vertical-text pull quotes and generous whitespace.
- Terminal/hacker blog: command-palette nav, typewriter titles, but still beautiful to read.
- Magazine-style photo essay with scroll-driven full-bleed image transitions.
- Developer notebook: code blocks with runnable snippets, margin notes, footnote popovers.
- Retro-print newspaper with multi-column layout that collapses gracefully on mobile.
- Dreamy gradient journal with grain textures and soft serif type.

**website**
- Landing page for an imaginary space-tourism startup with a 3D scroll-through of the ship.
- Portfolio for a fictional architect: drag-to-explore building cross-sections.
- Product page for an invented mechanical keyboard with a type-test you can try in the hero.
- Event microsite for a fictional music festival with a lineup that reacts to audio.
- Restaurant site with an interactive menu that plates dishes as you choose them.

**ui-concept**
- Music player where the album art's palette restyles the whole UI.
- Weather app that renders the actual sky (clouds, sun angle, rain) for the forecast.
- Calendar that shows your week as a landscape instead of a grid.
- Habit tracker built around a growing tree.
- Finance dashboard concept with legible, honest charts.

**tool**
- Palette generator from an uploaded image, with contrast checks and CSS/Tailwind export.
- Markdown → slide deck in the browser, with presenter mode.
- Regex visualizer with railroad diagrams and live test cases.
- Pomodoro with focus stats and ambient generated soundscapes.
- SVG pattern / background generator with export.

**experiment**
- Real-time 2D fluid you paint into; 3D SPH water in WebGPU; black hole with lensing.
- Physarum slime mold, Particle Life, Lenia, reaction–diffusion on a 3D mesh.
- Procedural planet zoom from orbit to surface; raymarched fractal flythrough.

**ai**
- Train a tiny MLP live and watch the decision boundary move as you drag points.
- Character-level transformer trained in-tab on pasted text, with attention visualized.
- Webcam pose → 3D puppet; neural cellular automata that regrow a drawing.

**audio**
- Modular synth with draggable patch cables; Karplus–Strong string you pluck.
- Draw a waveform, hear it, watch Fourier epicycles redraw it.

---

## 8. Quality bar (all categories)

A project is **not** done until:

- Loads to something impressive in **< 3 s** on a warm cache.
- Works on a **390×844 phone viewport** and on desktop, with no horizontal scroll and tap targets ≥ 44px.
- **Zero console errors or warnings** in Chromium and Firefox.
- Lighthouse **accessibility ≥ 90** for page-like projects (blog-design, website, ui-concept, tool). Real headings, alt text, visible focus, contrast passes.
- Motion respects `prefers-reduced-motion`.
- Games and graphics hold **≥ 55 fps** on mid-range hardware, or scale quality down automatically.
- Defaults look great with zero configuration.
- `NOTES.md`, a complete `meta.json`, and a real `thumb.webp` all exist.
- **Everything is original or properly licensed**: no copyrighted characters, music, logos, fonts or real brands. Generate procedurally, write the copy yourself, use CC0/OFL assets, and credit them.

---

## 9. Verification (before every commit)

```
npm run typecheck
npm run lint
npm run build
npm run smoke        # desktop + mobile viewports for every project;
                     # fails on console errors, blank screens, or missing meta/thumb
```

Then **look at it and use it**: run `npm run dev` and play the game to a game over, read a full article in the blog theme, click through every screen. If you can take screenshots, compare them to the quality bar. A green build with a broken experience is a failure.

Never push to `main` with CI red. If an older project breaks, fix it before shipping a new one.

---

## 10. Rules

- **Small and finished beats big and half-done.** Nothing broken or placeholder on `main`; unfinished work uses `status: "wip"` and stays hidden from the showcase.
- **One project per commit**, with tooling changes in separate commits.
- **Rotate categories.** Never ship more than two projects of the same category back to back.
- **No telemetry, analytics, trackers, or external CDNs at runtime.**
- **No secrets, tokens or personal data** in the repo, ever.
- Keep total `dist/` under 150 MB.
- Don't redesign the showcase on a whim. Changes are deliberate and logged.
- Be honest in `LOG.md`: record what failed and why, not only wins.
- When blocked on something only the owner can decide, write it under `## Needs owner` in `LOG.md` and move on to another idea.

---

## 11. Style

- TypeScript `strict: true`, small modules, and names that say what things mean.
- Comments explain *why*. `NOTES.md` explains the big picture.
- Each project has **its own visual identity**. Don't reuse one look everywhere. Decide palette, type pairing and motion personality before writing CSS.
- Showcase site style: near-black canvas, one accent color, generous whitespace, a refined sans plus a monospace for labels, with the projects' thumbnails doing the talking.

---

## 12. Definition of a great session

Someone opens the live site and finds one more project they've never seen before, in a category they didn't expect. It works beautifully on their phone, and the notes show them how it was made. Go build something crazy.
