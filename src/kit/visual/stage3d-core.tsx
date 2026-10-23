/**
 * Stage3D's implementation (README §6.4). Lessons import the public entry
 * '@kit/visual/Stage3D' (Stage3D.tsx), so only 3D lessons pay for it. Only for genuinely 3D concepts: surfaces, fields,
 * rotations, 3×3 transforms.
 *
 * Renderer: canvas 2D with the kit's orbit camera (`orbitBasis`), no
 * three.js. Two passes: meshes (surfaces, planes, faces; painter-sorted,
 * cached offscreen while the camera and meshes stand still) and overlays
 * (points, paths, vectors, fields; depth-sorted on top). Primitives register
 * drawables; the scene redraws at most once per frame, reading the signals
 * the drawables read, so moving a ball or growing a path never rebuilds a
 * Surface mesh (built once per (f, x, y, resolution) and quality level).
 * QualityGovernor lowers mesh resolution while orbiting if frames drop.
 */
import { signal, type ReadonlySignal, type Signal } from '@preact/signals';
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useKit } from '../core/context';
import { useElementSize, useInView, usePhone, useReducedMotion, useTheme } from '../core/hooks';
import { IconRefresh } from '../core/icons';
import { isSignalLike } from '../core/live';
import { RichText } from '../core/RichText';
import { contours } from '../math/contour';
import { normalize3, cross3, type Vec3 } from '../math/vec';
import { HUES, surface, strokeFor, type ThemeName } from '../theme';
import type { Rich } from '../types';
import { fitCanvas } from '../util/dom';
import { QualityGovernor } from '../util/fps';
import { capturePointer, cx, resolveConcept, type MaybeSignal } from './context';
import { frameEffect } from './frame';
import { Portal } from './portal';
import { createGLRenderer, type GLMesh } from './stage3d-gl';
import { clampedDpr } from '../util/capabilities';
import { rampLUT } from './ramp';
import { arrowGeometry, clampToPlate } from './scales';
import { buildSurface, dashArray, DEFAULT_CAMERA, makeProjector, normalizer, painterOrder, resolutionAt, shade, surfaceGeometry, type Bounds3, type BoxMode, type Camera3, type Projector, type ScreenPoint, type SurfaceMesh } from './scene3d';

export { DEFAULT_CAMERA, type Bounds3, type Camera3, type BoxMode } from './scene3d';

export type V3 = Vec3 | ReadonlySignal<Vec3>;
export type V3s = readonly Vec3[] | ReadonlySignal<readonly Vec3[]>;

// ── Scene plumbing ──────────────────────────────────────────────────────────

export interface Palette {
  theme: ThemeName;
  plate: string;
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  axis: string;
  /** A concept's ink (or ink-2 without one; green for 'correct'). */
  color(concept?: string): string;
  line(concept?: string): ReturnType<typeof strokeFor> & { style: string };
}

/** A batch of depth-sorted things to draw: `draw(ctx, i)` paints item i. */
export interface Batch {
  count: number;
  depths: ArrayLike<number>;
  draw(ctx: CanvasRenderingContext2D, i: number): void;
}

export interface Drawable3D {
  pass: 'mesh' | 'over';
  /** Mesh drawables may offer WebGL geometry instead (surfaces); it is used when WebGL exists. Read signals here too. */
  gl?(pal: Palette): GLMesh | null;
  /** Read signals here (tracked); push batches (and label placements). Mesh drawables also return a key that changes when they need a redraw. */
  collect(P: Projector, pal: Palette, out: Batch[], labels: LabelPlacement[]): string | void;
}

export interface LabelPlacement {
  el: HTMLElement | null;
  at: ScreenPoint;
}

interface SceneContextValue {
  register(d: Drawable3D): () => void;
  quality: ReadonlySignal<number>;
  overlay: HTMLElement | null;
  handles: SVGSVGElement | null;
  /** Surface mesh builds (dev counter: the no-rebuild guarantee). */
  countBuild(): void;
  bounds: Bounds3;
  box: BoxMode;
  projector: () => Projector | null;
}

const SceneContext = createContext<SceneContextValue | null>(null);
const useScene = () => useContext(SceneContext);

const read = <T,>(v: MaybeSignal<T>): T => (isSignalLike(v) ? (v as ReadonlySignal<T>).value : (v as T));

/** Register a drawable for the lifetime of the component (its collect may change every render). */
function useDrawable(make: () => Drawable3D, deps: readonly unknown[]): void {
  const scene = useScene();
  const ref = useRef<Drawable3D | null>(null);
  ref.current = useMemo(make, deps);
  useLayoutEffect(() => {
    if (!scene) return;
    const proxy: Drawable3D = {
      pass: ref.current!.pass,
      collect: (P, pal, out, labels) => ref.current!.collect(P, pal, out, labels),
      gl: ref.current!.gl ? (pal) => ref.current!.gl?.(pal) ?? null : undefined,
    };
    return scene.register(proxy);
  }, [scene]);
}

// ── Stage3D ─────────────────────────────────────────────────────────────────

export interface Stage3DProps {
  title: string;
  bounds: Bounds3;
  /** Angles in degrees (default azimuth −60°, elevation 25°); a signal is written by orbiting. */
  camera?: Camera3 | Signal<Camera3>;
  /** Slow turn until the first interaction; never under reduced motion. */
  autoRotate?: boolean;
  axes?: boolean;
  grid?: boolean;
  /** Caption shown in the plate if 3D can't render. */
  fallback: Rich;
  /** 'equal' (default) or 'cube' (each axis the same length; for surfaces with a tall z range). */
  box?: BoxMode;
  aspect?: number | { desktop: number; phone: number };
  /** Axis names drawn at the positive ends (plain text). Default x, y, z. */
  axisNames?: { x?: string; y?: string; z?: string };
  /** Show the fallback caption instead of rendering (tests and screenshots of the fallback state). */
  forceFallback?: boolean;
  /** Draw surfaces with the canvas painter even when WebGL exists (tests). */
  noWebGL?: boolean;
  children?: ComponentChildren;
  class?: string;
}

const DEFAULT_ASPECT = { desktop: 0.62, phone: 0.94 };

function usePalette(): Palette {
  const theme = useTheme();
  const { concepts } = useKit();
  return useMemo(() => {
    const hues = HUES[theme];
    const color = (c?: string) => {
      if (!c) return surface('ink-2', theme);
      if (c === 'correct') return hues.green;
      const r = resolveConcept(c, concepts);
      return r.hue ? hues[r.hue as keyof typeof hues] : surface('ink-2', theme);
    };
    return {
      theme,
      plate: surface('plate', theme),
      ink: surface('ink', theme),
      ink2: surface('ink-2', theme),
      ink3: surface('ink-3', theme),
      grid: surface('grid', theme),
      axis: surface('axis', theme),
      color,
      line: (c?: string) => {
        const r = resolveConcept(c, concepts);
        return { ...strokeFor(r.line, 2), style: r.line };
      },
    };
  }, [theme, concepts]);
}

export function Stage3D(props: Stage3DProps) {
  const { title, bounds, axes = true, grid = true, fallback, box = 'equal', children } = props;
  const phone = usePhone();
  const reduced = useReducedMotion();
  const aspect = typeof props.aspect === 'number' ? props.aspect : (props.aspect ?? DEFAULT_ASPECT)[phone ? 'phone' : 'desktop'];
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [handles, setHandles] = useState<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const underRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(el);
  const inView = useInView(el, '0px');
  const [failedRender, setFailed] = useState(false);
  const failed = failedRender || !!props.forceFallback;
  const pal = usePalette();

  // Camera: bound signal or internal.
  const camIsSignal = isSignalLike(props.camera);
  const initialCam = useMemo<Camera3>(() => ({ ...DEFAULT_CAMERA, ...(camIsSignal ? (props.camera as Signal<Camera3>).peek() : (props.camera as Camera3 | undefined)) }), []);
  const internal = useMemo(() => signal<Camera3>(initialCam), []);
  const cam = camIsSignal ? (props.camera as Signal<Camera3>) : internal;

  // Scene state that survives renders.
  const st = useMemo(() => {
    const drawables = new Set<Drawable3D>();
    return {
      drawables,
      registry: signal(0),
      size: signal({ w: 0, h: 0 }),
      palette: signal<Palette | null>(null),
      quality: signal(3),
      builds: 0,
      interacted: signal(false),
      projector: null as Projector | null,
      governor: new QualityGovernor(3, 0, 3),
      lastDraw: 0,
    };
  }, []);
  st.palette.value = pal;

  const scene = useMemo<SceneContextValue>(
    () => ({
      register(d) {
        st.drawables.add(d);
        st.registry.value++;
        return () => {
          st.drawables.delete(d);
          st.registry.value++;
        };
      },
      quality: st.quality,
      overlay,
      handles,
      countBuild() {
        st.builds++;
      },
      bounds,
      box,
      projector: () => st.projector,
    }),
    [overlay, handles, bounds, box, el],
  );

  // Size the canvas.
  const W = Math.round(size.width);
  const H = Math.round(size.height);
  useLayoutEffect(() => {
    if (W > 0 && H > 0) st.size.value = { w: W, h: H };
  }, [W, H]);

  // The draw loop: one tracked effect, ≤ 1 run per frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    const underCanvas = underRef.current;
    const glCanvas = glRef.current;
    if (!canvas || !underCanvas || failed) return;
    // Surfaces go to WebGL when it exists (a 60×60 mesh is one indexed draw); else the canvas painter draws them.
    const glr = glCanvas && !props.noWebGL ? createGLRenderer(glCanvas) : null;
    if (glCanvas) glCanvas.hidden = !glr;
    // No MSAA (it costs ~25% on software GL); a 1.5× backing store smooths edges on 1× screens instead.
    const dpr = Math.min(2, Math.max(1.5, clampedDpr(2)));
    const off = document.createElement('canvas');
    let meshKey = '';
    let fitted = { w: 0, h: 0 };
    let ctx: CanvasRenderingContext2D | null = null;
    let octx: CanvasRenderingContext2D | null = null;
    let uctx: CanvasRenderingContext2D | null = null;
    const labelSizes = new WeakMap<HTMLElement, { w: number; h: number }>();
    const stop = frameEffect(() => {
      try {
        const sz = st.size.value;
        const p = st.palette.value;
        const c = cam.value;
        void st.registry.value; // subscribe to (un)registering drawables
        const q = st.quality.value;
        if (!sz.w || !sz.h || !p) return;
        if (sz.w !== fitted.w || sz.h !== fitted.h) {
          ctx = fitCanvas(canvas, sz.w, sz.h);
          octx = fitCanvas(off, sz.w, sz.h);
          uctx = fitCanvas(underCanvas, sz.w, sz.h);
          fitted = sz;
          meshKey = '';
          if (!ctx || !octx || !uctx) throw new Error('no 2D canvas');
        }
        if (!ctx || !octx || !uctx) return;
        // Frames in a continuous sequence (orbiting, playing) feed the governor.
        const now = performance.now();
        if (now - st.lastDraw < 1000) {
          const next = st.governor.tick(now);
          if (next !== null && next !== q) st.quality.value = next;
        }
        st.lastDraw = now;
        const P = makeProjector(bounds, c, sz.w, sz.h, box);
        st.projector = P;
        const meshes: Batch[] = [];
        const glMeshes: GLMesh[] = [];
        const overs: Batch[] = [];
        const labels: LabelPlacement[] = [];
        let key = `${c.azimuth}|${c.elevation}|${c.distance}|${c.zoom}|${sz.w}x${sz.h}|${p.theme}|${q}`;
        for (const d of st.drawables) {
          if (d.pass === 'mesh' && glr && d.gl) {
            const g = d.gl(p);
            if (g) {
              glMeshes.push(g);
              key += `|gl${meshId(g)}`;
            }
          } else if (d.pass === 'mesh') key += `|${d.collect(P, p, meshes, labels) ?? ''}`;
          else d.collect(P, p, overs, labels);
        }
        if (key !== meshKey) {
          meshKey = key;
          uctx.clearRect(0, 0, sz.w, sz.h);
          if (grid) drawFloor(uctx, P, bounds, p);
          if (axes) drawAxes(uctx, P, bounds, p, props.axisNames);
          // The governor also shrinks the GL backing store: on slow GPUs fill and compositing, not vertices, cost the time.
          if (glr) glr.draw(glMeshes, P, dpr * [0.55, 0.7, 0.85, 1][q]);
          octx.clearRect(0, 0, sz.w, sz.h);
          drawBatches(octx, meshes);
        }
        ctx.clearRect(0, 0, sz.w, sz.h);
        if (meshes.length) ctx.drawImage(off, 0, 0, sz.w, sz.h);
        drawBatches(ctx, overs);
        for (const l of labels) placeLabel(l, sz.w, sz.h, labelSizes);
        const host = canvas.parentElement;
        if (host) {
          if (host.dataset.builds !== String(st.builds)) host.dataset.builds = String(st.builds);
          host.dataset.renderer = glr ? 'webgl' : 'canvas';
          host.dataset.camera = `${Math.round(c.azimuth * 100) / 100} ${Math.round(c.elevation * 100) / 100} ${Math.round((c.zoom ?? 1) * 1000) / 1000}`;
        }
      } catch (err) {
        console.warn('Stage3D: falling back to the caption', err);
        setFailed(true);
      }
    });
    return () => {
      stop();
      glr?.dispose();
    };
  }, [failed, bounds, box, grid, axes, cam, props.noWebGL]);

  // Back to full detail once the scene has been still for a moment.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (st.quality.peek() < 3 && performance.now() - st.lastDraw > 500) {
        st.governor = new QualityGovernor(3, 0, 3);
        st.quality.value = 3;
      }
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  // Auto-rotate: never under reduced motion, off-screen, or after the first interaction.
  useEffect(() => {
    if (!props.autoRotate || reduced || !inView || st.interacted.value) return;
    let raf = 0;
    let last = performance.now();
    const spin = (now: number) => {
      if (st.interacted.peek()) return;
      const dt = Math.min(64, now - last);
      last = now;
      cam.value = { ...cam.peek(), azimuth: cam.peek().azimuth + dt * 0.012 };
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(raf);
  }, [props.autoRotate, reduced, inView, st.interacted.value]);

  // ── Orbit by pointer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!el) return;
    // A touch on a handle never scrolls the page (see Stage2D).
    const guard = (e: TouchEvent) => {
      if ((e.target as Element | null)?.closest?.('.fig-handle')) e.preventDefault();
    };
    el.addEventListener('touchstart', guard, { passive: false });
    el.addEventListener('touchmove', guard, { passive: false });
    return () => {
      el.removeEventListener('touchstart', guard);
      el.removeEventListener('touchmove', guard);
    };
  }, [el]);
  useEffect(() => {
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let last: { x: number; y: number; d: number } | null = null;
    const centroid = () => {
      const ps = [...pts.values()];
      const x = ps.reduce((s, p) => s + p.x, 0) / ps.length;
      const y = ps.reduce((s, p) => s + p.y, 0) / ps.length;
      return { x, y, d: ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0 };
    };
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('button, .fig-handle')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      capturePointer(el, e.pointerId);
      last = centroid();
      st.interacted.value = true;
      el.classList.add('is-orbiting');
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId) || !last) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = centroid();
      const cur = cam.peek();
      let next: Camera3 = cur;
      if (pts.size === 1) {
        // One finger on touch: the browser keeps vertical pans (page scroll), we get the horizontal ones.
        const dy = e.pointerType === 'mouse' ? c.y - last.y : 0;
        next = { ...cur, azimuth: cur.azimuth - (c.x - last.x) * 0.45, elevation: clampEl(cur.elevation + dy * 0.45) };
      } else {
        next = { ...cur, elevation: clampEl(cur.elevation + (c.y - last.y) * 0.45), zoom: clampZoom((cur.zoom ?? 1) * (last.d > 0 && c.d > 0 ? c.d / last.d : 1)) };
      }
      cam.value = next;
      last = c;
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      last = pts.size ? centroid() : null;
      if (!pts.size) el.classList.remove('is-orbiting');
    };
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const cur = cam.peek();
      cam.value = { ...cur, zoom: clampZoom((cur.zoom ?? 1) * Math.exp(-e.deltaY * 0.0025)) };
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
  }, [el, cam]);

  const reset = () => {
    st.interacted.value = true;
    cam.value = initialCam;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const big = e.shiftKey ? 3 : 1;
    const cur = cam.peek();
    let next: Camera3 | null = null;
    if (e.key === 'ArrowLeft') next = { ...cur, azimuth: cur.azimuth + 5 * big };
    else if (e.key === 'ArrowRight') next = { ...cur, azimuth: cur.azimuth - 5 * big };
    else if (e.key === 'ArrowUp') next = { ...cur, elevation: clampEl(cur.elevation + 5 * big) };
    else if (e.key === 'ArrowDown') next = { ...cur, elevation: clampEl(cur.elevation - 5 * big) };
    else if (e.key === '+' || e.key === '=') next = { ...cur, zoom: clampZoom((cur.zoom ?? 1) * 1.2) };
    else if (e.key === '-' || e.key === '_') next = { ...cur, zoom: clampZoom((cur.zoom ?? 1) / 1.2) };
    else if (e.key === '0' || e.key === 'Home') next = initialCam;
    if (!next) return;
    e.preventDefault();
    st.interacted.value = true;
    cam.value = next;
  };

  return (
    <>
      <div
        ref={setEl}
        class={cx('plate__stage stage3d', props.class, failed && 'is-failed')}
        style={{ aspectRatio: `1 / ${aspect}` }}
        tabIndex={failed ? undefined : 0}
        role="group"
        aria-roledescription="3D view"
        aria-label={`${title}. Drag or use the arrow keys to turn it; + and − zoom; 0 resets.`}
        onKeyDown={onKey}
      >
        {!failed && <canvas ref={underRef} class="plate__layer stage3d__canvas" aria-hidden="true" />}
        {!failed && <canvas ref={glRef} class="plate__layer stage3d__canvas stage3d__gl" aria-hidden="true" />}
        {!failed && <canvas ref={canvasRef} class="plate__layer stage3d__canvas" aria-hidden="true" />}
        <svg ref={setHandles} class="plate__layer stage3d__handles" aria-hidden={failed ? 'true' : undefined} />
        <div ref={setOverlay} class="stage3d__overlay" aria-hidden="true" />
        {failed && <RichText class="stage3d__fallback" text={fallback} />}
        {!failed && (
          <button type="button" class="icon-btn stage3d__reset" aria-label="Reset view" onClick={reset}>
            <IconRefresh />
          </button>
        )}
        <SceneContext.Provider value={scene}>{children}</SceneContext.Provider>
      </div>
    </>
  );
}

const meshIds = new WeakMap<object, number>();
let meshSeq = 0;
/** A stable id per geometry object (a rebuilt mesh gets a new one). */
function meshId(g: object): number {
  let id = meshIds.get(g);
  if (id === undefined) meshIds.set(g, (id = ++meshSeq));
  return id;
}

const clampEl = (e: number) => Math.max(-85, Math.min(85, e));
const clampZoom = (z: number) => Math.max(0.5, Math.min(4, z));

// ── Painting ────────────────────────────────────────────────────────────────

function drawBatches(ctx: CanvasRenderingContext2D, batches: Batch[]): void {
  let n = 0;
  for (const b of batches) n += b.count;
  if (!n) return;
  const depth = new Float64Array(n);
  const which = new Uint32Array(n);
  const sub = new Uint32Array(n);
  let k = 0;
  batches.forEach((b, bi) => {
    for (let i = 0; i < b.count; i++, k++) {
      depth[k] = b.depths[i];
      which[k] = bi;
      sub[k] = i;
    }
  });
  const order = painterOrder(depth);
  for (let o = 0; o < order.length; o++) {
    const k2 = order[o];
    batches[which[k2]].draw(ctx, sub[k2]);
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, P: Projector, b: Bounds3, p: Palette): void {
  const z = b.z[0];
  const step = niceStep3((b.x[1] - b.x[0]) / 6);
  ctx.save();
  ctx.strokeStyle = p.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = Math.ceil(b.x[0] / step) * step; x <= b.x[1] + 1e-9; x += step) seg(ctx, P.project([x, b.y[0], z]), P.project([x, b.y[1], z]));
  for (let y = Math.ceil(b.y[0] / step) * step; y <= b.y[1] + 1e-9; y += step) seg(ctx, P.project([b.x[0], y, z]), P.project([b.x[1], y, z]));
  ctx.stroke();
  ctx.restore();
}

function drawAxes(ctx: CanvasRenderingContext2D, P: Projector, b: Bounds3, p: Palette, names?: { x?: string; y?: string; z?: string }): void {
  const o: Vec3 = [clampIn(0, b.x), clampIn(0, b.y), clampIn(0, b.z)];
  const ends: [Vec3, Vec3, string][] = [
    [[b.x[0], o[1], o[2]], [b.x[1], o[1], o[2]], names?.x ?? 'x'],
    [[o[0], b.y[0], o[2]], [o[0], b.y[1], o[2]], names?.y ?? 'y'],
    [[o[0], o[1], b.z[0]], [o[0], o[1], b.z[1]], names?.z ?? 'z'],
  ];
  ctx.save();
  ctx.strokeStyle = p.axis;
  ctx.lineWidth = 1.25;
  ctx.fillStyle = p.ink3;
  ctx.font = 'italic 15px "Source Serif 4 Variable", "Source Serif 4", Georgia, serif';
  for (const [a, e, name] of ends) {
    const sa = P.project(a);
    const se = P.project(e);
    ctx.beginPath();
    seg(ctx, sa, se);
    ctx.stroke();
    const g = arrowGeometry([sa.x, sa.y], [se.x, se.y], 1.25);
    if (g) {
      ctx.beginPath();
      g.head.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
      ctx.closePath();
      ctx.fillStyle = p.axis;
      ctx.fill();
    }
    const dx = se.x - sa.x;
    const dy = se.y - sa.y;
    const L = Math.hypot(dx, dy) || 1;
    ctx.fillStyle = p.ink2;
    ctx.fillText(name, se.x + (dx / L) * 10 - 4, se.y + (dy / L) * 10 + 5);
  }
  ctx.restore();
}

const clampIn = (v: number, r: readonly [number, number]) => Math.min(r[1], Math.max(r[0], v));
function niceStep3(rough: number): number {
  const e = Math.floor(Math.log10(rough));
  const f = rough / 10 ** e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * 10 ** e;
}
const seg = (ctx: CanvasRenderingContext2D, a: ScreenPoint, b: ScreenPoint) => {
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
};

function placeLabel(l: LabelPlacement, W: number, H: number, sizes: WeakMap<HTMLElement, { w: number; h: number }>): void {
  const el = l.el;
  if (!el) return;
  let s = sizes.get(el);
  if (!s || s.w === 0) {
    s = { w: el.offsetWidth, h: el.offsetHeight };
    sizes.set(el, s);
  }
  const [x, y] = clampToPlate(l.at.x + 10, l.at.y - s.h - 6, s.w, s.h, W, H);
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

/** Stroke a screen path in a concept's line style. */
function strokeStyled(ctx: CanvasRenderingContext2D, color: string, width: number, line: Palette['line'] extends (c?: string) => infer R ? R : never, plate: string, path: () => void): void {
  const s = strokeFor(line.style as never, width);
  ctx.lineCap = s.linecap;
  ctx.lineJoin = 'round';
  if (s.double) {
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * 1.45;
    ctx.beginPath();
    path();
    ctx.stroke();
    ctx.strokeStyle = plate;
    ctx.lineWidth = width * 0.52;
    ctx.beginPath();
    path();
    ctx.stroke();
    return;
  }
  ctx.setLineDash(dashArray(s.dasharray));
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  path();
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** A label element in the 3D overlay (positioned by the draw loop). */
function useLabel3D(text: Rich | undefined, concept?: string): [ComponentChildren, () => HTMLElement | null] {
  const scene = useScene();
  const ref = useRef<HTMLSpanElement>(null);
  const node =
    text && scene?.overlay ? (
      <Portal into={scene.overlay}>
        <span ref={ref} class={cx('stage2d__label stage3d__label', concept && `ct ct-${concept}`)}>
          <RichText inline text={text} />
        </span>
      </Portal>
    ) : null;
  return [node, () => ref.current];
}

// ── Primitives ──────────────────────────────────────────────────────────────

export interface SurfaceProps {
  f: (x: number, y: number) => number;
  x: readonly [number, number];
  y: readonly [number, number];
  /** Cells per axis at full quality. Default 40. */
  resolution?: number;
  concept?: string;
  /** Contour lines drawn on the surface. */
  contours?: boolean;
  /** 'height' (ramp from the plate to the concept's ink) or 'concept' (flat ink, shaded). Default 'height'. */
  colorBy?: 'height' | 'concept';
  opacity?: number;
}

/** z = f(x, y) as a shaded mesh. Built once per (f, x, y, resolution, quality): keep `f` stable. */
export function Surface({ f, x, y, resolution = 40, concept, contours: withContours, colorBy = 'height', opacity = 1 }: SurfaceProps) {
  const scene = useScene();
  const q = scene?.quality.value ?? 3;
  const res = resolutionAt(resolution, q);
  const mesh = useMemo(() => {
    if (!scene) return null;
    scene.countBuild();
    return buildSurface(f, x, y, res, res, normalizer(scene.bounds, scene.box));
  }, [f, x[0], x[1], y[0], y[1], res, scene?.bounds, scene?.box]);
  const lines = useMemo(() => {
    if (!withContours || !scene) return null;
    const n = normalizer(scene.bounds, scene.box);
    return contours(f, { x, y }, 9, Math.max(24, res)).map((L) => L.lines.map((ln) => ln.map((p) => n.to([p[0], p[1], L.level + (scene.bounds.z[1] - scene.bounds.z[0]) * 0.004]))));
  }, [f, x[0], x[1], y[0], y[1], res, withContours, scene?.bounds, scene?.box]);
  const glCache = useRef<{ key: string; g: GLMesh } | null>(null);
  useDrawable(
    () => ({
      pass: 'mesh',
      collect(P, pal, out) {
        if (!mesh) return 'none';
        out.push(surfaceBatch(mesh, P, pal, concept, colorBy, opacity));
        if (lines) out.push(contourBatch(lines, P, pal, concept));
        return `${res}|${concept}|${colorBy}|${opacity}|${mesh.nx}`;
      },
      gl(pal) {
        if (!mesh) return null;
        const key = `${pal.theme}|${pal.plate}|${concept}|${colorBy}|${opacity}`;
        if (glCache.current && glCache.current.key === key) return glCache.current.g;
        const ink = pal.color(concept);
        const base = parseRgb(ink);
        const dark = pal.theme === 'dark';
        const contourRgb = parseRgb(dark ? pal.ink : ink);
        const g = surfaceGeometry(mesh, {
          lut: colorBy === 'height' ? lutFor(pal.plate, ink) : undefined,
          base,
          opacity,
          wire: dark ? [0.93, 0.9, 0.85, 0.16] : [0.12, 0.1, 0.09, 0.16],
          contours: lines ?? undefined,
          contourColor: [contourRgb[0] / 255, contourRgb[1] / 255, contourRgb[2] / 255, 0.8],
        });
        glCache.current = { key, g };
        return g;
      },
    }),
    [mesh, lines, concept, colorBy, opacity, res],
  );
  return null;
}

const lutCache = new Map<string, Uint8ClampedArray>();
function lutFor(plate: string, ink: string): Uint8ClampedArray {
  const k = `${plate}>${ink}`;
  let lut = lutCache.get(k);
  if (!lut) lutCache.set(k, (lut = rampLUT('sequential', plate, ink)));
  return lut;
}
function surfaceBatch(m: SurfaceMesh, P: Projector, pal: Palette, concept: string | undefined, colorBy: 'height' | 'concept', opacity: number): Batch {
  const nv = (m.nx + 1) * (m.ny + 1);
  const sx = new Float64Array(nv);
  const sy = new Float64Array(nv);
  const sd = new Float64Array(nv);
  for (let k = 0; k < nv; k++) {
    const p = P.projectN([m.pos[k * 3], m.pos[k * 3 + 1], m.pos[k * 3 + 2]]);
    sx[k] = p.x;
    sy[k] = p.y;
    sd[k] = p.depth;
  }
  const quads: number[] = [];
  const depths: number[] = [];
  for (let j = 0; j < m.ny; j++) {
    for (let i = 0; i < m.nx; i++) {
      const a = j * (m.nx + 1) + i;
      const d = (sd[a] + sd[a + 1] + sd[a + m.nx + 1] + sd[a + m.nx + 2]) / 4;
      if (!Number.isFinite(d)) continue;
      quads.push(j * m.nx + i);
      depths.push(d);
    }
  }
  const ink = pal.color(concept);
  const lut = lutFor(pal.plate, ink);
  const base = parseRgb(ink);
  const styles = new Map<number, string>();
  const every = Math.max(1, Math.round(m.nx / 10));
  const wire = pal.theme === 'dark' ? 'rgba(236,230,217,0.16)' : 'rgba(30,27,22,0.16)';
  return {
    count: quads.length,
    depths,
    draw(ctx, k) {
      const qd = quads[k];
      const i = qd % m.nx;
      const j = (qd - i) / m.nx;
      const a = j * (m.nx + 1) + i;
      const b = a + 1;
      const c = a + m.nx + 2;
      const d = a + m.nx + 1;
      const n: Vec3 = [m.normals[qd * 3], m.normals[qd * 3 + 1], m.normals[qd * 3 + 2]];
      const sh = Math.round(shade(n, P.light) * 31);
      const t = colorBy === 'height' ? Math.round((0.18 + 0.78 * m.height[qd]) * 63) : 63;
      const key = sh * 64 + t;
      let style = styles.get(key);
      if (!style) {
        const li = Math.round((t / 63) * 255) * 3;
        const rgb = colorBy === 'height' ? [lut![li], lut![li + 1], lut![li + 2]] : base;
        const f = sh / 31;
        style = `rgba(${Math.round(rgb[0] * f)},${Math.round(rgb[1] * f)},${Math.round(rgb[2] * f)},${opacity})`;
        styles.set(key, style);
      }
      ctx.beginPath();
      ctx.moveTo(sx[a], sy[a]);
      ctx.lineTo(sx[b], sy[b]);
      ctx.lineTo(sx[c], sy[c]);
      ctx.lineTo(sx[d], sy[d]);
      ctx.closePath();
      ctx.fillStyle = style;
      ctx.fill();
      ctx.strokeStyle = style;
      ctx.lineWidth = 0.6;
      ctx.stroke();
      if (i % every === 0 || j % every === 0) {
        ctx.beginPath();
        if (i % every === 0) {
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[d], sy[d]);
        }
        if (j % every === 0) {
          ctx.moveTo(sx[a], sy[a]);
          ctx.lineTo(sx[b], sy[b]);
        }
        ctx.strokeStyle = wire;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    },
  };
}

function contourBatch(lines: Vec3[][][], P: Projector, pal: Palette, concept?: string): Batch {
  const segs: [ScreenPoint, ScreenPoint][] = [];
  const depths: number[] = [];
  for (const level of lines)
    for (const ln of level)
      for (let k = 1; k < ln.length; k++) {
        const a = P.projectN(ln[k - 1]);
        const b = P.projectN(ln[k]);
        segs.push([a, b]);
        depths.push((a.depth + b.depth) / 2 + 0.02);
      }
  const color = pal.color(concept);
  return {
    count: segs.length,
    depths,
    draw(ctx, k) {
      ctx.beginPath();
      seg(ctx, segs[k][0], segs[k][1]);
      ctx.strokeStyle = pal.theme === 'dark' ? pal.ink : color;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
  };
}

function parseRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export interface Point3DProps {
  at: V3;
  concept?: string;
  /** Radius in px. Default 6. */
  r?: number;
  label?: Rich;
}

/** A dot (the GD ball). */
export function Point3D({ at, concept, r = 6, label }: Point3DProps) {
  const [labelNode, labelEl] = useLabel3D(label, concept);
  useDrawable(
    () => ({
      pass: 'over',
      collect(P, pal, out, labels) {
        const s = P.project(read(at));
        const color = pal.color(concept);
        out.push({
          count: 1,
          depths: [s.depth + 0.05],
          draw(ctx) {
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = pal.plate;
            ctx.stroke();
          },
        });
        if (label) labels.push({ el: labelEl(), at: s });
      },
    }),
    [at, concept, r, label],
  );
  return <>{labelNode}</>;
}

export interface Points3DProps {
  data: V3s;
  concept?: string;
  r?: number;
}

export function Points3D({ data, concept, r = 3.5 }: Points3DProps) {
  useDrawable(
    () => ({
      pass: 'over',
      collect(P, pal, out) {
        const pts = read(data).map((p) => P.project(p));
        const color = pal.color(concept);
        out.push({
          count: pts.length,
          depths: pts.map((s) => s.depth + 0.04),
          draw(ctx, i) {
            ctx.beginPath();
            ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
          },
        });
      },
    }),
    [data, concept, r],
  );
  return null;
}

export interface Polyline3DProps {
  points: V3s;
  concept?: string;
  closed?: boolean;
  /** Stroke width px. Default 2.5. */
  width?: number;
}

/** A path (the iterate path on a loss surface), drawn in the concept's line style. */
export function Polyline3D({ points, concept, closed, width = 2.5 }: Polyline3DProps) {
  useDrawable(
    () => ({
      pass: 'over',
      collect(P, pal, out) {
        const pts = read(points).map((p) => P.project(p));
        if (pts.length < 2) return;
        const color = pal.color(concept);
        const line = pal.line(concept);
        const depth = pts.reduce((s, q) => s + q.depth, 0) / pts.length + 0.03;
        out.push({
          count: 1,
          depths: [depth],
          draw(ctx) {
            strokeStyled(ctx, color, width, line, pal.plate, () => {
              pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
              if (closed) ctx.closePath();
            });
          },
        });
      },
    }),
    [points, concept, closed, width],
  );
  return null;
}

export interface Vector3DProps {
  from?: V3;
  to: V3;
  concept?: string;
  label?: Rich;
  width?: number;
}

/** An arrow in space; the head is drawn in screen space so it always reads. */
export function Vector3D({ from = [0, 0, 0], to, concept, label, width = 2.5 }: Vector3DProps) {
  const [labelNode, labelEl] = useLabel3D(label, concept);
  useDrawable(
    () => ({
      pass: 'over',
      collect(P, pal, out, labels) {
        const a = P.project(read(from));
        const b = P.project(read(to));
        const color = pal.color(concept);
        const line = pal.line(concept);
        const g = arrowGeometry([a.x, a.y], [b.x, b.y], width);
        out.push({
          count: 1,
          depths: [(a.depth + b.depth) / 2 + 0.06],
          draw(ctx) {
            if (!g) return;
            strokeStyled(ctx, color, width, line, pal.plate, () => {
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(g.shaftEnd[0], g.shaftEnd[1]);
            });
            ctx.beginPath();
            g.head.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
          },
        });
        if (label) labels.push({ el: labelEl(), at: b });
      },
    }),
    [from, to, concept, label, width],
  );
  return <>{labelNode}</>;
}

export interface Curve3DProps {
  f: (t: number) => Vec3;
  t: readonly [number, number];
  concept?: string;
  samples?: number;
}

export function Curve3D({ f, t, concept, samples = 200 }: Curve3DProps) {
  const pts = useMemo(() => {
    const out: Vec3[] = [];
    for (let i = 0; i <= samples; i++) {
      const p = f(t[0] + ((t[1] - t[0]) * i) / samples);
      if (p.every(Number.isFinite)) out.push(p);
    }
    return out;
  }, [f, t[0], t[1], samples]);
  return <Polyline3D points={pts} concept={concept} />;
}

export interface Plane3DProps {
  normal: V3;
  point: V3;
  concept?: string;
  /** Half-width of the drawn square, world units. Default: half the largest bounds span. */
  size?: number;
}

/** A translucent square of a plane (tangent planes, the eigen-plane of a 3×3 matrix). */
export function Plane3D({ normal, point, concept, size }: Plane3DProps) {
  const scene = useScene();
  useDrawable(
    () => ({
      pass: 'mesh',
      collect(P, pal, out) {
        const n = normalize3(read(normal));
        const c = read(point);
        const b = scene?.bounds;
        const half = size ?? (b ? Math.max(b.x[1] - b.x[0], b.y[1] - b.y[0], b.z[1] - b.z[0]) / 2 : 1);
        const t: Vec3 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        const u = normalize3(cross3(n, t));
        const w = cross3(n, u);
        const corners = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([p, q]) => P.project([c[0] + (u[0] * p + w[0] * q) * half, c[1] + (u[1] * p + w[1] * q) * half, c[2] + (u[2] * p + w[2] * q) * half]));
        const color = pal.color(concept);
        out.push({
          count: 1,
          depths: [corners.reduce((s, q) => s + q.depth, 0) / 4],
          draw(ctx) {
            ctx.beginPath();
            corners.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.closePath();
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 0.9;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.globalAlpha = 1;
          },
        });
        return `${n.join(',')}|${c.join(',')}|${half}|${concept}`;
      },
    }),
    [normal, point, concept, size, scene?.bounds],
  );
  return null;
}

export interface VectorField3DProps {
  F: (x: number, y: number, z: number) => Vec3;
  /** Arrows per axis. Default 5. */
  density?: number;
  concept?: string;
}

export function VectorField3D({ F, density = 5, concept }: VectorField3DProps) {
  const scene = useScene();
  const arrows = useMemo(() => {
    if (!scene) return [];
    const b = scene.bounds;
    const out: { at: Vec3; v: Vec3 }[] = [];
    let max = 0;
    const cell = Math.min(b.x[1] - b.x[0], b.y[1] - b.y[0], b.z[1] - b.z[0]) / density;
    for (let i = 0; i < density; i++)
      for (let j = 0; j < density; j++)
        for (let k = 0; k < density; k++) {
          const at: Vec3 = [b.x[0] + ((i + 0.5) * (b.x[1] - b.x[0])) / density, b.y[0] + ((j + 0.5) * (b.y[1] - b.y[0])) / density, b.z[0] + ((k + 0.5) * (b.z[1] - b.z[0])) / density];
          const v = F(at[0], at[1], at[2]);
          if (!v.every(Number.isFinite)) continue;
          max = Math.max(max, Math.hypot(v[0], v[1], v[2]));
          out.push({ at, v });
        }
    const s = max > 0 ? (cell * 0.8) / max : 0;
    return out.map(({ at, v }) => ({ at, v: [v[0] * s, v[1] * s, v[2] * s] as Vec3 }));
  }, [F, density, scene?.bounds]);
  useDrawable(
    () => ({
      pass: 'over',
      collect(P, pal, out) {
        const color = pal.color(concept);
        const proj = arrows.map(({ at, v }) => [P.project([at[0] - v[0] / 2, at[1] - v[1] / 2, at[2] - v[2] / 2]), P.project([at[0] + v[0] / 2, at[1] + v[1] / 2, at[2] + v[2] / 2])] as const);
        out.push({
          count: proj.length,
          depths: proj.map(([a, b]) => (a.depth + b.depth) / 2),
          draw(ctx, i) {
            const [a, b] = proj[i];
            const g = arrowGeometry([a.x, a.y], [b.x, b.y], 1.1);
            if (!g) return;
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(g.shaftEnd[0], g.shaftEnd[1]);
            ctx.stroke();
            ctx.beginPath();
            g.head.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
          },
        });
      },
    }),
    [arrows, concept],
  );
  return null;
}

// Internal pieces MatrixGrid3D builds on (not part of the public API).
export { useScene as useScene3D, useDrawable as useDrawable3D, strokeStyled as strokeStyled3D, useLabel3D };
