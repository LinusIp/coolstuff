/**
 * Reference specs: one of everything in types.ts, written the way a lesson's
 * problems.ts should be. Used by the /kit gallery, every group's dev page and
 * the core tests (samples.test.ts audits them). Pure: no DOM.
 *
 * FROZEN (kit architect). Groups copy patterns from here; they don't edit it.
 */
import { defineConcepts } from '../theme';
import { defineExample, generator } from '../core/problems';
import { fmt } from '../math/axes';
import type { DerivationSpec, FormulaSpec, GlossaryTerm, PredictSpec, ProblemSpec, QuizSpec, Reference, TldrSpec, TrapSpec, WorkedExampleSpec } from '../types';

/** The demo lesson's concepts (eigenvectors): the same names every gallery uses. */
export const DEMO = defineConcepts({
  input: { hue: 'input', label: 'input vector', symbol: '\\vec v' },
  output: { hue: 'output', label: 'its image', symbol: 'A\\vec v' },
  matrix: { hue: 'teal', label: 'the matrix', symbol: 'A' },
  eigenvalue: { hue: 'rose', label: 'scale factor', symbol: '\\lambda' },
});
export const DEMO_MACROS = DEMO.macros();
/** The lesson-content contract names this concept set `C` (types.ts §11); samples follow it so `auditLesson(samples)` runs. */
export const C = DEMO;

/** Number for TeX: trims float noise, ASCII minus (KaTeX sets it as a proper minus). */
const n = (x: number): string => fmt(x, 4).replace('−', '-');

export const TLDR: TldrSpec = {
  points: [
    'An **eigenvector** of a square matrix $\\cMatrix$ is a nonzero vector $\\cInput$ that $\\cMatrix$ does not turn: it only stretches, shrinks or flips it.',
    'The stretch factor is the **eigenvalue** $\\cEigenvalue$. Find every eigenvalue by solving $\\det(A - \\lambda I) = 0$.',
    'For each $\\cEigenvalue$, solve $(A - \\lambda I)\\vec v = \\zerovec$. Any nonzero multiple of a solution is an eigenvector too.',
  ],
  formula: '\\cMatrix\\cInput = \\cEigenvalue\\cInput',
  key: [
    { tex: '\\cMatrix', text: 'the matrix' },
    { tex: '\\cInput', text: 'eigenvector, nonzero' },
    { tex: '\\cEigenvalue', text: 'eigenvalue, a number' },
  ],
};

export const EXAMPLES: readonly WorkedExampleSpec[] = [
  defineExample({
    id: 'eigen-4123',
    level: 'direct',
    title: 'Eigenvalues and eigenvectors of a 2×2',
    statement: 'Find the eigenvalues and eigenvectors of $B = \\begin{bmatrix} 4 & 1 \\\\ 2 & 3 \\end{bmatrix}$.',
    known: 'The matrix $B$. It is $2\\times 2$, so expect at most two eigenvalues.',
    want: 'Every $\\lambda$ and nonzero $\\vec v$ with $B\\vec v = \\lambda\\vec v$.',
    strategy: 'Find the $\\lambda$ that make $B - \\lambda I$ singular, then solve $(B - \\lambda I)\\vec v = \\zerovec$ for each.',
    steps: [
      { title: 'The characteristic polynomial', math: '\\det(B - \\lambda I) = (4-\\lambda)(3-\\lambda) - 2\\cdot 1 = \\lambda^2 - 7\\lambda + 10', why: '2×2 determinant: $ad - bc$, then expand.' },
      {
        title: 'The eigenvalues',
        math: '\\lambda^2 - 7\\lambda + 10 = (\\lambda-5)(\\lambda-2) = 0 \\implies \\lambda_1 = 5,\\ \\lambda_2 = 2',
        why: 'Factor: two numbers with product 10 and sum 7.',
        tryIt: 'Find the roots of $\\lambda^2 - 7\\lambda + 10$. Which two numbers multiply to 10 and add to 7?',
      },
      {
        title: 'The eigenvectors',
        math: '(B - 5I)\\vec v = \\zerovec \\implies -v_1 + v_2 = 0 \\implies \\vec v_1 = (1, 1)',
        why: 'Both rows say the same thing; any nonzero multiple works. Likewise $\\lambda_2 = 2$ gives $\\vec v_2 = (1, -2)$.',
        tryIt: 'For $\\lambda_1 = 5$, solve $(B - 5I)\\vec v = \\zerovec$. Which direction does $B$ leave unturned?',
      },
    ],
    answer: '$\\lambda_1 = 5,\\ \\vec v_1 = (1, 1)$ and $\\lambda_2 = 2,\\ \\vec v_2 = (1, -2)$',
    value: [5, 2],
    sanity: '$\\lambda_1 + \\lambda_2 = 7 = \\tr B$ and $\\lambda_1\\lambda_2 = 10 = \\det B$, as they must be.',
  }),
  defineExample({
    id: 'eigen-symmetric-live',
    level: 'combined',
    title: 'A family of symmetric matrices',
    uses: ['linalg/determinant'],
    params: { a: { label: '$a$', min: -3, max: 3, step: 0.5, value: 2, concept: 'matrix' } },
    statement: (p) => `Find the eigenvalues of $A = \\begin{bmatrix} ${n(p.a)} & 1 \\\\ 1 & ${n(p.a)} \\end{bmatrix}$, and check them against the trace and determinant.`,
    known: (p) => [`$\\tr A = ${n(2 * p.a)}$`, `$\\det A = ${n(p.a * p.a - 1)}$`],
    want: 'Both eigenvalues.',
    strategy: 'Solve $\\det(A - \\lambda I) = 0$; it is a difference of squares.',
    steps: (p) => [
      { math: `\\det(A - \\lambda I) = (${n(p.a)} - \\lambda)^2 - 1 = 0`, why: 'Determinant of a 2×2: $ad - bc$ with $b = c = 1$.' },
      {
        math: `${n(p.a)} - \\lambda = \\pm 1 \\implies \\lambda_1 = ${n(p.a + 1)},\\ \\lambda_2 = ${n(p.a - 1)}`,
        why: 'A square equals 1 exactly when the thing squared is $\\pm 1$.',
        tryIt: 'When is a square equal to 1? Solve for $\\lambda$ without expanding.',
      },
    ],
    answer: (p) => `$\\lambda_1 = ${n(p.a + 1)},\\ \\lambda_2 = ${n(p.a - 1)}$`,
    value: (p) => [p.a + 1, p.a - 1],
    sanity: (p) => `Sum $${n(p.a + 1)} + (${n(p.a - 1)}) = ${n(2 * p.a)} = \\tr A$; product $${n((p.a + 1) * (p.a - 1))} = \\det A$.`,
  }),
  defineExample({
    id: 'eigen-reconstruct',
    level: 'exam',
    title: 'Build the matrix from its eigenvectors',
    statement: 'A $2\\times 2$ matrix $A$ sends $(1, 1)$ to $3$ times itself and leaves $(1, -1)$ unchanged. Find $A$.',
    known: ['$A(1, 1) = (3, 3)$', '$A(1, -1) = (1, -1)$'],
    want: 'The four entries of $A$.',
    strategy: 'Put the eigenvectors in the columns of $P$ and their images in the columns of $AP$; then $A = (AP)P^{-1}$.',
    steps: [
      { math: 'A\\begin{bmatrix} 1 & 1 \\\\ 1 & -1 \\end{bmatrix} = \\begin{bmatrix} 3 & 1 \\\\ 3 & -1 \\end{bmatrix}', why: 'Matrix times matrix acts column by column.' },
      {
        math: 'P^{-1} = \\frac{1}{-2}\\begin{bmatrix} -1 & -1 \\\\ -1 & 1 \\end{bmatrix} = \\begin{bmatrix} \\tfrac12 & \\tfrac12 \\\\ \\tfrac12 & -\\tfrac12 \\end{bmatrix}',
        why: '2×2 inverse: swap the diagonal, negate the off-diagonal, divide by $\\det P = -2$.',
        tryIt: 'Invert $P = \\begin{bmatrix} 1 & 1 \\\\ 1 & -1 \\end{bmatrix}$ with the 2×2 recipe.',
      },
      {
        math: 'A = \\begin{bmatrix} 3 & 1 \\\\ 3 & -1 \\end{bmatrix}\\begin{bmatrix} \\tfrac12 & \\tfrac12 \\\\ \\tfrac12 & -\\tfrac12 \\end{bmatrix} = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}',
        why: 'Multiply row by column.',
        tryIt: 'Multiply $AP$ by $P^{-1}$, row by column.',
      },
    ],
    answer: '$A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$',
    value: [2, 1, 1, 2],
    sanity: '$A(1, 1) = (3, 3)$ and $A(1, -1) = (1, -1)$. Also $\\tr A = 4 = 3 + 1$ and $\\det A = 3 = 3 \\cdot 1$.',
  }),
];

const triangular = generator({
  params: (rng) => ({ a: rng.int(-5, 9), b: rng.intExcept(-4, 6, [0]), d: rng.int(-5, 9) }),
  accept: ({ a, b, d }) => (a === d ? 'repeated eigenvalue' : b === Math.max(a, d) || b === Math.min(a, d) ? 'off-diagonal equals an eigenvalue' : true),
  build: ({ a, b, d }) => ({
    prompt: `What is the larger eigenvalue of $T = \\begin{bmatrix} ${a} & ${b} \\\\ 0 & ${d} \\end{bmatrix}$?`,
    answer: { kind: 'numeric', value: Math.max(a, d), precision: 'exact', label: '\\lambda_{\\max} =' },
    hints: [
      'For a triangular matrix, $\\det(T - \\lambda I)$ is especially easy.',
      'Write $\\det(T - \\lambda I)$; the zero below the diagonal kills the $bc$ term.',
      `$\\det(T - \\lambda I) = (${a} - \\lambda)(${d} - \\lambda)$.`,
    ],
    solution: {
      steps: [
        { math: `\\det(T - \\lambda I) = (${a} - \\lambda)(${d} - \\lambda)`, why: `2×2 determinant $ad - bc$: the lower-left entry is 0, so the $bc$ term vanishes whatever $b = ${b}$ is.` },
        { math: `(${a} - \\lambda)(${d} - \\lambda) = 0 \\implies \\lambda = ${a} \\text{ or } \\lambda = ${d}`, why: 'A product is zero when a factor is.' },
      ],
      answer: `$\\lambda_{\\max} = ${Math.max(a, d)}$`,
      check: 'The eigenvalues of a triangular matrix are its diagonal entries.',
    },
    commonWrong: [{ answer: b, why: `${b} is the off-diagonal entry. It changes the eigenvectors, not the eigenvalues, of a triangular matrix.` }],
  }),
});

export const PROBLEMS: readonly ProblemSpec[] = [
  {
    id: 'triangular-max',
    difficulty: 1,
    title: 'Triangular matrix',
    ...triangular.build({ a: 3, b: 2, d: -1 }),
    generate: triangular,
  },
  {
    id: 'which-eigenvector',
    difficulty: 1,
    title: 'Spot the eigenvector',
    prompt: 'Which vector is an eigenvector of $D = \\begin{bmatrix} 2 & 0 \\\\ 0 & 5 \\end{bmatrix}$?',
    answer: {
      kind: 'choice',
      options: [
        { text: '$(1, 1)$', why: '$D(1, 1) = (2, 5)$, which is not a multiple of $(1, 1)$.' },
        { text: '$(0, 3)$', why: '$D(0, 3) = (0, 15) = 5\\,(0, 3)$: only stretched.' },
        { text: '$(1, 2)$', why: '$D(1, 2) = (2, 10)$: turned off its line.' },
        { text: '$(2, 1)$', why: '$D(2, 1) = (4, 5)$: turned off its line.' },
      ],
      correct: 1,
    },
    hints: ['Apply $D$ to each option and compare directions.', 'An eigenvector comes out as a multiple of itself.', '$D(0, 3) = (0, 15)$.'],
    solution: {
      steps: [{ math: 'D\\begin{bmatrix} 0 \\\\ 3 \\end{bmatrix} = \\begin{bmatrix} 0 \\\\ 15 \\end{bmatrix} = 5\\begin{bmatrix} 0 \\\\ 3 \\end{bmatrix}', why: 'A diagonal matrix scales each axis separately.' }],
      answer: '$(0, 3)$, with eigenvalue $5$',
    },
    commonWrong: [{ answer: 0, why: '$(1, 1)$ is an eigenvector of $\\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$, not of this $D$: unequal diagonal entries stretch the two axes differently.' }],
  },
  {
    id: 'drag-image',
    difficulty: 1,
    title: 'Where does v land?',
    prompt: 'Drag the point to $A\\vec v$ for $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$ and $\\vec v = (1, 1)$.',
    answer: {
      kind: 'drag',
      target: { mode: 'point', view: { x: [-1, 4], y: [-1, 4] }, start: [0, 0], answer: [3, 3], tolerance: 0.25, snap: 0.5, label: 'the image A v' },
    },
    hints: ['$A\\vec v$ is a combination of the columns of $A$.', 'Multiply row by column.', '$A\\vec v = (2\\cdot 1 + 1\\cdot 1,\\ 1\\cdot 1 + 2\\cdot 1)$.'],
    solution: { steps: [{ math: 'A\\vec v = (2 + 1,\\ 1 + 2) = (3, 3)', why: 'Row times column.' }], answer: '$(3, 3)$: three times $\\vec v$' },
    commonWrong: [{ answer: '[1, 1]', why: 'That is $\\vec v$ itself. The matrix moves it, here to three times as far along the same line.' }],
  },
  {
    id: 'char-poly',
    difficulty: 2,
    title: 'Characteristic polynomial',
    prompt: 'Write $\\det(A - \\lambda I)$ for $A = \\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$ as a polynomial in $\\lambda$ (type `lambda` or `λ`).',
    answer: { kind: 'symbolic', expr: 'lambda^2 - 5lambda - 2', vars: ['lambda'], label: '\\det(A - \\lambda I) =' },
    hints: [
      'Subtract $\\lambda$ from each diagonal entry first.',
      'Then use $ad - bc$ on $A - \\lambda I$ and expand.',
      '$\\det(A - \\lambda I) = (1 - \\lambda)(4 - \\lambda) - 2\\cdot 3$.',
    ],
    solution: {
      steps: [
        { math: '\\det(A - \\lambda I) = (1-\\lambda)(4-\\lambda) - 6', why: '2×2 determinant of $A - \\lambda I$.' },
        { math: '(1-\\lambda)(4-\\lambda) - 6 = \\lambda^2 - 5\\lambda + 4 - 6 = \\lambda^2 - 5\\lambda - 2', why: 'Expand and collect.' },
      ],
      answer: '$\\lambda^2 - 5\\lambda - 2$',
      check: 'The $\\lambda$ coefficient is $-\\tr A = -5$ and the constant is $\\det A = -2$.',
    },
    commonWrong: [{ answer: 'lambda^2 - 5lambda + 4', why: 'That is only $(1-\\lambda)(4-\\lambda)$: the $-bc = -6$ term is missing.' }],
  },
  {
    id: 'car-acceleration',
    difficulty: 2,
    title: 'Units: acceleration',
    prompt: 'A car speeds up uniformly from rest to $27\\ \\mathrm{m/s}$ in $9.0\\ \\mathrm{s}$. What is its acceleration? Give the unit.',
    answer: { kind: 'numeric', value: 3, precision: { sig: 2 }, unit: 'm/s^2' },
    hints: ['Acceleration is how fast the velocity changes.', 'Divide the change in velocity by the time it took.', '$a = \\Delta v / \\Delta t = (27 - 0) / 9.0$.'],
    solution: { steps: [{ math: 'a = \\frac{\\Delta v}{\\Delta t} = \\frac{27\\ \\mathrm{m/s}}{9.0\\ \\mathrm{s}} = 3.0\\ \\mathrm{m/s^2}', why: 'Uniform acceleration: constant rate of change of velocity.' }], answer: '$3.0\\ \\mathrm{m/s^2}$' },
    commonWrong: [{ answer: 243, why: 'That multiplies $27 \\times 9.0$. Acceleration is velocity change *per* second, so divide.' }],
  },
  {
    id: 'order-steps',
    difficulty: 2,
    title: 'The recipe',
    prompt: 'Put the steps for finding eigenvectors in order.',
    answer: {
      kind: 'drag',
      target: {
        mode: 'order',
        items: ['Solve $\\det(A - \\lambda I) = 0$ for $\\lambda$', 'Form $A - \\lambda I$', 'Solve $(A - \\lambda I)\\vec v = \\zerovec$ for each $\\lambda$', 'Check $A\\vec v = \\lambda\\vec v$'],
        correct: [1, 0, 2, 3],
      },
    },
    hints: ['You need the eigenvalues before the eigenvectors.', 'Which object does the determinant act on?', 'Start by forming $A - \\lambda I$.'],
    solution: {
      steps: [
        { text: 'Form $A - \\lambda I$, then make it singular: $\\det(A - \\lambda I) = 0$ gives the eigenvalues.', why: 'A nonzero $\\vec v$ with $(A - \\lambda I)\\vec v = \\zerovec$ exists only if $A - \\lambda I$ is singular.' },
        { text: 'For each eigenvalue solve $(A - \\lambda I)\\vec v = \\zerovec$, then check.', why: 'The null space of $A - \\lambda I$ holds the eigenvectors.' },
      ],
      answer: 'Form $A - \\lambda I$ → solve $\\det = 0$ → solve for $\\vec v$ → check.',
    },
    commonWrong: [{ answer: '[0, 1, 2, 3]', why: 'You can’t solve $\\det(A - \\lambda I) = 0$ before writing down $A - \\lambda I$.' }],
  },
  {
    id: 'eigenvector-for-3',
    difficulty: 2,
    title: 'An eigenvector for λ = 3',
    prompt: 'Find an eigenvector of $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$ for the eigenvalue $\\lambda = 3$. Any nonzero multiple counts.',
    answer: { kind: 'numeric', value: [1, 1], precision: 'exact', equivalence: 'scalar-multiple', label: '\\vec v =' },
    hints: [
      'An eigenvector for $\\lambda = 3$ is sent to three times itself.',
      'Solve $(A - 3I)\\vec v = \\zerovec$.',
      '$A - 3I = \\begin{bmatrix} -1 & 1 \\\\ 1 & -1 \\end{bmatrix}$.',
    ],
    solution: {
      steps: [
        { math: '(A - 3I)\\vec v = \\begin{bmatrix} -1 & 1 \\\\ 1 & -1 \\end{bmatrix}\\begin{bmatrix} v_1 \\\\ v_2 \\end{bmatrix} = \\zerovec', why: 'Eigenvectors for $\\lambda$ are the nonzero solutions of $(A - \\lambda I)\\vec v = \\zerovec$.' },
        { math: '-v_1 + v_2 = 0 \\implies v_2 = v_1', why: 'Both rows give the same equation; $v_1$ is free.' },
        { math: '\\vec v = (1, 1)', why: 'Choose $v_1 = 1$. Any nonzero multiple, like $(2, 2)$ or $(-1, -1)$, works as well.' },
      ],
      answer: '$\\vec v = (1, 1)$, or any nonzero multiple of it',
      check: '$A(1, 1) = (3, 3) = 3\\,(1, 1)$.',
    },
    commonWrong: [
      { answer: [1, -1], why: '$(1, -1)$ is an eigenvector of $A$, but for $\\lambda = 1$: $A(1, -1) = (1, -1)$.' },
      { answer: [0, 0], why: '$\\zerovec$ solves $(A - 3I)\\vec v = \\zerovec$, but eigenvectors must be nonzero.' },
    ],
  },
  {
    id: 'square-proof',
    difficulty: 3,
    title: 'Eigenvalues of A²',
    prompt: 'Show that if $\\vec v$ is an eigenvector of $A$ with eigenvalue $\\lambda$, then $\\vec v$ is an eigenvector of $A^2$ with eigenvalue $\\lambda^2$.',
    answer: {
      kind: 'proof',
      modelAnswer: 'Since $A\\vec v = \\lambda\\vec v$, $$A^2\\vec v = A(A\\vec v) = A(\\lambda\\vec v) = \\lambda(A\\vec v) = \\lambda^2\\vec v.$$ And $\\vec v \\ne \\zerovec$ because it is an eigenvector of $A$, so it is an eigenvector of $A^2$ with eigenvalue $\\lambda^2$.',
      checklist: ['Uses $A\\vec v = \\lambda\\vec v$ twice', 'Moves the scalar $\\lambda$ through $A$ (linearity)', 'Notes $\\vec v \\ne \\zerovec$, so it qualifies as an eigenvector'],
    },
    hints: ['Write $A^2\\vec v$ as $A$ applied to something you know.', 'Use $A\\vec v = \\lambda\\vec v$ inside, then linearity.', '$A^2\\vec v = A(A\\vec v) = A(\\lambda\\vec v)$.'],
    solution: {
      steps: [
        { math: 'A^2\\vec v = A(A\\vec v) = A(\\lambda\\vec v)', why: 'Definition of $A^2$, then $A\\vec v = \\lambda\\vec v$.' },
        { math: 'A(\\lambda\\vec v) = \\lambda A\\vec v = \\lambda^2\\vec v', why: 'Linearity, then the eigen-equation again.' },
      ],
      answer: '$A^2\\vec v = \\lambda^2\\vec v$ with $\\vec v \\ne \\zerovec$.',
    },
    commonWrong: [{ answer: 'A^2 v = 2 lambda v', why: 'Applying $A$ twice multiplies by $\\lambda$ twice: $\\lambda \\cdot \\lambda = \\lambda^2$, not $2\\lambda$.' }],
  },
  {
    id: 'power-iteration',
    difficulty: 3,
    title: 'Power iteration',
    prompt:
      'Write `powerIteration(A, steps)` for a 2×2 matrix `A = [[a, b], [c, d]]`: start from $\\vec v = (1, 0.5)$, repeat $\\vec v \\leftarrow A\\vec v / \\lVert A\\vec v \\rVert$ `steps` times, and return the Rayleigh quotient $\\dfrac{\\vec v \\cdot A\\vec v}{\\vec v \\cdot \\vec v}$.',
    answer: {
      kind: 'code',
      language: 'javascript',
      entry: 'powerIteration',
      starter: 'function powerIteration(A, steps) {\n  let v = [1, 0.5];\n  // repeat: v ← A v, then divide by its length\n  return 0;\n}\n',
      solution:
        'function powerIteration(A, steps) {\n  const mul = (v) => [A[0][0] * v[0] + A[0][1] * v[1], A[1][0] * v[0] + A[1][1] * v[1]];\n  let v = [1, 0.5];\n  for (let k = 0; k < steps; k++) {\n    const w = mul(v);\n    const len = Math.hypot(w[0], w[1]);\n    v = [w[0] / len, w[1] / len];\n  }\n  const Av = mul(v);\n  return (v[0] * Av[0] + v[1] * Av[1]) / (v[0] * v[0] + v[1] * v[1]);\n}\n',
      tests: [
        { name: 'symmetric', args: [[[2, 1], [1, 2]], 50], expect: 3, compare: 'approx', tolerance: 1e-6 },
        { name: 'not symmetric', args: [[[4, 1], [2, 3]], 60], expect: 5, compare: 'approx', tolerance: 1e-6 },
        { name: 'negative dominant', args: [[[1, 0], [0, -3]], 60], expect: -3, compare: 'approx', tolerance: 1e-6 },
        { name: 'diagonal', args: [[[3, 0], [0, 1]], 40], expect: 3, compare: 'approx', tolerance: 1e-6, hidden: true },
      ],
    },
    hints: [
      'Repeated multiplication by $A$ amplifies the direction with the biggest $|\\lambda|$.',
      'Loop `steps` times: multiply, then normalise. Finish with the Rayleigh quotient.',
      'Inside the loop: `const w = [A[0][0]*v[0] + A[0][1]*v[1], A[1][0]*v[0] + A[1][1]*v[1]];`',
    ],
    solution: {
      steps: [
        { text: 'Multiply and normalise in a loop: each pass shrinks the non-dominant component by $|\\lambda_2/\\lambda_1|$.', why: 'Write $\\vec v$ in the eigenbasis; $A^k$ scales each part by $\\lambda_i^k$.' },
        { text: 'Return $\\vec v \\cdot A\\vec v / \\vec v \\cdot \\vec v$.', why: 'For an eigenvector this equals $\\lambda$ exactly; the sign survives normalisation.' },
      ],
      answer: 'The loop plus the Rayleigh quotient (see the reference code).',
    },
    commonWrong: [{ answer: 'return the length of A v', why: 'The length is $|\\lambda|$ and loses the sign: for the third test it gives $3$, not $-3$.' }],
  },
];

export const QUIZ: QuizSpec = [
  {
    id: 'q-what-must',
    kind: 'choice',
    prompt: 'A matrix sends $\\vec v = (1, 2)$ to $A\\vec v = (3, 6)$. Which statement must be true?',
    options: [
      { text: '$\\vec v$ is an eigenvector of $A$ with eigenvalue 3.', why: '$A\\vec v = 3\\vec v$ says exactly that $\\vec v$ is only stretched, by 3.' },
      { text: '$\\vec v$ is an eigenvector of $A$ with eigenvalue $\\tfrac13$.', why: 'The factor goes the other way: $A\\vec v$ is three times $\\vec v$, not a third.' },
      { text: '$A = 3I$, three times the identity.', why: 'One vector being tripled doesn’t make $A$ triple everything: $\\begin{bmatrix} 1 & 1 \\\\ 0 & 3 \\end{bmatrix}$ also sends $(1, 2)$ to $(3, 6)$.' },
      { text: '$\\vec v$ is not an eigenvector, because $A$ changed its length.', why: 'Changing length is allowed; turning is not. $(3, 6)$ lies on the same line as $(1, 2)$.' },
    ],
    correct: 0,
  },
  {
    id: 'q-zero-eigenvalue',
    kind: 'choice',
    prompt: 'If $\\lambda = 0$ is an eigenvalue of $A$, then…',
    options: [
      { text: '$A$ is not invertible.', why: 'Some nonzero $\\vec v$ has $A\\vec v = \\zerovec$, so $A$ squashes a direction flat and $\\det A = 0$.' },
      { text: '$A$ is the zero matrix.', why: '$\\begin{bmatrix} 1 & 0 \\\\ 0 & 0 \\end{bmatrix}$ has eigenvalue 0 but isn’t zero.' },
      { text: 'Every vector is an eigenvector.', why: 'Only the vectors $A$ sends to $\\zerovec$ (and the other eigen-directions) are.' },
      { text: '$A$ has no eigenvectors.', why: 'The $\\vec v$ with $A\\vec v = \\zerovec$ is an eigenvector, with eigenvalue 0.' },
    ],
    correct: 0,
  },
  {
    id: 'q-order-diag',
    kind: 'drag',
    prompt: 'Order the eigenvalues of $\\diag(3, -5, 1)$ from smallest to largest.',
    target: { mode: 'order', items: ['$3$', '$-5$', '$1$'], correct: [1, 2, 0] },
    whyRight: 'A diagonal matrix’s eigenvalues are its diagonal entries: $-5 < 1 < 3$.',
    whyWrong: 'Read them off the diagonal, then sort: negative numbers come first.',
  },
  {
    id: 'q-how-many',
    kind: 'choice',
    prompt: 'Counting multiplicity, how many complex eigenvalues does a $3 \\times 3$ matrix have?',
    options: [
      { text: 'Exactly 3', why: '$\\det(A - \\lambda I)$ is a cubic, and a cubic has 3 complex roots counted with multiplicity.' },
      { text: 'At most 2', why: 'The characteristic polynomial of a $3\\times 3$ matrix has degree 3.' },
      { text: 'Exactly 1', why: 'Some may repeat, but counted with multiplicity there are 3.' },
      { text: 'Infinitely many', why: 'That would need the polynomial to vanish everywhere, but its $\\lambda^3$ coefficient is $\\pm 1$.' },
    ],
    correct: 0,
  },
];

export const PREDICT: PredictSpec = {
  id: 'predict-directions',
  prompt: 'Before you drag: how many directions does $A = \\begin{bmatrix} 2 & 1 \\\\ 1 & 2 \\end{bmatrix}$ leave unturned?',
  guess: { kind: 'choice', options: ['None', 'One', 'Two', 'Every direction'], answer: 2 },
  reveal: 'Two: the line $y = x$ (stretched $\\times 3$) and the line $y = -x$ (left as it is). Every other arrow is turned.',
  wrong: 'Most matrices turn almost every arrow; the unturned directions are rare, which is why they deserve a name.',
};

export const TRAPS: readonly TrapSpec[] = [
  {
    id: 'trap-every-matrix',
    myth: 'Every matrix has eigenvectors',
    explanation: 'Not over the real numbers. A rotation by 90°, $R = \\begin{bmatrix} 0 & -1 \\\\ 1 & 0 \\end{bmatrix}$, turns every arrow a quarter turn, so no direction survives. The algebra agrees: $\\det(R - \\lambda I) = \\lambda^2 + 1$, never zero for real $\\lambda$.',
    truth: 'A real $2 \\times 2$ matrix can have no real eigenvectors. Allow complex numbers and every matrix has eigenvalues.',
    figure: 'rotation',
    figureCaption: 'A quarter-turn rotation: every arrow ends up perpendicular to where it started.',
    figureDescription: 'Eight arrows from the origin and their images under a 90° rotation; each image is at right angles to its arrow, so none stays on its own line.',
  },
  {
    id: 'trap-zero-vector',
    myth: 'The zero vector is an eigenvector of every matrix',
    explanation: '$A\\zerovec = \\lambda\\zerovec$ holds for every $\\lambda$, so allowing $\\zerovec$ would make every number an eigenvalue of every matrix. That is why the definition demands $\\vec v \\ne \\zerovec$.',
    truth: 'Eigenvectors are nonzero by definition. (The eigenvalue $\\lambda = 0$ is allowed; the eigenvector $\\zerovec$ is not.)',
    figure: 'zero-vector',
    figureCaption: 'The origin goes to itself under every matrix, whatever the stretch factor.',
    figureDescription: 'A dot at the origin labelled with three different stretch factors, all of which leave it where it is, next to a nonzero eigenvector that only one factor fits.',
  },
];

/** Key formulas as data (types.ts FormulaSpec): audited in Node, rendered with <Formula {...spec} />. */
export const FORMULAS: readonly FormulaSpec[] = [
  {
    id: 'eigen-definition',
    label: 'Definition',
    size: 'hero',
    tex: '\\anchor{Av}{\\anchor{A}{\\cMatrix}\\anchor{v}{\\cInput}} = \\anchor{lam}{\\cEigenvalue}\\anchor{v}{\\cInput}',
    explain: {
      Av: { word: 'the image', gloss: 'where $A$ sends $\\vec v$', concept: 'output' },
      A: { word: 'the matrix', gloss: 'a rule that moves every vector', concept: 'matrix' },
      v: { word: 'a nonzero vector', gloss: 'the same one on both sides', concept: 'input' },
      lam: { word: 'a plain number', gloss: 'how much $\\vec v$ is stretched', concept: 'eigenvalue' },
    },
    brackets: [{ anchor: 'Av', text: 'where $A$ sends $\\vec v$', concept: 'output' }],
    inWords: 'Applying [the matrix]{matrix} to [the vector]{input} gives back the same vector, only stretched by [the number $\\lambda$]{eigenvalue}.',
  },
];

export const DERIVATIONS: readonly DerivationSpec[] = [
  {
    id: 'characteristic-equation',
    label: 'Why det(A − λI) = 0',
    steps: [
      { tex: '\\anchor{A}{A}\\vec v = \\anchor{lam}{\\lambda}\\vec v', why: 'The definition, with $\\vec v \\ne \\zerovec$.' },
      { rel: '\\iff', tex: '\\anchor{A}{A}\\vec v - \\anchor{lam}{\\lambda} \\chg{I}\\vec v = \\zerovec', why: 'Move everything to one side; write $\\lambda\\vec v$ as $\\lambda I\\vec v$ so both terms are matrices times $\\vec v$.' },
      { rel: '\\iff', tex: '\\chg{(\\anchor{A}{A} - \\anchor{lam}{\\lambda} I)}\\vec v = \\zerovec', why: 'Factor out $\\vec v$ (matrix multiplication distributes).' },
      { rel: '\\iff', tex: '\\det(\\anchor{A}{A} - \\anchor{lam}{\\lambda} I) = 0', why: 'A nonzero $\\vec v$ is sent to $\\zerovec$ exactly when the matrix squashes space flat: determinant zero.' },
    ],
  },
];

export const GLOSSARY: readonly GlossaryTerm[] = [
  { term: 'eigenvector', definition: 'A nonzero vector $\\vec v$ that a matrix only stretches: $A\\vec v = \\lambda\\vec v$.' },
  { term: 'eigenvalue', definition: 'The stretch factor $\\lambda$ in $A\\vec v = \\lambda\\vec v$.' },
];

export const REFERENCES: readonly Reference[] = [
  { authors: 'Strang, G.', title: 'Introduction to Linear Algebra', kind: 'book', edition: '6th ed.', publisher: 'Wellesley-Cambridge Press', year: 2023, section: '§6.1' },
  { authors: 'Axler, S.', title: 'Linear Algebra Done Right', kind: 'book', edition: '4th ed.', publisher: 'Springer', year: 2024, section: 'ch. 5' },
];
