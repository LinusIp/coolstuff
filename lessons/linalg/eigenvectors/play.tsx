/**
 * The central interactive (Play): drag an arrow v and watch where the matrix
 * sends it. Almost everywhere Av is knocked off v's own line (the dotted
 * guide), and an arc says by how much. Along a few directions it isn't: Av
 * lands on the line, everything turns green, and the direction is pinned as
 * a rose band named by its stretch ("stretched ×3"). Under the plane, a trail
 * records the turn of every direction the learner has swept through, so the
 * zeros of the turn (two crossings, a single touch for the shear, none for
 * the quarter turn) are visible at a glance.
 *
 * No side effects at import; all state is local to the component.
 */
import { batch, useComputed, useSignal, useSignalEffect, type ReadonlySignal, type Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import { anchorForDirection, Arc, Band, clipLine, Figure, Handle, Label, Point, Polyline, polylinePath, Readout, ReadoutPair, Segmented, Stage2D, useStage, Vector } from '@kit';
import { apply2, dot, norm, type Mat2, type Vec2 } from '@kit/math';
import { coverage, eigenPicture, emptySweep, fitArrow, keptLineNear, lineDeg, PLAY_MATRICES, stretchWords, sweep, sweptRuns, turnDeg, unitAt, type EigenPicture, type PlateFit, type PlayMatrix } from './math';

type Id = PlayMatrix['id'];

/** Half-sizes of the region v and Av must stay in: a safe start; FitProbe widens it to the plate actually shown. */
const FIT: PlateFit = { hx: 3.35, hy: 2.95, minLength: 0.55 };
/** Room kept between an arrow tip and the plate's edge, in px (head + label). */
const EDGE_PX = 30;
const VIEW = { x: [-3.6, 3.6] as [number, number], y: [-3.2, 3.2] as [number, number] };
/** A line counts as kept when v is within this many degrees of it (the 3° magnet lands exactly; keys land within float error). */
const KEPT_TOL = 0.25;
/** Swept this much of the half-turn of directions: "all the way round". */
const SWEPT_ENOUGH = 0.9;
/** The trail's handle stays on directions [0°, 180°) (180° is 0° again). */
const TRAIL_Y = 136;
const TRAIL_BOUNDS = { x: [0, 179.5] as [number, number], y: [-TRAIL_Y, TRAIL_Y] as [number, number] };

const byId = (id: Id): PlayMatrix => PLAY_MATRICES.find((m) => m.id === id) ?? PLAY_MATRICES[0];
const fmtDeg = (d: number) => `${Math.abs(d).toFixed(1)}°`;

// ── Pieces drawn on the plane ───────────────────────────────────────────────

/** The infinite line through the origin along `dir`, as a dotted ink guide. */
function GuideLine({ dir }: { dir: Vec2 }) {
  const s = useStage();
  const a = s.toPx([0, 0]);
  const b = s.toPx(dir);
  const c = clipLine(a, b, { x0: -4, y0: -4, x1: s.width + 4, y1: s.height + 4 });
  if (!c) return null;
  return <path class="fig-guide eig-guide" d={polylinePath([c])} />;
}

interface PlaneProps {
  A: ReadonlySignal<Mat2>;
  pic: ReadonlySignal<EigenPicture>;
  v: Signal<Vec2>;
  found: ReadonlySignal<readonly number[]>;
  /** Shared, mutable: where v and Av may go (written by FitProbe). */
  fit: PlateFit;
}

function PinnedBands({ pic, found }: { pic: ReadonlySignal<EigenPicture>; found: ReadonlySignal<readonly number[]> }) {
  const p = pic.value;
  if (p.kind !== 'lines') return null;
  return (
    <>
      {p.lines
        .filter((l) => found.value.some((d) => Math.abs(d - l.deg) < 1e-6))
        .map((l) => (
          <Band key={l.deg} through={[0, 0]} direction={l.dir} concept="eigenvalue" label={stretchWords(l.lambda)} />
        ))}
    </>
  );
}

function TurnMarks({ A, v }: { A: ReadonlySignal<Mat2>; v: ReadonlySignal<Vec2> }) {
  const vv = v.value;
  const w = apply2(A.value, vv);
  const t = turnDeg(A.value, vv);
  const kept = Math.abs(t) <= KEPT_TOL;
  // The arc goes from v to the LINE of Av: to −Av when Av points backwards (a flip turns the line, not the arrow).
  const back = dot(vv, w) < 0;
  const toward: Vec2 = back ? [-w[0], -w[1]] : w;
  const tiny = norm(w) < 1e-9;
  // The arc sits inside the shorter arrow, clear of the handle's ring; it is labelled only when there is room.
  const s = useStage();
  const short = Math.min(norm(vv), norm(w)) * s.pxPerUnit;
  const r = Math.max(16, Math.min(44, short * 0.42));
  return (
    <>
      {!kept && <GuideLine dir={vv} />}
      {!kept && back && !tiny && <path class="fig-guide eig-guide" d={polylinePath([[s.toPx([0, 0]), s.toPx(toward)]])} />}
      {!kept && !tiny && <Arc center={[0, 0]} from={vv} to={toward} r={r} label={short > 120 && Math.abs(t) > 6 ? fmtDeg(t) : undefined} />}
    </>
  );
}

function FoundOverlay({ A, v }: { A: ReadonlySignal<Mat2>; v: ReadonlySignal<Vec2> }) {
  const kept = Math.abs(turnDeg(A.value, v.value)) <= KEPT_TOL;
  if (!kept) return null;
  return <Band through={[0, 0]} direction={v.value} concept="eigenvalue" correct />;
}

function ImageArrow({ A, v }: { A: ReadonlySignal<Mat2>; v: ReadonlySignal<Vec2> }) {
  const s = useStage();
  const vv = v.value;
  const w = apply2(A.value, vv);
  if (norm(w) < 1e-9) return <Point at={[0, 0]} concept="output" label="$A\vec v = \zerovec$" labelAnchor="se" />;
  // When the two tips (nearly) coincide (Av = v), set Av's name beside the tip instead of on top of v's.
  const close = Math.hypot(w[0] - vv[0], w[1] - vv[1]) * s.pxPerUnit < 36;
  const side = close ? anchorForDirection(-w[1], -w[0]) : undefined;
  return <Vector to={w} concept="output" label="$\cOutput$" labelAnchor={side} labelGap={close ? 26 : 10} />;
}

/** Widens the fit to the plate actually shown (wide desktop plates show more x than the authored view). */
function FitProbe({ fit }: { fit: PlateFit }) {
  const s = useStage();
  const a = s.toWorld([0, 0]);
  const b = s.toWorld([s.width, s.height]);
  const m = EDGE_PX / Math.max(s.pxPerUnit, 1e-9);
  fit.hx = Math.max(FIT.hx, Math.min(Math.abs(a[0]), Math.abs(b[0])) - m);
  fit.hy = Math.max(1.2, Math.min(Math.abs(a[1]), Math.abs(b[1])) - m);
  return null;
}

function Plane({ A, pic, v, found, fit }: PlaneProps) {
  const kept = useComputed(() => Math.abs(turnDeg(A.value, v.value)) <= KEPT_TOL);
  const dirs = useComputed(() => {
    const p = pic.value;
    return p.kind === 'lines' ? p.lines.map((l) => l.dir) : [];
  });
  const constrain = useMemo(() => (p: Vec2) => fitArrow(A.peek(), p, fit), [A, fit]);
  return (
    <Stage2D view={VIEW} title="The plane: drag the blue arrow v; the dashed orange arrow is where the matrix sends it." aspect={{ desktop: 0.56, phone: 0.94 }}>
      <FitProbe fit={fit} />
      <PinnedBands pic={pic} found={found} />
      <FoundOverlay A={A} v={v} />
      <TurnMarks A={A} v={v} />
      <ImageArrow A={A} v={v} />
      <Vector to={v} concept="input" label="$\cInput$" labelGap={22} correct={kept} />
      <Handle value={v} label="the input arrow v" symbol="v" concept="input" constrain={constrain} snapDirections={dirs.value} correct={kept} />
    </Stage2D>
  );
}

// ── The sweep trail under the plane ─────────────────────────────────────────

/** A signal-shaped view of v as a point on the turn curve: (direction of v's line, its turn); writing it turns v to that direction. */
function curveLens(A: ReadonlySignal<Mat2>, v: Signal<Vec2>, fit: PlateFit): Signal<Vec2> {
  const read = (vv: Vec2): Vec2 => [lineDeg(vv), turnDeg(A.peek(), vv)];
  return {
    get value() {
      void A.value; // subscribe to the matrix too
      return read(v.value);
    },
    set value(p: Vec2) {
      const cur = v.peek();
      const lower = Math.atan2(cur[1], cur[0]) < 0; // keep v in its half of the plane
      const u = unitAt(p[0] + (lower ? 180 : 0));
      const L = Math.max(norm(cur), fit.minLength);
      v.value = fitArrow(A.peek(), [u[0] * L, u[1] * L], fit);
    },
    peek: () => read(v.peek()),
  } as unknown as Signal<Vec2>;
}

function TrailRuns({ A, bins }: { A: ReadonlySignal<Mat2>; bins: ReadonlySignal<readonly boolean[]> }) {
  const runs = sweptRuns(A.value, bins.value);
  return (
    <>
      {runs.map((r, k) => (
        <Polyline key={k} points={r} emphasis="focal" />
      ))}
    </>
  );
}

function TrailZeros({ pic, found }: { pic: ReadonlySignal<EigenPicture>; found: ReadonlySignal<readonly number[]> }) {
  const p = pic.value;
  if (p.kind !== 'lines') return null;
  const shown = p.lines.filter((l) => found.value.some((d) => Math.abs(d - l.deg) < 1e-6));
  return (
    <>
      {shown.flatMap((l) => {
        const lam = Math.round(l.lambda * 100) / 100;
        const name = `×${String(lam).replace('-', '−')}`;
        const at: number[] = l.deg < 1e-6 ? [0, 180] : [l.deg];
        return at.map((d) => <Point key={`${l.deg}-${d}`} at={[d, 0]} concept="eigenvalue" label={name} labelAnchor={d > 160 ? 'nw' : 'ne'} />);
      })}
    </>
  );
}

function Trail({ A, pic, v, bins, found, fit }: PlaneProps & { bins: ReadonlySignal<readonly boolean[]> }) {
  const lens = useMemo(() => curveLens(A, v, fit), [A, v, fit]);
  const curve = useMemo(() => (d: number) => turnDeg(A.peek(), unitAt(d)), [A]);
  const kept = useComputed(() => Math.abs(turnDeg(A.value, v.value)) <= KEPT_TOL);
  return (
    <Stage2D
      view={{ x: [-22, 188], y: [-TRAIL_Y, TRAIL_Y] }}
      equalScale={false}
      title="The turn of every direction swept so far: across, the direction of v's line from 0° to 180°; up, how far the matrix turns it."
      aspect={{ desktop: 0.22, phone: 0.5 }}
      grid={{ step: 45 }}
      hint={false}
      class="eig-trail"
    >
      {/* Axis names in the margins beyond ±90°, where no turn can reach (the kit's names sit on the axis line, where the zeros are). */}
      <Label at={[3, TRAIL_Y - 2]} text="turn (°)" anchor="se" gap={2} />
      <Label at={[178, -TRAIL_Y + 2]} text="direction (°)" anchor="nw" gap={2} />
      <TrailRuns A={A} bins={bins} />
      <TrailZeros pic={pic} found={found} />
      <Handle value={lens} label="the direction of v, on the turn curve" constrain={{ curve }} bounds={TRAIL_BOUNDS} step={2} correct={kept} valueText={(p) => `direction ${p[0].toFixed(0)}°, turned ${p[1].toFixed(1)}°`} />
    </Stage2D>
  );
}

// ── The figure ──────────────────────────────────────────────────────────────

const GOALS: readonly { id: Id; text: string }[] = [
  { id: 'stretch', text: '**Stretch:** find both directions it doesn’t turn' },
  { id: 'shear', text: '**Shear:** find every direction it doesn’t turn' },
  { id: 'turn', text: '**Turn:** find one it doesn’t turn, if there is one' },
];

export function EigenHunt() {
  const which = useSignal<Id>('stretch');
  /** What the buttons show; switching goes through pick() so v resets in the same batch as the matrix. */
  const choice = useSignal<Id>('stretch');
  const A = useComputed(() => byId(which.value).A);
  const pic = useComputed(() => eigenPicture(A.value));
  const v = useSignal<Vec2>(byId('stretch').v0);
  const foundAll = useSignal<Partial<Record<Id, readonly number[]>>>({});
  const binsAll = useSignal<Partial<Record<Id, readonly boolean[]>>>({});
  const found = useComputed(() => foundAll.value[which.value] ?? []);
  const bins = useComputed(() => binsAll.value[which.value] ?? emptySweep());
  const last = useMemo(() => ({ deg: null as number | null, id: 'stretch' as Id }), []);
  const fit = useMemo<PlateFit>(() => ({ ...FIT }), []);

  // Record what the learner has swept and found (per matrix, so switching back keeps their progress).
  useSignalEffect(() => {
    const id = which.value;
    const vv = v.value;
    const p = pic.value;
    const d = lineDeg(vv);
    const from = last.id === id ? last.deg : null;
    last.id = id;
    last.deg = d;
    const prevBins = binsAll.peek()[id] ?? emptySweep();
    const nextBins = sweep(prevBins, from, d);
    const hit = keptLineNear(p, vv, KEPT_TOL);
    const prevFound = foundAll.peek()[id] ?? [];
    batch(() => {
      if (nextBins !== prevBins) binsAll.value = { ...binsAll.peek(), [id]: nextBins };
      if (hit && !prevFound.some((x) => Math.abs(x - hit.deg) < 1e-6)) foundAll.value = { ...foundAll.peek(), [id]: [...prevFound, hit.deg] };
    });
  });

  const pick = (id: Id) => {
    batch(() => {
      which.value = id;
      v.value = byId(id).v0;
    });
  };

  const turn = useComputed(() => turnDeg(A.value, v.value));
  const kept = useComputed(() => Math.abs(turn.value) <= KEPT_TOL);
  const Av = useComputed(() => apply2(A.value, v.value));
  const status = useComputed(() => {
    if (!kept.value) return `turned ${fmtDeg(turn.value)}`;
    const lam = Math.round((dot(v.value, Av.value) / dot(v.value, v.value)) * 100) / 100;
    return `not turned: ${stretchWords(lam)}`;
  });

  const nFound = (id: Id) => (foundAll.value[id] ?? []).length;
  const swept = (id: Id) => coverage(binsAll.value[id] ?? emptySweep());
  const done = {
    stretch: useComputed(() => nFound('stretch') >= 2),
    shear: useComputed(() => nFound('shear') >= 1 && swept('shear') >= SWEPT_ENOUGH),
    turn: useComputed(() => swept('turn') >= SWEPT_ENOUGH),
  };
  const allDone = useComputed(() => done.stretch.value && done.shear.value && done.turn.value);
  const missionStatus = useComputed(() => {
    if (allDone.value) return 'Most arrows get turned. The rare directions that are only stretched (or flipped, or squashed) have a name: **eigenvectors**.';
    const id = which.value;
    const k = nFound(id);
    if (id === 'stretch') return k === 0 ? 'Drag the ring. When the dashed arrow lands on the dotted line, you have found one.' : k === 1 ? 'One down. There is a second direction.' : 'Both found. Now try Shear.';
    if (id === 'shear') return k === 0 ? 'Shear slides every arrow sideways. Is any direction left on its own line?' : swept('shear') < SWEPT_ENOUGH ? 'Found one. Sweep all the way round: is there another? Watch the trail.' : 'Only one: the trail touches zero once and bounces back.';
    if (id === 'turn') return swept('turn') < SWEPT_ENOUGH ? 'Sweep the arrow all the way round and watch the trail.' : 'None at all: every arrow is turned a quarter turn, so the trail never reaches zero.';
    return k === 0 ? 'Flip mirrors the plane. Look for an arrow that stays on its line but points the other way.' : 'An arrow sent to the opposite side of its own line still counts: it was flipped, not turned.';
  });

  return (
    <Figure
      name="eigen-play"
      central
      wide
      interactive
      caption="**Which arrows does a matrix leave on their own line?** Drag the blue arrow; the dashed orange arrow is where the matrix sends it. The trail underneath records how far each direction you sweep through is turned."
      description="A coordinate plane with a draggable blue arrow v from the origin and its dashed orange image under the chosen matrix. A dotted line extends v in both directions, and an arc between v and its image is labelled with the angle the matrix turns it. When the image lands on v's own line the arrow and a band along the line turn green and the readout names the stretch factor; found directions stay marked by rose bands labelled with their stretch. Below, a strip plots the turn angle against the direction of v for every direction swept so far; it crosses zero at the directions the matrix keeps. Buttons choose between four matrices: Stretch, Shear, Turn and Flip."
      readout={
        <Readout status={status} correct={kept}>
          <ReadoutPair sym="$\vec v$" concept="input" value={v} />
          <span class="readout__sep">↦</span>
          <ReadoutPair sym="$A\vec v$" concept="output" value={Av} />
        </Readout>
      }
      controls={<Segmented value={choice} label="Matrix" options={PLAY_MATRICES.map((m) => ({ value: m.id, label: m.name }))} onChange={pick} />}
      mission={{ goals: GOALS.map((g) => ({ text: g.text, done: done[g.id as keyof typeof done] })), status: missionStatus, correct: allDone }}
      legend={[
        { concept: 'input', label: 'your arrow $\\vec v$ (drag it)' },
        { concept: 'output', label: 'where the matrix sends it, $A\\vec v$' },
        { line: 'dotted', label: 'the line through $\\vec v$' },
        { concept: 'eigenvalue', label: 'a direction it doesn’t turn' },
      ]}
    >
      <Plane A={A} pic={pic} v={v} found={found} fit={fit} />
      <Trail A={A} pic={pic} v={v} found={found} bins={bins} fit={fit} />
    </Figure>
  );
}
