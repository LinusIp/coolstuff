/**
 * Labels are serif small caps (DESIGN.md §2), and small caps turn λ into Λ.
 * `labelRuns` splits a label so Greek letters (and a few maths signs that
 * small caps would distort) render as themselves, in lower case.
 */
export interface LabelRun {
  text: string;
  /** Greek or maths: set without small caps. */
  math: boolean;
}

const MATHY = /([\u0370-\u03ff\u1f00-\u1fff∂∇]+)/u;

export function labelRuns(text: string): LabelRun[] {
  return text
    .split(MATHY)
    .filter((s) => s !== '')
    .map((s) => ({ text: s, math: MATHY.test(s) }));
}
