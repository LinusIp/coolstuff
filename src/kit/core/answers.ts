/**
 * Answer checking for every Problem answer kind except code (see
 * codecheck.ts). Pure: `problems.ts` tests and the Problem component call the
 * same functions, so what the tests accept is exactly what a learner can type.
 *
 *   checkNumeric('9.81 m/s^2', spec)   checkSymbolic('2x cos(x^2)', spec)
 *   checkChoice(2, spec)               checkDrag([1, 0, 2], target)
 *   checkProof([true, true], spec)     checkAnswer(spec, response)   // dispatch
 *
 * Every verdict carries a short learner-facing message and, when the answer
 * matches a `commonWrong` entry, its index.
 */
import { compileExpr, equivalent, evalNumber, exprConstants, exprFunctions, exprToTex, exprVars, tryParseExpr, type Expr } from './expr';
import { UnitError, angleCompat, convert, dimensionName, parseUnit, prettyUnit, sameDimension, splitQuantity, unitToTex, type Unit } from './units';
import type {
  ChoiceAnswer,
  CommonWrong,
  DragTarget,
  NumericAnswer,
  Precision,
  ProofAnswer,
  SymbolicAnswer,
  Verdict,
  AnswerSpec,
  Vec2,
} from '../types';

// ── Numeric ─────────────────────────────────────────────────────────────

/** The tolerance a precision implies: half a unit in the last stated digit. */
export function toleranceFor(precision: Precision, value: number): number {
  if (precision === 'exact') return 1e-9 * Math.max(1, Math.abs(value));
  if ('decimals' in precision) return 0.5 * 10 ** -precision.decimals;
  if (value === 0) return 0.5 * 10 ** -(precision.sig - 1);
  const e = Math.floor(Math.log10(Math.abs(value)));
  return 0.5 * 10 ** (e - precision.sig + 1);
}

/** "to 2 decimal places", "to 3 significant figures", "exactly (fractions and roots are fine)". */
export function describePrecision(precision: Precision): string {
  if (precision === 'exact') return 'exactly (fractions like 1/3 and roots like sqrt(2) are fine)';
  if ('decimals' in precision) {
    return precision.decimals === 0 ? 'to the nearest whole number' : `to ${precision.decimals} decimal place${precision.decimals === 1 ? '' : 's'}`;
  }
  return `to ${precision.sig} significant figure${precision.sig === 1 ? '' : 's'}`;
}

/** The expected value written at the stated precision, for "Right: 7.00." */
export function formatAtPrecision(value: number, precision: Precision): string {
  const s = precision === 'exact' ? String(Number(value.toPrecision(12))) : 'decimals' in precision ? value.toFixed(precision.decimals) : Number(value.toPrecision(precision.sig)).toString();
  return s.replace(/^-/, '−');
}

/** Decimal places and significant figures the learner wrote, when they typed a plain decimal ("3.14" → 2 dp, 3 sf). */
export function writtenPrecision(text: string): { decimals: number; sig: number } | null {
  const m = /^[+\-−]?(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!m || (m[1] === '' && !m[2])) return null;
  const int = m[1].replace(/^0+/, '');
  const frac = m[2] ?? '';
  const digits = (int + frac).replace(/^0+/, '');
  return { decimals: frac.length, sig: Math.max(1, digits.length) };
}

/** Split "(3, 4)" / "3; 4" / "x = 5, 2" into items at top-level commas. */
function splitList(text: string): string[] {
  let s = text.trim();
  const eq = s.indexOf('=');
  if (eq >= 0 && !/[<>]/.test(s)) s = s.slice(eq + 1).trim();
  if (/^[([{].*[)\]}]$/.test(s) && matchingClose(s) === s.length - 1) s = s.slice(1, -1);
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if ((ch === ',' || ch === ';') && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter((x) => x !== '');
}

/** Index of the bracket closing the one at 0 ("(1, 2)" → 5; "(1)(2)" → 2). */
function matchingClose(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if ('([{'.includes(s[i])) depth++;
    else if (')]}'.includes(s[i]) && --depth === 0) return i;
  }
  return -1;
}

interface ParsedQuantity {
  value: number;
  /** The number part as typed. */
  text: string;
  unitText: string;
  unit: Unit | null;
  tex: string;
}

function parseQuantity(text: string): ParsedQuantity | { error: string } {
  const { value, unit } = splitQuantity(text);
  if (value === '') return { error: unit ? `Start with the number, then the unit (like "9.8 ${unit}").` : 'Type a number.' };
  const n = evalNumber(value);
  if (!n.ok) return { error: n.error.message };
  if (!Number.isFinite(n.value)) return { error: 'That works out to infinity or undefined.' };
  let u: Unit | null = null;
  if (unit) {
    try {
      u = parseUnit(unit);
    } catch (err) {
      if (err instanceof UnitError) return { error: err.message };
      throw err;
    }
  }
  return { value: n.value, text: value, unitText: unit, unit: u, tex: unit ? `${n.tex}\\,${unitToTex(unit)}` : n.tex };
}

const within = (got: number, want: number, tol: number): boolean => Math.abs(got - want) <= tol + 1e-12 * Math.max(1, Math.abs(want));
const valuesOf = (v: number | readonly number[]): number[] => (typeof v === 'number' ? [v] : [...v]);
const tolFor = (spec: NumericAnswer, w: number): number => (spec.tolerance ?? toleranceFor(spec.precision, w)) + (spec.relTolerance ?? 0) * Math.abs(w);

/** Value-by-value comparison (vectors in order; `ordered: false` compares as multisets). */
function exactMatch(got: readonly number[], want: readonly number[], spec: NumericAnswer): boolean {
  if (got.length !== want.length) return false;
  if (spec.ordered === false) {
    const g = [...got].sort((a, b) => a - b);
    const w = [...want].sort((a, b) => a - b);
    return g.every((x, k) => within(x, w[k], tolFor(spec, w[k])));
  }
  return got.every((x, k) => within(x, want[k], tolFor(spec, want[k])));
}

type MultipleResult = 'match' | 'zero' | 'opposite' | 'no';

/**
 * Is `got` a nonzero multiple of `want`? Both are scaled so `want`'s largest
 * entry (by size) becomes 1, then compared entry by entry at the stated
 * precision: so (1, 0.33), (3, 1) and (−6, −2) all match (3, 1) to 2 dp.
 */
export function multipleOf(got: readonly number[], want: readonly number[], spec: Pick<NumericAnswer, 'precision' | 'tolerance' | 'relTolerance'>): MultipleResult {
  if (got.length !== want.length || want.length === 0) return 'no';
  let k = 0;
  for (let i = 1; i < want.length; i++) if (Math.abs(want[i]) > Math.abs(want[k])) k = i;
  if (want[k] === 0) return 'no';
  const gNorm = Math.max(...got.map(Math.abs));
  if (gNorm < 1e-12) return 'zero';
  if (Math.abs(got[k]) < 1e-12 * gNorm) return 'no';
  const w = want.map((x) => x / want[k]);
  const g = got.map((x) => x / got[k]);
  const s = spec as NumericAnswer;
  if (!g.every((x, i) => within(x, w[i], tolFor(s, w[i])))) return 'no';
  return got[k] / want[k] > 0 ? 'match' : 'opposite';
}

type MatchResult = { ok: true } | { ok: false; message?: string };

function zeroMessage(): string {
  return 'Give a nonzero vector: the zero vector points in no direction, so it never counts.';
}

/** Compare parsed values with the answer under the spec's equivalence (and `check`, when `useCheck`). */
function matchValues(got: readonly number[], spec: NumericAnswer, useCheck = true): MatchResult {
  if (useCheck && spec.check) {
    const r = spec.check(got);
    return r === true ? { ok: true } : { ok: false, message: typeof r === 'string' ? r : undefined };
  }
  const want = valuesOf(spec.value);
  const eq = spec.equivalence ?? 'exact';
  if (eq === 'exact' || want.length < 2) return exactMatch(got, want, spec) ? { ok: true } : { ok: false };
  const r = multipleOf(got, want, spec);
  if (r === 'match' || (r === 'opposite' && eq === 'scalar-multiple')) return { ok: true };
  if (r === 'zero') return { ok: false, message: zeroMessage() };
  if (r === 'opposite') return { ok: false, message: 'Right line, wrong way: this answer wants a positive multiple, pointing the same way.' };
  return { ok: false };
}

/** A common-wrong entry's values: numbers, a number list, or a string of (possibly exact) numbers ("1/3, 2"). */
function commonWrongValues(w: CommonWrong): number[] | null {
  if (typeof w.answer === 'number') return [w.answer];
  if (typeof w.answer !== 'string') return [...w.answer];
  const vals = splitList(w.answer).map((x) => {
    const n = evalNumber(x);
    return n.ok ? n.value : NaN;
  });
  return vals.length && vals.every(Number.isFinite) ? vals : null;
}

function numericWrongIndex(got: readonly number[], spec: NumericAnswer, wrongs: readonly CommonWrong[]): number | undefined {
  const k = wrongs.findIndex((w) => {
    const vals = commonWrongValues(w);
    if (!vals) return false;
    // A common wrong answer matches when the learner's values are "the same answer" as it: equal, or equivalent under the spec's equivalence.
    return exactMatch(got, vals, spec) || matchValues(got, { ...spec, value: vals, check: undefined }, false).ok;
  });
  return k >= 0 ? k : undefined;
}

const matrixTex = (cells: readonly string[], shape: readonly [number, number]): string => {
  const rows: string[] = [];
  for (let r = 0; r < shape[0]; r++) rows.push(cells.slice(r * shape[1], (r + 1) * shape[1]).join(' & '));
  return `\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}`;
};

/**
 * Check a typed numeric answer: a number or a constant expression ("1/3",
 * "2pi", "3.0e8"), with a unit when the problem has one, or several
 * comma-separated values for a vector, a matrix (row-major) or a set of roots.
 */
export function checkNumeric(input: string, spec: NumericAnswer, commonWrong: readonly CommonWrong[] = []): Verdict {
  const raw = input.trim();
  if (raw === '') return { correct: false, reason: 'empty', message: 'Type an answer first.' };
  if (spec.complex) return checkComplex(raw, spec, commonWrong);
  const want = valuesOf(spec.value);
  const items = want.length > 1 ? splitList(raw) : [raw];
  if (items.length !== want.length) {
    const message = spec.shape
      ? `Fill in all ${want.length} entries of the ${spec.shape[0]}×${spec.shape[1]} matrix.`
      : want.length > 1
        ? `Give ${want.length} values, separated by commas.`
        : 'Give a single value.';
    return { correct: false, reason: 'count', message };
  }
  const parsed: ParsedQuantity[] = [];
  for (const it of items) {
    const q = parseQuantity(it);
    if ('error' in q) return { correct: false, reason: 'unparseable', message: q.error };
    parsed.push(q);
  }
  // "3, 4 m/s": a unit on the last value only applies to all of them.
  const last = parsed[parsed.length - 1];
  if (last.unit && parsed.slice(0, -1).every((p) => !p.unit)) {
    for (const p of parsed) {
      p.unit = last.unit;
      p.unitText = last.unitText;
    }
  }
  const texes = parsed.map((p) => p.tex);
  const understood = spec.shape ? matrixTex(texes, spec.shape) : parsed.length > 1 ? `\\left(${texes.join(',\\ ')}\\right)` : texes[0];

  const values = parsed.map((p) => p.value);
  let unitIssue: Verdict | null = null;
  const withUnit = parsed.filter((p) => p.unit);
  if (spec.unit) {
    const expected = parseUnit(spec.unit);
    const askUnit = spec.askUnit ?? true;
    if (withUnit.length === 0) {
      if (askUnit) {
        const numberRight = matchValues(values, spec).ok;
        unitIssue = {
          correct: false,
          reason: 'unit-missing',
          message: numberRight ? `The number is right; now add the unit (${prettyUnit(spec.unit)}).` : `Include the unit with your answer (in ${prettyUnit(spec.unit)}).`,
          understood,
        };
      }
    } else if (withUnit.length < parsed.length) {
      return { correct: false, reason: 'unit-missing', message: 'Give every value its unit, or put one unit after the last value.', understood };
    } else {
      for (let k = 0; k < parsed.length; k++) {
        const p = parsed[k];
        const given = p.unit!;
        if (!sameDimension(given, expected)) {
          const g = dimensionName(given);
          const e = dimensionName(expected);
          return {
            correct: false,
            reason: 'unit-dimension',
            message: g && e ? `"${p.unitText}" measures ${g}, but the answer is ${/^[aeiou]/.test(e) ? 'an' : 'a'} ${e}.` : `"${p.unitText}" has the wrong dimensions for this answer.`,
            understood,
          };
        }
        const ang = angleCompat(given, expected, p.unitText);
        if (!ang.ok) return { correct: false, reason: 'unit-dimension', message: ang.message, understood };
        values[k] = convert(values[k], given, expected) * ang.factor;
      }
      if (spec.strictUnit && parsed.some((p) => p.unitText.replace(/\s+/g, '') !== spec.unit!.replace(/\s+/g, ''))) {
        const ok = matchValues(values, spec).ok;
        unitIssue = { correct: false, reason: 'unit-exact', message: ok ? `Right value; give it in ${prettyUnit(spec.unit)}.` : `Give it in ${prettyUnit(spec.unit)}.`, understood };
      }
    }
  } else {
    // A plain-number answer: % scales, radians are dimensionless, anything else is a gentle "no unit here".
    for (let k = 0; k < parsed.length; k++) {
      const p = parsed[k];
      if (!p.unit) continue;
      if (p.unitText === '%') values[k] *= 0.01;
      else if (p.unit.scale === 1 && p.unit.dims.every((d) => d === 0) && (p.unit.angle ?? 0) === 1 && !p.unit.cycle) continue; // rad
      else {
        const bare = matchValues(parsed.map((q) => q.value), spec).ok;
        return {
          correct: false,
          reason: 'unit-dimension',
          message: bare ? `Right number, but this answer has no unit: leave out "${p.unitText}".` : `This answer is a plain number, with no unit (you wrote "${p.unitText}").`,
          understood,
        };
      }
    }
  }

  const cw = numericWrongIndex(values, spec, commonWrong);
  if (unitIssue) return cw === undefined ? unitIssue : { ...unitIssue, commonWrong: cw };

  const m = matchValues(values, spec);
  if (m.ok) {
    const eq = spec.equivalence ?? 'exact';
    const unit = spec.unit ? ` ${prettyUnit(spec.unit)}` : '';
    const shown = want.map((w) => formatAtPrecision(w, spec.precision)).join(', ');
    let message: string;
    if (spec.check) message = 'Right.';
    else if (eq !== 'exact' && want.length > 1) message = `Right: any ${eq === 'direction' ? 'positive' : 'nonzero'} multiple of (${shown}) works.`;
    else if (spec.precision === 'exact') message = 'Right.';
    else message = `Right: ${want.length > 1 ? (spec.shape ? `[${shown}]` : shown) : shown}${unit}.`;
    return { correct: true, reason: 'correct', message, understood };
  }

  // Right value, too few digits?
  if (spec.precision !== 'exact' && want.length === 1 && spec.tolerance === undefined && !spec.check) {
    const wp = writtenPrecision(parsed[0].text);
    if (wp) {
      const need = spec.precision;
      const fewer = 'decimals' in need ? wp.decimals < need.decimals : wp.sig < need.sig;
      const ownTol = 0.5 * 10 ** -wp.decimals;
      if (fewer && within(values[0], want[0], ownTol)) {
        return { correct: false, reason: 'precision', message: `Close. Give it ${describePrecision(need)}.`, understood };
      }
    }
  }
  return {
    correct: false,
    reason: 'wrong',
    message: m.message ?? `Not ${raw.replace(/-/g, '−')}.`,
    commonWrong: cw,
    understood,
  };
}

// ── Complex numbers (a + bi) ────────────────────────────────────────────

/** One complex number typed as `a + bi` (`j` works too). Linear in i, or it's rejected. */
export function parseComplex(text: string): { re: number; im: number; tex: string } | { error: string } {
  let s = text.trim();
  if (!/i/.test(s.replace(/pi|sin|min|binom|sign/g, '')) && /j/.test(s)) s = s.replace(/j/g, 'i');
  const r = tryParseExpr(s, { vars: ['i'] });
  if (!r.ok) return { error: r.error.message };
  const f = compileExpr(r.expr);
  const a = f({ i: 0 });
  const b = f({ i: 1 }) - a;
  const b2 = f({ i: 2 }) - a;
  const bm = f({ i: -1 }) - a;
  if (![a, b, b2, bm].every(Number.isFinite)) return { error: 'That works out to infinity or undefined.' };
  const tol = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (Math.abs(b2 - 2 * b) > tol || Math.abs(bm + b) > tol) return { error: 'Write each complex number as a + bi (no i², no i in a denominator).' };
  return { re: a, im: b, tex: exprToTex(r.expr) };
}

/** "1 ± 2i" → ["1 + 2i", "1 - 2i"]; anything else unchanged. */
function expandPlusMinus(item: string): string[] {
  const m = /^(.*?)(±|\+-|\+\/-)(.*)$/.exec(item);
  return m ? [`${m[1]}+${m[3]}`, `${m[1]}-${m[3]}`] : [item];
}

function checkComplex(raw: string, spec: NumericAnswer, commonWrong: readonly CommonWrong[]): Verdict {
  const flat = valuesOf(spec.value);
  const want: [number, number][] = [];
  for (let k = 0; k + 1 < flat.length; k += 2) want.push([flat[k], flat[k + 1]]);
  const items = splitList(raw).flatMap(expandPlusMinus);
  if (items.length !== want.length) {
    return { correct: false, reason: 'count', message: want.length > 1 ? `Give ${want.length} complex numbers, separated by commas (a ± bi counts as two).` : 'Give a single complex number, like 1 + 2i.' };
  }
  const got: [number, number][] = [];
  const texes: string[] = [];
  for (const it of items) {
    const c = parseComplex(it);
    if ('error' in c) return { correct: false, reason: 'unparseable', message: c.error };
    got.push([c.re, c.im]);
    texes.push(c.tex);
  }
  const understood = texes.length > 1 ? texes.join(',\\ ') : texes[0];
  const same = (g: readonly [number, number][], w: readonly [number, number][]): boolean => {
    const close = (x: [number, number], y: [number, number]) => within(x[0], y[0], tolFor(spec, y[0])) && within(x[1], y[1], tolFor(spec, y[1]));
    if (spec.ordered !== false) return g.every((x, k) => close(x, w[k]));
    const used = new Set<number>();
    return w.every((y) => {
      const k = g.findIndex((x, i) => !used.has(i) && close(x, y));
      if (k < 0) return false;
      used.add(k);
      return true;
    });
  };
  if (same(got, want)) return { correct: true, reason: 'correct', message: 'Right.', understood };
  const k = commonWrong.findIndex((w) => {
    if (typeof w.answer !== 'string') return false;
    const cws = splitList(w.answer).flatMap(expandPlusMinus).map(parseComplex);
    if (cws.length !== got.length || cws.some((c) => 'error' in c)) return false;
    return same(got, cws.map((c) => [(c as { re: number }).re, (c as { im: number }).im]));
  });
  return { correct: false, reason: 'wrong', message: `Not ${raw.replace(/-/g, '−')}.`, understood, commonWrong: k >= 0 ? k : undefined };
}

// ── Symbolic ────────────────────────────────────────────────────────────

function stripLabel(input: string): string {
  const eq = input.indexOf('=');
  return eq >= 0 ? input.slice(eq + 1) : input;
}

const CONSTANT_LETTERS = ['C', 'c', 'K', 'k'];

/** Take a written "+ C" off an antiderivative ("x^3/3 + C", "C + x^3/3"), unless that letter is a variable. */
export function stripIntegrationConstant(text: string, vars: readonly string[]): { text: string; stripped: boolean } {
  const trailing = /^(.*\S)\s*\+\s*([A-Za-z])\s*$/.exec(text);
  if (trailing && CONSTANT_LETTERS.includes(trailing[2]) && !vars.includes(trailing[2])) return { text: trailing[1], stripped: true };
  const leading = /^\s*([A-Za-z])\s*\+\s*(\S.*)$/.exec(text);
  if (leading && CONSTANT_LETTERS.includes(leading[1]) && !vars.includes(leading[1])) return { text: leading[2], stripped: true };
  return { text, stripped: false };
}

const FN_ALIAS: Readonly<Record<string, string>> = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', '√': 'sqrt', '|x|': 'abs' };
const canonFn = (f: string): string => FN_ALIAS[f] ?? f;

/** Which entry of `disallow` the parsed expression uses (functions, variables or the constants pi/e), matched by token, not substring. */
function disallowedIn(e: Expr, disallow: readonly string[]): string | undefined {
  if (disallow.length === 0) return undefined;
  const fns = new Set([...exprFunctions(e)].map(canonFn));
  const vars = exprVars(e);
  const consts = exprConstants(e);
  return disallow.find((d) => {
    const c = canonFn(d.trim());
    if (c === 'π') return consts.has('pi');
    return fns.has(c) || vars.has(c) || consts.has(c as 'pi' | 'e');
  });
}

/** Check a typed expression by evaluating it against the expected one at random points. */
export function checkSymbolic(input: string, spec: SymbolicAnswer, commonWrong: readonly CommonWrong[] = []): Verdict {
  let text = stripLabel(input).trim();
  if (text === '') return { correct: false, reason: 'empty', message: 'Type an answer first.' };
  let plusC = false;
  if (spec.upToConstant) {
    const r = stripIntegrationConstant(text, spec.vars);
    text = r.text;
    plusC = r.stripped;
  }
  const parsed = tryParseExpr(text, { vars: spec.vars });
  if (!parsed.ok) {
    if (!spec.upToConstant && stripIntegrationConstant(text, spec.vars).stripped && tryParseExpr(stripIntegrationConstant(text, spec.vars).text, { vars: spec.vars }).ok) {
      return { correct: false, reason: 'unparseable', message: 'No "+ C" here: this answer is one specific function, not a family of antiderivatives.' };
    }
    return { correct: false, reason: 'unparseable', message: parsed.error.message };
  }
  const understood = exprToTex(parsed.expr) + (plusC ? ' + C' : '');
  const banned = disallowedIn(parsed.expr, spec.disallow ?? []);
  if (banned) return { correct: false, reason: 'form', message: `Write it without ${banned}: simplify further.`, understood };
  const opts = { vars: spec.vars, domain: spec.domain, upToConstant: spec.upToConstant };
  const r = equivalent(spec.expr, parsed.expr, opts);
  if (r.equivalent) return { correct: true, reason: 'correct', message: spec.upToConstant ? 'Right (any constant works).' : 'Right.', understood };
  const k = commonWrong.findIndex((w) => typeof w.answer === 'string' && equivalent(spec.upToConstant ? stripIntegrationConstant(w.answer, spec.vars).text : w.answer, parsed.expr, opts).equivalent);
  let message = 'Not equivalent to the answer.';
  if (r.reason === 'undefined-here' && r.at) message = `Your expression is undefined at ${pointText(r.at)}, where the answer isn't.`;
  else if (r.reason === 'different' && r.at) message = `Not equivalent: they differ at ${pointText(r.at)}.`;
  return { correct: false, reason: 'wrong', message, understood, commonWrong: k >= 0 ? k : undefined };
}

const pointText = (at: Record<string, number>): string =>
  Object.entries(at)
    .map(([k, v]) => `${k} = ${Number(v.toFixed(2)).toString().replace('-', '−')}`)
    .join(', ');

// ── Choice ──────────────────────────────────────────────────────────────

/** Check a selection (one index, or several for multi-select). */
export function checkChoice(selected: number | readonly number[], spec: ChoiceAnswer, commonWrong: readonly CommonWrong[] = []): Verdict {
  const sel = (typeof selected === 'number' ? [selected] : [...selected]).sort((a, b) => a - b);
  if (sel.length === 0) return { correct: false, reason: 'empty', message: 'Pick an option first.' };
  const want = (typeof spec.correct === 'number' ? [spec.correct] : [...spec.correct]).sort((a, b) => a - b);
  const ok = sel.length === want.length && sel.every((x, k) => x === want[k]);
  if (ok) return { correct: true, reason: 'correct', message: 'Right.' };
  const k = commonWrong.findIndex((w) => typeof w.answer === 'number' && sel.length === 1 && w.answer === sel[0]);
  const message = want.length > 1 && sel.every((s) => want.includes(s)) ? 'Not all of them: more options are true.' : 'Not quite.';
  return { correct: false, reason: 'wrong', message, commonWrong: k >= 0 ? k : undefined };
}

// ── Drag ────────────────────────────────────────────────────────────────

/** Parse a drag common-wrong answer: a JSON-ish string ("[1, 1]") or a number / number list. */
export function dragStateOf(w: CommonWrong): unknown {
  if (typeof w.answer !== 'string') return w.answer;
  try {
    return JSON.parse(w.answer);
  } catch {
    return undefined;
  }
}

/** Check a drag answer's state: Vec2 (point), number (slider), number[] (order: item order; match: slot per item, −1 = unplaced). */
export function checkDrag(state: unknown, target: DragTarget, commonWrong: readonly CommonWrong[] = []): Verdict {
  const cw = () => {
    const k = commonWrong.findIndex((w) => {
      const s = dragStateOf(w);
      if (s === undefined) return false;
      // Points and sliders match within the target's tolerance (an unsnapped drag lands near, not on).
      if (target.mode === 'point' && Array.isArray(s) && Array.isArray(state) && s.length === 2) {
        return Math.hypot((state as Vec2)[0] - (s as Vec2)[0], (state as Vec2)[1] - (s as Vec2)[1]) <= target.tolerance + 1e-12;
      }
      if (target.mode === 'slider' && typeof s === 'number' && typeof state === 'number') return Math.abs(state - s) <= target.tolerance + 1e-12;
      return JSON.stringify(s) === JSON.stringify(state);
    });
    return k >= 0 ? k : undefined;
  };
  const wrong = (message = 'Not quite.'): Verdict => ({ correct: false, reason: 'wrong', message, commonWrong: cw() });
  switch (target.mode) {
    case 'point': {
      const p = state as Vec2;
      const answers: readonly Vec2[] = typeof target.answer[0] === 'number' ? [target.answer as Vec2] : (target.answer as readonly Vec2[]);
      const ok = answers.some((a) => Math.hypot(p[0] - a[0], p[1] - a[1]) <= target.tolerance + 1e-12);
      return ok ? { correct: true, reason: 'correct', message: 'Right.' } : wrong('Not there yet.');
    }
    case 'slider': {
      const v = state as number;
      return Math.abs(v - target.answer) <= target.tolerance + 1e-12 ? { correct: true, reason: 'correct', message: 'Right.' } : wrong();
    }
    case 'order': {
      const order = state as readonly number[];
      const ok = order.length === target.correct.length && order.every((x, k) => x === target.correct[k]);
      return ok ? { correct: true, reason: 'correct', message: 'Right order.' } : wrong('Not in the right order yet.');
    }
    case 'match': {
      const slots = state as readonly number[];
      if (slots.length !== target.items.length || slots.some((s) => s < 0)) {
        return { correct: false, reason: 'incomplete', message: 'Place every item first.' };
      }
      const right = slots.filter((s, k) => s === target.correct[k]).length;
      return right === slots.length ? { correct: true, reason: 'correct', message: 'All matched.' } : wrong(`${right} of ${slots.length} in the right place.`);
    }
    case 'custom': {
      const ok = target.check(state);
      return ok ? { correct: true, reason: 'correct', message: 'Right.' } : wrong();
    }
  }
}

// ── Proof (self-check) ──────────────────────────────────────────────────

export function checkProof(ticked: readonly boolean[], spec: ProofAnswer): Verdict {
  const n = spec.checklist.length;
  const done = ticked.filter(Boolean).length;
  if (done === n) return { correct: true, reason: 'correct', message: 'Your answer has every part of the model answer.' };
  return { correct: false, reason: 'incomplete', message: `${done} of ${n} parts covered. Compare with the model answer and fill the gaps.` };
}

// ── Dispatch ────────────────────────────────────────────────────────────

export type AnswerResponse =
  | { kind: 'numeric'; text: string }
  | { kind: 'symbolic'; text: string }
  | { kind: 'choice'; selected: number | readonly number[] }
  | { kind: 'drag'; state: unknown }
  | { kind: 'proof'; ticked: readonly boolean[] };

/** Check any non-code answer. Code answers run in a Worker (codecheck.ts + CodeCell's sandbox). */
export function checkAnswer(spec: AnswerSpec, response: AnswerResponse, commonWrong: readonly CommonWrong[] = []): Verdict {
  if (spec.kind !== response.kind) throw new Error(`checkAnswer: a ${response.kind} response for a ${spec.kind} answer`);
  switch (spec.kind) {
    case 'numeric':
      return checkNumeric((response as { text: string }).text, spec, commonWrong);
    case 'symbolic':
      return checkSymbolic((response as { text: string }).text, spec, commonWrong);
    case 'choice':
      return checkChoice((response as { selected: number | readonly number[] }).selected, spec, commonWrong);
    case 'drag':
      return checkDrag((response as { state: unknown }).state, spec.target, commonWrong);
    case 'proof':
      return checkProof((response as { ticked: readonly boolean[] }).ticked, spec);
  }
}
