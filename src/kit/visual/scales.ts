/**
 * World ↔ pixel geometry for Stage2D and everything drawn on it. Pure (no
 * DOM, no Preact), so the scale maths, axis layout, clipping and label
 * placement are unit-tested in scales.test.ts.
 *
 * Conventions: world y points up, pixel y points down; a `ViewBox` is the
 * world rectangle `{ x: [xmin, xmax], y: [ymin, ymax] }`. With `equalScale`
 * one world unit has the same length on both axes, so the requested view
 * grows (around its centre) along whichever axis has room to spare.
 */
import { decimalsFor, fmt, niceStep, ticks } from '../math/axes';
import type { Vec2 } from '../math/vec';
import type { ViewBox } from '../types';

export interface StageScale {
  /** The world rectangle actually shown (the requested view, grown to fit when `equalScale`). */
  view: ViewBox;
  width: number;
  height: number;
  /** Pixels per world unit along x. */
  pxPerUnit: number;
  /** Pixels per world unit along y (equals `pxPerUnit` with equal scale). */
  pxPerUnitY: number;
  toPx(p: Readonly<Vec2>): Vec2;
  toWorld(px: Readonly<Vec2>): Vec2;
}

const span = (r: readonly [number, number]): number => r[1] - r[0];

/** A degenerate or inverted view (zero or negative span) becomes a unit-wide one around its centre. */
export function normalizeView(view: ViewBox): ViewBox {
  const fix = (r: readonly [number, number]): [number, number] => {
    const lo = Math.min(r[0], r[1]);
    const hi = Math.max(r[0], r[1]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1];
    if (hi - lo < 1e-12) return [lo - 0.5, hi + 0.5];
    return [lo, hi];
  };
  return { x: fix(view.x), y: fix(view.y) };
}

/**
 * The view to show in a `width × height` pixel box. With `equalScale`, the
 * axis with spare room is widened around its centre so 1 unit is the same
 * length on both axes; otherwise the view is returned unchanged.
 */
export function fitView(view: ViewBox, width: number, height: number, equalScale = true): ViewBox {
  const v = normalizeView(view);
  if (!equalScale || !(width > 0) || !(height > 0)) return v;
  const ppu = Math.min(width / span(v.x), height / span(v.y));
  const grow = (r: readonly [number, number], px: number): [number, number] => {
    const c = (r[0] + r[1]) / 2;
    const half = px / ppu / 2;
    return [c - half, c + half];
  };
  return { x: grow(v.x, width), y: grow(v.y, height) };
}

/** World ↔ pixel maps for a view in a pixel box. */
export function makeScale(view: ViewBox, width: number, height: number, equalScale = true): StageScale {
  const v = fitView(view, width, height, equalScale);
  const W = Math.max(1, width);
  const H = Math.max(1, height);
  const sx = W / span(v.x);
  const sy = H / span(v.y);
  const [x0] = v.x;
  const [, y1] = v.y;
  return {
    view: v,
    width: W,
    height: H,
    pxPerUnit: sx,
    pxPerUnitY: sy,
    toPx: (p) => [(p[0] - x0) * sx, (y1 - p[1]) * sy],
    toWorld: (q) => [x0 + q[0] / sx, y1 - q[1] / sy],
  };
}

/** True when two views are the same rectangle (within float noise). */
export function sameView(a: ViewBox, b: ViewBox, eps = 1e-12): boolean {
  return Math.abs(a.x[0] - b.x[0]) <= eps && Math.abs(a.x[1] - b.x[1]) <= eps && Math.abs(a.y[0] - b.y[0]) <= eps && Math.abs(a.y[1] - b.y[1]) <= eps;
}

// ── Pan and zoom ────────────────────────────────────────────────────────────

/** Move the view by a world-space offset. */
export function panView(view: ViewBox, dx: number, dy: number): ViewBox {
  return { x: [view.x[0] + dx, view.x[1] + dx], y: [view.y[0] + dy, view.y[1] + dy] };
}

/** Zoom by `factor` (> 1 zooms in) keeping the world point `anchor` fixed on screen. */
export function zoomView(view: ViewBox, factor: number, anchor: Readonly<Vec2> = [(view.x[0] + view.x[1]) / 2, (view.y[0] + view.y[1]) / 2]): ViewBox {
  const f = factor > 0 && Number.isFinite(factor) ? factor : 1;
  const z = (r: readonly [number, number], a: number): [number, number] => [a + (r[0] - a) / f, a + (r[1] - a) / f];
  return { x: z(view.x, anchor[0]), y: z(view.y, anchor[1]) };
}

/** How far `current` is zoomed relative to `initial` (2 = everything twice as big). */
export function zoomLevel(initial: ViewBox, current: ViewBox): number {
  return span(initial.x) / span(current.x);
}

/** The zoom factor to apply so the resulting zoom level stays within [min, max]. */
export function clampZoomFactor(initial: ViewBox, current: ViewBox, factor: number, min: number, max: number): number {
  const level = zoomLevel(initial, current);
  const next = Math.min(max, Math.max(min, level * factor));
  return next / level;
}

// ── Grid, axes and ticks ────────────────────────────────────────────────────

/** A nice grid step (1, 2 or 5 × 10^k) giving lines about `targetPx` apart. */
export function gridStep(spanWorld: number, spanPx: number, targetPx = 64): number {
  if (!(spanWorld > 0) || !(spanPx > 0)) return 1;
  return niceStep((spanWorld * targetPx) / spanPx);
}

/** A tick label: float noise trimmed to the step's decimals, U+2212 minus, never "−0". */
export function tickLabel(value: number, step: number): string {
  return fmt(Math.abs(value) < step * 1e-6 ? 0 : value, decimalsFor(step));
}

export interface AxisTick {
  value: number;
  /** Pixel position along the axis (x for the x axis, y for the y axis). */
  px: number;
  label: string;
}

export interface AxisLayout {
  /** Grid steps in world units. */
  stepX: number;
  stepY: number;
  /** Grid line positions (world). */
  gridX: number[];
  gridY: number[];
  /** Pixel y of the x axis and pixel x of the y axis. */
  xAxisPx: number;
  yAxisPx: number;
  /** Which side of its axis each set of tick labels sits on (labels stay inside the plate). */
  xLabelSide: 'below' | 'above';
  yLabelSide: 'left' | 'right';
  xTicks: AxisTick[];
  yTicks: AxisTick[];
}

/**
 * Where the axes, grid lines and tick labels go. An axis sits at 0 when 0 is
 * in view, otherwise on the nearest edge; tick labels flip to the inner side
 * when the axis hugs an edge; the origin's labels and labels too close to an
 * edge are dropped (the readout repeats every number that matters).
 */
export function axisLayout(scale: StageScale, opts: { step?: number; stepY?: number; targetPx?: number } = {}): AxisLayout {
  const { view, width: W, height: H } = scale;
  const target = opts.targetPx ?? (W < 520 ? 56 : 68);
  const stepX = opts.step ?? gridStep(span(view.x), W, target);
  const stepY = opts.stepY ?? opts.step ?? gridStep(span(view.y), H, target);
  const gridX = ticks(view.x[0], view.x[1], stepX);
  const gridY = ticks(view.y[0], view.y[1], stepY);
  const xAxisWorld = view.y[0] > 0 ? view.y[0] : view.y[1] < 0 ? view.y[1] : 0;
  const yAxisWorld = view.x[0] > 0 ? view.x[0] : view.x[1] < 0 ? view.x[1] : 0;
  const [yAxisPx, xAxisPx] = scale.toPx([yAxisWorld, xAxisWorld]);
  const xLabelSide = xAxisPx > H - 22 ? 'above' : 'below';
  const yLabelSide = yAxisPx < 30 ? 'right' : 'left';
  const xTicks: AxisTick[] = [];
  for (const v of gridX) {
    if (Math.abs(v - yAxisWorld) < stepX * 1e-6) continue;
    const px = scale.toPx([v, 0])[0];
    if (px < 12 || px > W - 12) continue;
    xTicks.push({ value: v, px, label: tickLabel(v, stepX) });
  }
  const yTicks: AxisTick[] = [];
  for (const v of gridY) {
    if (Math.abs(v - xAxisWorld) < stepY * 1e-6) continue;
    const px = scale.toPx([0, v])[1];
    if (px < 10 || px > H - 10) continue;
    yTicks.push({ value: v, px, label: tickLabel(v, stepY) });
  }
  return { stepX, stepY, gridX, gridY, xAxisPx, yAxisPx, xLabelSide, yLabelSide, xTicks, yTicks };
}

// ── Clipping ────────────────────────────────────────────────────────────────

export interface ClipRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The segment a→b clipped to a rectangle (Liang–Barsky), or null when it misses. */
export function clipSegment(a: Readonly<Vec2>, b: Readonly<Vec2>, r: ClipRect): [Vec2, Vec2] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - r.x0, r.x1 - a[0], a[1] - r.y0, r.y1 - a[1]];
  for (let k = 0; k < 4; k++) {
    if (p[k] === 0) {
      if (q[k] < 0) return null;
    } else {
      const t = q[k] / p[k];
      if (p[k] < 0) {
        if (t > t1) return null;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return null;
        if (t < t1) t1 = t;
      }
    }
  }
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
}

/** The infinite line through p and q, clipped to a rectangle, or null (also when p = q). */
export function clipLine(p: Readonly<Vec2>, q: Readonly<Vec2>, r: ClipRect): [Vec2, Vec2] | null {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const reach = (Math.hypot(r.x1 - r.x0, r.y1 - r.y0) + Math.hypot(p[0] - (r.x0 + r.x1) / 2, p[1] - (r.y0 + r.y1) / 2)) / len + 1;
  return clipSegment([p[0] - dx * reach, p[1] - dy * reach], [p[0] + dx * reach, p[1] + dy * reach], r);
}

/** A rectangle grown by `pad` on every side. */
export const inflateRect = (r: ClipRect, pad: number): ClipRect => ({ x0: r.x0 - pad, y0: r.y0 - pad, x1: r.x1 + pad, y1: r.y1 + pad });

/** The pixel rectangle of a scale, optionally inflated (for clipping long lines before dashing them). */
export const pxRect = (s: { width: number; height: number }, pad = 0): ClipRect => inflateRect({ x0: 0, y0: 0, x1: s.width, y1: s.height }, pad);

// ── Marks ───────────────────────────────────────────────────────────────────

/**
 * Arrow geometry in pixels: where the shaft stops and the filled head's
 * corners. Heads scale with the stroke width (DESIGN.md §5); a very short
 * arrow shrinks its head so it never overshoots its tail. Null when shorter
 * than 2px.
 */
export function arrowGeometry(from: Readonly<Vec2>, to: Readonly<Vec2>, width: number): { shaftEnd: Vec2; head: Vec2[] } | null {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const L = Math.hypot(dx, dy);
  if (L < 2) return null;
  const ux = dx / L;
  const uy = dy / L;
  const k = Math.min(1, L / (7 + width * 2) / 1.6);
  const hl = (7 + width * 2) * k;
  const hw = (3 + width * 1.4) * k;
  const bx = to[0] - ux * hl;
  const by = to[1] - uy * hl;
  return {
    shaftEnd: [bx + ux * Math.min(1.5, hl * 0.3), by + uy * Math.min(1.5, hl * 0.3)],
    head: [
      [to[0], to[1]],
      [bx - uy * hw, by + ux * hw],
      [bx + ux * 2 * k, by + uy * 2 * k],
      [bx + uy * hw, by - ux * hw],
    ],
  };
}

/** SVG path data for one or more polylines (each a separate subpath; empty ones skipped). */
export function polylinePath(lines: readonly (readonly Readonly<Vec2>[])[], closed = false): string {
  let d = '';
  for (const pts of lines) {
    if (pts.length < 2) continue;
    d += `M${r2(pts[0][0])} ${r2(pts[0][1])}`;
    for (let k = 1; k < pts.length; k++) d += `L${r2(pts[k][0])} ${r2(pts[k][1])}`;
    if (closed) d += 'Z';
  }
  return d;
}

/** Round to 0.01px: keeps path strings short without visible error. */
export const r2 = (x: number): number => Math.round(x * 100) / 100;

// ── Labels ──────────────────────────────────────────────────────────────────

export type LabelAnchor = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'c';

/**
 * Top-left corner of a `w × h` label placed on side `anchor` of a point, `gap`
 * pixels away ('n' = above the point, 'e' = to its right, 'c' = centred on it).
 */
export function anchorBox(at: Readonly<Vec2>, anchor: LabelAnchor, w: number, h: number, gap = 8): Vec2 {
  const d = gap * Math.SQRT1_2;
  switch (anchor) {
    case 'n':
      return [at[0] - w / 2, at[1] - gap - h];
    case 's':
      return [at[0] - w / 2, at[1] + gap];
    case 'e':
      return [at[0] + gap, at[1] - h / 2];
    case 'w':
      return [at[0] - gap - w, at[1] - h / 2];
    case 'ne':
      return [at[0] + d, at[1] - d - h];
    case 'nw':
      return [at[0] - d - w, at[1] - d - h];
    case 'se':
      return [at[0] + d, at[1] + d];
    case 'sw':
      return [at[0] - d - w, at[1] + d];
    case 'c':
      return [at[0] - w / 2, at[1] - h / 2];
  }
}

/** Keep a `w × h` box inside a `W × H` plate with `pad` pixels to spare (a box bigger than the plate pins to its top-left). */
export function clampToPlate(x: number, y: number, w: number, h: number, W: number, H: number, pad = 6): Vec2 {
  const cx = Math.max(pad, Math.min(x, W - pad - w));
  const cy = Math.max(pad, Math.min(y, H - pad - h));
  return [w + 2 * pad > W ? pad : cx, h + 2 * pad > H ? pad : cy];
}

/** The anchor that puts a label beyond the tip of a direction (screen space, y down): east for →, north for ↑ … */
export function anchorForDirection(dx: number, dy: number): LabelAnchor {
  if (Math.hypot(dx, dy) < 1e-9) return 'ne';
  const a = Math.atan2(-dy, dx); // screen y down → maths angle
  const sector = Math.round(a / (Math.PI / 4));
  const names: LabelAnchor[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
  return names[((sector % 8) + 8) % 8];
}

/**
 * Where the first-touch hint ("drag the ring") goes, beside a handle at `h`
 * in a `W × H` plate: below-left by default, flipped above when the handle is
 * near the bottom and to the left side when near the right edge. Returns the
 * text baseline origin and a pen-stroke arrow path from the text to the ring.
 */
export function hintPlacement(h: Readonly<Vec2>, W: number, H: number, textWidth: number): { x: number; y: number; arrow: string; tip: string } {
  const below = h[1] + 66 < H - 8;
  const ty = below ? h[1] + 62 : Math.max(18, h[1] - 50);
  const tx = Math.min(W - textWidth - 8, Math.max(8, h[0] - 14));
  const sx = Math.min(Math.max(tx + 10, 8), W - 8);
  const sy = below ? ty - 16 : ty + 6;
  const ex = h[0] - 3;
  const ey = below ? h[1] + 19 : h[1] - 19;
  const bend = below ? 1 : -1;
  const arrow = `M${r2(sx)} ${r2(sy)}C${r2(sx - 8)} ${r2(sy - 10 * bend)} ${r2(ex - 8)} ${r2(ey + 12 * bend)} ${r2(ex)} ${r2(ey)}`;
  const tip = `M${r2(ex - 6)} ${r2(ey + 5 * bend)}L${r2(ex)} ${r2(ey)}L${r2(ex + 3)} ${r2(ey + 7 * bend)}`;
  return { x: r2(tx), y: r2(ty), arrow, tip };
}

/**
 * Drop points closer than `tol` px to the last kept one (radial-distance
 * simplification, first and last kept). A 2,000-point series across 600px
 * strokes ~600 segments with no visible change, which keeps dashed live
 * series cheap to rasterise.
 */
export function simplifyPx(pts: readonly Readonly<Vec2>[], tol = 0.5): Vec2[] {
  if (pts.length <= 2) return pts.map((p) => [p[0], p[1]] as Vec2);
  const out: Vec2[] = [[pts[0][0], pts[0][1]]];
  const t2 = tol * tol;
  let lx = pts[0][0];
  let ly = pts[0][1];
  for (let k = 1; k < pts.length - 1; k++) {
    const dx = pts[k][0] - lx;
    const dy = pts[k][1] - ly;
    if (dx * dx + dy * dy >= t2) {
      out.push([pts[k][0], pts[k][1]]);
      lx = pts[k][0];
      ly = pts[k][1];
    }
  }
  const last = pts[pts.length - 1];
  out.push([last[0], last[1]]);
  return out;
}
