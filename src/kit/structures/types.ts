/**
 * System-design diagram contracts (ArchDiagram + arch-sim). Owned by G5:
 * additive, optional changes only once lessons use them. Pure types, so a
 * sysdesign lesson's problems.ts can describe architectures in Node tests.
 * (Array/Tree/Graph/Table view states live in ../types.ts §8.)
 */

export type ArchNodeKind =
  | 'client'
  | 'dns'
  | 'cdn'
  | 'lb'
  | 'gateway'
  | 'server'
  | 'service'
  | 'cache'
  | 'db'
  | 'replica'
  | 'queue'
  | 'worker'
  | 'storage';

export interface ArchNode {
  id: string;
  kind: ArchNodeKind;
  label: string;
  /** Position on a 12 × 8 layout grid (column, row); the view scales it. */
  x: number;
  y: number;
  /** Requests per second it can serve before queueing. */
  capacity?: number;
  /** Service time per request, ms. */
  latencyMs?: number;
  /** Caches and CDNs: fraction of requests answered without going further (0–1). */
  hitRate?: number;
  /** Load balancers: how they pick the next hop. */
  policy?: 'round-robin' | 'least-connections' | 'random' | 'hash';
  /** Queues: max length before rejecting. */
  maxQueue?: number;
}

export interface ArchLink {
  from: string;
  to: string;
  /** Network latency added on this hop, ms. */
  latencyMs?: number;
  label?: string;
}

export interface ArchSpec {
  nodes: readonly ArchNode[];
  links: readonly ArchLink[];
  /** Where requests enter (usually the client). */
  entry: string;
}

/** What the simulation reports each tick (and the diagram shows as live metrics). */
export interface ArchMetrics {
  /** Simulated seconds elapsed. */
  t: number;
  /** Completed requests per second (recent window). */
  throughput: number;
  /** Fraction of requests that failed or were rejected (recent window). */
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  /** Over all caches, if any. */
  hitRate?: number;
  perNode: Readonly<Record<string, { utilization: number; queue: number; up: boolean; served: number }>>;
  /** Arrivals per second at the entry (recent window). */
  offered?: number;
  /** Mean response time of completed requests, ms (recent window). */
  meanMs?: number;
  /** Requests in the system right now (Little's L, instantaneous). */
  inFlight?: number;
}
