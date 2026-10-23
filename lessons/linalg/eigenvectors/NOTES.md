# Eigenvectors and eigenvalues

<!-- Plan in five lines before writing any code (CLAUDE.md §8, step 3). -->

1. **Takeaway (one sentence):** A matrix knocks almost every arrow off its own line; the few directions it only stretches (by a factor $\lambda$, which may be negative or zero) are its eigenvectors, and $\det(A - \lambda I) = 0$ finds them without dragging.
2. **Central interactive:** *Hunt for the arrows that survive* (`play.tsx`): drag $\vec v$, watch $A\vec v$; a dotted line extends $\vec v$ and an arc shows how far $A$ turns that line; on a kept direction the arrow, handle and line turn green, the readout says "not turned: stretched ×3", and the direction stays pinned as a rose band. A trail under the plane plots the turn of every direction swept so far, so its zeros *are* the eigen-directions: two crossings (Stretch), one touch (Shear: defective), none (Turn: complex), a flip (Flip: $\lambda = -1$). Preceded by the Hook's Predict (`hook.tsx`): guess the two kept directions of $A = \begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}$ by dragging two arrows on MatrixGrid's transformed plane, lock in, see the rose lines and your arrows' images.
3. **Concept colours:** `input` blue $\vec v$ (solid) · `output` orange $A\vec v$ (dashed) · `matrix` teal $A$ (dotted; the transformed grid) · `eigenvalue` rose $\lambda$ (double rule; the kept-direction bands, the ×λ marks on the trail). Green only as the earned "found" state. The turn arc, guide lines and trail are ink.
4. **Key formula(s):** $A\vec v = \lambda\vec v,\ \vec v \ne \zerovec$ → $(A - \lambda I)\vec v = \zerovec$ has a nonzero solution → $\det(A - \lambda I) = 0$; for $2 \times 2$: $\lambda^2 - (\tr A)\lambda + \det A = 0$; eigenvectors = null space of $A - \lambda I$; $A^n\vec v = \lambda^n\vec v$.
5. **Exam-level problem the learner can solve at the end:** For $A = \begin{bmatrix} 5 & -2 \\ 1 & 2 \end{bmatrix}$, find every eigenpair ($\lambda = 4$, $(2, 1)$; $\lambda = 3$, $(1, 1)$), write $(3, 2)$ in the eigenbasis, and compute $A^{10}(3, 2) = 4^{10}(2, 1) + 3^{10}(1, 1)$ without multiplying matrices; say which line $A^n\vec v$ approaches and why. (Plus: a $3 \times 3$ triangular matrix and the defective shear in the problem set.)

Scaffolded by `npm run new` on 2026-10-23 as `linalg/eigenvectors` (status `wip`: shown as "coming soon" until shipped).

## Checklist (CLAUDE.md §4, §5, §11)

- [ ] `math.ts` + tests: the pure functions behind the visuals
- [ ] `problems.ts`: `C`, `TLDR`, `FORMULAS` (+ explain notes), `DERIVATIONS`, ≥ 3 `EXAMPLES` (★ direct, ★★ combined with `uses`, ★★★ exam), ≥ 8 `PROBLEMS` (3 ★, 3 ★★, 2 ★★★, mixed kinds, generators where it makes sense), 4–6 `QUIZ`, 2–4 `TRAPS`, ≥ 2 `REFERENCES`, `SNIPPETS`, `GLOSSARY`
- [ ] `lesson.test.ts`: the audits pass, every stated answer recomputed independently, the snippet runs
- [ ] `figures.tsx`: a renderer for every `figure` key (no side effects)
- [ ] `lesson.tsx`: every `<Wip>` replaced by the kit component it names, then `Wip` deleted
- [ ] Phone (390×844) and desktop, light and dark; keyboard; reduced motion
- [ ] `npm run smoke -- --only=linalg/eigenvectors` and `--thumbs=linalg/eigenvectors`; `meta.json` `summary`; status `shipped`

## Design choices

- **Turn of the line, not of the arrow.** "Not turned" means $A\vec v$ stays on $\vec v$'s line, either way along it, so the arc and the trail measure the angle between the *lines* through $\vec v$ and $A\vec v$, in $(-90°, 90°]$ (`turnDeg`). An arrow sent backwards ($\lambda < 0$) reads 0 and is found; the arc then goes to the dotted backward extension of $A\vec v$. $A\vec v = \zerovec$ ($\lambda = 0$) also counts.
- **What the learner drags first:** the blue arrow in Play; in the Hook, two guess arrows. Free drag (not a circle): it shows the whole line is kept, and keyboard steps of 0.1 land on clean numbers like $(1, 1) \mapsto (3, 3)$. A soft wall (`fitArrow`) shortens $\vec v$ so $\vec v$ and $A\vec v$ both stay on the plate (along a ×3 direction the arrow can only be a third as long), and keeps it at least 0.55 long so it always has a direction. The 3° magnet (Handle `snapDirections`) makes the found state click.
- **The trail.** A strip of turn vs direction that fills in only where the learner has swept (2° bins, gaps filled the short way round). It is the proof for "none" (Turn: flat at 90°) and "only one" (Shear: touches 0 and bounces back, the double root), and it previews "roots of an equation" before $\det(A - \lambda I)$ appears. Its handle rides the curve and turns $\vec v$ (linked both ways).
- **Mission across presets** (Stretch: both; Shear: every one, with a sweep; Turn: one if any, done by sweeping), so the three cases two / one / none are each met by hand. Flip is free play ($\lambda = -1$).
- **Tried and dropped:** the transformed grid in Play (it competed with the dotted line; kept in the Hook, where it is the information to guess from) · $\vec v$ on the unit circle with $A$(circle) as an ellipse (the ellipse's axes are singular vectors, not eigenvectors, for non-symmetric $A$: it would mislead) · showing the whole turn curve from the start (gives the answer away) · always labelling the arc (collided with the handle ring on phones; now labelled only when the shorter arrow is > 120px) · the kit's axis names on the trail (they sit on the zero line, exactly where the found marks go; replaced by labels in the margins beyond ±90°, where no turn can reach).

## Sources

- G. Strang, *Introduction to Linear Algebra*, 5th ed., Wellesley-Cambridge Press, 2016, Chapter 6 (Eigenvalues and Eigenvectors), §6.1–6.2.
- S. Axler, *Linear Algebra Done Right*, 3rd ed., Springer, 2015, Chapter 5 (Eigenvalues, Eigenvectors, and Invariant Subspaces).
- D. C. Lay, S. R. Lay, J. J. McDonald, *Linear Algebra and Its Applications*, 5th ed., Pearson, 2016, Chapter 5 (Eigenvalues and Eigenvectors).
- Idea credit: "vectors that stay on their own span" as the visual definition is the standard geometric picture, popularised by 3Blue1Brown, *Essence of Linear Algebra*, chapter 14 (video, 2016). The turn-vs-direction trail, the presets and all prose and problems are our own.

## Simplifications

- Figures are real $2 \times 2$ matrices acting on the plane. Complex eigenvalues (Turn: $\pm i$) are named in words only; the lesson says "no *real* eigen-directions".
- The trail samples directions every 2° (bins) and draws the exact curve inside explored bins; "swept all the way round" means ≥ 90% of bins.

## Simulation

No time integration. The "simulate it" cell (planned) is power iteration, $\vec v_{k+1} = A\vec v_k / \norm{A\vec v_k}$, exact arithmetic per step (`powerIterates`, tested to converge at the rate $|\lambda_2/\lambda_1|$).

## Libraries

Nothing beyond the kit.

## Kit gaps met (worked around in this folder; reported to the kit lead)

- `MatrixGrid` vectors have no `correct` (found) state, no `constrain`, and the grid takes no extra children, so Play composes Stage2D primitives itself (`play.tsx`) and the Hook keeps its guesses on the plate with a constraining signal lens (`hook.tsx`).
- No public "lens" helper: a writable signal derived from another (`curveLens` in play.tsx, `constrained` in hook.tsx) is hand-rolled, duck-typed like MatrixGrid's private `columnLens`.
- Stage2D axis names sit on the axis line at fixed spots, with no way to move them; the trail draws its own names with `Label`.
- Labels don't avoid each other: in the Hook's reveal, $A\vec a$ and $A\vec b$ can overlap when both guesses point near the same direction.
