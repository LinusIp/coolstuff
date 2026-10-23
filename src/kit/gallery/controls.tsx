/**
 * Gallery section for G4 (controls, code and the lesson shell): one demo per
 * component state worth seeing, with real data. Rendered by
 * kit/_dev/controls.html now and by /kit later.
 */
import { signal, useComputed, useSignal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { apply2, angleBetween, type Mat2, type Vec2 } from '../math';
import { CodeCell, PlayScrub, Scrolly, Segmented, Slider, Stepper, Toggle, codeOutput, parsePoints, runSandboxed, type SandboxResult } from '../controls';
import { RichText } from '../core/RichText';
import { Figure, LessonCard, Readout, ReadoutPair, Section, SectionTrackContext, SiteHeader, Step, WhereNext } from '../shell';
import { REFERENCES } from './samples';
import type { GalleryDemo, GalleryGroup } from './types';

// ── Toggle, Segmented, Stepper ────────────────────────────────────────────

/** The little "state" line under a demo (what the bound signal holds now). */
const STATE = { fontFamily: 'var(--font-mono)', marginTop: 'var(--sp-4)' };

function ToggleDemo() {
  const explain = useSignal(false);
  const live = useSignal(true);
  return (
    <div class="card">
      <div class="btn-row">
        <Toggle value={explain} label="Explain this" />
        <Toggle value={live} label="Live values" />
        <Toggle value={signal(false)} label="Disabled" disabled />
      </div>
      <p class="fig-keys" aria-live="polite" style={STATE}>
        explain = {String(explain.value)} · live = {String(live.value)}
      </p>
    </div>
  );
}

function SegmentedDemo() {
  const sum = useSignal<'left' | 'right' | 'mid' | 'trap'>('left');
  const sign = useSignal(1);
  return (
    <div class="card">
      <Segmented
        value={sum}
        label="Riemann sum"
        options={[
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
          { value: 'mid', label: 'Midpoint' },
          { value: 'trap', label: 'Trapezoid', disabled: true },
        ]}
      />
      <div style={{ marginTop: 'var(--sp-4)', maxWidth: '200px' }}>
        <Segmented
          value={sign}
          label="Sign of h"
          options={[
            { value: -1, label: '$h < 0$' },
            { value: 1, label: '$h > 0$' },
          ]}
        />
      </div>
      <p class="fig-keys" aria-live="polite" style={STATE}>
        sum = {sum.value} · sign = {sign.value}
      </p>
    </div>
  );
}

function StepperDemo() {
  const k = useSignal(0);
  const w = useSignal(2);
  return (
    <div class="card">
      <div class="btn-row" style={{ justifyContent: 'space-between' }}>
        <Stepper value={k} count={4} name="Derivation steps" />
        <Stepper value={w} count={3} wrap label={(i, n) => `Pass ${i + 1} of ${n}`} name="Passes" />
      </div>
      <p class="fig-keys">
        The left stepper stops at the ends (its buttons disable, and focus moves to the other one); the right one wraps. <kbd>←</kbd> <kbd>→</kbd> step while either has focus.
      </p>
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────

function SliderDemo() {
  const h = useSignal(0.5);
  const eta = useSignal(0.05);
  const lam = useSignal(2);
  const commits = useSignal(0);
  return (
    <div class="card" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <Slider value={h} min={-2} max={2} step={0.01} exclude={[0]} label="$h$" concept="input" onCommit={() => commits.value++} />
      <Slider value={eta} min={0.001} max={1.5} scale="log" label="learning rate $\eta$" concept="eigenvalue" detents={[{ value: 0.01, label: 'slow' }, { value: 1, label: 'diverges' }]} />
      <Slider
        value={lam}
        min={-1}
        max={4}
        step={0.05}
        label="$\cEigenvalue$"
        concept="eigenvalue"
        detents={[
          { value: 1, label: 'λ₂ = 1' },
          { value: 3, label: 'λ₁ = 3' },
        ]}
        valueText={(v) => `lambda ${v.toFixed(2)}, determinant ${((2 - v) * (2 - v) - 1).toFixed(2)}`}
      />
      <Slider value={signal(0.3)} min={0} max={1} label="Disabled" disabled />
      <p class="fig-keys" aria-live="polite" style={STATE}>
        h = {h.value} (never 0) · η = {eta.value} · λ = {lam.value} · det(A − λI) = {((2 - lam.value) ** 2 - 1).toFixed(2)} · commits = {commits.value}
      </p>
    </div>
  );
}

// ── runSandboxed ──────────────────────────────────────────────────────────

const SANDBOX_CASES: { label: string; code: string; timeoutMs?: number }[] = [
  { label: 'Run a snippet', code: 'let s = 0;\nfor (let k = 1; k <= 10; k++) s += k;\nconsole.log("sum", s);\nemit("s", s);' },
  { label: 'Infinite loop', code: 'while (true) {}', timeoutMs: 800 },
  { label: 'Try fetch', code: 'fetch("https://example.com/");' },
  { label: 'Try importScripts', code: 'importScripts("x.js");' },
  { label: 'Try import()', code: 'await import("./x.js");' },
  { label: 'Error on line 2', code: 'const a = [1, 2];\na.nope();' },
];

function describeResult(r: SandboxResult): string {
  if (r.ok) return `ok · logs: ${r.logs.join(' | ') || '—'} · emits: ${JSON.stringify(r.emits)}`;
  return `${r.timedOut ? 'timed out' : 'error'}${r.error?.line ? ` (line ${r.error.line})` : ''}: ${r.error?.message ?? ''}`;
}

function SandboxDemo() {
  const [out, setOut] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async (c: (typeof SANDBOX_CASES)[number]) => {
    setBusy(true);
    const r = await runSandboxed({ code: c.code, timeoutMs: c.timeoutMs });
    setOut((o) => [`${c.label} → ${describeResult(r)}`, ...o].slice(0, 6));
    setBusy(false);
  };
  return (
    <div class="card">
      <div class="btn-row">
        {SANDBOX_CASES.map((c) => (
          <button type="button" class="btn btn--sm" data-hit key={c.label} disabled={busy} onClick={() => run(c)}>
            {c.label}
          </button>
        ))}
      </div>
      <pre aria-live="polite" data-sandbox-log style={{ marginTop: 'var(--sp-4)', whiteSpace: 'pre-wrap', fontSize: 'var(--fs-meta)' }}>
        {out.length ? out.join('\n') : 'Results appear here.'}
      </pre>
    </div>
  );
}

// ── Figure ────────────────────────────────────────────────────────────────

const A: Mat2 = [2, 1, 1, 2];
const deg = (r: number) => (r * 180) / Math.PI;

function EigenPlate({ wide }: { wide?: boolean }) {
  const theta = useSignal(20);
  const v = useComputed<Vec2>(() => [Math.cos((theta.value * Math.PI) / 180) * 1.2, Math.sin((theta.value * Math.PI) / 180) * 1.2]);
  const Av = useComputed<Vec2>(() => apply2(A, v.value));
  const turn = useComputed(() => {
    const t = deg(angleBetween(v.value, Av.value));
    return Math.min(t, 180 - t);
  });
  const found3 = useComputed(() => Math.abs(theta.value - 45) < 0.25);
  const found1 = useComputed(() => Math.abs(theta.value - 135) < 0.25);
  const found = useComputed(() => found3.value || found1.value);
  const status = useComputed(() => (found.value ? 'Same line: $A$ only stretched it.' : `Off the line by ${turn.value.toFixed(1)}°. Keep turning.`));
  const [vx, vy] = v.value;
  const [ax, ay] = Av.value;
  const s = 52;
  return (
    <Figure
      name={wide ? 'gallery-eigen-wide' : 'gallery-eigen'}
      wide={wide}
      central={wide}
      keys={
        <>
          Keyboard: <kbd>Tab</kbd> to the slider, then <kbd>←</kbd> <kbd>→</kbd> turn the arrow by half a degree; <kbd>PageUp</kbd> <kbd>PageDown</kbd> by five.
        </>
      }
      caption="One matrix, one arrow. Turn the arrow until the matrix only stretches it: then it lies on one of the **double-ruled lines**."
      description="An input arrow v from the origin at the angle set by the slider, and its image Av under the matrix [[2, 1], [1, 2]]. Two dashed rose lines at 45 and 135 degrees mark the directions the matrix keeps."
      readout={
        <Readout status={found.value ? (found3.value ? 'not turned: stretched ×3' : 'not turned: unchanged') : `turned ${turn.value.toFixed(1)}°`} correct={found}>
          <ReadoutPair concept="input" sym="$\vec v$" value={v} />
          <span class="readout__sep">↦</span>
          <ReadoutPair concept="output" sym="$A\vec v$" value={Av} />
        </Readout>
      }
      mission={
        wide
          ? {
              goals: [
                { text: 'Find an angle where $A\\vec v$ is **3 times** $\\vec v$.', done: found3 },
                { text: 'Find one where $A\\vec v = \\vec v$.', done: found1 },
              ],
              status,
              correct: found,
            }
          : undefined
      }
      controls={
        <Slider
          value={theta}
          min={0}
          max={180}
          step={0.5}
          label="angle of $\cInput$"
          concept="input"
          format={(x) => `${x.toFixed(1)}°`}
          detents={[
            { value: 45, label: '45°' },
            { value: 135, label: '135°' },
          ]}
        />
      }
      legend={[
        { concept: 'input', label: 'input $\\vec v$' },
        { concept: 'output', label: 'image $A\\vec v$' },
        { concept: 'eigenvalue', label: 'directions $A$ keeps' },
      ]}
    >
      <div class={`plate__stage${wide ? ' plate__stage--wide' : ''}`} style={wide ? undefined : { aspectRatio: '4 / 3' }}>
        <svg class="plate__layer" viewBox="-240 -150 480 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="An arrow and its image under A">
          <title>An arrow v and its image Av</title>
          <path d="M-240 0H240M0 -150V150" class="fig-axis" />
          <path d="M-150 150L150 -150" class={`ct ${found3.value ? 'ct-correct' : 'ct-eigenvalue'} fig-line`} stroke-width={found3.value ? 2.5 : 1.5} stroke-dasharray={found3.value ? undefined : '7 4'} opacity={found3.value ? 1 : 0.6} />
          <path d="M-150 -150L150 150" class={`ct ${found1.value ? 'ct-correct' : 'ct-eigenvalue'} fig-line`} stroke-width={found1.value ? 2.5 : 1.5} stroke-dasharray={found1.value ? undefined : '7 4'} opacity={found1.value ? 1 : 0.6} />
          <path d={`M0 0L${ax * s} ${-ay * s}`} class="ct ct-output fig-line" stroke-width="2.5" stroke-dasharray="8 5" fill="none" />
          <path d={`M0 0L${vx * s} ${-vy * s}`} class="ct ct-input fig-line" stroke-width="2.5" fill="none" />
          <circle cx={vx * s} cy={-vy * s} r="5" class="ct ct-input" fill="currentColor" />
          <circle cx={ax * s} cy={-ay * s} r="4" class="ct ct-output" fill="currentColor" />
        </svg>
      </div>
    </Figure>
  );
}

// ── PlayScrub ─────────────────────────────────────────────────────────────

interface SortFrame {
  values: number[];
  compare?: [number, number];
  sortedFrom: number;
  note: string;
  pass: number;
}

/** A bubble-sort trace, the way a lesson's math.ts would produce one. */
function bubbleTrace(input: readonly number[]): SortFrame[] {
  const a = [...input];
  const frames: SortFrame[] = [{ values: [...a], sortedFrom: a.length, note: 'Start: compare neighbours, swap when the left one is bigger.', pass: 0 }];
  for (let end = a.length - 1, pass = 1; end > 0; end--, pass++) {
    for (let i = 0; i < end; i++) {
      const swap = a[i] > a[i + 1];
      if (swap) [a[i], a[i + 1]] = [a[i + 1], a[i]];
      frames.push({ values: [...a], compare: [i, i + 1], sortedFrom: end + 1, pass, note: swap ? `Pass ${pass}: ${a[i + 1]} > ${a[i]}, so swap them.` : `Pass ${pass}: ${a[i]} ≤ ${a[i + 1]}, leave them.` });
    }
    frames.push({ values: [...a], sortedFrom: end, pass, note: `End of pass ${pass}: ${a[end]} has bubbled to its place.` });
  }
  frames.push({ values: [...a], sortedFrom: 0, pass: a.length, note: 'Sorted.' });
  return frames;
}

const TRACE = bubbleTrace([5, 2, 8, 1, 6]);
const PASS_ENDS = TRACE.map((f, k) => (f.note.startsWith('End of pass') ? k : -1)).filter((k) => k >= 0);

function PlayScrubDemo() {
  const frame = useSignal(0);
  const f = TRACE[frame.value];
  const w = 300 / f.values.length;
  return (
    <div class="card">
      <svg viewBox="0 0 300 120" width="100%" style={{ maxWidth: '420px', display: 'block', margin: '0 auto' }} role="img" aria-label={`Bars: ${f.values.join(', ')}`}>
        <title>The array being sorted</title>
        {f.values.map((v, k) => {
          const comparing = f.compare?.includes(k);
          const sorted = k >= f.sortedFrom;
          return (
            <g key={k}>
              <rect
                x={k * w + 6}
                y={110 - v * 12}
                width={w - 12}
                height={v * 12}
                rx="2"
                class={sorted ? 'ct ct-correct' : comparing ? 'ct ct-input' : undefined}
                fill={sorted || comparing ? 'currentColor' : 'var(--rule-strong)'}
                opacity={sorted ? 0.85 : 1}
              />
              <text x={k * w + w / 2} y={104 - v * 12} text-anchor="middle" class="fig-note">
                {v}
              </text>
            </g>
          );
        })}
      </svg>
      <PlayScrub frame={frame} count={TRACE.length} fps={3} notes={TRACE.map((t) => t.note)} marks={PASS_ENDS} label={(i) => `Pass ${Math.max(1, TRACE[i].pass)}`} name="Bubble sort" />
    </div>
  );
}

// ── Scrolly ───────────────────────────────────────────────────────────────

const SCROLLY_ANGLES = [20, 20, 70, 45];

function ScrollyDemo() {
  const step = useSignal(0);
  return (
    <Scrolly
      step={step}
      label="How a matrix acts on one arrow"
      steps={[
        { id: 'scrolly-arrow', content: <RichText text="Take one arrow, [$\vec v$]{input}. Nothing has happened to it yet." /> },
        { id: 'scrolly-apply', content: <RichText text="Apply [the matrix]{matrix} $A$: the arrow lands somewhere new, [$A\vec v$]{output}." /> },
        { id: 'scrolly-turn', content: <RichText text="Most arrows come out **turned**: $A\vec v$ points along a different line from $\vec v$." /> },
        { id: 'scrolly-keep', content: <RichText text="A few arrows only **stretch**: they keep their line. Those are the eigenvectors, the subject of the next section." /> },
      ]}
    >
      {(k) => {
        const t = (SCROLLY_ANGLES[k] * Math.PI) / 180;
        const v: Vec2 = [Math.cos(t), Math.sin(t)];
        const Av = apply2(A, v);
        const s = 40;
        return (
          <div class="plate__stage" style={{ aspectRatio: '4 / 3' }}>
            <svg class="plate__layer" viewBox="-160 -120 320 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Step ${k + 1}: the arrow and its image`}>
              <title>The arrow at step {k + 1}</title>
              <path d="M-160 0H160M0 -120V120" class="fig-axis" />
              {k >= 1 && <path d={`M0 0L${Av[0] * s} ${-Av[1] * s}`} class="ct ct-output fig-line" stroke-width="2.5" stroke-dasharray="8 5" />}
              <path d={`M0 0L${v[0] * s} ${-v[1] * s}`} class="ct ct-input fig-line" stroke-width="2.5" />
              <text x="-150" y="-100" class="fig-note">
                step {k + 1} of 4
              </text>
            </svg>
          </div>
        );
      }}
    </Scrolly>
  );
}

// ── CodeCell ──────────────────────────────────────────────────────────────

const POWER = `// Power iteration: multiply by A and rescale, over and over.
let v = [1, 0.2];
for (let k = 0; k < 25; k++) {
  const w = [A[0] * v[0] + A[1] * v[1], A[2] * v[0] + A[3] * v[1]];
  const len = Math.hypot(w[0], w[1]);
  v = [w[0] / len, w[1] / len];
  emit("v", v);
}
console.log("settled on", v.map((x) => x.toFixed(3)).join(", "));`;

const MATRICES: { value: number; label: string; m: Mat2 }[] = [
  { value: 0, label: '$\\begin{smallmatrix}2&1\\\\1&2\\end{smallmatrix}$', m: [2, 1, 1, 2] },
  { value: 1, label: '$\\begin{smallmatrix}4&1\\\\2&3\\end{smallmatrix}$', m: [4, 1, 2, 3] },
  { value: 2, label: '$\\begin{smallmatrix}1&0\\\\0&-3\\end{smallmatrix}$', m: [1, 0, 0, -3] },
];

function CodeCellDemo() {
  const which = useSignal(0);
  const Am = useComputed(() => MATRICES[which.value].m);
  const trail = useSignal<[number, number][]>([[1, 0.2]]);
  const v = useComputed(() => trail.value[trail.value.length - 1] ?? [1, 0.2]);
  const s = 90;
  return (
    <div>
      <div class="btn-row" style={{ marginBottom: 'var(--sp-3)' }}>
        <span class="label">Matrix</span>
        <div style={{ minWidth: '240px' }}>
          <Segmented value={which} label="Matrix" options={MATRICES.map((m) => ({ value: m.value, label: m.label }))} />
        </div>
      </div>
      <div class="plate__stage" style={{ aspectRatio: '2 / 1', maxWidth: '420px' }}>
        <svg class="plate__layer" viewBox="-210 -105 420 210" preserveAspectRatio="xMidYMid meet" role="img" aria-label="The iterate v after each step">
          <title>Where power iteration has got to</title>
          <circle r={s} fill="none" class="fig-guide" />
          <path d="M-210 0H210M0 -105V105" class="fig-axis" />
          {trail.value.map((p, k) => (
            <circle key={k} cx={p[0] * s} cy={-p[1] * s} r="2.5" class="ct ct-input" fill="currentColor" opacity={0.25 + (0.6 * k) / Math.max(1, trail.value.length)} />
          ))}
          <path d={`M0 0L${v.value[0] * s} ${-v.value[1] * s}`} class="ct ct-input fig-line" stroke-width="2.5" />
        </svg>
      </div>
      <CodeCell
        code={POWER}
        label="Power iteration"
        inputs={{ A: Am }}
        concepts={{ A: 'matrix', v: 'input' }}
        outputs={{ v: codeOutput(trail, parsePoints, 'all') }}
        stream={{ throttleMs: 60 }}
        autorun
      />
    </div>
  );
}

const BAD_EMIT = `// The visual wants a list of [x, y] points under "path".
emit("path", 5);`;

function BadEmitDemo() {
  const path = useSignal<[number, number][]>([
    [0, 0],
    [1, 1],
    [2, 0],
  ]);
  return (
    <div>
      <CodeCell code={BAD_EMIT} label="A malformed emit" outputs={{ path: codeOutput(path, parsePoints) }} lines={3} />
      <p class="fig-keys" style={STATE} aria-live="polite">
        path still holds {path.value.length} points: {JSON.stringify(path.value)}
      </p>
    </div>
  );
}

function TimeoutDemo() {
  return <CodeCell code={'// A loop that never ends: stopped after 1 s.\nlet k = 0;\nwhile (true) k++;'} label="Read-only, with a time limit" editable={false} timeoutMs={1000} />;
}

function CloneDemo() {
  return (
    <CodeCell
      code={'emit("y", f(2));'}
      label="A lesson bug: a function as an input"
      inputs={{ f: (x: number) => x * x } as Record<string, unknown>}
      lines={1}
    />
  );
}

// ── Section, Step, masthead, where next ───────────────────────────────────

function SectionDemo() {
  return (
    <Section id="build" title="From one arrow to every arrow" n={4}>
      <Step title="Two arrows, one matrix">
        <p>Each step is a sentence or two and one focused interactive; its number comes from its position among the section’s steps.</p>
      </Step>
      <Step title="Turned or stretched?">
        <p>
          Steps carry <code>data-step</code>, which smoke counts (3–6 per lesson).
        </p>
      </Step>
    </Section>
  );
}

const FAKE_TRACK = { ids: ['tldr', 'hook', 'play', 'build', 'formalize', 'examples', 'traps', 'practice', 'quickcheck', 'next'], current: 'build', seen: ['tldr', 'hook', 'play', 'build'] };

function MastheadDemo() {
  return (
    <div style={{ position: 'relative', border: '1px solid var(--rule)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <SectionTrackContext.Provider value={FAKE_TRACK}>
        <SiteHeader progress home="../../" crumbs={[{ label: 'Linear algebra', href: '../../#linalg' }, { label: 'Eigenvectors and eigenvalues' }]} />
      </SectionTrackContext.Provider>
    </div>
  );
}

function WhereNextDemo() {
  return (
    <div>
      <WhereNext lessonId="linalg/eigenvectors" references={REFERENCES} />
      <p class="label" style={{ marginTop: 'var(--sp-5)' }}>
        A shipped lesson card
      </p>
      <ul class="lesson-cards" style={{ maxWidth: '420px' }}>
        <li>
          <LessonCard card={{ id: 'linalg/determinant', title: 'Determinant as area/volume scaling', kicker: 'Linear algebra · 6', summary: 'How much a matrix scales area, and when it flips orientation.', shipped: true, href: '#where-next' }} dir="←" />
        </li>
      </ul>
    </div>
  );
}

const demos: GalleryDemo[] = [
  { id: 'toggle', title: 'Toggle', component: 'Toggle', notes: '`role=switch` with `aria-checked`, ink track and thumb, 44px tall; off, on and disabled.', render: () => <ToggleDemo /> },
  {
    id: 'segmented',
    title: 'Segmented',
    component: 'Segmented',
    notes: 'One-of-n ink buttons with `aria-pressed`; ← → move along the row and skip the disabled option. Labels are Rich, so maths works.',
    render: () => <SegmentedDemo />,
  },
  { id: 'stepper', title: 'Stepper', component: 'Stepper', notes: 'Disabled ends (left) and wrap-around (right); the label is a polite live region.', render: () => <StepperDemo /> },
  {
    id: 'slider',
    title: 'Slider',
    component: 'Slider',
    notes:
      'Linear with `exclude: [0]` (drag or key: $h$ never lands on 0), a log learning rate from 0.001 to 1.5 with labelled detents, magnetic eigenvalue detents with a custom `aria-valuetext`, and disabled. Thumbs wear the concept ink; dragging lights the concept (watch the legend and readouts elsewhere on the page). `onCommit` fires on release only.',
    render: () => <SliderDemo />,
  },
  {
    id: 'sandbox',
    title: 'runSandboxed',
    component: 'runSandboxed',
    notes: 'Learner code runs in a fresh module Worker with the network and storage removed. The infinite loop is stopped at 0.8 s and the next run still works; `fetch`, `importScripts` and `import()` are unavailable inside.',
    render: () => <SandboxDemo />,
  },
  {
    id: 'figure',
    title: 'Figure · text width',
    component: 'Figure · Readout · ReadoutPair · Legend · FigKeys',
    notes: 'A text-width plate: the caption floats into the margin at ≥ 1000px; readout strip joined under the stage; legend rows focusable and hover-linked.',
    render: () => <EigenPlate />,
  },
  {
    id: 'figure-wide',
    title: 'Figure · wide, central, with a mission',
    component: 'Figure · Mission',
    wide: true,
    notes: '`wide` spans text + margin with mission and keys beside legend and caption; `central` marks the thumbnail (`data-thumb`). Turn the arrow to 45° or 135°: the goals tick green (240ms) and are announced.',
    render: () => <EigenPlate wide />,
  },
  {
    id: 'playscrub',
    title: 'PlayScrub',
    component: 'PlayScrub',
    notes: 'A bubble-sort trace: play/pause (never autoplays; pauses off-screen; at most 2 fps under reduced motion), step, scrub, Home/End, ticks at the end of each pass, and the frame’s note read out politely. Keyboard anywhere inside: Space, ← →, Home, End.',
    render: () => <PlayScrubDemo />,
  },
  {
    id: 'scrolly',
    title: 'Scrolly',
    component: 'Scrolly',
    wide: true,
    notes: 'Steps scroll past a pinned visual (beside them at ≥ 1000px; stuck to the top, at most 45vh, below that). The step nearest the reading line is current; every step is a tab stop and carries `data-step`.',
    render: () => <ScrollyDemo />,
  },
  {
    id: 'codecell',
    title: 'CodeCell · streaming into a visual',
    component: 'CodeCell · codeOutput · parseVec2 · parsePoints',
    notes: "`autorun` with a signal input (pick another matrix and it re-runs), `stream` (the arrow moves while the loop runs; the last emit always arrives), `from: 'all'` (every iterate, drawn as a trail), and the identifiers `A` and `v` underlined in their concepts’ line styles. Edit the code: it re-runs 400ms after you stop typing.",
    render: () => <CodeCellDemo />,
  },
  {
    id: 'codecell-bad-emit',
    title: 'CodeCell · a malformed emit',
    component: 'CodeCell · parse',
    notes: 'Press Run: the output’s `parse` rejects `5`, the cell says why under the code, and the signal keeps its three points.',
    render: () => <BadEmitDemo />,
  },
  {
    id: 'codecell-timeout',
    title: 'CodeCell · read-only, time limit',
    component: 'CodeCell',
    notes: 'A read-only cell never captures Tab. Run it: the worker is stopped after 1 s and replaced, so the next run works.',
    render: () => <TimeoutDemo />,
  },
  {
    id: 'codecell-clone',
    title: 'CodeCell · a non-cloneable input',
    component: 'CodeCell · cloneIssue',
    notes: 'A lesson bug made visible: a function passed in `inputs` can’t cross into the Worker. Run refuses, names the path, and logs a `console.error` (so smoke would fail the page).',
    render: () => <CloneDemo />,
  },
  {
    id: 'section-step',
    title: 'Section and Step',
    component: 'Section · Step',
    notes: 'The section head (kicker number + small-caps name, then the h2) and numbered `h3` steps.',
    render: () => <SectionDemo />,
  },
  {
    id: 'masthead',
    title: 'SiteHeader, ReadingProgress, ThemeToggle',
    component: 'SiteHeader · ReadingProgress · ThemeToggle',
    notes: 'Wordmark, breadcrumb (first and last only on tablets), section progress (four sections reached, the fourth being read) and the theme toggle. On phones: wordmark + toggle with the progress as a hairline on the bottom edge.',
    wide: true,
    render: () => <MastheadDemo />,
  },
  {
    id: 'where-next',
    title: 'WhereNext and References',
    component: 'WhereNext · LessonCard · References',
    wide: true,
    notes: 'Builds on / unlocks from curriculum.ts (no lesson is shipped yet, so every card is a dashed “coming soon”, not a link), a shipped card for comparison, and references as `li[data-ref]`.',
    render: () => <WhereNextDemo />,
  },
];

export const gallery: GalleryGroup = {
  id: 'controls',
  title: 'Controls, code and the lesson shell',
  owner: 'G4',
  blurb: 'Slider, Toggle, Segmented, Stepper, PlayScrub, Scrolly, CodeCell and the sandbox, and the lesson shell: LessonPage, Section, Step, Figure, SiteHeader, WhereNext.',
  demos,
};
