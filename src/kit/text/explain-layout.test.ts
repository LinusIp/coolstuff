import { describe, expect, it } from 'vitest';
import {
  boxCx,
  explainMode,
  fitWidths,
  layoutBrackets,
  layoutLiveRow,
  layoutWide,
  leadersCross,
  packRow,
  spansOverlap,
  layoutStubs,
  stubFor,
  type Box,
  type WideLayout,
  type WideNoteIn,
} from './explain-layout';
import { anchorOccurrences, firstSpans, noteCarriers } from './anchors';
import { FORMULAS } from '../gallery/samples';
import { mulberry32 } from '../math/stats';

const box = (left: number, width: number, top = 0, bottom = 40): Box => ({ left, right: left + width, top, bottom });

/** Every invariant a wide layout promises. */
function checkWide(items: readonly WideNoteIn[], W: number, L: WideLayout, gap = 16) {
  expect(L.notes).toHaveLength(items.length);
  // Inside the block, in symbol order, no overlaps.
  for (const n of L.notes) {
    expect(n.left).toBeGreaterThanOrEqual(-0.01);
    expect(n.left + n.width).toBeLessThanOrEqual(W + 0.01);
  }
  expect(spansOverlap(L.notes, gap)).toBe(false);
  const order = [...items].sort((a, b) => boxCx(a.box) - boxCx(b.box)).map((i) => i.id);
  expect(L.notes.map((n) => n.id)).toEqual(order);
  // Leaders: one per note, start under the symbol, end at the note's top centre, never cross.
  for (const l of L.leaders) {
    const it = items.find((i) => i.id === l.id)!;
    const n = L.notes.find((x) => x.id === l.id)!;
    expect(l.x1).toBeGreaterThanOrEqual(boxCx(it.box) - 0.01);
    expect(l.yDot).toBeGreaterThan(it.box.bottom);
    expect(l.x2).toBeCloseTo(n.left + n.width / 2, 5);
    expect(l.yEnd).toBeLessThan(L.top);
  }
  for (let a = 0; a < L.leaders.length; a++) for (let b = a + 1; b < L.leaders.length; b++) expect(leadersCross(L.leaders[a], L.leaders[b])).toBe(false);
}

describe('packRow', () => {
  it('centres a lone label under its symbol and clamps it inside the row', () => {
    expect(packRow([{ want: 300, w: 100 }], 600, 16)).toEqual([250]);
    expect(packRow([{ want: 10, w: 100 }], 600, 16)).toEqual([0]);
    expect(packRow([{ want: 590, w: 100 }], 600, 16)).toEqual([500]);
  });
  it('spreads colliding labels symmetrically (least squares) and keeps their order', () => {
    const x = packRow(
      [
        { want: 300, w: 100 },
        { want: 300, w: 100 },
      ],
      600,
      20,
    )!;
    expect(x).toEqual([190, 310]);
  });
  it('returns null when the labels cannot fit side by side', () => {
    expect(packRow([{ want: 0, w: 300 }, { want: 0, w: 300 }], 590, 10)).toBeNull();
  });
  it('never overlaps, stays in bounds, keeps order (random rows)', () => {
    const rnd = mulberry32(7);
    for (let t = 0; t < 300; t++) {
      const n = 1 + Math.floor(rnd() * 7);
      const W = 300 + rnd() * 700;
      const items = Array.from({ length: n }, () => ({ want: rnd() * W, w: 30 + rnd() * 120 })).sort((a, b) => a.want - b.want);
      const x = packRow(items, W, 12);
      const total = items.reduce((s, i) => s + i.w, 0) + 12 * (n - 1);
      if (total > W) {
        expect(x).toBeNull();
        continue;
      }
      expect(x).not.toBeNull();
      for (let k = 0; k < n; k++) {
        expect(x![k]).toBeGreaterThanOrEqual(-1e-6);
        expect(x![k] + items[k].w).toBeLessThanOrEqual(W + 1e-6);
        if (k) expect(x![k]).toBeGreaterThanOrEqual(x![k - 1] + items[k - 1].w + 12 - 1e-6);
      }
    }
  });
});

describe('fitWidths', () => {
  it('keeps natural widths that fit, caps the widest first, gives up below the minimum', () => {
    expect(fitWidths([100, 120], 600, 16, 76)).toEqual([100, 120]);
    const w = fitWidths([60, 190, 190, 190], 500, 16, 76)!;
    expect(w[0]).toBe(60);
    expect(w[1]).toBe(w[2]);
    expect(w.reduce((s, x) => s + x, 0) + 48).toBeLessThanOrEqual(500.01);
    expect(fitWidths([190, 190, 190, 190, 190, 190, 190, 190], 600, 16, 76)).toBeNull();
  });
});

describe('layoutWide', () => {
  it('the definition formula, with a repeated anchor: one note per id, on its first occurrence', () => {
    const f = FORMULAS[0];
    // Synthetic glyph boxes for each occurrence, laid out left to right like the rendered maths.
    const occ = anchorOccurrences(f.tex); // Av A v lam v
    expect(occ).toEqual(['Av', 'A', 'v', 'lam', 'v']);
    const boxes: Record<string, Box[]> = { Av: [box(240, 70, 10, 50)], A: [box(240, 34, 10, 50)], v: [box(276, 34, 18, 50), box(406, 34, 18, 50)], lam: [box(372, 30, 10, 50)] };
    const carriers = noteCarriers(occ);
    const seen: Record<string, number> = {};
    const items: WideNoteIn[] = [];
    occ.forEach((id, k) => {
      const i = (seen[id] = (seen[id] ?? -1) + 1);
      if (carriers[k]) items.push({ id, box: boxes[id][i], width: 170 });
    });
    expect(items.map((i) => i.id).sort()).toEqual(Object.keys(f.explain).sort());
    // The note for v hangs from the FIRST v (left of the equals sign).
    expect(items.find((i) => i.id === 'v')!.box.left).toBe(276);
    expect(firstSpans(f.tex).map((s) => s.id)).toEqual(['Av', 'A', 'v', 'lam']);
    const L = layoutWide(items, { width: 608, floorY: 50 })!;
    expect(L).not.toBeNull();
    checkWide(items, 608, L);
  });

  it('six crowded symbols: packed under the maths, no overlaps, no crossings', () => {
    const items: WideNoteIn[] = Array.from({ length: 6 }, (_, k) => ({ id: `s${k}`, box: box(250 + k * 22, 18, 0, 40 + (k % 2) * 6), width: 150 + (k % 3) * 20 }));
    for (const W of [560, 608, 912]) {
      const L = layoutWide(items, { width: W, floorY: 44 })!;
      expect(L).not.toBeNull();
      checkWide(items, W, L);
    }
  });

  it('a symbol up in a numerator and one down in a denominator: leaders still never cross', () => {
    const items: WideNoteIn[] = [
      { id: 'num', box: box(300, 20, 0, 22), width: 160 },
      { id: 'den', box: box(296, 24, 34, 60), width: 160 },
      { id: 'x', box: box(340, 20, 18, 44), width: 160 },
    ];
    const L = layoutWide(items, { width: 608, floorY: 56 })!;
    checkWide(items, 608, L);
  });

  it('too many notes for the block: null, so the formula uses the stacked key', () => {
    const items: WideNoteIn[] = Array.from({ length: 9 }, (_, k) => ({ id: `s${k}`, box: box(200 + k * 20, 16), width: 160 }));
    expect(layoutWide(items, { width: 600, floorY: 46 })).toBeNull();
    expect(explainMode(559)).toBe('stacked');
    expect(explainMode(560)).toBe('wide');
  });

  it('fuzz: whenever a layout exists, it keeps every promise', () => {
    const rnd = mulberry32(42);
    let laid = 0;
    for (let t = 0; t < 250; t++) {
      const n = 1 + Math.floor(rnd() * 6);
      const W = 560 + rnd() * 400;
      const items: WideNoteIn[] = Array.from({ length: n }, (_, k) => {
        const left = rnd() * (W - 40);
        const top = rnd() * 30;
        return { id: `n${k}`, box: box(left, 8 + rnd() * 40, top, top + 14 + rnd() * 40), width: 60 + rnd() * 140 };
      });
      const L = layoutWide(items, { width: W, floorY: 40 + rnd() * 20 });
      if (!L) continue;
      laid++;
      checkWide(items, W, L);
    }
    expect(laid).toBeGreaterThan(200);
  });
});

describe('layoutBrackets', () => {
  it('a bracket spans its anchor box exactly, its label above it', () => {
    const b = box(100, 80, 20, 60);
    const L = layoutBrackets([{ anchor: 'Av', box: b, w: 120, h: 18 }], { width: 600 });
    const it = L.items[0];
    expect(it.d).toContain('M101 ');
    expect(it.d).toContain('H179');
    expect(it.lineY).toBeLessThan(b.top);
    expect(it.top + 18).toBeLessThan(it.lineY);
    expect(L.top).toBe(it.top);
  });
  it('nested spans stack in tiers: the outer bracket rises above the inner label', () => {
    const inner = { anchor: 'A', box: box(100, 30, 20, 60), w: 90, h: 18 };
    const outer = { anchor: 'Av', box: box(100, 80, 20, 60), w: 110, h: 18 };
    const L = layoutBrackets([outer, inner], { width: 600 });
    const [o, i] = L.items;
    expect(i.tier).toBe(0);
    expect(o.tier).toBe(1);
    expect(o.lineY).toBeLessThan(i.top);
  });
  it('side-by-side labels in one tier never overlap', () => {
    const items = [0, 1, 2].map((k) => ({ anchor: `g${k}`, box: box(200 + k * 50, 40, 20, 60), w: 120, h: 18 }));
    const L = layoutBrackets(items, { width: 600 });
    for (const t of new Set(L.items.map((x) => x.tier))) {
      const row = L.items.filter((x) => x.tier === t).map((x, k) => ({ left: x.left, width: items[k].w }));
      expect(spansOverlap(row, 12)).toBe(false);
    }
  });
});

describe('stubs and live values', () => {
  it('a stub sits under its symbol, centred, at least 10px wide', () => {
    expect(stubFor(box(100, 30, 0, 40))).toEqual({ left: 101, width: 28, top: 44 });
    expect(stubFor(box(100, 4, 0, 40)).width).toBe(10);
  });
  it('inline values never overlap; matrices drop out first when the row is too narrow', () => {
    const row = layoutLiveRow(
      [
        { id: 'A', cx: 100, w: 110, rank: 2 },
        { id: 'v', cx: 130, w: 56, rank: 1 },
        { id: 'lam', cx: 200, w: 44, rank: 0 },
      ],
      600,
    );
    expect(row).toHaveLength(3);
    expect(spansOverlap(row.map((r, k) => ({ left: r.left, width: [110, 56, 44][k] })), 12)).toBe(false);
    for (const r of row) expect(r.tick).toBeGreaterThanOrEqual(4);
    const narrow = layoutLiveRow(
      [
        { id: 'A', cx: 100, w: 150, rank: 2 },
        { id: 'v', cx: 130, w: 56, rank: 1 },
        { id: 'lam', cx: 200, w: 44, rank: 0 },
      ],
      200,
    );
    expect(narrow.map((r) => r.id)).toEqual(['v', 'lam']);
  });
});

describe('stub tiers', () => {
  it('a group around its parts drops a tier; side-by-side stubs share one', () => {
    const s = layoutStubs([
      { id: 'Av', box: box(100, 60, 0, 40) },
      { id: 'A', box: box(100, 28, 0, 40) },
      { id: 'v', box: box(132, 28, 0, 40) },
      { id: 'lam', box: box(200, 24, 0, 40) },
    ]);
    expect(s.map((x) => [x.id, x.tier])).toEqual([
      ['Av', 1],
      ['A', 0],
      ['v', 0],
      ['lam', 0],
    ]);
    expect(s[0].top).toBe(s[1].top + 7);
  });
  it('a numerator symbol puts its stub above, clear of the fraction bar', () => {
    const num = box(100, 20, 0, 24);
    const bar: Box = { left: 96, right: 140, top: 27, bottom: 28 };
    const den = box(104, 20, 30, 54);
    const whole: Box = { left: 94, right: 142, top: 0, bottom: 54 }; // the fraction's own group box
    const [s] = layoutStubs([{ id: 'dy', box: num }], 7, [num, bar, den, whole]);
    expect(s.side).toBe('above');
    expect(s.top + 4).toBeLessThanOrEqual(num.top);
    const [d] = layoutStubs([{ id: 'dx', box: den }], 7, [num, bar, den]);
    expect(d.side).toBe('below');
  });
});
