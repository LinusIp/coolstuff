/**
 * MatrixGrid3D (README §6.4): a 3×3 matrix acting on space. The transformed
 * integer lattice as context, î/ĵ/k̂, the unit cube mapped to a
 * parallelepiped with its signed volume, real eigen-directions as rose
 * double rules, input vectors with their images, and a 3×3 entries panel of
 * steppers. A negative determinant hatches the faces and says "orientation
 * flipped"; zero flattens it with "volume 0: space squashed onto a plane (or
 * line)". `editable: 'basis'` drags the column tips in the plane facing the
 * camera (keys: ← → x, ↑ ↓ y, PageUp/PageDown z).
 */
import { computed, useSignal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useMemo, useRef } from 'preact/hooks';
import { RichText } from '../core/RichText';
import { useKit } from '../core/context';
import { usePhone } from '../core/hooks';
import { clearHighlight, highlight } from '../core/link';
import { decimalsFor } from '../math/axes';
import { eig3 } from '../math/eig3';
import { apply3, det3, type Mat3 } from '../math/mat';
import type { Vec3 } from '../math/vec';
import { formatNumber } from '../notation';
import type { Rich } from '../types';
import { capturePointer, cx } from './context';
import { isWritableSignal } from './MatrixGrid';
import { Portal } from './portal';
import { columnOf3, displayMatrix3, ENTRY_NAMES_3, latticeLines3, parallelepipedFaces, volumeNote, withColumn3, type Bounds3, type Camera3 } from './scene3d';
import { Stage3D, strokeStyled3D, useDrawable3D, useScene3D, Vector3D, type Batch, type Palette } from './stage3d-core';

export interface MatrixGrid3DVector {
  value: Signal<Vec3> | ReadonlySignal<Vec3>;
  concept: string;
  label: string;
  tex?: string;
  image?: { concept: string; label: string; tex?: string };
}

export interface MatrixGrid3DProps {
  matrix: Signal<Mat3>;
  title: string;
  fallback: Rich;
  /** 'entries' (default): 3×3 steppers; 'basis': drag the î/ĵ/k̂ tips; 'both'; or false. */
  editable?: 'entries' | 'basis' | 'both' | false;
  /** Default 0.5. */
  snap?: number;
  morph?: ReadonlySignal<number>;
  /** Default { lattice: true, basis: true, unitCube: true, determinant: true, eigen: false }. */
  show?: { lattice?: boolean; basis?: boolean; unitCube?: boolean; determinant?: boolean; eigen?: boolean };
  vectors?: readonly MatrixGrid3DVector[];
  /** Defaults: basis in ink; the cube and lattice in the lesson's `matrix` concept and eigen lines in `eigenvalue` when defined. */
  concepts?: { i?: string; j?: string; k?: string; volume?: string; lattice?: string; eigen?: string };
  camera?: Camera3 | Signal<Camera3>;
  /** World box shown. Default [−2.5, 2.5]³. */
  bounds?: Bounds3;
  symbol?: string;
  aspect?: number | { desktop: number; phone: number };
}

const DEFAULT_BOUNDS: Bounds3 = { x: [-2.5, 2.5], y: [-2.5, 2.5], z: [-2.5, 2.5] };

/** A·v through the morph (3D), for readouts and Formula live values. */
export function imageOf3(matrix: ReadonlySignal<Mat3>, v: ReadonlySignal<Vec3>, morph?: ReadonlySignal<number>): ReadonlySignal<Vec3> {
  return computed(() => apply3(displayMatrix3(matrix.value, morph?.value), v.value));
}

export function MatrixGrid3D(props: MatrixGrid3DProps) {
  const { matrix, title, fallback, editable = 'entries', snap = 0.5, morph, vectors = [], bounds = DEFAULT_BOUNDS } = props;
  const show = { lattice: true, basis: true, unitCube: true, determinant: true, eigen: false, ...props.show };
  const { concepts } = useKit();
  const has = (n: string) => !!concepts?.names.includes(n);
  const cc = {
    i: props.concepts?.i,
    j: props.concepts?.j,
    k: props.concepts?.k,
    volume: props.concepts?.volume ?? (has('matrix') ? 'matrix' : undefined),
    lattice: props.concepts?.lattice ?? (has('matrix') ? 'matrix' : undefined),
    eigen: props.concepts?.eigen ?? (has('eigenvalue') ? 'eigenvalue' : undefined),
  };
  const shown = useMemo(() => computed(() => displayMatrix3(matrix.value, morph?.value)), [matrix, morph]);
  const cols = useMemo(() => [0, 1, 2].map((k) => computed(() => columnOf3(shown.value, k as 0 | 1 | 2))), [shown]);
  const images = useMemo(() => vectors.map((v) => (v.image ? imageOf3(matrix, v.value, morph) : null)), [vectors, matrix, morph]);
  const basisDrag = editable === 'basis' || editable === 'both';
  return (
    <div class="mxg mxg3">
      <Stage3D title={title} bounds={bounds} fallback={fallback} camera={props.camera} grid={false} aspect={props.aspect}>
        {show.lattice && <Lattice shown={shown} concept={cc.lattice} />}
        {show.unitCube && <Cube shown={shown} concept={cc.volume} />}
        {show.eigen && <EigenLines shown={shown} concept={cc.eigen} bounds={bounds} />}
        {show.basis && (
          <>
            <Vector3D to={cols[0]} concept={cc.i} label="$\ihat$" width={2} />
            <Vector3D to={cols[1]} concept={cc.j} label="$\jhat$" width={2} />
            <Vector3D to={cols[2]} concept={cc.k} label="$\khat$" width={2} />
          </>
        )}
        {vectors.map((v, k) => (
          <>
            {images[k] && v.image && <Vector3D key={`i${k}`} to={images[k]!} concept={v.image.concept} label={v.image.tex} />}
            <Vector3D key={`v${k}`} to={v.value} concept={v.concept} label={v.tex} />
          </>
        ))}
        {show.basis && basisDrag && [0, 1, 2].map((k) => <BasisHandle3D key={k} matrix={matrix} morph={morph} k={k as 0 | 1 | 2} snap={snap} concept={[cc.i, cc.j, cc.k][k]} />)}
        {vectors.map((v, k) => (isWritableSignal(v.value) ? <VectorHandle3D key={`h${k}`} value={v.value as Signal<Vec3>} label={v.label} concept={v.concept} /> : null))}
      </Stage3D>
      <Panel3 matrix={matrix} morph={morph} snap={snap} editable={editable === 'entries' || editable === 'both'} determinant={show.determinant} eigen={show.eigen} symbol={props.symbol ?? 'A'} />
    </div>
  );
}

// ── Scene pieces ────────────────────────────────────────────────────────────

function Lattice({ shown, concept }: { shown: ReadonlySignal<Mat3>; concept?: string }) {
  useDrawable3D(
    () => ({
      pass: 'mesh',
      collect(P, pal, out) {
        const M = shown.value;
        const segs = latticeLines3(M, 2).map(([a, b]) => [P.project(a), P.project(b)] as const);
        const color = pal.color(concept);
        out.push({
          count: segs.length,
          depths: segs.map(([a, b]) => (a.depth + b.depth) / 2),
          draw(ctx, i) {
            const [a, b] = segs[i];
            ctx.globalAlpha = 0.26;
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
          },
        });
        return `lattice|${M.join(',')}|${concept}`;
      },
    }),
    [shown, concept],
  );
  return null;
}

const hatchCache = new Map<string, CanvasPattern | null>();
function hatchPattern(ctx: CanvasRenderingContext2D, color: string): CanvasPattern | null {
  if (hatchCache.has(color)) return hatchCache.get(color)!;
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 8;
  const g = c.getContext('2d');
  if (!g) return null;
  g.strokeStyle = color;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-2, 10);
  g.lineTo(10, -2);
  g.stroke();
  const p = ctx.createPattern(c, 'repeat');
  hatchCache.set(color, p);
  return p;
}

function Cube({ shown, concept }: { shown: ReadonlySignal<Mat3>; concept?: string }) {
  useDrawable3D(
    () => ({
      pass: 'mesh',
      collect(P, pal, out) {
        const M = shown.value;
        const note = volumeNote(M);
        const faces = parallelepipedFaces(M).map((f) => f.map((p) => P.project(p)));
        const color = pal.color(concept);
        const line = pal.line(concept);
        out.push({
          count: faces.length,
          depths: faces.map((f) => f.reduce((s, q) => s + q.depth, 0) / 4),
          draw(ctx, i) {
            const f = faces[i];
            const path = () => {
              f.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
              ctx.closePath();
            };
            ctx.beginPath();
            path();
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
            if (note.flipped) {
              const pat = hatchPattern(ctx, color);
              if (pat) {
                ctx.globalAlpha = 0.55;
                ctx.fillStyle = pat;
                ctx.fill();
                ctx.globalAlpha = 1;
              }
            }
            strokeStyled3D(ctx, color, 1.6, line, pal.plate, path);
          },
        });
        return `cube|${M.join(',')}|${concept}`;
      },
    }),
    [shown, concept],
  );
  return null;
}

function EigenLines({ shown, concept, bounds }: { shown: ReadonlySignal<Mat3>; concept?: string; bounds: Bounds3 }) {
  useDrawable3D(
    () => ({
      pass: 'over',
      collect(P, pal: Palette, out: Batch[]) {
        const e = eig3(shown.value);
        if (e.everyDirection) return;
        const R = Math.max(bounds.x[1] - bounds.x[0], bounds.y[1] - bounds.y[0], bounds.z[1] - bounds.z[0]) * 0.55;
        const color = pal.color(concept);
        const lines = e.directions.map(({ dir }) => [P.project([-dir[0] * R, -dir[1] * R, -dir[2] * R]), P.project([dir[0] * R, dir[1] * R, dir[2] * R])] as const);
        out.push({
          count: lines.length,
          depths: lines.map(([a, b]) => (a.depth + b.depth) / 2 - 0.01),
          draw(ctx, i) {
            const [a, b] = lines[i];
            strokeStyled3D(ctx, color, 2.4, { ...pal.line(concept), style: 'double' }, pal.plate, () => {
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
            });
          },
        });
      },
    }),
    [shown, concept, bounds],
  );
  return null;
}

// ── Handles in 3D ───────────────────────────────────────────────────────────

let h3seq = 0;

function Handle3DView({ get, set, label, concept, snap, symbol }: { get: () => Vec3; set: (v: Vec3) => void; label: string; concept?: string; snap: number; symbol: string }) {
  const scene = useScene3D();
  const id = useMemo(() => `h3-${(++h3seq).toString(36)}`, []);
  const gRef = useRef<SVGGElement>(null);
  const drag = useRef<{ x: number; y: number; start: Vec3 } | null>(null);
  const q = (v: number) => (snap > 0 ? Number((Math.round(v / snap) * snap).toFixed(10)) + 0 : v);
  // Position (and spoken value) are written imperatively by the draw loop.
  useDrawable3D(
    () => ({
      pass: 'over',
      collect(P) {
        const v = get();
        const s = P.project(v);
        const el = gRef.current;
        if (el) {
          el.setAttribute('transform', `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)})`);
          el.setAttribute('aria-valuetext', `${symbol} = (${v.map((x) => formatNumber(x, 1)).join(', ')})`);
          el.setAttribute('aria-valuenow', String(v[0]));
        }
      },
    }),
    [get, symbol],
  );
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    capturePointer(e.currentTarget as SVGGElement, e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: get() };
    if (concept) highlight({ concept }, { source: id });
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    const P = scene?.projector();
    if (!d || !P) return;
    const w = P.screenDeltaToWorld(e.clientX - d.x, e.clientY - d.y);
    set([q(d.start[0] + w[0]), q(d.start[1] + w[1]), q(d.start[2] + w[2])]);
  };
  const up = () => {
    drag.current = null;
    clearHighlight(id);
  };
  const key = (e: KeyboardEvent) => {
    const step = (snap > 0 ? snap : 0.1) * (e.shiftKey ? 5 : 1);
    const d: Record<string, Vec3> = { ArrowRight: [step, 0, 0], ArrowLeft: [-step, 0, 0], ArrowUp: [0, step, 0], ArrowDown: [0, -step, 0], PageUp: [0, 0, step], PageDown: [0, 0, -step] };
    const dv = d[e.key];
    if (!dv) return;
    e.preventDefault();
    e.stopPropagation();
    const v = get();
    set([q(v[0] + dv[0]), q(v[1] + dv[1]), q(v[2] + dv[2])]);
  };
  if (!scene?.handles) return null;
  return (
    <Portal into={scene.handles}>
      <g class={cx('s2-handle', concept && `ct ct-${concept}`)}>
        <g
          ref={gRef}
          class="fig-handle"
          role="slider"
          tabindex={0}
          aria-label={label}
          aria-roledescription="draggable point in space"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
          onBlur={() => clearHighlight(id)}
        >
          <circle class="fig-handle__hit" r="22.5" />
          <circle class="fig-handle__ring" r="13" />
          <circle class="fig-handle__dot" r="5" />
          <circle class="fig-handle__focus" r="19" />
        </g>
      </g>
    </Portal>
  );
}

function BasisHandle3D({ matrix, morph, k, snap, concept }: { matrix: Signal<Mat3>; morph?: ReadonlySignal<number>; k: 0 | 1 | 2; snap: number; concept?: string }) {
  const get = useMemo(() => () => columnOf3(matrix.value, k), [matrix, k]);
  const set = useMemo(() => (v: Vec3) => (matrix.value = withColumn3(matrix.peek(), k, v)), [matrix, k]);
  if (morph && morph.value < 0.999) return null;
  const sym = ['î', 'ĵ', 'k̂'][k];
  return <Handle3DView get={get} set={set} label={`the tip of ${sym}, column ${k + 1}`} concept={concept} snap={snap} symbol={sym} />;
}

function VectorHandle3D({ value, label, concept }: { value: Signal<Vec3>; label: string; concept: string }) {
  const get = useMemo(() => () => value.value, [value]);
  const set = useMemo(() => (v: Vec3) => (value.value = v), [value]);
  return <Handle3DView get={get} set={set} label={label} concept={concept} snap={0.1} symbol="v" />;
}

// ── 3×3 entries panel ───────────────────────────────────────────────────────

function Panel3({ matrix, morph, snap, editable, determinant, eigen, symbol }: { matrix: Signal<Mat3>; morph?: ReadonlySignal<number>; snap: number; editable: boolean; determinant: boolean; eigen: boolean; symbol: string }) {
  const phone = usePhone();
  const selected = useSignal(0);
  const mid = morph !== undefined && morph.value < 0.999;
  const M = displayMatrix3(matrix.value, morph?.value);
  const dec = editable ? Math.max(1, decimalsFor(snap)) : 2;
  const note = volumeNote(M);
  const step = (i: number, d: number) => {
    const out = [...matrix.peek()] as Mat3;
    const raw = out[i] + d;
    out[i] = Number((snap > 0 ? Math.round(raw / snap) * snap : raw).toFixed(10)) + 0;
    matrix.value = out;
  };
  const keys = (i: number) => (ev: KeyboardEvent) => {
    const big = ev.shiftKey ? 5 : 1;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') step(i, snap * big);
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') step(i, -snap * big);
    else return;
    ev.preventDefault();
  };
  const e = eigen ? eig3(M) : null;
  const ed = editable && !mid;
  // On phones the 3×3 steppers don't fit: tap an entry, then step it with one shared − / + pair.
  const compact = ed && phone;
  const sel = selected.value;
  const spin = (x: number, i: number, children: ComponentChildren) => (
    <span
      class={cx('mxg__entry', compact && 'is-pick', compact && sel === i && 'is-selected')}
      role="spinbutton"
      tabIndex={0}
      aria-label={`entry in ${ENTRY_NAMES_3[i]}`}
      aria-valuenow={x}
      aria-valuetext={formatNumber(x, dec)}
      onKeyDown={keys(i)}
      onFocus={() => (selected.value = i)}
      onClick={() => (selected.value = i)}
    >
      {children}
    </span>
  );
  return (
    <div class={cx('readout mxg__panel', compact && 'is-compact')} aria-live="polite">
      <span class="mxg__name">
        <RichText inline text={`$${symbol}${mid ? '_t' : ''} =$`} />
      </span>
      <span class={cx('lv-vec lv-vec--mat mxg__mat', ed && 'is-editable')} style={{ '--cols': 3 } as Record<string, number>}>
        {M.map((x, i) =>
          ed && !compact ? (
            <span class="mxg__cell" key={i}>
              <button type="button" class="mxg__step" tabIndex={-1} data-hit aria-label={`decrease the entry in ${ENTRY_NAMES_3[i]}`} onClick={() => step(i, -snap)}>
                −
              </button>
              {spin(x, i, formatNumber(x, dec))}
              <button type="button" class="mxg__step" tabIndex={-1} data-hit aria-label={`increase the entry in ${ENTRY_NAMES_3[i]}`} onClick={() => step(i, snap)}>
                +
              </button>
            </span>
          ) : compact ? (
            <span key={i}>{spin(x, i, formatNumber(x, dec))}</span>
          ) : (
            <span class="mxg__entry" key={i}>
              {formatNumber(x, dec)}
            </span>
          ),
        )}
      </span>
      {compact && (
        <span class="mxg__editor">
          <button type="button" class="btn btn--sm mxg__edit-btn" aria-label={`decrease the entry in ${ENTRY_NAMES_3[sel]}`} onClick={() => step(sel, -snap)}>
            −
          </button>
          <span class="mxg__edit-name">{ENTRY_NAMES_3[sel]}</span>
          <button type="button" class="btn btn--sm mxg__edit-btn" aria-label={`increase the entry in ${ENTRY_NAMES_3[sel]}`} onClick={() => step(sel, snap)}>
            +
          </button>
        </span>
      )}
      {determinant && (
        <span class={cx('mxg__det', note.flipped && 'is-flipped', note.flat && 'is-flat')}>
          det = {formatNumber(det3(M), 2)} · {note.words}
        </span>
      )}
      {e && <span class="mxg__det">{e.everyDirection ? 'every direction is kept' : e.directions.length ? `${e.directions.length} real eigen-direction${e.directions.length === 1 ? '' : 's'} (rose)` : 'no real eigen-directions'}</span>}
    </div>
  );
}
