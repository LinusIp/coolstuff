import { describe, expect, it } from 'vitest';
import { checkAnswer, checkNumeric } from '../core/answers';
import { drawProblem } from '../core/problems';
import { PROBLEMS } from '../gallery/samples';
import type { AnswerSpec, ChoiceAnswer, NumericAnswer, ProblemSpec, SymbolicAnswer } from '../types';
import {
  answerHelp,
  cellMove,
  choiceOrder,
  countsAsAttempt,
  difficultyWord,
  draftFromResponse,
  draftText,
  draftToCheck,
  draftToResponse,
  initialDraft,
  isDraftAnswered,
  kindLabel,
  metaLine,
  nextInstance,
  numericLayout,
  optionLetter,
  splitTopLevel,
  wrongAnswerRich,
  wrongNoteTitle,
  type Draft,
} from './draft';

const byId = (id: string): ProblemSpec => PROBLEMS.find((p) => p.id === id)!;
const matrix: NumericAnswer = { kind: 'numeric', value: [2, 1, 1, 2], shape: [2, 2], precision: 'exact' };
const pair: NumericAnswer = { kind: 'numeric', value: [1, 2, 1, -2], complex: true, ordered: false, precision: 'exact' };
const single: NumericAnswer = { kind: 'numeric', value: 7, precision: { decimals: 2 } };

describe('layouts and initial drafts', () => {
  it('numeric answers pick their input shape', () => {
    expect(numericLayout(single)).toEqual({ kind: 'single' });
    expect(numericLayout(matrix)).toEqual({ kind: 'matrix', rows: 2, cols: 2 });
    expect(numericLayout(pair)).toEqual({ kind: 'complex', count: 2 });
    expect(numericLayout({ kind: 'numeric', value: [1, 1], precision: 'exact' })).toEqual({ kind: 'list', count: 2 });
    expect(numericLayout({ kind: 'numeric', value: [1, 2], complex: true, precision: 'exact' })).toEqual({ kind: 'complex', count: 1 });
  });

  it('every answer kind starts empty or at its start position', () => {
    expect(initialDraft(single)).toEqual({ kind: 'text', text: '' });
    expect(initialDraft(matrix)).toEqual({ kind: 'cells', cells: ['', '', '', ''] });
    expect(initialDraft(pair)).toEqual({ kind: 'cells', cells: ['', ''] });
    expect(initialDraft(byId('char-poly').answer)).toEqual({ kind: 'text', text: '' });
    expect(initialDraft(byId('which-eigenvector').answer)).toEqual({ kind: 'choice', selected: [], reason: '' });
    expect(initialDraft(byId('drag-image').answer)).toEqual({ kind: 'drag', state: [0, 0], touched: false });
    expect(initialDraft(byId('order-steps').answer)).toEqual({ kind: 'drag', state: [0, 1, 2, 3], touched: false });
    expect(initialDraft(byId('square-proof').answer)).toEqual({ kind: 'proof', text: '', compared: false, ticked: [false, false, false] });
    const code = byId('power-iteration').answer;
    expect(initialDraft(code)).toEqual({ kind: 'code', source: (code as { starter: string }).starter });
    const match: AnswerSpec = { kind: 'drag', target: { mode: 'match', items: ['a', 'b', 'c'], slots: ['x', 'y'], correct: [0, 1, 1] } };
    expect(initialDraft(match)).toEqual({ kind: 'drag', state: [-1, -1, -1], touched: false });
    const slider: AnswerSpec = { kind: 'drag', target: { mode: 'slider', label: 'h', min: 0, max: 1, step: 0.1, start: 0.5, answer: 0.1, tolerance: 0.05 } };
    expect(initialDraft(slider)).toEqual({ kind: 'drag', state: 0.5, touched: false });
  });
});

describe('what the checker reads', () => {
  it('joins a matrix grid row-major and keeps empty cells so the checker can count them', () => {
    const d: Draft = { kind: 'cells', cells: ['2', '1', '1', '2'] };
    expect(draftText(matrix, d)).toBe('2, 1, 1, 2');
    expect(checkNumeric(draftText(matrix, d), matrix).correct).toBe(true);
    const partial: Draft = { kind: 'cells', cells: ['2', '', '1', '2'] };
    const v = checkNumeric(draftText(matrix, partial), matrix);
    expect(v.reason).toBe('count');
    expect(v.message).toMatch(/all 4 entries/);
  });

  it('joins complex fields without the empty ones, so "1 ± 2i" in the first field answers the pair', () => {
    expect(draftText(pair, { kind: 'cells', cells: ['1 ± 2i', ''] })).toBe('1 ± 2i');
    expect(checkNumeric(draftText(pair, { kind: 'cells', cells: ['1 ± 2i', ''] }), pair).correct).toBe(true);
    expect(checkNumeric(draftText(pair, { kind: 'cells', cells: ['1 - 2i', '1 + 2i'] }), pair).correct).toBe(true);
    expect(checkNumeric(draftText(pair, { kind: 'cells', cells: ['1 + 2i', ''] }), pair).reason).toBe('count');
  });

  it('choice drafts become a number (single) or a sorted list (multi)', () => {
    const one = byId('which-eigenvector').answer as ChoiceAnswer;
    expect(draftToCheck(one, { kind: 'choice', selected: [1], reason: '' })).toEqual({ kind: 'choice', selected: 1 });
    expect(checkAnswer(one, draftToCheck(one, { kind: 'choice', selected: [1], reason: '' })!).correct).toBe(true);
    expect(checkAnswer(one, draftToCheck(one, { kind: 'choice', selected: [], reason: '' })!).reason).toBe('empty');
    const multi: ChoiceAnswer = { kind: 'choice', options: ['a', 'b', 'c'], correct: [0, 2] };
    expect(draftToCheck(multi, { kind: 'choice', selected: [2, 0], reason: '' })).toEqual({ kind: 'choice', selected: [0, 2] });
  });
});

describe('answered or not (exam confirm), responses and back', () => {
  it('an untouched drag, an empty field or untouched starter code is unanswered', () => {
    const drag = byId('drag-image').answer;
    expect(isDraftAnswered(drag, initialDraft(drag))).toBe(false);
    expect(draftToResponse(drag, initialDraft(drag))).toBeNull();
    expect(draftToResponse(drag, { kind: 'drag', state: [3, 3], touched: true })).toEqual({ kind: 'drag', state: [3, 3] });
    expect(draftToResponse(single, { kind: 'text', text: '  ' })).toBeNull();
    const code = byId('power-iteration').answer;
    expect(draftToResponse(code, initialDraft(code))).toBeNull();
    expect(draftToResponse(code, { kind: 'code', source: 'function powerIteration() { return 3; }' })).toEqual({ kind: 'code', source: 'function powerIteration() { return 3; }' });
    expect(isDraftAnswered(matrix, { kind: 'cells', cells: ['', '1', '', ''] })).toBe(true);
  });

  it('round-trips every kind through an exam response', () => {
    const cases: [AnswerSpec, Draft][] = [
      [single, { kind: 'text', text: '7.00' }],
      [matrix, { kind: 'cells', cells: ['2', '1', '1', '2'] }],
      [pair, { kind: 'cells', cells: ['1 + 2i', '1 - 2i'] }],
      [byId('char-poly').answer, { kind: 'text', text: 'lambda^2 - 5lambda - 2' }],
      [byId('which-eigenvector').answer, { kind: 'choice', selected: [1], reason: '' }],
      [byId('drag-image').answer, { kind: 'drag', state: [3, 3], touched: true }],
      [byId('order-steps').answer, { kind: 'drag', state: [1, 0, 2, 3], touched: true }],
      [byId('power-iteration').answer, { kind: 'code', source: 'function powerIteration(A) { return 3; }' }],
    ];
    for (const [a, d] of cases) expect(draftFromResponse(a, draftToResponse(a, d))).toEqual(d);
    expect(draftFromResponse(single, null)).toEqual(initialDraft(single));
    // A response of the wrong kind falls back to an empty draft rather than breaking the input.
    expect(draftFromResponse(single, { kind: 'choice', selected: 1 })).toEqual(initialDraft(single));
  });

  it('splits at top-level commas only', () => {
    expect(splitTopLevel('1, f(2, 3), 4')).toEqual(['1', 'f(2, 3)', '4']);
    expect(splitTopLevel('sqrt(2)/2')).toEqual(['sqrt(2)/2']);
  });
});

describe('choice order', () => {
  const shuffled: ChoiceAnswer = { kind: 'choice', options: ['a', 'b', 'c', 'd', 'e'], correct: 0, shuffle: true };
  it('is the identity unless the problem asks to shuffle', () => {
    expect(choiceOrder({ ...shuffled, shuffle: false }, 'k')).toEqual([0, 1, 2, 3, 4]);
  });
  it('is a stable permutation per key, different between instances', () => {
    const a = choiceOrder(shuffled, 'lesson:p1#0');
    expect([...a].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(choiceOrder(shuffled, 'lesson:p1#0')).toEqual(a);
    const others = [1, 2, 3, 4, 5, 6].map((s) => choiceOrder(shuffled, `lesson:p1#${s}`).join());
    expect(others.some((o) => o !== a.join())).toBe(true);
  });
  it('letters', () => {
    expect([0, 1, 25, 26].map(optionLetter)).toEqual(['A', 'B', 'Z', 'AA']);
  });
});

describe('attempts and text', () => {
  it('counts judged answers, not typos, missing units or rough decimals', () => {
    expect(countsAsAttempt({ correct: true, reason: 'correct', message: '' }, 'numeric')).toBe(true);
    expect(countsAsAttempt({ correct: false, reason: 'wrong', message: '' }, 'numeric')).toBe(true);
    expect(countsAsAttempt({ correct: false, reason: 'unit-dimension', message: '' }, 'numeric')).toBe(true);
    for (const reason of ['empty', 'unparseable', 'count', 'precision', 'unit-missing', 'unit-exact', 'form', 'incomplete'] as const) {
      expect(countsAsAttempt({ correct: false, reason, message: '' }, 'numeric')).toBe(false);
    }
    expect(countsAsAttempt({ correct: false, reason: 'incomplete', message: '' }, 'proof')).toBe(true);
  });

  it('meta line', () => {
    expect(metaLine(undefined)).toBe('');
    expect(metaLine({ attempts: 0, solved: false, hintsUsed: 0, revealed: false, updated: '' })).toBe('');
    expect(metaLine({ attempts: 2, solved: false, hintsUsed: 1, revealed: false, updated: '' })).toBe('2 attempts · 1 hint');
    expect(metaLine({ attempts: 1, solved: false, hintsUsed: 3, revealed: true, updated: '' })).toBe('1 attempt · 3 hints · solution viewed');
  });

  it('difficulty words and kind labels', () => {
    expect([1, 2, 3].map((d) => difficultyWord(d as 1 | 2 | 3))).toEqual(['warm-up', 'standard', 'exam level']);
    expect(PROBLEMS.map((p) => kindLabel(p.answer))).toEqual(['numeric', 'multiple choice', 'drag the point', 'expression', 'numeric', 'put in order', 'vector', 'explain', 'code']);
    expect(kindLabel(matrix)).toBe('matrix');
    expect(kindLabel(pair)).toBe('complex numbers');
    expect(kindLabel({ kind: 'choice', options: ['a', 'b'], correct: [0] })).toBe('choose all that apply');
  });

  it('help lines state the precision and how to type the answer', () => {
    expect(answerHelp(single)).toBe('Give it to 2 decimal places.');
    expect(answerHelp(byId('eigenvector-for-3').answer)).toMatch(/in order.*Any nonzero multiple works\./);
    expect(answerHelp(byId('car-acceleration').answer)).toMatch(/2 significant figures\. Include the unit\./);
    expect(answerHelp(matrix)).toMatch(/One entry per box/);
    expect(answerHelp(pair)).toMatch(/a \\pm bi/);
    const sym = byId('char-poly').answer as SymbolicAnswer;
    expect(answerHelp(sym)).toMatch(/^An expression in \$\\lambda\$\./);
    expect(answerHelp({ ...sym, upToConstant: true, disallow: ['sqrt'] })).toMatch(/\+ C\$ is optional\. Simplify fully: no `sqrt`\./);
    expect(answerHelp(byId('which-eigenvector').answer)).toBe('');
  });
});

describe('the common-wrong note title', () => {
  it('shows the wrong answer the way the learner typed it', () => {
    const tri = byId('triangular-max');
    expect(wrongNoteTitle(tri.answer, tri.commonWrong[0], false)).toBe('Why $2$ is the common wrong answer');
    const ev = byId('eigenvector-for-3');
    expect(wrongNoteTitle(ev.answer, ev.commonWrong[0], true)).toBe('Why $(1, -1)$ is a common wrong answer');
    const cp = byId('char-poly');
    expect(wrongNoteTitle(cp.answer, cp.commonWrong[0], false)).toBe('Why $\\lambda^{2} - 5\\lambda + 4$ is the common wrong answer');
    const ch = byId('which-eigenvector');
    expect(wrongNoteTitle(ch.answer, ch.commonWrong[0], false, ['C', 'A', 'B', 'D'])).toBe('Why option C is the common wrong answer');
    const dr = byId('drag-image');
    expect(wrongNoteTitle(dr.answer, dr.commonWrong[0], false)).toBe('Why $(1, 1)$ is the common wrong answer');
    const ord = byId('order-steps');
    expect(wrongNoteTitle(ord.answer, ord.commonWrong[0], false)).toBe('Why this order is the common wrong answer');
    const code = byId('power-iteration');
    expect(wrongNoteTitle(code.answer, code.commonWrong[0], false)).toBe('The common wrong approach');
    expect(wrongAnswerRich({ kind: 'numeric', value: 0.5, precision: 'exact' }, { answer: '1/3', why: '' })).toBe('$\\frac{1}{3}$');
    expect(wrongAnswerRich(matrix, { answer: [1, 2, 3, 4], why: '' })).toBe('$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$');
  });
});

describe('another one', () => {
  const spec = byId('triangular-max');
  it('never repeats the current prompt', () => {
    const first = drawProblem(spec, 0);
    let seed = 1;
    for (let k = 0; k < 50; k++) {
      const cur = k === 0 ? first : drawProblem(spec, seed);
      const next = nextInstance(spec, cur, () => ++seed)!;
      expect(next).not.toBeNull();
      expect(next.prompt).not.toBe(cur.prompt);
      expect(next.seed).not.toBe(0);
    }
  });
  it('skips seeds that repeat the prompt and gives up gracefully', () => {
    const cur = drawProblem(spec, 5);
    const seeds = [5, 0, 5, 7];
    const next = nextInstance(spec, cur, () => seeds.shift() ?? 9)!;
    expect(next.seed).toBe(7);
    expect(nextInstance(byId('which-eigenvector'), drawProblem(byId('which-eigenvector'), 0), () => 3)).toBeNull();
    expect(nextInstance(spec, cur, () => 5, 4)).toBeNull();
  });
});

describe('matrix grid arrows', () => {
  it('moves between rows always and across only at the caret edges', () => {
    expect(cellMove(0, 'ArrowDown', 2, 2, false, false)).toBe(2);
    expect(cellMove(2, 'ArrowDown', 2, 2, false, false)).toBeNull();
    expect(cellMove(3, 'ArrowUp', 2, 2, false, false)).toBe(1);
    expect(cellMove(0, 'ArrowRight', 2, 2, false, true)).toBe(1);
    expect(cellMove(0, 'ArrowRight', 2, 2, false, false)).toBeNull();
    expect(cellMove(1, 'ArrowRight', 2, 2, true, true)).toBeNull();
    expect(cellMove(1, 'ArrowLeft', 2, 2, true, false)).toBe(0);
    expect(cellMove(1, 'Enter', 2, 2, true, true)).toBeNull();
  });
});
