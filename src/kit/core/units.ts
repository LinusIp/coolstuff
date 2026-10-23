/**
 * Units for physics (and systems) answers: parse "kg·m/s²", "J/(kg K)",
 * "km/h", "MΩ", "ns", "GB/s" into a scale factor and SI dimensions, so an
 * answer can be checked for the right *kind* of quantity and converted.
 * Pure; no DOM.
 *
 *   parseUnit('km/h')  → { scale: 0.2777…, dims: [1, 0, -1, 0, 0, 0, 0, 0] }
 *   sameDimension(parseUnit('N'), parseUnit('kg m/s^2')) → true
 *   splitQuantity('9.8 m/s^2') → { value: '9.8', unit: 'm/s^2' }
 *
 * Temperatures: °C (or degC) converts to K with its offset only when it stands
 * alone; inside a compound unit (J/(kg·°C)) it is a temperature *difference*.
 *
 * Angles and cycles are soft pseudo-dimensions. Radians stay dimensionless for
 * `sameDimension` (so rad/s and 1/s agree, and N·m·rad is still a torque), but
 * every unit also records an `angle` exponent (rad, °, rev, rpm) and a `cycle`
 * exponent (Hz). `angleCompat` uses them to catch the classic ω-vs-f mistake:
 * "1 Hz" is not an answer in rad/s (ω = 2πf), while 60 rpm = 2π rad/s = 1 Hz
 * all convert, because a revolution is both an angle and a cycle.
 */

/** Exponents of m, kg, s, A, K, mol, cd, bit. Angles are dimensionless here (see `Unit.angle`). */
export type Dims = readonly [number, number, number, number, number, number, number, number];

export interface Unit {
  /** Multiply a value in this unit by `scale` (then add `offset`) to get SI. */
  scale: number;
  dims: Dims;
  /** Only for a lone offset unit (°C). */
  offset?: number;
  /** Exponent of the angle pseudo-dimension (rad, °, rev, rpm carry it); 0 or absent for none. */
  angle?: number;
  /** Exponent of the cycle pseudo-dimension (Hz carries it). */
  cycle?: number;
  /** Uses a revolution-based unit (rev, rpm): convertible between angles and cycles with 2π. */
  rev?: boolean;
}

const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0, bit = 0): Dims => [m, kg, s, A, K, mol, cd, bit];
const NONE = D();

interface UnitDef {
  scale: number;
  dims: Dims;
  prefixes: boolean;
  offset?: number;
  angle?: number;
  cycle?: number;
  rev?: boolean;
}

const U: Readonly<Record<string, UnitDef>> = {
  m: { scale: 1, dims: D(1), prefixes: true },
  g: { scale: 1e-3, dims: D(0, 1), prefixes: true },
  s: { scale: 1, dims: D(0, 0, 1), prefixes: true },
  A: { scale: 1, dims: D(0, 0, 0, 1), prefixes: true },
  K: { scale: 1, dims: D(0, 0, 0, 0, 1), prefixes: true },
  mol: { scale: 1, dims: D(0, 0, 0, 0, 0, 1), prefixes: true },
  cd: { scale: 1, dims: D(0, 0, 0, 0, 0, 0, 1), prefixes: true },
  N: { scale: 1, dims: D(1, 1, -2), prefixes: true },
  J: { scale: 1, dims: D(2, 1, -2), prefixes: true },
  W: { scale: 1, dims: D(2, 1, -3), prefixes: true },
  Pa: { scale: 1, dims: D(-1, 1, -2), prefixes: true },
  C: { scale: 1, dims: D(0, 0, 1, 1), prefixes: true },
  V: { scale: 1, dims: D(2, 1, -3, -1), prefixes: true },
  ohm: { scale: 1, dims: D(2, 1, -3, -2), prefixes: true },
  Ω: { scale: 1, dims: D(2, 1, -3, -2), prefixes: true },
  S: { scale: 1, dims: D(-2, -1, 3, 2), prefixes: true },
  F: { scale: 1, dims: D(-2, -1, 4, 2), prefixes: true },
  H: { scale: 1, dims: D(2, 1, -2, -2), prefixes: true },
  T: { scale: 1, dims: D(0, 1, -2, -1), prefixes: true },
  Wb: { scale: 1, dims: D(2, 1, -2, -1), prefixes: true },
  Hz: { scale: 1, dims: D(0, 0, -1), prefixes: true, cycle: 1 },
  L: { scale: 1e-3, dims: D(3), prefixes: true },
  l: { scale: 1e-3, dims: D(3), prefixes: true },
  eV: { scale: 1.602176634e-19, dims: D(2, 1, -2), prefixes: true },
  bar: { scale: 1e5, dims: D(-1, 1, -2), prefixes: true },
  atm: { scale: 101325, dims: D(-1, 1, -2), prefixes: false },
  cal: { scale: 4.184, dims: D(2, 1, -2), prefixes: true },
  min: { scale: 60, dims: D(0, 0, 1), prefixes: false },
  h: { scale: 3600, dims: D(0, 0, 1), prefixes: false },
  hr: { scale: 3600, dims: D(0, 0, 1), prefixes: false },
  day: { scale: 86400, dims: D(0, 0, 1), prefixes: false },
  rad: { scale: 1, dims: NONE, prefixes: true, angle: 1 },
  deg: { scale: Math.PI / 180, dims: NONE, prefixes: false, angle: 1 },
  '°': { scale: Math.PI / 180, dims: NONE, prefixes: false, angle: 1 },
  rev: { scale: 2 * Math.PI, dims: NONE, prefixes: false, angle: 1, rev: true },
  rpm: { scale: (2 * Math.PI) / 60, dims: D(0, 0, -1), prefixes: false, angle: 1, rev: true },
  '%': { scale: 0.01, dims: NONE, prefixes: false },
  '°C': { scale: 1, dims: D(0, 0, 0, 0, 1), prefixes: false, offset: 273.15 },
  degC: { scale: 1, dims: D(0, 0, 0, 0, 1), prefixes: false, offset: 273.15 },
  bit: { scale: 1, dims: D(0, 0, 0, 0, 0, 0, 0, 1), prefixes: true },
  B: { scale: 8, dims: D(0, 0, 0, 0, 0, 0, 0, 1), prefixes: true },
};

const PREFIX: Readonly<Record<string, number>> = {
  Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1,
  d: 1e-1, c: 1e-2, m: 1e-3, µ: 1e-6, μ: 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18,
};
/** Binary prefixes and the customary "K" for data sizes only. */
const DATA_PREFIX: Readonly<Record<string, number>> = { K: 1e3, Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4 };

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitError';
  }
}

/** One unit symbol with an optional prefix ("km", "µs", "MΩ", "KiB"), or null. */
function symbol(tok: string): UnitDef | null {
  if (U[tok]) return U[tok];
  for (const [p, f] of [...Object.entries(PREFIX), ...Object.entries(DATA_PREFIX)].sort((a, b) => b[0].length - a[0].length)) {
    if (!tok.startsWith(p) || tok.length === p.length) continue;
    const base = U[tok.slice(p.length)];
    if (!base || !base.prefixes) continue;
    const isData = base.dims[7] !== 0;
    if (p in DATA_PREFIX && !(p in PREFIX) && !isData) continue;
    if (p === 'K' && !isData) continue;
    return { ...base, scale: base.scale * f, prefixes: false };
  }
  return null;
}

const SUP: Readonly<Record<string, string>> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };

type UTok = { k: 'word'; v: string } | { k: 'op'; v: '*' | '/' | '(' | ')' } | { k: 'pow'; v: number } | { k: 'one' };

function lex(src: string): UTok[] {
  const s = src
    .trim()
    .replace(/[·⋅∙×]/g, '*')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `^${[...run].map((c) => SUP[c]).join('')}`)
    .replace(/\^\(\s*(-?\d+)\s*\)/g, '^$1')
    .replace(/\^\{\s*(-?\d+)\s*\}/g, '^$1');
  const out: UTok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      // Whitespace between two units is multiplication.
      const prev = out[out.length - 1];
      let j = i;
      while (j < s.length && /\s/.test(s[j])) j++;
      const next = s[j];
      if (prev && (prev.k === 'word' || prev.k === 'pow' || (prev.k === 'op' && prev.v === ')')) && next && /[A-Za-zµμΩ°%(]/.test(next)) {
        out.push({ k: 'op', v: '*' });
      }
      i = j;
      continue;
    }
    if (ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      out.push({ k: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '.' && out.length && s[i + 1] && /[A-Za-zµμΩ°]/.test(s[i + 1])) {
      out.push({ k: 'op', v: '*' }); // "N.m"
      i++;
      continue;
    }
    if (ch === '^') {
      const m = /^\^\s*([+-]?\d+)/.exec(s.slice(i));
      if (!m) throw new UnitError('A unit power must be a whole number, like s^2 or s^-1.');
      out.push({ k: 'pow', v: Number(m[1]) });
      i += m[0].length;
      continue;
    }
    const last = out[out.length - 1];
    if (ch === '1' && (!last || (last.k === 'op' && last.v === '('))) {
      out.push({ k: 'one' });
      i++;
      continue;
    }
    const w = /^(°C|°|%|[A-Za-zµμΩ]+)/.exec(s.slice(i));
    if (w) {
      out.push({ k: 'word', v: w[0] });
      i += w[0].length;
      const digits = /^\d+/.exec(s.slice(i)); // "m2" for m², as people type it
      if (digits) {
        out.push({ k: 'pow', v: Number(digits[0]) });
        i += digits[0].length;
      }
      continue;
    }
    throw new UnitError(`Unexpected "${ch}" in the unit.`);
  }
  return out;
}

interface Acc {
  scale: number;
  dims: number[];
  angle: number;
  cycle: number;
  rev: boolean;
}
const mulAcc = (a: Acc, b: Acc, sign: 1 | -1): Acc => ({
  scale: a.scale * b.scale ** sign,
  dims: a.dims.map((d, k) => d + sign * b.dims[k]),
  angle: a.angle + sign * b.angle,
  cycle: a.cycle + sign * b.cycle,
  rev: a.rev || b.rev,
});
const powAcc = (a: Acc, p: number): Acc => ({ ...a, scale: a.scale ** p, dims: a.dims.map((d) => d * p), angle: a.angle * p, cycle: a.cycle * p });
const accOf = (u: UnitDef): Acc => ({ scale: u.scale, dims: [...u.dims], angle: u.angle ?? 0, cycle: u.cycle ?? 0, rev: !!u.rev });
const ONE: Acc = { scale: 1, dims: [...NONE], angle: 0, cycle: 0, rev: false };

/** A word that may be several units run together ("Nm", "kWh"). */
function wordUnit(w: string): Acc {
  const one = symbol(w);
  if (one) return accOf(one);
  // Split greedily into known symbols, longest first.
  for (let cut = w.length - 1; cut > 0; cut--) {
    const head = symbol(w.slice(0, cut));
    if (!head) continue;
    try {
      const rest = wordUnit(w.slice(cut));
      return mulAcc(accOf(head), rest, 1);
    } catch {
      /* try a shorter head */
    }
  }
  throw new UnitError(`"${w}" isn't a unit this answer understands.`);
}

class UParser {
  private i = 0;
  constructor(private readonly t: UTok[]) {}
  parse(): Acc {
    const a = this.expr();
    if (this.i < this.t.length) throw new UnitError('That unit has something extra at the end.');
    return a;
  }
  private expr(): Acc {
    let a = this.factor();
    while (this.i < this.t.length) {
      const tok = this.t[this.i];
      if (tok.k === 'op' && (tok.v === '*' || tok.v === '/')) {
        this.i++;
        a = mulAcc(a, this.factor(), tok.v === '*' ? 1 : -1);
      } else if (tok.k === 'word' || (tok.k === 'op' && tok.v === '(')) {
        a = mulAcc(a, this.factor(), 1);
      } else break;
    }
    return a;
  }
  private factor(): Acc {
    const tok = this.t[this.i++];
    if (!tok) throw new UnitError('The unit ends too early.');
    let a: Acc;
    if (tok.k === 'word') a = wordUnit(tok.v);
    else if (tok.k === 'one') a = { ...ONE, dims: [...NONE] };
    else if (tok.k === 'op' && tok.v === '(') {
      a = this.expr();
      const close = this.t[this.i++];
      if (!close || close.k !== 'op' || close.v !== ')') throw new UnitError('A "(" in the unit is never closed.');
    } else throw new UnitError('That unit is missing a symbol.');
    const next = this.t[this.i];
    if (next && next.k === 'pow') {
      this.i++;
      a = powAcc(a, next.v);
    }
    return a;
  }
}

/** Parse a unit expression. Throws `UnitError` with a learner-facing message. */
export function parseUnit(src: string): Unit {
  const s = src.trim();
  if (s === '') return { scale: 1, dims: NONE };
  const lone = U[s];
  if (lone?.offset !== undefined) return { scale: lone.scale, dims: lone.dims, offset: lone.offset };
  const acc = new UParser(lex(s)).parse();
  const u: Unit = { scale: acc.scale, dims: acc.dims.map((d) => d + 0) as unknown as Dims };
  if (acc.angle) u.angle = acc.angle;
  if (acc.cycle) u.cycle = acc.cycle;
  if (acc.rev) u.rev = true;
  return u;
}

/** Same SI dimensions (angles and cycles are dimensionless here; see `angleCompat`). */
export function sameDimension(a: Unit, b: Unit): boolean {
  return a.dims.every((d, k) => Math.abs(d - b.dims[k]) < 1e-9);
}

export type AngleCompat = { ok: true; factor: number } | { ok: false; message: string };

/**
 * Angles vs cycles, for two units of the same SI dimension. Returns the extra
 * factor to multiply a `convert`ed value by, or a learner-facing reason:
 *
 * - same angle/cycle exponents, or either side has neither → fine (rad is dimensionless; Hz = 1/s)
 * - cycles (Hz) where an angle rate is expected (rad/s, °/s) → rejected: "ω = 2πf"
 * - an angle rate (rad/s) where cycles (Hz) are expected → rejected: "f = ω/2π"
 * - revolution-based units (rev, rpm) convert both ways with 2π: 60 rpm = 2π rad/s = 1 Hz
 *
 * `givenText` is the unit as the learner typed it, for the message.
 */
export function angleCompat(given: Unit, expected: Unit, givenText = 'that unit'): AngleCompat {
  const ga = given.angle ?? 0;
  const gc = given.cycle ?? 0;
  const ea = expected.angle ?? 0;
  const ec = expected.cycle ?? 0;
  if ((ga === ea && gc === ec) || (ga === 0 && gc === 0) || (ea === 0 && ec === 0)) return { ok: true, factor: 1 };
  // Learner gave cycles where an angle is expected.
  if (gc !== 0 && ga === 0 && ea === gc && ec === 0) {
    if (expected.rev) return { ok: true, factor: (2 * Math.PI) ** gc };
    return { ok: false, message: `"${givenText}" counts cycles per second, but this answer is an angular frequency in rad/s (ω = 2πf).` };
  }
  // Learner gave an angle where cycles are expected.
  if (ga !== 0 && gc === 0 && ec === ga && ea === 0) {
    if (given.rev) return { ok: true, factor: (2 * Math.PI) ** -ga };
    return { ok: false, message: `"${givenText}" measures an angular frequency ω, but this answer is a frequency in Hz, cycles per second (f = ω/2π).` };
  }
  return { ok: true, factor: 1 };
}

/** Convert a value from one unit to another of the same dimension. */
export function convert(value: number, from: Unit, to: Unit): number {
  if (!sameDimension(from, to)) throw new UnitError('Those units measure different things.');
  const si = value * from.scale + (from.offset ?? 0);
  return (si - (to.offset ?? 0)) / to.scale;
}

const KINDS: readonly [Dims, string][] = [
  [D(1), 'length'],
  [D(0, 1), 'mass'],
  [D(0, 0, 1), 'time'],
  [D(0, 0, 0, 1), 'current'],
  [D(0, 0, 0, 0, 1), 'temperature'],
  [D(0, 0, -1), 'frequency'],
  [D(1, 0, -1), 'speed'],
  [D(1, 0, -2), 'acceleration'],
  [D(2), 'area'],
  [D(3), 'volume'],
  [D(1, 1, -1), 'momentum'],
  [D(1, 1, -2), 'force'],
  [D(2, 1, -2), 'energy (or torque)'],
  [D(2, 1, -3), 'power'],
  [D(-1, 1, -2), 'pressure'],
  [D(0, 0, 1, 1), 'charge'],
  [D(2, 1, -3, -1), 'voltage'],
  [D(2, 1, -3, -2), 'resistance'],
  [D(-2, -1, 4, 2), 'capacitance'],
  [D(2, 1, -2, -2), 'inductance'],
  [D(0, 1, -2, -1), 'magnetic field'],
  [D(2, 1, -2, -1), 'magnetic flux'],
  [D(1, 1, -3, -1), 'electric field'],
  [D(2, 1, -1), 'angular momentum'],
  [D(2, 1), 'moment of inertia'],
  [D(-3, 1), 'density'],
  [D(0, 0, 0, 0, 0, 0, 0, 1), 'amount of data'],
  [D(0, 0, -1, 0, 0, 0, 0, 1), 'data rate'],
  [NONE, 'pure number'],
];

/** "speed", "force", … for a unit's dimension, or null if it has no common name. */
export function dimensionName(u: Unit): string | null {
  return KINDS.find(([d]) => sameDimension({ scale: 1, dims: d }, u))?.[1] ?? null;
}

const SUP_OUT: Readonly<Record<string, string>> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };

/** A unit string for plain-text messages: "kg*m/s^2" → "kg·m/s²", "ohm" → "Ω". */
export function prettyUnit(src: string): string {
  return src
    .trim()
    .replace(/\^\(?\s*(-?\d+)\s*\)?/g, (_, p: string) => [...p].map((c) => SUP_OUT[c] ?? c).join(''))
    .replace(/\s*\*\s*/g, '·')
    .replace(/ohm\b/g, 'Ω')
    .replace(/\bdegC\b/g, '°C')
    .replace(/\bdeg\b/g, '°')
    .replace(/\bu(?=[a-zA-Z])/g, 'µ');
}

/** A unit string as TeX for previews: "kg*m/s^2" → \mathrm{kg\cdot m/s^{2}}. */
export function unitToTex(src: string): string {
  const s = src
    .trim()
    .replace(/[·⋅∙×*]/g, '\\cdot ')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `^{${[...run].map((c) => SUP[c]).join('')}}`)
    .replace(/\^\(?\s*(-?\d+)\s*\)?/g, '^{$1}')
    .replace(/ohm\b|Ω/g, '\\Omega ')
    .replace(/[µμ]/g, '\\mu ')
    .replace(/°C/g, '{}^{\\circ}\\mathrm{C}')
    .replace(/°/g, '^{\\circ}')
    .replace(/%/g, '\\%')
    .replace(/\s+(?=[A-Za-z\\])/g, '\\,');
  return `\\mathrm{${s}}`;
}

/** Letters that start a unit in a typed quantity, after the number. */
const FUNCTION_WORDS = new Set([
  'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'asin', 'acos', 'atan', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'exp', 'ln', 'log', 'sqrt', 'cbrt', 'abs', 'pi', 'e',
]);

/**
 * Split "9.8 m/s^2" into the number part and the unit part. The unit starts
 * at the first word that isn't a function or constant, or at °, Ω, µ or %.
 * A leading "v =" is dropped.
 */
export function splitQuantity(input: string): { value: string; unit: string } {
  let s = input.trim();
  const eq = s.indexOf('=');
  if (eq >= 0) s = s.slice(eq + 1).trim();
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest);
    if (num) {
      i += num[0].length;
      continue;
    }
    const w = /^(log10|log2|log_\d+|[A-Za-z]+)/.exec(rest);
    if (w) {
      if (w[0].startsWith('log') || FUNCTION_WORDS.has(w[0])) {
        i += w[0].length;
        continue;
      }
      break;
    }
    if (/^[°Ωµμ%]/.test(rest)) break;
    i++;
  }
  return { value: s.slice(0, i).trim(), unit: s.slice(i).trim() };
}
