/**
 * Pretty maths from random numbers, for problem generators and live worked
 * examples (CLAUDE.md §5: generated problems are never ugly). Pure.
 *
 *   polyTex([3, -2, 1])          → '3x^{2} - 2x + 1'
 *   polyTex([1, 0, -5], 't')     → 't^{2} - 5'
 *   polyExpr([3, -2, 1])         → '3x^2 - 2x + 1'      (answer-input syntax, for SymbolicAnswer.expr)
 *   signedTerm(-1, 'x')          → '- x'     signedTerm(3, 'x', true) → '3x'
 *   texNum(-0.5, { frac: true }) → '-\tfrac{1}{2}'      texNum(0.1 + 0.2) → '0.3'
 *   findUglyTex('x + -3')        → ['double sign "+ -"']
 *
 * Parenthesise a coefficient you substitute into a template yourself:
 * `(${texNum(a)} - \lambda)` prints `(-3 - \lambda)`, which is fine, while
 * `x - ${a}` prints `x - -3`, which `findUglyTex` (run by every audit) rejects;
 * build it with `'x ' + signedTerm(-a, '')` instead.
 */

export interface TexNumOptions {
  /** Show non-integers that are simple fractions (denominator ≤ `maxDen`) as \tfrac. Default false. */
  frac?: boolean;
  /** Largest denominator `frac` looks for. Default 12. */
  maxDen?: number;
  /** Round to this many decimals (trailing zeros dropped). Default: 10 significant figures, float noise trimmed. */
  decimals?: number;
}

/** A best rational approximation p/q with q ≤ maxDen, if one is within 1e-9. */
export function asFraction(x: number, maxDen = 12): [number, number] | null {
  if (!Number.isFinite(x)) return null;
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-9 * Math.max(1, Math.abs(x))) return [p, q];
  }
  return null;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** A number as TeX: integers plain, float noise trimmed, optional simple fractions, ASCII minus (KaTeX sets a real minus). Never "-0". */
export function texNum(x: number, opts: TexNumOptions = {}): string {
  if (!Number.isFinite(x)) throw new Error(`texNum: ${x} is not a finite number`);
  if (Object.is(x, -0) || Math.abs(x) < 1e-12) return '0';
  if (opts.frac) {
    const f = asFraction(x, opts.maxDen ?? 12);
    if (f && f[1] !== 1) {
      const g = gcd(f[0], f[1]);
      const p = f[0] / g;
      const q = f[1] / g;
      return `${p < 0 ? '-' : ''}\\tfrac{${Math.abs(p)}}{${q}}`;
    }
  }
  let v = opts.decimals !== undefined ? Number(x.toFixed(opts.decimals)) : Number(x.toPrecision(10));
  if (Object.is(v, -0) || v === 0) v = 0;
  const s = String(v);
  if (/e/i.test(s)) {
    const [m, e] = v.toExponential().split('e');
    return `${Number(Number(m).toPrecision(6))} \\times 10^{${Number(e)}}`;
  }
  return s;
}

/** The same number in answer-input syntax (for SymbolicAnswer.expr / commonWrong): fractions as (p/q). */
export function exprNum(x: number, opts: TexNumOptions = {}): string {
  if (Object.is(x, -0) || Math.abs(x) < 1e-12) return '0';
  if (opts.frac) {
    const f = asFraction(x, opts.maxDen ?? 12);
    if (f && f[1] !== 1) {
      const g = gcd(f[0], f[1]);
      return `${f[0] < 0 ? '-' : ''}(${Math.abs(f[0] / g)}/${f[1] / g})`;
    }
  }
  return String(opts.decimals !== undefined ? Number(x.toFixed(opts.decimals)) : Number(x.toPrecision(10)));
}

/**
 * One term of a sum: sign, coefficient and body, tidy. `body` '' is a
 * constant term. Coefficient ±1 drops the 1 (unless the body is empty);
 * 0 gives ''. `first` writes a leading term ("3x", "-x") instead of "+ 3x".
 */
export function signedTerm(c: number, body: string, first = false, opts: TexNumOptions = {}): string {
  if (Math.abs(c) < 1e-12) return '';
  const neg = c < 0;
  const a = Math.abs(c);
  const coef = body !== '' && Math.abs(a - 1) < 1e-12 ? '' : texNum(a, opts);
  const term = `${coef}${body}`;
  if (first) return `${neg ? '-' : ''}${term}`;
  return `${neg ? '-' : '+'} ${term}`;
}

/** Join terms built with `signedTerm` into a tidy sum (first sign folded, empty terms dropped, '0' if nothing is left). */
export function sumTex(terms: readonly { c: number; body: string }[], opts: TexNumOptions = {}): string {
  const parts: string[] = [];
  for (const t of terms) {
    const s = signedTerm(t.c, t.body, parts.length === 0, opts);
    if (s) parts.push(s);
  }
  return parts.length ? parts.join(' ') : '0';
}

/** x^k as TeX: '', 'x', 'x^{2}'. */
const powTex = (v: string, k: number): string => (k === 0 ? '' : k === 1 ? v : `${v}^{${k}}`);

/**
 * A polynomial as TeX, coefficients from the highest power down:
 * [3, -2, 1] → '3x^{2} - 2x + 1'. Zero terms vanish, ±1 coefficients drop
 * the 1, exponent 1 is omitted, and all zeros give '0'.
 */
export function polyTex(coeffs: readonly number[], variable = 'x', opts: TexNumOptions = {}): string {
  const n = coeffs.length - 1;
  return sumTex(
    coeffs.map((c, i) => ({ c, body: powTex(variable, n - i) })),
    opts,
  );
}

/** The same polynomial in answer-input syntax (SymbolicAnswer.expr, commonWrong): '3x^2 - 2x + 1'. */
export function polyExpr(coeffs: readonly number[], variable = 'x', opts: TexNumOptions = {}): string {
  const n = coeffs.length - 1;
  const parts: string[] = [];
  coeffs.forEach((c, i) => {
    if (Math.abs(c) < 1e-12) return;
    const k = n - i;
    const body = k === 0 ? '' : k === 1 ? variable : `${variable}^${k}`;
    const a = Math.abs(c);
    const coef = body !== '' && Math.abs(a - 1) < 1e-12 ? '' : exprNum(a, opts);
    const sep = body && coef && /\)$/.test(coef) ? '*' : body && coef ? '' : '';
    const term = `${coef}${sep}${body}`;
    parts.push(parts.length === 0 ? `${c < 0 ? '-' : ''}${term}` : `${c < 0 ? '-' : '+'} ${term}`);
  });
  return parts.length ? parts.join(' ') : '0';
}

const GREEK = 'alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega';

/** A number for substituting into a product or after a minus: negatives in brackets, `(-2)`. */
export function texParen(x: number, opts: TexNumOptions = {}): string {
  const s = texNum(x, opts);
  return s.startsWith('-') ? `(${s})` : s;
}

/**
 * Typesetting a learner should never see in generated maths: double signs
 * (`+ -`, `- -`, `- +`), a coefficient of 1 or 0 in front of a variable
 * (`1x`, `0x^2`), an added or subtracted zero (`x + 0`), exponent 1 (`x^1`,
 * `x^{1}`), multiplying by one (`\cdot 1`, `1 \cdot x`) and `\frac{…}{1}`.
 * Write `{1}x` if you truly mean it. Returns a description per problem found.
 *
 * `strict: false` checks double signs only: the audits use that for authored
 * text, where `2 \cdot 1` or `x^{1}` may be a deliberate step, and the full
 * check for everything a generator or live parameter produced.
 */
export function findUglyTex(tex: string, opts: { strict?: boolean } = {}): string[] {
  const bad: string[] = [];
  const t = tex.replace(/\\(?:left|right|big|Big|bigg|Bigg)\b/g, '');
  for (const m of t.matchAll(/([+\-−])\s*(?:\{\s*)?([+\-−])(?!\s*\\infty)/g)) bad.push(`double sign "${m[1]} ${m[2]}"`);
  if (opts.strict === false) return bad;
  const one = new RegExp(`(?:^|[^\\d.\\w\\\\_^{}])(1)\\s*(?:\\\\[,;!]\\s*)?([a-zA-Z](?![a-zA-Z])|\\\\(?:${GREEK})(?![a-zA-Z]))`, 'g');
  for (const m of t.matchAll(one)) bad.push(`coefficient 1 in "${m[0].trim()}"`);
  const zero = new RegExp(`(?:^|[^\\d.\\w\\\\_^{}])(0)\\s*(?:\\\\[,;!]\\s*)?([a-zA-Z](?![a-zA-Z])|\\\\(?:${GREEK})(?![a-zA-Z]))`, 'g');
  for (const m of t.matchAll(zero)) bad.push(`coefficient 0 in "${m[0].trim()}"`);
  for (const m of t.matchAll(/[+\-−]\s*0(?![.\d])(?=\s*(?:$|[+\-−=}),&]|\\\\))/g)) bad.push(`zero term "${m[0].trim()}"`);
  for (const m of t.matchAll(/\^\s*(?:\{\s*1\s*\}|1(?![\d.]))/g)) bad.push(`exponent 1 "${m[0].trim()}"`);
  for (const m of t.matchAll(/\\cdot\s*1(?![\d.])|(?:^|[^\d.])1\s*\\cdot/g)) bad.push(`times one "${m[0].trim()}"`);
  for (const m of t.matchAll(/\\[dt]?frac\{[^{}]*\}\{\s*1\s*\}/g)) bad.push(`over one "${m[0]}"`);
  return bad;
}
