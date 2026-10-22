# CLAUDE.md — coolstuff

You are the sole builder of **coolstuff**: a lab and showcase of finished, ambitious projects across many kinds of work, including mobile games, stunning blog and website designs, UI concepts, tools, simulations, AI demos, and a full library of **visual, intuitive explainers** for university STEM and CS subjects. Every project should make someone say *"wait, one person built this?"*

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
- Allowed libraries (pin versions): `phaser`, `pixi.js`, `three`, `preact`, `svelte`, `gsap`, `motion`, `lenis`, `howler`, `tone`, `matter-js`, `rapier3d-compat`, `d3`, `@tensorflow/tfjs`, `onnxruntime-web`, `simplex-noise`, `lil-gui`, `marked`, `katex`, `vitest` (dev). Anything else heavier than 100 KB gzipped needs a one-line justification in the project's `NOTES.md`.
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
| `explainer` | Visual, interactive lessons that build real intuition for one concept of a university subject (see §8) | Meets the explainer standard in §8.2: intuition first, every key idea manipulable, a "check yourself" section, and correct math |

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
│   ├── learn/                 ← /learn hub: subject pages, curriculum maps, prerequisite graph, progress
│   ├── explain-kit/           ← shared explainer components (§8.3); the one allowed shared library
│   └── shared/                ← tiny helpers only: capability checks, fps meter, PWA register (~300 lines max)
├── projects/
│   └── <slug>/                ← explainers use learn-<subject>-<topic>, e.g. learn-linalg-eigenvectors
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
    ├── ci.yml                 ← typecheck, lint, test, build, smoke test
    └── pages.yml              ← deploy dist/ to GitHub Pages on push to main
```

Explainer `meta.json` adds `{ subject, unit, order, prerequisites: [slugs], minutes, level }`. `build-index.ts` validates that every prerequisite exists or is listed in the curriculum.

Projects **never import from each other**. If two projects want the same thing, copy it: independence beats DRY here. The single exception is `src/explain-kit/`, which every explainer uses so lessons look and behave consistently.

---

## 5. Bootstrap (first session only)

Commit after each step:

1. Scaffold Vite + TS with a multi-page config that auto-discovers `projects/*/index.html` and any extra `.html` pages inside a project.
2. Write `scripts/new-project.ts`, `scripts/build-index.ts`, and one template per category in `templates/`.
3. Build the showcase home. It should itself be a design piece, with category tabs, a card grid, search, and a "surprise me" button. Each card shows the category, the tagline and the thumbnail.
4. Add `ci.yml` and `pages.yml`. If the deploy fails because Pages isn't enabled, note it under `## Needs owner` in `LOG.md` (owner sets Settings → Pages → Source → GitHub Actions) and continue.
5. Write `scripts/smoke.ts` (Playwright, Chromium with WebGPU flag, plus a 390×844 mobile viewport).
6. Build `src/explain-kit/` (§8.3) and the `/learn` hub with a subject page for every subject in §8.4, each showing its full curriculum map, with unshipped lessons greyed out as "coming soon".
7. Ship **four starter projects**: one `game`, one `blog-design`, one `experiment`, and one `explainer` (suggested: *Eigenvectors: the directions a matrix doesn't turn*). Together they prove the pipeline end to end.
8. Write `README.md`. Seed `IDEAS.md` with at least 8 ideas per non-explainer category, and copy the full curriculum from §8.4 into an `## Explainers` section as a checklist.

---

## 6. The Loop (every session)

1. **Read** the last entries of `LOG.md` and `IDEAS.md`. Run `npm ci && npm run build`. If `main` is broken, fixing it is the only task.
2. **Pick** one idea. **Every other project is an explainer.** For explainers, pick the next lesson whose prerequisites are already shipped, rotating subjects. For everything else, prefer the category with the fewest shipped projects, then the highest wow-per-effort. Mark it `[in progress]`.
3. **Define it in five lines** at the top of `NOTES.md`: the one-sentence pitch, the target feeling, the core mechanic or layout, the visual direction (palette, type, mood), and what "done" means for this one.
4. **Prototype the core**:
   - game: the main mechanic with grey boxes. Is it fun in 30 seconds? If not, change the mechanic or drop it.
   - blog-design / website: one key page at full fidelity (hero or article page). Does it look premium? If not, rethink the direction.
   - experiment / ai / audio: the raw effect. Is it amazing before polish?
   - tool / ui-concept: the main flow end to end with fake data.
   - explainer: the **one central interactive** (the "aha" visual). Drag it around. Does the concept click with no text at all? If not, find a better visual metaphor before writing any prose.
   If the core doesn't hold up, record why in `IDEAS.md` and pick another idea.
5. **Build it out** to the category's "done" column in §3.
6. **Polish**: loading state, empty states, error states, motion timing, sound levels, focus styles, dark mode, resize, pause on tab hidden.
7. **Write `NOTES.md`**: why it looks and works the way it does, the hardest problem and how you solved it, the techniques a student could reuse, and credits for every asset and reference.
8. **Verify** (§10). Everything passes.
9. **Ship**: one commit per project, `feat(<category>/<slug>): <tagline>`. Update `meta.json`, move the idea to Shipped in `IDEAS.md`, and append to `LOG.md`.
10. Time left? Go back to step 2, in a **different category**. Explainers are the exception: you may ship two in a row, as long as they're from different subjects.

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

## 8. Explainers: the `/learn` library

A complete, free, visual-first library of interactive lessons covering the core of a university STEM/CS degree. The bar is that a student who reads a lesson *the night before an exam* finally gets it, and a student who already knew it sees it in a new way.

### 8.1 Philosophy

- **Intuition before formalism.** Show the picture, let the learner play with it, *then* name it and write the equation. Never open with a definition.
- **Every key idea is something you can touch.** If a sentence says "as h shrinks, the secant becomes the tangent", there's a slider for h right there.
- **One lesson = one concept.** Aim for 10–20 minutes. Split anything bigger.
- **Predict → reveal.** Before showing a result, ask the learner to guess (drag a point, pick an option). Being wrong is where learning happens.
- **Linked representations.** Visual, equation, code and words all show the same thing, and hovering a term in the equation highlights it in the picture (color-coded consistently).
- **Name the misconceptions.** Each lesson has a "common traps" section built from real student mistakes.
- **Correct, always.** A beautiful wrong explanation is worse than none. The math must be right, the code must run, and the simulations must obey the actual equations.

### 8.2 Lesson structure (the explainer standard)

Every explainer follows this arc. Sections can be scrollytelling or stepped, but all of them are present:

1. **Hook.** A question, puzzle or surprising visual that makes the concept feel necessary (≤ 1 screen).
2. **Play.** The central interactive with no formulas. The learner explores freely.
3. **Build the idea.** 3–6 short steps, each pairing a sentence or two with a focused interactive, from concrete to general.
4. **Formalize.** The definition, theorem or equation with every symbol linked to the visual. Include a worked example with numbers.
5. **Code it.** (CS/ML/DL subjects) a short, runnable, editable snippet in TS or Python-like pseudocode whose output updates the visual.
6. **Common traps.** 2–4 misconceptions, each with a visual counterexample.
7. **Check yourself.** 4–8 questions mixing multiple choice, drag-to-answer and numeric input, with explanations for wrong answers. Progress is saved locally.
8. **Where this goes next.** Links to the lessons that build on this one and to the lessons it builds on, plus 2–4 real references (textbook sections, papers, lecture notes).

Also required:
- A **TL;DR card** at the top: 3 bullets plus the key equation, printable as a revision sheet.
- Works at 390px. Interactives use touch-friendly handles (≥ 44px hit area).
- Math rendered with **KaTeX**, prerendered at build time where possible.
- Keyboard-accessible interactives, with a text description of what each visual shows for screen readers.
- `minutes`, `level` (`intro` / `core` / `advanced`) and `prerequisites` filled in `meta.json`.

### 8.3 `src/explain-kit/`

Build these once and reuse them in every lesson. Keep the API small and documented in `src/explain-kit/README.md`:

- `Stage2D` / `Stage3D`: coordinate system with pan/zoom, grid, axes and draggable handles (points, vectors, sliders on curves).
- `Slider`, `Toggle`, `Stepper`, `PlayScrub`: controls, including a timeline scrubber for stepping through algorithms and simulations frame by frame.
- `Plot`: functions, parametric curves, vector fields, surfaces, histograms and live-updating series.
- `MatrixGrid`: shows a 2×2/3×3 transform acting on the plane or space with basis vectors highlighted.
- `GraphView` / `TreeView` / `ArrayView`: data-structure renderers with animated operations and highlighting.
- `LinkedEq`: KaTeX equation whose terms are color-tagged and hover-linked to elements in a Stage.
- `CodeCell`: small editable code block that runs in a sandboxed Worker and pipes values into visuals.
- `Predict`: a "make your guess" wrapper that locks in the answer before revealing it.
- `Quiz`: question types, scoring, explanations and saved progress.
- `Scrolly`: scroll-driven sections that pin a visual while the text advances.
- `Glossary`: hover/tap definitions that link to the defining lesson.
- `theme.ts`: one semantic color system shared by every lesson (e.g. input = blue, output = orange, error/gradient = red, probability = purple), working in both light and dark mode.

The `/learn` hub shows:
- a page per subject, with units, lessons, estimated time and your progress
- an interactive **prerequisite graph** across all subjects (so "diffusion models" visibly depends on "Gaussian distribution", "KL divergence", "U-Net" and "SDEs")
- "Start here" learning paths, e.g. *Zero to LLMs*, *Physics for engineers*, *Interview-ready DSA*, *ML math foundations*.

### 8.4 Curriculum

This is the **full** target. Ship lessons in prerequisite order and keep this list in sync with `IDEAS.md`. The bracketed note after each topic is the suggested central interactive. If you find a better metaphor, use it.

**Calculus I: limits and derivatives**
1. Functions as machines and graphs [drag inputs, watch outputs trace the graph]
2. Limits [zoom into a point infinitely; ε–δ as a target game]
3. Continuity and the intermediate value theorem
4. The derivative as slope and as rate [secant → tangent with h slider]
5. Derivative rules: power, product, quotient [area of a growing rectangle for the product rule]
6. Chain rule [linked gears with different ratios]
7. Implicit differentiation and related rates [ladder sliding down a wall]
8. Linear approximation and Newton's method [tangent lines hunting a root]
9. Optimization [drag the fence; area meter peaks where the derivative is zero]
10. Curve sketching: f, f′, f″ linked [three stacked plots, one cursor]
11. Mean value theorem
12. L'Hôpital's rule [zoom until both functions look linear]

**Calculus II: integrals and series**
1. Area as accumulation; Riemann sums [n slider, left/right/mid/trapezoid]
2. Fundamental theorem of calculus [drag the upper limit; the area function's slope is f]
3. Substitution [stretching the x-axis]
4. Integration by parts [the area-swap picture]
5. Partial fractions and trig integrals
6. Improper integrals [finite area, infinite length: Gabriel's horn]
7. Volumes of revolution [spin a 2D region into 3D]
8. Arc length and surface area
9. Sequences and convergence
10. Series and convergence tests [stacking bars, harmonic vs geometric]
11. Taylor and Maclaurin series [add terms one at a time, watch the fit spread]
12. Parametric curves and polar coordinates

**Calculus III: multivariable**
1. Functions of two variables: surfaces and contour maps [hiking map ↔ 3D terrain]
2. Partial derivatives [slice the surface along x or y]
3. Gradient and directional derivatives [ball on a hill, arrow points uphill]
4. Tangent planes and linearization
5. Multivariable chain rule
6. Optimization and Lagrange multipliers [contour lines kissing a constraint curve]
7. Double and triple integrals [stack of slices]
8. Polar, cylindrical and spherical coordinates
9. Vector fields [particles flowing]
10. Line integrals and work
11. Divergence and curl [paddle wheels and sources/sinks]
12. Green's, Stokes' and divergence theorems [circulation inside cancels]

**Differential equations**
1. What an ODE is; slope fields [draw a solution by following arrows]
2. Separable equations; exponential growth and decay
3. Euler's method and why step size matters
4. Second-order linear ODEs; the spring–mass–damper [under-/critically/over-damped]
5. Resonance [drive a spring at its natural frequency]
6. Systems of ODEs and phase portraits [predator–prey]
7. Eigenvalues ↔ stability [links to linear algebra]
8. Laplace transform intuition
9. PDEs: heat equation and wave equation [paint heat, watch it diffuse]

**Linear algebra**
1. Vectors: arrows, lists, and things you can add
2. Linear combinations, span and basis [two vectors painting the plane]
3. Linear independence
4. Matrices as transformations of space [MatrixGrid: drag î and ĵ]
5. Matrix multiplication as composition
6. Determinant as area/volume scaling (and sign as orientation flip)
7. Inverses, rank and null space [squashing space to a line]
8. Systems of equations and Gaussian elimination [row ops animated]
9. Column space and the four fundamental subspaces
10. Dot product and projection [shadows]
11. Orthogonality, Gram–Schmidt and QR
12. Least squares [fit a line; residuals as the perpendicular drop]
13. Change of basis [same arrow, different coordinates]
14. Eigenvectors and eigenvalues [directions a matrix doesn't turn]
15. Diagonalization and matrix powers [Fibonacci, Markov chains]
16. Symmetric matrices and the spectral theorem
17. Singular value decomposition [rotate, stretch, rotate; image compression demo]
18. PCA [find the axis of a point cloud]
19. Positive definite matrices and quadratic forms [bowls vs saddles]
20. Linear algebra for ML: tensors, batching, broadcasting

**Probability and statistics**
1. Probability as counting and as area
2. Conditional probability and Bayes' rule [the disease-test square]
3. Random variables, expectation, variance
4. Common distributions: Bernoulli, binomial, Poisson, uniform, exponential, Gaussian [shape sliders]
5. Law of large numbers and the central limit theorem [Galton board]
6. Joint distributions, covariance, correlation
7. Multivariate Gaussian [drag the covariance ellipse]
8. Maximum likelihood estimation
9. Bayesian inference: prior × likelihood → posterior [coin-flip updating]
10. Confidence intervals and hypothesis tests [100 intervals, how many miss?]
11. Entropy, cross-entropy and KL divergence [bits, surprise]
12. Markov chains and random walks
13. Monte Carlo methods [estimate π by throwing darts]

**Discrete math**
1. Logic and proofs (direct, contradiction, induction) [dominoes]
2. Sets, functions and relations
3. Counting: permutations, combinations, pigeonhole
4. Recurrences and generating functions
5. Graph basics
6. Modular arithmetic and RSA intuition

**Data structures and algorithms**
1. Big-O by feel [race growth curves; count operations live]
2. Arrays and dynamic arrays [amortized doubling]
3. Linked lists
4. Stacks and queues [undo, browser history]
5. Hash tables, collisions, load factor [buckets filling up]
6. Recursion and the call stack [stack frames growing and unwinding]
7. Sorting I: bubble, insertion, selection
8. Sorting II: merge sort and quicksort [divide and conquer trees; pivot choices]
9. Heaps and priority queues; heapsort
10. Binary search and its variants [the shrinking window]
11. Binary search trees
12. Balanced trees: AVL and red–black [rotations animated]
13. B-trees [why databases love them]
14. Tries
15. Union–find [path compression flattening]
16. Graph representations; BFS and DFS [flood fill on a maze]
17. Topological sort [course prerequisites]
18. Shortest paths: Dijkstra, Bellman–Ford, A* [frontier expanding]
19. Minimum spanning trees: Kruskal and Prim
20. Greedy algorithms and when they fail
21. Dynamic programming [the table filling in: knapsack, LCS, edit distance]
22. Backtracking [N-queens search tree]
23. Two pointers and sliding window
24. Segment trees and Fenwick trees
25. String matching: KMP and rolling hash
26. Network flow [water through pipes]
27. P vs NP and reductions, intuitively

**System design**
1. Client–server and what happens when you type a URL [packet's journey]
2. Latency numbers every engineer should know [zoomable timeline]
3. Vertical vs horizontal scaling
4. Load balancing algorithms [requests flowing to servers live]
5. Caching: strategies, eviction (LRU/LFU), invalidation [hit-rate meter]
6. CDNs
7. Databases: SQL vs NoSQL, indexes [B-tree index lookup]
8. Replication: leader–follower, multi-leader [replication lag visualized]
9. Sharding and partitioning [hot shard problem]
10. Consistent hashing [the ring, adding/removing nodes]
11. CAP theorem and consistency models [partition the network yourself]
12. Message queues and pub/sub; backpressure
13. Rate limiting: token bucket, leaky bucket, sliding window
14. Consensus: Raft [leader election and log replication simulator]
15. Idempotency, retries and exactly-once illusions
16. Microservices vs monolith
17. Observability: logs, metrics, traces
18. Case studies, each as an interactive architecture you can stress with traffic: URL shortener, chat app, news feed, rate limiter, video streaming, ride-sharing dispatch, distributed key-value store

**Computer systems** (OS, networks, databases)
1. How a CPU runs code: fetch–decode–execute [tiny visible CPU]
2. Memory hierarchy and caches [cache lines lighting up]
3. Processes, threads and context switching
4. CPU scheduling algorithms [Gantt charts]
5. Concurrency: race conditions, locks, deadlock [dining philosophers]
6. Virtual memory and paging [page table walk]
7. File systems
8. Networking layers; TCP handshake and congestion control [sawtooth window]
9. DNS and HTTP/HTTPS, TLS handshake
10. Transactions, ACID and isolation levels [anomalies replayed]
11. Query planning and joins

**Machine learning**
1. What learning from data means; train/test split
2. Linear regression and the loss landscape [drag the line, watch loss]
3. Gradient descent [ball rolling on the loss surface; learning-rate slider]
4. Logistic regression and decision boundaries
5. Overfitting, underfitting and bias–variance [polynomial degree slider]
6. Regularization: L1 vs L2 [diamond vs circle constraints]
7. Cross-validation
8. k-nearest neighbors [Voronoi regions]
9. Decision trees [split the plane]
10. Ensembles: random forests and gradient boosting [weak learners adding up]
11. Support vector machines and the kernel trick [lift points into 3D]
12. Naive Bayes
13. k-means and clustering [centroids marching]
14. Gaussian mixture models and EM
15. PCA, t-SNE and UMAP
16. Evaluation metrics: precision, recall, ROC, AUC [threshold slider]
17. Feature engineering and data leakage
18. Intro to reinforcement learning: bandits, MDPs, Q-learning [grid-world agent]

**Deep learning**
1. The perceptron and why one neuron isn't enough [XOR]
2. Multilayer perceptrons: folding space [watch layers warp the plane]
3. Activation functions
4. Backpropagation as the chain rule on a graph [step-through computation graph]
5. Loss functions
6. Optimizers: SGD, momentum, RMSProp, Adam [race on a nasty surface]
7. Initialization, vanishing/exploding gradients
8. Batch norm, layer norm
9. Dropout and regularization
10. Convolutions [kernel sliding over an image you draw]
11. CNN architectures and receptive fields; what filters learn
12. ResNets and skip connections
13. RNNs, LSTMs and GRUs [memory over time]
14. Embeddings [word vectors in 2D/3D]
15. Attention [query–key–value as soft lookup]
16. Transformers block by block
17. Autoencoders and the latent space
18. Variational autoencoders [walk the latent space]
19. GANs [generator vs discriminator tug of war]
20. U-Nets
21. Training at scale: batching, mixed precision, data/model parallelism
22. Interpretability basics: saliency, probing, features

**Diffusion models**
1. Generative modeling: learning a distribution [2D toy datasets]
2. Adding noise: the forward process [a spiral dissolving into a Gaussian blob]
3. Noise schedules [linear vs cosine]
4. Learning to denoise: the reverse process [step back from noise]
5. Score functions and score matching [arrows pointing toward data]
6. DDPM, step by step, with a tiny model trained live on 2D data
7. DDIM and faster sampling
8. The SDE/ODE view; probability flow
9. Conditioning and classifier-free guidance [guidance-scale slider]
10. Latent diffusion: diffusing in a VAE's latent space
11. Text-to-image pipeline anatomy: text encoder, U-Net/DiT, cross-attention
12. Flow matching and rectified flow [straightening the paths]
13. Consistency models and distillation

**Large language models**
1. Language modeling as next-token prediction [predict-the-next-word game]
2. Tokenization and BPE [watch merges build a vocabulary]
3. Embeddings and positional encodings [rotary embeddings as rotations]
4. Self-attention, in full detail [attention matrix you can probe]
5. Multi-head attention
6. The transformer decoder, assembled [data flowing through each block]
7. Training: cross-entropy, batching, learning-rate schedules
8. Scaling laws [loss vs compute curves]
9. Sampling: greedy, temperature, top-k, top-p [same prompt, different dice]
10. The KV cache and inference cost
11. Fine-tuning and instruction tuning
12. RLHF and preference optimization (DPO) intuition
13. LoRA and parameter-efficient fine-tuning [low-rank update as a thin matrix]
14. Quantization [precision slider vs quality]
15. Retrieval-augmented generation [embedding search in 2D]
16. Tool use and agents: the loop
17. Mixture of experts [router choosing experts per token]
18. Long context: attention variants and positional extrapolation
19. Evaluation and failure modes: hallucination, prompt injection
20. A tiny GPT trained in your browser, end to end (capstone)

**Physics 1: mechanics**
1. Units, vectors and measurement
2. Kinematics in 1D: position, velocity, acceleration graphs linked [drive the car]
3. Projectile motion [cannon with angle/speed; the dotted trajectory]
4. Newton's laws and free-body diagrams [build the FBD by dragging forces]
5. Friction and inclined planes
6. Circular motion and centripetal force
7. Work, kinetic and potential energy [roller coaster energy bars]
8. Conservation of energy
9. Momentum, impulse and collisions [elastic vs inelastic air track]
10. Center of mass
11. Rotational kinematics and torque [seesaw, wrench]
12. Moment of inertia and rolling [race shapes down a ramp]
13. Angular momentum [spinning skater]
14. Gravitation and orbits; Kepler's laws [launch satellites]
15. Simple harmonic motion and pendulums
16. Waves: wavelength, frequency, superposition [two sources interfering]
17. Standing waves and sound [string harmonics you hear]
18. Fluids: pressure, buoyancy, Bernoulli
19. Thermodynamics: temperature, heat, ideal gas [box of bouncing particles]
20. Laws of thermodynamics, heat engines and entropy [PV diagram cycles]

**Physics 2: electricity and magnetism**
1. Electric charge and Coulomb's law [drag charges, read forces]
2. Electric fields and field lines
3. Gauss's law [flux through a surface you resize]
4. Electric potential and equipotentials [3D potential landscape]
5. Capacitance and dielectrics
6. Current, resistance and Ohm's law [electron drift]
7. DC circuits: Kirchhoff's laws [build circuits, see current flow]
8. RC circuits [charging curve]
9. Magnetic fields and forces on charges [cyclotron spirals]
10. Biot–Savart and Ampère's law [field around wires and loops]
11. Faraday's law and induction [magnet through a coil; generator]
12. Lenz's law
13. Inductance, RL and LC circuits [energy sloshing between L and C]
14. AC circuits and resonance; phasors [rotating arrows]
15. Maxwell's equations together [one interactive per equation]
16. Electromagnetic waves [E and B in step]
17. Geometric optics: reflection, refraction, lenses [ray-tracing bench]
18. Wave optics: interference and diffraction [double slit]

**Beyond (later expansion)**
- Modern physics: special relativity [light clocks, Minkowski diagrams], photoelectric effect, Bohr model, intro quantum mechanics [wavefunction in a box, tunneling]
- Signals and systems: Fourier series and transform [epicycles], sampling and aliasing, convolution, filters
- Information theory, numerical methods, optimization (convex, constrained)
- Computer graphics: rasterization, ray tracing, shaders
- Reinforcement learning in depth: policy gradients, PPO, AlphaZero-style search
- Compilers: lexing, parsing, ASTs; cryptography: hashing, public keys, zero-knowledge intuition

### 8.5 Correctness

- Every explainer's math lives in a pure module (`math.ts`) with **unit tests** (`vitest`) against known values. For example, the numerical derivative must match the analytic one, Dijkstra must match brute force on random graphs, and the energy in the simulation must be conserved within tolerance.
- Simulations state their integrator (e.g. symplectic Euler, RK4) and timestep in `NOTES.md`.
- When simplifying, say so in the lesson ("we're ignoring air resistance here").
- Cite at least two standard references per lesson (e.g. Stewart, Strang, CLRS, Halliday/Resnick, Griffiths, Bishop, Goodfellow et al., *Dive into Deep Learning*, the original papers for diffusion and transformers).
- Before shipping, re-read the lesson as a skeptical professor: is anything subtly wrong or misleadingly simplified? Fix it.

---

## 9. Quality bar (all categories)

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

## 10. Verification (before every commit)

```
npm run typecheck
npm run lint
npm run test         # vitest: explainer math and algorithm correctness
npm run build
npm run smoke        # desktop + mobile viewports for every project;
                     # fails on console errors, blank screens, or missing meta/thumb
```

Then **look at it and use it**: run `npm run dev` and play the game to a game over, read a full article in the blog theme, click through every screen. If you can take screenshots, compare them to the quality bar. A green build with a broken experience is a failure.

Never push to `main` with CI red. If an older project breaks, fix it before shipping a new one.

---

## 11. Rules

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

## 12. Style

- TypeScript `strict: true`, small modules, and names that say what things mean.
- Comments explain *why*. `NOTES.md` explains the big picture.
- Each project has **its own visual identity**. Don't reuse one look everywhere. Decide palette, type pairing and motion personality before writing CSS.
- Showcase site style: near-black canvas, one accent color, generous whitespace, a refined sans plus a monospace for labels, with the projects' thumbnails doing the talking.

---

## 13. Definition of a great session

Someone opens the live site and finds one more project they've never seen before, in a category they didn't expect, or a student finally understands eigenvectors, backprop or Faraday's law the night before an exam. It works beautifully on their phone, and the notes show them how it was made. Go build something crazy.
