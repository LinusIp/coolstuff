/**
 * The central interactive (§4.3 Play): a car in stop-and-go traffic.
 *
 * Left, the car's position–time graph s(t). The ring P sits at the moment t;
 * a second point Q sits a short time h later. The line through P and Q (the
 * secant) is drawn in the rate ink with its run h (teal) and its rise Δs
 * (orange); the tangent at P is the soft band it swings onto as h shrinks.
 * Along the right edge, a road shares the graph's vertical scale, so the car
 * (at s(t)) and its ghost (at s(t + h)) are exactly as far apart as the rise.
 * Beside the graph, the speedometer: its needle is the car's instantaneous
 * speed, and the rose pointer is the average speed over the next h seconds,
 * Δs ÷ h, which closes in on the needle as h → 0. No formulas here (§4.3).
 *
 * Page-level state lives in this module (only lesson.tsx imports it).
 */
import { computed, effect, signal, type ReadonlySignal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import {
  Band,
  Curve,
  Figure,
  Handle,
  IconPause,
  IconPlay,
  Label,
  Line,
  Point,
  Readout,
  ReadoutPair,
  RichText,
  Segment,
  Slider,
  Stage2D,
  formatNumber,
  useInView,
  useReducedMotion,
  useStage,
  type ViewBox,
} from '@kit';
import type { Vec2 } from '@kit/math';
import {
  GAUGE_MAX,
  H_MAX,
  H_MIN,
  TRIP_END,
  clampMoment,
  closeWithin,
  dialPoint,
  gaugeAngle,
  secant,
  settledDecimals,
  tripPosition,
  tripSpeed,
} from './math';

// ── State ───────────────────────────────────────────────────────────────────

const T0 = 4;
/** The step h (s): a log slider from 2 s down to 0.001 s. */
export const h = signal(H_MAX);
/** The ring P on the curve: (t, s(t)). */
export const P = signal<Vec2>([T0, tripPosition(T0)]);

const t = computed(() => P.value[0]);
const sec = computed(() => secant(tripPosition, t.value, h.value));
const speed = computed(() => tripSpeed(t.value));
const decimals = computed(() => settledDecimals(h.value));
/** The average speed is within 0.01 m/s of the speedometer: the secant has all but become the tangent. */
const agree = computed(() => closeWithin(sec.value.slope, speed.value));
/** The car stands still in the queue (the flat point at t = 6, not the start). */
const standstill = computed(() => t.value > 4.5 && t.value < 7.5 && speed.value < 0.05);
const Q = computed<Vec2>(() => sec.value.q);
const corner = computed<Vec2>(() => [sec.value.q[0], sec.value.p[1]]);
/** A second point on the secant one second after P (so tiny h never costs precision when drawing the line). */
const secantFar = computed<Vec2>(() => [t.value + 1, sec.value.p[1] + sec.value.slope]);
const tangentDir = computed<Vec2>(() => [1, speed.value]);

/** Mission ticks stay ticked once earned. */
const matched = signal(false);
const foundStop = signal(false);
const driving = signal(false);

/** Narrow no-break space between a number and its unit (NOTATION.md §7). */
const NB = '\u202f';
const fmt = (x: number, d = 2) => formatNumber(x, d);
const fmtH = (v: number) => (v >= 0.1 ? formatNumber(v, v >= 1 ? 1 : 2) : v >= 0.01 ? formatNumber(v, 3) : formatNumber(v, 4)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

const VIEW: ViewBox = { x: [-1.3, 13.7], y: [-4, 52] };
/** The road strip (world x), right of the trip's last second. */
const ROAD: [number, number] = [12.65, 13.6];

// ── The graph ───────────────────────────────────────────────────────────────

/** The road bed along the right edge (static: drawn once per resize). */
function RoadBed() {
  const s = useStage();
  const xa = s.toPx([ROAD[0], 0])[0];
  const xb = s.toPx([ROAD[1], 0])[0];
  const xm = (xa + xb) / 2;
  const H = s.height;
  let marks = '';
  for (let m = 0; m <= 50; m += 10) {
    const y = s.toPx([0, m])[1];
    marks += `M${xa} ${y}h5M${xb} ${y}h-5`;
  }
  return (
    <g class="dv-road" aria-hidden="true">
      <rect class="dv-road__bed" x={xa} y={-2} width={xb - xa} height={H + 4} />
      <path class="dv-road__edge" d={`M${xa} 0V${H}M${xb} 0V${H}${marks}`} />
      <path class="dv-road__lane" d={`M${xm} 0V${H}`} />
    </g>
  );
}

/** A top-down car on the road, driving up the page (towards larger s), centred at position `at`. */
function Car({ at, ghost }: { at: ReadonlySignal<number>; ghost?: boolean }) {
  const s = useStage();
  const xa = s.toPx([ROAD[0], 0])[0];
  const xb = s.toPx([ROAD[1], 0])[0];
  const w = Math.max(14, Math.min(24, (xb - xa) * 0.6));
  const L = w * 1.8;
  const cx = (xa + xb) / 2;
  const cy = s.toPx([0, at.value])[1];
  return (
    <g class={`dv-car ct ct-output${ghost ? ' is-ghost' : ''}`} transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)})`} aria-hidden="true">
      <rect class="dv-car__body" x={-w / 2} y={-L / 2} width={w} height={L} rx={w * 0.3} />
      {!ghost && (
        <>
          <rect class="dv-car__glass" x={-w / 2 + 3} y={-L / 2 + L * 0.2} width={w - 6} height={L * 0.17} rx={2} />
          <rect class="dv-car__glass" x={-w / 2 + 3} y={L / 2 - L * 0.27} width={w - 6} height={L * 0.11} rx={2} />
        </>
      )}
    </g>
  );
}

/** Dotted guides from P and Q across to the car and its ghost, and the Δs gap along the road's edge. */
function Guides() {
  const s = useStage();
  const xr = s.toPx([ROAD[0], 0])[0];
  const p = s.toPx(sec.value.p);
  const q = s.toPx(sec.value.q);
  const xe = xr - 7;
  return (
    <g aria-hidden="true">
      <path class="fig-guide" d={`M${p[0].toFixed(1)} ${p[1].toFixed(1)}H${xr}M${q[0].toFixed(1)} ${q[1].toFixed(1)}H${xr}`} />
      <g class="ct ct-output dv-gap">
        <path class="fig-line" d={`M${xe} ${p[1].toFixed(1)}V${q[1].toFixed(1)}`} stroke-dasharray="6.4 4" />
      </g>
    </g>
  );
}

/** Leg labels, hidden when the triangle is too small to hold them. */
function LegLabels() {
  const s = useStage();
  const run = s.toPx(corner.value)[0] - s.toPx(sec.value.p)[0];
  const rise = s.toPx(corner.value)[1] - s.toPx(sec.value.q)[1];
  const c = corner.value;
  const p = sec.value.p;
  const q = sec.value.q;
  return (
    <>
      {run > 26 && <Label at={[(p[0] + c[0]) / 2, p[1]]} text="$h$" concept="h" anchor="s" gap={6} focusable={false} />}
      {rise > 22 && <Label at={[c[0], (c[1] + q[1]) / 2]} text="$\Delta s$" concept="output" anchor="e" gap={8} focusable={false} />}
    </>
  );
}

/**
 * Axis names placed by hand: the kit sets the x name at the plate's right
 * edge (here, on the road) and the y name beside the top tick label.
 */
function AxisNames() {
  return (
    <>
      <Label at={[0, VIEW.y[1]]} text="$s$ (m)" anchor="se" gap={2} focusable={false} />
      <Label at={[ROAD[0] - 0.15, 0]} text="$t$ (s)" anchor="nw" gap={4} focusable={false} />
    </>
  );
}

function MomentHandle() {
  const hi = TRIP_END - h.value;
  return (
    <Handle
      value={P}
      constrain={{ curve: tripPosition }}
      bounds={{ x: [0, hi], y: VIEW.y }}
      label="the moment t, on the position graph"
      concept="input"
      step={0.1}
      valueText={(v) => `t = ${fmt(v[0])} seconds, position ${fmt(v[1])} metres, speedometer ${fmt(tripSpeed(v[0]))} metres per second`}
      onDragStart={() => (driving.value = false)}
    />
  );
}

const TRIP_POS = computed(() => tripPosition(t.value));
const GHOST_POS = computed(() => sec.value.q[1]);

function TripGraph() {
  return (
    <Stage2D
      view={VIEW}
      equalScale={false}
      aspect={{ desktop: 0.66, phone: 0.92 }}
      title="The car's position s in metres against time t in seconds, with a secant through the moments t and t + h, the tangent at t, and a road along the right edge."
      axes
      hint="drag the ring"
      static={
        <>
          <RoadBed />
          <Curve f={tripPosition} domain={[0, TRIP_END]} />
        </>
      }
    >
      <AxisNames />
      <Band through={P} direction={tangentDir} concept="rate" label="tangent" correct={agree} />
      <Guides />
      <Segment a={P} b={corner} concept="h" emphasis="focal" />
      <Segment a={corner} b={Q} concept="output" emphasis="focal" />
      <Line through={[P, secantFar]} concept="rate" emphasis="focal" correct={agree} />
      <LegLabels />
      <Point at={Q} r={4.5} />
      <Car at={GHOST_POS} ghost />
      <Car at={TRIP_POS} />
      <MomentHandle />
    </Stage2D>
  );
}

// ── The speedometer ─────────────────────────────────────────────────────────

/** Dial geometry in its own viewBox (180 × 112): drawn near 1:1 so ticks stay legible. */
const CX = 90;
const CY = 84;
const R = 72;

function Speedometer() {
  const v = speed.value;
  const avg = sec.value.slope;
  const ok = agree.value;
  const aV = gaugeAngle(v);
  const aA = gaugeAngle(avg);
  const ticks: string[] = [];
  const labels: { k: number; x: number; y: number }[] = [];
  for (let k = 0; k <= GAUGE_MAX; k++) {
    const a = gaugeAngle(k);
    const [x1, y1] = dialPoint(CX, CY, R, a);
    const [x2, y2] = dialPoint(CX, CY, R - (k % 2 === 0 ? 9 : 5), a);
    ticks.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
    if (k % 2 === 0) {
      const [lx, ly] = dialPoint(CX, CY, R - 20, a);
      labels.push({ k, x: lx, y: ly + 4.5 });
    }
  }
  const needleTip = dialPoint(CX, CY, R - 28, aV);
  const ptrIn = dialPoint(CX, CY, R - 22, aA);
  const ptrTip = dialPoint(CX, CY, R + 1, aA);
  const left = dialPoint(CX, CY, R + 10, aA + 0.08);
  const right = dialPoint(CX, CY, R + 10, aA - 0.08);
  const d = decimals.value;
  return (
    <div class="dv-gauge">
      <svg class="dv-gauge__dial" viewBox="0 0 180 112" role="img" aria-label={`Speedometer: ${fmt(v)} metres per second. Average speed over the next ${fmtH(h.value)} seconds: ${fmt(avg, d)} metres per second.`}>
        <path class="dv-gauge__arc" d={`M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`} />
        <path class="fig-axis" d={ticks.join('')} />
        {labels.map((l) => (
          <text key={l.k} class="fig-tick" x={l.x.toFixed(1)} y={l.y.toFixed(1)} text-anchor="middle">
            {l.k}
          </text>
        ))}
        <text class="fig-note" x={CX} y={CY + 22} text-anchor="middle">
          m/s
        </text>
        <g class={`dv-gauge__avg ct ${ok ? 'ct-correct' : 'ct-rate'}`}>
          <path class="fig-line" d={`M${ptrIn[0].toFixed(1)} ${ptrIn[1].toFixed(1)}L${ptrTip[0].toFixed(1)} ${ptrTip[1].toFixed(1)}`} />
          <path class="fig-head" d={`M${ptrTip[0].toFixed(1)} ${ptrTip[1].toFixed(1)}L${left[0].toFixed(1)} ${left[1].toFixed(1)}L${right[0].toFixed(1)} ${right[1].toFixed(1)}Z`} />
        </g>
        <path class="dv-gauge__needle" d={`M${CX} ${CY}L${needleTip[0].toFixed(1)} ${needleTip[1].toFixed(1)}`} />
        <circle class="dv-gauge__hub" cx={CX} cy={CY} r={6} />
      </svg>
      <dl class="dv-gauge__vals">
        <div class="dv-gauge__val">
          <dt>
            <span class="dv-swatch dv-swatch--needle" aria-hidden="true" />
            speedometer
          </dt>
          <dd>{fmt(v, d)}{NB}m/s</dd>
        </div>
        <div class={`dv-gauge__val ct ${ok ? 'ct-correct' : 'ct-rate'}`}>
          <dt>
            <span class="dv-swatch dv-swatch--ptr" aria-hidden="true" />
            <RichText inline text="average over the next [$h$]{h}" />
          </dt>
          <dd>{fmt(avg, d)}{NB}m/s</dd>
        </div>
      </dl>
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function DriveButton() {
  const on = driving.value;
  return (
    <button type="button" class="btn btn--sm dv-drive" aria-pressed={on ? 'true' : 'false'} onClick={() => toggleDrive()}>
      {on ? <IconPause /> : <IconPlay />}
      {on ? 'Pause' : 'Drive'}
    </button>
  );
}

function toggleDrive() {
  if (driving.peek()) {
    driving.value = false;
    return;
  }
  const end = TRIP_END - h.peek();
  if (P.peek()[0] >= end - 1e-6) setMoment(0);
  driving.value = true;
}

function setMoment(tt: number) {
  const c = clampMoment(tt, h.peek());
  P.value = [c, tripPosition(c)];
}

/** Real-time driving (1 s of trip per second); under reduced motion, half-second jumps twice a second. */
function useDrive(el: Element | null) {
  const reduced = useReducedMotion();
  const inView = useInView(el);
  useEffect(() => {
    if (!inView) driving.value = false;
  }, [inView]);
  useEffect(
    () =>
      effect(() => {
        if (!driving.value) return;
        let raf = 0;
        let last = performance.now();
        let acc = 0;
        const tick = (now: number) => {
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          const end = TRIP_END - h.peek();
          let next = P.peek()[0];
          if (reduced) {
            acc += dt;
            if (acc >= 0.5) {
              acc = 0;
              next += 0.5;
            }
          } else next += dt;
          if (next >= end) {
            setMoment(end);
            driving.value = false;
            return;
          }
          if (next !== P.peek()[0]) setMoment(next);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      }),
    [reduced],
  );
}

// ── The figure ──────────────────────────────────────────────────────────────

const status = computed(() => {
  if (agree.value) return `Within 0.01${NB}m/s of the speedometer: the secant has all but become the tangent.`;
  if (standstill.value) return 'Standing still: the graph is flat here, and the speedometer reads 0.';
  return `Off by ${fmt(Math.abs(sec.value.slope - speed.value), decimals.value)}${NB}m/s.`;
});

export function TripPlay() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useDrive(el);
  // Keep t + h on the trip when h grows; tick the missions once earned.
  useEffect(
    () =>
      effect(() => {
        const hh = h.value;
        const tt = P.peek()[0];
        if (tt > TRIP_END - hh) P.value = [TRIP_END - hh, tripPosition(TRIP_END - hh)];
      }),
    [],
  );
  useEffect(
    () =>
      effect(() => {
        if (agree.value) matched.value = true;
        if (standstill.value) foundStop.value = true;
      }),
    [],
  );
  return (
    <Figure
      name="derivative-play"
      central
      wide
      caption="**Stop-and-go traffic.** The graph is the car's position against time; the road on its right edge shares the graph's height scale. Shrink $h$ and watch the line through the two moments, and the average speed, close in."
      description="A graph of a car's position s, in metres, against time t, in seconds, over 12 seconds of stop-and-go traffic: the car starts from rest, speeds up to 8 metres per second at 3 seconds, brakes to a standstill at 6 seconds, then speeds up again. A draggable ring P marks the moment t on the curve and a second point Q marks the moment t plus h. A line through P and Q, with a teal horizontal leg h and an orange vertical leg for the distance covered, swings onto the soft tangent band at P as h shrinks. A road along the right edge, on the same vertical scale, shows the car at its position and a ghost car h seconds later. Beside the graph, a speedometer from 0 to 10 metres per second: its needle shows the car's speed at the moment t, and a rose pointer shows the average speed over the next h seconds."
      readout={
        <Readout status={status} correct={agree}>
          <ReadoutPair concept="input" sym="$t$" value={<>{fmt(t.value)}{NB}s</>} />
          <ReadoutPair concept="h" sym="$h$" value={<>{fmtH(h.value)}{NB}s</>} />
          <ReadoutPair concept="output" sym="$\Delta s$" value={<>{fmt(sec.value.rise, decimals.value + 1)}{NB}m</>} />
          <ReadoutPair concept="rate" sym="$\Delta s \div h$" value={<>{fmt(sec.value.slope, decimals.value)}{NB}m/s</>} />
        </Readout>
      }
      controls={
        <div class="dv-controls">
          <Slider
            value={h}
            min={H_MIN}
            max={H_MAX}
            scale="log"
            label="$h$, a short time later"
            concept="h"
            detents={[
              { value: 1, label: `1${NB}s` },
              { value: 0.1, label: `0.1${NB}s` },
              { value: 0.01, label: `0.01${NB}s` },
              { value: 0.001, label: `0.001${NB}s` },
            ]}
            format={(v) => `${fmtH(v)}${NB}s`}
            valueText={(v) => `h = ${fmtH(v)} seconds`}
          />
          <DriveButton />
        </div>
      }
      mission={{
        goals: [
          { text: 'Shrink [$h$]{h} until the [average speed]{rate} is within 0.01 m/s of the speedometer.', done: matched },
          { text: 'Drag the moment [$t$]{input} to the instant the car stands still in the queue.', done: foundStop },
        ],
      }}
      keys={
        <>
          Keyboard: <kbd>Tab</kbd> to the ring, then <kbd>←</kbd> <kbd>→</kbd> move the moment along the curve (<kbd>Shift</kbd> for bigger steps); on the <kbd>h</kbd> slider, <kbd>←</kbd> <kbd>→</kbd> and <kbd>PageDown</kbd> shrink it.
        </>
      }
      legend={[
        { concept: 'input', label: 'the moment $t$ (drag the ring)' },
        { concept: 'h', label: '$h$: a short time later' },
        { concept: 'output', label: 'distance covered in those $h$ seconds' },
        { concept: 'rate', label: 'the secant: average speed over them; the soft band is the tangent' },
      ]}
    >
      <div class="dv-play" ref={setEl}>
        <TripGraph />
        <Speedometer />
      </div>
    </Figure>
  );
}
