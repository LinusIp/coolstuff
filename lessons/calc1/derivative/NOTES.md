# The derivative as slope and as rate

<!-- Plan in five lines before writing any code (CLAUDE.md §8, step 3). -->

1. **Takeaway (one sentence):** the derivative $f'(x)$ is the number the secant slope $\frac{f(x+h)-f(x)}{h}$ settles on as $h \to 0$: on the graph, the slope of the tangent line; in the world, the instantaneous rate of change, measured in output units per input unit (a speedometer reading in m/s).
2. **Central interactive:** a car's position–time graph in stop-and-go traffic, $s(t) = 4t - \tfrac{12}{\pi}\sin\tfrac{\pi t}{3}$ m over 12 s; drag the ring P to the moment $t$, shrink $h$ on a log slider (2 s → 0.001 s): the secant through P and Q (with its run $h$ and rise $\Delta s$) swings onto the tangent band, the car and its ghost on a road that shares the graph's vertical scale close up, and the speedometer's rose "average over the next $h$" pointer closes in on the needle until everything turns green (within 0.01 m/s); ▶ Drive runs the trip in real time.
3. **Concept colours:** `input` blue solid ($x$; the moment $t$) · `output` orange dashed ($f(x)$, the change $f(x+h)-f(x)$; position $s$, distance $\Delta s$) · `rate` rose double rule (every slope: secant, tangent, speedometer, $f'$) · `h` teal dotted (the step $h = \Delta x$). The graph itself is ink; green only for "found".
4. **Key formula(s):** $f'(x) = \lim_{h\to 0} \frac{f(x+h)-f(x)}{h}$ (with explain-this and live values from a figure); tangent line $y = f(a) + f'(a)(x-a)$; Leibniz $\frac{dy}{dx}$ read as "output units per input unit"; derivation of $\frac{d}{dx}x^2 = 2x$ from first principles.
5. **Exam-level problem the learner can solve at the end:** a tank drains so the depth is $d(t) = \frac{8}{t+2}$ m ($t$ in minutes). Using only the limit definition, find $d'(t)$; find the rate at $t = 2$ with units and explain its sign ($-0.5$ m/min); write the tangent line there and use it to estimate $d(2.5)$ (1.75 m vs the true 1.78 m). (The ★★★ practice also asks for a one-sided-limit argument that a corner is not differentiable.)

Scaffolded by `npm run new` on 2026-10-23 as `calc1/derivative` (status `wip`: shown as "coming soon" until shipped).

## Checklist (CLAUDE.md §4, §5, §11)

- [x] `math.ts` + tests: the pure functions behind the visuals (car trip, secants, tangents, display helpers)
- [ ] `problems.ts`: `C`, `TLDR`, `FORMULAS` (+ explain notes), `DERIVATIONS`, ≥ 3 `EXAMPLES` (★ direct, ★★ combined with `uses`, ★★★ exam), ≥ 8 `PROBLEMS` (3 ★, 3 ★★, 2 ★★★, mixed kinds, generators where it makes sense), 4–6 `QUIZ`, 2–4 `TRAPS`, ≥ 2 `REFERENCES`, `SNIPPETS`, `GLOSSARY`
- [ ] `lesson.test.ts`: the audits pass, every stated answer recomputed independently, the snippet runs
- [ ] `figures.tsx`: a renderer for every `figure` key (no side effects)
- [ ] `lesson.tsx`: every `<Wip>` replaced by the kit component it names, then `Wip` deleted
- [ ] Phone (390×844) and desktop, light and dark; keyboard; reduced motion
- [ ] `npm run smoke -- --only=calc1/derivative` and `--thumbs=calc1/derivative`; `meta.json` `summary`; status `shipped`

## Design choices

- **One picture, both readings.** The brief asks for slope (secant → tangent) *and* rate (a speedometer agreeing with the slope, with units). Rather than two figures, the central interactive is a position–time graph, so the slope of the curve *is* a speed: rise in metres over run in seconds gives m/s, and the speedometer beside the graph shows the same number the tangent's slope has.
- **Why stop-and-go traffic.** $s'(t) = 4 - 4\cos(\pi t/3) \ge 0$, so the car never reverses (speed = velocity; no sign confusion in the Play section), it starts from rest, peaks at 8 m/s at 3 s and 9 s and stands still for an instant at 6 s (the flat point the second goal asks for). Speeds at whole seconds are round (2, 6, 8, 6, 2, 0 m/s), and each 6-second cycle averages exactly 4 m/s while the speedometer swings 0 → 8 → 0: the trap "average rate = instantaneous rate" in one glance.
- **The road shares the graph's vertical scale.** It sits along the graph's right edge, so the gap between the car and its ghost (h seconds later) is literally the same length as the triangle's rise $\Delta s$, joined by dotted guides. Position on the graph and position on the road are one thing.
- **Log slider for $h$** (2 → 0.001 s, detents at each decade, `scale: 'log'`): equal track distance per decade, so 1, 0.1, 0.01, 0.001 are evenly spaced and $h$ never reaches 0. Readouts show more decimals as $h$ shrinks (`settledDecimals`) so digits visibly settle from the left.
- **Match = within 0.01 m/s, not "equal to 2 d.p."**: two readings 0.0002 apart can round differently forever when the speedometer sits on a rounding boundary; the test checks the smallest $h$ reaches the tolerance at every moment of the trip.
- **The tangent is drawn as the target band** (DESIGN.md §5 "the answer is earned"): the learner hunts for it by shrinking $h$; on a match the secant, band and the gauge pointer turn green together.
- **Tried and dropped (for Play):** a separate horizontal road strip above the graph (needed a mental rotation and lost the "same length as the rise" link); the gauge inside the graph's empty corner (the extended secant crosses it); a draggable Q (it collides with P at small $h$ and can't reach 0.001 s; the slider can). A magnifying lens that keeps the triangle a fixed size while zooming ×10, ×100, ×1000 is planned for Build step 4 ("zoom until the curve looks straight").

## Lesson arc (plan)

- **Hook:** "Your speedometer reads 6 m/s. In zero seconds you cover zero metres. So what is it measuring?" + `Predict`: guess the slope of $y = x^2$ at $x = 1$ by tilting a line through $(1, 1)$, lock in, reveal by shrinking $h$ (3, 2.1, 2.01, 2.001 → 2).
- **Build:** (1) average rate = rise ÷ run over an interval (car: two moments); (2) shrink the interval: table of $h$ and slopes for $x^2$ at 1, from both sides; (3) the limit, and why $h = 0$ itself is $0/0$; (4) zoom lens: up close the curve looks straight, and that straight line is the tangent; (5) derivative as a function: drag $x$, the slope is traced as a point on a second graph, sketch $f'$ from $f$.
- **Formalize:** the limit definition with explain-this and live values from the step-2 figure; Derivation of $\frac{d}{dx}x^2 = 2x$ (the $h$ cancels before the limit); tangent-line formula; Leibniz notation and units.
- **Examples:** ★ $f(x) = 3x^2 - 5x$ from the definition at a live $a$; ★★ (uses `calc1/limits`) $\sqrt{x}$ or $\frac{1}{x}$ by rationalizing / common denominator; ★★★ the draining tank above.
- **Traps:** "the derivative is $f(x+h) - f(x)$" (forgot to divide by $h$: units come out wrong), "a sharp corner has slope 0" ($|x|$: one-sided slopes −1 and 1), "average rate = instantaneous rate" (the traffic cycle), "just set $h = 0$" ($0/0$; cancel first).

## Simulation

No numerical integration: positions and speeds are closed-form ($s$ and $s'$ exact). ▶ Drive advances $t$ in real time (1 trip-second per second, frame time capped at 0.1 s); under reduced motion it jumps 0.5 s twice a second; it pauses when the figure scrolls off-screen.

## Sources

To be listed in `REFERENCES` (explanations, figures and problems are our own):

- J. Stewart, D. Clegg, S. Watson, *Calculus: Early Transcendentals*, 9th ed., Cengage, 2020: §2.7 "Derivatives and Rates of Change", §2.8 "The Derivative as a Function".
- G. Strang, E. Herman, *Calculus Volume 1*, OpenStax, 2016: §3.1 "Defining the Derivative", §3.2 "The Derivative as a Function", §3.4 "Derivatives as Rates of Change".
- M. Spivak, *Calculus*, 4th ed., Publish or Perish, 2008: Chapter 9, "Derivatives" (the careful limit definition and non-differentiable examples).

## Simplifications

- The car is a point moving along a straight road; "speed" on the dashboard equals velocity here because the car never reverses (say so in Build step 1 with `Callout kind="simplify"`).
- The Play figure calls a match "within 0.01 m/s"; the secant never *equals* the tangent for $h \ne 0$ (the status line says "all but become").

## Simulation

wip, or delete: integrator (e.g. symplectic Euler, RK4) and timestep for any simulation.

## Files beyond the template

- `play.tsx`: the central interactive (page-level signals; only lesson.tsx imports it).
- `lesson.css`: layout for the graph + speedometer plate (the kit's `Figure` has no two-panel layout), road/car/gauge styling; tokens only.
