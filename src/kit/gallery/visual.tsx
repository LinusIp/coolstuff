/**
 * Gallery section for G2 (Visuals): Stage2D and its primitives, Plot,
 * MatrixGrid, Stage3D and MatrixGrid3D, in the states worth seeing.
 * Rendered by kit/_dev/visual.html now and by /kit later.
 *
 * Demos read signals only in small leaf components (readouts, counters), so
 * a drag re-renders exactly what shows the dragged value (README §1.2).
 */
import { computed, signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useInView } from '../core/hooks';
import { formatLive } from '../core/live';
import { derivative } from '../math/calculus';
import { gdPath } from '../math/analysis';
import { apply2, type Mat2, type Mat3 } from '../math/mat';
import { mulberry32, randn } from '../math/stats';
import { angleBetween, norm, type Vec2, type Vec3 } from '../math/vec';
import { PlayScrub, Segmented, Slider, Toggle } from '../controls';
import { Figure, Readout, ReadoutPair } from '../shell';
import { FpsMeter } from '../util/fps';
import { Arc, Band, Curve, Handle, imageOf, Label, Line, MatrixGrid, Plot, Point, Polygon, Segment, Stage2D, Vector, type PlotSeries } from '../visual';
import { Curve3D, MatrixGrid3D, Plane3D, Point3D, Polyline3D, Stage3D, Surface, Vector3D, VectorField3D } from '../visual/Stage3D';
import type { GalleryGroup } from './types';

// ── Shared bits ─────────────────────────────────────────────────────────────

/** Live dev counter read from a stage's data attributes (README §6.1/§6.2 tests). */
function DevCounter({ of, attr, format }: { of: string; attr: 'renders' | 'samples'; format: (raw: string) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-figure="${of}"] .stage2d`);
      const raw = el?.dataset[attr];
      if (ref.current && raw) ref.current.textContent = format(raw);
    }, 250);
    return () => window.clearInterval(id);
  }, [of]);
  return <span class="g2-dev" ref={ref} data-counter={`${of}:${attr}`} />;
}
const renderCount = (raw: string) => raw.replace('static:', 'dev · static layer renders ').replace(' dynamic:', ' · dynamic renders ');

// ── Stage2D: the eigen pair ─────────────────────────────────────────────────

const A: Mat2 = [2, 1, 1, 2];
const v = signal<Vec2>([1.4, 0.2]);
const Av = computed(() => apply2(A, v.value));
const turned = computed(() => (angleBetween(v.value, Av.value) * 180) / Math.PI);
const kept = computed(() => norm(v.value) > 0.05 && turned.value < 0.05);
const eigenStatus = computed(() => (kept.value ? `Same line: Av = ${(norm(Av.value) / Math.max(norm(v.value), 1e-9)).toFixed(2)} v` : `turned ${turned.value.toFixed(1)}°`));
const EIGEN_DIRS: Vec2[] = [
  [1, 1],
  [1, -1],
];

/** The found overlay: the kept line under the handle, redrawn green on the dynamic layer. */
function FoundBand() {
  if (!kept.value) return null;
  return <Band through={[0, 0]} direction={v.value} concept="eigenvalue" correct />;
}

function EigenPlay() {
  return (
    <Figure
      name="g2-eigen"
      wide
      interactive
      caption="**Stage2D with a Handle.** Drag $\cInput$; $\cOutput$ follows. On the rose lines the two arrows line up, the handle clicks on (3° magnet) and turns green."
      description="A coordinate plane with two rose lines through the origin at 45° and −45°. A blue input arrow v starts at (1.4, 0.2); its dashed orange image Av is drawn from the origin to (3, 1.8)."
      readout={
        <Readout status={eigenStatus} correct={kept}>
          <ReadoutPair sym="$\vec v$" concept="input" value={v} />
          <span class="readout__sep">↦</span>
          <ReadoutPair sym="$A\vec v$" concept="output" value={Av} />
        </Readout>
      }
      legend={[
        { concept: 'input', label: 'input arrow $\\vec v$ (drag it)' },
        { concept: 'output', label: 'its image $A\\vec v$' },
        { concept: 'eigenvalue', label: 'directions $A$ keeps' },
      ]}
    >
      <Stage2D
        view={{ x: [-3.7, 3.7], y: [-3.4, 3.4] }}
        title="The plane under A = [[2, 1], [1, 2]]: drag the blue input arrow v and watch its orange image Av."
        static={
          <>
            <Band through={[0, 0]} direction={[1, 1]} concept="eigenvalue" label="stretched ×3" />
            <Band through={[0, 0]} direction={[1, -1]} concept="eigenvalue" label="unchanged ×1" />
          </>
        }
      >
        <FoundBand />
        <Vector to={Av} concept="output" label="$\cOutput$" />
        <Vector to={v} concept="input" label="$\cInput$" labelGap={22} correct={kept} />
        <Handle value={v} label="the input arrow v" symbol="v" concept="input" snapDirections={EIGEN_DIRS} correct={kept} />
      </Stage2D>
    </Figure>
  );
}

// ── Stage2D: the found state, preset ────────────────────────────────────────

const vf = signal<Vec2>([1.1, 1.1]);
const Avf = computed(() => apply2(A, vf.value));
const keptF = computed(() => norm(vf.value) > 0.05 && angleBetween(vf.value, Avf.value) < 0.002);

function FoundState() {
  return (
    <Figure
      name="g2-found"
      caption="**The found state, preset.** $\cInput$ sits on a kept direction: the handle, the arrow and the band under it turn green together, and the readout says so in words (colour is never alone)."
      description="The same plane as above with the input arrow already on the 45° line: the arrow, its handle and the band along the line are green; the image arrow lies on the same line, three times longer."
      readout={
        <Readout status="Same line: Av = 3.00 v" correct={keptF}>
          <ReadoutPair sym="$\vec v$" concept="input" value={vf} />
          <ReadoutPair sym="$A\vec v$" concept="output" value={Avf} />
        </Readout>
      }
    >
      <Stage2D view={{ x: [-3.7, 3.7], y: [-3.4, 3.4] }} title="An input arrow found on a kept direction of A." hint={false} aspect={{ desktop: 0.5, phone: 0.9 }}>
        <Band through={[0, 0]} direction={vf} concept="eigenvalue" correct={keptF} label="stretched ×3" />
        <Vector to={Avf} concept="output" label="$\cOutput$" />
        <Vector to={vf} concept="input" label="$\cInput$" labelGap={22} correct={keptF} />
        <Handle value={vf} label="the input arrow v, found" symbol="v" concept="input" snapDirections={EIGEN_DIRS} correct={keptF} />
      </Stage2D>
    </Figure>
  );
}

// ── Stage2D: constraints ────────────────────────────────────────────────────

const onCurve = signal<Vec2>([1, 1 / 3 - 1]);
const onCircle = signal<Vec2>([1.6, 0]);
const onLine = signal<Vec2>([-1, -0.5]);
const gridded = signal<Vec2>([-2, 1.5]);
const lineDir: [Vec2, Vec2] = [
  [-3, -1.5],
  [1, 0.5],
];
const cube = (x: number) => (x * x * x) / 3 - x;
const CIRCLE: Vec2[] = [...Array(64)].map((_, k) => [1.6 * Math.cos((k / 64) * 2 * Math.PI), 1.6 * Math.sin((k / 64) * 2 * Math.PI)]);

function Constraints() {
  return (
    <Figure
      name="g2-constraints"
      caption="**Handle constraints.** On a curve (Home/End go to the ends of its visible piece), on a circle, on a line, and free with a 0.5 grid snap. Keys move *along* the constraint."
      description="Four draggable points: one on the cubic y = x³/3 − x, one on a circle of radius 1.6, one on a line, and one that snaps to a half-unit grid."
      keys="Tab to a ring, then ← ↑ → ↓ to move it along its constraint (Shift for bigger steps); Home and End on the curve and the line."
      readout={
        <>
          <ReadoutPair sym="$P$" concept="output" value={onCurve} />
          <ReadoutPair sym="$Q$" concept="matrix" value={onCircle} />
          <ReadoutPair sym="$R$" concept="eigenvalue" value={onLine} />
          <ReadoutPair sym="$S$" concept="input" value={gridded} />
        </>
      }
    >
      <Stage2D view={{ x: [-3, 3], y: [-2.4, 2.4] }} title="Four handles: on a cubic, on a circle, on a line and on a half-unit grid." hint={false}>
        <Curve f={cube} concept="output" emphasis="quiet" />
        <Polygon points={CIRCLE} fill="none" concept="matrix" />
        <Line through={lineDir} concept="eigenvalue" />
        <Handle value={onCurve} label="a point on the cubic" symbol="P" concept="output" constrain={{ curve: cube }} />
        <Handle value={onCircle} label="a point on the circle" symbol="Q" concept="matrix" constrain={{ circle: { c: [0, 0], r: 1.6 } }} />
        <Handle value={onLine} label="a point on the line" symbol="R" concept="eigenvalue" constrain={{ line: lineDir }} />
        <Handle value={gridded} label="a point on the half-unit grid" symbol="S" concept="input" snap={0.5} />
      </Stage2D>
    </Figure>
  );
}

// ── Stage2D: primitives catalogue ───────────────────────────────────────────

function Primitives() {
  return (
    <Figure
      name="g2-primitives"
      caption="**Every primitive.** Vector, Segment, Line, Point (filled and hollow), Curve (tan x breaks at its poles), Polygon (wash and hatch), Arc and KaTeX labels, in each concept's ink and line style."
      description="A catalogue: the graph of tan x in dotted purple with gaps at its poles, a hatched orange triangle, a washed teal rectangle, a rose segment, a red dash-dot line, a blue vector u with an angle mark θ, filled and hollow points P, and a KaTeX label."
    >
      <Stage2D view={{ x: [-4, 4], y: [-3, 3] }} title="A catalogue of Stage2D primitives." aspect={{ desktop: 0.7, phone: 1.05 }}>
        <Curve f={Math.tan} concept="prob" emphasis="quiet" label="$\tan x$" />
        <Polygon points={[[-3.5, -2.5], [-1.5, -2.5], [-2.5, -0.9]]} fill="hatch" concept="output" label="hatch" />
        <Polygon points={[[1.2, -2.6], [3.4, -2.6], [3.4, -1.2], [1.2, -1.2]]} fill="wash" concept="matrix" label="wash" />
        <Segment a={[-3.6, 2.4]} b={[-1.4, 2.4]} concept="eigenvalue" label="segment" />
        <Line through={[[0, -1], [1, -0.4]]} concept="error" />
        <Segment a={[0.4, 0.4]} b={[2.6, 0.4]} emphasis="context" />
        <Vector from={[0.4, 0.4]} to={[2.6, 1.6]} concept="input" label="$\vec u$" />
        <Arc center={[0.4, 0.4]} from={[2.6, 1.6]} to={[2.6, 0.4]} r={34} label="$\theta$" />
        <Point at={[-1, 1]} concept="output" label="$P$" />
        <Point at={[-0.4, 1]} concept="output" hollow />
        <Label at={[2.2, 2.6]} text="$\int_0^1 x^2\,dx = \tfrac13$" anchor="c" />
      </Stage2D>
    </Figure>
  );
}

// ── Stage2D: pan and zoom ───────────────────────────────────────────────────

const panView = signal({ x: [-6, 6] as [number, number], y: [-4, 4] as [number, number] });
const panX = computed(() => `[${formatLive(panView.value.x[0], 1)}, ${formatLive(panView.value.x[1], 1)}]`);
const panY = computed(() => `[${formatLive(panView.value.y[0], 1)}, ${formatLive(panView.value.y[1], 1)}]`);

function PanZoom() {
  return (
    <Figure
      name="g2-panzoom"
      caption="**Pan and zoom** (off by default). Mouse: drag empty space; ctrl/⌘ + scroll zooms. Phone: one finger still scrolls the page, two fingers pan and pinch. Focus the plate: arrows pan, + and − zoom, 0 resets."
      description="The curve y = x·sin(x)/2 on a plane that can be panned and zoomed."
      readout={
        <>
          <ReadoutPair sym="$x \in$" value={panX} />
          <ReadoutPair sym="$y \in$" value={panY} />
        </>
      }
    >
      <Stage2D view={panView} title="A pannable, zoomable plane with the curve y = x·sin(x)/2." pan zoom={{ min: 0.5, max: 6 }} axes={{ x: '$x$', y: '$y$' }} hint={false}>
        <Curve f={(x) => (Math.sin(x) * x) / 2} concept="output" />
      </Stage2D>
    </Figure>
  );
}

// ── Plot: a tangent driven by a handle ──────────────────────────────────────

const fq = (x: number) => 0.5 * x * x - 1;
const x0 = signal<Vec2>([1, fq(1)]);
const tangent = (x: number) => fq(x0.value[0]) + derivative(fq, x0.value[0]) * (x - x0.value[0]);
const slope = computed(() => derivative(fq, x0.value[0]));
const TANGENT_SERIES: PlotSeries[] = [
  { kind: 'function', f: fq, concept: 'output', label: '$f$' },
  { kind: 'function', f: tangent, concept: 'eigenvalue' },
];
const sampleCount = (raw: string) => {
  const m = Object.fromEntries(raw.split(' ').map((p) => p.split(':')));
  return `dev · samplings: f ${m['0'] ?? 0} · tangent ${m['1'] ?? 0}`;
};

function TangentPlot() {
  return (
    <Figure
      name="g2-tangent"
      interactive
      caption="**Plot reactivity.** The tangent's function reads the handle's signal, so dragging re-samples *only* the tangent; $f$ was sampled once (see the counter)."
      description="The parabola f(x) = x²/2 − 1 with a draggable point on it and the tangent line at that point."
      readout={
        <>
          <ReadoutPair sym="$x_0$" concept="eigenvalue" value={() => x0.value[0]} />
          <ReadoutPair sym="$f'(x_0)$" concept="eigenvalue" value={slope} />
        </>
      }
    >
      <Plot title="f and its tangent at a draggable point" x={[-2.5, 3]} y={[-2, 3.5]} series={TANGENT_SERIES} xLabel="$x$" yLabel="$y$" hint="drag along the curve">
        <Handle value={x0} constrain={{ curve: fq }} label="the point of tangency" symbol="x₀" concept="eigenvalue" />
      </Plot>
    </Figure>
  );
}

// ── Plot: linked cursor over f, f′, f″ ─────────────────────────────────────

const g0 = (x: number) => Math.sin(x) + x / 3;
const g1 = (x: number) => Math.cos(x) + 1 / 3;
const g2 = (x: number) => -Math.sin(x);
const cur = signal(1.2);
const S0: PlotSeries[] = [{ kind: 'function', f: g0, concept: 'output', label: '$f$' }];
const S1: PlotSeries[] = [{ kind: 'function', f: g1, concept: 'eigenvalue', label: "$f'$" }];
const S2: PlotSeries[] = [{ kind: 'function', f: g2, concept: 'matrix', label: "$f''$" }];

function LinkedPlots() {
  const aspect = { desktop: 0.3, phone: 0.5 };
  return (
    <Figure
      name="g2-linked"
      caption="**Linked plots.** $f$, $f'$ and $f''$ share one `cursor` signal: drag any grip (or focus it and use ← →, Shift ×10, Home/End) and all three follow."
      description="Three stacked plots of f(x) = sin x + x/3, its derivative and its second derivative, with one vertical cursor shared by all three."
      readout={
        <>
          <ReadoutPair sym="$x$" value={cur} />
          <ReadoutPair sym="$f$" concept="output" value={() => g0(cur.value)} />
          <ReadoutPair sym="$f'$" concept="eigenvalue" value={() => g1(cur.value)} />
          <ReadoutPair sym="$f''$" concept="matrix" value={() => g2(cur.value)} />
        </>
      }
      keys="Tab to a grip, then ← → to move the cursor (Shift ×10, Home/End to the ends)."
    >
      <div class="g2-stack">
        <Plot title="f(x) = sin x + x/3" x={[-1, 7]} y="auto" series={S0} cursor={cur} cursorLabel="cursor on f" aspect={aspect} />
        <Plot title="f′(x)" x={[-1, 7]} y="auto" series={S1} cursor={cur} cursorLabel="cursor on f′" aspect={aspect} />
        <Plot title="f″(x)" x={[-1, 7]} y="auto" series={S2} cursor={cur} cursorLabel="cursor on f″" aspect={aspect} />
      </div>
    </Figure>
  );
}

// ── Plot: live series, 2,000 points ─────────────────────────────────────────

const N_LIVE = 2000;
function liveFrame(t: number): Vec2[] {
  const out: Vec2[] = new Array(N_LIVE);
  for (let i = 0; i < N_LIVE; i++) {
    const x = (i / (N_LIVE - 1)) * 10;
    out[i] = [x, Math.sin(x * 1.3 + t) * 0.8 + Math.sin(x * 5.1 - t * 2.3) * 0.25 + Math.exp(-x / 4) * 1.2];
  }
  return out;
}
const liveData = signal<readonly Vec2[]>(liveFrame(0));
const liveFps = signal('—');
const LIVE_SERIES: PlotSeries[] = [{ kind: 'line', data: liveData, concept: 'error', label: 'loss' }];
const liveOn = signal(false);

function LivePlot() {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const visible = useInView(el, '0px');
  const on = liveOn.value;
  useEffect(() => {
    if (!on || !visible) return;
    let raf = 0;
    let t = 0;
    const meter = new FpsMeter(60);
    let lastShown = 0;
    const tick = (now: number) => {
      t += 0.03;
      liveData.value = liveFrame(t);
      meter.tick(now);
      if (now - lastShown > 500 && meter.ready) {
        liveFps.value = `${meter.fps.toFixed(0)} fps`;
        lastShown = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, visible]);
  return (
    <div ref={setEl}>
      <Figure
        name="g2-live"
        caption="**A live series.** 2,000 points re-drawn from a signal every frame (switch it on); the strip shows the measured frame rate. Paused off-screen; never autoplays."
        description="A wavy line of 2,000 points that animates when playing."
        readout={
          <>
            <ReadoutPair sym="points" value={N_LIVE} decimals={0} />
            <ReadoutPair sym="rate" value={liveFps} />
          </>
        }
        controls={<Toggle value={liveOn} label="Play the live series" />}
      >
        <Plot title="A live series of 2,000 points" x={[0, 10]} y={[-1.5, 2.6]} series={LIVE_SERIES} aspect={{ desktop: 0.42, phone: 0.7 }} />
      </Figure>
    </div>
  );
}

// ── Plot: distributions ─────────────────────────────────────────────────────

const rng = mulberry32(7);
const SAMPLES = Array.from({ length: 1200 }, () => randn(rng));
const pdf = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
const binom = (n: number, k: number) => {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
};
const PMF = [0, 1, 2, 3, 4, 5, 6].map((k) => binom(6, k) * 0.5 ** 6);
const HIST: PlotSeries[] = [
  { kind: 'histogram', data: SAMPLES, bins: 24, range: [-3.5, 3.5], density: true, concept: 'prob' },
  { kind: 'function', f: pdf, concept: 'output', label: 'pdf' },
];
const BARS: PlotSeries[] = [{ kind: 'bars', values: PMF, labels: ['0', '1', '2', '3', '4', '5', '6'], concept: 'prob' }];

function Distributions() {
  return (
    <Figure
      name="g2-dists"
      caption="**Histogram, density and bars.** 1,200 normal samples as a density histogram under the normal pdf (left), and the Binomial(6, ½) probabilities as labelled bars (right)."
      description="Left: a density histogram of 1,200 standard normal samples with the bell-shaped normal density drawn over it. Right: seven bars for the binomial distribution with n = 6 and p = one half, tallest in the middle."
    >
      <div class="g2-pair">
        <Plot title="Histogram of 1,200 normal samples with the normal density" x={[-3.5, 3.5]} y="auto" series={HIST} aspect={{ desktop: 0.75, phone: 0.75 }} />
        <Plot title="Binomial(6, 1/2) probabilities" x={[-0.7, 6.7]} y={[-0.04, 0.36]} series={BARS} aspect={{ desktop: 0.75, phone: 0.75 }} />
      </div>
    </Figure>
  );
}

// ── Plot: a loss landscape (heat + contours + GD path) ──────────────────────

const loss = (x: number, y: number) => 0.5 * x * x + 2.2 * y * y + 0.6 * x * y;
const gradL = (p: Vec2): Vec2 => [p[0] + 0.6 * p[1], 4.4 * p[1] + 0.6 * p[0]];
const eta = signal(0.18);
const gd = computed(() => gdPath(gradL, [-2.6, 1.4] as Vec2, eta.value, 30, { divergeAt: 50 }));
const gdPts = computed(() => gd.value.points as readonly Vec2[]);
const gdStop = computed(() => {
  const last = gd.value.points[gd.value.points.length - 1];
  return gd.value.stop === 'diverged' ? 'diverged!' : `after 30 steps: L = ${loss(last[0], last[1]).toFixed(3)}`;
});
const LANDSCAPE: PlotSeries[] = [
  { kind: 'heat', f: loss, concept: 'error', range: [0, 9], label: 'loss', layer: 'static' },
  { kind: 'contour', f: loss, levels: [0.25, 0.75, 1.5, 3, 5, 8], concept: 'error', labels: true, layer: 'static' },
  { kind: 'line', data: gdPts, concept: 'input' },
  { kind: 'points', data: gdPts, concept: 'input' },
];

function Landscape() {
  return (
    <Figure
      name="g2-landscape"
      wide
      caption="**Heat map + contours + a live path.** A loss landscape (sequential ramp with a key, labelled contours) and gradient descent from (−2.6, 1.4). The step size $\eta$ re-runs the path; only the path re-draws."
      description="A heat map of an elongated bowl, darker red where the loss is high, with labelled elliptical contour lines, and a blue zig-zag path of gradient-descent iterates heading for the minimum at the origin."
      readout={
        <Readout status={gdStop}>
          <ReadoutPair sym="$\eta$" concept="input" value={eta} />
        </Readout>
      }
      controls={<Slider value={eta} min={0.02} max={0.5} step={0.01} label="step size $\eta$" concept="input" />}
    >
      <Plot title="Loss landscape with a gradient-descent path" x={[-3, 3]} y={[-1.8, 1.8]} series={LANDSCAPE} xLabel="$w_1$" yLabel="$w_2$" aspect={{ desktop: 0.6, phone: 0.9 }} />
    </Figure>
  );
}

// ── Plot: diverging heat, field, parametric ─────────────────────────────────

const SADDLE: PlotSeries[] = [
  { kind: 'heat', f: (x, y) => x * x - y * y, scheme: 'diverging', concept: 'output', label: '$f$', layer: 'static' },
  { kind: 'contour', f: (x, y) => x * x - y * y, levels: [-3, -1.5, -0.5, 0.5, 1.5, 3], concept: 'output', labels: true, layer: 'static' },
];
const FIELD: PlotSeries[] = [
  { kind: 'field', F: (x, y) => [-y - 0.3 * x, x - 0.3 * y], concept: 'matrix' },
  { kind: 'parametric', f: (t) => [2.2 * Math.exp(-0.3 * t) * Math.cos(t), 2.2 * Math.exp(-0.3 * t) * Math.sin(t)], t: [0, 14], concept: 'input', label: 'a path' },
];

function SaddleAndField() {
  return (
    <Figure
      name="g2-saddle"
      caption="**Diverging heat and a vector field.** Left: $f = x^2 - y^2$ (positive in the concept's ink, negative in neutral ink, the key centred on 0, contours labelled so colour is never alone). Right: a spiral sink with one trajectory."
      description="Left: a saddle-shaped function shown as a diverging heat map with labelled hyperbolic contour lines. Right: a grid of small teal arrows circling inwards and a blue spiral path following them to the origin."
    >
      <div class="g2-pair">
        <Plot title="The saddle f = x² − y² as a diverging heat map" x={[-2, 2]} y={[-2, 2]} series={SADDLE} aspect={{ desktop: 1, phone: 1 }} />
        <Plot title="A spiral-sink vector field with a trajectory" x={[-2.5, 2.5]} y={[-2.5, 2.5]} series={FIELD} aspect={{ desktop: 1, phone: 1 }} />
      </div>
    </Figure>
  );
}

// ── Plot: Riemann sums ──────────────────────────────────────────────────────

const rn = signal(6);
const rule = signal<'left' | 'right' | 'mid' | 'trapezoid'>('left');
const rf = (x: number) => 0.25 * x * x * x - x * x + x + 2;
const RIEMANN: PlotSeries[] = [
  { kind: 'riemann', f: rf, a: 0, b: 4, n: rn, rule, concept: 'prob' },
  { kind: 'function', f: rf, concept: 'output', label: '$f$' },
];
const upper = signal(2.5);
const AREA: PlotSeries[] = [
  { kind: 'area', f: rf, from: 0, to: upper, concept: 'eigenvalue' },
  { kind: 'function', f: rf, concept: 'output' },
];

function Riemann() {
  return (
    <Figure
      name="g2-riemann"
      caption="**Riemann sums and shaded areas.** `n` and `rule` are signals: the Slider and the segmented control re-sample only the rectangles. Below, the area from 0 to an adjustable upper limit."
      description="A cubic curve over [0, 4] with Riemann rectangles under it, and a second plot shading the area under the same curve from 0 to an adjustable upper limit."
      controls={
        <>
          <Slider value={rn} min={1} max={40} step={1} label="$n$" concept="prob" />
          <Segmented
            value={rule}
            label="Rule"
            options={[
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
              { value: 'mid', label: 'Mid' },
              { value: 'trapezoid', label: 'Trapezoid' },
            ]}
          />
          <Slider value={upper} min={0.2} max={4} step={0.05} label="upper limit $b$" concept="eigenvalue" />
        </>
      }
    >
      <Plot title="Riemann sum under a cubic" x={[-0.3, 4.3]} y={[-0.4, 4.4]} series={RIEMANN} aspect={{ desktop: 0.5, phone: 0.8 }} />
      <Plot title="Area under the cubic up to b" x={[-0.3, 4.3]} y={[-0.4, 4.4]} series={AREA} aspect={{ desktop: 0.4, phone: 0.7 }} />
    </Figure>
  );
}


// ── MatrixGrid ──────────────────────────────────────────────────────────────

const M1 = signal<Mat2>([2, 1, 1, 2]);
const mv = signal<Vec2>([1.2, 0.3]);
const mAv = imageOf(M1, mv);
const mKept = computed(() => norm(mv.value) > 0.05 && angleBetween(mv.value, mAv.value) < 0.002);
const mDragEnds = signal(0);
const mLast = signal<Vec2 | null>(null);
function DragEnds() {
  return (
    <span class="g2-dev" data-drag-ends={mDragEnds.value}>
      dev · onDragEnd fired {mDragEnds.value} time{mDragEnds.value === 1 ? '' : 's'}
      {mLast.value ? ` (last ${formatLive(mLast.value)})` : ''}
    </span>
  );
}
const mStatus = computed(() => (mKept.value ? 'Same line as v: an eigenvector' : `turned ${((angleBetween(mv.value, mAv.value) * 180) / Math.PI).toFixed(1)}°`));

function MatrixEigen() {
  return (
    <Figure
      name="g2-mgrid-eigen"
      central
      wide
      interactive
      caption="**MatrixGrid with a vector and its image.** Drag $\cInput$ (or the tips of $\ihat$ and $\jhat$, which rewrite the matrix). The rose lines are the eigen-directions; on them $\cOutput$ lands on the same line."
      description="The plane transformed by the matrix [[2, 1], [1, 2]]: a faint teal transformed grid, the unit square mapped to a parallelogram of area 3, two rose eigen-direction lines, a blue input vector v and its dashed orange image Av."
      readout={
        <Readout status={mStatus} correct={mKept}>
          <ReadoutPair sym="$\vec v$" concept="input" value={mv} />
          <span class="readout__sep">↦</span>
          <ReadoutPair sym="$A\vec v$" concept="output" value={mAv} />
        </Readout>
      }
    >
      <MatrixGrid
        matrix={M1}
        title="The plane under a 2×2 matrix, with an input vector v and its image Av."
        show={{ eigen: true }}
        vectors={[
          {
            value: mv,
            concept: 'input',
            label: 'the input arrow v',
            tex: '$\\cInput$',
            image: { concept: 'output', label: 'its image Av', tex: '$\\cOutput$' },
            onDragEnd: (p) => {
              mDragEnds.value++;
              mLast.value = p;
            },
          },
        ]}
      />
    </Figure>
  );
}

const M2 = signal<Mat2>([1, 1, 1, -0.5]);

function MatrixEntries() {
  return (
    <Figure
      name="g2-mgrid-entries"
      caption="**Editable entries and a flipped orientation.** Step the entries (arrows on a focused entry, Shift ×5) or drag the tips. A negative determinant hatches the square and says *orientation flipped* in words."
      description="A matrix with a negative determinant: the unit square becomes a hatched parallelogram, and the panel under the plane shows the four entries with minus and plus steppers and the sentence det = −1.50, orientation flipped."
      keys="Tab to an entry and use ↑ ↓ (Shift ×5), or Tab to a tip and use the arrow keys."
    >
      <MatrixGrid matrix={M2} title="A matrix with editable entries whose determinant is negative." editable="both" hint={false} aspect={{ desktop: 0.55, phone: 0.9 }} />
    </Figure>
  );
}

const M3 = signal<Mat2>([1, 2, 0.5, 1]);
const M4 = signal<Mat2>([0.8, -1.3, 1.3, 0.8]);
const morphT = signal(0.35);

function MatrixStates() {
  return (
    <Figure
      name="g2-mgrid-states"
      caption="**Collapse, rotation, morph.** Left: $\det = 0$ squashes the plane onto a line (the panel says so). Right: a rotation-and-scale has no real eigen-directions; the slider morphs from the identity ($t = 0$) to the matrix ($t = 1$) through `lerpMat2`."
      description="Left: a singular matrix that collapses the grid onto one line. Right: a rotation-and-scale matrix shown part way through a morph from the identity."
      controls={<Slider value={morphT} min={0} max={1} step={0.01} label="morph $t$" />}
    >
      <div class="g2-pair">
        <MatrixGrid matrix={M3} title="A singular matrix squashing the plane onto a line." editable={false} hint={false} show={{ eigen: true }} aspect={{ desktop: 0.9, phone: 0.9 }} />
        <MatrixGrid matrix={M4} morph={morphT} title="A rotation-and-scale, morphing from the identity." editable={false} hint={false} show={{ eigen: true }} aspect={{ desktop: 0.9, phone: 0.9 }} />
      </div>
    </Figure>
  );
}


// ── Stage3D ─────────────────────────────────────────────────────────────────

const loss3 = (x: number, y: number) => 0.35 * x * x + 1.1 * y * y + 0.5 * Math.sin(1.6 * x) + 1.2;
const grad3 = (p: Vec2): Vec2 => [0.7 * p[0] + 0.8 * Math.cos(1.6 * p[0]), 2.2 * p[1]];
const GD3 = gdPath(grad3, [-2.6, 1.6] as Vec2, 0.32, 24).points as Vec2[];
const gdFrame = signal(0);
const ball = computed<Vec3>(() => {
  const p = GD3[gdFrame.value];
  return [p[0], p[1], loss3(p[0], p[1])];
});
const trail = computed<Vec3[]>(() => GD3.slice(0, gdFrame.value + 1).map((p) => [p[0], p[1], loss3(p[0], p[1])]));
const B3 = { x: [-3, 3], y: [-2, 2], z: [0, 9.5] } as const;
const builds = (raw: string) => `dev · surface mesh builds: ${raw}`;

function BuildCounter({ of }: { of: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>(`[data-figure="${of}"] .stage3d`);
      if (ref.current && el?.dataset.builds) ref.current.textContent = builds(el.dataset.builds);
    }, 250);
    return () => window.clearInterval(id);
  }, [of]);
  return <span class="g2-dev" ref={ref} data-counter={`${of}:builds`} />;
}

function LossSurface() {
  return (
    <Figure
      name="g2-surface"
      wide
      caption="**Stage3D: a loss surface and gradient descent.** A 60×60 surface with contours; the ball and its path are signals driven by the timeline, so stepping never rebuilds the mesh (see the counter). Drag to orbit, or focus the plate and use the arrow keys."
      description="A bumpy bowl-shaped surface seen from above at an angle, with contour lines, and a blue ball that steps down it along a blue path as the timeline advances."
      readout={
        <>
          <ReadoutPair sym="step" value={gdFrame} decimals={0} />
          <ReadoutPair sym="$L$" concept="error" value={() => ball.value[2]} />
        </>
      }
      controls={<PlayScrub frame={gdFrame} count={GD3.length} fps={4} name="Gradient-descent steps" label={(i) => `step ${i}`} />}
      keys="Drag to orbit (one finger sideways on a phone; up and down scrolls the page). Focused: ← → turn, ↑ ↓ tilt, + − zoom, 0 resets."
    >
      <Stage3D title="A loss surface with a gradient-descent path" bounds={B3} box="cube" fallback="A bumpy bowl with a ball rolling to its lowest point; 3D could not be drawn here." axisNames={{ x: 'w₁', y: 'w₂', z: 'L' }}>
        <Surface f={loss3} x={B3.x} y={B3.y} resolution={60} concept="error" contours />
        <Polyline3D points={trail} concept="input" />
        <Point3D at={ball} concept="input" r={7} label="$\boldsymbol{w}_t$" />
      </Stage3D>
    </Figure>
  );
}

const helix = (t: number): Vec3 => [1.6 * Math.cos(t), 1.6 * Math.sin(t), -2 + t / 3];
const swirl = (x: number, y: number, z: number): Vec3 => [-y, x, 0.4 * z];
const PLANE_N: Vec3 = [0.3, -0.4, 1];
const PLANE_P: Vec3 = [0, 0, 0];

function SpaceScene() {
  return (
    <Figure
      name="g2-space"
      caption="**Fields, curves, planes and vectors.** A swirling vector field, a helix, a translucent plane and two vectors (it turns slowly until you touch it; never under reduced motion)."
      description="A 3D box containing small teal arrows circling the vertical axis, a purple helix climbing through them, a translucent rose plane through the origin and two arrows from the origin."
    >
      <Stage3D title="A vector field, a helix, a plane and two vectors in space" bounds={{ x: [-2, 2], y: [-2, 2], z: [-2, 2] }} autoRotate fallback="A vector field, a helix and a plane in a box; 3D could not be drawn here.">
        <VectorField3D F={swirl} density={4} concept="matrix" />
        <Curve3D f={helix} t={[0, 12]} concept="prob" />
        <Plane3D normal={PLANE_N} point={PLANE_P} concept="eigenvalue" size={1.6} />
        <Vector3D to={[1.5, 0.5, 1.2]} concept="input" label="$\vec u$" />
        <Vector3D to={[-0.8, 1.4, 0.6]} concept="output" label="$\vec w$" />
      </Stage3D>
    </Figure>
  );
}

function Fallback3D() {
  return (
    <Figure name="g2-fallback3d" caption="**The fallback state.** When 3D can't render (no canvas), the plate shows the `fallback` caption instead of a blank box." description="A plate with a sentence describing the scene in place of the 3D view.">
      <Stage3D title="A surface that could not be drawn" bounds={B3} forceFallback fallback="*Here:* a bowl-shaped surface whose lowest point is at the origin; drag it on a device with a canvas to see it in 3D." aspect={{ desktop: 0.3, phone: 0.5 }}>
        <Surface f={loss3} x={B3.x} y={B3.y} />
      </Stage3D>
    </Figure>
  );
}

const M3D = signal<Mat3>([1, 0.5, 0, 0, 1, 0, 0, 0.5, -1]);
const M3B = signal<Mat3>([1.5, 0, 0, 0.5, 1, 0, 0, 0, 0.8]);
const m3morph = signal(1);

function Matrix3DEntries() {
  return (
    <Figure
      name="g2-mgrid3"
      wide
      caption="**MatrixGrid3D: the determinant as volume.** Step the 3×3 entries: the unit cube becomes a parallelepiped whose signed volume is det; negative hatches the faces and says *orientation flipped*; zero flattens it. Rose double rules are the real eigen-directions."
      description="A 3D lattice transformed by a 3×3 matrix with a negative determinant: the unit cube becomes a hatched parallelepiped, the basis arrows î, ĵ and k̂ point along its edges, and rose lines mark the matrix's eigen-directions. Under it, a 3×3 grid of entries with steppers."
      keys="Tab to an entry, then ↑ ↓ (Shift ×5). Drag the view to orbit; focused: ← → ↑ ↓ turn, 0 resets."
    >
      <MatrixGrid3D matrix={M3D} title="A 3×3 matrix acting on space, with editable entries." fallback="A lattice transformed by a 3×3 matrix; 3D could not be drawn here." show={{ eigen: true }} />
    </Figure>
  );
}

function Matrix3DBasis() {
  return (
    <Figure
      name="g2-mgrid3-basis"
      caption="**Dragging î, ĵ, k̂ in space, and the morph.** Drag a tip (it moves in the plane facing you; keys: ← → x, ↑ ↓ y, PageUp/PageDown z). The slider morphs from the identity."
      description="A 3D lattice with three draggable basis tips and a slider that morphs space from the identity to the matrix."
      controls={<Slider value={m3morph} min={0} max={1} step={0.01} label="morph $t$" />}
    >
      <MatrixGrid3D matrix={M3B} morph={m3morph} title="Basis vectors you can drag in space." fallback="Three basis arrows in space; 3D could not be drawn here." editable="basis" aspect={{ desktop: 0.7, phone: 0.94 }} />
    </Figure>
  );
}

export const gallery: GalleryGroup = {
  id: 'visual',
  title: 'Visuals',
  owner: 'G2',
  blurb: 'Stage2D and its primitives, Plot, MatrixGrid, Stage3D and MatrixGrid3D. Every handle drags with mouse and touch and moves with the arrow keys.',
  demos: [
    {
      id: 'stage2d-eigen',
      title: 'Stage2D · handle, focal pair, found state',
      component: 'Stage2D, Vector, Handle, Band',
      notes: 'The first handle breathes and carries the hand-lettered hint until the first touch. Dragging lights the input concept everywhere. The dev counter shows the static layer rendering only at load while the dynamic layer follows the drag.',
      wide: true,
      render: () => (
        <>
          <EigenPlay />
          <DevCounter of="g2-eigen" attr="renders" format={renderCount} />
        </>
      ),
    },
    { id: 'stage2d-found', title: 'Stage2D · found (correct) state', component: 'Handle, Vector, Band correct', render: () => <FoundState /> },
    { id: 'stage2d-constraints', title: 'Stage2D · constraints and snapping', component: 'Handle', render: () => <Constraints /> },
    { id: 'stage2d-primitives', title: 'Stage2D · primitives', component: 'Vector, Segment, Line, Point, Curve, Polygon, Arc, Label', render: () => <Primitives /> },
    { id: 'stage2d-panzoom', title: 'Stage2D · pan and zoom', component: 'Stage2D pan zoom', render: () => <PanZoom /> },
    {
      id: 'plot-tangent',
      title: 'Plot · a tangent driven by a handle',
      component: 'Plot, Handle',
      render: () => (
        <>
          <TangentPlot />
          <DevCounter of="g2-tangent" attr="samples" format={sampleCount} />
          <DevCounter of="g2-tangent" attr="renders" format={renderCount} />
        </>
      ),
    },
    { id: 'plot-linked', title: 'Plot · linked cursor', component: 'Plot cursor', render: () => <LinkedPlots /> },
    { id: 'plot-live', title: 'Plot · live series', component: 'Plot line', render: () => <LivePlot /> },
    { id: 'plot-dists', title: 'Plot · histogram and bars', component: 'Plot histogram, bars', render: () => <Distributions /> },
    { id: 'plot-landscape', title: 'Plot · heat map, contours, path', component: 'Plot heat, contour, line, points', wide: true, render: () => <Landscape /> },
    { id: 'plot-saddle', title: 'Plot · diverging heat and fields', component: 'Plot heat, field, parametric', render: () => <SaddleAndField /> },
    { id: 'plot-riemann', title: 'Plot · Riemann sums and areas', component: 'Plot riemann, area', render: () => <Riemann /> },
    {
      id: 'mgrid-eigen',
      title: 'MatrixGrid · a vector and its image',
      component: 'MatrixGrid, imageOf',
      wide: true,
      render: () => (
        <>
          <MatrixEigen />
          <DragEnds />
        </>
      ),
    },
    { id: 'mgrid-entries', title: 'MatrixGrid · editable entries, flipped orientation', component: 'MatrixGrid editable', render: () => <MatrixEntries /> },
    { id: 'mgrid-states', title: 'MatrixGrid · collapse, rotation and morph', component: 'MatrixGrid morph', render: () => <MatrixStates /> },
    {
      id: 'stage3d-surface',
      title: 'Stage3D · a surface with a moving ball',
      component: 'Stage3D, Surface, Polyline3D, Point3D',
      wide: true,
      render: () => (
        <>
          <LossSurface />
          <BuildCounter of="g2-surface" />
        </>
      ),
    },
    { id: 'stage3d-space', title: 'Stage3D · fields, curves, planes', component: 'VectorField3D, Curve3D, Plane3D, Vector3D', render: () => <SpaceScene /> },
    { id: 'stage3d-fallback', title: 'Stage3D · fallback caption', component: 'Stage3D fallback', render: () => <Fallback3D /> },
    { id: 'mgrid3-entries', title: 'MatrixGrid3D · determinant as volume', component: 'MatrixGrid3D', wide: true, render: () => <Matrix3DEntries /> },
    { id: 'mgrid3-basis', title: 'MatrixGrid3D · basis drag and morph', component: 'MatrixGrid3D editable basis', render: () => <Matrix3DBasis /> },
  ],
};
