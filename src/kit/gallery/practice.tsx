/**
 * Gallery section for G3 (Practice): every practice component in the states
 * worth seeing, with the reference specs in ./samples.ts plus a few more
 * below (a matrix, complex numbers, + C, multi-select with reasoning, match,
 * slider and custom drags, a live example with an accept() guard, and two
 * "lessons" that both define a `rate` concept for the mixed practice set).
 *
 * Some demos are *scripted*: after mounting, they drive the real UI (type,
 * pick, Check, open a hint) so the page shows wrong / right / hinted /
 * revealed states without any test-only props. Their progress lives under
 * `kit/demo-s-*` lesson ids, cleared on each load so the states are stable;
 * the other demos keep their progress, so the dot strip survives a reload.
 */
import { computed, signal, useSignal, type Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { KitProvider } from '../core/context';
import { checkAnswer } from '../core/answers';
import type { ExamResponse } from '../core/exam';
import { defineFigures, type PracticeEntry, type ProblemCustom } from '../core/figures';
import { defineExample } from '../core/problems';
import { getProgress } from '../core/progress';
import { texNum } from '../core/pretty';
import { apply2, type Mat2, type Vec2 } from '../math';
import { ExamSet, Predict, Problem, ProblemSet, Quiz, WorkedExample, WorkedExampleSet } from '../practice';
import { defineConcepts } from '../theme';
import type { ParamValues, PredictSpec, ProblemSpec, Verdict } from '../types';
import { Curve, Handle, Line, Point, Stage2D, Vector } from '../visual';
import { DEMO, EXAMPLES, PREDICTS, PROBLEMS, QUIZ } from './samples';
import type { GalleryDemo, GalleryGroup } from './types';
import { useSyncSignalEffect } from '../practice/hooks';

// ── Scripted demos: drive the real UI after mount ──────────────────────────

let cleared = false;
/** Forget the scripted demos' progress once per page load, so their states don't accumulate. */
function clearScriptedProgress(): void {
  if (cleared || typeof window === 'undefined') return;
  cleared = true;
  const store = getProgress();
  const d = store.read();
  const lessons = Object.fromEntries(Object.entries(d.lessons).filter(([k]) => !k.startsWith('kit/demo-s-')));
  if (Object.keys(lessons).length !== Object.keys(d.lessons).length) store.import(JSON.stringify({ ...d, lessons }));
}

const wait = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));
const q = <T extends Element = HTMLElement>(root: Element, sel: string, k = 0): T | null => (root.querySelectorAll<T>(sel)[k] as T | undefined) ?? null;
function typeInto(el: HTMLInputElement | HTMLTextAreaElement | null, text: string) {
  if (!el) return;
  el.value = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function choose(el: HTMLSelectElement | null, value: string) {
  if (!el) return;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
const press = (el: Element | null) => (el as HTMLElement | null)?.click();

/** Runs `script` against the real DOM once mounted; puts the scroll position and focus back afterwards. */
function Scripted({ script, children }: { script: (root: HTMLElement) => Promise<void> | void; children: ComponentChildren }) {
  clearScriptedProgress();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const x = window.scrollX;
    const y = window.scrollY;
    void (async () => {
      await wait(30);
      await script(el);
      await wait(30);
      if (el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      window.scrollTo(x, y);
    })();
  }, []);
  return (
    <div ref={ref} class="gallery-scripted">
      {children}
    </div>
  );
}

const STATE = { fontFamily: 'var(--font-mono)', fontSize: '13.5px', marginTop: 'var(--sp-3)', overflowWrap: 'anywhere' } as const;

// ── Extra specs (beyond samples.ts) ────────────────────────────────────────

const REFLECT: ProblemSpec = {
  id: 'reflect-matrix',
  difficulty: 2,
  title: 'Reflection matrix',
  prompt: 'Write the matrix $R$ that reflects the plane across the line $y = x$ (it swaps the two coordinates).',
  answer: { kind: 'numeric', value: [0, 1, 1, 0], shape: [2, 2], precision: 'exact', label: 'R =' },
  hints: ['Where does the reflection send $\\ihat = (1, 0)$?', 'The columns of $R$ are the images of $\\ihat$ and $\\jhat$.', '$R\\ihat = (0, 1)$, so the first column is $(0, 1)$.'],
  solution: {
    steps: [
      { math: 'R\\ihat = (0, 1),\\ R\\jhat = (1, 0)', why: 'Reflecting across $y = x$ swaps the axes.' },
      { math: 'R = \\begin{bmatrix} 0 & 1 \\\\ 1 & 0 \\end{bmatrix}', why: 'The images of the basis vectors are the columns.' },
    ],
    answer: '$R = \\begin{bmatrix} 0 & 1 \\\\ 1 & 0 \\end{bmatrix}$',
    check: '$R(2, 5) = (5, 2)$: the coordinates swap.',
  },
  commonWrong: [{ answer: [1, 0, 0, 1], why: 'That is the identity: it leaves every vector where it is.' }],
};

const COMPLEX: ProblemSpec = {
  id: 'complex-eigs',
  difficulty: 3,
  title: 'Complex eigenvalues',
  prompt: 'Find both eigenvalues of $M = \\begin{bmatrix} 1 & -2 \\\\ 2 & 1 \\end{bmatrix}$.',
  answer: { kind: 'numeric', value: [1, 2, 1, -2], complex: true, ordered: false, precision: 'exact', label: '\\lambda =' },
  hints: ['A real matrix can have complex eigenvalues; they come in conjugate pairs.', 'Solve $\\det(M - \\lambda I) = 0$.', '$\\det(M - \\lambda I) = (1 - \\lambda)^2 + 4$.'],
  solution: {
    steps: [
      { math: '\\det(M - \\lambda I) = (1-\\lambda)^2 + 4 = 0', why: '$ad - bc$ with $bc = -4$.' },
      { math: '1 - \\lambda = \\pm 2i \\implies \\lambda = 1 \\mp 2i', why: 'A square equals $-4$ exactly when the thing squared is $\\pm 2i$.' },
    ],
    answer: '$\\lambda = 1 \\pm 2i$',
    check: 'Sum $2 = \\tr M$; product $1 + 4 = 5 = \\det M$.',
  },
  commonWrong: [{ answer: '1 ± 2', why: 'The square is $-4$, not $4$: no real number works, so the $\\pm 2$ must be $\\pm 2i$.' }],
};

const ANTI: ProblemSpec = {
  id: 'antiderivative',
  difficulty: 1,
  title: 'An antiderivative',
  prompt: 'Find an antiderivative: $\\displaystyle\\int 3x^2\\,dx$.',
  answer: { kind: 'symbolic', expr: 'x^3', vars: ['x'], upToConstant: true, label: '\\int 3x^2\\,dx =' },
  hints: ['Which function has derivative $3x^2$?', 'Undo the power rule: raise the power by one, then divide by the new power.', '$x^2 \\to \\tfrac{x^3}{3}$, and the 3 in front cancels the $\\tfrac13$.'],
  solution: {
    steps: [{ math: '\\int 3x^2\\,dx = 3\\cdot\\frac{x^3}{3} + C = x^3 + C', why: 'The power rule run backwards, with $n = 2$.' }],
    answer: '$x^3 + C$',
    check: '$\\frac{d}{dx}(x^3 + C) = 3x^2$.',
  },
  commonWrong: [{ answer: '3x^3', why: 'Differentiate it: $9x^2$, three times too big. Dividing by the new power cancels the 3.' }],
};

const MULTI: ProblemSpec = {
  id: 'which-have-2',
  difficulty: 2,
  title: 'Which have eigenvalue 2?',
  prompt: 'Which of these matrices have $2$ as an eigenvalue? Choose every one that does, and say why in a line.',
  answer: {
    kind: 'choice',
    options: [
      { text: '$\\begin{bmatrix} 2 & 7 \\\\ 0 & 3 \\end{bmatrix}$', why: 'Triangular: its eigenvalues are its diagonal entries, 2 and 3.' },
      { text: '$\\begin{bmatrix} 1 & 1 \\\\ 1 & 1 \\end{bmatrix}$', why: 'Trace 2 and determinant 0, so the eigenvalues are 0 and 2.' },
      { text: '$\\begin{bmatrix} 3 & 0 \\\\ 0 & 4 \\end{bmatrix}$', why: 'Diagonal: the eigenvalues are 3 and 4.' },
      { text: '$\\begin{bmatrix} 0 & 2 \\\\ 2 & 0 \\end{bmatrix}$', why: '$\\lambda^2 - 4 = 0$, so $\\lambda = \\pm 2$.' },
    ],
    correct: [0, 1, 3],
    shuffle: true,
    askReason: true,
    reasoning: 'Test each with $\\det(A - 2I) = 0$: the first, second and fourth make $A - 2I$ singular.',
  },
  hints: ['$2$ is an eigenvalue exactly when $A - 2I$ is singular.', 'Compute $\\det(A - 2I)$ for each matrix.', 'For the triangular one, read the diagonal.'],
  solution: {
    steps: [
      { text: 'Triangular and diagonal matrices show their eigenvalues on the diagonal: the first has 2, the third doesn’t.', why: '$\\det(A - \\lambda I)$ is the product of the diagonal entries minus $\\lambda$.' },
      { math: '\\det\\begin{bmatrix} -1 & 1 \\\\ 1 & -1 \\end{bmatrix} = 0,\\ \\det\\begin{bmatrix} -2 & 2 \\\\ 2 & -2 \\end{bmatrix} = 0', why: 'For the second and fourth, $A - 2I$ is singular.' },
    ],
    answer: 'The first, second and fourth.',
  },
  commonWrong: [{ answer: 2, why: 'Neither diagonal entry of $\\diag(3, 4)$ is 2, and a diagonal matrix’s eigenvalues are its diagonal entries.' }],
};

const MATCH: ProblemSpec = {
  id: 'match-transform',
  difficulty: 2,
  title: 'What each matrix does',
  prompt: 'Match each matrix to what it does to the plane.',
  answer: {
    kind: 'drag',
    target: {
      mode: 'match',
      items: ['$\\begin{bmatrix} 2 & 0 \\\\ 0 & 2 \\end{bmatrix}$', '$\\begin{bmatrix} 0 & -1 \\\\ 1 & 0 \\end{bmatrix}$', '$\\begin{bmatrix} 1 & 0 \\\\ 0 & -1 \\end{bmatrix}$', '$\\begin{bmatrix} 1 & 1 \\\\ 0 & 1 \\end{bmatrix}$'],
      slots: ['flips across the x-axis', 'doubles every length', 'shears sideways', 'turns a quarter turn'],
      correct: [1, 3, 0, 2],
    },
  },
  hints: ['Apply each matrix to $\\ihat$ and $\\jhat$.', 'The columns are where $\\ihat$ and $\\jhat$ land.', 'The first sends $\\ihat \\to (2, 0)$ and $\\jhat \\to (0, 2)$.'],
  solution: {
    steps: [
      { text: '$2I$ doubles both axes; the second sends $\\ihat \\to \\jhat$ and $\\jhat \\to -\\ihat$, a quarter turn.', why: 'Read the columns.' },
      { text: 'The third negates $y$ only (a flip across the $x$-axis); the fourth adds $y$ to $x$ (a shear).', why: 'Read the columns.' },
    ],
    answer: 'Doubles · quarter turn · flip · shear.',
  },
  commonWrong: [{ answer: '[1, 3, 2, 0]', why: 'The third matrix keeps $x$ and negates $y$: a flip. A shear adds a multiple of one coordinate to the other, like the fourth.' }],
};

const SLIDE: ProblemSpec = {
  id: 'secant-h',
  difficulty: 1,
  title: 'Shrink h',
  prompt: 'For $f(x) = x^2$ at $x_0 = 1$ the secant slope is $\\dfrac{f(1 + h) - f(1)}{h} = 2 + h$. Set $h$ so the secant slope is within $0.1$ of the tangent slope, $2$.',
  answer: { kind: 'drag', target: { mode: 'slider', label: '$h$', min: 0.05, max: 1.5, step: 0.05, start: 1, answer: 0.05, tolerance: 0.05 } },
  hints: ['The secant slope is $2 + h$: how far is that from 2?', 'You need $|h| \\le 0.1$.', 'Slide $h$ down to $0.1$ or less.'],
  solution: { steps: [{ math: '|(2 + h) - 2| = |h| \\le 0.1', why: 'The gap between secant and tangent slopes is exactly $h$ here.' }], answer: '$h = 0.05$ or $0.1$' },
  commonWrong: [{ answer: 0.5, why: '$h = 0.5$ gives a secant slope of $2.5$, still $0.5$ away. Keep shrinking.' }],
};

const A_MAT: Mat2 = [2, 1, 1, 2];
const angleDeg = (v: Vec2) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
const isEigenDir = (s: unknown): boolean => {
  if (!Array.isArray(s) || s.length !== 2) return false;
  const a = (((angleDeg(s as Vec2) % 180) + 180) % 180);
  return Math.min(Math.abs(a - 45), Math.abs(a - 135)) < 4;
};
const EIGDIR: ProblemSpec = {
  id: 'eigen-direction',
  difficulty: 2,
  title: 'Find a direction A keeps',
  figure: 'eigen-dir',
  prompt: 'Turn the blue arrow $\\cInput$ until its image $\\cOutput$ lies along it, for $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$.',
  answer: {
    kind: 'drag',
    target: {
      mode: 'custom',
      initial: [1, 0],
      check: isEigenDir,
      describe: (s) => (Array.isArray(s) ? `v points at ${Math.round(angleDeg(s as Vec2))}°${isEigenDir(s) ? ', along one of A’s kept lines' : ''}` : ''),
    },
  },
  hints: ['Watch $A\\vec v$: which way is it turned from $\\vec v$?', 'Turn $\\vec v$ towards $A\\vec v$ until they line up.', 'Try the diagonal: $A(1, 1) = (3, 3)$.'],
  solution: {
    steps: [
      { math: 'A(1, 1) = (3, 3) = 3\\,(1, 1)', why: 'On the diagonal $A$ only stretches.' },
      { math: 'A(1, -1) = (1, -1)', why: 'The other diagonal is kept too (stretched by 1).' },
    ],
    answer: 'Along $y = x$ or $y = -x$ (either way round).',
  },
  commonWrong: [{ answer: '[0, 1]', why: '$A(0, 1) = (1, 2)$: turned towards $(1, 1)$, so $(0, 1)$ isn’t kept.' }],
};

/** The custom renderer for EIGDIR: a handle on the unit circle, v and Av. */
const EigenDirFigure: ProblemCustom = (state) => {
  const v = state as Signal<Vec2>;
  const Av = computed(() => apply2(A_MAT, v.value));
  const kept = computed(() => isEigenDir(v.value));
  return (
    <div class="plate problem__plate">
      <Stage2D view={{ x: [-3.4, 3.4], y: [-3.4, 3.4] }} title="v on the unit circle and its image Av" aspect={{ desktop: 0.7, phone: 0.95 }} hint="turn the arrow">
        <Vector to={Av} concept="output" label="$\cOutput$" />
        <Vector to={v} concept="input" label="$\cInput$" labelGap={22} correct={kept} />
        <Handle value={v} label="the arrow v" symbol="v" concept="input" constrain={{ circle: { c: [0, 0], r: 1 } }} snapDirections={[[1, 1], [-1, -1], [1, -1], [-1, 1]]} correct={kept} />
      </Stage2D>
    </div>
  );
};

const FIGS = defineFigures({ customs: { 'eigen-dir': EigenDirFigure } });

// A worked example with a choice parameter, an accept() guard and its own figure.
const FNS = [
  { tex: 'x^2', f: (x: number) => x * x, df: (x: number) => 2 * x },
  { tex: 'x^3', f: (x: number) => x ** 3, df: (x: number) => 3 * x * x },
  { tex: '\\sqrt{x}', f: (x: number) => Math.sqrt(x), df: (x: number) => 0.5 / Math.sqrt(x) },
] as const;
const tn = (x: number) => texNum(Math.round(x * 1000) / 1000);
const SECANT = defineExample<{ f: number; x0: number; h: number }>({
  id: 'secant-live',
  level: 'combined',
  title: 'Secant slopes, live',
  params: {
    f: { kind: 'choice', label: '$f(x)$', options: ['$x^2$', '$x^3$', '$\\sqrt{x}$'], value: 0, concept: 'output' },
    x0: { label: '$x_0$', min: -2, max: 2, step: 0.25, value: 1, concept: 'input' },
    h: { label: '$h$', min: -1, max: 1, step: 0.05, value: 0.5, concept: 'eigenvalue' },
  },
  accept: (p) => (p.h === 0 ? '$h$ can’t be 0: the difference quotient would divide by zero.' : p.f === 2 && (p.x0 <= 0 || p.x0 + p.h < 0) ? '$\\sqrt{x}$ needs $x_0 > 0$ and $x_0 + h \\ge 0$.' : true),
  statement: (p) => `Find the slope of the secant to $f(x) = ${FNS[p.f].tex}$ through $x_0 = ${tn(p.x0)}$ and $x_0 + h = ${tn(p.x0 + p.h)}$.`,
  known: (p) => [`$f(x) = ${FNS[p.f].tex}$`, `$x_0 = ${tn(p.x0)}$, $h = ${tn(p.h)}$`],
  want: 'The secant slope $\\dfrac{f(x_0 + h) - f(x_0)}{h}$.',
  strategy: 'Evaluate $f$ at both points, then divide the rise by the run.',
  steps: (p) => {
    const F = FNS[p.f];
    const a = F.f(p.x0);
    const b = F.f(p.x0 + p.h);
    return [
      { title: 'Both heights', math: `f(${tn(p.x0)}) = ${tn(a)},\\ f(${tn(p.x0 + p.h)}) = ${tn(b)}`, why: 'Substitute into $f$.' },
      { title: 'Rise over run', math: `\\frac{${tn(b)} - ${tn(a)}}{${tn(p.h)}} = ${tn((b - a) / p.h)}`, why: 'Slope is rise over run.', tryIt: 'Divide the change in height by $h$.' },
    ];
  },
  answer: (p) => `$\\text{slope} \\approx ${tn((FNS[p.f].f(p.x0 + p.h) - FNS[p.f].f(p.x0)) / p.h)}$`,
  value: (p) => (FNS[p.f].f(p.x0 + p.h) - FNS[p.f].f(p.x0)) / p.h,
  sanity: (p) => `As $h \\to 0$ it approaches the tangent slope $f'(${tn(p.x0)}) = ${tn(FNS[p.f].df(p.x0))}$; shrink $h$ to watch.`,
  figure: 'secant',
});

function SecantFigure({ p, set }: { p: ParamValues; set: (patch: Partial<ParamValues>) => void }) {
  const F = FNS[p.f] ?? FNS[0];
  const x0 = useMemo(() => signal<Vec2>([p.x0, F.f(p.x0)]), []);
  const latest = useRef({ p, set });
  latest.current = { p, set };
  useEffect(() => {
    const [x, y] = x0.peek();
    if (x !== p.x0 || y !== F.f(p.x0)) x0.value = [p.x0, F.f(p.x0)];
  }, [p.x0, p.f]);
  useSyncSignalEffect(() => {
    const x = x0.value[0];
    if (x !== latest.current.p.x0) latest.current.set({ x0: x });
  });
  const x1 = p.x0 + p.h;
  return (
    <div class="plate problem__plate">
      <Stage2D view={{ x: [-2.6, 2.6], y: [-1.5, 4.5] }} title="The curve, the point x0 and the secant through x0 and x0 + h" aspect={{ desktop: 0.62, phone: 0.9 }} equalScale={false} hint="drag along the curve">
        <Curve f={F.f} concept="output" emphasis="quiet" />
        <Line through={[[p.x0, F.f(p.x0)], [x1, F.f(x1)]]} concept="eigenvalue" />
        <Point at={[x1, F.f(x1)]} concept="eigenvalue" label="$x_0 + h$" />
        <Handle
          value={x0}
          label="the point x0 on the curve"
          concept="input"
          constrain={{ curve: F.f }}
          snap={0.25}
          bounds={{ x: [-2, 2], y: [-10, 10] }}
          onDragEnd={() => {
            const cur = latest.current.p;
            x0.value = [cur.x0, F.f(cur.x0)]; // a rejected position snaps back
          }}
        />
      </Stage2D>
    </div>
  );
}

// Two "lessons" that both define `rate`, with different inks (mixed practice keeps each one's).
const CA = defineConcepts({ rate: { hue: 'rose', label: 'rate of change', symbol: "h'(t)" }, input: 'input', output: 'output' });
const CB = defineConcepts({ rate: { hue: 'gold', label: 'learning rate', symbol: '\\eta' }, error: 'error', input: 'input' });
const LESSON_A: ProblemSpec[] = [
  {
    id: 'ball-rate',
    difficulty: 2,
    title: 'A falling ball',
    prompt: 'A ball’s height is $h(t) = 20 - 5t^2$ metres after $t$ seconds. What is its [rate of change]{rate} $\\colorTerm{rate}{h\'(1)}$ at $t = 1\\ \\mathrm{s}$? Give the unit.',
    answer: { kind: 'numeric', value: -10, precision: { sig: 2 }, unit: 'm/s' },
    hints: ['The rate of change is the derivative.', 'Differentiate $20 - 5t^2$ with the power rule.', '$h\'(t) = -10t$.'],
    solution: { steps: [{ math: "h'(t) = -10t \\implies h'(1) = -10\\ \\mathrm{m/s}", why: 'Power rule; the constant 20 has derivative 0.' }], answer: '$-10\\ \\mathrm{m/s}$ (falling)', check: 'Negative: the height decreases.' },
    commonWrong: [{ answer: 15, why: '15 m is the height at $t = 1$, not how fast it changes.' }],
  },
  {
    id: 'rate-meaning',
    difficulty: 1,
    title: 'What a rate is',
    prompt: 'The [rate of change]{rate} of $f$ at a point is…',
    answer: {
      kind: 'choice',
      options: [
        { text: 'the slope of the tangent line there', why: 'The derivative is the slope of the line that just touches the graph.' },
        { text: 'the value of $f$ there', why: 'That’s the height, not how fast it changes.' },
        { text: 'the area under $f$ up to there', why: 'That’s an integral, the opposite operation.' },
      ],
      correct: 0,
    },
    hints: ['Think about slopes.', 'Rate = rise over run, in the limit.', 'Zoom in: the graph looks like a line.'],
    solution: { steps: [{ text: 'Zoomed in far enough, the graph is a line; its slope is the rate.', why: 'Definition of the derivative.' }], answer: 'The slope of the tangent line.' },
    commonWrong: [{ answer: 1, why: 'The value tells you where you are, not how fast you are moving.' }],
  },
];
const LESSON_B: ProblemSpec[] = [
  {
    id: 'one-gd-step',
    difficulty: 1,
    title: 'One gradient step',
    prompt: 'Gradient descent on $L(w) = w^2$ with [learning rate]{rate} $\\colorTerm{rate}{\\eta} = 0.1$ starts at $w = 3$. Where is $w$ after one step?',
    answer: { kind: 'numeric', value: 2.4, precision: { decimals: 2 }, label: 'w =' },
    hints: ['One step moves against the gradient.', '$w \\leftarrow w - \\eta L\'(w)$.', '$L\'(3) = 6$.'],
    solution: { steps: [{ math: 'w = 3 - 0.1 \\cdot 6 = 2.4', why: 'Step against the gradient, scaled by $\\eta$.' }], answer: '$w = 2.40$' },
    commonWrong: [{ answer: 3.6, why: 'That steps *up* the gradient: subtract, don’t add.' }],
  },
  {
    id: 'gd-update',
    difficulty: 2,
    title: 'The update rule',
    prompt: 'Write one gradient-descent step for $L(w) = (w - 2)^2$ with [learning rate]{rate} $\\eta$ (type `eta`).',
    answer: { kind: 'symbolic', expr: 'w - 2*eta*(w - 2)', vars: ['w', 'eta'], label: 'w_{\\text{new}} =' },
    hints: ['Subtract $\\eta$ times the derivative.', '$L\'(w) = 2(w - 2)$.', '$w_{\\text{new}} = w - \\eta \\cdot 2(w - 2)$.'],
    solution: { steps: [{ math: 'w_{\\text{new}} = w - \\eta L\'(w) = w - 2\\eta(w - 2)', why: 'Chain rule gives $L\'(w) = 2(w - 2)$.' }], answer: '$w - 2\\eta(w - 2)$' },
    commonWrong: [{ answer: 'w - eta*(w - 2)', why: 'The derivative of $(w - 2)^2$ is $2(w - 2)$: the 2 is missing.' }],
  },
];
const MIXED: PracticeEntry[] = [
  ...LESSON_A.map((spec) => ({ lessonId: 'kit/demo-calc', spec, concepts: CA })),
  ...LESSON_B.map((spec) => ({ lessonId: 'kit/demo-ml', spec, concepts: CB })),
];
const POOL: PracticeEntry[] = [...PROBLEMS.map((spec) => ({ lessonId: 'kit/demo-eigen', spec, concepts: DEMO, figures: FIGS })), ...MIXED, { lessonId: 'kit/demo-eigen', spec: REFLECT, concepts: DEMO }, { lessonId: 'kit/demo-eigen', spec: ANTI, concepts: DEMO }];

/** The sample quiz with a figure on its first question (Quiz's `figures` map). */
const QUIZ_FIG = [{ ...QUIZ[0], figure: 'q-arrows' }, ...QUIZ.slice(1)] as typeof QUIZ;
const QUIZ_FIGURES = {
  'q-arrows': () => (
    <div class="plate problem__plate">
      <Stage2D view={{ x: [-1, 4], y: [-1, 7] }} title="v = (1, 2) and its image Av = (3, 6) on one line through the origin" aspect={{ desktop: 0.5, phone: 0.8 }} hint={false}>
        <Vector to={[3, 6]} concept="output" label="$\cOutput$" />
        <Vector to={[1, 2]} concept="input" label="$\cInput$" />
      </Stage2D>
    </div>
  ),
};

const NUMBER_GUESS: PredictSpec = {
  id: 'predict-fall',
  prompt: 'A stone falls from rest. Ignoring air resistance, how many seconds does it take to fall $20\\ \\mathrm{m}$? (Use $g \\approx 10\\ \\mathrm{m/s^2}$.)',
  guess: { kind: 'number', label: 'Your guess, $t$', min: 0, max: 5, step: 0.1, answer: 2, tolerance: 0.15, unit: 's' },
  reveal: '$20 = \\tfrac12 \\cdot 10 \\cdot t^2$ gives $t^2 = 4$, so $t = 2\\ \\mathrm{s}$.',
  wrong: 'Most guesses are too long: the stone keeps speeding up, so the second half of the fall goes by quickly.',
};

const flatX = (s: unknown) => (Array.isArray(s) ? (s as number[])[0] : NaN);
const CUSTOM_GUESS: PredictSpec = {
  id: 'predict-flat',
  prompt: 'Where is the tangent to $f(x) = x^2 - 2x$ flat? Drag the point to your guess, then lock it in.',
  guess: { kind: 'custom', check: (g) => Math.abs(flatX(g) - 1) <= 0.15, describe: (g) => `x = ${flatX(g).toFixed(2)}` },
  reveal: '$f\'(x) = 2x - 2 = 0$ at $x = 1$: the bottom of the bowl.',
  right: 'The lowest point of a smooth curve is where the slope is zero.',
  wrong: 'Look for the bottom of the bowl: on either side of it the curve slopes away.',
};
const fFlat = (x: number) => x * x - 2 * x;

// ── Demos ──────────────────────────────────────────────────────────────────

function SecantExampleDemo() {
  const params = useSignal<ParamValues>({ f: 0, x0: 1, h: 0.5 });
  return (
    <>
      <WorkedExample spec={SECANT} n={2} params={params} figure={(p, set) => <SecantFigure p={p} set={set} />} />
      <p class="fig-keys" style={STATE} aria-live="off">
        external params signal = {JSON.stringify(params.value)}
      </p>
    </>
  );
}

function ExamProblemDemo() {
  const response = useSignal<ExamResponse>(null);
  return (
    <>
      <Problem spec={PROBLEMS[6]} lessonId="kit/demo-exam" mode="exam" response={response} n={3} total={8} />
      <p class="fig-keys" style={STATE}>
        response = {JSON.stringify(response.value)}
      </p>
    </>
  );
}

function ReviewProblemDemo() {
  const spec = PROBLEMS[6];
  const response = useMemo(() => signal<ExamResponse>({ kind: 'numeric', text: '1, -1' }), []);
  const verdict: Verdict = checkAnswer(spec.answer, { kind: 'numeric', text: '1, -1' }, spec.commonWrong);
  return <Problem spec={spec} lessonId="kit/demo-review" mode="review" response={response} verdict={verdict} n={3} total={8} />;
}

function PredictChoiceDemo({ scriptedLock }: { scriptedLock?: boolean }) {
  const node = (
    <Predict spec={PREDICTS[0]}>
      {({ locked }) => (
        <div class="plate problem__plate">
          <Stage2D view={{ x: [-3, 3], y: [-3, 3] }} title="The plane under A = [[2, 1], [1, 2]]" aspect={{ desktop: 0.5, phone: 0.8 }} hint={false}>
            <Vector to={[1.4, 0.2]} concept="input" label="$\cInput$" />
            <Vector to={apply2(A_MAT, [1.4, 0.2])} concept="output" label="$\cOutput$" />
            {locked && <Line through={[[0, 0], [1, 1]]} concept="eigenvalue" correct />}
            {locked && <Line through={[[0, 0], [1, -1]]} concept="eigenvalue" correct />}
          </Stage2D>
        </div>
      )}
    </Predict>
  );
  if (!scriptedLock) return node;
  return (
    <Scripted
      script={async (r) => {
        press(q(r, '.predict__options .choice__btn', 2));
        await wait(20);
        press(q(r, '.predict .btn--primary'));
      }}
    >
      {node}
    </Scripted>
  );
}

function PredictCustomDemo() {
  return (
    <Predict spec={CUSTOM_GUESS}>
      {({ locked, setGuess }) => <FlatGuess locked={locked} setGuess={setGuess} />}
    </Predict>
  );
}

function FlatGuess({ locked, setGuess }: { locked: boolean; setGuess: (g: unknown) => void }) {
  const p = useSignal<Vec2>([-0.5, fFlat(-0.5)]);
  return (
    <div class="plate problem__plate">
      <Stage2D view={{ x: [-1.5, 3.5], y: [-1.6, 3.2] }} title="The curve y = x² − 2x with a draggable point" aspect={{ desktop: 0.6, phone: 0.9 }} equalScale={false}>
        <Curve f={fFlat} concept="output" />
        {locked && <Line through={[[0, -1], [2, -1]]} concept="input" correct />}
        {locked && <Point at={[1, -1]} concept="input" label="flat here" correct />}
        <Handle value={p} label="your guess for the flat point" concept="input" constrain={{ curve: fFlat }} snap={0.05} disabled={locked} onDragEnd={(v) => setGuess(v)} />
      </Stage2D>
    </div>
  );
}

function ProgressReset() {
  const [n, setN] = useState(0);
  return (
    <p class="fig-keys" style={STATE}>
      <button
        type="button"
        class="btn btn--sm btn--quiet"
        data-hit
        onClick={() => {
          const store = getProgress();
          const d = store.read();
          store.import(JSON.stringify({ ...d, lessons: Object.fromEntries(Object.entries(d.lessons).filter(([k]) => !k.startsWith('kit/'))), exams: {} }));
          setN(n + 1);
        }}
      >
        Forget the gallery’s progress
      </button>
      {n > 0 ? ' Done: reload to see fresh dots.' : ''}
    </p>
  );
}

const demos: GalleryDemo[] = [
  {
    id: 'g3-examples',
    title: 'WorkedExampleSet · three levels',
    component: 'WorkedExampleSet',
    notes: 'Tabs ★ / ★★ / ★★★ (arrow keys move between them, `aria-selected`). Step 1 shows; every later step waits behind a *try it yourself* pause. The ★★ example has a live parameter: drag $a$ and every field recomputes; the reveal count survives.',
    wide: true,
    render: () => <WorkedExampleSet examples={EXAMPLES} />,
  },
  {
    id: 'g3-example-live',
    title: 'WorkedExample · choice param, accept() and a figure',
    component: 'WorkedExample',
    notes: 'A Segmented picks $f$, sliders set $x_0$ and $h$. `accept()` rejects $h = 0$ (the slider snaps back on release, the reason shows beside it) and $\\sqrt{x}$ for $x_0 \\le 0$ (that option is then disabled, with the reason). Dragging the point on the curve writes the same params through `setParams`, and the external signal below follows.',
    wide: true,
    render: () => <SecantExampleDemo />,
  },
  {
    id: 'g3-example-done',
    title: 'WorkedExample · solution revealed',
    component: 'WorkedExample',
    notes: '`start={3}`: every step, the boxed answer (green rule) and the sanity check.',
    render: () => <WorkedExample spec={EXAMPLES[2]} n={3} start={3} />,
  },
  {
    id: 'g3-numeric-wrong',
    title: 'Problem · numeric, wrong with its common-wrong note',
    component: 'Problem',
    notes: 'Scripted: typed $2$, pressed Check, opened the nudge. Red field and × line in `aria-live`, the matching ⚠ note (exactly when `Verdict.commonWrong` is set), hint ladder with ② unlocked. *Another one* draws a different generated matrix.',
    render: () => (
      <Scripted
        script={async (r) => {
          typeInto(q<HTMLInputElement>(r, '.field'), '2');
          await wait(10);
          press(q(r, '.problem__check'));
          await wait(10);
          press(q(r, '.hints .seg__btn'));
        }}
      >
        <Problem spec={PROBLEMS[0]} lessonId="kit/demo-s-numeric" n={1} total={8} />
      </Scripted>
    ),
  },
  {
    id: 'g3-solution',
    title: 'Problem · Show solution (asks once, records a reveal)',
    component: 'Problem',
    notes: 'Scripted: Show solution → *Show it*. Steps, boxed answer, ✓ check, and every common-wrong note under the solution.',
    render: () => (
      <Scripted
        script={async (r) => {
          press(q(r, '.problem__show'));
          await wait(20);
          press(q(r, '.reveal-confirm .btn--primary'));
        }}
      >
        <Problem spec={PROBLEMS[3]} lessonId="kit/demo-s-solution" n={4} total={8} />
      </Scripted>
    ),
  },
  {
    id: 'g3-matrix',
    title: 'Problem · matrix answer (right)',
    component: 'Problem',
    notes: 'Scripted: filled the 2×2 grid and checked. Arrow keys move between cells; the grid is joined row-major for the checker. A right answer opens the solution.',
    render: () => (
      <Scripted
        script={async (r) => {
          ['0', '1', '1', '0'].forEach((v, k) => typeInto(q<HTMLInputElement>(r, '.mgrid__cell', k), v));
          await wait(10);
          press(q(r, '.problem__check'));
        }}
      >
        <Problem spec={REFLECT} lessonId="kit/demo-s-matrix" />
      </Scripted>
    ),
  },
  {
    id: 'g3-complex',
    title: 'Problem · complex numbers, live “We read”',
    component: 'Problem',
    notes: 'One field per number; $1 \\pm 2i$ in the first field answers the pair. The preview shows how the input was read, never whether it is right.',
    render: () => (
      <Scripted script={(r) => typeInto(q<HTMLInputElement>(r, '.field'), '1 ± 2i')}>
        <Problem spec={COMPLEX} lessonId="kit/demo-s-complex" />
      </Scripted>
    ),
  },
  {
    id: 'g3-units',
    title: 'Problem · units: the wrong dimension',
    component: 'Problem',
    notes: 'Scripted: typed $3\\ \\mathrm{m/s}$ for an acceleration.',
    render: () => (
      <Scripted
        script={async (r) => {
          typeInto(q<HTMLInputElement>(r, '.field'), '3 m/s');
          await wait(10);
          press(q(r, '.problem__check'));
        }}
      >
        <Problem spec={PROBLEMS[4]} lessonId="kit/demo-s-units" />
      </Scripted>
    ),
  },
  {
    id: 'g3-symbolic',
    title: 'Problem · expression, common wrong answer',
    component: 'Problem',
    notes: 'Scripted: the expansion without the $-bc$ term. Equivalence is checked at random points, so any equivalent form is accepted.',
    render: () => (
      <Scripted
        script={async (r) => {
          typeInto(q<HTMLInputElement>(r, '.field'), 'λ^2 - 5λ + 4');
          await wait(10);
          press(q(r, '.problem__check'));
        }}
      >
        <Problem spec={PROBLEMS[3]} lessonId="kit/demo-s-symbolic" />
      </Scripted>
    ),
  },
  {
    id: 'g3-plus-c',
    title: 'Problem · antiderivative with + C',
    component: 'Problem',
    notes: 'The + C is optional and shows in the preview.',
    render: () => (
      <Scripted script={(r) => typeInto(q<HTMLInputElement>(r, '.field'), 'x^3 + C')}>
        <Problem spec={ANTI} lessonId="kit/demo-s-plusc" />
      </Scripted>
    ),
  },
  {
    id: 'g3-choice',
    title: 'Problem · multiple choice, wrong',
    component: 'Problem',
    notes: 'Scripted: picked A and checked. The picked option turns red with its why; the common-wrong note names the option by its letter.',
    render: () => (
      <Scripted
        script={async (r) => {
          press(q(r, '.choice input'));
          await wait(10);
          press(q(r, '.problem__check'));
        }}
      >
        <Problem spec={PROBLEMS[1]} lessonId="kit/demo-s-choice" />
      </Scripted>
    ),
  },
  {
    id: 'g3-multi',
    title: 'Problem · choose all that apply, with a reason',
    component: 'Problem',
    notes: 'Checkboxes, shuffled per problem (stable across reloads), and a one-line reason field that must be filled before Check.',
    render: () => <Problem spec={MULTI} lessonId="kit/demo-multi" />,
  },
  {
    id: 'g3-point',
    title: 'Problem · drag the point',
    component: 'Problem',
    notes: 'A Stage2D with one Handle: mouse, touch, or arrow keys (snap 0.5). Right turns the ring green.',
    render: () => <Problem spec={PROBLEMS[2]} lessonId="kit/demo-point" />,
  },
  {
    id: 'g3-order',
    title: 'Problem · put in order',
    component: 'Problem',
    notes: 'Drag a row by its grip, or use its ↑ ↓ buttons; focus follows the row and each move is announced.',
    render: () => <Problem spec={PROBLEMS[5]} lessonId="kit/demo-order" />,
  },
  {
    id: 'g3-match',
    title: 'Problem · match',
    component: 'Problem',
    notes: 'Scripted: placed the first item with its menu. Drag an item’s grip onto a slot, or pick from its menu.',
    render: () => (
      <Scripted script={(r) => choose(q<HTMLSelectElement>(r, '.match__select'), '1')}>
        <Problem spec={MATCH} lessonId="kit/demo-s-match" />
      </Scripted>
    ),
  },
  {
    id: 'g3-slider',
    title: 'Problem · set the slider',
    component: 'Problem',
    notes: 'G4’s Slider over the target’s range.',
    render: () => <Problem spec={SLIDE} lessonId="kit/demo-slider" />,
  },
  {
    id: 'g3-custom',
    title: 'Problem · a custom visual',
    component: 'Problem',
    notes: 'The lesson’s own renderer (`customs[figure]`) holds the state in a signal; `check` decides and `describe` says it in words.',
    render: () => <Problem spec={EIGDIR} lessonId="kit/demo-custom" custom={EigenDirFigure} />,
  },
  {
    id: 'g3-proof',
    title: 'Problem · explain, then self-check',
    component: 'Problem',
    notes: 'Scripted: wrote an answer, compared, ticked two of three parts and checked.',
    render: () => (
      <Scripted
        script={async (r) => {
          typeInto(q<HTMLTextAreaElement>(r, '.proof__text'), 'A²v = A(Av) = A(λv) = λAv = λ²v.');
          await wait(10);
          press(q(r, '.proof .btn'));
          await wait(20);
          press(q(r, '.checklist input', 0));
          press(q(r, '.checklist input', 1));
          await wait(10);
          press(q(r, '.problem__check'));
        }}
      >
        <Problem spec={PROBLEMS[7]} lessonId="kit/demo-s-proof" />
      </Scripted>
    ),
  },
  {
    id: 'g3-code',
    title: 'Problem · write the code',
    component: 'Problem',
    notes: 'Scripted: ran the starter. Tests run in the sandbox Worker with a time limit; hidden tests show only their number and ✓/×. Ctrl/⌘+Enter runs; Esc, then Tab, leaves the editor.',
    wide: true,
    render: () => (
      <Scripted script={(r) => press(q(r, '.problem__check'))}>
        <Problem spec={PROBLEMS[8]} lessonId="kit/demo-s-code" />
      </Scripted>
    ),
  },
  {
    id: 'g3-exam-mode',
    title: 'Problem · exam mode',
    component: 'Problem',
    notes: 'Inputs only: no Check, hints or solution. Every edit writes the `response` signal.',
    render: () => <ExamProblemDemo />,
  },
  {
    id: 'g3-review-mode',
    title: 'Problem · review mode',
    component: 'Problem',
    notes: 'The learner’s answer (read-only), the verdict, the matching common-wrong note, and the full solution with the other notes.',
    render: () => <ReviewProblemDemo />,
  },
  {
    id: 'g3-set',
    title: 'ProblemSet · paged',
    component: 'ProblemSet',
    notes: 'Every `article[data-problem]` is in the DOM (the others `hidden`; bodies mount when first shown). The dots come from saved progress, so they survive a reload; the set opens at the first unsolved problem.',
    wide: true,
    render: () => (
      <KitProvider lessonId="kit/demo-set" concepts={DEMO}>
        <ProblemSet problems={[...PROBLEMS, EIGDIR]} customs={FIGS.customs} />
        <ProgressReset />
      </KitProvider>
    ),
  },
  {
    id: 'g3-mixed',
    title: 'ProblemSet · mixed lessons (list)',
    component: 'ProblemSet',
    notes: 'Two lessons both define a concept called *rate*: rose in one, gold in the other. Each problem renders in its own scoped KitProvider, so each keeps its ink and its progress key (`data-problem="kit/demo-calc:ball-rate"`).',
    render: () => <ProblemSet items={MIXED} mode="list" title="Mixed practice: two lessons" />,
  },
  {
    id: 'g3-quiz',
    title: 'Quiz',
    component: 'Quiz',
    notes: 'Picking checks at once (options are buttons; ↑ ↓ move between them). The first question has a figure from `figures`. The first answer is the score; *Try again* is for practice.',
    render: () => (
      <KitProvider lessonId="kit/demo-quiz" concepts={DEMO}>
        <Quiz questions={QUIZ_FIG} figures={QUIZ_FIGURES} />
      </KitProvider>
    ),
  },
  {
    id: 'g3-quiz-wrong',
    title: 'Quiz · a wrong pick',
    component: 'Quiz',
    notes: 'Scripted: picked B. Red row with ×, “Not quite.” and that option’s why; *Try again* and *Next question*.',
    render: () => (
      <KitProvider lessonId="kit/demo-s-quiz" concepts={DEMO}>
        <Scripted script={(r) => press(q(r, '.choice__btn', 1))}>
          <Quiz questions={QUIZ} />
        </Scripted>
      </KitProvider>
    ),
  },
  {
    id: 'g3-quiz-summary',
    title: 'Quiz · the summary',
    component: 'Quiz',
    notes: 'Scripted through every question: the score and a list of misses to review.',
    render: () => (
      <KitProvider lessonId="kit/demo-s-quiz-end" concepts={DEMO}>
        <Scripted
          script={async (r) => {
            const set = (k: number) => q(r, '.quiz__set', k)!;
            press(q(set(0), '.choice__btn', 1));
            await wait(10);
            press(q(r, '.quiz > .card__foot .btn--primary'));
            await wait(10);
            press(q(set(1), '.choice__btn', 0));
            await wait(10);
            press(q(r, '.quiz > .card__foot .btn--primary'));
            await wait(10);
            press(q(set(2), '.answer-row--action .btn'));
            await wait(10);
            press(q(r, '.quiz > .card__foot .btn--primary'));
            await wait(10);
            press(q(set(3), '.choice__btn', 0));
            await wait(10);
            press(q(r, '.quiz > .card__foot .btn--primary'));
          }}
        >
          <Quiz questions={QUIZ} />
        </Scripted>
      </KitProvider>
    ),
  },
  {
    id: 'g3-predict',
    title: 'Predict · choice',
    component: 'Predict',
    notes: '*Lock in my guess* stays disabled until there is a guess.',
    render: () => <PredictChoiceDemo />,
  },
  {
    id: 'g3-predict-locked',
    title: 'Predict · locked in',
    component: 'Predict',
    notes: 'Scripted: guessed “Two” and locked it. The figure reveals the kept lines; the guess can’t change.',
    render: () => <PredictChoiceDemo scriptedLock />,
  },
  {
    id: 'g3-predict-number',
    title: 'Predict · a number',
    component: 'Predict',
    notes: 'A Slider guess judged within a tolerance; the reveal states the true value.',
    render: () => <Predict spec={NUMBER_GUESS} />,
  },
  {
    id: 'g3-predict-custom',
    title: 'Predict · on the figure',
    component: 'Predict',
    notes: 'The children’s own visual makes the guess through `setGuess` (a Handle’s `onDragEnd`); after locking it shows the answer.',
    render: () => <PredictCustomDemo />,
  },
  {
    id: 'g3-exam',
    title: 'ExamSet',
    component: 'ExamSet',
    notes: 'A fresh paper per attempt from three lessons’ problems; a sticky timer (announced at 5 and 1 minutes only), answered count and jump links; Submit all confirms if anything is unanswered; code is graded in the sandbox; then the score, a ✓/× strip and a walkthrough.',
    wide: true,
    render: () => <ExamSet subjectId="kit-demo" items={POOL} count={6} />,
  },
  {
    id: 'g3-exam-short',
    title: 'ExamSet · one-minute paper',
    component: 'ExamSet',
    notes: 'Two questions, one minute: watch it announce “1 minute left” and submit itself at 0:00.',
    render: () => <ExamSet subjectId="kit-demo-short" items={MIXED} count={2} minutes={1} title="One-minute paper" />,
  },
];

export const gallery: GalleryGroup = {
  id: 'practice',
  title: 'Practice',
  owner: 'G3',
  blurb: 'Worked examples with live parameters, problems of every answer kind (with hints, solutions and common wrong answers), problem sets, quick checks, predictions and the timed exam-style set.',
  demos,
};
