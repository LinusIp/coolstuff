/**
 * Plot series → geometry, each series in its own `computed` (README §6.2,
 * "Reactivity"). A series whose functions read signals when called, or that
 * is given signals (`f`, `data`, `n`, `from`…), re-samples when one of them
 * changes, and only that series does; a series that reads none is sampled
 * once per scale. Pure apart from @preact/signals (works in Node; tested in
 * series.test.ts with a sample counter).
 */
import { computed, type ReadonlySignal } from '@preact/signals';
import { isSignalLike } from '../core/live';
import type { RiemannRule } from '../math/calculus';
import { contours, type ContourLevel } from '../math/contour';
import type { Vec2 } from '../math/vec';
import type { Rich } from '../types';
import { areaPolygons, autoRange, barRects, fieldArrows, gridValues, histogramBars, riemannShapes, sampleFunction, sampleParametric, uniformValues, type BarRect, type FieldArrow, type Fn1, type Fn2 } from './sampling';
import type { StageScale } from './scales';

export type { Fn1, Fn2 } from './sampling';
type MaybeSignal<T> = T | ReadonlySignal<T>;

interface SeriesBase {
  concept?: string;
  /**
   * Which layer draws the series. Default: 'dynamic' for series with functions
   * or signals (they may read signals and must be able to re-sample), 'static'
   * for plain data. Pass 'static' for a heavy series you know never changes.
   */
  layer?: 'static' | 'dynamic';
}

export type PlotSeries =
  | (SeriesBase & { kind: 'function'; f: MaybeSignal<Fn1>; label?: Rich })
  | (SeriesBase & { kind: 'parametric'; f: MaybeSignal<(t: number) => Vec2>; t: readonly [number, number]; label?: Rich })
  | (SeriesBase & { kind: 'points'; data: MaybeSignal<readonly Vec2[]>; label?: Rich })
  | (SeriesBase & { kind: 'line'; data: MaybeSignal<readonly Vec2[]>; label?: Rich })
  | (SeriesBase & { kind: 'histogram'; data: MaybeSignal<readonly number[]>; bins: number; range?: readonly [number, number]; density?: boolean })
  | (SeriesBase & { kind: 'bars'; values: MaybeSignal<readonly number[]>; labels?: readonly string[] })
  | (SeriesBase & { kind: 'field'; F: MaybeSignal<(x: number, y: number) => Vec2>; density?: number })
  | (SeriesBase & { kind: 'contour'; f: MaybeSignal<Fn2>; levels?: readonly number[] | number; resolution?: number; labels?: boolean; label?: Rich })
  | (SeriesBase & { kind: 'heat'; f: MaybeSignal<Fn2>; range?: readonly [number, number]; resolution?: number; scheme?: 'sequential' | 'diverging'; label?: Rich })
  | (SeriesBase & { kind: 'area'; f: Fn1; from: MaybeSignal<number>; to: MaybeSignal<number> })
  | (SeriesBase & { kind: 'riemann'; f: Fn1; a: number; b: number; n: MaybeSignal<number>; rule: MaybeSignal<RiemannRule> });

export type SeriesKind = PlotSeries['kind'];

/** What a series draws, in world coordinates. */
export type SeriesGeometry =
  | { kind: 'lines'; lines: Vec2[][] }
  | { kind: 'points'; points: readonly Vec2[] }
  | { kind: 'rects'; rects: BarRect[] }
  | { kind: 'polys'; polys: Vec2[][] }
  | { kind: 'arrows'; arrows: FieldArrow[] }
  | { kind: 'contours'; levels: ContourLevel[] }
  | { kind: 'grid'; values: Float64Array; nx: number; ny: number; min: number; max: number };

const read = <T>(v: MaybeSignal<T>): T => (isSignalLike(v) ? (v as ReadonlySignal<T>).value : (v as T));

/** True when any of the series' props is a signal. */
export function hasSignalProps(s: PlotSeries): boolean {
  return Object.values(s).some((v) => isSignalLike(v));
}

/** The layer a series is drawn on (see `SeriesBase.layer`). */
export function seriesLayer(s: PlotSeries): 'static' | 'dynamic' {
  if (s.layer) return s.layer;
  if (hasSignalProps(s)) return 'dynamic';
  return s.kind === 'points' || s.kind === 'line' || s.kind === 'histogram' || s.kind === 'bars' ? 'static' : 'dynamic';
}

/** Sample one series against a scale. Reading signals here subscribes the caller (a computed). */
export function sampleSeries(s: PlotSeries, scale: StageScale): SeriesGeometry {
  const { view } = scale;
  const opts = { pxX: scale.pxPerUnit, pxY: scale.pxPerUnitY, yView: view.y, n: Math.max(80, Math.min(420, Math.round(scale.width / 3))) };
  switch (s.kind) {
    case 'function':
      return { kind: 'lines', lines: sampleFunction(read(s.f), view.x[0], view.x[1], opts) };
    case 'parametric':
      return { kind: 'lines', lines: sampleParametric(read(s.f), s.t[0], s.t[1], { ...opts, n: 200 }) };
    case 'line':
      return { kind: 'lines', lines: [read(s.data).map((p) => [p[0], p[1]] as Vec2)] };
    case 'points':
      return { kind: 'points', points: read(s.data) };
    case 'histogram':
      return { kind: 'rects', rects: histogramBars(read(s.data), s.bins, s.range, s.density) };
    case 'bars':
      return { kind: 'rects', rects: barRects(read(s.values)) };
    case 'field': {
      const aspect = (view.y[1] - view.y[0]) * scale.pxPerUnitY / Math.max(1, (view.x[1] - view.x[0]) * scale.pxPerUnit);
      return { kind: 'arrows', arrows: fieldArrows(read(s.F), view, s.density ?? (scale.width < 520 ? 11 : 15), aspect) };
    }
    case 'contour':
      return { kind: 'contours', levels: contours(read(s.f), view, s.levels ?? 8, s.resolution ?? 64) };
    case 'heat': {
      const res = Math.max(4, Math.round(s.resolution ?? 72));
      const aspect = (view.y[1] - view.y[0]) * scale.pxPerUnitY / Math.max(1, (view.x[1] - view.x[0]) * scale.pxPerUnit);
      const nx = res;
      const ny = Math.max(4, Math.round(res * aspect));
      const g = gridValues(read(s.f), view, nx, ny);
      const [min, max] = s.range ?? [g.min, g.max];
      return { kind: 'grid', values: g.values, nx, ny, min, max };
    }
    case 'area':
      return { kind: 'polys', polys: areaPolygons(s.f, read(s.from), read(s.to), opts) };
    case 'riemann':
      return { kind: 'polys', polys: riemannShapes(s.f, s.a, s.b, read(s.n), read(s.rule)) };
  }
}

/**
 * A series' geometry as a computed signal: sampled on first read, re-sampled
 * only when a signal it read changes. `onSample` counts samplings (tests and
 * the gallery's dev counter).
 */
export function createSeriesSampler(s: PlotSeries, scale: StageScale, onSample?: () => void): ReadonlySignal<SeriesGeometry> {
  return computed(() => {
    onSample?.();
    return sampleSeries(s, scale);
  });
}

/**
 * Sample y values for an `auto` y-range (read untracked, once): functions on a
 * uniform grid across `x`, data as given, counts and bar heights with 0.
 * Domain kinds (field, contour, heat) contribute nothing: give them a y range.
 */
export function seriesYValues(s: PlotSeries, x: readonly [number, number]): number[] {
  const peek = <T>(v: MaybeSignal<T>): T => (isSignalLike(v) ? (v as ReadonlySignal<T>).peek() : (v as T));
  switch (s.kind) {
    case 'function':
      return uniformValues(peek(s.f), x[0], x[1]);
    case 'parametric': {
      const g = peek(s.f);
      const out: number[] = [];
      for (let i = 0; i <= 240; i++) {
        try {
          out.push(g(s.t[0] + ((s.t[1] - s.t[0]) * i) / 240)[1]);
        } catch {
          /* undefined point */
        }
      }
      return out;
    }
    case 'points':
    case 'line':
      return peek(s.data).map((p) => p[1]);
    case 'histogram':
      return [0, ...histogramBars(peek(s.data), s.bins, s.range, s.density).map((b) => b.y1)];
    case 'bars':
      return [0, ...peek(s.values)];
    case 'area':
    case 'riemann':
      return [0, ...uniformValues(s.f, x[0], x[1])];
    default:
      return [];
  }
}

/** The y-range for `y: 'auto'` from every series (pole spikes trimmed, infinities ignored). */
export function autoYRange(series: readonly PlotSeries[], x: readonly [number, number]): [number, number] {
  return autoRange(series.flatMap((s) => seriesYValues(s, x)));
}
