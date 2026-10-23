# coolstuff

**A free, interactive, visual-first textbook for the core of a university STEM and CS degree** — calculus and linear algebra through data structures, system design, machine learning, deep learning, diffusion models and LLMs, to Physics 1 and 2.

**Live → https://linusip.github.io/coolstuff/**

Every lesson combines three things: visuals you can touch (drag, scrub, slide), formulas whose symbols are colour-linked to the picture and whose derivations unfold step by step, and worked examples plus practice problems with hints and full solutions. No accounts, no trackers, works offline, progress stays on your device.

## Status

Early preview. The design system, curriculum and first kit components are live; the first three lessons (*Eigenvectors*, *The derivative as slope and as rate*, *Gradient descent*) are being written. See [`PROGRESS.md`](PROGRESS.md) for every lesson's status and [`LOG.md`](LOG.md) for session notes.

- **Curriculum:** 272 lessons across 16 subjects (+ a later-expansion list), with cross-subject prerequisites — [`src/content/curriculum.ts`](src/content/curriculum.ts)
- **Component kit:** [`src/kit/`](src/kit/) — design system ([`DESIGN.md`](src/kit/DESIGN.md), [`NOTATION.md`](src/kit/NOTATION.md)), API ([`README.md`](src/kit/README.md)), live gallery at [`/kit`](https://linusip.github.io/coolstuff/kit/)

## Subjects

Calculus I · Calculus II · Calculus III · Differential equations · Linear algebra · Probability and statistics · Discrete math · Data structures and algorithms · System design · Computer systems · Machine learning · Deep learning · Diffusion models · Large language models · Physics 1: mechanics · Physics 2: electricity and magnetism · *Beyond (later expansion)*

## Develop

```sh
npm ci
npm run dev                         # http://localhost:5173
npm run typecheck && npm run lint && npm run test && npm run build && npm run smoke
npm run new -- linalg svd           # scaffold a lesson from the curriculum
npm run progress:sync               # regenerate PROGRESS.md
```

Stack: Vite + TypeScript (strict) + Preact, KaTeX, vanilla SVG/canvas visuals; Vitest for maths and problem solutions; Playwright smoke tests at desktop, phone and dark/reduced-motion sizes. Deployed to GitHub Pages from `main` by `.github/workflows/pages.yml`.

The earlier "lab showcase" (the Flipline game, the Ma blog theme and the Physarum simulation) is preserved on the [`archive/lab`](https://github.com/LinusIp/coolstuff/tree/archive/lab) branch.
