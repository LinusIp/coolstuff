/**
 * Marks: how a data-structure view shows the state of one element (README §9).
 * Pure (no DOM): the views turn a `Mark` into classes, a glyph and the words
 * screen readers hear, so colour never travels alone.
 *
 *   current   2px ink ring          compare  dashed ink ring
 *   visited   sunk fill, ink-2 text frontier dotted ink outline
 *   done/found green wash + ✓        dim      40% opacity
 *   error     red wash + ×           anything else: a lesson concept (its ink,
 *                                    wash and line style)
 */
import { GLOBAL_CONCEPTS, type ConceptSet, type LineStyle } from '../theme';
import type { Mark, MarkState } from '../types';

export const MARK_STATES: readonly MarkState[] = ['current', 'compare', 'visited', 'frontier', 'done', 'found', 'dim', 'error'];

const STATE_SET: ReadonlySet<string> = new Set(MARK_STATES);

export const isMarkState = (m: string): m is MarkState => STATE_SET.has(m);

/** What a screen reader hears for each built-in state ("index 3: 7, being compared"). */
export const MARK_WORDS: Readonly<Record<MarkState, string>> = {
  current: 'current',
  compare: 'being compared',
  visited: 'visited',
  frontier: 'on the frontier',
  done: 'done',
  found: 'found',
  dim: 'set aside',
  error: 'error',
};

export interface MarkInfo {
  /** The mark as given. */
  mark: string;
  kind: 'state' | 'concept';
  /** The concept name for concept marks (drives `ct ct-<name>`). */
  concept?: string;
  /** The non-colour cue drawn inside or beside the element, if any. */
  glyph: '✓' | '×' | null;
  /** Spoken description: "being compared", "marked the pivot". */
  word: string;
}

const GLOBAL_LABELS: Readonly<Record<string, string>> = { input: 'input', output: 'output', error: 'error', prob: 'probability' };

/** The label a lesson gave a concept (`defineConcepts`), else its name. */
export function conceptLabel(name: string, concepts?: ConceptSet): string {
  if (concepts?.names.includes(name)) return concepts.get(name).label;
  return GLOBAL_LABELS[name] ?? name.replace(/-/g, ' ');
}

/** The line style that carries a concept without colour (lesson concepts first, then the global meanings). */
export function conceptLine(name: string, concepts?: ConceptSet): LineStyle {
  if (concepts?.names.includes(name)) return concepts.line(name);
  return (GLOBAL_CONCEPTS as Record<string, { line: LineStyle } | undefined>)[name]?.line ?? 'solid';
}

/** Classify a mark (or nothing). Unknown strings are lesson concepts. */
export function markInfo(mark: Mark | null | undefined, concepts?: ConceptSet): MarkInfo | null {
  if (!mark) return null;
  if (isMarkState(mark)) {
    return { mark, kind: 'state', glyph: mark === 'done' || mark === 'found' ? '✓' : mark === 'error' ? '×' : null, word: MARK_WORDS[mark] };
  }
  return { mark, kind: 'concept', concept: mark, glyph: null, word: `marked ${conceptLabel(mark, concepts)}` };
}

/** Class list for an element carrying a mark: concept marks get `ct ct-<name> ds-concept` (ink, wash, line style). */
export function markClass(info: MarkInfo | null): string {
  if (!info) return '';
  return info.kind === 'concept' ? `ct ct-${info.concept} ds-concept` : '';
}
