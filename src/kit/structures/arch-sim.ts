/**
 * arch-sim: a small discrete-event simulation of a system-design diagram
 * (README §9.5). Pure and deterministic per seed (one seeded random stream,
 * consumed in event order, so the same seed and the same calls give the same
 * numbers, however `step` chunks time). Tested against queueing theory in
 * arch-sim.test.ts: utilisation = load / capacity, M/M/1 response times,
 * queues that grow past saturation, Little's law, cache hit rates, failover.
 *
 * The model, in plain words (also README §9.5):
 * - Requests arrive at `spec.entry` as a Poisson stream of `load` per second.
 * - A node with `capacity` c (req/s) and `latencyMs` s has k = round(c·s)
 *   workers (at least 1), each serving one request at a time with an
 *   exponential service time of mean k / c, so it serves at most c per second
 *   and an idle request takes about s. Requests wait in a FIFO queue of at
 *   most `maxQueue` (default 1000); beyond that they are rejected (errors).
 *   A node with no capacity is a pure delay of `latencyMs` (default 0).
 *   Workers are not held while downstream nodes work (calls are async).
 * - Caches and CDNs (or any node with `hitRate`) answer a fraction `hitRate`
 *   of requests; a miss goes on to the cache's own links, or back to the
 *   caller's next link (cache-aside: a server linked to [cache, db] tries the
 *   cache, then the db). A cache that is down counts as a miss.
 * - Load balancers (kind 'lb', or any node with `policy`) send each request
 *   to one healthy target: round-robin (default), least-connections, random
 *   or hash (by a per-request key). Failed targets are skipped at once.
 * - Any other node tries its links in order until one answers; with no links
 *   (or none left) it answers itself.
 * - A queue node ('queue') is a buffer: it hands a message to one of its
 *   consumers (its links) only when that consumer has a free worker
 *   (backpressure), and rejects when `maxQueue` is full.
 * - A request sent to a failed node fails, unless a balancer skipped it.
 *   Failing a node fails what it holds.
 * - Link `latencyMs` is added once per hop (read it as the hop's round trip).
 *   Response time = from arrival at the entry to the answer.
 */
import { mulberry32 } from '../math/stats';
import type { ArchMetrics, ArchNode, ArchSpec } from './types';

export interface ArchSimOptions {
  seed?: number;
  /** Offered load, requests per second. */
  load: number;
  /** Seconds of history the metrics cover (default 5). */
  window?: number;
  /** A request that bounces through more hops than this fails (guards cyclic diagrams; default 64). */
  maxHops?: number;
}

/** One request crossing one link (what the diagram animates as a dot). */
export interface ArchHop {
  from: string;
  to: string;
  /** Simulated time it left `from`. */
  t: number;
  /** False when `to` is down (the request will fail there). */
  ok: boolean;
}

/** Cumulative counters since the start (or the last reset). */
export interface ArchTotals {
  t: number;
  arrivals: number;
  completed: number;
  failed: number;
  /** Sum of response times of completed requests, seconds. */
  latencySum: number;
  /** ∫ (requests in the system) dt, request·seconds: Little's L × time. */
  inSystemArea: number;
  hits: number;
  misses: number;
  perNode: Record<string, { served: number; busyArea: number; workers: number; capacity: number | null; rejected: number }>;
}

export interface ArchSim {
  /** Advance simulated time by `dt` seconds and report. */
  step(dt: number): ArchMetrics;
  setLoad(rps: number): void;
  fail(id: string, down: boolean): void;
  /** Back to time 0 with empty queues and statistics, re-seeded; load and failures stay. */
  reset(): void;
  /** The current metrics, without advancing time. */
  metrics(): ArchMetrics;
  /** Hops since the last call (for drawing; at most 4000 are kept between calls). */
  takeHops(): ArchHop[];
  totals(): ArchTotals;
  isUp(id: string): boolean;
  readonly time: number;
  readonly load: number;
}

export const DEFAULT_MAX_QUEUE = 1000;
const BUCKET = 0.25; // seconds per metrics bucket
const MAX_HOPS_KEPT = 4000;

// Latency histogram: log-spaced bins from 0.01ms to 1000s, 2% wide.
const LAT_MIN = 0.01;
const RATIO = 1.02;
const LN_RATIO = Math.log(RATIO);
const BINS = Math.ceil(Math.log(1e6 / LAT_MIN) / LN_RATIO) + 2;
const binOf = (ms: number): number => (ms < LAT_MIN ? 0 : Math.min(BINS - 1, 1 + Math.floor(Math.log(ms / LAT_MIN) / LN_RATIO)));
const binValue = (i: number): number => (i === 0 ? 0 : LAT_MIN * Math.pow(RATIO, i - 0.5));

/** The p-quantile (0–1) of a latency histogram, ms (bin centre: ±1%). */
export function histQuantile(hist: ArrayLike<number>, total: number, p: number): number {
  if (total <= 0) return 0;
  const rank = Math.max(1, Math.ceil(p * total));
  let cum = 0;
  for (let i = 0; i < hist.length; i++) {
    cum += hist[i];
    if (cum >= rank) return binValue(i);
  }
  return binValue(hist.length - 1);
}

interface Frame {
  node: number;
  next: number;
}
interface Req {
  id: number;
  t0: number;
  key: number;
  stack: Frame[];
  hops: number;
  /** Consumer index holding a slot for this request (queue dispatch), or −1. */
  reserved: number;
  /** Node epoch when service started (a failure in between fails it). */
  epoch: number;
}

/** Event kinds (plain numbers: cheap to compare, no enum emit). */
const ARRIVE = 0;
const REACH = 1;
const DONE = 2;
type Ev = typeof ARRIVE | typeof REACH | typeof DONE;
interface Event {
  t: number;
  seq: number;
  type: Ev;
  node: number;
  req: Req | null;
  gen: number;
}

interface NodeRt {
  spec: ArchNode;
  out: number[];
  linkLat: number[];
  feeders: number[];
  workers: number;
  mean: number;
  exp: boolean;
  maxQueue: number;
  cacheLike: boolean;
  policy: ArchNode['policy'] | undefined;
  isQueue: boolean;
  up: boolean;
  busy: number;
  reserved: number;
  inflight: number;
  queue: Req[];
  qHead: number;
  rr: number;
  epoch: number;
  served: number;
  rejected: number;
  busyArea: number;
  lastT: number;
}

interface Bucket {
  idx: number;
  arrivals: number;
  completed: number;
  failed: number;
  hits: number;
  misses: number;
  latSum: number;
  area: number;
  hist: Uint32Array;
  busy: Float64Array;
}

/** Binary min-heap on (t, seq): ties keep insertion order, so runs are deterministic. */
class EventHeap {
  private a: Event[] = [];
  get size(): number {
    return this.a.length;
  }
  peek(): Event | undefined {
    return this.a[0];
  }
  push(e: Event): void {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(a[i], a[p])) {
        [a[i], a[p]] = [a[p], a[i]];
        i = p;
      } else break;
    }
  }
  pop(): Event | undefined {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}
const less = (x: Event, y: Event): boolean => x.t < y.t || (x.t === y.t && x.seq < y.seq);

/** Mix a request key into a well-spread 32-bit hash (for the 'hash' policy). */
const mix = (k: number): number => {
  let h = Math.imul(k ^ (k >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
};

export function createArchSim(spec: ArchSpec, opts: ArchSimOptions): ArchSim {
  const seed = opts.seed ?? 1;
  const windowS = Math.max(BUCKET, opts.window ?? 5);
  const maxHops = opts.maxHops ?? 64;
  const K = Math.round(windowS / BUCKET);
  const RING = K + 1;
  const index = new Map(spec.nodes.map((n, i) => [n.id, i]));
  const entry = index.get(spec.entry);
  if (entry === undefined) throw new Error(`arch-sim: entry "${spec.entry}" is not a node id`);
  for (const l of spec.links) {
    if (!index.has(l.from) || !index.has(l.to)) throw new Error(`arch-sim: link ${l.from} → ${l.to} names an unknown node`);
  }

  let load = Math.max(0, opts.load);
  const upState = spec.nodes.map(() => true);

  // ── Mutable state (rebuilt by init) ──
  let rng = mulberry32(seed);
  let t = 0;
  let seq = 0;
  let gen = 0;
  let nextId = 0;
  let heap = new EventHeap();
  let nodes: NodeRt[] = [];
  let ring: Bucket[] = [];
  let inSystem = 0;
  let lastAreaT = 0;
  let hops: ArchHop[] = [];
  const tot = { arrivals: 0, completed: 0, failed: 0, latencySum: 0, area: 0, hits: 0, misses: 0 };

  const makeNode = (n: ArchNode, i: number): NodeRt => {
    const out: number[] = [];
    const linkLat: number[] = [];
    for (const l of spec.links)
      if (l.from === n.id) {
        out.push(index.get(l.to)!);
        linkLat.push(Math.max(0, l.latencyMs ?? 0) / 1000);
      }
    const isQueue = n.kind === 'queue';
    const cap = n.capacity && n.capacity > 0 ? n.capacity : null;
    const lat = Math.max(0, n.latencyMs ?? 0);
    let workers = Infinity;
    let mean = lat / 1000;
    let exp = false;
    if (isQueue) {
      workers = 0;
      mean = 0;
    } else if (cap) {
      workers = Math.max(1, Math.round((cap * lat) / 1000));
      mean = workers / cap;
      exp = true;
    }
    return {
      spec: n,
      out,
      linkLat,
      feeders: [],
      workers,
      mean,
      exp,
      maxQueue: Math.max(0, n.maxQueue ?? DEFAULT_MAX_QUEUE),
      cacheLike: n.kind === 'cache' || n.kind === 'cdn' || n.hitRate !== undefined,
      policy: n.policy ?? (n.kind === 'lb' ? 'round-robin' : undefined),
      isQueue,
      up: upState[i],
      busy: 0,
      reserved: 0,
      inflight: 0,
      queue: [],
      qHead: 0,
      rr: 0,
      epoch: 0,
      served: 0,
      rejected: 0,
      busyArea: 0,
      lastT: 0,
    };
  };

  const newBucket = (idx: number): Bucket => ({
    idx,
    arrivals: 0,
    completed: 0,
    failed: 0,
    hits: 0,
    misses: 0,
    latSum: 0,
    area: 0,
    hist: new Uint32Array(BINS),
    busy: new Float64Array(spec.nodes.length),
  });

  function init(): void {
    rng = mulberry32(seed);
    t = 0;
    seq = 0;
    gen++;
    nextId = 0;
    heap = new EventHeap();
    nodes = spec.nodes.map(makeNode);
    nodes.forEach((n, i) => {
      if (n.isQueue) for (const c of n.out) nodes[c].feeders.push(i);
    });
    ring = Array.from({ length: RING }, (_, i) => newBucket(i - RING));
    inSystem = 0;
    lastAreaT = 0;
    hops = [];
    tot.arrivals = tot.completed = tot.failed = tot.latencySum = tot.area = tot.hits = tot.misses = 0;
    scheduleArrival();
  }

  const bucket = (idx: number): Bucket => {
    const b = ring[((idx % RING) + RING) % RING];
    if (b.idx !== idx) {
      b.idx = idx;
      b.arrivals = b.completed = b.failed = b.hits = b.misses = 0;
      b.latSum = b.area = 0;
      b.hist.fill(0);
      b.busy.fill(0);
    }
    return b;
  };
  const cur = (): Bucket => bucket(Math.floor(t / BUCKET));

  /** Integrate (requests in system) up to time `to`, split across buckets. */
  const accrueArea = (to: number) => {
    while (lastAreaT < to) {
      const b = Math.floor(lastAreaT / BUCKET + 1e-12);
      const end = Math.min(to, (b + 1) * BUCKET);
      const d = end - lastAreaT;
      if (d <= 0) break;
      bucket(b).area += inSystem * d;
      tot.area += inSystem * d;
      lastAreaT = end;
    }
  };
  /** Integrate a node's busy workers up to `to`. */
  const accrueBusy = (n: NodeRt, i: number, to: number) => {
    while (n.lastT < to) {
      const b = Math.floor(n.lastT / BUCKET + 1e-12);
      const end = Math.min(to, (b + 1) * BUCKET);
      const d = end - n.lastT;
      if (d <= 0) break;
      if (n.busy) {
        bucket(b).busy[i] += n.busy * d;
        n.busyArea += n.busy * d;
      }
      n.lastT = end;
    }
  };

  const push = (time: number, type: Ev, node: number, req: Req | null) => heap.push({ t: time, seq: seq++, type, node, req, gen });
  const expSample = (mean: number) => -Math.log(1 - rng()) * mean;

  function scheduleArrival(): void {
    if (load <= 0) return;
    push(t + expSample(1 / load), ARRIVE, entry!, null);
  }

  const qLen = (n: NodeRt) => n.queue.length - n.qHead;
  const qShift = (n: NodeRt): Req | undefined => {
    if (n.qHead >= n.queue.length) return undefined;
    const r = n.queue[n.qHead++];
    if (n.qHead > 256 && n.qHead * 2 > n.queue.length) {
      n.queue = n.queue.slice(n.qHead);
      n.qHead = 0;
    }
    return r;
  };

  function finish(req: Req): void {
    accrueArea(t);
    inSystem--;
    const lat = t - req.t0;
    const b = cur();
    b.completed++;
    b.latSum += lat;
    b.hist[binOf(lat * 1000)]++;
    tot.completed++;
    tot.latencySum += lat;
  }

  function failReq(_req: Req): void {
    accrueArea(t);
    inSystem--;
    cur().failed++;
    tot.failed++;
  }

  /** Send a request along a link. */
  function forward(req: Req, from: number, to: number, linkLat: number): void {
    req.hops++;
    const target = nodes[to];
    if (hops.length < MAX_HOPS_KEPT) hops.push({ from: nodes[from].spec.id, to: target.spec.id, t, ok: target.up });
    if (req.hops > maxHops) return failReq(req);
    target.inflight++;
    push(t + linkLat, REACH, to, req);
  }

  const hasFreeSlot = (n: NodeRt) => n.up && !n.isQueue && n.busy + n.reserved < n.workers && qLen(n) === 0;

  function startService(n: NodeRt, i: number, req: Req): void {
    accrueBusy(n, i, t);
    n.busy++;
    req.epoch = n.epoch;
    const d = n.mean > 0 ? (n.exp ? expSample(n.mean) : n.mean) : 0;
    push(t + d, DONE, i, req);
  }

  /** A request arrives at node i. */
  function reach(i: number, req: Req): void {
    const n = nodes[i];
    if (req.reserved === i) {
      n.reserved--;
      req.reserved = -1;
    }
    if (!n.up) {
      n.inflight--;
      if (n.cacheLike) {
        // A cache that is down is a miss: carry on as if it weren't there.
        cur().misses++;
        tot.misses++;
        return carryOn(req);
      }
      return failReq(req);
    }
    req.stack.push({ node: i, next: 0 });
    if (n.isQueue) {
      const c = freeConsumer(n);
      if (c >= 0) return dispatch(n, i, c, req);
      if (qLen(n) < n.maxQueue) {
        n.queue.push(req);
        return;
      }
      n.inflight--;
      n.rejected++;
      req.stack.pop();
      return failReq(req);
    }
    if (n.busy + n.reserved < n.workers) return startService(n, i, req);
    if (qLen(n) < n.maxQueue) {
      n.queue.push(req);
      return;
    }
    n.inflight--;
    n.rejected++;
    req.stack.pop();
    failReq(req);
  }

  function freeConsumer(q: NodeRt): number {
    const m = q.out.length;
    for (let k = 0; k < m; k++) {
      const j = (q.rr + k) % m;
      if (hasFreeSlot(nodes[q.out[j]])) {
        q.rr = (j + 1) % m;
        return j;
      }
    }
    return -1;
  }

  /** Hand a buffered message to consumer slot j of queue q (reserving its worker). */
  function dispatch(q: NodeRt, qi: number, j: number, req: Req): void {
    const ci = q.out[j];
    q.inflight--;
    nodes[ci].reserved++;
    req.reserved = ci;
    forward(req, qi, ci, q.linkLat[j]);
  }

  /** After a worker frees up at node i: serve its own queue, else pull from queues feeding it. */
  function refill(i: number): void {
    const n = nodes[i];
    while (n.busy + n.reserved < n.workers && qLen(n) > 0) startService(n, i, qShift(n)!);
    for (const qi of n.feeders) {
      const q = nodes[qi];
      if (!q.up) continue;
      while (qLen(q) > 0 && hasFreeSlot(n)) dispatch(q, qi, q.out.indexOf(i), qShift(q)!);
    }
  }

  function done(i: number, req: Req): void {
    const n = nodes[i];
    accrueBusy(n, i, t);
    n.busy--;
    n.inflight--;
    if (req.epoch !== n.epoch) {
      // The node failed while serving this request.
      refill(i);
      return failReq(req);
    }
    n.served++;
    refill(i);
    route(i, req);
  }

  /** Pick a healthy target of a balancer, or −1. */
  function pick(n: NodeRt, req: Req): number {
    const m = n.out.length;
    if (m === 0) return -1;
    const healthy: number[] = [];
    for (let k = 0; k < m; k++) if (nodes[n.out[k]].up) healthy.push(k);
    if (healthy.length === 0) return -1;
    switch (n.policy) {
      case 'random':
        return healthy[Math.floor(rng() * healthy.length)];
      case 'hash':
        return healthy[mix(req.key) % healthy.length];
      case 'least-connections': {
        let best = -1;
        for (let k = 0; k < m; k++) {
          const j = (n.rr + k) % m;
          if (!nodes[n.out[j]].up) continue;
          if (best < 0 || nodes[n.out[j]].inflight < nodes[n.out[best]].inflight) best = j;
        }
        n.rr = (best + 1) % m;
        return best;
      }
      default: {
        for (let k = 0; k < m; k++) {
          const j = (n.rr + k) % m;
          if (nodes[n.out[j]].up) {
            n.rr = (j + 1) % m;
            return j;
          }
        }
        return -1;
      }
    }
  }

  /** Node i has served the request: answer it, or pass it on. */
  function route(i: number, req: Req): void {
    const n = nodes[i];
    if (n.cacheLike) {
      const hit = rng() < (n.spec.hitRate ?? 0);
      const b = cur();
      if (hit) {
        b.hits++;
        tot.hits++;
        return finish(req);
      }
      b.misses++;
      tot.misses++;
      if (n.out.length === 0) {
        req.stack.pop();
        return carryOn(req);
      }
    }
    if (n.policy && !n.isQueue) {
      const j = pick(n, req);
      if (j < 0) return failReq(req);
      const frame = req.stack[req.stack.length - 1];
      frame.next = n.out.length; // a balancer sends once
      return forward(req, i, n.out[j], n.linkLat[j]);
    }
    tryNext(req);
  }

  /** Try the top frame's next link, or answer. */
  function tryNext(req: Req): void {
    const frame = req.stack[req.stack.length - 1];
    if (!frame) return finish(req);
    const n = nodes[frame.node];
    if (n.isQueue || frame.next >= n.out.length) return finish(req);
    const j = frame.next++;
    forward(req, frame.node, n.out[j], n.linkLat[j]);
  }

  /** A downstream node didn't answer (a cache miss with nowhere to go): back to the caller. */
  function carryOn(req: Req): void {
    tryNext(req);
  }

  function handle(e: Event): void {
    switch (e.type) {
      case ARRIVE: {
        if (e.gen !== gen) return;
        accrueArea(t);
        inSystem++;
        tot.arrivals++;
        cur().arrivals++;
        const req: Req = { id: nextId++, t0: t, key: Math.floor(rng() * 65536), stack: [], hops: 0, reserved: -1, epoch: 0 };
        scheduleArrival();
        nodes[entry!].inflight++;
        return reach(entry!, req);
      }
      case REACH:
        return reach(e.node, e.req!);
      case DONE:
        return done(e.node, e.req!);
    }
  }

  function metrics(): ArchMetrics {
    const curIdx = Math.floor(t / BUCKET);
    const start = Math.max(0, (curIdx - K) * BUCKET);
    const dur = t - start;
    let arrivals = 0;
    let completed = 0;
    let failed = 0;
    let hits = 0;
    let misses = 0;
    let latSum = 0;
    const hist = new Uint32Array(BINS);
    const busy = new Float64Array(spec.nodes.length);
    for (let idx = Math.max(0, curIdx - K); idx <= curIdx; idx++) {
      const b = ring[((idx % RING) + RING) % RING];
      if (b.idx !== idx) continue;
      arrivals += b.arrivals;
      completed += b.completed;
      failed += b.failed;
      hits += b.hits;
      misses += b.misses;
      latSum += b.latSum;
      for (let k = 0; k < BINS; k++) if (b.hist[k]) hist[k] += b.hist[k];
      for (let k = 0; k < busy.length; k++) busy[k] += b.busy[k];
    }
    const perNode: Record<string, { utilization: number; queue: number; up: boolean; served: number }> = {};
    nodes.forEach((n, i) => {
      const util = n.isQueue ? (n.maxQueue ? qLen(n) / n.maxQueue : 0) : Number.isFinite(n.workers) && dur > 0 ? busy[i] / (n.workers * dur) : 0;
      perNode[n.spec.id] = { utilization: Math.min(1, util), queue: qLen(n), up: n.up, served: n.served };
    });
    const ended = completed + failed;
    const hasCache = nodes.some((n) => n.cacheLike);
    return {
      t,
      throughput: dur > 0 ? completed / dur : 0,
      errorRate: ended > 0 ? failed / ended : 0,
      p50: histQuantile(hist, completed, 0.5),
      p95: histQuantile(hist, completed, 0.95),
      p99: histQuantile(hist, completed, 0.99),
      hitRate: hasCache && hits + misses > 0 ? hits / (hits + misses) : undefined,
      perNode,
      offered: dur > 0 ? arrivals / dur : 0,
      meanMs: completed > 0 ? (latSum / completed) * 1000 : 0,
      inFlight: inSystem,
    };
  }

  function step(dt: number): ArchMetrics {
    const target = t + Math.max(0, dt);
    for (;;) {
      const e = heap.peek();
      if (!e || e.t > target) break;
      heap.pop();
      t = e.t;
      handle(e);
    }
    t = target;
    accrueArea(t);
    nodes.forEach((n, i) => accrueBusy(n, i, t));
    return metrics();
  }

  init();

  return {
    step,
    metrics,
    setLoad(rps: number) {
      load = Math.max(0, rps);
      gen++;
      scheduleArrival();
    },
    fail(id: string, down: boolean) {
      const i = index.get(id);
      if (i === undefined) return;
      upState[i] = !down;
      const n = nodes[i];
      if (n.up === !down) return;
      n.up = !down;
      if (down) {
        n.epoch++;
        // What it held fails: its queue (or buffer) now; requests in service when they finish.
        let r: Req | undefined;
        while ((r = qShift(n))) {
          n.inflight--;
          failReq(r);
        }
      } else refill(i);
    },
    reset() {
      init();
    },
    takeHops() {
      const h = hops;
      hops = [];
      return h;
    },
    totals(): ArchTotals {
      const perNode: ArchTotals['perNode'] = {};
      nodes.forEach((n) => {
        perNode[n.spec.id] = {
          served: n.served,
          busyArea: n.busyArea,
          workers: n.workers,
          capacity: n.spec.capacity && n.spec.capacity > 0 ? n.spec.capacity : null,
          rejected: n.rejected,
        };
      });
      return { t, arrivals: tot.arrivals, completed: tot.completed, failed: tot.failed, latencySum: tot.latencySum, inSystemArea: tot.area, hits: tot.hits, misses: tot.misses, perNode };
    },
    isUp: (id: string) => {
      const i = index.get(id);
      return i === undefined ? false : nodes[i].up;
    },
    get time() {
      return t;
    },
    get load() {
      return load;
    },
  };
}
