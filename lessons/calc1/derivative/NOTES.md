# The derivative as slope and as rate

<!-- Plan in five lines before writing any code (CLAUDE.md §8, step 3). -->

1. **Takeaway (one sentence):** wip
2. **Central interactive:** wip (curriculum suggestion: secant → tangent with h slider)
3. **Concept colours:** wip (3–5 names on `input`, `output`, `error`, `prob` or the free inks `teal`, `rose`, `gold`; see src/kit/DESIGN.md §4)
4. **Key formula(s):** wip
5. **Exam-level problem the learner can solve at the end:** wip

Scaffolded by `npm run new` on 2026-10-23 as `calc1/derivative` (status `wip`: shown as "coming soon" until shipped).

## Checklist (CLAUDE.md §4, §5, §11)

- [ ] `math.ts` + tests: the pure functions behind the visuals
- [ ] `problems.ts`: `C`, `TLDR`, `FORMULAS` (+ explain notes), `DERIVATIONS`, ≥ 3 `EXAMPLES` (★ direct, ★★ combined with `uses`, ★★★ exam), ≥ 8 `PROBLEMS` (3 ★, 3 ★★, 2 ★★★, mixed kinds, generators where it makes sense), 4–6 `QUIZ`, 2–4 `TRAPS`, ≥ 2 `REFERENCES`, `SNIPPETS`, `GLOSSARY`
- [ ] `lesson.test.ts`: the audits pass, every stated answer recomputed independently, the snippet runs
- [ ] `figures.tsx`: a renderer for every `figure` key (no side effects)
- [ ] `lesson.tsx`: every `<Wip>` replaced by the kit component it names, then `Wip` deleted
- [ ] Phone (390×844) and desktop, light and dark; keyboard; reduced motion
- [ ] `npm run smoke -- --only=calc1/derivative` and `--thumbs=calc1/derivative`; `meta.json` `summary`; status `shipped`

## Design choices

wip: why this visual metaphor; what the learner drags first; what was tried and dropped.

## Sources

wip: at least two standard references (textbook sections, papers, lecture notes), also listed in `REFERENCES`. Explanations and problems are our own.

## Simplifications

wip: anything the lesson simplifies, and where the lesson says so (`Callout kind="simplify"`).

## Simulation

wip, or delete: integrator (e.g. symplectic Euler, RK4) and timestep for any simulation.

## Libraries

wip, or delete: a one-line justification for anything heavier than 100 KB gzipped.
