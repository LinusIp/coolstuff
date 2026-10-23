/**
 * The central interactive (§4.3 Play): a ball rolling downhill on a loss map.
 *
 * A contour map of a two-parameter loss (shaded: deeper orange = higher
 * loss). The ring is where the ball starts; the dotted trail is every step
 * gradient descent takes from there, one dot per step, for 40 steps; the
 * ball sits at the current step of the timeline. The learning-rate slider
 * reshapes the whole trail as you drag it: tiny rates crawl and stop short,
 * good rates arrive, big rates zig-zag across the valley, and too big throws
 * the ball off the map. Three landscapes: a round bowl, a long tilted valley
 * (the default) and a surface with two dips. No formulas here (§4.3).
 *
 * Page-level state lives in this module (only lesson.tsx imports it).
 */
import { computed, effect, signal, type ReadonlySignal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import {
  Figure,
  Handle,
  PlayScrub,
  Plot,
  Polyline,
  Readout,
  ReadoutPair,
  Segmented,
  Slider,
  formatNumber,
  useStage,
  type PlotSeries,
} from '@kit';
import type { Vec2 } from '@kit/math';
import { LANDSCAPES, LANDSCAPE_IDS, arrivedBy, describeRun, pointAt, runGD, type Landscape, type LandscapeId, type Run } from './math';

// ── State ───────────────────────────────────────────────────────────────────

/** Steps per run (the timeline has STEPS + 1 frames: the start and 40 steps). */
export const STEPS = 40;
export const ETA_MIN = 0.005;
export const ETA_MAX = 1.5;

export const landId = signal<LandscapeId>('valley');
export const eta = signal(0.1);
export const start = signal<Vec2>(LANDSCAPES.valley.start);
/** The timeline: the ball sits on step `frame`; it opens on the last step, so the whole trail shows. */
export const frame = signal(STEPS);
const playing = signal(false);

const land = computed<Landscape>(() => LANDSCAPES[landId.value]);
export const run = computed<Run>(() => runGD(land.value, start.value, eta.value, STEPS));

/** The ball has left the map at this frame (a diverged run, at or past its exit step). */
const gone = computed(() => run.value.exitStep !== null && frame.value >= run.value.exitStep);
const ball = computed<Vec2>(() => pointAt(run.value, frame.value));
const lossNow = computed(() => {
  const r = run.value;
  return r.losses[Math.min(frame.value, r.losses.length - 1)];
});

/** Mission ticks stay ticked once earned. */
const FAST = 20;
const fastDone = signal(false);
const blewUp = signal(false);
effect(() => {
  const r = run.value;
  if (r.outcome === 'arrived' && r.settledAt !== null && r.settledAt <= FAST) fastDone.value = true;
  if (r.outcome === 'diverged') blewUp.value = true;
});

const fmt = (x: number, d = 2) => formatNumber(x, d);
const fmtEta = (v: number) => (v >= 1 ? formatNumber(v, 2) : v >= 0.1 ? formatNumber(v, 2) : v >= 0.01 ? formatNumber(v, 3) : formatNumber(v, 4)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

const status = computed(() => describeRun(run.value, land.value, STEPS, frame.value));
const arrived = computed(() => arrivedBy(run.value, frame.value));

// ── The map ─────────────────────────────────────────────────────────────────

/** Heat shading and contour lines for a landscape: sampled once per landscape and resize (static layer). */
function mapSeries(l: Landscape): PlotSeries[] {
  return [
    { kind: 'heat', f: l.loss, range: [0, l.heatMax], concept: 'loss', label: 'loss', layer: 'static', resolution: 120 },
    { kind: 'contour', f: l.loss, levels: [...l.levels], concept: 'loss', layer: 'static', resolution: 140 },
  ];
}
const SERIES: Readonly<Record<LandscapeId, PlotSeries[]>> = {
  bowl: mapSeries(LANDSCAPES.bowl),
  valley: mapSeries(LANDSCAPES.valley),
  bumpy: mapSeries(LANDSCAPES.bumpy),
};

/** The trail: steps already taken in full ink, steps still to come faint; one dot per iterate. */
function Trail() {
  const s = useStage();
  const r = run.value;
  const k = Math.min(frame.value, r.points.length - 1);
  const past = r.points.slice(0, k + 1);
  const ahead = r.points.slice(k);
  let dotsPast = '';
  let dotsAhead = '';
  const W = s.width;
  const H = s.height;
  r.points.forEach((p, i) => {
    if (i === 0 || (r.exitStep !== null && i === r.points.length - 1)) return;
    const q = s.toPx(p);
    if (q[0] < -4 || q[0] > W + 4 || q[1] < -4 || q[1] > H + 4) return;
    const rad = i <= k ? 3 : 2.5;
    const d = `M${(q[0] - rad).toFixed(1)} ${q[1].toFixed(1)}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0`;
    if (i <= k) dotsPast += d;
    else dotsAhead += d;
  });
  return (
    <>
      {ahead.length > 1 && <Polyline points={ahead} concept="params" emphasis="context" />}
      {past.length > 1 && <Polyline points={past} concept="params" emphasis="focal" />}
      <path class="s2-mark ct ct-params gd-dots gd-dots--ahead" d={dotsAhead} />
      <path class="s2-mark ct ct-params gd-dots" d={dotsPast} />
    </>
  );
}

/** A target at each minimum; the deepest one is filled, and turns green when the run settles there. */
function Targets() {
  const s = useStage();
  const l = land.value;
  const r = run.value;
  return (
    <g aria-hidden="true">
      {l.minima.map((m, i) => {
        const [x, y] = s.toPx(m.at);
        const hit = r.minimum === i && arrivedBy(r, frame.value);
        return (
          <g key={i} class={`s2-mark gd-target${m.global ? ' is-global' : ''}${hit ? ' is-correct' : ''}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <circle class="gd-target__ring" r={9} />
            <path class="gd-target__cross" d="M-5 0H5M0 -5V5" />
          </g>
        );
      })}
    </g>
  );
}

/** The ball at the current step (it glides between steps; instant under reduced motion). */
function Ball({ at, hidden }: { at: ReadonlySignal<Vec2>; hidden: ReadonlySignal<boolean> }) {
  const s = useStage();
  const [x, y] = s.toPx(at.value);
  if (hidden.value) return null;
  return (
    <g class="s2-mark ct ct-params gd-ball" style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }} aria-hidden="true">
      <circle r={8.5} />
      <circle class="gd-ball__shine" r={2.6} cx={-2.6} cy={-2.8} />
    </g>
  );
}

/** Where the trail leaves the visible map: an arrow on the edge, pointing the way the ball went. */
function ExitMark() {
  const s = useStage();
  const r = run.value;
  if (r.exitStep === null) return null;
  const v = s.view;
  const pts = r.points;
  // The first segment that leaves the visible view.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const inA = a[0] >= v.x[0] && a[0] <= v.x[1] && a[1] >= v.y[0] && a[1] <= v.y[1];
    const inB = b[0] >= v.x[0] && b[0] <= v.x[1] && b[1] >= v.y[0] && b[1] <= v.y[1];
    if (inA && !inB) {
      const pa = s.toPx(a);
      const pb = s.toPx(b);
      const W = s.width;
      const H = s.height;
      let t = 1;
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      if (dx > 0) t = Math.min(t, (W - 2 - pa[0]) / dx);
      if (dx < 0) t = Math.min(t, (2 - pa[0]) / dx);
      if (dy > 0) t = Math.min(t, (H - 2 - pa[1]) / dy);
      if (dy < 0) t = Math.min(t, (2 - pa[1]) / dy);
      const ex = pa[0] + dx * t;
      const ey = pa[1] + dy * t;
      const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      return (
        <g class="s2-mark ct ct-params gd-exit" transform={`translate(${ex.toFixed(1)} ${ey.toFixed(1)}) rotate(${ang.toFixed(1)})`} aria-hidden="true">
          <path d="M-16 -9L0 0L-16 9Z" />
        </g>
      );
    }
  }
  return null;
}

function StartHandle() {
  const l = land.value;
  return (
    <Handle
      value={start}
      label="where the ball starts"
      concept="params"
      bounds={l.view}
      step={0.1}
      valueText={(p) => `start at (${fmt(p[0])}, ${fmt(p[1])}), loss ${fmt(l.loss(p[0], p[1]))}`}
      onDragStart={() => (playing.value = false)}
    />
  );
}

function LossMap() {
  const l = land.value;
  return (
    <Plot
      title={`Loss map: ${l.name.toLowerCase()}, with the ball's path`}
      x={l.view.x}
      y={l.view.y}
      series={SERIES[l.id]}
      aspect={{ desktop: 0.7, phone: 0.94 }}
      hint="drag the start"
      xLabel="$\theta_1$"
      yLabel="$\theta_2$"
    >
      <Targets />
      <Trail />
      <ExitMark />
      <Ball at={ball} hidden={gone} />
      <StartHandle />
    </Plot>
  );
}

// ── The figure ──────────────────────────────────────────────────────────────

const LAND_OPTIONS = LANDSCAPE_IDS.map((id) => ({ value: id, label: LANDSCAPES[id].name }));

function pickLandscape(id: LandscapeId) {
  playing.value = false;
  start.value = [...LANDSCAPES[id].start];
}

export function PlayFigure() {
  const goals = useMemo(
    () => [
      { text: `Get the ball to the bottom in ${FAST} steps or fewer.`, done: fastDone },
      { text: 'Find a learning rate that throws the ball off the map.', done: blewUp },
    ],
    [],
  );
  return (
    <Figure
      name="gd-play"
      central
      wide
      interactive
      caption="A ball rolling downhill, one step at a time. Each dot is one step; the slider sets how big the steps are."
      description="A contour map of a loss surface, shaded darker where the loss is higher, with a target at the lowest point. A ring marks where a ball starts; a trail of dots shows the 40 steps gradient descent takes from there, and a ball sits on the current step of the timeline. A learning-rate slider changes the step size: small values make the trail crawl and stop short of the target, moderate values reach it, larger ones zig-zag across the valley, and too large makes the trail leave the map. A segmented control switches between a round bowl, a long tilted valley and a surface with two dips."
      readout={
        <Readout status={status} correct={arrived}>
          <ReadoutPair sym="step" value={<span>{Math.min(frame.value, STEPS)}</span>} />
          <ReadoutPair concept="loss" sym="loss" value={<span>{gone.value ? 'off the chart' : fmt(lossNow.value, lossNow.value < 1 ? 3 : 2)}</span>} />
        </Readout>
      }
      controls={
        <>
          <PlayScrub frame={frame} count={STEPS + 1} playing={playing} fps={8} name="Steps" label={(i) => (i === 0 ? 'start' : `step ${i}`)} />
          <Slider value={eta} min={ETA_MIN} max={ETA_MAX} scale="log" sig={2} label="learning rate" concept="rate" format={fmtEta} valueText={(v) => `learning rate ${fmtEta(v)}`} />
          <Segmented value={landId} options={LAND_OPTIONS} label="Landscape" onChange={pickLandscape} />
        </>
      }
      mission={{ goals }}
      legend={[
        { concept: 'params', label: 'the ball and its path (one dot per step)' },
        { concept: 'loss', label: 'lines of equal loss; darker = higher' },
        { label: 'the lowest point' },
      ]}
    >
      <LossMap />
    </Figure>
  );
}
