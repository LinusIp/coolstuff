/**
 * Stage2D: a coordinate plane with grid, axes, optional pan/zoom and
 * draggable handles (README §6.1, DESIGN.md §5–6).
 *
 * Layers, bottom to top, all filling the `.plate__stage`:
 *   static canvases · static SVG (grid, axes, ticks, `static` primitives;
 *   its own compositor layer, never touched during a drag) · dynamic
 *   canvases · dynamic SVG (children: focal pair, handles, overlays) · HTML
 *   overlay (labels, KaTeX).
 *
 * Pan and zoom are off by default and never steal page scroll: wheel zoom
 * needs ctrl/⌘ (a trackpad pinch sends that), one-finger drags on empty space
 * scroll the page on phones (two fingers pan and pinch), and a focused
 * pannable stage pans with arrows, zooms with + / −, resets with 0.
 */
import { signal, type Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useElementSize, usePhone } from '../core/hooks';
import { isSignalLike } from '../core/live';
import { IconRefresh } from '../core/icons';
import type { Rich, ViewBox } from '../types';
import { capturePointer, cx, LayerContext, StageContext, useRenderCount, useStageContext, type StageContextValue, type StageStats } from './context';
import { LabelAt } from './primitives';
import { axisLayout, clampZoomFactor, makeScale, panView, r2, sameView, zoomView } from './scales';

export interface Stage2DProps {
  /** World rectangle `{ x: [xmin, xmax], y: [ymin, ymax] }`; a signal is written by pan/zoom. */
  view: ViewBox | Signal<ViewBox>;
  /** SVG <title>: the stage's accessible name. */
  title: string;
  /** Height / width. Default `{ desktop: 0.62, phone: 0.94 }`. */
  aspect?: number | { desktop: number; phone: number };
  /** One unit is the same length on both axes (the view grows to fit). Default true. */
  equalScale?: boolean;
  /** Grid lines (nice steps from `niceStep`), or a fixed step. Default true. */
  grid?: boolean | { step?: number };
  /** Axes with tick labels (U+2212 minus) and optional axis names (Rich). Default true. */
  axes?: boolean | { x?: Rich; y?: Rich; ticks?: boolean | 'x' | 'y' };
  /** Drag empty space (mouse) or two fingers (touch) to pan. Default false. */
  pan?: boolean;
  /** ctrl/⌘-wheel, pinch and + / − keys; `{ min, max }` limits the zoom level (1 = the initial view). Default false. */
  zoom?: boolean | { min: number; max: number };
  /** First-touch note beside the first handle. Default "drag the ring"; false for none. */
  hint?: string | false;
  /** Primitives for the static layer (drawn once per resize; never repainted for a signal). */
  static?: ComponentChildren;
  /** Primitives for the dynamic layer. */
  children?: ComponentChildren;
  class?: string;
}

const DEFAULT_ASPECT = { desktop: 0.62, phone: 0.94 };
let stageSeq = 0;

export function Stage2D(props: Stage2DProps) {
  const { title, equalScale = true, grid = true, axes = true, pan = false, zoom = false, hint = 'drag the ring' } = props;
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [canvasStatic, setCanvasStatic] = useState<HTMLDivElement | null>(null);
  const [canvasDynamic, setCanvasDynamic] = useState<HTMLDivElement | null>(null);
  const size = useElementSize(el);
  const phone = usePhone();
  const aspect = typeof props.aspect === 'number' ? props.aspect : (props.aspect ?? DEFAULT_ASPECT)[phone ? 'phone' : 'desktop'];

  // View state: a bound signal (pan/zoom writes it) or an internal one that follows the prop.
  const viewIsSignal = isSignalLike(props.view);
  const internal = useMemo(() => signal<ViewBox>(viewIsSignal ? (props.view as Signal<ViewBox>).peek() : (props.view as ViewBox)), []);
  const viewSig = viewIsSignal ? (props.view as Signal<ViewBox>) : internal;
  const propView = viewIsSignal ? null : (props.view as ViewBox);
  const propKey = propView ? `${propView.x[0]},${propView.x[1]},${propView.y[0]},${propView.y[1]}` : '';
  const initial = useRef<ViewBox>(viewSig.peek());
  useLayoutEffect(() => {
    if (propView && !sameView(propView, internal.peek())) {
      internal.value = propView;
      initial.current = propView;
    }
  }, [propKey]);
  const base = viewSig.value;

  const W = Math.round(size.width);
  const H = Math.round(size.height);
  const ready = W > 0 && H > 0;
  const scale = useMemo(() => makeScale(base, W || 1, H || 1, equalScale), [base, W, H, equalScale]);

  // Context: per-stage state that survives re-renders.
  const stable = useMemo(() => {
    const stats: StageStats = { static: 0, dynamic: 0 };
    let queued = false;
    let host: HTMLElement | null = null;
    return {
      uid: `s2-${(++stageSeq).toString(36)}`,
      touched: signal(false),
      firstHandle: signal<string | null>(null),
      stats,
      setHost: (h: HTMLElement | null) => (host = h),
      report: () => {
        if (queued || typeof requestAnimationFrame !== 'function') return;
        queued = true;
        requestAnimationFrame(() => {
          queued = false;
          if (host) host.dataset.renders = `static:${stats.static} dynamic:${stats.dynamic}`;
        });
      },
    };
  }, []);
  stable.setHost(el);
  const ctx = useMemo<StageContextValue>(
    () => ({ scale, overlay, canvasStatic, canvasDynamic, touched: stable.touched, firstHandle: stable.firstHandle, hint, stats: stable.stats, report: stable.report, uid: stable.uid }),
    [scale, overlay, canvasStatic, canvasDynamic, hint, stable],
  );

  // ── Pan and zoom ──────────────────────────────────────────────────────────
  const pannable = pan || !!zoom;
  const zmin = typeof zoom === 'object' ? zoom.min : 0.25;
  const zmax = typeof zoom === 'object' ? zoom.max : 8;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const zoomBy = (factor: number, anchorPx?: [number, number]) => {
    const s = scaleRef.current;
    const cur = viewSig.peek();
    const f = clampZoomFactor(initial.current, cur, factor, zmin, zmax);
    if (Math.abs(f - 1) < 1e-9) return;
    const anchor = anchorPx ? s.toWorld(anchorPx) : undefined;
    viewSig.value = zoomView(cur, f, anchor);
  };
  const panBy = (dxPx: number, dyPx: number) => {
    const s = scaleRef.current;
    viewSig.value = panView(viewSig.peek(), -dxPx / s.pxPerUnit, dyPx / s.pxPerUnitY);
  };
  const reset = () => (viewSig.value = initial.current);

  // Touch on a handle must never scroll the page: `touch-action: none` on an
  // SVG <g> isn't honoured everywhere, so cancel the touch itself (pointer
  // events still flow). Everything else keeps native scrolling.
  useEffect(() => {
    if (!el) return;
    const guard = (e: TouchEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.fig-handle, [data-touch-capture]')) e.preventDefault();
    };
    el.addEventListener('touchstart', guard, { passive: false });
    el.addEventListener('touchmove', guard, { passive: false });
    return () => {
      el.removeEventListener('touchstart', guard);
      el.removeEventListener('touchmove', guard);
    };
  }, [el]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; d: number } | null>(null);
  useEffect(() => {
    if (!el || !pannable) return;
    const local = (e: PointerEvent | WheelEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left - el.clientLeft, e.clientY - r.top - el.clientTop];
    };
    const centroid = () => {
      const ps = [...pointers.current.values()];
      const x = ps.reduce((s, p) => s + p.x, 0) / ps.length;
      const y = ps.reduce((s, p) => s + p.y, 0) / ps.length;
      const d = ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0;
      return { x, y, d };
    };
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('.fig-handle, button, a, input')) return;
      if (e.pointerType === 'mouse' && (e.button !== 0 || !pan)) return;
      const [x, y] = local(e);
      pointers.current.set(e.pointerId, { x, y });
      // Touch: one finger scrolls the page; two fingers pan/pinch.
      if (e.pointerType !== 'mouse' && pointers.current.size < 2) return;
      capturePointer(el, e.pointerId);
      gesture.current = centroid();
      el.classList.add('is-panning');
    };
    const move = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      const [x, y] = local(e);
      pointers.current.set(e.pointerId, { x, y });
      const g = gesture.current;
      if (!g) return;
      const c = centroid();
      if (pan) panBy(c.x - g.x, c.y - g.y);
      if (zoom && g.d > 0 && c.d > 0) zoomBy(c.d / g.d, [c.x, c.y]);
      gesture.current = c;
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      gesture.current = pointers.current.size >= (e.pointerType === 'mouse' ? 1 : 2) ? centroid() : null;
      if (!gesture.current) el.classList.remove('is-panning');
    };
    const wheel = (e: WheelEvent) => {
      if (!zoom || !(e.ctrlKey || e.metaKey)) return; // plain wheel scrolls the page
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), local(e));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [el, pannable, pan, zoom]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!pannable || e.target !== e.currentTarget) return;
    const s = scaleRef.current;
    const k = e.key;
    let handled = true;
    if (pan && k === 'ArrowLeft') panBy(s.width / 10, 0);
    else if (pan && k === 'ArrowRight') panBy(-s.width / 10, 0);
    else if (pan && k === 'ArrowUp') panBy(0, s.height / 10);
    else if (pan && k === 'ArrowDown') panBy(0, -s.height / 10);
    else if (zoom && (k === '+' || k === '=')) zoomBy(1.25);
    else if (zoom && (k === '-' || k === '_' || k === '−')) zoomBy(1 / 1.25);
    else if (k === '0') reset();
    else handled = false;
    if (handled) e.preventDefault();
  };

  const moved = pannable && !sameView(base, initial.current, 1e-9);
  const titleId = `${stable.uid}-title`;
  const style = { aspectRatio: `1 / ${aspect}` };
  const keysHelp = [pan && 'arrows pan', zoom && '+ and − zoom', '0 resets'].filter(Boolean).join(', ');

  return (
    <>
      <div
        ref={setEl}
        class={cx('plate__stage stage2d', props.class, pannable && 'is-pannable')}
        style={style}
        tabIndex={pannable ? 0 : undefined}
        role={pannable ? 'group' : undefined}
        aria-label={pannable ? `${title}; use arrow keys to pan` : undefined}
        onKeyDown={pannable ? onKeyDown : undefined}
      >
        <div class="stage2d__canvases" ref={setCanvasStatic} aria-hidden="true" />
        {ready && (
          <svg class="plate__layer plate__layer--static" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
            <StageContext.Provider value={ctx}>
              <LayerContext.Provider value="static">
                <StaticPlane grid={grid} axes={axes} />
                {props.static}
              </LayerContext.Provider>
            </StageContext.Provider>
          </svg>
        )}
        <div class="stage2d__canvases" ref={setCanvasDynamic} aria-hidden="true" />
        <svg class="plate__layer stage2d__dynamic" viewBox={`0 0 ${W || 1} ${H || 1}`} role="group" aria-labelledby={titleId}>
          <title id={titleId}>{title}</title>
          {ready && (
            <StageContext.Provider value={ctx}>
              <LayerContext.Provider value="dynamic">{props.children}</LayerContext.Provider>
            </StageContext.Provider>
          )}
        </svg>
        <div class="stage2d__overlay" ref={setOverlay} />
        {moved && (
          <button type="button" class="icon-btn stage2d__reset" aria-label="Reset view" onClick={reset}>
            <IconRefresh />
          </button>
        )}
      </div>
      {pannable && (
        <p class="fig-keys stage2d__keys">
          {pan ? (phone ? 'Two fingers pan' : 'Drag empty space to pan') : ''}
          {zoom ? `${pan ? '; ' : ''}${phone ? 'pinch to zoom' : 'ctrl/⌘ + scroll to zoom'}` : ''}. Focused: {keysHelp}.
        </p>
      )}
    </>
  );
}

/** Grid, axes, ticks and axis names: the static plane. */
function StaticPlane({ grid, axes }: { grid: Stage2DProps['grid']; axes: Stage2DProps['axes'] }) {
  useRenderCount();
  const ctx = useStageContext();
  const s = ctx!.scale;
  const step = typeof grid === 'object' ? grid.step : undefined;
  const L = useMemo(() => axisLayout(s, { step }), [s, step]);
  const W = s.width;
  const H = s.height;
  const tk = typeof axes === 'object' ? axes.ticks : undefined;
  const showX = axes !== false && tk !== false && tk !== 'y';
  const showY = axes !== false && tk !== false && tk !== 'x';
  let gd = '';
  if (grid !== false) {
    for (const x of L.gridX) {
      const px = r2(s.toPx([x, 0])[0]);
      gd += `M${px} 0V${H}`;
    }
    for (const y of L.gridY) {
      const py = r2(s.toPx([0, y])[1]);
      gd += `M0 ${py}H${W}`;
    }
  }
  const xa = r2(L.xAxisPx);
  const ya = r2(L.yAxisPx);
  let td = '';
  if (showX) for (const t of L.xTicks) td += `M${r2(t.px)} ${xa - 3}V${xa + 3}`;
  if (showY) for (const t of L.yTicks) td += `M${ya - 3} ${r2(t.px)}H${ya + 3}`;
  const ax = typeof axes === 'object' ? axes : {};
  return (
    <g class="stage2d__plane">
      {gd && <path class="fig-grid" d={gd} />}
      {axes !== false && <path class="fig-axis" d={`M0 ${xa}H${W}M${ya} 0V${H}${td}`} />}
      {showX &&
        L.xTicks.map((t) => (
          <text key={`x${t.value}`} class="fig-tick" x={r2(t.px)} y={L.xLabelSide === 'below' ? xa + 16 : xa - 7} text-anchor="middle">
            {t.label}
          </text>
        ))}
      {showY &&
        L.yTicks.map((t) => (
          <text key={`y${t.value}`} class="fig-tick" x={L.yLabelSide === 'left' ? ya - 7 : ya + 7} y={r2(t.px) + 4} text-anchor={L.yLabelSide === 'left' ? 'end' : 'start'}>
            {t.label}
          </text>
        ))}
      {ax.x && <LabelAt px={[W - 6, xa]} text={ax.x} anchor={L.xLabelSide === 'below' ? 'nw' : 'sw'} gap={4} focusable={false} />}
      {ax.y && <LabelAt px={[ya, 6]} text={ax.y} anchor={L.yLabelSide === 'left' ? 'se' : 'sw'} gap={4} focusable={false} />}
    </g>
  );
}

export { useStage } from './context';
export type { StageApi } from './context';
