/**
 * Predict's judging rules (README §8.5), pure and tested (predict-state.test.ts).
 */
import { richToPlain } from '../core/richtext';
import type { PredictGuess } from '../types';

const fmt = (x: number): string => String(Number(x.toPrecision(6))).replace('-', '−');

/** Has the learner made a guess yet? (A number guess needs a value; a custom one anything but undefined/null.) */
export function hasGuess(g: PredictGuess, value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (g.kind === 'choice') return typeof value === 'number' && value >= 0 && value < g.options.length;
  if (g.kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  return true;
}

/** Right or wrong. */
export function judgeGuess(g: PredictGuess, value: unknown): boolean {
  if (!hasGuess(g, value)) return false;
  if (g.kind === 'choice') return value === g.answer;
  if (g.kind === 'number') return Math.abs((value as number) - g.answer) <= g.tolerance + 1e-12;
  try {
    return g.check(value);
  } catch {
    return false;
  }
}

/** "Two", "3.5 m/s", or the custom guess's own description. */
export function describeGuess(g: PredictGuess, value: unknown): string {
  if (!hasGuess(g, value)) return '';
  if (g.kind === 'choice') return richToPlain(g.options[value as number]);
  if (g.kind === 'number') return `${fmt(value as number)}${g.unit ? ` ${g.unit}` : ''}`;
  try {
    return g.describe?.(value) ?? '';
  } catch {
    return '';
  }
}

/** Where a number guess's slider starts: the middle of its range, on a step. */
export function numberGuessStart(g: Extract<PredictGuess, { kind: 'number' }>): number {
  const k = Math.round((g.max - g.min) / 2 / g.step);
  return Number((g.min + k * g.step).toFixed(10));
}
