/**
 * Answer-input expressions: parse what a learner types, evaluate it, preview
 * it as TeX, and decide whether two expressions are equivalent by evaluating
 * them at random points (so `2x+2`, `2(x+1)` and `x+x+2` are all accepted).
 * Pure: no DOM; works in Node tests.
 *
 * Syntax (README §Expressions)
 *   numbers     3  3.14  .5  1e-3            constants  pi π e
 *   operators   + − * / ^ (also ** × · ÷ ²)  unary minus: −x^2 = −(x²); 2^−1 is fine
 *   implicit ×  2x  2(x+1)  (x+1)(x−1)  x y  2 sin x
 *   functions   sin cos tan sec csc cot  asin acos atan (arcsin …)  sinh cosh tanh
 *               exp ln log (natural, as on this site) log10 log2 log_b(x)  sqrt √ cbrt
 *               abs |x|  floor ceil sign  min max  binom(n, k)  n! (postfix)
 *   powers of functions  sin^2 x = (sin x)²
 *   without parentheses a function takes the next implicit product:
 *               sin 2x = sin(2x),  sin x cos x = sin(x)·cos(x),  sin x^2 = sin(x²)
 *   variables   only the declared ones (`vars`): x, theta / θ, v_0, …; "xy" splits into x·y
 *
 * Implicit multiplication has the same precedence as * and /, read left to
 * right: 1/2x means (1/2)·x. The TeX preview (`exprToTex`) shows the learner
 * exactly how their input was read.
 */
import { createRng, hashSeed } from './rng';
import type { Domain } from '../types';

// ── AST ─────────────────────────────────────────────────────────────────

export type BinaryOp = '+' | '-' | '*' | '/' | '^';

export type Expr =
  | { t: 'num'; v: number; text: string }
  | { t: 'const'; name: 'pi' | 'e' }
  | { t: 'var'; name: string }
  | { t: 'neg'; a: Expr }
  | { t: 'bin'; op: BinaryOp; a: Expr; b: Expr; implicit?: boolean }
  | { t: 'call'; fn: string; args: Expr[]; base?: number }
  | { t: 'fact'; a: Expr };

export type ExprErrorCode = 'empty' | 'syntax' | 'unbalanced' | 'unknown-symbol' | 'arity';

export class ExprError extends Error {
  constructor(
    message: string,
    readonly code: ExprErrorCode,
    /** Character offset in the normalised input. */
    readonly pos: number,
  ) {
    super(message);
    this.name = 'ExprError';
  }
}

export interface ParseOptions {
  /** Variable names the expression may use. Default: none (numbers and constants only). */
  vars?: readonly string[];
}

/** Functions by name → [min args, max args]. */
const FUNCTIONS: Readonly<Record<string, readonly [number, number]>> = {
  sin: [1, 1], cos: [1, 1], tan: [1, 1], sec: [1, 1], csc: [1, 1], cot: [1, 1],
  asin: [1, 1], acos: [1, 1], atan: [1, 1], arcsin: [1, 1], arccos: [1, 1], arctan: [1, 1],
  sinh: [1, 1], cosh: [1, 1], tanh: [1, 1],
  exp: [1, 1], ln: [1, 1], log: [1, 1], log10: [1, 1], log2: [1, 1],
  sqrt: [1, 1], cbrt: [1, 1], abs: [1, 1], floor: [1, 1], ceil: [1, 1], sign: [1, 1],
  min: [1, 16], max: [1, 16], binom: [2, 2],
};
const CONSTANTS = new Set(['pi', 'e']);

const GREEK: Readonly<Record<string, string>> = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa',
  λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', ϕ: 'phi', χ: 'chi',
  ψ: 'psi', ω: 'omega', Γ: 'Gamma', Δ: 'Delta', Θ: 'Theta', Λ: 'Lambda', Σ: 'Sigma', Φ: 'Phi', Ψ: 'Psi', Ω: 'Omega',
  π: 'pi',
};
const GREEK_NAMES = new Set(Object.values(GREEK));
const SUPERSCRIPT: Readonly<Record<string, string>> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
};

/** Normalise typography: Unicode operators, superscripts, Greek letters, √. */
export function normalizeInput(src: string): string {
  let s = src.replace(/[−–—]/g, '-').replace(/[×·⋅∙]/g, '*').replace(/÷/g, '/').replace(/\*\*/g, '^');
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (run) => `^(${[...run].map((c) => SUPERSCRIPT[c]).join('')})`);
  s = s.replace(/√/g, ' sqrt ');
  s = s.replace(/[α-ωΓΔΘΛΣΦΨΩϕ]/g, (c) => (GREEK[c] ? ` ${GREEK[c]} ` : c));
  return s.trim();
}

// ── Tokens ──────────────────────────────────────────────────────────────

type Tok =
  | { k: 'num'; v: number; text: string; pos: number }
  | { k: 'name'; name: string; sub?: string; pos: number }
  | { k: 'op'; v: '+' | '-' | '*' | '/' | '^' | '!' | ',' | '(' | ')' | '|'; pos: number };

function tokenize(s: string, vars: readonly string[]): Tok[] {
  const out: Tok[] = [];
  const known = [...Object.keys(FUNCTIONS), ...CONSTANTS, ...vars.map((v) => v.split('_')[0])];
  const names = [...new Set(known)].sort((a, b) => b.length - a.length);
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
    if (num) {
      out.push({ k: 'num', v: Number(num[0]), text: num[0], pos: i });
      i += num[0].length;
      continue;
    }
    const logN = /^log(10|2)(?![0-9])/.exec(s.slice(i));
    if (logN) {
      out.push({ k: 'name', name: `log${logN[1]}`, pos: i });
      i += logN[0].length;
      continue;
    }
    const word = /^([A-Za-z]+)(_(?:\{([A-Za-z0-9]+)\}|([A-Za-z0-9]+)))?/.exec(s.slice(i));
    if (word) {
      const letters = word[1];
      const sub = word[3] ?? word[4];
      const whole = sub !== undefined ? `${letters}_${sub}` : letters;
      if (vars.includes(whole) || (sub === undefined && (FUNCTIONS[whole] || CONSTANTS.has(whole)))) {
        out.push({ k: 'name', name: letters, sub, pos: i });
      } else if (letters === 'log' && sub !== undefined && /^\d+(\.\d+)?$/.test(sub)) {
        out.push({ k: 'name', name: 'log', sub, pos: i });
      } else {
        // Split a run like "xsinx" or "xy" into known names, longest first.
        let j = 0;
        const pieces: string[] = [];
        while (j < letters.length) {
          const hit = names.find((n) => letters.startsWith(n, j));
          if (!hit) {
            throw new ExprError(`"${letters[j]}" isn't something this answer can use${vars.length ? ` (variables: ${vars.join(', ')})` : ''}.`, 'unknown-symbol', i + j);
          }
          pieces.push(hit);
          j += hit.length;
        }
        pieces.forEach((p, n) => {
          const last = n === pieces.length - 1;
          const pSub = last ? sub : undefined;
          if (pSub !== undefined && !vars.includes(`${p}_${pSub}`) && !(p === 'log' && /^\d+$/.test(pSub))) {
            throw new ExprError(`"${p}_${pSub}" isn't something this answer can use.`, 'unknown-symbol', i);
          }
          out.push({ k: 'name', name: p, sub: pSub, pos: i });
        });
      }
      i += word[0].length;
      continue;
    }
    if ('+-*/^!,()|'.includes(ch)) {
      out.push({ k: 'op', v: ch as '+', pos: i });
      i++;
      continue;
    }
    if (ch === '[' || ch === '{') {
      out.push({ k: 'op', v: '(', pos: i });
      i++;
      continue;
    }
    if (ch === ']' || ch === '}') {
      out.push({ k: 'op', v: ')', pos: i });
      i++;
      continue;
    }
    throw new ExprError(`Unexpected "${ch}".`, 'syntax', i);
  }
  return out;
}

// ── Parser ──────────────────────────────────────────────────────────────

class Parser {
  private i = 0;
  private absDepth = 0;
  constructor(
    private readonly toks: Tok[],
    private readonly vars: readonly string[],
    private readonly len: number,
  ) {}

  parse(): Expr {
    if (this.toks.length === 0) throw new ExprError('Type an answer first.', 'empty', 0);
    const e = this.sum();
    const t = this.peek();
    if (t) {
      if (t.k === 'op' && t.v === ')') throw new ExprError('There is a ")" without a matching "(".', 'unbalanced', t.pos);
      throw new ExprError(`Unexpected "${tokText(t)}".`, 'syntax', t.pos);
    }
    return e;
  }

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }
  private isOp(v: string, t = this.peek()): boolean {
    return !!t && t.k === 'op' && t.v === v;
  }
  private take(): Tok {
    const t = this.toks[this.i++];
    if (!t) throw new ExprError('The answer ends too early.', 'syntax', this.len);
    return t;
  }

  private sum(): Expr {
    let e = this.product();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.take() as { v: '+' | '-' }).v;
      e = { t: 'bin', op, a: e, b: this.product() };
    }
    return e;
  }

  /** Can the next token start an operand (for implicit multiplication)? */
  private startsOperand(t = this.peek()): boolean {
    if (!t) return false;
    if (t.k === 'num' || t.k === 'name') return true;
    if (t.k === 'op' && t.v === '(') return true;
    if (t.k === 'op' && t.v === '|') return this.absDepth === 0;
    return false;
  }

  private product(): Expr {
    let e = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.take() as { v: '*' | '/' }).v;
        e = { t: 'bin', op, a: e, b: this.unary() };
      } else if (this.startsOperand()) {
        const next = this.peek()!;
        if (next.k === 'num' && endsWithNumber(e)) {
          throw new ExprError(`Put an operator between the numbers ("${numText(e)}" and "${next.text}").`, 'syntax', next.pos);
        }
        e = { t: 'bin', op: '*', a: e, b: this.power(), implicit: true };
      } else return e;
    }
  }

  private unary(): Expr {
    if (this.isOp('-')) {
      this.take();
      return { t: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.take();
      return this.unary();
    }
    return this.power();
  }

  private power(): Expr {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.take();
      return { t: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }

  private postfix(): Expr {
    let e = this.primary();
    while (this.isOp('!')) {
      this.take();
      e = { t: 'fact', a: e };
    }
    return e;
  }

  private primary(): Expr {
    const t = this.take();
    if (t.k === 'num') return { t: 'num', v: t.v, text: t.text };
    if (t.k === 'op') {
      if (t.v === '(') {
        if (this.isOp(')')) throw new ExprError('Empty brackets "()".', 'syntax', t.pos);
        const e = this.sum();
        if (!this.isOp(')')) throw new ExprError('A "(" is never closed.', 'unbalanced', t.pos);
        this.take();
        return e;
      }
      if (t.v === '|') {
        this.absDepth++;
        const e = this.sum();
        this.absDepth--;
        if (!this.isOp('|')) throw new ExprError('An absolute value "|" is never closed.', 'unbalanced', t.pos);
        this.take();
        return { t: 'call', fn: 'abs', args: [e] };
      }
      throw new ExprError(`Unexpected "${t.v}".`, 'syntax', t.pos);
    }
    // name
    const full = t.sub !== undefined ? `${t.name}_${t.sub}` : t.name;
    if (this.vars.includes(full)) return { t: 'var', name: full };
    if (CONSTANTS.has(t.name) && t.sub === undefined) return { t: 'const', name: t.name as 'pi' | 'e' };
    if (FUNCTIONS[t.name]) return this.call(t);
    throw new ExprError(`"${full}" isn't something this answer can use.`, 'unknown-symbol', t.pos);
  }

  private call(t: Extract<Tok, { k: 'name' }>): Expr {
    const fn = t.name;
    const base = fn === 'log' && t.sub !== undefined ? Number(t.sub) : undefined;
    let power: Expr | null = null;
    if (this.isOp('^')) {
      this.take();
      power = this.unary();
    }
    let args: Expr[];
    if (this.isOp('(')) {
      const open = this.take();
      args = [];
      if (this.isOp(')')) throw new ExprError(`${fn}() needs something inside the brackets.`, 'syntax', open.pos);
      args.push(this.sum());
      while (this.isOp(',')) {
        this.take();
        args.push(this.sum());
      }
      if (!this.isOp(')')) throw new ExprError(`The "(" after ${fn} is never closed.`, 'unbalanced', open.pos);
      this.take();
      // sin(x)^2 is handled by power() around this primary; sin(x)y by product().
    } else {
      if (!this.startsOperand()) throw new ExprError(`${fn} needs an argument, e.g. ${fn}(x).`, 'syntax', t.pos);
      args = [this.implicitArg()];
    }
    const [lo, hi] = FUNCTIONS[fn];
    if (args.length < lo || args.length > hi) {
      throw new ExprError(`${fn} takes ${lo === hi ? lo : `${lo}–${hi}`} argument${hi === 1 ? '' : 's'}.`, 'arity', t.pos);
    }
    const call: Expr = { t: 'call', fn, args, base };
    return power ? { t: 'bin', op: '^', a: call, b: power } : call;
  }

  /** Argument of a function written without brackets: the next implicit product that doesn't start another function. */
  private implicitArg(): Expr {
    let e = this.power();
    while (this.startsOperand()) {
      const t = this.peek()!;
      if (t.k === 'name' && FUNCTIONS[t.name] && !this.vars.includes(t.sub !== undefined ? `${t.name}_${t.sub}` : t.name)) break;
      if (t.k === 'num' && endsWithNumber(e)) break;
      e = { t: 'bin', op: '*', a: e, b: this.power(), implicit: true };
    }
    return e;
  }
}

const tokText = (t: Tok): string => (t.k === 'num' ? t.text : t.k === 'name' ? t.name : t.v);
function endsWithNumber(e: Expr): boolean {
  if (e.t === 'num') return true;
  if (e.t === 'bin' && e.implicit) return endsWithNumber(e.b);
  return false;
}
function numText(e: Expr): string {
  if (e.t === 'num') return e.text;
  if (e.t === 'bin') return numText(e.b);
  return '';
}

/** Parse an answer. Throws `ExprError` with a learner-facing message. */
export function parseExpr(src: string, opts: ParseOptions = {}): Expr {
  const vars = opts.vars ?? [];
  const s = normalizeInput(src);
  return new Parser(tokenize(s, vars), vars, s.length).parse();
}

export type ParseResult = { ok: true; expr: Expr } | { ok: false; error: ExprError };

export function tryParseExpr(src: string, opts: ParseOptions = {}): ParseResult {
  try {
    return { ok: true, expr: parseExpr(src, opts) };
  } catch (err) {
    if (err instanceof ExprError) return { ok: false, error: err };
    throw err;
  }
}

// ── Evaluation ──────────────────────────────────────────────────────────

/** Lanczos approximation of Γ(x) (g = 7), accurate to ~1e-13 for the reals we sample. */
export function gamma(x: number): number {
  if (Number.isInteger(x) && x <= 0) return NaN;
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * a;
}

export function factorial(n: number): number {
  if (Number.isInteger(n) && n >= 0 && n <= 170) {
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  }
  return gamma(n + 1);
}

const FN_IMPL: Readonly<Record<string, (...xs: number[]) => number>> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sec: (x) => 1 / Math.cos(x), csc: (x) => 1 / Math.sin(x), cot: (x) => Math.cos(x) / Math.sin(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, ln: Math.log, log: Math.log, log10: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
  min: Math.min, max: Math.max,
  binom: (n, k) => factorial(n) / (factorial(k) * factorial(n - k)),
};

export type Scope = Readonly<Record<string, number>>;

/** Compile to a fast closure. Domain errors give NaN or ±Infinity, never throw. */
export function compileExpr(e: Expr): (scope: Scope) => number {
  switch (e.t) {
    case 'num': {
      const v = e.v;
      return () => v;
    }
    case 'const': {
      const v = e.name === 'pi' ? Math.PI : Math.E;
      return () => v;
    }
    case 'var': {
      const n = e.name;
      return (s) => s[n] ?? NaN;
    }
    case 'neg': {
      const a = compileExpr(e.a);
      return (s) => -a(s);
    }
    case 'fact': {
      const a = compileExpr(e.a);
      return (s) => factorial(a(s));
    }
    case 'bin':
      return compileBinary(e.op, compileExpr(e.a), compileExpr(e.b));
    case 'call': {
      const args = e.args.map(compileExpr);
      if (e.fn === 'log' && e.base !== undefined) {
        const lb = Math.log(e.base);
        return (s) => Math.log(args[0](s)) / lb;
      }
      const f = FN_IMPL[e.fn];
      if (args.length === 1) {
        const a0 = args[0];
        return (s) => f(a0(s));
      }
      return (s) => f(...args.map((g) => g(s)));
    }
  }
}

type Fn = (scope: Scope) => number;

function compileBinary(op: BinaryOp, a: Fn, b: Fn): Fn {
  if (op === '+') return (s) => a(s) + b(s);
  if (op === '-') return (s) => a(s) - b(s);
  if (op === '*') return (s) => a(s) * b(s);
  if (op === '/') return (s) => a(s) / b(s);
  return (s) => {
    const x = a(s);
    const y = b(s);
    // Real odd roots of negatives: (−8)^(1/3) = −2, as a learner expects.
    if (x < 0 && !Number.isInteger(y)) {
      const inv = 1 / y;
      if (Math.abs(inv - Math.round(inv)) < 1e-9 && Math.round(inv) % 2 !== 0) return -((-x) ** y);
    }
    return x ** y;
  };
}

export function evaluateExpr(e: Expr, scope: Scope = {}): number {
  return compileExpr(e)(scope);
}

/** Every variable name used. */
export function exprVars(e: Expr, out = new Set<string>()): Set<string> {
  if (e.t === 'var') out.add(e.name);
  else if (e.t === 'neg' || e.t === 'fact') exprVars(e.a, out);
  else if (e.t === 'bin') {
    exprVars(e.a, out);
    exprVars(e.b, out);
  } else if (e.t === 'call') e.args.forEach((a) => exprVars(a, out));
  return out;
}

/** Every function name used ("abs" includes |x|; "log" includes log_b). */
export function exprFunctions(e: Expr, out = new Set<string>()): Set<string> {
  if (e.t === 'call') {
    out.add(e.fn);
    e.args.forEach((a) => exprFunctions(a, out));
  } else if (e.t === 'neg' || e.t === 'fact') {
    if (e.t === 'fact') out.add('!');
    exprFunctions(e.a, out);
  } else if (e.t === 'bin') {
    exprFunctions(e.a, out);
    exprFunctions(e.b, out);
  }
  return out;
}

/** Every named constant used ("pi", "e"). */
export function exprConstants(e: Expr, out = new Set<'pi' | 'e'>()): Set<'pi' | 'e'> {
  if (e.t === 'const') out.add(e.name);
  else if (e.t === 'neg' || e.t === 'fact') exprConstants(e.a, out);
  else if (e.t === 'bin') {
    exprConstants(e.a, out);
    exprConstants(e.b, out);
  } else if (e.t === 'call') e.args.forEach((a) => exprConstants(a, out));
  return out;
}

// ── Tidying for display ─────────────────────────────────────────────────

const isNum = (e: Expr, v: number): boolean => e.t === 'num' && e.v === v;
const num = (v: number): Expr => ({ t: 'num', v, text: String(v) });

/**
 * Structural tidy-up for showing an expression (never for checking answers):
 * folds signs (`a + -b` → `a - b`, `a - -b` → `a + b`, `--a` → `a`), drops
 * `1·`, `·1`, `^1`, `/1` and zero terms (`0x^2 + …`), and turns `0·x` into 0.
 * Generators that build an expression from random coefficients pass it
 * through here (or `exprToTex(e, { pretty: true })`) so `1x^3 - 0x^2 + -2`
 * displays as `x^3 - 2`.
 */
export function tidyExpr(e: Expr): Expr {
  switch (e.t) {
    case 'num':
    case 'const':
    case 'var':
      return e;
    case 'neg': {
      const a = tidyExpr(e.a);
      if (isNum(a, 0)) return a;
      if (a.t === 'neg') return a.a;
      return { t: 'neg', a };
    }
    case 'fact':
      return { t: 'fact', a: tidyExpr(e.a) };
    case 'call':
      return { ...e, args: e.args.map(tidyExpr) };
    case 'bin': {
      const a = tidyExpr(e.a);
      const b = tidyExpr(e.b);
      switch (e.op) {
        case '+':
          if (isNum(a, 0)) return b;
          if (isNum(b, 0)) return a;
          if (b.t === 'neg') return { t: 'bin', op: '-', a, b: b.a };
          return { t: 'bin', op: '+', a, b };
        case '-':
          if (isNum(b, 0)) return a;
          if (isNum(a, 0)) return tidyExpr({ t: 'neg', a: b });
          if (b.t === 'neg') return { t: 'bin', op: '+', a, b: b.a };
          return { t: 'bin', op: '-', a, b };
        case '*':
          if (isNum(a, 0) || isNum(b, 0)) return num(0);
          if (isNum(a, 1)) return b;
          if (isNum(b, 1)) return a;
          if (a.t === 'neg') return tidyExpr({ t: 'neg', a: { t: 'bin', op: '*', a: a.a, b, implicit: e.implicit } });
          if (b.t === 'neg' && a.t === 'num') return tidyExpr({ t: 'neg', a: { t: 'bin', op: '*', a, b: b.a, implicit: e.implicit } });
          return { t: 'bin', op: '*', a, b, implicit: e.implicit };
        case '/':
          if (isNum(b, 1)) return a;
          if (isNum(a, 0)) return num(0);
          return { t: 'bin', op: '/', a, b };
        case '^':
          if (isNum(b, 1)) return a;
          if (isNum(b, 0) || isNum(a, 1)) return num(1);
          return { t: 'bin', op: '^', a, b };
      }
    }
  }
}

// ── TeX preview ─────────────────────────────────────────────────────────

const TEX_FN: Readonly<Record<string, string>> = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', sec: '\\sec', csc: '\\csc', cot: '\\cot',
  asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', arcsin: '\\arcsin', arccos: '\\arccos', arctan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', ln: '\\ln', log: '\\log', log10: '\\log_{10}', log2: '\\log_{2}',
  sign: '\\operatorname{sgn}', min: '\\min', max: '\\max',
};

function varTex(name: string): string {
  const [base, sub] = name.split('_');
  const b = GREEK_NAMES.has(base) ? `\\${base}` : base.length > 1 ? `\\mathit{${base}}` : base;
  return sub !== undefined ? `${b}_{${sub}}` : b;
}

const PREC: Readonly<Record<BinaryOp, number>> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
function prec(e: Expr): number {
  if (e.t === 'bin') return PREC[e.op];
  if (e.t === 'neg') return 1.5;
  return 5;
}
const paren = (s: string): string => `\\left(${s}\\right)`;

export interface ExprTexOptions {
  /**
   * Display mode for generated maths: tidy first (`tidyExpr`), then typeset
   * coefficients tightly (`3x^2`, not `3\,{x}^{2}`). Default false: the
   * literal "we read this as …" preview of what a learner typed.
   */
  pretty?: boolean;
}

/** How the parser read the input, as TeX (a live "we read this as …" preview), or tidy display TeX with `{ pretty: true }`. */
export function exprToTex(e: Expr, opts: ExprTexOptions = {}): string {
  if (opts.pretty) return toTex(tidyExpr(e), true);
  return toTex(e, false);
}

function toTex(e: Expr, pretty: boolean): string {
  const exprToTex = (x: Expr): string => toTex(x, pretty);
  switch (e.t) {
    case 'num':
      return e.text.replace(/[eE]([+-]?\d+)$/, (_, x: string) => `\\times 10^{${Number(x)}}`);
    case 'const':
      return e.name === 'pi' ? '\\pi' : 'e';
    case 'var':
      return varTex(e.name);
    case 'neg': {
      const inner = exprToTex(e.a);
      return `-${prec(e.a) <= 1.5 ? paren(inner) : inner}`;
    }
    case 'fact': {
      const inner = exprToTex(e.a);
      return `${prec(e.a) < 5 || e.a.t === 'call' ? paren(inner) : inner}!`;
    }
    case 'bin': {
      const { op, a, b } = e;
      if (op === '/') return `\\frac{${exprToTex(a)}}{${exprToTex(b)}}`;
      if (op === '^') {
        const base = exprToTex(a);
        const needs = prec(a) < 5 || a.t === 'call' || (a.t === 'num' && a.v < 0);
        if (pretty && !needs) return `${base}^{${exprToTex(b)}}`;
        return `{${needs ? paren(base) : base}}^{${exprToTex(b)}}`;
      }
      const left = exprToTex(a);
      let right = exprToTex(b);
      if (op === '+') return `${left} + ${right}`;
      if (op === '-') return `${left} - ${prec(b) <= 1.5 ? paren(right) : right}`;
      // multiplication
      const l = prec(a) < 2 ? paren(left) : left;
      if (prec(b) <= 2 && !(b.t === 'bin' && b.op === '/')) right = paren(right);
      const dot = /^[\d.]/.test(right) || b.t === 'neg' || (b.t === 'bin' && b.op === '^' && b.a.t === 'num');
      if (dot) return `${l} \\cdot ${right}`;
      if (pretty && a.t === 'num') return `${l}${right}`;
      return `${l}\\,${right}`;
    }
    case 'call': {
      const [x, y] = e.args.map(exprToTex);
      switch (e.fn) {
        case 'sqrt':
          return `\\sqrt{${x}}`;
        case 'cbrt':
          return `\\sqrt[3]{${x}}`;
        case 'abs':
          return `\\left|${x}\\right|`;
        case 'exp':
          return `e^{${x}}`;
        case 'floor':
          return `\\left\\lfloor ${x}\\right\\rfloor`;
        case 'ceil':
          return `\\left\\lceil ${x}\\right\\rceil`;
        case 'binom':
          return `\\binom{${x}}{${y}}`;
        case 'log':
          if (e.base !== undefined) return `\\log_{${e.base}}${paren(x)}`;
          return `\\log${paren(x)}`;
        default:
          return `${TEX_FN[e.fn] ?? `\\operatorname{${e.fn}}`}${paren(e.args.map(exprToTex).join(', '))}`;
      }
    }
  }
}

// ── Equivalence by random evaluation ────────────────────────────────────

export interface EquivOptions {
  vars: readonly string[];
  /** One domain for every variable, or one per variable. Default [−3, 3] staying 0.05 away from 0. */
  domain?: Domain | Readonly<Record<string, Domain>>;
  /** Valid points to compare. Default 24. */
  samples?: number;
  rtol?: number;
  atol?: number;
  /** Accept a constant difference (antiderivatives). */
  upToConstant?: boolean;
  seed?: number;
}

export type EquivResult =
  | { equivalent: true; checked: number }
  | {
      equivalent: false;
      reason: 'parse' | 'different' | 'undefined-here' | 'no-points';
      error?: ExprError;
      /** A point where they differ (for feedback: "at x = 2 yours gives 5, not 6"). */
      at?: Record<string, number>;
      expected?: number;
      got?: number;
    };

const DEFAULT_DOMAIN: Domain = { lo: -3, hi: 3, exclude: [0] };

function isDomain(d: unknown): d is Domain {
  return typeof d === 'object' && d !== null && typeof (d as Domain).lo === 'number' && typeof (d as Domain).hi === 'number';
}

function domainFor(v: string, d: EquivOptions['domain']): Domain {
  if (!d) return DEFAULT_DOMAIN;
  if (isDomain(d)) return d;
  return (d as Record<string, Domain>)[v] ?? DEFAULT_DOMAIN;
}

const close = (a: number, b: number, rtol: number, atol: number): boolean =>
  Math.abs(a - b) <= atol + rtol * Math.max(Math.abs(a), Math.abs(b));

/**
 * Is `got` the same function as `expected` on the domain? Points where
 * `expected` is undefined are skipped; a point where `expected` is defined but
 * `got` isn't counts as different (so ln(x²) ≠ 2 ln x on [−3, 3], but they
 * are equal on [0.1, 3]).
 */
export function equivalent(expected: string | Expr, got: string | Expr, opts: EquivOptions): EquivResult {
  const { vars, samples = 24, rtol = 1e-6, atol = 1e-9, upToConstant = false } = opts;
  const exp = typeof expected === 'string' ? parseExpr(expected, { vars }) : expected;
  let g: Expr;
  if (typeof got === 'string') {
    const r = tryParseExpr(got, { vars });
    if (!r.ok) return { equivalent: false, reason: 'parse', error: r.error };
    g = r.expr;
  } else g = got;
  const fe = compileExpr(exp);
  const fg = compileExpr(g);
  const rng = createRng(opts.seed ?? hashSeed(`${typeof expected === 'string' ? expected : exprToTex(exp)}`));
  const draw = (d: Domain): number => {
    for (let k = 0; k < 50; k++) {
      const x = d.integer ? rng.int(d.lo, d.hi) : rng.float(d.lo, d.hi);
      const ex = d.exclude ?? [];
      if (ex.every((p) => Math.abs(x - p) > (d.integer ? 0.5 : 0.05))) return x;
    }
    return d.integer ? Math.round(d.lo) : d.lo;
  };
  let valid = 0;
  let offset: number | null = null;
  for (let tries = 0; tries < samples * 8 && valid < samples; tries++) {
    const at: Record<string, number> = {};
    for (const v of vars) at[v] = draw(domainFor(v, opts.domain));
    const ve = fe(at);
    if (!Number.isFinite(ve) || Math.abs(ve) > 1e12) continue;
    const vg = fg(at);
    if (!Number.isFinite(vg)) return { equivalent: false, reason: 'undefined-here', at, expected: ve, got: vg };
    if (upToConstant) {
      const diff = vg - ve;
      if (offset === null) offset = diff;
      else if (!close(diff, offset, rtol, atol + rtol * Math.max(Math.abs(ve), Math.abs(vg)))) {
        return { equivalent: false, reason: 'different', at, expected: ve + offset, got: vg };
      }
    } else if (!close(ve, vg, rtol, atol)) {
      return { equivalent: false, reason: 'different', at, expected: ve, got: vg };
    }
    valid++;
  }
  if (valid < Math.min(4, samples)) return { equivalent: false, reason: 'no-points' };
  return { equivalent: true, checked: valid };
}

export type NumberResult = { ok: true; value: number; tex: string } | { ok: false; error: ExprError };

/** A numeric answer typed as an expression: "1/3", "sqrt(2)/2", "2pi", "3.0e8". */
export function evalNumber(src: string): NumberResult {
  const r = tryParseExpr(src.replace(/(\d),(\d{3})(?!\d)/g, '$1$2'), { vars: [] });
  if (!r.ok) return r;
  const value = evaluateExpr(r.expr);
  return { ok: true, value, tex: exprToTex(r.expr) };
}
