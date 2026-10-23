/**
 * What a learner has entered for one problem: the pure model behind
 * `Problem`'s inputs for every answer kind, plus the small pieces of text a
 * problem card shows (kind label, difficulty word, help line, attempts line,
 * the common-wrong note's title) and "another one". Pure and tested
 * (draft.test.ts): the component only renders these.
 *
 *   const d = initialDraft(spec.answer);                 // empty fields, start positions
 *   draftText(spec.answer, d)                            // what the checker reads ("1, 2, 3, 4" for a matrix)
 *   draftToResponse(spec.answer, d)                      // an exam response, or null while unanswered
 */
import { describePrecision } from '../core/answers';
import type { AnswerResponse } from '../core/answers';
import type { ExamResponse } from '../core/exam';
import { evalNumber, exprToTex, tryParseExpr } from '../core/expr';
import { drawProblem } from '../core/problems';
import { createRng } from '../core/rng';
import type {
  AnswerSpec,
  ChoiceAnswer,
  CommonWrong,
  Difficulty,
  DragTarget,
  NumericAnswer,
  ProblemInstance,
  ProblemProgress,
  ProblemSpec,
  Rich,
  SymbolicAnswer,
  Verdict,
} from '../types';

// ── Drafts ──────────────────────────────────────────────────────────────

/** The learner's input as it stands, by input shape (not by answer kind: numeric and symbolic share `text`). */
export type Draft =
  | { kind: 'text'; text: string }
  /** A matrix grid (row-major) or one field per complex number. */
  | { kind: 'cells'; cells: readonly string[] }
  /** Original option indices (never display positions), plus the one-line reason for `askReason`. */
  | { kind: 'choice'; selected: readonly number[]; reason: string }
  /** `touched` turns true on the first real interaction: an untouched start position is not an answer. */
  | { kind: 'drag'; state: unknown; touched: boolean }
  | { kind: 'proof'; text: string; compared: boolean; ticked: readonly boolean[] }
  | { kind: 'code'; source: string };

/** A new draft, or a function of the latest one (inputs use the function form, so quick successive edits never read a stale draft). */
export type DraftUpdate = Draft | ((prev: Draft) => Draft);

/** How a numeric answer is typed. */
export type NumericLayout =
  | { kind: 'single' }
  /** A vector or a set of roots, comma-separated in one field. */
  | { kind: 'list'; count: number }
  | { kind: 'matrix'; rows: number; cols: number }
  /** One field per complex number (`a + bi`). */
  | { kind: 'complex'; count: number };

const valuesOf = (v: number | readonly number[]): readonly number[] => (typeof v === 'number' ? [v] : v);

export function numericLayout(a: NumericAnswer): NumericLayout {
  const n = valuesOf(a.value).length;
  if (a.complex) return { kind: 'complex', count: Math.max(1, Math.floor(n / 2)) };
  if (a.shape) return { kind: 'matrix', rows: a.shape[0], cols: a.shape[1] };
  return n > 1 ? { kind: 'list', count: n } : { kind: 'single' };
}

/** The state a drag target starts in (point: its start; slider: start; order: as listed; match: nothing placed; custom: initial). */
export function initialDragState(t: DragTarget): unknown {
  switch (t.mode) {
    case 'point':
      return [t.start[0], t.start[1]];
    case 'slider':
      return t.start;
    case 'order':
      return t.items.map((_, i) => i);
    case 'match':
      return t.items.map(() => -1);
    case 'custom':
      return t.initial;
  }
}

/** Empty fields, start positions, the starter code. */
export function initialDraft(answer: AnswerSpec): Draft {
  switch (answer.kind) {
    case 'numeric': {
      const L = numericLayout(answer);
      if (L.kind === 'matrix') return { kind: 'cells', cells: Array.from({ length: L.rows * L.cols }, () => '') };
      if (L.kind === 'complex' && L.count > 1) return { kind: 'cells', cells: Array.from({ length: L.count }, () => '') };
      return { kind: 'text', text: '' };
    }
    case 'symbolic':
      return { kind: 'text', text: '' };
    case 'choice':
      return { kind: 'choice', selected: [], reason: '' };
    case 'drag':
      return { kind: 'drag', state: initialDragState(answer.target), touched: false };
    case 'proof':
      return { kind: 'proof', text: '', compared: false, ticked: answer.checklist.map(() => false) };
    case 'code':
      return { kind: 'code', source: answer.starter };
  }
}

/**
 * The text the checker reads for a typed answer: a matrix grid joined
 * row-major ("1, 2, 3, 4"; an empty cell stays empty so the checker says
 * "fill in all 4 entries"), complex fields joined without the empty ones (so
 * "1 ± 2i" in the first field answers a pair).
 */
export function draftText(answer: AnswerSpec, draft: Draft): string {
  if (draft.kind === 'text') return draft.text;
  if (draft.kind !== 'cells') return '';
  if (answer.kind === 'numeric' && answer.complex) {
    return draft.cells
      .map((c) => c.trim())
      .filter(Boolean)
      .join(', ');
  }
  return draft.cells.map((c) => c.trim()).join(', ');
}

/** Has the learner entered anything (for "3 of 8 answered" and the unanswered-questions confirm)? */
export function isDraftAnswered(answer: AnswerSpec, draft: Draft): boolean {
  switch (draft.kind) {
    case 'text':
      return draft.text.trim() !== '';
    case 'cells':
      return draft.cells.some((c) => c.trim() !== '');
    case 'choice':
      return draft.selected.length > 0;
    case 'drag':
      return draft.touched;
    case 'proof':
      return draft.text.trim() !== '' || draft.ticked.some(Boolean);
    case 'code':
      return answer.kind === 'code' && draft.source.trim() !== answer.starter.trim() && draft.source.trim() !== '';
  }
}

export function isMultiChoice(a: ChoiceAnswer): boolean {
  return typeof a.correct !== 'number';
}

/** A checkable response (for `checkAnswer`) from a non-code draft. */
export function draftToCheck(answer: AnswerSpec, draft: Draft): AnswerResponse | null {
  switch (answer.kind) {
    case 'numeric':
    case 'symbolic':
      return { kind: answer.kind, text: draftText(answer, draft) };
    case 'choice': {
      const sel = draft.kind === 'choice' ? [...draft.selected].sort((a, b) => a - b) : [];
      return { kind: 'choice', selected: isMultiChoice(answer) ? sel : (sel[0] ?? []) };
    }
    case 'drag':
      return { kind: 'drag', state: draft.kind === 'drag' ? draft.state : initialDragState(answer.target) };
    case 'proof':
      return { kind: 'proof', ticked: draft.kind === 'proof' ? draft.ticked : answer.checklist.map(() => false) };
    case 'code':
      return null;
  }
}

/** The exam response for a draft: null while nothing has been entered. Code answers carry their source (graded at submit). */
export function draftToResponse(answer: AnswerSpec, draft: Draft): ExamResponse {
  if (!isDraftAnswered(answer, draft)) return null;
  if (answer.kind === 'code') return { kind: 'code', source: draft.kind === 'code' ? draft.source : answer.starter };
  return draftToCheck(answer, draft);
}

/** Split at top-level commas (brackets protect theirs): "1, f(2, 3), 4" → ["1", "f(2, 3)", "4"]. */
export function splitTopLevel(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** The draft a response came from (review mode, and returning to an exam question). */
export function draftFromResponse(answer: AnswerSpec, response: ExamResponse): Draft {
  const empty = initialDraft(answer);
  if (!response) return empty;
  switch (answer.kind) {
    case 'numeric':
    case 'symbolic': {
      if (response.kind !== answer.kind) return empty;
      if (empty.kind === 'cells') {
        const parts = splitTopLevel(response.text);
        return { kind: 'cells', cells: empty.cells.map((_, k) => parts[k] ?? '') };
      }
      return { kind: 'text', text: response.text };
    }
    case 'choice':
      if (response.kind !== 'choice') return empty;
      return { kind: 'choice', selected: typeof response.selected === 'number' ? [response.selected] : [...response.selected], reason: '' };
    case 'drag':
      return response.kind === 'drag' ? { kind: 'drag', state: response.state, touched: true } : empty;
    case 'proof':
      return response.kind === 'proof' ? { kind: 'proof', text: '', compared: true, ticked: [...response.ticked] } : empty;
    case 'code':
      return response.kind === 'code' ? { kind: 'code', source: response.source ?? answer.starter } : empty;
  }
}

/**
 * Display order of a choice problem's options (display position → original
 * index). Seeded by the problem key and instance seed, so it is stable across
 * reloads but differs between generated instances.
 */
export function choiceOrder(a: ChoiceAnswer, seedKey: string): number[] {
  const idx = a.options.map((_, i) => i);
  return a.shuffle ? createRng(`${seedKey}#shuffle`).shuffle(idx) : idx;
}

/** Option letters: A, B, … Z, then AA, AB… (never needed in practice). */
export const optionLetter = (k: number): string => (k < 26 ? String.fromCharCode(65 + k) : optionLetter(Math.floor(k / 26) - 1) + optionLetter(k % 26));

// ── Attempts and progress text ──────────────────────────────────────────

/**
 * Does this verdict count as an attempt ("2 attempts")? A judged answer does;
 * an empty field, a typo the checker can't read, a missing entry or unit, a
 * too-rough decimal or an unsimplified form doesn't: those are fixed in
 * place, not counted against the learner. A self-checked proof counts once
 * ticked (complete or not); a code run counts when the tests actually ran.
 */
export function countsAsAttempt(v: Verdict, kind: AnswerSpec['kind']): boolean {
  if (v.correct) return true;
  if (kind === 'proof') return v.reason === 'incomplete';
  return v.reason === 'wrong' || v.reason === 'unit-dimension';
}

/** "2 attempts · 1 hint" (empty when nothing has happened yet). */
export function metaLine(p: ProblemProgress | undefined): string {
  if (!p) return '';
  const parts: string[] = [];
  if (p.attempts > 0) parts.push(`${p.attempts} attempt${p.attempts === 1 ? '' : 's'}`);
  if (p.hintsUsed > 0) parts.push(`${p.hintsUsed} hint${p.hintsUsed === 1 ? '' : 's'}`);
  if (p.revealed && !p.solved) parts.push('solution viewed');
  return parts.join(' · ');
}

/** ★ warm-up · ★★ standard · ★★★ exam level. */
export function difficultyWord(d: Difficulty): string {
  return d === 1 ? 'warm-up' : d === 2 ? 'standard' : 'exam level';
}

/** The answer kind in the card head: "Problem 4 · numeric". */
export function kindLabel(a: AnswerSpec): string {
  switch (a.kind) {
    case 'numeric': {
      const L = numericLayout(a);
      if (L.kind === 'matrix') return 'matrix';
      if (L.kind === 'complex') return L.count > 1 ? 'complex numbers' : 'complex number';
      if (L.kind === 'list') return a.ordered === false ? 'numbers' : 'vector';
      return 'numeric';
    }
    case 'symbolic':
      return 'expression';
    case 'choice':
      return isMultiChoice(a) ? 'choose all that apply' : 'multiple choice';
    case 'drag':
      return { point: 'drag the point', order: 'put in order', match: 'match', slider: 'set the slider', custom: 'on the figure' }[a.target.mode];
    case 'proof':
      return 'explain';
    case 'code':
      return 'code';
  }
}

const varTex = (v: string): string => {
  const r = tryParseExpr(v, { vars: [v] });
  return r.ok ? exprToTex(r.expr) : v;
};

/** The help line under a typed answer: precision, how to type lists, matrices and complex numbers, units, equivalence. */
export function answerHelp(a: AnswerSpec): Rich {
  const out: string[] = [];
  if (a.kind === 'numeric') {
    const L = numericLayout(a);
    const prec = describePrecision(a.precision);
    if (L.kind === 'matrix') out.push(`One entry per box, ${prec}. Arrow keys move between boxes.`);
    else if (L.kind === 'complex') out.push(`Type ${L.count > 1 ? 'each number' : 'it'} as $a + bi$ (\`j\` works too), ${prec}.${L.count === 2 ? ' Or type both at once as $a \\pm bi$ in the first box.' : ''}`);
    else if (L.kind === 'list') out.push(`${a.ordered === false ? 'Separate the values with commas, in any order' : 'Separate the values with commas, in order'}, ${prec}.`);
    else out.push(`Give it ${prec}.`);
    if (a.equivalence === 'scalar-multiple') out.push('Any nonzero multiple works.');
    if (a.equivalence === 'direction') out.push('Any positive multiple works: it must point the same way.');
    if (a.unit && (a.askUnit ?? true)) out.push('Include the unit.');
  } else if (a.kind === 'symbolic') {
    const vars = a.vars.map((v) => `$${varTex(v)}$`);
    out.push(vars.length ? `An expression in ${vars.length > 1 ? `${vars.slice(0, -1).join(', ')} and ${vars[vars.length - 1]}` : vars[0]}.` : 'An expression.');
    out.push('Write powers as `x^2` and products as `2x` or `2*x`.');
    if (a.upToConstant) out.push('The $+ C$ is optional.');
    if (a.disallow?.length) out.push(`Simplify fully: no ${a.disallow.map((d) => `\`${d}\``).join(', ')}.`);
  }
  return out.join(' ');
}

// ── The common-wrong note's title ───────────────────────────────────────

const numTex = (s: string): string => {
  const n = evalNumber(s.trim());
  return n.ok ? n.tex : s.trim();
};

/** The wrong answer as the learner would recognise it, as Rich: `$\tfrac{1}{3}$`, `$(1, -1)$`, `$\lambda^{2} - 5\lambda + 4$`. */
export function wrongAnswerRich(a: AnswerSpec, cw: CommonWrong, optionLetters?: readonly string[]): Rich | null {
  const v = cw.answer;
  switch (a.kind) {
    case 'numeric': {
      if (a.complex) return typeof v === 'string' ? `“${v.replace(/-/g, '−')}”` : null;
      const parts = typeof v === 'number' ? [String(v)] : typeof v === 'string' ? splitTopLevel(v) : v.map(String);
      const texes = parts.map(numTex);
      if (texes.length === 1) return `$${texes[0]}$`;
      if (a.shape) {
        const rows: string[] = [];
        for (let r = 0; r < a.shape[0]; r++) rows.push(texes.slice(r * a.shape[1], (r + 1) * a.shape[1]).join(' & '));
        return `$\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}$`;
      }
      return `$(${texes.join(', ')})$`;
    }
    case 'symbolic': {
      if (typeof v !== 'string') return null;
      const r = tryParseExpr(v, { vars: (a as SymbolicAnswer).vars });
      return r.ok ? `$${exprToTex(r.expr, { pretty: true })}$` : `“${v}”`;
    }
    case 'choice':
      return typeof v === 'number' ? `option ${optionLetters?.[v] ?? optionLetter(v)}` : null;
    case 'drag': {
      const t = a.target;
      if (t.mode === 'slider' && typeof v === 'number') return `$${numTex(String(v))}$`;
      if (t.mode === 'point' && typeof v === 'string') {
        try {
          const p = JSON.parse(v) as unknown;
          if (Array.isArray(p) && p.length === 2) return `$(${numTex(String(p[0]))}, ${numTex(String(p[1]))})$`;
        } catch {
          return null;
        }
      }
      if (t.mode === 'slider' && typeof v === 'string') return `$${numTex(v)}$`;
      return null;
    }
    default:
      return null;
  }
}

/** "Why 6 is the common wrong answer" / "Why option B is a common wrong answer" / "Why this order is…". */
export function wrongNoteTitle(a: AnswerSpec, cw: CommonWrong, several: boolean, optionLetters?: readonly string[]): Rich {
  const art = several ? 'a' : 'the';
  const shown = wrongAnswerRich(a, cw, optionLetters);
  if (shown) return `Why ${shown} is ${art} common wrong answer`;
  if (a.kind === 'drag') {
    const what = a.target.mode === 'order' ? 'this order' : a.target.mode === 'match' ? 'this matching' : 'this answer';
    return `Why ${what} is ${art} common wrong answer`;
  }
  if (a.kind === 'code') return several ? 'A common wrong approach' : 'The common wrong approach';
  return several ? 'A common wrong answer' : 'The common wrong answer';
}

// ── Another one ─────────────────────────────────────────────────────────

/**
 * A new generated instance for "Another one": a fresh seed whose prompt
 * differs from the current one (so the learner never gets the same problem
 * back). Returns null when the problem has no generator or nothing new turns
 * up in `tries` draws.
 */
export function nextInstance(spec: ProblemSpec, current: ProblemInstance, nextSeed: () => number, tries = 24): ProblemInstance | null {
  if (!spec.generate) return null;
  for (let k = 0; k < tries; k++) {
    const seed = nextSeed();
    if (seed === 0 || seed === current.seed) continue;
    let inst: ProblemInstance;
    try {
      inst = drawProblem(spec, seed);
    } catch {
      continue; // a degenerate seed (the generator's tests catch these): try another
    }
    if (inst.prompt !== current.prompt) return inst;
  }
  return null;
}

// ── Matrix grid navigation ──────────────────────────────────────────────

/**
 * Where an arrow key moves in a rows × cols grid of fields, or null to let
 * the field handle it: ↑/↓ always move between rows; ←/→ move only when the
 * caret is already at the start/end of the field's text.
 */
export function cellMove(index: number, key: string, rows: number, cols: number, caretAtStart: boolean, caretAtEnd: boolean): number | null {
  const r = Math.floor(index / cols);
  const c = index % cols;
  if (key === 'ArrowUp') return r > 0 ? index - cols : null;
  if (key === 'ArrowDown') return r < rows - 1 ? index + cols : null;
  if (key === 'ArrowLeft') return caretAtStart && c > 0 ? index - 1 : null;
  if (key === 'ArrowRight') return caretAtEnd && c < cols - 1 ? index + 1 : null;
  return null;
}
