/**
 * ArchDiagram (README §9.5): a system-design diagram on a 12 × 8 grid that
 * runs `arch-sim` live. Request dots flow along the links (thinned at high
 * load; none under reduced motion, where links thicken with their share of
 * the traffic instead); each component shows how busy it is and its queue;
 * failed components are hatched red with ×. With `injectFailures`, a click
 * (or Enter/Space on the focused component) fails it or brings it back. A
 * metrics strip shows throughput, p50/p95/p99, error rate and cache hit rate;
 * screen readers hear it at most every 2 s. A Pause button stops the clock
 * (it also pauses off-screen and in a hidden tab).
 *
 *   const load = signal(120);
 *   <Slider value={load} min={10} max={400} label="Offered load (req/s)" />
 *   <ArchDiagram spec={SPEC} load={load} injectFailures label="Two app servers behind a load balancer" />
 *
 * DOM: div.ds.ds-arch.plate__stage > .ds-scroll > svg.ds-svg (g.ds-link[data-link],
 * g.ds-arch__dots, g.ds-anode[data-node][data-kind][data-up]) · .ds-arch__bar
 * (button.ds-arch__run, dl.ds-metrics, p.sr-only[aria-live]) · p.sr-only summary.
 */
import { effect, useSignal, type Signal } from '@preact/signals';
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { useElementSize, useInView, useReducedMotion } from '../core/hooks';
import { IconPause, IconPlay } from '../core/icons';
import { createArchSim, type ArchSim } from './arch-sim';
import { boxLinkGeometry, type Pt } from './geometry';
import { listText } from './describe';
import { navLinear } from './nav';
import { onActivate, useRoving } from './shared';
import type { ArchMetrics, ArchNode, ArchNodeKind, ArchSpec } from './types';

export interface ArchDiagramProps {
  /** Nodes (kind, x, y on a 12 × 8 grid, capacity, latencyMs, hitRate, policy, maxQueue), links, entry (structures/types.ts). */
  spec: ArchSpec;
  label: string;
  /** Offered requests per second (default 50 when not given). */
  load?: Signal<number>;
  /** Whether the clock runs (default: an internal signal, on). The Pause button writes it. */
  running?: Signal<boolean>;
  /** Failed node ids; written by failure injection when given. */
  failures?: Signal<ReadonlySet<string>>;
  /** Click / Enter / Space on a component toggles its failure. */
  injectFailures?: boolean;
  /** Called with fresh metrics about twice a second (also shown in the strip). */
  onMetrics?: (m: ArchMetrics) => void;
  seed?: number;
  class?: string;
}

const KIND_WORD: Readonly<Record<ArchNodeKind, string>> = {
  client: 'client',
  dns: 'DNS',
  cdn: 'CDN',
  lb: 'load balancer',
  gateway: 'gateway',
  server: 'server',
  service: 'service',
  cache: 'cache',
  db: 'database',
  replica: 'replica',
  queue: 'queue',
  worker: 'worker',
  storage: 'storage',
};

/** 16 × 16 pictograms, drawn in ink (shape, not colour, says the kind). */
const KIND_ICON: Readonly<Record<ArchNodeKind, string>> = {
  client: 'M2.5 3.5h11v7h-11zM1 13h14',
  dns: 'M8 1.5v13M3 3.5h8l2 2-2 2H3zM13 8.5H5l-2 2 2 2h8z',
  cdn: 'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M1.5 8h13M8 1.5c-3 3.5-3 9.5 0 13M8 1.5c3 3.5 3 9.5 0 13',
  lb: 'M1.5 8h4M5.5 8l7-5M5.5 8h7M5.5 8l7 5M10.5 1.5l2 1.5-1.2 2.2M10.5 6.6l2 1.4-2 1.4M11.3 10.8l1.2 2.2-2 1.5',
  gateway: 'M2.5 14.5v-8a5.5 5.5 0 0 1 11 0v8M5.5 14.5v-6a2.5 2.5 0 0 1 5 0v6',
  server: 'M2.5 2.5h11v4h-11zM2.5 9.5h11v4h-11zM5 4.5h.01M5 11.5h.01',
  service: 'M8 1.5l5.6 3.25v6.5L8 14.5l-5.6-3.25v-6.5z',
  cache: 'M9.5 1.5L3.5 9h4l-1 5.5 6-7.5h-4z',
  db: 'M2.5 3.5c0-2.7 11-2.7 11 0v9c0 2.7-11 2.7-11 0zM2.5 3.5c0 2.7 11 2.7 11 0M2.5 8c0 2.7 11 2.7 11 0',
  replica: 'M2.5 4.5c0-2.4 9-2.4 9 0v8c0 2.4-9 2.4-9 0zM2.5 4.5c0 2.4 9 2.4 9 0M13.5 3v8.5',
  queue: 'M1.5 4.5h3v7h-3zM6.5 4.5h3v7h-3zM11.5 4.5h3v7h-3z',
  worker: 'M8 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4',
  storage: 'M2.5 4.5h11l-1.5 10h-8zM1.5 2.5h13v2h-13z',
};

const DOT_MS = 700;
const DOT_RATE = 45; // dots per second at most; more hops than that are thinned
const MAX_DOTS = 90;
const METRICS_MS = 500;
const SPEAK_MS = 2000;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ms = (x: number) => (x >= 100 ? String(Math.round(x)) : x >= 10 ? x.toFixed(0) : x.toFixed(1));

interface Layout {
  width: number;
  height: number;
  cw: number;
  ch: number;
  boxW: number;
  boxH: number;
  centre: (n: ArchNode) => [number, number];
}

function layoutFor(avail: number): Layout {
  const width = Math.max(640, Math.floor(avail));
  const cw = width / 12;
  const ch = cw * 0.74;
  const height = Math.round(8 * ch);
  const boxW = Math.round(Math.min(150, Math.max(96, cw * 1.9)));
  const boxH = Math.round(Math.min(58, Math.max(48, ch * 1.05)));
  return { width, height, cw, ch, boxW, boxH, centre: (n) => [(n.x + 0.5) * cw, (n.y + 0.5) * ch] };
}

/** One line for screen readers and the strip. */
export function metricsText(m: ArchMetrics): string {
  const parts = [
    `${Math.round(m.throughput)} requests per second`,
    m.throughput > 0 ? `median ${ms(m.p50)} milliseconds, 95th percentile ${ms(m.p95)}, 99th ${ms(m.p99)}` : 'no requests completed',
    `errors ${pct(m.errorRate)}`,
  ];
  if (m.hitRate !== undefined) parts.push(`cache hits ${pct(m.hitRate)}`);
  return `${parts.join(', ')}.`;
}

/** The static text alternative: what is connected to what. */
export function describeArch(spec: ArchSpec): string {
  const name = new Map(spec.nodes.map((n) => [n.id, n.label]));
  const links = spec.links.map((l) => `${name.get(l.from) ?? l.from} to ${name.get(l.to) ?? l.to}`);
  return `${spec.nodes.length} components and ${spec.links.length} links. Requests enter at ${name.get(spec.entry) ?? spec.entry}. Links: ${listText(links)}.`;
}

export function ArchDiagram({ spec, label, load, running, failures, injectFailures, onMetrics, seed = 1, class: cls }: ArchDiagramProps) {
  const reduced = useReducedMotion();
  const sumId = useId();
  const hatchId = `${useId()}-hatch`.replace(/:/g, '');
  const ownRunning = useSignal(true);
  const ownFailures = useSignal<ReadonlySet<string>>(new Set());
  const run = running ?? ownRunning;
  const failed = failures ?? ownFailures;
  const isRunning = run.value;
  const down = failed.value;

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollEl = useRef<HTMLDivElement>(null);
  const avail = useElementSize(scrollEl).width;
  const L = useMemo(() => layoutFor(avail || 640), [avail]);
  const inView = useInView(rootRef);

  // One simulation per spec/seed; load and failures are pushed into it.
  const sim = useMemo<ArchSim>(() => createArchSim(spec, { seed, load: load?.peek() ?? 50 }), [spec, seed]);
  const [metrics, setMetrics] = useState<ArchMetrics>(() => sim.metrics());
  const [spoken, setSpoken] = useState('');
  const [linkLoad, setLinkLoad] = useState<Readonly<Record<string, number>>>({});

  useEffect(() => (load ? effect(() => sim.setLoad(load.value)) : undefined), [sim, load]);
  useEffect(
    () =>
      effect(() => {
        const set = failed.value;
        for (const n of spec.nodes) sim.fail(n.id, set.has(n.id));
      }),
    [sim, failed, spec],
  );

  const links = useMemo(
    () =>
      spec.links.map((l) => {
        const a = spec.nodes.find((n) => n.id === l.from)!;
        const b = spec.nodes.find((n) => n.id === l.to)!;
        const half: Pt = [L.boxW / 2, L.boxH / 2];
        const g = boxLinkGeometry(L.centre(a), L.centre(b), half, half, 8, 4);
        return { key: `${l.from}->${l.to}`, l, g };
      }),
    [spec, L],
  );
  const linkByKey = useMemo(() => new Map(links.map((k) => [k.key, k])), [links]);

  // ── The clock: sim steps, dots and metrics, without re-rendering per frame ──
  const dotsLayer = useRef<SVGGElement>(null);
  const onMetricsRef = useRef(onMetrics);
  onMetricsRef.current = onMetrics;
  const ticking = isRunning && inView;
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined' || !ticking) return;
    const layer = dotsLayer.current;
    const pool: SVGCircleElement[] = [];
    const dots: { s: Pt; e: Pt; t0: number; ok: boolean }[] = [];
    let budget = 4;
    let last = performance.now();
    let lastMetrics = 0;
    let lastSpeak = -Infinity;
    let lastSpoken = '';
    const rates: Record<string, number> = {};
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dtMs = Math.min(100, now - last);
      last = now;
      if (document.hidden) return;
      const dt = dtMs / 1000;
      const m = sim.step(dt);
      const hops = sim.takeHops();
      // Link traffic (decaying counts) for the reduced-motion strokes.
      const decay = Math.exp(-dt / 1.5);
      for (const k of Object.keys(rates)) rates[k] *= decay;
      for (const h of hops) rates[`${h.from}->${h.to}`] = (rates[`${h.from}->${h.to}`] ?? 0) + 1;
      if (!reduced && layer) {
        budget = Math.min(6, budget + dt * DOT_RATE);
        for (const h of hops) {
          if (budget < 1 || dots.length >= MAX_DOTS) break;
          const lk = linkByKey.get(`${h.from}->${h.to}`);
          if (!lk || !lk.g.d) continue;
          budget -= 1;
          dots.push({ s: lk.g.start, e: lk.g.end, t0: now, ok: h.ok });
        }
        while (pool.length < dots.length) {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('r', '3.5');
          layer.appendChild(c);
          pool.push(c);
        }
        let live = 0;
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          const p = (now - d.t0) / DOT_MS;
          if (p >= 1) continue;
          const k = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          const c = pool[live];
          c.setAttribute('cx', (d.s[0] + (d.e[0] - d.s[0]) * k).toFixed(1));
          c.setAttribute('cy', (d.s[1] + (d.e[1] - d.s[1]) * k).toFixed(1));
          c.setAttribute('class', d.ok ? 'ds-dot' : 'ds-dot is-error');
          c.style.display = '';
          dots[live++] = d;
        }
        dots.length = live;
        for (let i = live; i < pool.length; i++) pool[i].style.display = 'none';
      }
      if (now - lastMetrics >= METRICS_MS) {
        lastMetrics = now;
        setMetrics(m);
        const max = Math.max(1e-9, ...Object.values(rates));
        const shares: Record<string, number> = {};
        for (const [k, v] of Object.entries(rates)) shares[k] = v / max;
        setLinkLoad(shares);
        onMetricsRef.current?.(m);
        if (now - lastSpeak >= SPEAK_MS) {
          const text = metricsText(m);
          if (text !== lastSpoken) {
            lastSpeak = now;
            lastSpoken = text;
            setSpoken(text);
          }
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      for (const c of pool) c.remove();
    };
  }, [sim, ticking, reduced, linkByKey]);

  // ── Failure injection: one tab stop, arrows move between components ──
  const keys = useMemo(() => (injectFailures ? spec.nodes.map((n) => n.id) : []), [spec, injectFailures]);
  const roving = useRoving(keys);
  const toggle = (id: string) => {
    const next = new Set(failed.peek());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    failed.value = next;
  };
  const onKeyDown = (e: JSX.TargetedKeyboardEvent<SVGElement>) => {
    const rk = (e.target as Element).getAttribute?.('data-rk');
    if (!injectFailures || !rk) return;
    const i = keys.indexOf(rk);
    const next = navLinear(e.key, i, keys.length);
    if (next === null) return;
    e.preventDefault();
    roving.focusKey(keys[next]);
  };

  const overflow = avail > 0 && L.width > avail + 1;
  const hasCache = spec.nodes.some((n) => n.kind === 'cache' || n.kind === 'cdn' || n.hitRate !== undefined);
  const started = metrics.t > 0.5;

  return (
    <div class={['ds', 'ds-arch', 'plate__stage', injectFailures ? 'is-interactive' : '', cls].filter(Boolean).join(' ')} ref={rootRef}>
      <div
        class="ds-scroll"
        ref={scrollEl}
        tabIndex={overflow && !injectFailures ? 0 : undefined}
        role={overflow && !injectFailures ? 'region' : undefined}
        aria-label={overflow && !injectFailures ? `${label} (scrolls sideways)` : undefined}
      >
        <svg
          class="ds-svg ds-arch__svg"
          width={L.width}
          height={L.height}
          viewBox={`0 0 ${L.width} ${L.height}`}
          role="group"
          aria-label={label}
          aria-describedby={sumId}
          ref={roving.root as never}
          onKeyDown={onKeyDown}
        >
          <title>{label}</title>
          <defs>
            <pattern id={hatchId} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <line class="ds-anode__hatchline" x1="0" y1="0" x2="0" y2="7" />
            </pattern>
          </defs>
          <g class="ds-arch__links" aria-hidden="true">
            {links.map(({ key, l, g }) => {
              const share = linkLoad[key] ?? 0;
              const toDown = down.has(l.to) || down.has(l.from);
              return (
                <g key={key} class={['ds-link', toDown ? 'is-down' : ''].filter(Boolean).join(' ')} data-link={key}>
                  <path class="ds-link__line" d={g.d} style={reduced ? { strokeWidth: `${(1.5 + 4.5 * share).toFixed(2)}px` } : undefined} />
                  {g.head && <path class="ds-link__head" d={g.head} />}
                  {l.label && (
                    <text class="ds-link__label" x={g.mid[0]} y={g.mid[1] - 7}>
                      {l.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <g class="ds-arch__dots" ref={dotsLayer} aria-hidden="true" />
          <g class="ds-arch__nodes">
            {spec.nodes.map((n) => {
              const [cx, cy] = L.centre(n);
              const pn = metrics.perNode[n.id];
              const isDown = down.has(n.id);
              const util = pn?.utilization ?? 0;
              const hasMeter = n.capacity !== undefined || n.kind === 'queue';
              const queue = pn?.queue ?? 0;
              const kind = KIND_WORD[n.kind];
              const status = isDown ? 'down' : hasMeter && started ? `${pct(util)} ${n.kind === 'queue' ? 'full' : 'busy'}${queue > 0 && n.kind !== 'queue' ? `, ${queue} waiting` : ''}` : 'up';
              const a11y = injectFailures
                ? {
                    role: 'button' as const,
                    tabindex: roving.tabIndex(n.id),
                    'data-rk': n.id,
                    'aria-pressed': isDown,
                    'aria-label': `Fail ${n.label} (${kind}); now ${status}`,
                    onClick: () => {
                      roving.setActive(n.id);
                      toggle(n.id);
                    },
                    onKeyDown: onActivate(() => toggle(n.id)),
                  }
                : { role: 'img' as const, 'aria-label': `${n.label}, ${kind}, ${status}` };
              const w = L.boxW;
              const h = L.boxH;
              const hot = util >= 0.9 && !isDown && hasMeter && started;
              return (
                <g
                  key={n.id}
                  class={['ds-anode', isDown ? 'is-down' : '', hot ? 'is-hot' : '', injectFailures ? 'is-button' : ''].filter(Boolean).join(' ')}
                  data-node={n.id}
                  data-kind={n.kind}
                  data-up={isDown ? 'false' : 'true'}
                  transform={`translate(${Math.round(cx - w / 2)} ${Math.round(cy - h / 2)})`}
                  {...a11y}
                >
                  <rect class="ds-anode__box" width={w} height={h} rx="3" />
                  {isDown && <rect class="ds-anode__hatch" width={w} height={h} rx="3" fill={`url(#${hatchId})`} />}
                  <path class="ds-anode__icon" d={KIND_ICON[n.kind]} transform="translate(9 9)" />
                  <text class="ds-anode__kind" x="31" y="19">
                    {kind}
                  </text>
                  <text class="ds-anode__label" x="10" y={h - (hasMeter ? 15 : 12)}>
                    {n.label}
                  </text>
                  {hasMeter && (
                    <>
                      <rect class="ds-anode__meter-bg" x="10" y={h - 9} width={w - 20} height="4" rx="1" />
                      <rect class="ds-anode__meter" x="10" y={h - 9} width={Math.max(0, (w - 20) * Math.min(1, util))} height="4" rx="1" />
                    </>
                  )}
                  {isDown && (
                    <g class="ds-anode__x" transform={`translate(${w - 13} 13)`}>
                      <circle r="9" />
                      <path d="M-3.6 -3.6L3.6 3.6M3.6 -3.6L-3.6 3.6" />
                    </g>
                  )}
                  {hasMeter && !isDown && started && (
                    <text class="ds-anode__note" x={w / 2} y={h + 15}>
                      {n.kind === 'queue' ? `${queue} waiting` : `${pct(util)}${queue > 0 ? ` · ${queue} waiting` : ''}`}
                    </text>
                  )}
                  {isDown && (
                    <text class="ds-anode__note is-down" x={w / 2} y={h + 15}>
                      down
                    </text>
                  )}
                  {injectFailures && <rect class="ds-anode__focus" x="-4" y="-4" width={w + 8} height={h + 8} rx="5" />}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <div class="ds-arch__bar">
        <button
          type="button"
          class="btn btn--sm ds-arch__run"
          aria-pressed={isRunning ? 'false' : 'true'}
          onClick={() => {
            run.value = !run.peek();
          }}
        >
          {isRunning ? <IconPause /> : <IconPlay />}
          {isRunning ? 'Pause' : 'Run'}
        </button>
        <dl class="ds-metrics" aria-hidden="true">
          <div>
            <dt>throughput</dt>
            <dd>
              {Math.round(metrics.throughput)}
              <span class="ds-metrics__unit"> req/s</span>
            </dd>
          </div>
          <div>
            <dt>p50 · p95 · p99</dt>
            <dd>
              {metrics.throughput > 0 ? `${ms(metrics.p50)} · ${ms(metrics.p95)} · ${ms(metrics.p99)}` : '—'}
              <span class="ds-metrics__unit"> ms</span>
            </dd>
          </div>
          <div class={metrics.errorRate > 0.005 ? 'is-error' : ''}>
            <dt>errors</dt>
            <dd>{pct(metrics.errorRate)}</dd>
          </div>
          {hasCache && (
            <div>
              <dt>cache hits</dt>
              <dd>{metrics.hitRate === undefined ? '—' : pct(metrics.hitRate)}</dd>
            </div>
          )}
        </dl>
        <p class="sr-only" aria-live="polite">
          {spoken}
        </p>
      </div>
      <p class="sr-only" id={sumId}>
        {describeArch(spec)}
      </p>
    </div>
  );
}
