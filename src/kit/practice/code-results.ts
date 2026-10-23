/**
 * Turning a sandboxed test run into what a code problem shows (README §8.2):
 * one line per test ("✓ symmetric: powerIteration([[2,1],[1,2]], 50) → 3",
 * "× expected 5, got 4.9", "hidden test 4 ✓" with nothing else), and the
 * verdict, including runs stopped by the time limit. Pure, tested.
 */
import { codeVerdict, formatValue, type CodeRunReport } from '../core/codecheck';
import type { Verdict } from '../types';

export interface TestLine {
  /** "symmetric", or "hidden test 4" (a hidden test's own name could give it away). */
  name: string;
  ok: boolean;
  hidden: boolean;
  /** `powerIteration([[2,1],[1,2]], 50)` (visible tests only). */
  call?: string;
  expected?: string;
  got?: string;
  error?: string;
}

/** One display line per test. Expects a sanitized report (hidden tests already stripped of their data). */
export function testLines(report: CodeRunReport, entry: string): TestLine[] {
  return report.results.map((r, k) => {
    if (r.hidden) return { name: `hidden test ${k + 1}`, ok: r.ok, hidden: true };
    const line: TestLine = { name: r.name || `test ${k + 1}`, ok: r.ok, hidden: false };
    if (r.args) line.call = `${entry}(${r.args.map((a) => formatValue(a, 60)).join(', ')})`;
    if (r.expected !== undefined || 'expected' in r) line.expected = formatValue(r.expected, 60);
    if (r.got !== undefined) line.got = typeof r.got === 'string' ? r.got : formatValue(r.got, 60);
    if (r.error) line.error = r.error;
    return line;
  });
}

/** The parts of a sandbox result a verdict needs (structurally a `SandboxResult`). */
export interface RunOutcome {
  report?: CodeRunReport;
  error?: { message: string; line?: number };
  timedOut?: boolean;
}

/**
 * Verdict for a code answer's run: the tests' verdict, or why they never ran
 * (time limit, sandbox error). Expects a sanitized report (the sandbox's), whose
 * `got` values are already display text, so they aren't quoted a second time.
 */
export function runVerdict(r: RunOutcome): Verdict {
  const rep = r.report;
  if (rep && !rep.ok && !rep.compileError) {
    const first = rep.results.find((x) => !x.ok);
    let detail = '';
    if (first?.error) detail = ` ${first.hidden ? `Hidden test: ${first.error}` : first.error}`;
    else if (first && !first.hidden) detail = ` First failure (${first.name}): expected ${formatValue(first.expected)}, got ${typeof first.got === 'string' ? first.got : formatValue(first.got)}.`;
    return { correct: false, reason: 'wrong', message: `${rep.passed} of ${rep.total} tests pass.${detail}` };
  }
  if (rep) return codeVerdict(rep);
  if (r.timedOut) return { correct: false, reason: 'wrong', message: r.error?.message ?? 'Stopped: the code ran past its time limit. Look for a loop that never ends.' };
  const where = r.error?.line ? `Line ${r.error.line}: ` : '';
  return { correct: false, reason: 'unparseable', message: `${where}${r.error?.message ?? 'The code could not run.'}` };
}

/** Did the tests actually run (so the run counts as an attempt)? */
export const testsRan = (r: RunOutcome): boolean => (!!r.report && !r.report.compileError) || !!r.timedOut;
