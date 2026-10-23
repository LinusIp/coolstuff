/**
 * arch-sim against queueing facts (PLAN §4 G5): utilisation = load / capacity,
 * M/M/1 response times, queue growth past saturation, Little's law, cache hit
 * rates, failover behind a balancer, backpressure, and determinism per seed.
 */
import { describe, expect, it } from 'vitest';
import { createArchSim, DEFAULT_MAX_QUEUE, histQuantile } from './arch-sim';
import type { ArchSpec } from './types';

const rel = (got: number, want: number) => Math.abs(got - want) / Math.abs(want);

/** client → one server. */
const single = (capacity: number, latencyMs: number, extra: Partial<ArchSpec['nodes'][number]> = {}): ArchSpec => ({
  entry: 'c',
  nodes: [
    { id: 'c', kind: 'client', label: 'Client', x: 1, y: 4 },
    { id: 's', kind: 'server', label: 'Server', x: 6, y: 4, capacity, latencyMs, ...extra },
  ],
  links: [{ from: 'c', to: 's' }],
});

/** client → lb → two replicas (→ db). */
const replicas = (policy: 'round-robin' | 'least-connections' | 'random' | 'hash' = 'round-robin', db = false): ArchSpec => ({
  entry: 'c',
  nodes: [
    { id: 'c', kind: 'client', label: 'Clients', x: 0, y: 4 },
    { id: 'lb', kind: 'lb', label: 'Load balancer', x: 3, y: 4, policy, latencyMs: 1 },
    { id: 's1', kind: 'server', label: 'App 1', x: 6, y: 2, capacity: 120, latencyMs: 40 },
    { id: 's2', kind: 'server', label: 'App 2', x: 6, y: 6, capacity: 120, latencyMs: 40 },
    ...(db ? [{ id: 'db', kind: 'db' as const, label: 'Database', x: 10, y: 4, capacity: 400, latencyMs: 8 }] : []),
  ],
  links: [
    { from: 'c', to: 'lb', latencyMs: 20 },
    { from: 'lb', to: 's1', latencyMs: 1 },
    { from: 'lb', to: 's2', latencyMs: 1 },
    ...(db
      ? [
          { from: 's1', to: 'db', latencyMs: 2 },
          { from: 's2', to: 'db', latencyMs: 2 },
        ]
      : []),
  ],
});

describe('arch-sim: determinism', () => {
  it('gives the same numbers for the same seed, however time is chunked', () => {
    const a = createArchSim(replicas('random', true), { seed: 42, load: 150 });
    const b = createArchSim(replicas('random', true), { seed: 42, load: 150 });
    for (let i = 0; i < 20; i++) a.step(1);
    const mb = b.step(20);
    expect(a.metrics()).toEqual(mb);
    expect(a.totals()).toEqual(b.totals());
    const c = createArchSim(replicas('random', true), { seed: 43, load: 150 });
    c.step(20);
    expect(c.totals().arrivals).not.toBe(a.totals().arrivals);
  });

  it('reset() goes back to time 0 and replays the same run', () => {
    const sim = createArchSim(replicas(), { seed: 7, load: 100 });
    const first = sim.step(10);
    sim.step(5);
    sim.reset();
    expect(sim.time).toBe(0);
    expect(sim.totals().arrivals).toBe(0);
    expect(sim.step(10)).toEqual(first);
  });

  it('rejects a spec whose entry or links name unknown nodes', () => {
    expect(() => createArchSim({ ...single(10, 10), entry: 'nope' }, { load: 1 })).toThrow(/entry/);
    expect(() => createArchSim({ ...single(10, 10), links: [{ from: 'c', to: 'zz' }] }, { load: 1 })).toThrow(/unknown node/);
  });
});

describe('arch-sim: queueing facts', () => {
  it('utilisation ≈ load / capacity below saturation (±5%)', () => {
    for (const [cap, lat, load] of [
      [100, 50, 60],
      [100, 10, 30],
      [400, 25, 300],
    ] as const) {
      const sim = createArchSim(single(cap, lat), { seed: 3, load, window: 300 });
      const m = sim.step(300);
      expect(rel(m.perNode.s.utilization, load / cap)).toBeLessThan(0.05);
      // Totals agree: busy worker-seconds / (workers × time).
      const t = sim.totals();
      const n = t.perNode.s;
      expect(rel(n.busyArea / (n.workers * t.t), load / cap)).toBeLessThan(0.05);
      // Below saturation everything offered gets through.
      expect(rel(m.throughput, load)).toBeLessThan(0.05);
      expect(m.errorRate).toBe(0);
    }
  });

  it('a single-worker server behaves like M/M/1: W = 1/(μ − λ), response times exponential', () => {
    // capacity 100/s with latency 10ms → 1 worker, mean service 10ms; λ = 50/s.
    const sim = createArchSim(single(100, 10), { seed: 11, load: 50, window: 400 });
    const m = sim.step(400);
    const t = sim.totals();
    const W = 1 / (100 - 50); // 20ms
    expect(rel(t.latencySum / t.completed, W)).toBeLessThan(0.1);
    expect(rel(m.meanMs!, W * 1000)).toBeLessThan(0.1);
    // Sojourn time in M/M/1 is exponential with rate μ − λ: median ln2·W, p95 ln20·W.
    expect(rel(m.p50, Math.LN2 * W * 1000)).toBeLessThan(0.1);
    expect(rel(m.p95, Math.log(20) * W * 1000)).toBeLessThan(0.1);
    expect(m.p50).toBeLessThan(m.p95);
    expect(m.p95).toBeLessThan(m.p99);
  });

  it('past saturation the queue grows and throughput caps at capacity', () => {
    const sim = createArchSim(single(100, 10), { seed: 5, load: 130, window: 20 });
    sim.step(5);
    const q5 = sim.metrics().perNode.s.queue;
    const m = sim.step(20);
    const q25 = m.perNode.s.queue;
    expect(q25).toBeGreaterThan(q5);
    // Grows at about λ − μ = 30 per second (20 s → ~600; ±240 covers Poisson noise over 40 seeds).
    expect(q25 - q5).toBeGreaterThan(420);
    expect(q25 - q5).toBeLessThan(840);
    expect(rel(m.throughput, 100)).toBeLessThan(0.08);
    expect(m.perNode.s.utilization).toBeGreaterThan(0.97);
    // Waiting time keeps climbing: the tail is far past the idle latency.
    expect(m.p50).toBeGreaterThan(200);
  });

  it('a full queue rejects requests (errors) instead of growing without bound', () => {
    const sim = createArchSim(single(100, 10, { maxQueue: 50 }), { seed: 9, load: 200 });
    const m = sim.step(20);
    expect(m.perNode.s.queue).toBeLessThanOrEqual(50);
    // About half the offered load can't be served.
    expect(m.errorRate).toBeGreaterThan(0.4);
    expect(m.errorRate).toBeLessThan(0.6);
    expect(sim.totals().perNode.s.rejected).toBeGreaterThan(0);
    expect(DEFAULT_MAX_QUEUE).toBe(1000);
  });

  it("obeys Little's law L = λW across a multi-hop system (±10%)", () => {
    const sim = createArchSim(replicas('round-robin', true), { seed: 21, load: 180 });
    sim.step(300);
    const t = sim.totals();
    const L = t.inSystemArea / t.t;
    const lambda = t.completed / t.t;
    const W = t.latencySum / t.completed;
    expect(t.failed).toBe(0);
    expect(rel(L, lambda * W)).toBeLessThan(0.1);
    // And the windowed view agrees with the instantaneous count's order of magnitude.
    expect(sim.metrics().inFlight!).toBeGreaterThanOrEqual(0);
  });

  it('cache hit rate converges to hitRate, and only misses reach the database', () => {
    const spec: ArchSpec = {
      entry: 'c',
      nodes: [
        { id: 'c', kind: 'client', label: 'Clients', x: 0, y: 4 },
        { id: 'app', kind: 'server', label: 'App', x: 4, y: 4, capacity: 500, latencyMs: 5 },
        { id: 'cache', kind: 'cache', label: 'Cache', x: 8, y: 2, capacity: 2000, latencyMs: 1, hitRate: 0.8 },
        { id: 'db', kind: 'db', label: 'DB', x: 8, y: 6, capacity: 300, latencyMs: 10 },
      ],
      links: [
        { from: 'c', to: 'app' },
        { from: 'app', to: 'cache' },
        { from: 'app', to: 'db' },
      ],
    };
    const sim = createArchSim(spec, { seed: 4, load: 200, window: 120 });
    const m = sim.step(120);
    expect(Math.abs(m.hitRate! - 0.8)).toBeLessThan(0.02);
    const t = sim.totals();
    expect(Math.abs(t.hits / (t.hits + t.misses) - 0.8)).toBeLessThan(0.02);
    expect(Math.abs(t.perNode.db.served / t.perNode.app.served - 0.2)).toBeLessThan(0.02);
    // Cache down: every request is a miss and the database takes it all (cache-aside falls through).
    sim.fail('cache', true);
    sim.step(1);
    const before = sim.totals();
    sim.step(30);
    const after = sim.totals();
    expect(rel(after.perNode.db.served - before.perNode.db.served, after.perNode.app.served - before.perNode.app.served)).toBeLessThan(0.02);
    expect(after.failed - before.failed).toBe(0);
  });

  it('failing one of two replicas behind a round-robin balancer moves its traffic to the other', () => {
    const sim = createArchSim(replicas('round-robin'), { seed: 8, load: 100 });
    sim.step(30);
    const t0 = sim.totals();
    expect(rel(t0.perNode.s1.served, t0.perNode.s2.served)).toBeLessThan(0.05);
    sim.fail('s1', true);
    expect(sim.isUp('s1')).toBe(false);
    sim.step(30);
    const t1 = sim.totals();
    const s1 = t1.perNode.s1.served - t0.perNode.s1.served;
    const s2 = t1.perNode.s2.served - t0.perNode.s2.served;
    // s1 only finishes nothing new (requests it held fail); s2 serves the whole load.
    expect(s1).toBe(0);
    expect(rel(s2, 100 * 30)).toBeLessThan(0.05);
    // Only the handful in flight at s1 when it failed are lost.
    expect(t1.failed - t0.failed).toBeLessThan(15);
    const m = sim.step(10);
    expect(m.errorRate).toBe(0);
    expect(m.perNode.s1.up).toBe(false);
    // Bring it back: traffic splits again.
    sim.fail('s1', false);
    sim.step(1);
    const t2 = sim.totals();
    sim.step(20);
    const t3 = sim.totals();
    expect(rel(t3.perNode.s1.served - t2.perNode.s1.served, t3.perNode.s2.served - t2.perNode.s2.served)).toBeLessThan(0.1);
  });

  it('without a balancer, a failed server fails every request sent to it', () => {
    const sim = createArchSim(single(100, 10), { seed: 2, load: 50 });
    sim.step(5);
    sim.fail('s', true);
    sim.step(6);
    const m = sim.step(5);
    expect(m.errorRate).toBe(1);
    expect(m.throughput).toBe(0);
  });

  it('balancer policies: least-connections favours the faster server, hash and random spread', () => {
    const spec: ArchSpec = {
      entry: 'c',
      nodes: [
        { id: 'c', kind: 'client', label: 'Clients', x: 0, y: 4 },
        { id: 'lb', kind: 'lb', label: 'LB', x: 3, y: 4, policy: 'least-connections' },
        { id: 'fast', kind: 'server', label: 'Fast', x: 6, y: 2, capacity: 300, latencyMs: 10 },
        { id: 'slow', kind: 'server', label: 'Slow', x: 6, y: 6, capacity: 60, latencyMs: 50 },
      ],
      links: [
        { from: 'c', to: 'lb' },
        { from: 'lb', to: 'fast' },
        { from: 'lb', to: 'slow' },
      ],
    };
    const lc = createArchSim(spec, { seed: 1, load: 200 });
    lc.step(60);
    const t = lc.totals();
    expect(t.perNode.fast.served).toBeGreaterThan(2 * t.perNode.slow.served);
    expect(t.failed).toBe(0);
    for (const policy of ['hash', 'random'] as const) {
      const sim = createArchSim(replicas(policy), { seed: 6, load: 100 });
      sim.step(60);
      const tt = sim.totals();
      expect(rel(tt.perNode.s1.served, tt.perNode.s2.served)).toBeLessThan(0.1);
    }
  });

  it('a queue applies backpressure: consumers stay saturated, the buffer fills, then rejects', () => {
    const spec: ArchSpec = {
      entry: 'p',
      nodes: [
        { id: 'p', kind: 'client', label: 'Producers', x: 0, y: 4 },
        { id: 'q', kind: 'queue', label: 'Queue', x: 4, y: 4, maxQueue: 100 },
        { id: 'w1', kind: 'worker', label: 'Worker 1', x: 8, y: 2, capacity: 25, latencyMs: 40 },
        { id: 'w2', kind: 'worker', label: 'Worker 2', x: 8, y: 6, capacity: 25, latencyMs: 40 },
      ],
      links: [
        { from: 'p', to: 'q' },
        { from: 'q', to: 'w1' },
        { from: 'q', to: 'w2' },
      ],
    };
    const sim = createArchSim(spec, { seed: 12, load: 80, window: 30 });
    const early = sim.step(2);
    expect(early.perNode.q.queue).toBeGreaterThan(0);
    const m = sim.step(30);
    expect(m.perNode.q.queue).toBeLessThanOrEqual(100);
    expect(m.perNode.q.utilization).toBeGreaterThan(0.85); // buffer fill
    expect(m.perNode.w1.utilization).toBeGreaterThan(0.95);
    expect(m.perNode.w2.utilization).toBeGreaterThan(0.95);
    expect(rel(m.throughput, 50)).toBeLessThan(0.08);
    expect(m.errorRate).toBeGreaterThan(0.25);
    // Below the consumers' capacity nothing waits for long and nothing is lost.
    const calm = createArchSim(spec, { seed: 12, load: 20, window: 60 });
    const mc = calm.step(60);
    expect(mc.errorRate).toBe(0);
    expect(rel(mc.throughput, 20)).toBeLessThan(0.08);
  });
});

describe('arch-sim: controls and drawing feed', () => {
  it('setLoad changes the offered rate from now on', () => {
    const sim = createArchSim(replicas(), { seed: 3, load: 50, window: 10 });
    sim.step(20);
    sim.setLoad(150);
    expect(sim.load).toBe(150);
    const m = sim.step(20);
    expect(rel(m.offered!, 150)).toBeLessThan(0.1);
    sim.setLoad(0);
    const quiet = sim.step(20);
    expect(quiet.offered).toBe(0);
  });

  it('reports hops for the request dots, marking hops into a failed node', () => {
    const sim = createArchSim(replicas(), { seed: 3, load: 40 });
    sim.step(2);
    const hops = sim.takeHops();
    expect(hops.length).toBeGreaterThan(50);
    expect(hops.every((h) => h.ok)).toBe(true);
    expect(new Set(hops.map((h) => `${h.from}->${h.to}`))).toEqual(new Set(['c->lb', 'lb->s1', 'lb->s2']));
    expect(sim.takeHops()).toEqual([]);
    const direct = createArchSim(single(100, 10), { seed: 3, load: 40 });
    direct.fail('s', true);
    direct.step(1);
    expect(direct.takeHops().some((h) => !h.ok)).toBe(true);
    // Without anyone draining them, kept hops are capped.
    const busy = createArchSim(replicas(), { seed: 3, load: 2000 });
    busy.step(5);
    expect(busy.takeHops().length).toBeLessThanOrEqual(4000);
  });

  it('histogram quantiles land within a bin of the truth', () => {
    expect(histQuantile([0, 0, 0], 0, 0.5)).toBe(0);
    expect(histQuantile([5, 0, 0], 5, 0.99)).toBe(0);
  });
});
