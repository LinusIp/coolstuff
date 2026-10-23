/**
 * The sandbox's pure half (Node-safe, tested in sandbox.test.ts): what the
 * Worker does with a request, and how it locks its global scope. The Worker
 * file (sandbox.worker.ts) is a three-line wrapper around these, and
 * sandbox.ts is the main-thread side (time limit, worker replacement).
 *
 * Learner code runs through the SAME pure functions lesson tests call
 * (`runSnippet`, `runCodeTests`, core/codecheck.ts), and everything it sends
 * back goes through `sanitizeReport` / `toCloneable`, so a result holding a
 * function or a cyclic object can never throw a DataCloneError.
 */
import { runCodeTests, runSnippet, sanitizeReport, toCloneable, type CodePrelude, type CodeRunReport } from '../core/codecheck';
import type { CodeTest } from '../types';
import { forbiddenSyntax } from './highlight';

/** Streaming option: deliver emits during the run, at most one per name every `throttleMs` (default 50); the last always arrives. */
export type StreamOption = boolean | { throttleMs?: number };

export interface SandboxRequest {
  code: string;
  /** Read-only globals; structured-cloneable plain data only (checked with `cloneIssue` before posting). */
  inputs?: Record<string, unknown>;
  /** Hidden named helpers (functions are sent as their `toString()`). */
  helpers?: CodePrelude['helpers'];
  /** Hidden setup source run first. */
  prelude?: string;
  /** A write-the-code problem: runCodeTests instead of runSnippet. */
  tests?: { entry: string; tests: readonly CodeTest[] };
  /** Default 2000. */
  timeoutMs?: number;
  stream?: StreamOption;
}

export interface SandboxResult {
  ok: boolean;
  logs: string[];
  /** Last value per emitted name. */
  emits: Record<string, unknown>;
  /** Every value per emitted name, in order. */
  streams: Record<string, unknown[]>;
  returned?: unknown;
  error?: { message: string; line?: number; where: 'code' | 'prelude' };
  /** Stopped at the time limit (the worker was terminated and replaced). */
  timedOut?: boolean;
  /** Write-the-code runs: already sanitizeReport'ed (hidden tests show only name and pass/fail). */
  report?: CodeRunReport;
}

/** What the main thread posts (helpers already turned into source strings). */
export interface WorkerRequest extends Omit<SandboxRequest, 'helpers' | 'timeoutMs'> {
  id: number;
  helpers?: Record<string, string>;
}

export type WorkerMessage =
  | { type: 'start'; id: number }
  | { type: 'emit'; id: number; name: string; value: unknown }
  | { type: 'done'; id: number; result: SandboxResult };

export const DEFAULT_THROTTLE_MS = 50;

/** Globals removed from the Worker before anything runs: no network, no storage, no nested workers, no spoofed results. */
export const SANDBOX_BLOCKED: readonly string[] = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebTransport',
  'EventSource',
  'importScripts',
  'indexedDB',
  'caches',
  'BroadcastChannel',
  'Worker',
  'SharedWorker',
  'RTCPeerConnection',
  'postMessage',
  'close',
];

/**
 * Remove `names` from a global object: delete them wherever they live on its
 * prototype chain (WebIDL operations are configurable on the prototypes),
 * then pin an own, non-writable `undefined` so they can't come back. Returns
 * the names it found. Grab anything you still need (postMessage) first.
 */
export function lockDown(global: object, names: readonly string[] = SANDBOX_BLOCKED): string[] {
  const found: string[] = [];
  for (const name of names) {
    let had = false;
    for (let o: object | null = global; o; o = Object.getPrototypeOf(o)) {
      if (Object.prototype.hasOwnProperty.call(o, name)) {
        had = true;
        try {
          delete (o as Record<string, unknown>)[name];
        } catch {
          /* non-configurable: shadowed below */
        }
      }
    }
    try {
      Object.defineProperty(global, name, { value: undefined, writable: false, configurable: false, enumerable: false });
    } catch {
      /* already pinned */
    }
    if (had) found.push(name);
  }
  return found;
}

const throttleOf = (s: StreamOption | undefined): number | null => (!s ? null : typeof s === 'object' && s.throttleMs !== undefined ? Math.max(0, s.throttleMs) : DEFAULT_THROTTLE_MS);

/**
 * Run one request and report through `post`: `start` when the code begins
 * (the main thread starts its clock then), `emit`s while it runs when
 * streaming (throttled per name; any name whose latest value was held back
 * is flushed before `done`), then `done` with a cloneable result.
 */
export function runRequest(req: WorkerRequest, post: (m: WorkerMessage) => void, now: () => number = () => Date.now()): SandboxResult {
  post({ type: 'start', id: req.id });
  const finish = (result: SandboxResult): SandboxResult => {
    post({ type: 'done', id: req.id, result });
    return result;
  };
  const blocked = forbiddenSyntax(req.code);
  if (blocked) return finish({ ok: false, logs: [], emits: {}, streams: {}, error: { message: blocked, where: 'code' } });

  if (req.tests) {
    const report = sanitizeReport(runCodeTests(req.code, req.tests, { helpers: req.helpers, prelude: req.prelude }));
    return finish({ ok: report.ok, logs: report.logs, emits: {}, streams: {}, report, ...(report.compileError ? { error: { message: report.compileError, where: 'code' as const } } : {}) });
  }

  const throttle = throttleOf(req.stream);
  const lastPost = new Map<string, number>();
  const pending = new Map<string, unknown>();
  const onEmit =
    throttle === null
      ? undefined
      : (name: string, value: unknown) => {
          const t = now();
          const last = lastPost.get(name);
          if (last === undefined || t - last >= throttle) {
            lastPost.set(name, t);
            pending.delete(name);
            post({ type: 'emit', id: req.id, name, value });
          } else pending.set(name, value);
        };
  const r = runSnippet(req.code, { inputs: req.inputs, helpers: req.helpers, prelude: req.prelude, onEmit });
  for (const [name, value] of pending) post({ type: 'emit', id: req.id, name, value });
  return finish({
    ok: r.ok,
    logs: r.logs,
    emits: r.emits,
    streams: r.streams,
    ...(r.returned !== undefined ? { returned: toCloneable(r.returned) } : {}),
    ...(r.error ? { error: r.error } : {}),
  });
}

/** Helpers as source strings (functions can't be posted to a Worker; codecheck accepts either form). */
export function helperSources(helpers: CodePrelude['helpers'] | undefined): Record<string, string> | undefined {
  if (!helpers) return undefined;
  return Object.fromEntries(Object.entries(helpers).map(([k, h]) => [k, typeof h === 'function' ? h.toString() : h]));
}

/** "Stopped after 2 s" / "Stopped after 0.5 s". */
export function timeoutMessage(ms: number): string {
  const s = ms / 1000;
  return `Stopped after ${Number.isInteger(s) ? s : s.toFixed(1)} s: the code was still running. Is there a loop that never ends?`;
}
