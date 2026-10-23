/**
 * Stage2D's drawing primitives (README §6.1). Every primitive takes
 * `concept` (ink + line style), `emphasis` ('focal' 2.5px · 'quiet' 2px at
 * 62% · 'context' 22%), an optional `label` (Rich, KaTeX allowed, drawn in
 * the HTML overlay, haloed and clamped inside the plate) and accepts
 * `Vec2 | ReadonlySignal<Vec2>` wherever a point is expected.
 *
 * Reactivity: on the dynamic layer a primitive reads its signals during
 * render, so a signal change re-renders that primitive only; on the static
 * layer it peeks (and samples functions untracked), so the static layer
 * never repaints for a signal.
 */
import { untracked, type ReadonlySignal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { RichText } from '../core/RichText';
import { useTheme } from '../core/hooks';
import type { Vec2 } from '../math/vec';
import { strokeFor, type LineStyle } from '../theme';
import type { Rich } from '../types';
import { fitCanvas } from '../util/dom';
import { cx, EMPHASIS, readValue, useConcept, useLayer, useRenderCount, useStage, useStageContext, type Emphasis, type MaybeSignal, type StageApi } from './context';
import { frameEffect } from './frame';
import { Portal } from './portal';
import { sampleFunction, sampleParametric } from './sampling';
import { anchorBox, anchorForDirection, arrowGeometry, clampToPlate, clipLine, clipSegment, polylinePath, pxRect, r2, type LabelAnchor } from './scales';

type P = MaybeSignal<Vec2> | MaybeSignal<Readonly<Vec2>>;

export interface MarkProps {
  concept?: string;
  emphasis?: Emphasis;
  label?: Rich;
  /** The learner found it: draw in "correct" green (DESIGN.md §5, "the answer is earned"). */
  correct?: MaybeSignal<boolean>;
}

const pt = (v: P, layer: 'static' | 'dynamic'): Vec2 => {
  const p = readValue(v as MaybeSignal<Readonly<Vec2>>, layer);
  return [p[0], p[1]];
};

/** Concept classes, line style and stroke width for a mark (switching to `correct` when found). */
function useMark(concept: string | undefined, emphasis: Emphasis, correct: MaybeSignal<boolean> | undefined) {
  const layer = useLayer();
  const ok = correct !== undefined && readValue(correct, layer);
  const rc = useConcept(ok ? 'correct' : concept);
  const e = EMPHASIS[emphasis];
  return { layer, rc, width: e.width, cls: cx('s2-mark', rc.className, e.cls, ok && 'is-correct') };
}

/** A stroked path in a line style: dashes scale with the width; 'double' draws an ink casing with a plate core. */
export function StrokePath({ d, line, width }: { d: string; line: LineStyle; width: number }) {
  if (!d) return null;
  const s = strokeFor(line, width);
  if (s.double) {
    return (
      <>
        <path class="fig-line" d={d} style={{ strokeWidth: `calc(var(--sw) * 1.45 + var(--lit, 0) * 1px)` }} stroke-linecap="butt" />
        <path class="s2-double-core" d={d} stroke-width={r2(width * 0.52)} />
      </>
    );
  }
  return <path class="fig-line" d={d} stroke-dasharray={s.dasharray ?? undefined} stroke-linecap={s.linecap} stroke-linejoin="round" />;
}

const markStyle = (w: number) => ({ '--sw': `${w}px` }) as Record<string, string>;

// ── Vector ──────────────────────────────────────────────────────────────────

export interface VectorProps extends MarkProps {
  from?: P;
  to: P;
  /** Where the label sits relative to the tip; default: beyond the tip along the arrow. */
  labelAnchor?: LabelAnchor;
  /** Gap between the tip and its label in px (default 10; use ~22 when a handle's ring sits on the tip). */
  labelGap?: number;
}

/** An arrow from `from` (default the origin) to `to`, with a filled head that scales with the stroke. */
export function Vector({ from = [0, 0], to, concept, emphasis = 'focal', label, correct, labelAnchor, labelGap = 10 }: VectorProps) {
  useRenderCount();
  const s = useStage();
  const { layer, rc, width, cls } = useMark(concept, emphasis, correct);
  const a = s.toPx(pt(from, layer));
  const b = s.toPx(pt(to, layer));
  const g = arrowGeometry(a, b, width);
  return (
    <>
      {g && (
        <g class={cls} style={markStyle(width)} stroke-width={width}>
          <StrokePath d={`M${r2(a[0])} ${r2(a[1])}L${r2(g.shaftEnd[0])} ${r2(g.shaftEnd[1])}`} line={rc.line} width={width} />
          <path class="fig-head s2-head" d={polylinePath([g.head], true)} />
        </g>
      )}
      {label && <LabelAt px={b} text={label} concept={concept} anchor={labelAnchor ?? anchorForDirection(b[0] - a[0], b[1] - a[1])} gap={labelGap} />}
    </>
  );
}

// ── Segment and Line ────────────────────────────────────────────────────────

export interface SegmentProps extends MarkProps {
  a: P;
  b: P;
}

/** A straight segment a–b (clipped to the plate, so long dashes stay cheap). */
export function Segment({ a, b, concept, emphasis = 'quiet', label, correct }: SegmentProps) {
  useRenderCount();
  const s = useStage();
  const { layer, rc, width, cls } = useMark(concept, emphasis, correct);
  const pa = s.toPx(pt(a, layer));
  const pb = s.toPx(pt(b, layer));
  const c = clipSegment(pa, pb, pxRect(s, 8));
  return (
    <>
      {c && (
        <g class={cls} style={markStyle(width)} stroke-width={width}>
          <StrokePath d={polylinePath([c])} line={rc.line} width={width} />
        </g>
      )}
      {label && <LabelAt px={[(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2]} text={label} concept={concept} anchor="n" />}
    </>
  );
}

export interface LineProps extends MarkProps {
  through: readonly [P, P];
}

/** The infinite line through two points, clipped to the view. */
export function Line({ through, concept, emphasis = 'quiet', label, correct }: LineProps) {
  useRenderCount();
  const s = useStage();
  const { layer, rc, width, cls } = useMark(concept, emphasis, correct);
  const p = s.toPx(pt(through[0], layer));
  const q = s.toPx(pt(through[1], layer));
  const c = clipLine(p, q, pxRect(s, 8));
  return (
    <>
      {c && (
        <g class={cls} style={markStyle(width)} stroke-width={width}>
          <StrokePath d={polylinePath([c])} line={rc.line} width={width} />
        </g>
      )}
      {label && c && <LabelAt px={[c[0][0] + (c[1][0] - c[0][0]) * 0.82, c[0][1] + (c[1][1] - c[0][1]) * 0.82]} text={label} concept={concept} anchor="n" />}
    </>
  );
}

// ── Point ───────────────────────────────────────────────────────────────────

export interface PointProps extends MarkProps {
  at: P;
  /** Radius in px. Default 4.5. */
  r?: number;
  labelAnchor?: LabelAnchor;
  /** Hollow ring instead of a filled dot (an excluded endpoint, an open interval). */
  hollow?: boolean;
}

/** A dot. */
export function Point({ at, concept, emphasis = 'focal', label, correct, r = 4.5, labelAnchor = 'ne', hollow }: PointProps) {
  useRenderCount();
  const s = useStage();
  const { layer, cls } = useMark(concept, emphasis, correct);
  const c = s.toPx(pt(at, layer));
  return (
    <>
      <circle class={cx(cls, 's2-point', hollow && 'is-hollow')} cx={r2(c[0])} cy={r2(c[1])} r={r} />
      {label && <LabelAt px={c} text={label} concept={concept} anchor={labelAnchor} gap={r + 6} />}
    </>
  );
}

// ── Curve ───────────────────────────────────────────────────────────────────

export interface CurveProps extends MarkProps {
  /** y = f(x), sampled across the view. */
  f?: (x: number) => number;
  /** Or a parametric curve t ↦ (x, y) over `t`. */
  param?: (t: number) => Readonly<Vec2>;
  t?: readonly [number, number];
  /** Restrict y = f(x) to this x-interval. */
  domain?: readonly [number, number];
  /** Initial samples (refined adaptively). */
  samples?: number;
}

/** An adaptively sampled curve that breaks at poles and domain edges. Signals read inside `f` re-render it (dynamic layer). */
export function Curve({ f, param, t = [0, 1], domain, samples, concept, emphasis = 'focal', label, correct }: CurveProps) {
  useRenderCount();
  const s = useStage();
  const { layer, rc, width, cls } = useMark(concept, emphasis, correct);
  const sample = () => {
    const opts = { n: samples ?? Math.max(80, Math.min(420, Math.round(s.width / 3))), pxX: s.pxPerUnit, pxY: s.pxPerUnitY, yView: s.view.y };
    if (param) return sampleParametric(param, t[0], t[1], opts);
    if (!f) return [];
    const x0 = Math.max(s.view.x[0], domain?.[0] ?? -Infinity);
    const x1 = Math.min(s.view.x[1], domain?.[1] ?? Infinity);
    return x1 > x0 ? sampleFunction(f, x0, x1, opts) : [];
  };
  const runs = layer === 'static' ? untracked(sample) : sample();
  const H = s.height;
  const px = runs.map((run) => run.map((p) => {
    const q = s.toPx(p);
    return [q[0], Math.max(-H, Math.min(2 * H, q[1]))] as Vec2;
  }));
  const d = polylinePath(px);
  const end = px.length ? px[px.length - 1][px[px.length - 1].length - 1] : null;
  return (
    <>
      <g class={cls} style={markStyle(width)} stroke-width={width}>
        <StrokePath d={d} line={rc.line} width={width} />
      </g>
      {label && end && <LabelAt px={end} text={label} concept={concept} anchor="nw" />}
    </>
  );
}

// ── Polyline and Polygon ────────────────────────────────────────────────────

export interface PolylineProps extends MarkProps {
  points: MaybeSignal<readonly Readonly<Vec2>[]>;
  closed?: boolean;
}

/** Connected segments through world points. */
export function Polyline({ points, closed, concept, emphasis = 'quiet', label, correct }: PolylineProps) {
  useRenderCount();
  const s = useStage();
  const { layer, rc, width, cls } = useMark(concept, emphasis, correct);
  const pts = readValue(points, layer).map((p) => s.toPx(p));
  return (
    <>
      <g class={cls} style={markStyle(width)} stroke-width={width}>
        <StrokePath d={polylinePath([pts], closed)} line={rc.line} width={width} />
      </g>
      {label && pts.length > 0 && <LabelAt px={pts[pts.length - 1]} text={label} concept={concept} anchor="ne" />}
    </>
  );
}

export interface PolygonProps extends MarkProps {
  points: MaybeSignal<readonly Readonly<Vec2>[]>;
  /** 'wash' (12% of the ink) or 'hatch' (diagonal lines, readable without colour). Default 'wash'. */
  fill?: 'wash' | 'hatch' | 'none';
  /** Draw the outline too. Default true. */
  outline?: boolean;
}

let patternSeq = 0;

/** A closed region, washed or hatched in the concept's ink, with an outline in its line style. */
export function Polygon({ points, fill = 'wash', outline = true, concept, emphasis = 'quiet', label, correct }: PolygonProps) {
  useRenderCount();
  const s = useStage();
  const { layer, rc, width, cls } = useMark(concept, emphasis, correct);
  const pid = useMemo(() => `s2-hatch-${(++patternSeq).toString(36)}`, []);
  const pts = readValue(points, layer).map((p) => s.toPx(p));
  const d = polylinePath([pts], true);
  let cxs = 0;
  let cys = 0;
  for (const p of pts) {
    cxs += p[0] / pts.length;
    cys += p[1] / pts.length;
  }
  return (
    <>
      <g class={cx(cls, 's2-polygon')} style={markStyle(width)} stroke-width={width}>
        {fill === 'hatch' && (
          <defs>
            <pattern id={pid} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0V7" class="s2-hatch-line" />
            </pattern>
          </defs>
        )}
        {fill !== 'none' && <path d={d} class={fill === 'hatch' ? 's2-fill-hatch' : 's2-fill-wash'} fill={fill === 'hatch' ? `url(#${pid})` : undefined} />}
        {outline && <StrokePath d={d} line={rc.line} width={width} />}
      </g>
      {label && pts.length > 0 && <LabelAt px={[cxs, cys]} text={label} concept={concept} anchor="c" focusable={false} />}
    </>
  );
}

// ── Band ────────────────────────────────────────────────────────────────────

export interface BandProps extends MarkProps {
  /** A point on the line. */
  through: P;
  /** The line's direction. */
  direction: P;
  /** Band width in px. Default 16. */
  width?: number;
  /** Also draw the line itself in the concept's line style. Default true. */
  line?: boolean;
}

/** The "found" band (DESIGN.md §5): a soft 16px band along a line, the line in its style, and a name set along it. */
export function Band({ through, direction, width: bw = 16, line = true, concept, emphasis, label, correct }: BandProps) {
  useRenderCount();
  const s = useStage();
  const m = useMark(concept, emphasis ?? 'focal', correct);
  const { layer, rc } = m;
  // A kept line reads as a 2.5px rule at 85% (DESIGN.md §5) unless an emphasis is asked for.
  const width = emphasis ? m.width : 2.5;
  const cls = emphasis ? m.cls : cx('s2-mark s2-band', rc.className, correct !== undefined && readValue(correct, layer) && 'is-correct');
  const p0 = pt(through, layer);
  const dir = pt(direction, layer);
  const a = s.toPx(p0);
  const b = s.toPx([p0[0] + dir[0], p0[1] + dir[1]]);
  const c = clipLine(a, b, pxRect(s, 20));
  if (!c) return null;
  const d = polylinePath([c]);
  // Name it along the line near the end that's lower on screen, rotated to read left to right, fully inside the plate.
  let ang = (Math.atan2(c[1][1] - c[0][1], c[1][0] - c[0][0]) * 180) / Math.PI;
  if (ang > 90) ang -= 180;
  if (ang < -90) ang += 180;
  const lo = c[0][1] > c[1][1] ? c[0] : c[1];
  const hi = lo === c[0] ? c[1] : c[0];
  const lp = bandLabelAt(lo, hi, ang, label ? label.length * 7 + 8 : 0, s.width, s.height);
  return (
    <g class={cx(cls, correct !== undefined && readValue(correct, layer) && 'fig-found')} style={markStyle(width)} stroke-width={width}>
      <path class="fig-band" d={d} style={{ strokeWidth: `${bw}px` }} />
      {line && <StrokePath d={d} line={rc.line} width={width} />}
      {label && (
        <text class="fig-line-label" x={r2(lp[0])} y={r2(lp[1] - 9)} text-anchor="middle" transform={`rotate(${r2(ang)} ${r2(lp[0])} ${r2(lp[1])})`}>
          {label}
        </text>
      )}
    </g>
  );
}

/** The first point from 18% along lo→hi where a label of `w` px, rotated by `ang`°, sits inside the plate. */
function bandLabelAt(lo: Vec2, hi: Vec2, ang: number, w: number, W: number, H: number): Vec2 {
  const a = (ang * Math.PI) / 180;
  const hx = (w / 2) * Math.abs(Math.cos(a)) + 6;
  const hy = (w / 2) * Math.abs(Math.sin(a)) + 14;
  for (let t = 0.18; t <= 0.82; t += 0.04) {
    const p: Vec2 = [lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t];
    if (p[0] >= hx && p[0] <= W - hx && p[1] >= hy && p[1] <= H - hy + 8) return p;
  }
  return [lo[0] + (hi[0] - lo[0]) * 0.5, lo[1] + (hi[1] - lo[1]) * 0.5];
}

// ── Arc ─────────────────────────────────────────────────────────────────────

export interface ArcProps extends MarkProps {
  center: P;
  /** Points (or directions from the centre) on the two arms; the arc sweeps the smaller angle between them. */
  from: P;
  to: P;
  /** Radius in px. Default 26. */
  r?: number;
}

/** An angle mark between two arms meeting at `center`. */
export function Arc({ center, from, to, r = 26, concept, emphasis = 'quiet', label, correct }: ArcProps) {
  useRenderCount();
  const s = useStage();
  const { layer, rc, width, cls } = useMark(concept, emphasis, correct);
  const c = s.toPx(pt(center, layer));
  const pa = s.toPx(pt(from, layer));
  const pb = s.toPx(pt(to, layer));
  const a1 = Math.atan2(pa[1] - c[1], pa[0] - c[0]);
  let da = Math.atan2(pb[1] - c[1], pb[0] - c[0]) - a1;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  if (Math.abs(da) < 1e-3) return null;
  const a2 = a1 + da;
  const p1: Vec2 = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1)];
  const p2: Vec2 = [c[0] + r * Math.cos(a2), c[1] + r * Math.sin(a2)];
  const am = a1 + da / 2;
  const d = `M${r2(p1[0])} ${r2(p1[1])}A${r} ${r} 0 0 ${da > 0 ? 1 : 0} ${r2(p2[0])} ${r2(p2[1])}`;
  return (
    <>
      <g class={cls} style={markStyle(width)} stroke-width={width}>
        <StrokePath d={d} line={rc.line} width={width} />
      </g>
      {label && <LabelAt px={[c[0] + (r + 4) * Math.cos(am), c[1] + (r + 4) * Math.sin(am)]} text={label} concept={concept} anchor={anchorForDirection(Math.cos(am), Math.sin(am))} gap={4} />}
    </>
  );
}

// ── Label ───────────────────────────────────────────────────────────────────

export interface LabelProps {
  at: P;
  text: Rich;
  concept?: string;
  /** Which side of the point the label sits on. Default 'ne'. */
  anchor?: LabelAnchor;
  /** Gap from the point in px. Default 8. */
  gap?: number;
  /** In the tab order (publishing its concept on focus: the keyboard route to hover-linking). Default: true when it has a concept. */
  focusable?: boolean;
  /** Link a single symbol (matches a formula's `\anchor{id}`). */
  term?: string;
}

/** A label in the HTML overlay: Rich text (KaTeX allowed), haloed by the plate colour and clamped inside the plate. */
export function Label({ at, ...rest }: LabelProps) {
  useRenderCount();
  const s = useStage();
  const layer = useLayer();
  return <LabelAt px={s.toPx(pt(at, layer))} {...rest} />;
}

const fontsSettled = () => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded';

/** A label at a pixel position (what the primitives use for their `label`). */
export function LabelAt({ px, text, concept, anchor = 'ne', gap = 8, focusable, term, extra }: Omit<LabelProps, 'at'> & { px: Vec2; extra?: ComponentChildren }) {
  const ctx = useStageContext();
  const ref = useRef<HTMLSpanElement>(null);
  const size = useRef<{ w: number; h: number; key: string } | null>(null);
  const rc = useConcept(concept);
  const W = ctx?.scale.width ?? 0;
  const H = ctx?.scale.height ?? 0;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let sz = size.current;
    if (!sz || sz.key !== text || sz.w === 0 || !fontsSettled()) {
      sz = { w: el.offsetWidth, h: el.offsetHeight, key: text };
      size.current = sz;
    }
    const [x, y] = anchorBox(px, anchor, sz.w, sz.h, gap);
    const [cxp, cyp] = clampToPlate(x, y, sz.w, sz.h, W, H);
    el.style.transform = `translate(${r2(cxp)}px, ${r2(cyp)}px)`;
  });
  if (!ctx?.overlay) return null;
  const tab = focusable ?? !!(concept || term);
  return (
    <Portal into={ctx.overlay}>
      <span ref={ref} class={cx('stage2d__label', rc.className)} tabIndex={tab ? 0 : undefined} data-term={term}>
        {text && <RichText inline text={text} />}
        {extra}
      </span>
    </Portal>
  );
}

// ── CanvasLayer ─────────────────────────────────────────────────────────────

export interface CanvasLayerProps {
  /** Draw in CSS pixels (the context is already scaled for the device pixel ratio and cleared). Signals read here trigger a redraw (≤ 1 per frame). */
  draw: (ctx: CanvasRenderingContext2D, api: StageApi) => void;
}

/** Heavy content on a canvas between the static and dynamic SVG layers. */
export function CanvasLayer({ draw }: CanvasLayerProps) {
  useRenderCount();
  const ctx = useStageContext();
  const layer = useLayer();
  const theme = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);
  const host = ctx ? (layer === 'static' ? ctx.canvasStatic : ctx.canvasDynamic) : null;
  const scale = ctx?.scale;
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !scale) return;
    const c2 = fitCanvas(canvas, scale.width, scale.height);
    if (!c2) return;
    const paint = () => {
      c2.clearRect(0, 0, scale.width, scale.height);
      draw(c2, scale);
    };
    if (layer === 'static') {
      untracked(paint);
      return;
    }
    return frameEffect(paint);
  }, [scale, draw, layer, theme, host]);
  if (!host) return null;
  return (
    <Portal into={host}>
      <canvas ref={ref} class="plate__layer stage2d__canvas" aria-hidden="true" />
    </Portal>
  );
}

/** Group children under a concept (e.g. several marks that light together). */
export function ConceptGroup({ concept, children }: { concept: string; children: ComponentChildren }) {
  const rc = useConcept(concept);
  return <g class={rc.className}>{children}</g>;
}

export type { ReadonlySignal };
