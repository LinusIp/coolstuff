/**
 * How Formula shows a live value (README §1.5, DESIGN.md §7 "Live values"):
 * a scalar as one mono number, a vector as a column, a matrix as a grid,
 * each with fixed decimals and a true minus sign (NOTATION.md §7), plus the
 * sentence a screen reader hears. Pure and tested.
 */
import { formatNumber } from '../notation';
import { formatLive, type LiveData } from '../core/live';

export type LiveKind = 'text' | 'scalar' | 'vector' | 'matrix';

export interface LiveCells {
  kind: LiveKind;
  /** Row-major cell strings. */
  cells: string[];
  rows: number;
  cols: number;
}

export interface LiveFormat {
  decimals?: number;
  /** Read a flat list as a matrix (row-major): `[2, 2]` for a `Mat2` signal like `[a, b, c, d]`. */
  shape?: readonly [number, number];
}

/** The cells to draw for a live value. */
export function liveCells(v: LiveData, opts: LiveFormat = {}): LiveCells {
  const d = opts.decimals ?? 2;
  if (typeof v === 'string') return { kind: 'text', cells: [v], rows: 1, cols: 1 };
  if (typeof v === 'number') return { kind: 'scalar', cells: [formatNumber(v, d)], rows: 1, cols: 1 };
  if (v.length > 0 && Array.isArray(v[0])) {
    const m = v as readonly (readonly number[])[];
    const cols = Math.max(...m.map((r) => r.length));
    return { kind: 'matrix', cells: m.flatMap((r) => Array.from({ length: cols }, (_, j) => (j < r.length ? formatNumber(r[j], d) : ''))), rows: m.length, cols };
  }
  const flat = v as readonly number[];
  const shape = opts.shape;
  if (shape && shape[0] * shape[1] === flat.length && shape[1] > 1) {
    return { kind: 'matrix', cells: flat.map((x) => formatNumber(x, d)), rows: shape[0], cols: shape[1] };
  }
  return { kind: 'vector', cells: flat.map((x) => formatNumber(x, d)), rows: flat.length, cols: 1 };
}

/** Drop order when a row of inline values can't hold them all (matrices first). */
export const liveRank = (kind: LiveKind): number => (kind === 'matrix' ? 2 : kind === 'vector' ? 1 : 0);

/** One value as a screen reader hears it: "v = (1.40, −0.20) m/s", "A = [2.00 1.00; 1.00 2.00]". */
export function liveSpeech(symbol: string, v: LiveData, opts: LiveFormat & { unit?: string } = {}): string {
  const c = liveCells(v, opts);
  let text: string;
  if (c.kind === 'matrix') {
    const rows: string[] = [];
    for (let i = 0; i < c.rows; i++) rows.push(c.cells.slice(i * c.cols, (i + 1) * c.cols).join(' '));
    text = `[${rows.join('; ')}]`;
  } else if (c.kind === 'vector') text = `(${c.cells.join(', ')})`;
  else text = typeof v === 'string' ? v : formatLive(v, opts.decimals ?? 2);
  return `${symbol} = ${text}${opts.unit ? ` ${opts.unit}` : ''}`;
}

/**
 * At most one announcement per `ms`: the latest text wins, delivered on the
 * trailing edge. `now` and timers are injectable for tests.
 */
export function throttleLatest(
  deliver: (text: string) => void,
  ms = 1000,
  clock: { now: () => number; set: (fn: () => void, ms: number) => unknown; clear: (h: unknown) => void } = {
    now: () => Date.now(),
    set: (fn, t) => setTimeout(fn, t),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
): { push: (text: string) => void; cancel: () => void } {
  let last = -Infinity;
  let pending: string | null = null;
  let timer: unknown = null;
  const flush = () => {
    timer = null;
    if (pending === null) return;
    last = clock.now();
    const t = pending;
    pending = null;
    deliver(t);
  };
  return {
    push(text) {
      pending = text;
      if (timer !== null) return;
      const wait = Math.max(0, last + ms - clock.now());
      timer = clock.set(flush, wait);
    },
    cancel() {
      if (timer !== null) clock.clear(timer);
      timer = null;
      pending = null;
    },
  };
}
