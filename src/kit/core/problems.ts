/**
 * Problem and worked-example plumbing shared by the practice components and
 * every lesson's tests: draw a problem instance ("another one"), resolve a
 * worked example's live parameters, and AUDIT specs against CLAUDE.md §5/§10
 * so a lesson's `lesson.test.ts` can simply say
 *
 *   expect(auditProblems(PROBLEMS, { macros: C.macros() })).toEqual([]);
 *   expect(auditExamples(EXAMPLES, { macros: C.macros() })).toEqual([]);
 *   expect(auditQuiz(QUIZ, { macros: C.macros() })).toEqual([]);
 *
 * Pure (Node-safe). Audits render every TeX snippet with KaTeX, run code
 * solutions, and draw each generator over many seeds.
 */
import katex from 'katex';
import { texOptions } from '../notation';
import { GLOBAL_CONCEPTS, type ConceptSet } from '../theme';
import { checkDrag, checkNumeric, dragStateOf, formatAtPrecision } from './answers';
import { runCodeTests } from './codecheck';
import { equivalent, tryParseExpr } from './expr';
import { findUglyTex } from './pretty';
import { parseRich, richTex, type Inline } from './richtext';
import { createRng } from './rng';
import { parseUnit } from './units';
import type {
  AnswerSpec,
  ExampleLevel,
  ExampleParam,
  ParamValues,
  ProblemBody,
  ProblemGenerator,
  ProblemInstance,
  ProblemSpec,
  QuizSpec,
  ResolvedExample,
  Rich,
  StepSpec,
  WorkedExampleSpec,
} from '../types';

// ── Generators ──────────────────────────────────────────────────────────

/** Identity helper so `P` is inferred from `params` (and `accept`/`build` are typed). */
export function generator<P>(g: ProblemGenerator<P>): ProblemGenerator<P> {
  return g;
}

export class DegenerateGeneratorError extends Error {
  constructor(
    readonly problemId: string,
    readonly seed: number,
    readonly reasons: readonly string[],
  ) {
    super(`Problem "${problemId}": no acceptable instance in ${reasons.length} tries from seed ${seed} (last rejection: ${reasons[reasons.length - 1] ?? 'none'})`);
    this.name = 'DegenerateGeneratorError';
  }
}

/**
 * The instance to show: seed 0 (or a spec without a generator) is the authored
 * problem; any other seed draws from the generator by rejection sampling.
 */
export function drawProblem(spec: ProblemSpec, seed: number): ProblemInstance {
  const base = { id: spec.id, difficulty: spec.difficulty, title: spec.title };
  if (seed === 0 || !spec.generate) {
    const { prompt, answer, hints, solution, commonWrong, figure } = spec;
    return { ...base, prompt, answer, hints, solution, commonWrong, figure, seed: 0 };
  }
  const g = spec.generate;
  const rng = createRng(`${spec.id}#${seed}`);
  const reasons: string[] = [];
  const max = g.maxTries ?? 500;
  for (let k = 0; k < max; k++) {
    const p = g.params(rng);
    const ok = g.accept(p);
    if (ok === true) return { ...base, ...g.build(p), seed, params: p };
    reasons.push(typeof ok === 'string' ? ok : 'rejected');
  }
  throw new DegenerateGeneratorError(spec.id, seed, reasons);
}

/**
 * `drawProblem` with the generator's parameter type: for lesson tests that
 * recompute each generated answer independently. Pass the same generator the
 * spec uses (it throws otherwise), so the cast to `P` is checked.
 *
 *   const inst = drawTyped(PROBLEMS[0], triangular, 7);   // inst.params: { a, b, d }
 */
export function drawTyped<P>(spec: ProblemSpec, gen: ProblemGenerator<P>, seed: number): ProblemInstance & { params: P } {
  if ((spec.generate as unknown) !== gen) throw new Error(`drawTyped: problem "${spec.id}" doesn't use this generator`);
  if (seed === 0) throw new Error('drawTyped: seed 0 is the authored instance, which has no params; use seeds ≥ 1');
  return drawProblem(spec, seed) as ProblemInstance & { params: P };
}

/** Run `fn` on generated instances for seeds 1…n (default 200), typed by the generator. */
export function forEachSeed<P>(spec: ProblemSpec, gen: ProblemGenerator<P>, fn: (inst: ProblemInstance & { params: P }, params: P, seed: number) => void, n = 200): void {
  for (let seed = 1; seed <= n; seed++) {
    const inst = drawTyped(spec, gen, seed);
    fn(inst, inst.params, seed);
  }
}

// ── Worked examples ─────────────────────────────────────────────────────

/** Erase the parameter type so examples with different params share one array. */
export function defineExample<P extends ParamValues>(spec: WorkedExampleSpec<P>): WorkedExampleSpec {
  return spec as unknown as WorkedExampleSpec;
}

/** Starting values of an example's live parameters (a choice parameter's value is its option index). */
export function exampleDefaults(spec: WorkedExampleSpec): ParamValues {
  const out: ParamValues = {};
  for (const [k, p] of Object.entries(spec.params ?? {}) as [string, ExampleParam][]) out[k] = p.value;
  return out;
}

/** Is this parameter setting allowed by the example's `accept` guard? true, or the learner-facing reason. */
export function acceptParams(spec: WorkedExampleSpec, p: ParamValues): true | string {
  if (!spec.accept) return true;
  try {
    return spec.accept(p);
  } catch (err) {
    return `accept() throws: ${(err as Error).message}`;
  }
}

const live = <T>(v: T | ((p: ParamValues) => T), p: ParamValues): T => (typeof v === 'function' ? (v as (p: ParamValues) => T)(p) : v);
const list = (v: Rich | readonly Rich[]): readonly Rich[] => (typeof v === 'string' ? [v] : v);

/** Resolve every `Live` field for one set of parameter values (defaults fill the gaps). */
export function resolveExample(spec: WorkedExampleSpec, params: Partial<ParamValues> = {}): ResolvedExample {
  const p: ParamValues = { ...exampleDefaults(spec) };
  for (const [k, v] of Object.entries(params)) if (typeof v === 'number') p[k] = v;
  return {
    id: spec.id,
    level: spec.level,
    title: spec.title,
    statement: live(spec.statement, p),
    known: list(live(spec.known, p)),
    want: list(live(spec.want, p)),
    strategy: live(spec.strategy, p),
    steps: live(spec.steps, p),
    answer: live(spec.answer, p),
    value: spec.value === undefined ? undefined : live(spec.value, p),
    sanity: live(spec.sanity, p),
    params: p,
    figure: spec.figure,
  };
}

/**
 * Parameter values to test a live example at: the defaults, each numeric
 * parameter's min and max and each choice option (others at default), plus
 * seeded random points. Settings the example's `accept` rejects are skipped
 * (the defaults are always first; `auditExamples` requires them to pass).
 */
export function paramSamples(spec: WorkedExampleSpec, random = 8): ParamValues[] {
  const entries = Object.entries(spec.params ?? {}) as [string, ExampleParam][];
  if (entries.length === 0) return [{}];
  const def = exampleDefaults(spec);
  const snap = (x: number, q: Extract<ExampleParam, { min: number }>) => Math.min(q.max, Math.max(q.min, q.min + Math.round((x - q.min) / q.step) * q.step));
  const out: ParamValues[] = [def];
  for (const [k, q] of entries) {
    if (q.kind === 'choice') q.options.forEach((_, i) => i !== q.value && out.push({ ...def, [k]: i }));
    else {
      out.push({ ...def, [k]: q.min });
      out.push({ ...def, [k]: q.max });
    }
  }
  const rng = createRng(`${spec.id}#params`);
  for (let i = 0; i < random; i++) {
    const p: ParamValues = {};
    for (const [k, q] of entries) {
      if (q.kind === 'choice') p[k] = rng.int(0, q.options.length - 1);
      else if (q.scale === 'log' && q.min > 0) p[k] = Number(snap(Math.exp(rng.float(Math.log(q.min), Math.log(q.max))), q).toFixed(10));
      else p[k] = Number(snap(rng.float(q.min, q.max), q).toFixed(10));
    }
    out.push(p);
  }
  return out.filter((p, i) => i === 0 || acceptParams(spec, p) === true);
}

// ── Audits ──────────────────────────────────────────────────────────────

export interface AuditOptions {
  /** Lesson concept shorthands, so TeX using \cMatrix renders. Default: `concepts.macros()` when `concepts` is a ConceptSet. */
  macros?: Readonly<Record<string, string>>;
  /** The lesson's concepts (or their names): every `\colorTerm{x}`, `[text]{x}` and `concept: 'x'` must name one of them or a global meaning. */
  concepts?: ConceptSet | readonly string[];
  /** Generated instances to draw per problem. Default 60. */
  seeds?: number;
  /** Lesson ids that exist (curriculum.ts `LESSON_BY_ID` keys): worked examples' `uses` must be among them. */
  knownLessons?: ReadonlySet<string> | readonly string[];
}

/** Internal: the audit context, with `generated` set while auditing generator / live-parameter output. */
interface Ctx extends AuditOptions {
  generated?: boolean;
}

const isConceptSet = (c: unknown): c is ConceptSet => !!c && typeof (c as ConceptSet).macros === 'function' && Array.isArray((c as ConceptSet).names);

/** Normalise options: macros from the concept set when not given. */
function ctxOf(o: AuditOptions): Ctx {
  return { ...o, macros: o.macros ?? (isConceptSet(o.concepts) ? o.concepts.macros() : undefined) };
}

function conceptNames(o: AuditOptions): Set<string> | null {
  if (!o.concepts) return null;
  const names = isConceptSet(o.concepts) ? o.concepts.names : o.concepts;
  return new Set<string>([...names, ...Object.keys(GLOBAL_CONCEPTS)]);
}

/** Concept names a TeX snippet refers to through \colorTerm{…} / \ct{…}. */
export function texConceptRefs(tex: string): string[] {
  return [...tex.matchAll(/\\(?:colorTerm|ct)\s*\{\s*([^{}\s]+)\s*\}/g)].map((m) => m[1]);
}

/** Concept names a Rich string refers to: [text]{concept} terms and \colorTerm in its maths. */
export function richConceptRefs(text: Rich): string[] {
  const out: string[] = [];
  const walk = (ns: Inline[]) => {
    for (const n of ns) {
      if (n.t === 'term') out.push(n.concept);
      if (n.t === 'math') out.push(...texConceptRefs(n.tex));
      if ('c' in n) walk(n.c);
    }
  };
  for (const b of parseRich(text)) {
    if (b.t === 'p') walk(b.c);
    else if (b.t === 'math') out.push(...texConceptRefs(b.tex));
    else b.items.forEach(walk);
  }
  return out;
}

function checkConcepts(where: string, refs: readonly string[], o: Ctx, out: string[]): void {
  const known = conceptNames(o);
  if (!known) return;
  for (const r of new Set(refs)) if (!known.has(r)) out.push(`${where}: unknown concept "${r}" (defined: ${[...known].join(', ')})`);
}

/** Check a concept reference given as a field (`concept: 'matrix'`). */
export function auditConceptRef(where: string, concept: string | undefined, o: AuditOptions, out: string[]): void {
  if (concept !== undefined) checkConcepts(where, [concept], o, out);
}

/**
 * Numbers a learner should never see: float noise (0.30000000000000004),
 * more than 6 decimals, NaN, Infinity, "= undefined", "-0", "1e-7"-style exponents.
 */
export function findUglyNumbers(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(/-?\d+\.\d{7,}/g)) bad.push(m[0]);
  for (const m of text.matchAll(/\b(NaN|Infinity)\b/g)) bad.push(m[0]);
  for (const m of text.matchAll(/[=(,$]\s*(undefined|null)\b/g)) bad.push(m[1]);
  for (const m of text.matchAll(/(^|[^\w.])-0(?![.\d])/g)) bad.push(m[0].trim());
  for (const m of text.matchAll(/\d(?:\.\d+)?e[+-]?\d+/gi)) bad.push(m[0]);
  return bad;
}

function texErrors(tex: string, macros: AuditOptions['macros']): string | null {
  try {
    katex.renderToString(tex, texOptions(false, { macros, throwOnError: true }));
    return null;
  } catch (err) {
    return (err as Error).message.split('\n')[0];
  }
}

/** Inline maths that is probably prices with unescaped dollars: "$5 and $" → content "5 and ". */
const LOOKS_LIKE_PRICES = /^\s*\d[\d.,]*\s+[A-Za-z]{2,}(?:\s+[A-Za-z]+)*\s*$/;

/** Check one Rich field: non-empty, valid TeX, real concept names, no ugly numbers or typesetting. Exported for lesson-level audits. */
export function auditRich(where: string, text: Rich | undefined, o: AuditOptions, out: string[], required = true): void {
  if (text === undefined || text.trim() === '') {
    if (required) out.push(`${where}: empty`);
    return;
  }
  const c = o as Ctx;
  for (const tex of richTex(text)) {
    const e = texErrors(tex, c.macros);
    if (e) out.push(`${where}: TeX error in "${tex}": ${e}`);
    if (LOOKS_LIKE_PRICES.test(tex)) out.push(`${where}: "$${tex}$" looks like prose between two dollar signs; write a literal dollar as \\$`);
    const ugly = findUglyTex(tex, { strict: !!c.generated });
    if (ugly.length) out.push(`${where}: ugly maths in "${tex}": ${ugly.join('; ')}`);
  }
  checkConcepts(where, richConceptRefs(text), c, out);
  const ugly = findUglyNumbers(text.replace(/\$[^$]*\$/g, (m) => m.replace(/\\[a-zA-Z]+/g, '')));
  if (ugly.length) out.push(`${where}: ugly number(s) ${ugly.join(', ')}`);
}

/** Check one TeX field: valid, real concept names, no ugly numbers or typesetting. Exported for lesson-level audits. */
export function auditTex(where: string, tex: string | undefined, o: AuditOptions, out: string[]): void {
  if (!tex) return;
  const c = o as Ctx;
  const e = texErrors(tex, c.macros);
  if (e) out.push(`${where}: TeX error in "${tex}": ${e}`);
  checkConcepts(where, texConceptRefs(tex), c, out);
  const ugly = findUglyNumbers(tex.replace(/\\[a-zA-Z]+/g, ''));
  if (ugly.length) out.push(`${where}: ugly number(s) ${ugly.join(', ')}`);
  const uglyTex = findUglyTex(tex, { strict: !!c.generated });
  if (uglyTex.length) out.push(`${where}: ugly maths in "${tex}": ${uglyTex.join('; ')}`);
}

function auditSteps(where: string, steps: readonly StepSpec[], o: AuditOptions, out: string[], requireTryIt = false): void {
  if (steps.length === 0) out.push(`${where}: no steps`);
  steps.forEach((s, k) => {
    const w = `${where} step ${k + 1}`;
    if (!s.math && !s.text) out.push(`${w}: needs math or text`);
    auditTex(w, s.math, o, out);
    auditRich(`${w} text`, s.text, o, out, false);
    auditRich(`${w} why`, s.why, o, out);
    auditRich(`${w} title`, s.title, o, out, false);
    auditRich(`${w} tryIt`, s.tryIt, o, out, requireTryIt && k > 0);
  });
}

function auditAnswer(where: string, a: AnswerSpec, body: ProblemBody, o: AuditOptions, out: string[]): void {
  const cws = body.commonWrong;
  switch (a.kind) {
    case 'numeric': {
      const vals = typeof a.value === 'number' ? [a.value] : [...a.value];
      if (vals.length === 0 || !vals.every(Number.isFinite)) out.push(`${where}: numeric value is not finite`);
      if (a.unit) {
        try {
          parseUnit(a.unit);
        } catch (err) {
          out.push(`${where}: unit "${a.unit}" doesn't parse (${(err as Error).message})`);
        }
      }
      if (a.precision !== 'exact') {
        const n = 'decimals' in a.precision ? a.precision.decimals : a.precision.sig;
        if (!Number.isInteger(n) || n < 0 || n > 8) out.push(`${where}: odd precision ${JSON.stringify(a.precision)}`);
      }
      auditTex(`${where} label`, a.label, o, out);
      if (a.shape && (a.shape[0] * a.shape[1] !== vals.length || !a.shape.every((d) => Number.isInteger(d) && d >= 1))) {
        out.push(`${where}: shape ${a.shape.join('×')} doesn't match ${vals.length} values`);
      }
      if (a.equivalence && a.equivalence !== 'exact' && vals.length < 2) out.push(`${where}: equivalence "${a.equivalence}" needs a vector answer`);
      if (a.equivalence && a.equivalence !== 'exact' && vals.every((x) => x === 0)) out.push(`${where}: a "${a.equivalence}" answer can't be the zero vector`);
      if (a.complex && (vals.length % 2 !== 0 || a.unit)) out.push(`${where}: complex answers hold [re, im] pairs and no unit`);
      if (a.check) {
        let r: boolean | string;
        try {
          r = a.check(vals);
        } catch (err) {
          r = `throws ${(err as Error).message}`;
        }
        if (r !== true) out.push(`${where}: check() rejects the stated value (${r === false ? 'false' : r})`);
      }
      // The checker must accept the canonical answer as a learner would type it.
      const fmtVal = (v: number) => (a.precision === 'exact' ? String(v) : formatAtPrecision(v, a.precision).replace('−', '-'));
      let typed: string;
      if (a.complex) {
        const pairs: string[] = [];
        for (let k = 0; k + 1 < vals.length; k += 2) pairs.push(`${fmtVal(vals[k])} ${vals[k + 1] < 0 ? '-' : '+'} ${fmtVal(Math.abs(vals[k + 1]))}i`);
        typed = pairs.join(', ');
      } else typed = vals.map(fmtVal).join(', ');
      const withUnit = (t: string) => (a.unit && (a.askUnit ?? true) ? `${t} ${a.unit}` : t);
      const v = checkNumeric(withUnit(typed), a);
      if (!v.correct) out.push(`${where}: the checker rejects its own answer "${typed}" (${v.message})`);
      if (a.equivalence && a.equivalence !== 'exact' && vals.length > 1 && !a.check) {
        const scaled = vals.map((x) => fmtVal(x * 2)).join(', ');
        if (!checkNumeric(withUnit(scaled), a).correct) out.push(`${where}: twice the answer ("${scaled}") is rejected, but equivalence is "${a.equivalence}"`);
        const flipped = vals.map((x) => fmtVal(-x)).join(', ');
        const flipOk = checkNumeric(withUnit(flipped), a).correct;
        if (a.equivalence === 'scalar-multiple' && !flipOk) out.push(`${where}: minus the answer ("${flipped}") is rejected under "scalar-multiple"`);
        if (a.equivalence === 'direction' && flipOk) out.push(`${where}: minus the answer ("${flipped}") is accepted under "direction"`);
      }
      cws.forEach((w, k) => {
        if (typeof w.answer === 'string' && !a.complex) {
          const parts = w.answer.split(/[,;]/).map((x) => x.trim());
          if (parts.some((x) => x === '' || !checkNumeric(x, { kind: 'numeric', value: 0, precision: 'exact' }).reason.match(/correct|wrong|precision/))) {
            out.push(`${where} commonWrong ${k + 1}: answer should be a number (or exact form like 1/3) for a numeric problem`);
          }
        }
        const txt = typeof w.answer === 'number' ? String(w.answer) : typeof w.answer === 'string' ? w.answer : w.answer.join(', ');
        const r = checkNumeric(withUnit(txt), a);
        if (r.correct) out.push(`${where} commonWrong ${k + 1}: "${txt}" is accepted as right`);
      });
      break;
    }
    case 'symbolic': {
      const p = tryParseExpr(a.expr, { vars: a.vars });
      if (!p.ok) {
        out.push(`${where}: expected expression "${a.expr}" doesn't parse: ${p.error.message}`);
        break;
      }
      const self = equivalent(a.expr, a.expr, { vars: a.vars, domain: a.domain, upToConstant: a.upToConstant });
      if (!self.equivalent) out.push(`${where}: "${a.expr}" can't be sampled on its domain (${self.reason})`);
      auditTex(`${where} label`, a.label, o, out);
      cws.forEach((w, k) => {
        if (typeof w.answer !== 'string') {
          out.push(`${where} commonWrong ${k + 1}: answer should be an expression string`);
          return;
        }
        const r = equivalent(a.expr, w.answer, { vars: a.vars, domain: a.domain, upToConstant: a.upToConstant });
        if (r.equivalent) out.push(`${where} commonWrong ${k + 1}: "${w.answer}" is equivalent to the answer`);
        else if (r.reason === 'parse') out.push(`${where} commonWrong ${k + 1}: "${w.answer}" doesn't parse`);
      });
      break;
    }
    case 'choice': {
      const n = a.options.length;
      if (n < 2) out.push(`${where}: fewer than 2 options`);
      const correct = typeof a.correct === 'number' ? [a.correct] : [...a.correct];
      if (correct.length === 0 || correct.some((c) => !Number.isInteger(c) || c < 0 || c >= n)) out.push(`${where}: correct index out of range`);
      const texts = a.options.map((x) => (typeof x === 'string' ? x : x.text));
      if (new Set(texts).size !== texts.length) out.push(`${where}: duplicate options`);
      a.options.forEach((x, k) => {
        auditRich(`${where} option ${k + 1}`, typeof x === 'string' ? x : x.text, o, out);
        if (typeof x !== 'string') auditRich(`${where} option ${k + 1} why`, x.why, o, out, false);
      });
      auditRich(`${where} reasoning`, a.reasoning, o, out, false);
      cws.forEach((w, k) => {
        if (typeof w.answer !== 'number' || w.answer < 0 || w.answer >= n) out.push(`${where} commonWrong ${k + 1}: should be an option index`);
        else if (correct.includes(w.answer)) out.push(`${where} commonWrong ${k + 1}: points at a correct option`);
      });
      break;
    }
    case 'drag': {
      const t = a.target;
      if (t.mode === 'point') {
        const answers = typeof t.answer[0] === 'number' ? [t.answer as readonly number[]] : (t.answer as readonly (readonly number[])[]);
        for (const p of answers) {
          if (p[0] < t.view.x[0] || p[0] > t.view.x[1] || p[1] < t.view.y[0] || p[1] > t.view.y[1]) out.push(`${where}: answer point outside the view`);
        }
        if (checkDrag(t.start, t).correct) out.push(`${where}: the start position is already right`);
        if (!(t.tolerance > 0)) out.push(`${where}: tolerance must be > 0`);
        t.curves?.forEach((c, k) => {
          auditConceptRef(`${where} curve ${k + 1}`, c.concept, o, out);
          if (!tryParseExpr(c.expr, { vars: ['x'] }).ok) out.push(`${where} curve ${k + 1}: "${c.expr}" doesn't parse as an expression in x`);
        });
        if (t.constrain && 'curve' in t.constrain && !tryParseExpr(t.constrain.curve, { vars: ['x'] }).ok) out.push(`${where}: constrain.curve "${t.constrain.curve}" doesn't parse`);
      } else if (t.mode === 'order') {
        const sorted = [...t.correct].sort((x, y) => x - y);
        if (sorted.length !== t.items.length || sorted.some((x, k) => x !== k)) out.push(`${where}: order.correct isn't a permutation of the items`);
        if (t.correct.every((x, k) => x === k)) out.push(`${where}: items are already in the right order`);
        t.items.forEach((x, k) => auditRich(`${where} item ${k + 1}`, x, o, out));
      } else if (t.mode === 'match') {
        if (t.correct.length !== t.items.length || t.correct.some((s) => s < 0 || s >= t.slots.length)) out.push(`${where}: match.correct has a bad slot index`);
      } else if (t.mode === 'slider') {
        if (t.answer < t.min || t.answer > t.max) out.push(`${where}: slider answer outside [min, max]`);
        if (Math.abs(t.start - t.answer) <= t.tolerance) out.push(`${where}: the slider starts on the answer`);
      } else if (t.mode === 'custom') {
        if (t.check(t.initial)) out.push(`${where}: the initial state is already right`);
        if (!body.figure) out.push(`${where}: a custom drag target needs the problem's \`figure\` key (ProblemSet renders customs[figure])`);
      }
      // Every common wrong answer must be a well-formed state the checker rejects.
      cws.forEach((w, k) => {
        const state = dragStateOf(w);
        if (state === undefined) {
          out.push(`${where} commonWrong ${k + 1}: answer isn't a JSON state ("[1, 1]", "[2, 0, 1]")`);
          return;
        }
        let r;
        try {
          r = checkDrag(state, t, cws);
        } catch (err) {
          out.push(`${where} commonWrong ${k + 1}: the checker throws on it (${(err as Error).message})`);
          return;
        }
        if (r.correct) out.push(`${where} commonWrong ${k + 1}: "${w.answer}" is accepted as right`);
        else if (r.commonWrong === undefined && r.reason !== 'incomplete') out.push(`${where} commonWrong ${k + 1}: "${w.answer}" doesn't match itself (check its shape)`);
      });
      break;
    }
    case 'proof': {
      auditRich(`${where} model answer`, a.modelAnswer, o, out);
      if (a.checklist.length === 0) out.push(`${where}: empty checklist`);
      a.checklist.forEach((c, k) => auditRich(`${where} checklist ${k + 1}`, c, o, out));
      break;
    }
    case 'code': {
      if (a.tests.length < 2) out.push(`${where}: fewer than 2 tests`);
      const sol = runCodeTests(a.solution, a);
      if (!sol.ok) {
        const f = sol.results.find((r) => !r.ok);
        out.push(`${where}: the reference solution fails (${sol.compileError ?? `${f?.name}: ${f?.error ?? `got ${JSON.stringify(f?.got)}`}`})`);
      }
      if (runCodeTests(a.starter, a).ok) out.push(`${where}: the starter code already passes every test`);
      break;
    }
  }
}

function auditBody(where: string, b: ProblemBody, o: AuditOptions, out: string[]): void {
  auditRich(`${where} prompt`, b.prompt, o, out);
  if (b.hints.length !== 3) out.push(`${where}: needs exactly 3 hints (nudge, strategy, first step)`);
  b.hints.forEach((h, k) => auditRich(`${where} hint ${k + 1}`, h, o, out));
  if (new Set(b.hints).size !== b.hints.length) out.push(`${where}: two hints are identical`);
  auditSteps(`${where} solution`, b.solution.steps, o, out);
  auditRich(`${where} solution answer`, b.solution.answer, o, out);
  auditRich(`${where} solution check`, b.solution.check, o, out, false);
  if (b.commonWrong.length === 0) out.push(`${where}: needs a "why the common wrong answer is wrong" note`);
  b.commonWrong.forEach((w, k) => auditRich(`${where} commonWrong ${k + 1} why`, w.why, o, out));
  auditAnswer(`${where} answer`, b.answer, b, o, out);
}

/**
 * Audit a lesson's practice problems (§5): at least 8 (3 ★, 3 ★★, 2 ★★★),
 * unique ids, 3 hints, a justified solution, a common-wrong note, valid TeX,
 * no ugly numbers, answers the checker accepts, code solutions that pass, and
 * generators that never run out of acceptable instances over `seeds` draws.
 * Returns a list of problems; empty means it passes.
 */
export function auditProblems(specs: readonly ProblemSpec[], options: AuditOptions & { minProblems?: number } = {}): string[] {
  const out: string[] = [];
  const opts = ctxOf(options);
  const min = options.minProblems ?? 8;
  if (specs.length < min) out.push(`only ${specs.length} problems; need at least ${min}`);
  if (min >= 8) {
    const count = (d: number) => specs.filter((s) => s.difficulty === d).length;
    if (count(1) < 3) out.push(`only ${count(1)} ★ warm-up problems; need 3`);
    if (count(2) < 3) out.push(`only ${count(2)} ★★ standard problems; need 3`);
    if (count(3) < 2) out.push(`only ${count(3)} ★★★ exam-level problems; need 2`);
    // §5 "Mix the types".
    const kinds = new Set(specs.map((s) => (s.answer.kind === 'drag' ? `drag` : s.answer.kind)));
    if (kinds.size < 2) out.push(`every problem is "${[...kinds][0]}"; mix the answer types (§5: numeric, symbolic, choice, drag, proof, code)`);
  }
  const ids = new Set<string>();
  for (const s of specs) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id)) out.push(`problem id "${s.id}" should be lowercase-with-dashes`);
    if (ids.has(s.id)) out.push(`duplicate problem id "${s.id}"`);
    ids.add(s.id);
    auditBody(`${s.id}`, s, opts, out);
    if (s.generate) {
      const seeds = opts.seeds ?? 60;
      const prompts = new Set<string>();
      for (let seed = 1; seed <= seeds; seed++) {
        try {
          const inst = drawProblem(s, seed);
          prompts.add(inst.prompt);
          const before = out.length;
          auditBody(`${s.id} (seed ${seed})`, inst, { ...opts, generated: true } as Ctx, out);
          if (out.length - before > 0) break; // one broken seed is enough to report
        } catch (err) {
          out.push(`${s.id}: ${(err as Error).message}`);
          break;
        }
      }
      if (seeds >= 5 && prompts.size < 2) out.push(`${s.id}: the generator always produces the same prompt`);
    }
  }
  return out;
}

const LEVELS: readonly ExampleLevel[] = ['direct', 'combined', 'exam'];

/**
 * Audit worked examples (§5): at least 3 (direct, combined, exam level), every
 * field present, every step justified, valid TeX, no ugly numbers, a finite
 * machine-checkable `value` when given, at every sampled parameter setting.
 */
export function auditExamples(specs: readonly WorkedExampleSpec[], options: AuditOptions & { minExamples?: number } = {}): string[] {
  const out: string[] = [];
  const base = ctxOf(options);
  const min = options.minExamples ?? 3;
  const known = options.knownLessons ? new Set(options.knownLessons) : null;
  if (specs.length < min) out.push(`only ${specs.length} worked examples; need at least ${min}`);
  if (min >= 3) for (const l of LEVELS) if (!specs.some((s) => s.level === l)) out.push(`no "${l}" worked example`);
  const ids = new Set<string>();
  for (const s of specs) {
    if (ids.has(s.id)) out.push(`duplicate example id "${s.id}"`);
    ids.add(s.id);
    if (s.level === 'combined' && !s.uses?.length) out.push(`${s.id}: a "combined" example names the lesson(s) it combines with in \`uses\``);
    for (const u of s.uses ?? []) if (known && !known.has(u)) out.push(`${s.id}: uses "${u}", which isn't a lesson in curriculum.ts`);
    const params = Object.entries(s.params ?? {}) as [string, ExampleParam][];
    for (const [k, q] of params) {
      auditRich(`${s.id} param ${k} label`, q.label, base, out);
      auditConceptRef(`${s.id} param ${k}`, q.concept, base, out);
      if (q.kind === 'choice') {
        if (q.options.length < 2) out.push(`${s.id} param ${k}: a choice needs at least 2 options`);
        if (!Number.isInteger(q.value) || q.value < 0 || q.value >= q.options.length) out.push(`${s.id} param ${k}: value must be an option index`);
        q.options.forEach((x, i) => auditRich(`${s.id} param ${k} option ${i + 1}`, x, base, out));
      } else {
        if (!(q.min < q.max) || !(q.step > 0) || q.value < q.min || q.value > q.max) out.push(`${s.id} param ${k}: needs min < value range < max and step > 0`);
        if (q.scale === 'log' && !(q.min > 0)) out.push(`${s.id} param ${k}: a log-scale parameter needs min > 0`);
      }
    }
    const okDefault = acceptParams(s, exampleDefaults(s));
    if (okDefault !== true) out.push(`${s.id}: accept() rejects the default parameters (${okDefault})`);
    const opts: Ctx = params.length ? { ...base, generated: true } : base;
    for (const p of paramSamples(s)) {
      const where = Object.keys(p).length ? `${s.id} (${Object.entries(p).map(([k, v]) => `${k}=${v}`).join(', ')})` : s.id;
      const before = out.length;
      let r: ResolvedExample;
      try {
        r = resolveExample(s, p);
      } catch (err) {
        out.push(`${where}: throws ${(err as Error).message}`);
        break;
      }
      auditRich(`${where} statement`, r.statement, opts, out);
      if (r.known.length === 0) out.push(`${where}: "what we know" is empty`);
      if (r.want.length === 0) out.push(`${where}: "what we want" is empty`);
      r.known.forEach((x, k) => auditRich(`${where} known ${k + 1}`, x, opts, out));
      r.want.forEach((x, k) => auditRich(`${where} want ${k + 1}`, x, opts, out));
      auditRich(`${where} strategy`, r.strategy, opts, out);
      auditSteps(`${where}`, r.steps, opts, out, true);
      auditRich(`${where} answer`, r.answer, opts, out);
      auditRich(`${where} sanity`, r.sanity, opts, out);
      if (r.value !== undefined) {
        const vals = typeof r.value === 'number' ? [r.value] : r.value;
        if (!vals.every(Number.isFinite)) out.push(`${where}: value is not finite`);
      }
      if (out.length > before) break;
    }
  }
  return out;
}

/** Audit a quick check (§4.10): 4–6 questions, unique ids, an explanation for every option, valid targets and TeX. */
export function auditQuiz(quiz: QuizSpec, options: AuditOptions = {}): string[] {
  const out: string[] = [];
  const opts = ctxOf(options);
  if (quiz.length < 4 || quiz.length > 6) out.push(`quick check has ${quiz.length} questions; need 4–6`);
  const ids = new Set<string>();
  for (const q of quiz) {
    if (ids.has(q.id)) out.push(`duplicate question id "${q.id}"`);
    ids.add(q.id);
    auditRich(`${q.id} prompt`, q.prompt, opts, out);
    if (q.kind === 'choice') {
      if (q.options.length < 2) out.push(`${q.id}: fewer than 2 options`);
      const correct = typeof q.correct === 'number' ? [q.correct] : [...q.correct];
      if (correct.length === 0 || correct.some((c) => c < 0 || c >= q.options.length)) out.push(`${q.id}: correct index out of range`);
      q.options.forEach((x, k) => {
        auditRich(`${q.id} option ${k + 1}`, x.text, opts, out);
        auditRich(`${q.id} option ${k + 1} why`, x.why, opts, out);
      });
    } else {
      auditAnswer(`${q.id}`, { kind: 'drag', target: q.target }, { prompt: q.prompt, answer: { kind: 'drag', target: q.target }, hints: ['', '', ''], solution: { steps: [], answer: '' }, commonWrong: [] }, opts, out);
      auditRich(`${q.id} whyWrong`, q.whyWrong, opts, out);
      auditRich(`${q.id} whyRight`, q.whyRight, opts, out);
    }
  }
  return out;
}
