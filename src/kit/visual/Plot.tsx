/**
 * Plot: charts on Stage2D (README §6.2). Functions, parametric curves,
 * points, live series, histograms, bars, vector fields, contour maps, heat
 * maps, shaded areas and Riemann sums, plus a draggable, keyboard-operable
 * vertical cursor that stacked plots can share.
 *
 * Reactivity (binding): each series is sampled in its own `computed`
 * (series.ts), so a series whose functions read signals, or that is given
 * signals, re-samples on its own when they change; nothing else re-samples.
 */
import { untracked, type ReadonlySignal, type Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useMemo, useRef } from 'preact/hooks';
import { useTheme } from '../core/hooks';
import { isSignalLike } from '../core/live';
import { clearHighlight, highlight } from '../core/link';
import { fmt } from '../math/axes';
import type { Vec2 } from '../math/vec';
import { hue as hueHex, surface } from '../theme';
import type { Hue } from '../theme';
import type { Rich } from '../types';
import { capturePointer, cx, useConcept, useLayer, useRenderCount, useStageContext } from './context';
import { createFrameWriter } from './frame';
import { CanvasLayer, LabelAt, StrokePath } from './primitives';
import { heatPixels, rampLUT, rampStops, type RampScheme } from './ramp';
import { arrowGeometry, polylinePath, r2, simplifyPx } from './scales';
import { autoYRange, createSeriesSampler, seriesLayer, type PlotSeries, type SeriesGeometry } from './series';
import { Stage2D, type Stage2DProps } from './Stage2D';

export type { PlotSeries, Fn1, Fn2 } from './series';

export interface PlotProps {
  title: string;
  x: readonly [number, number];
  y: readonly [number, number] | 'auto';
  series: readonly PlotSeries[];
  xLabel?: Rich;
  yLabel?: Rich;
  /** A draggable vertical cursor at this x (linked plots share one signal). */
  cursor?: Signal<number>;
  /** Accessible name of the cursor. Default "the cursor". */
  cursorLabel?: string;
  /** Default false (true when a series is a field, contour or heat map of a 2D domain). */
  equalScale?: boolean;
  aspect?: Stage2DProps['aspect'];
  /** Default true, except under a heat map (the ramp is the background). */
  grid?: Stage2DProps['grid'];
  /** First-touch hint for a Handle among the children (default none on plots). */
  hint?: string | false;
  /** Extra primitives on top (Handle, Point, Label…). */
  children?: ComponentChildren;
  class?: string;
}

const DOMAIN_KINDS = new Set(['field', 'contour', 'heat']);

export function Plot(props: PlotProps) {
  const { title, x, series, xLabel, yLabel, cursor, children } = props;
  const yRange = useMemo<readonly [number, number]>(() => (props.y === 'auto' ? untracked(() => autoYRange(series, x)) : props.y), [props.y === 'auto' ? series : props.y, x[0], x[1]]);
  const view = useMemo(() => ({ x: [x[0], x[1]] as [number, number], y: [yRange[0], yRange[1]] as [number, number] }), [x[0], x[1], yRange[0], yRange[1]]);
  const equal = props.equalScale ?? series.some((s) => DOMAIN_KINDS.has(s.kind));
  const counts = useRef<number[]>([]);
  const labelled = series.some((s) => s.kind === 'bars' && s.labels?.length);
  const statics: ComponentChildren[] = [];
  const dynamics: ComponentChildren[] = [];
  series.forEach((s, i) => {
    const node = <SeriesView key={i} s={s} index={i} counts={counts.current} />;
    (seriesLayer(s) === 'static' ? statics : dynamics).push(node);
  });
  return (
    <Stage2D
      view={view}
      title={title}
      equalScale={equal}
      aspect={props.aspect}
      grid={props.grid ?? !series.some((s) => s.kind === 'heat')}
      axes={{ x: xLabel, y: yLabel, ticks: labelled ? 'y' : true }}
      hint={props.hint ?? false}
      class={cx('plot', props.class)}
      static={statics}
    >
      {dynamics}
      {children}
      {cursor && <PlotCursor cursor={cursor} x={x} series={series} label={props.cursorLabel ?? 'the cursor'} />}
    </Stage2D>
  );
}

// ── One series ──────────────────────────────────────────────────────────────

function SeriesView({ s, index, counts }: { s: PlotSeries; index: number; counts: number[] }) {
  useRenderCount();
  const ctx = useStageContext();
  const layer = useLayer();
  const scale = ctx!.scale;
  const sampler = useMemo(
    () =>
      createSeriesSampler(s, scale, () => {
        counts[index] = (counts[index] ?? 0) + 1;
        const host = ctx?.overlay?.parentElement;
        if (host) host.dataset.samples = counts.map((c, i) => `${i}:${c ?? 0}`).join(' ');
      }),
    [s, scale],
  );
  if (s.kind === 'heat') return <HeatView s={s} sampler={sampler} />;
  const geo = layer === 'static' ? untracked(() => sampler.value) : sampler.value;
  return <Geometry s={s} geo={geo} />;
}

const DOT = (x: number, y: number, r: number) => `M${r2(x - r)} ${r2(y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

function Geometry({ s, geo }: { s: PlotSeries; geo: SeriesGeometry }) {
  const ctx = useStageContext()!;
  const sc = ctx.scale;
  const rc = useConcept(s.concept);
  const H = sc.height;
  const px = (p: Readonly<Vec2>): Vec2 => {
    const q = sc.toPx(p);
    return [q[0], Math.max(-H, Math.min(2 * H, q[1]))];
  };
  const label = 'label' in s ? s.label : undefined;
  const w = 2.5;
  const style = { '--sw': `${w}px` } as Record<string, string>;
  switch (geo.kind) {
    case 'lines': {
      const runs = geo.lines.map((run) => (run.length > 300 ? simplifyPx(run.map(px), 0.5) : run.map(px)));
      const last = runs.length ? runs[runs.length - 1] : null;
      const end = last && last.length ? last[last.length - 1] : null;
      return (
        <>
          <g class={cx('s2-mark plot-series', rc.className)} style={style} stroke-width={w} data-series={s.kind}>
            <StrokePath d={polylinePath(runs)} line={rc.line} width={w} />
          </g>
          {label && end && <LabelAt px={end} text={label} concept={s.concept} anchor="nw" />}
        </>
      );
    }
    case 'points': {
      const r = geo.points.length > 400 ? 2 : 3.5;
      let d = '';
      for (const p of geo.points) {
        const q = sc.toPx(p);
        if (q[0] < -r || q[0] > sc.width + r || q[1] < -r || q[1] > H + r) continue;
        d += DOT(q[0], q[1], r);
      }
      return (
        <>
          <path class={cx('s2-mark plot-dots', rc.className)} d={d} data-series="points" />
          {label && geo.points.length > 0 && <LabelAt px={sc.toPx(geo.points[geo.points.length - 1])} text={label} concept={s.concept} anchor="ne" />}
        </>
      );
    }
    case 'rects': {
      let d = '';
      for (const b of geo.rects) {
        const [x0, y0] = sc.toPx([b.x0, b.y1]);
        const [x1, y1] = sc.toPx([b.x1, b.y0]);
        d += `M${r2(x0)} ${r2(y0)}H${r2(x1)}V${r2(y1)}H${r2(x0)}Z`;
      }
      const labels = s.kind === 'bars' ? s.labels : undefined;
      const base = sc.toPx([0, 0])[1];
      return (
        <g class={cx('s2-mark plot-bars', rc.className)} style={{ '--sw': '1.5px' } as Record<string, string>} stroke-width={1.5} data-series={s.kind}>
          <path class="s2-fill-wash plot-bars__fill" d={d} />
          <path class="fig-line" d={d} />
          {labels?.map((t, k) => (
            <text key={k} class="fig-tick" x={r2(sc.toPx([k, 0])[0])} y={r2(Math.min(H - 6, base + 16))} text-anchor="middle">
              {t}
            </text>
          ))}
        </g>
      );
    }
    case 'polys': {
      const d = polylinePath(geo.polys.map((q) => q.map(px)), true);
      const outline = s.kind === 'riemann';
      return (
        <g class={cx('s2-mark plot-area', rc.className)} style={{ '--sw': '1.5px' } as Record<string, string>} stroke-width={1.5} data-series={s.kind}>
          <path class="s2-fill-wash" d={d} />
          {outline && <StrokePath d={d} line={rc.line} width={1.5} />}
        </g>
      );
    }
    case 'arrows': {
      let shafts = '';
      let heads = '';
      for (const a of geo.arrows) {
        const p0 = sc.toPx([a.at[0] - a.v[0] / 2, a.at[1] - a.v[1] / 2]);
        const p1 = sc.toPx([a.at[0] + a.v[0] / 2, a.at[1] + a.v[1] / 2]);
        const g = arrowGeometry(p0, p1, 1.1);
        if (!g) continue;
        shafts += `M${r2(p0[0])} ${r2(p0[1])}L${r2(g.shaftEnd[0])} ${r2(g.shaftEnd[1])}`;
        heads += polylinePath([g.head], true);
      }
      return (
        <g class={cx('s2-mark plot-field', rc.className)} style={{ '--sw': '1.4px' } as Record<string, string>} stroke-width={1.4} data-series="field">
          <path class="fig-line" d={shafts} stroke-linecap="round" />
          <path class="fig-head s2-head" d={heads} />
        </g>
      );
    }
    case 'contours': {
      const showLabels = s.kind === 'contour' && s.labels;
      const lw = 1.6;
      return (
        <g class={cx('s2-mark plot-contours', rc.className)} style={{ '--sw': `${lw}px` } as Record<string, string>} stroke-width={lw} data-series="contour">
          {geo.levels.map((L) => (
            <StrokePath key={L.level} d={polylinePath(L.lines.map((ln) => ln.map(px)))} line={rc.line} width={lw} />
          ))}
          {showLabels &&
            geo.levels.map((L) => {
              const longest = L.lines.reduce<Vec2[] | null>((best, ln) => (!best || ln.length > best.length ? ln : best), null);
              if (!longest || longest.length < 4) return null;
              const p = px(longest[Math.floor(longest.length / 2)]);
              if (p[0] < 14 || p[0] > sc.width - 14 || p[1] < 10 || p[1] > H - 6) return null;
              return (
                <text key={`l${L.level}`} class="fig-note plot-contours__label" x={r2(p[0])} y={r2(p[1] + 4)} text-anchor="middle">
                  {fmt(L.level, 3)}
                </text>
              );
            })}
        </g>
      );
    }
    default:
      return null;
  }
}

// ── Heat map ────────────────────────────────────────────────────────────────

function useRamp(concept: string | undefined, scheme: RampScheme) {
  const theme = useTheme();
  const rc = useConcept(concept);
  return useMemo(() => {
    const plate = surface('plate', theme);
    const ink = rc.hue ? hueHex(rc.hue as Hue, theme) : surface('ink-2', theme);
    return scheme === 'diverging' ? rampLUT('diverging', surface('ink-3', theme), ink, plate) : rampLUT('sequential', plate, ink);
  }, [theme, rc.hue, scheme]);
}

function HeatView({ s, sampler }: { s: Extract<PlotSeries, { kind: 'heat' }>; sampler: ReadonlySignal<SeriesGeometry> }) {
  const ctx = useStageContext()!;
  const scheme = s.scheme ?? 'sequential';
  const lut = useRamp(s.concept, scheme);
  const layer = useLayer();
  const draw = useMemo(
    () => (c: CanvasRenderingContext2D, api: { width: number; height: number }) => {
      const g = sampler.value;
      if (g.kind !== 'grid') return;
      const img = new ImageData(heatPixels(g.values, g.nx, g.ny, g.min, g.max, lut, scheme) as Uint8ClampedArray<ArrayBuffer>, g.nx, g.ny);
      const off = document.createElement('canvas');
      off.width = g.nx;
      off.height = g.ny;
      off.getContext('2d')?.putImageData(img, 0, 0);
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.globalAlpha = 0.92;
      c.drawImage(off, 0, 0, api.width, api.height);
      c.globalAlpha = 1;
    },
    [sampler, lut, scheme],
  );
  const g = layer === 'static' ? untracked(() => sampler.value) : sampler.value;
  const stops = rampStops(lut, 5);
  return (
    <>
      <CanvasLayer draw={draw} />
      {g.kind === 'grid' && ctx.overlay && <HeatKey min={g.min} max={g.max} stops={stops} label={s.label} scheme={scheme} />}
    </>
  );
}

function HeatKey({ min, max, stops, label, scheme }: { min: number; max: number; stops: string[]; label?: Rich; scheme: RampScheme }) {
  const ctx = useStageContext()!;
  const lo = scheme === 'diverging' && min < 0 && max > 0 ? -Math.max(-min, max) : min;
  const hi = scheme === 'diverging' && min < 0 && max > 0 ? Math.max(-min, max) : max;
  const W = ctx.scale.width;
  return (
    <LabelAt
      px={[W - 8, 8]}
      anchor="sw"
      gap={0}
      focusable={false}
      text={`${label ? `${label} ` : ''}`}
      extra={
        <span class="plot-key" aria-hidden="true">
          <span class="plot-key__val">{fmt(lo, 2)}</span>
          <span class="plot-key__bar" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
          <span class="plot-key__val">{fmt(hi, 2)}</span>
        </span>
      }
    />
  );
}

// ── Cursor ──────────────────────────────────────────────────────────────────

let cursorSeq = 0;

function PlotCursor({ cursor, x, series, label }: { cursor: Signal<number>; x: readonly [number, number]; series: readonly PlotSeries[]; label: string }) {
  useRenderCount();
  const ctx = useStageContext()!;
  const sc = ctx.scale;
  const id = useMemo(() => `cursor-${(++cursorSeq).toString(36)}`, []);
  const writer = useMemo(() => createFrameWriter<number>((v) => (cursor.value = v)), [cursor]);
  const grab = useRef<{ rect: DOMRect; dx: number } | null>(null);
  const xv = cursor.value;
  const [lo, hi] = [Math.min(x[0], x[1]), Math.max(x[0], x[1])];
  const clampX = (v: number) => Math.min(hi, Math.max(lo, v));
  const px = r2(sc.toPx([xv, 0])[0]);
  const H = sc.height;
  const gy = H - 24;
  const step = (hi - lo) / 100;
  const decimals = Math.max(0, Math.min(4, -Math.floor(Math.log10(step)) + 1));
  const spoken = `x = ${fmt(xv, decimals).replace(/^−/, '−')}`;

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as SVGGElement;
    capturePointer(el, e.pointerId);
    const rect = (el.ownerSVGElement ?? el).getBoundingClientRect();
    grab.current = { rect, dx: e.clientX - rect.left - px };
    highlight({ term: id }, { source: id });
  };
  const move = (e: PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    writer.push(clampX(sc.toWorld([e.clientX - g.rect.left - g.dx, 0])[0]));
  };
  const up = () => {
    if (!grab.current) return;
    grab.current = null;
    writer.flush();
    clearHighlight(id);
  };
  const key = (e: KeyboardEvent) => {
    const big = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = xv + step * big;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = xv - step * big;
    else if (e.key === 'PageUp') next = xv + step * 10;
    else if (e.key === 'PageDown') next = xv - step * 10;
    else if (e.key === 'Home') next = lo;
    else if (e.key === 'End') next = hi;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    cursor.value = clampX(Number(next.toFixed(10)));
  };
  const handlers = { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onLostPointerCapture: up };
  return (
    <g class="plot-cursor" data-term={id}>
      <path class="plot-cursor__line" d={`M${px} 0V${H}`} />
      <rect class="plot-cursor__hit" x={px - 11} y={0} width={22} height={H} data-touch-capture {...handlers} />
      {series.map((s, i) => {
        if (s.kind !== 'function') return null;
        const f = isSignalLike(s.f) ? (s.f as ReadonlySignal<(x: number) => number>).value : (s.f as (x: number) => number);
        let y: number;
        try {
          y = f(xv);
        } catch {
          return null;
        }
        if (!Number.isFinite(y)) return null;
        const q = sc.toPx([xv, y]);
        if (q[1] < -4 || q[1] > H + 4) return null;
        return <CursorDot key={i} concept={s.concept} at={q} />;
      })}
      <g
        class="plot-cursor__grip"
        transform={`translate(${px} ${r2(gy)})`}
        role="slider"
        tabindex={0}
        aria-label={label}
        aria-valuenow={Math.round(xv * 1e4) / 1e4}
        aria-valuemin={lo}
        aria-valuemax={hi}
        aria-valuetext={spoken}
        aria-orientation="horizontal"
        data-touch-capture
        onKeyDown={key}
        {...handlers}
      >
        <rect class="plot-cursor__grip-hit" x={-22.5} y={-22.5} width={45} height={45} />
        <rect class="plot-cursor__grip-body" x={-11} y={-9} width={22} height={18} rx={4} />
        <path class="plot-cursor__grip-mark" d="M-4 -4L-7 0L-4 4M4 -4L7 0L4 4" />
        <rect class="plot-cursor__focus" x={-15} y={-13} width={30} height={26} rx={6} />
      </g>
    </g>
  );
}

function CursorDot({ concept, at }: { concept?: string; at: Vec2 }) {
  const rc = useConcept(concept);
  return <circle class={cx('s2-mark s2-point plot-cursor__dot', rc.className)} cx={r2(at[0])} cy={r2(at[1])} r={4} />;
}
