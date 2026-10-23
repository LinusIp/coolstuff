/**
 * Running learner code, and comparing results. Pure and synchronous, so the
 * browser and the tests run exactly the same code:
 *
 * - `runSnippet(code, { inputs, prelude, helpers })`: a "Code it" cell. Lesson
 *   tests call it in Node ("the shipped GD snippet converges"); CodeCell's
 *   Worker calls it in the browser.
 * - `runCodeTests(source, { entry, tests })`: a write-the-code problem. Lesson
 *   tests prove the reference solution passes and the starter doesn't;
 *   Problem's Worker runs it on the learner's code.
 *
 * In the browser both run ONLY inside the sandboxed Worker (G4's
 * `runSandboxed`), which adds the time limit by terminating the Worker. Never
 * call them on the main thread with learner code. What leaves the Worker goes
 * through `sanitizeReport` / `toCloneable` first (hidden test data stripped,
 * functions and cyclic values turned into text), so postMessage never throws
 * a DataCloneError.
 */
import type { CodeAnswer, CodeTest, Verdict } from '../types';

export interface CodeTestResult {
  name: string;
  ok: boolean;
  hidden: boolean;
  args?: readonly unknown[];
  expected?: unknown;
  got?: unknown;
  /** Thrown error message (or "returned undefined: did you forget return?"). */
  error?: string;
}

export interface CodeRunReport {
  ok: boolean;
  passed: number;
  total: number;
  results: CodeTestResult[];
  /** Syntax error or missing entry function. */
  compileError?: string;
  /** console.log output, captured. */
  logs: string[];
}

/** Compare a result with the expected value. */
export function compareValues(got: unknown, expected: unknown, mode: CodeTest['compare'] = 'deep', tolerance = 1e-9): boolean {
  if (mode === 'approx') return approx(got, expected, tolerance);
  if (mode === 'unordered' || mode === 'set') {
    if (!Array.isArray(got) || !Array.isArray(expected)) return false;
    const norm = (xs: unknown[]) => (mode === 'set' ? [...new Set(xs.map(stable))] : xs.map(stable)).sort();
    const a = norm(got);
    const b = norm(expected);
    return a.length === b.length && a.every((x, k) => x === b[k]);
  }
  return stable(got) === stable(expected);
}

function approx(a: unknown, b: unknown, tol: number): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)) || (Number.isNaN(a) && Number.isNaN(b));
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, k) => approx(x, b[k], tol));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && approx((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], tol));
  }
  return stable(a) === stable(b);
}

/** Deterministic serialisation (sorted keys; NaN, Infinity and undefined kept distinct; -0 counts as 0, so a learner's -0 equals an expected 0). */
export function stable(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : Object.is(v, -0) ? '0' : String(v);
  if (typeof v === 'bigint') return `${v}n`;
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v instanceof Map) return `Map(${stable([...v.entries()].sort((a, b) => (stable(a[0]) < stable(b[0]) ? -1 : 1)))})`;
  if (v instanceof Set) return `Set(${stable([...v].map(stable).sort())})`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

/** Short human form of a value for "expected … got …" lines. */
export function formatValue(v: unknown, max = 80): string {
  let s: string;
  if (typeof v === 'string') s = JSON.stringify(v);
  else if (typeof v === 'number') s = Number.isNaN(v) ? 'NaN' : String(Number(v.toPrecision(12)));
  else if (v === undefined) s = 'undefined';
  else if (typeof v === 'function') s = 'a function';
  else {
    try {
      s = JSON.stringify(v, (_, x) => (typeof x === 'number' && !Number.isFinite(x) ? String(x) : x));
    } catch {
      s = String(v);
    }
  }
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const clone = <T>(x: T): T => (typeof structuredClone === 'function' ? structuredClone(x) : (JSON.parse(JSON.stringify(x)) as T));

/** Freeze a cloned input all the way down, so a snippet can't mutate what the page passed in. */
function deepFreeze<T>(x: T, seen = new Set<unknown>()): T {
  if (x === null || typeof x !== 'object' || seen.has(x) || ArrayBuffer.isView(x)) return x;
  seen.add(x);
  for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v, seen);
  return Object.freeze(x);
}

/** Hidden source a cell or problem runs before the learner's code. */
export interface CodePrelude {
  /** Hidden source run before the visible code (datasets, helper functions). Line numbers in errors stay relative to the visible code. */
  prelude?: string;
  /**
   * Named helpers made available to the code: function source strings
   * (`'function loss(w) { return (w - 3) ** 2; }'` or `'(w) => 2 * (w - 3)'`),
   * or self-contained functions (sent as their `toString()`: they must not
   * call other module-level names, which a production build renames).
   */
  helpers?: Readonly<Record<string, string | ((...args: never[]) => unknown)>>;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

function preludeSource(p: CodePrelude): { src: string; error?: string } {
  const lines: string[] = [];
  for (const [name, h] of Object.entries(p.helpers ?? {})) {
    if (!IDENT.test(name)) return { src: '', error: `Helper name "${name}" isn't a valid identifier.` };
    const body = typeof h === 'function' ? h.toString() : h.trim();
    // "function loss(w) {…}" declares itself; anything else is an expression to bind.
    lines.push(new RegExp(`^function\\s+${name.replace(/\$/g, '\\$')}\\s*\\(`).test(body) ? body : `const ${name} = (${body});`);
  }
  if (p.prelude) lines.push(p.prelude);
  return { src: lines.join('\n') };
}

const countLines = (s: string): number => (s === '' ? 0 : s.split('\n').length);

/** Lines the engine adds before a `new Function` body (2 in V8 and SpiderMonkey), measured once. */
let wrapperLines: number | null = null;
function functionWrapperLines(): number {
  if (wrapperLines !== null) return wrapperLines;
  try {
    new Function('throw new Error("probe")')();
  } catch (err) {
    const line = errorLine(err, 0);
    wrapperLines = line !== undefined ? line - 1 : 2;
  }
  return wrapperLines ?? 2;
}

/** Lines of the `new Function` frames in an error's stack, innermost first. */
function frameLines(err: unknown): number[] {
  const stack = (err as Error)?.stack ?? '';
  return [...stack.matchAll(/(?:<anonymous>|> Function|> eval):(\d+):\d+/g)].map((m) => Number(m[1]));
}

/** 1-based line of the innermost `new Function` frame, minus `offset`; undefined if unknown. */
function errorLine(err: unknown, offset: number): number | undefined {
  const first = frameLines(err)[0];
  if (first === undefined) return undefined;
  const line = first - offset;
  return line >= 1 ? line : undefined;
}

function captureConsole(logs: string[]) {
  const log = (...xs: unknown[]) => {
    logs.push(xs.map((x) => (typeof x === 'string' ? x : formatValue(x, 200))).join(' '));
  };
  return { log, info: log, warn: log, error: log, debug: log };
}

/**
 * Compile `source`, find the entry function, run every test. Arguments are
 * cloned per test so a mutating solution can't poison the next test.
 */
export function runCodeTests(source: string, answer: Pick<CodeAnswer, 'entry' | 'tests'>, extra: CodePrelude = {}): CodeRunReport {
  const logs: string[] = [];
  const fakeConsole = captureConsole(logs);
  const total = answer.tests.length;
  const pre = preludeSource(extra);
  if (pre.error) return { ok: false, passed: 0, total, results: [], compileError: pre.error, logs };
  let fn: unknown;
  try {
    fn = new Function('console', `"use strict";\n${pre.src}\n${source}\n;return typeof ${answer.entry} === 'function' ? ${answer.entry} : undefined;`)(fakeConsole);
  } catch (err) {
    return { ok: false, passed: 0, total, results: [], compileError: (err as Error).message, logs };
  }
  if (typeof fn !== 'function') {
    return { ok: false, passed: 0, total, results: [], compileError: `Define a function called ${answer.entry}.`, logs };
  }
  const results: CodeTestResult[] = answer.tests.map((t, k) => {
    const name = t.name ?? `test ${k + 1}`;
    const hidden = !!t.hidden;
    try {
      const got = (fn as (...a: unknown[]) => unknown)(...clone([...t.args]));
      const ok = compareValues(got, t.expect, t.compare, t.tolerance);
      const r: CodeTestResult = { name, ok, hidden, args: t.args, expected: t.expect, got };
      if (!ok && got === undefined) r.error = 'returned undefined: did you forget to return?';
      return r;
    } catch (err) {
      return { name, ok: false, hidden, args: t.args, expected: t.expect, error: (err as Error)?.message ?? String(err) };
    }
  });
  const passed = results.filter((r) => r.ok).length;
  return { ok: passed === total, passed, total, results, logs };
}

/**
 * A report that is safe to postMessage and to show: hidden tests lose their
 * arguments, expected values and results (only name and pass/fail remain),
 * and every `got` becomes display text (`formatValue`), so functions or
 * cyclic results can't throw a DataCloneError.
 */
export function sanitizeReport(report: CodeRunReport): CodeRunReport {
  return {
    ...report,
    logs: [...report.logs],
    results: report.results.map((r) => {
      if (r.hidden) return { name: r.name, ok: r.ok, hidden: true, ...(r.error && !r.ok ? { error: r.error } : {}) };
      return { ...r, args: r.args?.map((a) => toCloneable(a)), expected: toCloneable(r.expected), got: 'got' in r ? formatValue(r.got) : undefined };
    }),
  };
}

// ── Structured-clone safety (values crossing into and out of the Worker) ──

/**
 * Why `v` can't cross into the sandbox Worker (structured clone) intact, or
 * null if it can: functions, symbols, DOM nodes and class instances (whose
 * methods would be lost) are refused, with the path to the bad part.
 */
export function cloneIssue(v: unknown, path = 'value', seen = new Set<unknown>()): string | null {
  if (v === null || v === undefined) return null;
  const t = typeof v;
  if (t === 'function') return `${path} is a function; pass its source as a helper instead (functions can't cross into the sandbox).`;
  if (t === 'symbol') return `${path} is a symbol, which can't cross into the sandbox.`;
  if (t !== 'object') return null;
  if (seen.has(v)) return null;
  seen.add(v);
  if (Array.isArray(v)) {
    for (let k = 0; k < v.length; k++) {
      const e = cloneIssue(v[k], `${path}[${k}]`, seen);
      if (e) return e;
    }
    return null;
  }
  if (v instanceof Date || v instanceof RegExp || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return null;
  if (v instanceof Map) {
    for (const [k, x] of v) {
      const e = cloneIssue(k, `${path} key`, seen) ?? cloneIssue(x, `${path}.get(${formatValue(k, 20)})`, seen);
      if (e) return e;
    }
    return null;
  }
  if (v instanceof Set) {
    for (const x of v) {
      const e = cloneIssue(x, `${path} item`, seen);
      if (e) return e;
    }
    return null;
  }
  if (typeof (v as { nodeType?: unknown }).nodeType === 'number') return `${path} is a DOM node, which can't cross into the sandbox.`;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) {
    if (typeof (v as { peek?: unknown }).peek === 'function' && 'value' in (v as object)) return `${path} is a signal; give CodeCell the signal itself in \`inputs\` (it sends the current value) rather than nesting it.`;
    return `${path} is a ${proto?.constructor?.name ?? 'class'} instance; its methods wouldn't survive the trip into the sandbox. Pass plain data.`;
  }
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const e = cloneIssue(x, `${path}.${k}`, seen);
    if (e) return e;
  }
  return null;
}

/** `v` itself if it can be structured-cloned, else its display text (for results leaving the Worker). */
export function toCloneable(v: unknown): unknown {
  return cloneIssue(v) === null ? v : formatValue(v, 200);
}

// ── Code-it snippets ────────────────────────────────────────────────────

export interface SnippetOptions extends CodePrelude {
  /** Read-only globals, by identifier. Cloned per run (in the browser they must be structured-cloneable: `cloneIssue`). */
  inputs?: Readonly<Record<string, unknown>>;
  /** Called on every `emit` as it happens (the Worker streams these, throttled). */
  onEmit?: (name: string, value: unknown) => void;
  /** History kept per emitted name in `streams`. Default 10,000 (older values are dropped first). */
  maxStream?: number;
}

export interface SnippetResult {
  ok: boolean;
  /** console.log/info/warn/error output, captured in order. */
  logs: string[];
  /** The LAST value emitted per name: what a visual shows when the run ends. */
  emits: Record<string, unknown>;
  /** EVERY value emitted per name, in order (a cloned snapshot per emit, capped at `maxStream`). */
  streams: Record<string, unknown[]>;
  /** The value of a top-level `return`, if the snippet has one. */
  returned?: unknown;
  /** A thrown error: `line` is 1-based in the visible code (undefined for syntax errors in V8); `where` says if it came from the hidden prelude. */
  error?: { message: string; line?: number; where: 'code' | 'prelude' };
}

/**
 * Run a "Code it" snippet: `emit(name, value)` publishes values to visuals,
 * `console.log` is captured, `inputs` are read-only globals, and helpers /
 * prelude are hidden source that runs first. Synchronous and pure (apart
 * from the code itself): lesson tests call it in Node to assert what the
 * shipped snippet does, and the sandbox Worker calls the same function.
 *
 * Emit semantics: `emits[name]` is the last value; `streams[name]` holds every
 * value in order (each a snapshot, so `emit('path', path)` inside a loop records
 * the path as it was at that moment). Values must be plain data; emitting a
 * function throws a learner-facing error.
 */
export function runSnippet(code: string, opts: SnippetOptions = {}): SnippetResult {
  const logs: string[] = [];
  const emits: Record<string, unknown> = {};
  const streams: Record<string, unknown[]> = {};
  const max = opts.maxStream ?? 10_000;
  const fail = (message: string, where: 'code' | 'prelude' = 'code', line?: number): SnippetResult => ({ ok: false, logs, emits, streams, error: { message, line, where } });

  const inputs = opts.inputs ?? {};
  for (const name of Object.keys(inputs)) if (!IDENT.test(name)) return fail(`Input name "${name}" isn't a valid identifier.`);
  const pre = preludeSource(opts);
  if (pre.error) return fail(pre.error, 'prelude');

  const emit = (name: unknown, value: unknown): void => {
    if (typeof name !== 'string' || name === '') throw new Error('emit(name, value) needs a name in quotes first, like emit("loss", 0.5).');
    const issue = cloneIssue(value, `emit("${name}", …)`);
    if (issue) throw new Error(issue.replace(/; pass its source as a helper instead.*$/, ': emit plain data (numbers, strings, arrays, objects).'));
    const snap = clone(value);
    emits[name] = snap;
    const list = (streams[name] ??= []);
    list.push(snap);
    if (list.length > max) list.splice(0, list.length - max);
    opts.onEmit?.(name, snap);
  };

  const names = ['console', 'emit', ...Object.keys(inputs)];
  const values = [captureConsole(logs), emit, ...Object.values(inputs).map((v) => (v !== null && typeof v === 'object' ? deepFreeze(clone(v)) : v))];
  const header = `"use strict";\n`;
  const preSrc = pre.src ? `${pre.src}\n` : '';
  const offset = functionWrapperLines() + countLines(header) - 1 + countLines(preSrc.replace(/\n$/, '')) ;
  let fn: (...a: unknown[]) => unknown;
  try {
    fn = new Function(...names, `${header}${preSrc}${code}`) as (...a: unknown[]) => unknown;
  } catch (err) {
    return fail((err as Error).message);
  }
  try {
    const returned = fn(...values);
    return { ok: true, logs, emits, streams, ...(returned !== undefined ? { returned } : {}) };
  } catch (err) {
    // The innermost frame in the visible code is the line to show; if every
    // frame is in the hidden prelude, the error is reported as the prelude's.
    const codeLines = frameLines(err)
      .map((l) => l - offset)
      .filter((l) => l >= 1 && l <= countLines(code));
    const inPrelude = codeLines.length === 0 && frameLines(err).some((l) => l - offset < 1);
    const message = (err as Error)?.message ?? String(err);
    return inPrelude ? fail(message, 'prelude') : fail(message, 'code', codeLines[0]);
  }
}

/** A Verdict for the Problem card from a run report. */
export function codeVerdict(report: CodeRunReport): Verdict {
  if (report.compileError) return { correct: false, reason: 'unparseable', message: report.compileError };
  if (report.ok) return { correct: true, reason: 'correct', message: `All ${report.total} tests pass.` };
  const first = report.results.find((r) => !r.ok);
  const detail = first && !first.hidden && !first.error ? ` First failure: expected ${formatValue(first.expected)}, got ${formatValue(first.got)}.` : first?.error ? ` ${first.error}` : '';
  return { correct: false, reason: 'wrong', message: `${report.passed} of ${report.total} tests pass.${detail}` };
}
