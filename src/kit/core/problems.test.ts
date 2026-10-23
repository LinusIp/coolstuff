import { describe, expect, it } from 'vitest';
import {
  DegenerateGeneratorError,
  acceptParams,
  defineExample,
  drawTyped,
  forEachSeed,
  auditExamples,
  auditProblems,
  auditQuiz,
  drawProblem,
  exampleDefaults,
  findUglyNumbers,
  generator,
  paramSamples,
  resolveExample,
} from './problems';
import { checkNumeric } from './answers';
import { codeVerdict, compareValues, formatValue, runCodeTests, stable } from './codecheck';
import { DEMO, DEMO_MACROS, EXAMPLES, PROBLEMS, QUIZ } from '../gallery/samples';
import type { CodeAnswer, NumericAnswer, ProblemGenerator, ProblemSpec, StepSpec, WorkedExampleSpec } from '../types';

const macros = DEMO_MACROS;

describe('the reference samples pass every audit', () => {
  it('problems', () => expect(auditProblems(PROBLEMS, { macros })).toEqual([]));
  it('worked examples', () => expect(auditExamples(EXAMPLES, { macros })).toEqual([]));
  it('quick check', () => expect(auditQuiz(QUIZ, { macros })).toEqual([]));

  it('worked examples state the right answers (tested independently)', () => {
    const [direct, live, exam] = EXAMPLES;
    expect(resolveExample(direct).value).toEqual([5, 2]);
    for (const p of paramSamples(live)) {
      const r = resolveExample(live, p);
      const a = p.a;
      // Independent: eigenvalues of [[a,1],[1,a]] from the quadratic formula.
      const tr = 2 * a;
      const det = a * a - 1;
      const disc = Math.sqrt(tr * tr - 4 * det);
      expect(r.value).toEqual([(tr + disc) / 2, (tr - disc) / 2].map((x) => expect.closeTo(x, 12)));
    }
    expect(resolveExample(exam).value).toEqual([2, 1, 1, 2]);
  });

  it('every generated triangular problem is right (tested independently)', () => {
    const spec = PROBLEMS[0];
    for (let seed = 1; seed <= 200; seed++) {
      const p = drawProblem(spec, seed);
      const m = /\\begin\{bmatrix\} (-?\d+) & (-?\d+) \\\\ 0 & (-?\d+)/.exec(p.prompt)!;
      const [a, , d] = m.slice(1).map(Number);
      const ans = p.answer as NumericAnswer;
      expect(ans.value).toBe(Math.max(a, d));
      expect(checkNumeric(String(Math.max(a, d)), ans).correct).toBe(true);
    }
  });
});

describe('drawing problems', () => {
  it('seed 0 is the authored instance; other seeds are deterministic', () => {
    const spec = PROBLEMS[0];
    expect(drawProblem(spec, 0).prompt).toBe(spec.prompt);
    expect(drawProblem(spec, 0).seed).toBe(0);
    expect(drawProblem(spec, 7)).toEqual(drawProblem(spec, 7));
    const prompts = new Set(Array.from({ length: 20 }, (_, k) => drawProblem(spec, k + 1).prompt));
    expect(prompts.size).toBeGreaterThan(10);
    // No generator: every seed gives the authored problem.
    expect(drawProblem(PROBLEMS[1], 99).prompt).toBe(PROBLEMS[1].prompt);
  });

  it('a generator that can never be satisfied fails loudly', () => {
    const bad: ProblemSpec = {
      ...PROBLEMS[0],
      id: 'bad',
      generate: generator({ params: (rng) => rng.int(1, 3), accept: () => 'always degenerate', build: () => PROBLEMS[0], maxTries: 20 }),
    };
    expect(() => drawProblem(bad, 1)).toThrow(DegenerateGeneratorError);
    expect(auditProblems([bad], { macros, minProblems: 1 }).some((e) => e.includes('no acceptable instance'))).toBe(true);
  });
});

describe('audits catch broken specs', () => {
  const base = PROBLEMS[3]; // symbolic
  const audit = (p: ProblemSpec) => auditProblems([p], { macros, minProblems: 1 });

  it('counts and difficulty mix', () => {
    const errs = auditProblems(PROBLEMS.slice(0, 3), { macros });
    expect(errs).toContain('only 3 problems; need at least 8');
    expect(errs.some((e) => e.includes('★★ standard'))).toBe(true);
  });

  it('hints, solutions, notes, TeX, ugly numbers', () => {
    expect(audit({ ...base, hints: ['a', 'b'] as unknown as ProblemSpec['hints'] }).join()).toMatch(/exactly 3 hints/);
    expect(audit({ ...base, hints: ['a', 'a', 'b'] }).join()).toMatch(/identical/);
    expect(audit({ ...base, commonWrong: [] }).join()).toMatch(/common wrong answer/);
    expect(audit({ ...base, prompt: 'Broken $\\frac{1}{$ TeX' }).join()).toMatch(/TeX error/);
    expect(audit({ ...base, prompt: 'Find $x$ when $y = 0.30000000000000004$.' }).join()).toMatch(/ugly number/);
    expect(audit({ ...base, solution: { ...base.solution, steps: [{ math: 'x = 1', why: '' }] } }).join()).toMatch(/why: empty/);
  });

  it('answers the checker must accept, and wrong answers it must not', () => {
    const num: ProblemSpec = { ...PROBLEMS[4], answer: { kind: 'numeric', value: 3, precision: { sig: 2 }, unit: 'm/s^2' }, commonWrong: [{ answer: 3.01, why: 'x' }] };
    expect(audit(num).join()).toMatch(/is accepted as right/);
    expect(audit({ ...num, answer: { kind: 'numeric', value: NaN, precision: 'exact' } }).join()).toMatch(/not finite/);
    expect(audit({ ...num, answer: { kind: 'numeric', value: 3, precision: 'exact', unit: 'furlongs' } }).join()).toMatch(/doesn't parse/);
    expect(audit({ ...base, commonWrong: [{ answer: '(lambda-5/2)^2 - 33/4', why: 'x' }] }).join()).toMatch(/equivalent to the answer/);
    expect(audit({ ...base, answer: { kind: 'symbolic', expr: 'lambda^^2', vars: ['lambda'] } }).join()).toMatch(/doesn't parse/);
  });

  it('choice, drag and code specs', () => {
    const choice = PROBLEMS[1];
    expect(audit({ ...choice, commonWrong: [{ answer: 1, why: 'x' }] }).join()).toMatch(/points at a correct option/);
    expect(audit({ ...choice, answer: { kind: 'choice', options: ['a', 'b'], correct: 5 } }).join()).toMatch(/out of range/);
    const drag = PROBLEMS[2];
    expect(audit({ ...drag, answer: { kind: 'drag', target: { mode: 'point', view: { x: [0, 1], y: [0, 1] }, start: [3, 3], answer: [3, 3], tolerance: 0.1, label: 'p' } } }).join()).toMatch(/outside the view/);
    const code = PROBLEMS.find((p) => p.id === 'power-iteration')!;
    const ans = code.answer as CodeAnswer;
    expect(audit({ ...code, answer: { ...ans, solution: ans.starter } }).join()).toMatch(/reference solution fails/);
    expect(audit({ ...code, answer: { ...ans, starter: ans.solution } }).join()).toMatch(/starter code already passes/);
  });

  it('examples and quizzes', () => {
    expect(auditExamples(EXAMPLES.slice(0, 1), { macros })).toEqual(expect.arrayContaining(['only 1 worked examples; need at least 3', 'no "exam" worked example']));
    expect(auditQuiz(QUIZ.slice(0, 2), { macros })[0]).toMatch(/need 4–6/);
  });
});

describe('worked example helpers', () => {
  it('defaults and parameter samples', () => {
    const live = EXAMPLES[1];
    expect(exampleDefaults(live)).toEqual({ a: 2 });
    const samples = paramSamples(live);
    expect(samples[0]).toEqual({ a: 2 });
    expect(samples).toContainEqual({ a: -3 });
    expect(samples).toContainEqual({ a: 3 });
    for (const s of samples) expect(Math.abs((s.a * 2) % 1)).toBe(0); // on the 0.5 step grid
    expect(resolveExample(live, { a: -1.5 }).answer).toBe('$\\lambda_1 = -0.5,\\ \\lambda_2 = -2.5$');
    expect(resolveExample(EXAMPLES[0]).known).toEqual(['The matrix $B$. It is $2\\times 2$, so expect at most two eigenvalues.']);
  });

  it('flags ugly numbers', () => {
    expect(findUglyNumbers('x = 0.30000000000000004')).toEqual(['0.30000000000000004']);
    expect(findUglyNumbers('got NaN and x = undefined')).toEqual(['NaN', 'undefined']);
    expect(findUglyNumbers('the null space; the limit is undefined there')).toEqual([]);
    expect(findUglyNumbers('value -0 here')).toEqual(['-0']);
    expect(findUglyNumbers('1.2e-7 m')).toEqual(['1.2e-7']);
    expect(findUglyNumbers('fine: 3.25, −0.5, 10, 2024')).toEqual([]);
  });
});

describe('code checking', () => {
  const spec = PROBLEMS.find((p) => p.id === 'power-iteration')!.answer as CodeAnswer;

  it('runs the reference solution and reports failures', () => {
    const ok = runCodeTests(spec.solution, spec);
    expect(ok).toMatchObject({ ok: true, passed: 4, total: 4 });
    expect(codeVerdict(ok).message).toBe('All 4 tests pass.');
    const starter = runCodeTests(spec.starter, spec);
    expect(starter.passed).toBe(0);
    expect(codeVerdict(starter).message).toBe('0 of 4 tests pass. First failure: expected 3, got 0.');
  });

  it('compile errors, missing entry, throws, undefined returns, logs', () => {
    expect(runCodeTests('function powerIteration( {', spec).compileError).toBeTruthy();
    expect(runCodeTests('function other() {}', spec).compileError).toBe('Define a function called powerIteration.');
    const thrown = runCodeTests('function powerIteration() { throw new Error("boom"); }', spec);
    expect(thrown.results[0].error).toBe('boom');
    const undef = runCodeTests('function powerIteration() { console.log("hi", [1, 2]); }', spec);
    expect(undef.results[0].error).toMatch(/forget to return/);
    expect(undef.logs[0]).toBe('hi [1,2]');
  });

  it('arguments are cloned per test', () => {
    const t = { entry: 'f', tests: [{ args: [[1]], expect: 2 }, { args: [[1]], expect: 2 }] };
    expect(runCodeTests('function f(a) { a.push(1); return a.length; }', t).ok).toBe(true);
  });

  it('compares deep, approx, unordered and set', () => {
    expect(compareValues({ b: 1, a: [1, 2] }, { a: [1, 2], b: 1 })).toBe(true);
    expect(compareValues([1, 2], [2, 1])).toBe(false);
    expect(compareValues([1, 2, 2], [2, 1, 2], 'unordered')).toBe(true);
    expect(compareValues([1, 2, 2], [2, 1], 'set')).toBe(true);
    expect(compareValues([0.1 + 0.2], [0.3], 'approx', 1e-9)).toBe(true);
    expect(compareValues(NaN, NaN)).toBe(true);
    expect(stable(new Map([['b', 1], ['a', 2]]))).toBe(stable(new Map([['a', 2], ['b', 1]])));
    expect(formatValue('x')).toBe('"x"');
    expect(formatValue(0.1 + 0.2)).toBe('0.3');
  });
});

describe('review fixes: typed draws, live-example guards, stricter audits', () => {
  const audit = (p: ProblemSpec, extra: Partial<Parameters<typeof auditProblems>[1]> = {}) => auditProblems([p], { macros, minProblems: 1, ...extra });

  it('drawTyped / forEachSeed tie params to the generator', () => {
    const spec = PROBLEMS[0];
    const gen = spec.generate as ProblemGenerator<{ a: number; b: number; d: number }>;
    const inst = drawTyped(spec, gen, 5);
    expect(inst.params.a).toEqual(expect.any(Number));
    expect((inst.answer as NumericAnswer).value).toBe(Math.max(inst.params.a, inst.params.d));
    let n = 0;
    forEachSeed(spec, gen, (i, p) => {
      expect((i.answer as NumericAnswer).value).toBe(Math.max(p.a, p.d));
      n++;
    }, 30);
    expect(n).toBe(30);
    expect(() => drawTyped(spec, generator({ params: () => 1, accept: () => true, build: () => spec }), 1)).toThrow(/doesn't use this generator/);
    expect(() => drawTyped(spec, gen, 0)).toThrow(/seed 0/);
  });

  it('live examples: accept() guard, choice params, defaults must pass', () => {
    const guarded = defineExample<{ a: number; f: number }>({
      ...(EXAMPLES[1] as unknown as WorkedExampleSpec<{ a: number; f: number }>),
      id: 'guarded',
      params: {
        a: { label: '$a$', min: -3, max: 3, step: 0.5, value: 2 },
        f: { kind: 'choice', label: 'Function', options: ['$x^2$', '$x^3$'], value: 0 },
      },
      accept: (p) => (p.a === 1 ? 'a = 1 makes the matrix singular' : true),
    });
    const samples = paramSamples(guarded);
    expect(samples[0]).toEqual({ a: 2, f: 0 });
    expect(samples).toContainEqual({ a: 2, f: 1 });
    expect(samples.some((s) => s.a === 1)).toBe(false);
    expect(acceptParams(guarded, { a: 1, f: 0 })).toMatch(/singular/);
    const badDefault = defineExample<{ a: number }>({ ...(EXAMPLES[1] as unknown as WorkedExampleSpec<{ a: number }>), id: 'bad-default', accept: () => 'never' });
    expect(auditExamples([badDefault], { macros, minExamples: 1 }).join()).toMatch(/rejects the default parameters/);
  });

  it('worked examples need a try-it prompt before every step after the first, and real `uses`', () => {
    const ex = EXAMPLES[0];
    const steps = (ex.steps as readonly StepSpec[]).map((s) => ({ ...s, tryIt: undefined }));
    expect(auditExamples([{ ...ex, steps }], { macros, minExamples: 1 }).join()).toMatch(/step 2 tryIt: empty/);
    expect(auditExamples([EXAMPLES[1]], { macros, minExamples: 1, knownLessons: ['linalg/eigenvectors'] }).join()).toMatch(/uses "linalg\/determinant", which isn't a lesson/);
    expect(auditExamples([EXAMPLES[1]], { macros, minExamples: 1, knownLessons: new Set(['linalg/determinant']) })).toEqual([]);
  });

  it('generated output is checked for ugly typesetting', () => {
    const spec = PROBLEMS[0];
    const gen = spec.generate as ProblemGenerator<{ a: number; b: number; d: number }>;
    const ugly: ProblemSpec = {
      ...spec,
      generate: generator({ ...gen, build: (p) => ({ ...gen.build(p), prompt: `Solve $x - ${p.b - 10} = 0$.` }) }),
    };
    expect(audit(ugly).join()).toMatch(/ugly maths in "x - -/);
  });

  it('custom drag targets need a figure; drag common wrongs must be well-formed and wrong', () => {
    const drag = PROBLEMS[2];
    const custom: ProblemSpec = { ...drag, answer: { kind: 'drag', target: { mode: 'custom', initial: 0, check: (s) => s === 1 } }, commonWrong: [{ answer: '2', why: 'x' }] };
    expect(audit(custom).join()).toMatch(/needs the problem's `figure` key/);
    expect(audit({ ...custom, figure: 'dial' })).toEqual([]);
    expect(audit({ ...drag, commonWrong: [{ answer: 'nope', why: 'x' }] }).join()).toMatch(/isn't a JSON state/);
    expect(audit({ ...drag, commonWrong: [{ answer: '[3, 3]', why: 'x' }] }).join()).toMatch(/accepted as right/);
  });

  it('numeric answer extensions are audited', () => {
    const ev = PROBLEMS.find((p) => p.id === 'eigenvector-for-3')!;
    expect(audit(ev)).toEqual([]);
    const a = ev.answer as NumericAnswer;
    expect(audit({ ...ev, answer: { ...a, shape: [2, 2] } }).join()).toMatch(/shape 2×2 doesn't match 2 values/);
    expect(audit({ ...ev, answer: { ...a, value: 3, equivalence: 'direction' } }).join()).toMatch(/needs a vector answer/);
    expect(audit({ ...ev, answer: { ...a, check: () => false } }).join()).toMatch(/check\(\) rejects the stated value/);
    expect(audit({ ...ev, commonWrong: [{ answer: [2, 2], why: 'x' }] }).join()).toMatch(/accepted as right/);
    const cplx: ProblemSpec = { ...ev, answer: { kind: 'numeric', value: [0, 1, 0, -1], ordered: false, precision: 'exact', complex: true }, commonWrong: [{ answer: '1, -1', why: 'real' }] };
    expect(audit(cplx)).toEqual([]);
  });

  it('a set of 8+ problems must mix answer kinds; concept names must exist', () => {
    const numeric = Array.from({ length: 8 }, (_, k) => ({ ...PROBLEMS[0], id: `n${k}`, difficulty: ([1, 1, 1, 2, 2, 2, 3, 3] as const)[k], generate: undefined }));
    expect(auditProblems(numeric, { macros }).join()).toMatch(/mix the answer types/);
    const typo: ProblemSpec = { ...PROBLEMS[1], prompt: 'Which [vector]{inptu} is it, $\\colorTerm{matrx}{A}$?' };
    const errs = auditProblems([typo], { concepts: DEMO, minProblems: 1 }).join();
    expect(errs).toMatch(/unknown concept "inptu"/);
    expect(errs).toMatch(/unknown concept "matrx"/);
  });

  it('flags prose between two unescaped dollar signs', () => {
    const base = PROBLEMS[3];
    expect(audit({ ...base, prompt: 'It costs $5 and $6 in total, find $\\lambda$.' }).join()).toMatch(/literal dollar/);
    expect(audit({ ...base, prompt: 'It costs \\$5 and \\$6; find $\\lambda$.' }).join()).not.toMatch(/literal dollar/);
  });
});
