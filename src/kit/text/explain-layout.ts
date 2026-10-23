/**
 * "Explain this" and live-value layout for Formula (DESIGN.md §7), pure and
 * tested. The component measures the rendered KaTeX (symbol boxes, label
 * sizes) and hands plain numbers to these functions; everything that decides
 * where a note, a leader, a bracket, a stub or a live value goes lives here.
 *
 * Guarantees (explain-layout.test.ts):
 * - wide notes sit in one row under their symbols, in symbol order, never
 *   overlapping, inside the block, as close to centred under their symbol as
 *   the row allows (least squares);
 * - leaders never cross: each drops straight down from a dot under its symbol
 *   to a shared "bus" line, then takes an S-curve to its note. Curves that
 *   share their start and end heights are blends of their end x's, so ordered
 *   starts and ordered ends can't cross;
 * - when the notes can't fit even at their narrowest, the layout says so
 *   (null) and the formula switches to the stacked key;
 * - brackets span their anchor's box exactly; nested or crowded ones stack
 *   in tiers;
 * - inline live values never overlap (the widest drop out to the exploded
 *   grid when a row can't hold them all).
 *
 * Coordinates are CSS pixels in one frame chosen by the caller (the formula
 * stage for notes, the maths box for brackets and stubs).
 */

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const boxCx = (b: Box): number => (b.left + b.right) / 2;

/** Below this block width the notes become the stacked key (`.is-stacked`). */
export const STACK_BELOW = 560;

export const explainMode = (blockWidth: number): 'wide' | 'stacked' => (blockWidth < STACK_BELOW ? 'stacked' : 'wide');

// ── One row of labels ─────────────────────────────────────────────────────

export interface RowItem {
  /** The x the label's centre wants to sit at (its symbol's centre). */
  want: number;
  /** Label width. */
  w: number;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/**
 * Left edges for labels kept in the given order, `gap` apart, inside [0, W],
 * minimising the squared distance of each centre from its `want`: clusters of
 * colliding labels merge and sit at their members' mean (pool adjacent
 * violators), then clamp to the row. Items should be sorted by `want`.
 * Returns null when they can't fit side by side at all.
 */
export function packRow(items: readonly RowItem[], W: number, gap: number): number[] | null {
  const n = items.length;
  if (n === 0) return [];
  const total = items.reduce((s, it) => s + it.w, 0) + gap * (n - 1);
  if (total > W + 0.5) return null;
  interface Cluster {
    first: number;
    last: number;
    width: number;
    /** Sum over members of (wanted left of the cluster if this member alone decided). */
    sum: number;
    count: number;
    x: number;
  }
  const place = (c: Cluster) => (c.x = clamp(c.sum / c.count, 0, Math.max(0, W - c.width)));
  const stack: Cluster[] = [];
  for (let i = 0; i < n; i++) {
    let c: Cluster = { first: i, last: i, width: items[i].w, sum: items[i].want - items[i].w / 2, count: 1, x: 0 };
    place(c);
    while (stack.length) {
      const p = stack[stack.length - 1];
      if (p.x + p.width + gap <= c.x + 1e-6) break;
      const shift = p.width + gap;
      c = { first: p.first, last: c.last, width: p.width + gap + c.width, sum: p.sum + c.sum - shift * c.count, count: p.count + c.count, x: 0 };
      place(c);
      stack.pop();
    }
    stack.push(c);
  }
  const out = new Array<number>(n);
  for (const c of stack) {
    let x = c.x;
    for (let k = c.first; k <= c.last; k++) {
      out[k] = x;
      x += items[k].w + gap;
    }
  }
  return out;
}

/**
 * Widths that fit a row: the natural widths if they fit, else the widest are
 * capped (water-filling) until they do. Null when the cap would fall below
 * `minW` (too many notes for the block: use the stacked key).
 */
export function fitWidths(natural: readonly number[], W: number, gap: number, minW: number): number[] | null {
  const n = natural.length;
  if (n === 0) return [];
  const avail = W - gap * (n - 1);
  if (natural.reduce((s, w) => s + w, 0) <= avail) return [...natural];
  const sorted = [...natural].sort((a, b) => a - b);
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const cap = (avail - acc) / (n - k);
    if (cap <= sorted[k]) {
      if (cap < minW) return null;
      const c = Math.floor(cap * 100) / 100;
      return natural.map((w) => Math.min(w, c));
    }
    acc += sorted[k];
  }
  return [...natural];
}

// ── Wide: notes under their symbols, joined by leaders ─────────────────────

export interface WideNoteIn {
  id: string;
  /** The symbol's glyph box (first occurrence). */
  box: Box;
  /** The note's natural width (max-content, already capped at the maximum). */
  width: number;
}

export interface WideOptions {
  /** Block width (the stage's content width). */
  width: number;
  /** Space between notes. Default 16. */
  gap?: number;
  /** Narrowest a note may get before the stacked key takes over. Default 76. */
  minWidth?: number;
  /**
   * The highest a leader's dot may sit: just under the inline live values
   * when they are shown, else near the bottom of the maths, so a symbol up in
   * a numerator doesn't drop its leader through the glyphs below it.
   */
  floorY: number;
}

export interface WideNote {
  id: string;
  left: number;
  width: number;
}

export interface Leader {
  id: string;
  /** Dot under the symbol. */
  x1: number;
  yDot: number;
  /** Where the straight drop meets the curve (shared by every leader). */
  yBus: number;
  /** Top centre of the note. */
  x2: number;
  yEnd: number;
  /** SVG path: the drop, then the S-curve. */
  d: string;
}

export interface WideLayout {
  /** In left-to-right order. */
  notes: WideNote[];
  leaders: Leader[];
  /** Top edge of the notes row. */
  top: number;
}

/** A leader: straight down from the dot to the bus, then a smooth S-curve to the note. */
export function leaderPath(x1: number, yDot: number, yBus: number, x2: number, yEnd: number): string {
  const r = (v: number) => Math.round(v * 10) / 10;
  const dy = yEnd - yBus;
  const drop = yBus > yDot + 0.05 ? `V${r(yBus)}` : '';
  return `M${r(x1)} ${r(yDot)}${drop}C${r(x1)} ${r(yBus + dy * 0.55)} ${r(x2)} ${r(yEnd - dy * 0.55)} ${r(x2)} ${r(yEnd)}`;
}

/** Points along a leader (for tests and hit checks). */
export function leaderPoints(l: Leader, samples = 32): [number, number][] {
  const pts: [number, number][] = [[l.x1, l.yDot]];
  const dy = l.yEnd - l.yBus;
  const p0: [number, number] = [l.x1, l.yBus];
  const p1: [number, number] = [l.x1, l.yBus + dy * 0.55];
  const p2: [number, number] = [l.x2, l.yEnd - dy * 0.55];
  const p3: [number, number] = [l.x2, l.yEnd];
  for (let k = 0; k <= samples; k++) {
    const t = k / samples;
    const u = 1 - t;
    const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    pts.push([b[0] * p0[0] + b[1] * p1[0] + b[2] * p2[0] + b[3] * p3[0], b[0] * p0[1] + b[1] * p1[1] + b[2] * p2[1] + b[3] * p3[1]]);
  }
  return pts;
}

function segmentsCross(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const o = (p: [number, number], q: [number, number], r: [number, number]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}

/** Do two leaders cross (sampled; touching at an end doesn't count)? */
export function leadersCross(a: Leader, b: Leader, samples = 48): boolean {
  const pa = leaderPoints(a, samples);
  const pb = leaderPoints(b, samples);
  for (let i = 0; i + 1 < pa.length; i++) for (let j = 0; j + 1 < pb.length; j++) if (segmentsCross(pa[i], pa[i + 1], pb[j], pb[j + 1])) return true;
  return false;
}

/** Do any two horizontal spans overlap (closer than `gap`)? */
export function spansOverlap(spans: readonly { left: number; width: number }[], gap = 0): boolean {
  const s = [...spans].sort((a, b) => a.left - b.left);
  for (let k = 1; k < s.length; k++) if (s[k].left < s[k - 1].left + s[k - 1].width + gap - 0.01) return true;
  return false;
}

/**
 * Lay out the wide explain notes: one row under the maths, each note as close
 * under its symbol as the row allows, leaders that never cross. Null when the
 * notes can't fit even at `minWidth` (use the stacked key instead).
 */
export function layoutWide(items: readonly WideNoteIn[], opts: WideOptions): WideLayout | null {
  const W = opts.width;
  const gap = opts.gap ?? 16;
  const minW = opts.minWidth ?? 76;
  if (items.length === 0) return { notes: [], leaders: [], top: opts.floorY };
  const sorted = [...items].sort((a, b) => boxCx(a.box) - boxCx(b.box) || a.box.left - b.box.left);
  const widths = fitWidths(
    sorted.map((it) => Math.min(it.width, W)),
    W,
    gap,
    minW,
  );
  if (!widths) return null;
  // Dots strictly left to right, at least 4px apart (a nested anchor can share its parent's centre).
  const xs: number[] = [];
  sorted.forEach((it, k) => xs.push(k === 0 ? boxCx(it.box) : Math.max(boxCx(it.box), xs[k - 1] + 4)));
  const lefts = packRow(
    sorted.map((_, k) => ({ want: xs[k], w: widths[k] })),
    W,
    gap,
  );
  if (!lefts) return null;
  const yDots = sorted.map((it) => Math.max(it.box.bottom + 6, opts.floorY));
  const yBus = Math.max(...yDots) + 4;
  const shift = Math.max(...sorted.map((_, k) => Math.abs(lefts[k] + widths[k] / 2 - xs[k])));
  const drop = clamp(26 + 0.14 * shift, 26, 60);
  const top = yBus + drop;
  const yEnd = top - 4;
  const notes = sorted.map((it, k) => ({ id: it.id, left: lefts[k], width: widths[k] }));
  const leaders = sorted.map((it, k) => {
    const x2 = lefts[k] + widths[k] / 2;
    return { id: it.id, x1: xs[k], yDot: yDots[k], yBus, x2, yEnd, d: leaderPath(xs[k], yDots[k], yBus, x2, yEnd) };
  });
  return { notes, leaders, top };
}

// ── Brackets above groups ─────────────────────────────────────────────────

export interface BracketIn {
  anchor: string;
  /** The anchor's glyph box (relative to the maths box). */
  box: Box;
  /** Label size. */
  w: number;
  h: number;
}

export interface BracketOut {
  anchor: string;
  tier: number;
  /** Label position (same frame as the boxes). */
  left: number;
  top: number;
  /** The bracket rule's height. */
  lineY: number;
  /** Bracket: legs and rule, spanning the anchor's box. */
  d: string;
  /** Stem from the rule up to the label. */
  stem: string;
}

export interface BracketLayout {
  items: BracketOut[];
  /** Topmost label edge (often negative: above the maths box). */
  top: number;
}

/**
 * Brackets over groups of symbols, labelled above. A bracket's rule spans its
 * anchor's box exactly; brackets whose spans overlap (nested groups) or whose
 * labels can't share a row go up a tier, narrowest spans nearest the maths.
 */
export function layoutBrackets(items: readonly BracketIn[], opts: { width: number; gap?: number; stem?: number; tierGap?: number }): BracketLayout {
  const W = opts.width;
  const gap = opts.gap ?? 12;
  const stem = opts.stem ?? 7;
  const tierGap = opts.tierGap ?? 5;
  if (items.length === 0) return { items: [], top: 0 };
  // Tier assignment: narrowest first, lowest tier whose spans (and labels) don't collide.
  const order = items.map((_, i) => i).sort((a, b) => items[a].box.right - items[a].box.left - (items[b].box.right - items[b].box.left));
  const tiers: number[][] = [];
  const fits = (tier: number[], i: number) => {
    const b = items[i].box;
    if (tier.some((j) => items[j].box.left < b.right + 4 && b.left < items[j].box.right + 4)) return false;
    const members = [...tier, i].sort((p, q) => boxCx(items[p].box) - boxCx(items[q].box));
    return packRow(members.map((j) => ({ want: boxCx(items[j].box), w: items[j].w })), W, gap) !== null;
  };
  for (const i of order) {
    let t = tiers.findIndex((tier) => fits(tier, i));
    if (t < 0) {
      t = tiers.length;
      tiers.push([]);
    }
    tiers[t].push(i);
  }
  const out = new Array<BracketOut>(items.length);
  let ceiling = Infinity; // top of the labels of the tier below
  let top = Infinity;
  tiers.forEach((tier, t) => {
    const members = [...tier].sort((p, q) => boxCx(items[p].box) - boxCx(items[q].box));
    const lineY = Math.min(...members.map((j) => items[j].box.top - 6), ceiling - tierGap);
    const labelBottom = lineY - stem;
    const rowH = Math.max(...members.map((j) => items[j].h));
    const lefts = packRow(members.map((j) => ({ want: boxCx(items[j].box), w: items[j].w })), W, gap) ?? members.map((j) => clamp(boxCx(items[j].box) - items[j].w / 2, 0, Math.max(0, W - items[j].w)));
    members.forEach((j, k) => {
      const { box, w, h } = items[j];
      const left = lefts[k];
      const labelTop = labelBottom - h;
      const legTo = Math.max(lineY + 4, box.top - 3);
      const r = (v: number) => Math.round(v * 10) / 10;
      const d = `M${r(box.left + 1)} ${r(legTo)}V${r(lineY)}H${r(box.right - 1)}V${r(legTo)}`;
      // Stem: straight up where the span and the label overlap, else an elbow.
      const lo = Math.max(box.left + 2, left + 6);
      const hi = Math.min(box.right - 2, left + w - 6);
      let stemPath: string;
      if (lo <= hi) {
        const x = clamp(boxCx(box), lo, hi);
        stemPath = `M${r(x)} ${r(lineY)}V${r(labelBottom + 1)}`;
      } else {
        const x0 = boxCx(box);
        const x1 = clamp(x0, left + 6, left + w - 6);
        const mid = (lineY + labelBottom) / 2;
        stemPath = `M${r(x0)} ${r(lineY)}V${r(mid)}H${r(x1)}V${r(labelBottom + 1)}`;
      }
      out[j] = { anchor: items[j].anchor, tier: t, left, top: labelTop, lineY, d, stem: stemPath };
      top = Math.min(top, labelTop);
    });
    ceiling = labelBottom - rowH;
  });
  return { items: out, top };
}

// ── Stacked: stubs under the symbols ──────────────────────────────────────

export interface Stub {
  left: number;
  width: number;
  top: number;
}

/** A short line-style stub under a symbol, tying the stacked key row back to it. */
export function stubFor(box: Box): Stub {
  const w = box.right - box.left;
  const width = Math.max(10, w - 2);
  return { left: boxCx(box) - width / 2, width, top: box.bottom + 4 };
}

// ── Inline live values under their symbols ────────────────────────────────

export interface LiveRowIn {
  id: string;
  /** The symbol's centre. */
  cx: number;
  /** The value's rendered width. */
  w: number;
  /** Which to drop first when the row is too narrow: higher drops first (matrix 2, vector 1, scalar 0). */
  rank: number;
}

export interface LiveRowOut {
  id: string;
  left: number;
  /** Where the 6px tick sits inside the value box (points at the symbol). */
  tick: number;
}

/**
 * Place inline live values under their symbols without overlaps. When they
 * can't all fit, the highest-ranked (then widest) values drop out of the row
 * (the *Live values* grid still shows them).
 */
export function layoutLiveRow(items: readonly LiveRowIn[], W: number, gap = 12): LiveRowOut[] {
  let keep = [...items].sort((a, b) => a.cx - b.cx);
  for (;;) {
    const lefts = packRow(keep.map((it) => ({ want: it.cx, w: it.w })), W, gap);
    if (lefts) return keep.map((it, k) => ({ id: it.id, left: lefts[k], tick: clamp(it.cx - lefts[k], 4, Math.max(4, it.w - 4)) }));
    if (keep.length === 0) return [];
    const drop = keep.reduce((worst, it) => (it.rank > worst.rank || (it.rank === worst.rank && it.w > worst.w) ? it : worst));
    keep = keep.filter((it) => it !== drop);
  }
}

export interface PlacedStub extends Stub {
  id: string;
  /** 0 = right next to the glyphs; nested groups (Av around A and v) move a tier further out. */
  tier: number;
  /** Below the symbol, or above it when below would run into other maths (a numerator over its fraction bar). */
  side: 'below' | 'above';
}

const hits = (s: { left: number; width: number; top: number }, o: Box, pad = 1): boolean =>
  s.left < o.right + pad && o.left - pad < s.left + s.width && s.top < o.bottom + pad && o.top - pad < s.top + 4;

/**
 * Stubs for several symbols: a stub that would overlap one already placed
 * (a group around its parts) goes one tier (`rowGap` px) further out,
 * narrowest first, so every stub stays readable as its own line style. A
 * stub that would run into other maths (`obstacles`: glyphs and fraction
 * bars not inside its own symbol) goes above its symbol instead.
 */
export function layoutStubs(items: readonly { id: string; box: Box }[], rowGap = 7, obstacles: readonly Box[] = []): PlacedStub[] {
  const order = items.map((_, i) => i).sort((a, b) => items[a].box.right - items[a].box.left - (items[b].box.right - items[b].box.left));
  const placed: PlacedStub[] = [];
  const out = new Array<PlacedStub>(items.length);
  for (const i of order) {
    const { id, box } = items[i];
    const base = stubFor(box);
    // Its own glyphs, and boxes around it (a fraction's whole group), aren't in its way.
    const own = (o: Box) =>
      (o.left >= box.left - 1 && o.right <= box.right + 1 && o.top >= box.top - 1 && o.bottom <= box.bottom + 1) ||
      (o.left <= box.left + 1 && o.right >= box.right - 1 && o.top <= box.top + 1 && o.bottom >= box.bottom - 1);
    const blocked = (c: { left: number; width: number; top: number }) => obstacles.some((o) => !own(o) && hits(c, o));
    const free = (c: { left: number; width: number; top: number }, tier: number, side: 'below' | 'above') =>
      !placed.some((p) => p.tier === tier && p.side === side && p.left < c.left + c.width + 2 && c.left < p.left + p.width + 2);
    let pick: PlacedStub | null = null;
    for (const side of ['below', 'above'] as const) {
      for (let tier = 0; tier < 4 && !pick; tier++) {
        const c = { ...base, top: side === 'below' ? base.top + tier * rowGap : box.top - 8 - tier * rowGap };
        if (free(c, tier, side) && !blocked(c)) pick = { id, ...c, tier, side };
      }
      if (pick) break;
    }
    if (!pick) {
      let tier = 0;
      while (!free({ ...base, top: base.top + tier * rowGap }, tier, 'below')) tier++;
      pick = { id, ...base, top: base.top + tier * rowGap, tier, side: 'below' };
    }
    placed.push(pick);
    out[i] = pick;
  }
  return out;
}
