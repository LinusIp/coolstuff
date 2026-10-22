# CLAUDE.md — coolstuff

You are the sole builder of **coolstuff**: a free, beautiful, interactive learning site covering the core of a university STEM and CS degree, from calculus and linear algebra through data structures, system design, ML, deep learning, diffusion models and LLMs to Physics 1 and 2.

Every lesson combines three things:
1. **Visuals you can touch.** Drag, scrub, slide, and watch the idea move.
2. **Formulas that are beautiful and alive.** Every symbol is color-linked to the picture, and derivations unfold step by step.
3. **Worked examples and problems with full solutions.** You see it done, then you do it yourself, with hints and step-by-step answers.

The bar: a student who opens a lesson *the night before an exam* finally gets it and can solve the problems, and a student who already knew it sees it in a new way.

The repo starts empty. You build everything: the site, the component kit, every lesson, the tooling and the deploy pipeline. Read this whole file before your first commit, and re-read **§8 The Loop** at the start of every session.

---

## 1. Stack and constraints

- **Static site on GitHub Pages**, deployed from `main` via GitHub Actions. No backend, no paid APIs, no secrets, no accounts. Progress is stored in `localStorage`.
- **Vite + TypeScript** (strict), multi-page build, with one page per lesson. Use **Preact** for UI components and vanilla canvas/SVG/WebGL for visuals.
- Allowed libraries (pin versions): `preact`, `katex`, `d3` (scales, shapes, force layouts), `three` (3D scenes), `gsap` (choreographed animation), `@tensorflow/tfjs` (live training in ML/DL lessons), `simplex-noise`, `marked`, plus `vitest` and `playwright` as dev dependencies. Anything else heavier than 100 KB gzipped needs a one-line justification in the lesson's `NOTES.md`.
- **No runtime network calls.** Fonts are self-hosted (OFL, via Fontsource). The whole site works **offline** after the first visit (service worker) and is installable as a PWA.
- **Mobile-first.** Every lesson must be fully usable on a 390px-wide phone with touch.
- Everything is **original**: your own prose, diagrams, examples and problems. No copied textbook problems, figures or solutions. Cite sources for ideas.

---

## 2. Teaching philosophy

- **Intuition before formalism.** Show the picture, let the learner play with it, *then* name it and write the equation. Never open with a definition.
- **Every key idea is something you can touch.** If a sentence says "as h shrinks, the secant becomes the tangent", there's a slider for h right there.
- **One lesson = one concept.** Aim for 15–30 minutes, including problems. Split anything bigger.
- **Predict → reveal.** Before showing a result, ask the learner to guess (drag a point, pick an option). Being wrong is where learning happens.
- **Linked representations.** Visual, formula, code and words all show the same thing, and hovering a term highlights it everywhere.
- **See one, do one.** Every concept goes from a fully worked example, to a guided problem, to an independent problem.
- **Name the misconceptions.** Each lesson has a "common traps" section built from real student mistakes.
- **Correct, always.** A beautiful wrong explanation is worse than none (§10).

---

## 3. Visual and formula design system

The site should look like a premium interactive textbook, not a template. Decide the system once, document it in `src/kit/DESIGN.md`, and use it everywhere.

**Typography**
- Reading text: a high-quality serif for long-form prose (e.g. Source Serif 4 or Literata), 18–20px on desktop and 17px on mobile, with a line length of 60–75 characters.
- UI and labels: a clean sans. Code: a monospace with good math glyphs (e.g. JetBrains Mono).
- Math: KaTeX, sized slightly larger than body text for display equations, with generous vertical breathing room.

**Color semantics** (`src/kit/theme.ts`), shared by every lesson in light and dark mode:
- Each lesson defines 3–5 named **concept colors** (e.g. `input`, `output`, `rate`, `error`, `probability`). The same concept wears the same color in the visual, the formula, the prose and the code.
- A consistent global meaning: blue = input/independent, orange = output/dependent, red = error/gradient/force, green = correct/solution, purple = probability/uncertainty.
- Every color pairing passes WCAG AA contrast, and color is never the only signal (pair it with labels, shapes or patterns).

**Formulas that come alive** (`Formula` component)
- Terms are tagged and colored by concept: `\colorTerm{rate}{\frac{dy}{dx}}`. Hovering or tapping a term highlights the matching part of the visual and the prose.
- **Derivations animate step by step**: each step shows what changed (the moved term slides, the cancelled terms fade out) with a one-line justification beside it ("multiply both sides by dx").
- **Live values**: formulas can display the current numbers from the interactive under the symbols (e.g. under `F = ma`, show `= 2.0 kg × 3.1 m/s²`).
- Every important formula has an "explain this" toggle that annotates each symbol in plain words.

**Visuals**
- Clean, quiet backgrounds, crisp 1.5–2px strokes, generous whitespace, and a single focal point per figure.
- Motion has meaning: animate only to show change, causality or sequence. Use easing, keep durations of 200–600ms, and respect `prefers-reduced-motion`.
- Draggable handles look draggable (a subtle ring and a cursor change) and have a hit area of at least 44px.
- Every figure has a short caption and a text description for screen readers.
- 3D is used only when the concept is genuinely 3D (surfaces, fields, rotations), with orbit controls and a sensible default camera.

---

## 4. Lesson structure

Every lesson follows this arc. Sections can be scrollytelling or stepped, but all of them are present:

1. **TL;DR card.** 3 bullets plus the key formula, printable as a revision sheet.
2. **Hook.** A question, puzzle or surprising visual that makes the concept feel necessary (≤ 1 screen).
3. **Play.** The central interactive with no formulas. The learner explores freely.
4. **Build the idea.** 3–6 short steps, each pairing a sentence or two with a focused interactive, going from concrete to general.
5. **Formalize.** The definition, theorem or equation, with every symbol linked to the visual, plus an animated derivation where there's one worth seeing.
6. **Worked examples** (§5). At least 3, ranging from easy to exam-level.
7. **Code it.** (CS/ML/DL/system design) a short, editable, runnable snippet whose output updates the visual. Physics and math lessons may include a small "simulate it" cell instead.
8. **Common traps.** 2–4 misconceptions, each with a visual counterexample.
9. **Practice problems** (§5). At least 8, with hints and full solutions.
10. **Quick check.** 4–6 fast concept questions (multiple choice, drag-to-answer) with explanations for wrong answers.
11. **Where this goes next.** Links to the lessons it builds on and the ones that build on it, plus 2–4 real references (textbook sections, papers, lecture notes).

---

## 5. Worked examples, problems and solutions

This is half the value of the site. Treat it with the same care as the visuals.

**Worked examples**
- At least **3 per lesson**: one direct application, one that combines this concept with an earlier one, and one at **exam level**.
- Each one is a stepped `WorkedExample`: problem statement → "what do we know / what do we want" → strategy in one sentence → solution steps, revealed one at a time → final answer boxed → a **sanity check** (units, limiting cases, does the picture agree?).
- Every step has a short justification ("by the chain rule", "conservation of momentum, since no external forces act").
- Where possible, the example has its own small interactive. Change the numbers, and the steps and answer recompute live.
- Before each step reveal, offer a "try the next step yourself" pause.

**Practice problems**
- At least **8 per lesson**, tagged by difficulty: ★ warm-up (×3), ★★ standard (×3), ★★★ exam-level or challenge (×2+).
- Mix the types: numeric answer, symbolic answer (checked by evaluating at random points, so equivalent forms are accepted), multiple choice with reasoning, drag-to-answer on a visual, proof/explanation (self-checked against a model answer), and for CS lessons, trace-the-algorithm or write-the-code (run against test cases in a Worker).
- Each problem has:
  - **Hint 1** (a nudge), **Hint 2** (the strategy), and **Hint 3** (the first step)
  - a **full step-by-step solution**, written like a worked example, that stays hidden until the learner submits or gives up
  - a **"why the common wrong answer is wrong"** note for the most likely mistake
- **Parameterized problems**: where it makes sense, problems are generated from templates with random but well-chosen values, so "give me another one" works indefinitely. The generator lives in `problems.ts` and is unit-tested so it never produces degenerate or ugly cases (division by zero, 17-digit decimals, trivial instances).
- Numeric answers accept a sensible tolerance and state the expected precision. Units are checked in physics problems.

**Per-subject problem banks**
- Each subject also gets a **mixed practice page** that draws problems from all its shipped lessons, and an **exam-style set** of timed, mixed problems with a full solutions walkthrough at the end.
- Progress (attempted / solved / needed hints) is saved locally and shown on the subject page.

---

## 6. The component kit (`src/kit/`)

Build these once and reuse them in every lesson. Keep the API small and documented in `src/kit/README.md`, with a live **kit gallery page** (`/kit`) showing every component and its states.

- `Stage2D` / `Stage3D`: coordinate system with pan/zoom, grid, axes and draggable handles (points, vectors, sliders on curves).
- `Slider`, `Toggle`, `Stepper`, `PlayScrub`: controls, including a timeline scrubber for stepping through algorithms and simulations frame by frame.
- `Plot`: functions, parametric curves, vector fields, surfaces, histograms and live-updating series.
- `MatrixGrid`: a 2×2/3×3 transform acting on the plane or space, with basis vectors highlighted.
- `GraphView` / `TreeView` / `ArrayView` / `TableView`: data-structure renderers with animated operations and highlighting (DP tables filling in, pointers moving).
- `ArchDiagram`: system-design diagrams with animated request flow, failure injection and live metrics.
- `Formula`: KaTeX with colored, hover-linked terms, live values and "explain this" annotations.
- `Derivation`: step-by-step animated algebra with justifications.
- `WorkedExample`: the stepped solution format from §5, with optional live parameters.
- `Problem` / `ProblemSet`: answer input (numeric, symbolic, choice, drag, code), checking, tiered hints, full solution, wrong-answer notes, and "another one".
- `CodeCell`: an editable code block that runs in a sandboxed Worker and pipes values into visuals.
- `Predict`: a "make your guess" wrapper that locks in the answer before revealing it.
- `Quiz`: quick concept checks with explanations.
- `Scrolly`: scroll-driven sections that pin a visual while the text advances.
- `Glossary`: hover/tap definitions that link to the defining lesson.
- `TLDR`: the printable revision card.
- `theme.ts` + `DESIGN.md`: the design system from §3.

---

## 7. Repository layout

```
coolstuff/
├── CLAUDE.md                     ← this file
├── README.md                     ← public-facing: what this is, live link, subject list
├── PROGRESS.md                   ← curriculum checklist (§9) with status per lesson; you maintain it
├── LOG.md                        ← one dated entry per session; "## Needs owner" section at top
├── package.json
├── vite.config.ts                ← multi-page build, auto-discovers lessons/**/index.html
├── index.html                    ← home: subjects, learning paths, continue-where-you-left-off
├── src/
│   ├── site/                     ← home, subject pages, prerequisite graph, practice pages, search
│   ├── kit/                      ← the component kit (§6)
│   └── content/curriculum.ts     ← the single source of truth for subjects, units, lessons and prerequisites
├── lessons/
│   └── <subject>/<slug>/         ← e.g. lessons/linalg/eigenvectors/
│       ├── index.html
│       ├── lesson.tsx            ← the lesson page
│       ├── math.ts               ← pure functions behind the visuals (tested)
│       ├── problems.ts           ← worked examples, problems, solutions, generators (tested)
│       ├── lesson.test.ts
│       ├── meta.json             ← { title, subject, unit, order, prerequisites[], minutes, level, status }
│       ├── NOTES.md              ← design choices, sources, simplifications, integrator/timestep if any
│       └── thumb.webp            ← 1200×750 screenshot, < 120 KB
├── scripts/
│   ├── new-lesson.ts             ← `npm run new -- <subject> <slug>` scaffolds a lesson
│   ├── build-index.ts            ← validates meta.json against curriculum.ts, builds search index
│   └── smoke.ts                  ← Playwright: desktop + 390×844 mobile; fails on console errors, blank
│                                    figures, broken KaTeX, or a lesson missing required sections
└── .github/workflows/
    ├── ci.yml                    ← typecheck, lint, test, build, smoke
    └── pages.yml                 ← deploy dist/ to GitHub Pages on push to main
```

Lessons **never import from each other**, only from `src/kit/`. If something is useful to two lessons, it belongs in the kit.

**Site structure**
- **Home**: the subject grid, "Start here" learning paths (*Calculus from zero*, *ML math foundations*, *Zero to LLMs*, *Interview-ready DSA*, *System design*, *Physics for engineers*), and continue-where-you-left-off.
- **Subject page**: units → lessons with time, level and your progress; links to mixed practice and the exam-style set. Unshipped lessons show as "coming soon" so the full map is always visible.
- **Prerequisite graph**: an interactive map across all subjects (so "diffusion models" visibly depends on "Gaussian distribution", "KL divergence", "U-Nets" and "SDEs").
- **Search** across lessons, formulas and glossary terms.

---

## 8. Workflow

### Bootstrap (first session only)

Commit after each step:

1. Scaffold Vite + TS + Preact with the multi-page config, and write `curriculum.ts` from §9.
2. Write `scripts/new-lesson.ts`, `scripts/build-index.ts`, and `scripts/smoke.ts`.
3. Write `src/kit/DESIGN.md` and `theme.ts`, then build the kit (§6) along with the `/kit` gallery page. Start with `Stage2D`, `Slider`, `Formula`, `Derivation`, `WorkedExample`, `Problem` and `TLDR`, and add the rest as lessons need them.
4. Build the home page, subject pages and the prerequisite graph, showing the full curriculum as "coming soon".
5. Add `ci.yml` and `pages.yml`. If the deploy fails because Pages isn't enabled, note it under `## Needs owner` in `LOG.md` (the owner sets Settings → Pages → Source → GitHub Actions) and continue.
6. Ship **three flagship lessons** from different subjects to prove the whole pipeline and set the quality bar:
   - *Linear algebra: Eigenvectors, the directions a matrix doesn't turn*
   - *Calculus I: The derivative as slope and as rate*
   - *Machine learning: Gradient descent*
7. Write `README.md`, and create `PROGRESS.md` from §9.

### The Loop (every session)

1. **Read** the last entries of `LOG.md` and `PROGRESS.md`. Run `npm ci && npm run build`. If `main` is broken, fixing it is the only task.
2. **Pick** the next lesson whose prerequisites are already shipped. Rotate subjects, and prefer lessons that unlock the most other lessons. Mark it `[in progress]`.
3. **Plan in five lines** at the top of `NOTES.md`: the one-sentence takeaway, the central interactive, the concept colors, the key formula(s), and the exam-level problem the learner should be able to solve at the end.
4. **Prototype the central interactive** first. Drag it around. Does the concept click with no text at all? If not, find a better visual metaphor before writing any prose.
5. **Write the math and problems first, as tested code**: `math.ts` and `problems.ts` (examples, problems, solutions, generators), plus their tests.
6. **Build the lesson** through every section in §4.
7. **Polish**: typography, spacing, motion timing, dark mode, mobile layout, focus states, loading states.
8. **Professor review**: re-read the whole lesson as a skeptical professor. Is anything subtly wrong, misleadingly simplified, or ambiguous? Solve every problem yourself from scratch and compare against the written solutions.
9. **Verify** (§12). Everything passes.
10. **Ship**: one commit per lesson, `feat(<subject>/<slug>): <title>`. Update `meta.json`, `PROGRESS.md` and `LOG.md`.
11. Time left? Go back to step 2.

Every 5 lessons in a subject, update that subject's mixed practice page and exam-style set.

---

## 9. Curriculum

This is the **full** target. Ship lessons in prerequisite order and keep `curriculum.ts` and `PROGRESS.md` in sync with this list. The bracketed note after each topic is the suggested central interactive. If you find a better metaphor, use it.

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

---

## 10. Correctness

- Every lesson's math lives in pure modules (`math.ts`, `problems.ts`) with **unit tests** (`vitest`) against known values. For example, the numerical derivative must match the analytic one, Dijkstra must match brute force on random graphs, and the energy in a simulation must be conserved within tolerance.
- **Every problem's written solution is tested**: the test computes the answer independently and checks it against the stated final answer. Generated problems are tested over many random seeds.
- Simulations state their integrator (e.g. symplectic Euler, RK4) and timestep in `NOTES.md`.
- When simplifying, say so in the lesson ("we're ignoring air resistance here").
- Cite at least two standard references per lesson (e.g. Stewart, Strang, CLRS, Halliday/Resnick, Griffiths, Bishop, Goodfellow et al., *Dive into Deep Learning*, the original papers for diffusion and transformers). Write your own explanations and problems; never copy theirs.
- Notation is consistent across the site, and documented in `src/kit/NOTATION.md` (vectors bold, matrices uppercase, etc.).

---

## 11. Quality bar

A lesson is **not** done until:

- Every section in §4 is present, with at least 3 worked examples and 8 practice problems, all with hints and full solutions.
- The central interactive makes the idea click within the first minute.
- Every key formula is rendered with KaTeX, color-linked to the visual, and has an "explain this" annotation.
- It works on a **390×844 phone** and on desktop: no horizontal scroll, tap targets ≥ 44px, readable formulas (long equations wrap or scroll horizontally inside their own box, never the page).
- **Zero console errors or warnings** in Chromium and Firefox.
- Lighthouse **accessibility ≥ 90** and **performance ≥ 85**. Real headings, alt text and screen-reader descriptions for figures, visible focus, and passing contrast.
- Motion respects `prefers-reduced-motion`. Visuals hold ≥ 55 fps or scale down.
- Light and dark mode both look intentional.
- `meta.json`, `NOTES.md` and a real `thumb.webp` all exist.

---

## 12. Verification (before every commit)

```
npm run typecheck
npm run lint
npm run test         # math, problem solutions and generators
npm run build
npm run smoke        # desktop + mobile for every lesson; fails on console errors, blank figures,
                     # KaTeX errors, or missing required sections
```

Then **use it like a student**: run `npm run dev`, go through the lesson top to bottom, solve at least three problems (one by asking for every hint), and try "another one" on a generated problem several times. If you can take screenshots, compare them against the quality bar. A green build with a confusing lesson is a failure.

Never push to `main` with CI red. If an older lesson breaks, fix it before shipping a new one.

---

## 13. Rules

- **Small and finished beats big and half-done.** Nothing broken or placeholder goes on `main`. Unfinished lessons use `status: "wip"` and show as "coming soon".
- **One lesson per commit**, with kit and site changes in separate commits.
- When a kit component changes, check every lesson that uses it (smoke tests help, but look too).
- **No telemetry, analytics, trackers or external CDNs at runtime.**
- **No secrets, tokens or personal data** in the repo, ever.
- Keep total `dist/` under 150 MB.
- Be honest in `LOG.md`: record what failed and why, not only wins.
- When blocked on something only the owner can decide, write it under `## Needs owner` in `LOG.md` and move on to another lesson.

---

## 14. Definition of a great session

A student opens a lesson the night before their exam. Within a minute of dragging the visual, the idea clicks. The formulas read like a story instead of a wall of symbols. They follow the worked examples, solve the problems on their own (with a hint when they're stuck), and close the tab understanding eigenvectors, backprop or Faraday's law better than they did after the lecture. Build that, one lesson at a time.
