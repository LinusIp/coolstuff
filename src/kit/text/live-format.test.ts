import { describe, expect, it } from 'vitest';
import { liveCells, liveRank, liveSpeech, throttleLatest } from './live-format';

describe('live values', () => {
  it('scalars, vectors and matrices as cells with fixed decimals and a true minus', () => {
    expect(liveCells(3)).toEqual({ kind: 'scalar', cells: ['3.00'], rows: 1, cols: 1 });
    expect(liveCells(-0.004)).toEqual({ kind: 'scalar', cells: ['0.00'], rows: 1, cols: 1 });
    expect(liveCells([1.4, -0.2], { decimals: 1 })).toEqual({ kind: 'vector', cells: ['1.4', '−0.2'], rows: 2, cols: 1 });
    expect(liveCells([2, 1, 1, 2], { shape: [2, 2] })).toEqual({ kind: 'matrix', cells: ['2.00', '1.00', '1.00', '2.00'], rows: 2, cols: 2 });
    expect(liveCells([[1, 0], [0, -1]], { decimals: 0 })).toEqual({ kind: 'matrix', cells: ['1', '0', '0', '−1'], rows: 2, cols: 2 });
    expect(liveCells('n/a').kind).toBe('text');
    // A shape that doesn't match the length falls back to a column.
    expect(liveCells([1, 2, 3], { shape: [2, 2] }).kind).toBe('vector');
    expect([liveRank('matrix'), liveRank('vector'), liveRank('scalar')]).toEqual([2, 1, 0]);
  });

  it('reads aloud as a short sentence', () => {
    expect(liveSpeech('v', [1.4, -0.2])).toBe('v = (1.40, −0.20)');
    expect(liveSpeech('A', [2, 1, 1, 2], { shape: [2, 2], decimals: 0 })).toBe('A = [2 1; 1 2]');
    expect(liveSpeech('m', 2, { decimals: 1, unit: 'kg' })).toBe('m = 2.0 kg');
  });

  it('announces at most once per second, the latest text winning', () => {
    let now = 0;
    const timers: { at: number; fn: () => void }[] = [];
    const said: string[] = [];
    const t = throttleLatest((s) => said.push(s), 1000, {
      now: () => now,
      set: (fn, ms) => timers.push({ at: now + ms, fn }),
      clear: () => {},
    });
    const advance = (to: number) => {
      now = to;
      for (const x of timers.splice(0).sort((a, b) => a.at - b.at)) {
        if (x.at <= now) x.fn();
        else timers.push(x);
      }
    };
    t.push('a');
    advance(0);
    expect(said).toEqual(['a']);
    t.push('b');
    t.push('c');
    advance(500);
    expect(said).toEqual(['a']);
    advance(1000);
    expect(said).toEqual(['a', 'c']);
  });
});
