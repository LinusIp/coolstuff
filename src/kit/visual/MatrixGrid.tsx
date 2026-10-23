/**
 * MatrixGrid: a 2×2 matrix acting on the plane (README §6.3). The transformed
 * grid as context, î and ĵ (draggable tips that write the matrix), the unit
 * square with its signed area (hatched when orientation flips), eigen
 * directions when real, input vectors with their images A·v, and an entries
 * panel (steppers when editable). `morph` animates identity → matrix.
 *
 * Every piece that reads a signal is its own small component, so dragging a
 * vector re-renders that vector and its image, not the grid.
 */
import { computed, type ReadonlySignal, type Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { useKit } from '../core/context';
import { RichText } from '../core/RichText';
import { decimalsFor } from '../math/axes';
import { apply2, det2, type Mat2 } from '../math/mat';
import type { Vec2 } from '../math/vec';
import { formatNumber } from '../notation';
import type { ViewBox } from '../types';
import { cx, useRenderCount, useStage } from './context';
import { Handle } from './Handle';
import { columnOf, determinantNote, displayMatrix, eigenLines, ENTRY_NAMES, gridLines, gridReach, stepEntry, unitSquare, withColumn } from './matrixgrid';
import { Band, Polygon, Vector } from './primitives';
import { clipSegment, polylinePath, pxRect } from './scales';
import { Stage2D, type Stage2DProps } from './Stage2D';

export interface MatrixGridVector {
  /** The input vector v, drawn as itself (never transformed). */
  value: Signal<Vec2> | ReadonlySignal<Vec2>;
  concept: string;
  /** Accessible name of its handle: "the input arrow v". */
  label: string;
  /** KaTeX label at its tip, e.g. '$\\cInput$'. */
  tex?: string;
  /** Default: true when `value` is a writable signal. */
  draggable?: boolean;
  snap?: number;
  /** Also draw A·v: a derived, non-draggable arrow that follows `morph`. */
  image?: { concept: string; label: string; tex?: string };
  /** E.g. a Predict guess: onDragEnd={setGuess}. */
  onDragEnd?: (v: Vec2) => void;
}

export interface MatrixGridProps {
  matrix: Signal<Mat2>;
  title: string;
  /** Drag î/ĵ tips, step the entries, both, or neither. Default 'basis'. */
  editable?: 'basis' | 'entries' | 'both' | false;
  /** Snap for entries and basis tips. Default 0.5. */
  snap?: number;
  /** 0 = identity … 1 = the matrix. */
  morph?: ReadonlySignal<number>;
  /** Default { grid: true, basis: true, unitSquare: true, determinant: true, eigen: false }. */
  show?: { grid?: boolean; basis?: boolean; unitSquare?: boolean; determinant?: boolean; eigen?: boolean };
  vectors?: readonly MatrixGridVector[];
  view?: ViewBox;
  /**
   * Which concepts the pieces wear. Defaults: î and ĵ in ink; the area and
   * the transformed grid in the lesson's `matrix` concept and the eigen
   * directions in its `eigenvalue` concept when the lesson defines them.
   */
  concepts?: { i?: string; j?: string; area?: string; grid?: string; eigen?: string };
  /** Symbol for the matrix in the entries panel (TeX). Default 'A'. */
  symbol?: string;
  aspect?: Stage2DProps['aspect'];
  hint?: string | false;
}

/** A·v through the morph: the same value the image arrow shows (for Formula live values and readouts). */
export function imageOf(matrix: ReadonlySignal<Mat2>, v: ReadonlySignal<Vec2>, morph?: ReadonlySignal<number>): ReadonlySignal<Vec2> {
  return computed(() => imageValue(matrix.value, v.value, morph?.value));
}

/** The pure core of `imageOf`. */
export function imageValue(A: Readonly<Mat2>, v: Readonly<Vec2>, t?: number): Vec2 {
  return apply2(displayMatrix(A, t), v);
}

/** True for a writable signal (a `signal()`), false for a `computed()`. */
export function isWritableSignal(s: object): boolean {
  for (let p = Object.getPrototypeOf(s); p; p = Object.getPrototypeOf(p)) {
    const d = Object.getOwnPropertyDescriptor(p, 'value');
    if (d) return typeof d.set === 'function';
  }
  return false;
}

/** A signal-like view of one column of the matrix, so a Handle can drag î or ĵ. */
function columnLens(matrix: Signal<Mat2>, k: 0 | 1): Signal<Vec2> {
  return {
    get value() {
      return columnOf(matrix.value, k);
    },
    set value(v: Vec2) {
      matrix.value = withColumn(matrix.peek(), k, v);
    },
    peek: () => columnOf(matrix.peek(), k),
  } as unknown as Signal<Vec2>;
}

const DEFAULT_VIEW: ViewBox = { x: [-4, 4], y: [-3.2, 3.2] };

export function MatrixGrid(props: MatrixGridProps) {
  const { matrix, title, editable = 'basis', snap = 0.5, morph, vectors = [], view = DEFAULT_VIEW } = props;
  const show = { grid: true, basis: true, unitSquare: true, determinant: true, eigen: false, ...props.show };
  const { concepts } = useKit();
  const has = (n: string) => !!concepts?.names.includes(n);
  const cc = {
    i: props.concepts?.i,
    j: props.concepts?.j,
    area: props.concepts?.area ?? (has('matrix') ? 'matrix' : undefined),
    grid: props.concepts?.grid ?? (has('matrix') ? 'matrix' : undefined),
    eigen: props.concepts?.eigen ?? (has('eigenvalue') ? 'eigenvalue' : undefined),
  };
  const images = useMemo(() => vectors.map((vec) => (vec.image ? imageOf(matrix, vec.value, morph) : null)), [vectors, matrix, morph]);
  const basisDrag = editable === 'basis' || editable === 'both';
  return (
    <div class="mxg">
      <Stage2D view={view} title={title} aspect={props.aspect} hint={props.hint}>
        {show.grid && <TransformedGrid matrix={matrix} morph={morph} concept={cc.grid} />}
        {show.unitSquare && <UnitSquare matrix={matrix} morph={morph} concept={cc.area} label={show.determinant} />}
        {show.eigen && <EigenDirections matrix={matrix} morph={morph} concept={cc.eigen} />}
        {show.basis && <BasisArrows matrix={matrix} morph={morph} ci={cc.i} cj={cc.j} />}
        {vectors.map((vec, k) => (
          <VectorPair key={k} vec={vec} image={images[k]} />
        ))}
        {show.basis && basisDrag && <BasisHandles matrix={matrix} morph={morph} snap={snap} ci={cc.i} cj={cc.j} />}
      </Stage2D>
      <EntriesPanel matrix={matrix} morph={morph} snap={snap} editable={editable === 'entries' || editable === 'both'} determinant={show.determinant} eigen={show.eigen} symbol={props.symbol ?? 'A'} />
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function useShown(matrix: ReadonlySignal<Mat2>, morph?: ReadonlySignal<number>): Mat2 {
  return displayMatrix(matrix.value, morph?.value);
}

function TransformedGrid({ matrix, morph, concept }: { matrix: ReadonlySignal<Mat2>; morph?: ReadonlySignal<number>; concept?: string }) {
  useRenderCount();
  const s = useStage();
  const M = useShown(matrix, morph);
  const R = gridReach(s.view, M);
  const rect = pxRect(s, 2);
  const segs: [Vec2, Vec2][] = [];
  for (const [a, b] of gridLines(M, R)) {
    const c = clipSegment(s.toPx(a), s.toPx(b), rect);
    if (c) segs.push(c);
  }
  const ax = [
    clipSegment(s.toPx([-R * M[0], -R * M[2]]), s.toPx([R * M[0], R * M[2]]), rect),
    clipSegment(s.toPx([-R * M[1], -R * M[3]]), s.toPx([R * M[1], R * M[3]]), rect),
  ].filter((x): x is [Vec2, Vec2] => !!x);
  return (
    <g class={cx('s2-mark mxg__grid', concept ? `ct ct-${concept}` : '')} data-piece="grid">
      <path class="fig-line mxg__lines" d={polylinePath(segs)} />
      <path class="fig-line mxg__axes" d={polylinePath(ax)} />
    </g>
  );
}

function UnitSquare({ matrix, morph, concept, label }: { matrix: ReadonlySignal<Mat2>; morph?: ReadonlySignal<number>; concept?: string; label: boolean }) {
  useRenderCount();
  const M = useShown(matrix, morph);
  const note = determinantNote(M);
  const sq = unitSquare(M);
  return (
    <g class={cx('mxg__square', note.flipped && 'is-flipped', note.flat && 'is-flat')} data-piece="square" data-det={formatNumber(note.det, 2)}>
      <Polygon points={sq} fill={note.flipped ? 'hatch' : 'wash'} concept={concept} emphasis="quiet" label={label && !note.flat ? `area ×${formatNumber(note.det, 2)}` : undefined} />
    </g>
  );
}

function EigenDirections({ matrix, morph, concept }: { matrix: ReadonlySignal<Mat2>; morph?: ReadonlySignal<number>; concept?: string }) {
  useRenderCount();
  const M = useShown(matrix, morph);
  const e = eigenLines(M);
  if (e.kind !== 'lines') return null;
  return (
    <g data-piece="eigen">
      {e.lines.map((l, k) => (
        <Band key={k} through={[0, 0]} direction={l.dir} concept={concept} label={l.name} />
      ))}
    </g>
  );
}

function BasisArrows({ matrix, morph, ci, cj }: { matrix: ReadonlySignal<Mat2>; morph?: ReadonlySignal<number>; ci?: string; cj?: string }) {
  useRenderCount();
  const M = useShown(matrix, morph);
  return (
    <g data-piece="basis">
      <Vector to={columnOf(M, 0)} concept={ci} emphasis="quiet" label="$\ihat$" labelGap={16} />
      <Vector to={columnOf(M, 1)} concept={cj} emphasis="quiet" label="$\jhat$" labelGap={16} />
    </g>
  );
}

function BasisHandles({ matrix, morph, snap, ci, cj }: { matrix: Signal<Mat2>; morph?: ReadonlySignal<number>; snap: number; ci?: string; cj?: string }) {
  useRenderCount();
  const lenses = useMemo(() => [columnLens(matrix, 0), columnLens(matrix, 1)] as const, [matrix]);
  // Mid-morph the tips aren't the matrix's columns: no dragging until the morph is complete.
  if (morph && morph.value < 0.999) return null;
  return (
    <>
      <Handle value={lenses[0]} label="the tip of î, the first column" symbol="î" concept={ci} snap={snap} />
      <Handle value={lenses[1]} label="the tip of ĵ, the second column" symbol="ĵ" concept={cj} snap={snap} />
    </>
  );
}

function VectorPair({ vec, image }: { vec: MatrixGridVector; image: ReadonlySignal<Vec2> | null }) {
  const drag = vec.draggable ?? isWritableSignal(vec.value);
  return (
    <>
      {image && vec.image && <Vector to={image} concept={vec.image.concept} label={vec.image.tex} />}
      <Vector to={vec.value} concept={vec.concept} label={vec.tex} labelGap={drag ? 22 : 10} />
      {drag && <Handle value={vec.value as Signal<Vec2>} label={vec.label} concept={vec.concept} snap={vec.snap} onDragEnd={vec.onDragEnd} />}
    </>
  );
}

// ── Entries panel ───────────────────────────────────────────────────────────

/** The panel's sentence: areas scale by |det|; a negative det flips orientation; 0 squashes the plane. */
function detWords(n: ReturnType<typeof determinantNote>): string {
  if (n.flat) return n.words.replace(/^area 0: /, '');
  const k = formatNumber(Math.abs(n.det), 2);
  return n.flipped ? `orientation flipped; areas × ${k}` : `areas × ${k}`;
}

function EntriesPanel({ matrix, morph, snap, editable, determinant, eigen, symbol }: { matrix: Signal<Mat2>; morph?: ReadonlySignal<number>; snap: number; editable: boolean; determinant: boolean; eigen: boolean; symbol: string }) {
  const M = useShown(matrix, morph);
  const live = matrix.value;
  const dec = editable ? Math.max(1, decimalsFor(snap)) : 2;
  const note = determinantNote(M);
  const e = eigen ? eigenLines(M) : null;
  const mid = morph !== undefined && morph.value < 0.999;
  const step = (i: number, d: number) => (matrix.value = stepEntry(matrix.peek(), i, d, snap));
  const keys = (i: number) => (ev: KeyboardEvent) => {
    const big = ev.shiftKey ? 5 : 1;
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight' || ev.key === 'PageUp') step(i, snap * (ev.key === 'PageUp' ? 5 : big));
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' || ev.key === 'PageDown') step(i, -snap * (ev.key === 'PageDown' ? 5 : big));
    else return;
    ev.preventDefault();
  };
  return (
    <div class="readout mxg__panel" aria-live="polite">
      <span class="mxg__name">
        <RichText inline text={`$${symbol}${mid ? '_t' : ''} =$`} />
      </span>
      <span class={cx('lv-vec lv-vec--mat mxg__mat', editable && 'is-editable')} style={{ '--cols': 2 } as Record<string, number>}>
        {(editable && !mid ? live : M).map((x, i) =>
          editable && !mid ? (
            <span class="mxg__cell" key={i}>
              <button type="button" class="mxg__step" tabIndex={-1} data-hit aria-label={`decrease the entry in ${ENTRY_NAMES[i]}`} onClick={() => step(i, -snap)}>
                −
              </button>
              <span class="mxg__entry" role="spinbutton" tabIndex={0} aria-label={`entry in ${ENTRY_NAMES[i]}`} aria-valuenow={x} aria-valuetext={formatNumber(x, dec)} onKeyDown={keys(i)}>
                {formatNumber(x, dec)}
              </span>
              <button type="button" class="mxg__step" tabIndex={-1} data-hit aria-label={`increase the entry in ${ENTRY_NAMES[i]}`} onClick={() => step(i, snap)}>
                +
              </button>
            </span>
          ) : (
            <span class="mxg__entry" key={i}>
              {formatNumber(x, dec)}
            </span>
          ),
        )}
      </span>
      {determinant && (
        <span class={cx('mxg__det', note.flipped && 'is-flipped', note.flat && 'is-flat')}>
          det = {formatNumber(det2(M), 2)} · {detWords(note)}
        </span>
      )}
      {e && e.kind !== 'lines' && <span class="mxg__det">{e.kind === 'every' ? `every direction is kept (${e.name})` : e.why}</span>}
    </div>
  );
}
