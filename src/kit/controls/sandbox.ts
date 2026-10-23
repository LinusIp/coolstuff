/**
 * `runSandboxed`: run learner code in a module Worker with a time limit
 * (README §7.7). The Worker removes the network and storage globals, runs
 * the same pure functions lesson tests use (runSnippet / runCodeTests),
 * streams emits when asked, and is terminated and replaced on timeout, so an
 * infinite loop costs one worker, never the page.
 *
 *   const r = await runSandboxed({ code, inputs: { A: [2, 1, 1, 2] }, timeoutMs: 2000 }, { onEmit: (n, v) => … });
 *
 * Each run gets a fresh worker (no globals leak from one run into the next);
 * the next one is started while the current one runs, so there is no start-up
 * wait. Nothing touches `Worker` until the first call (barrels load in Node).
 */
import { cloneIssue } from '../core/codecheck';
import { helperSources, timeoutMessage, type SandboxRequest, type SandboxResult, type WorkerMessage, type WorkerRequest } from './sandbox-core';

export type { SandboxRequest, SandboxResult, StreamOption } from './sandbox-core';

export interface SandboxOptions {
  /** Each emit as it arrives (streaming runs only). */
  onEmit?: (name: string, value: unknown) => void;
  /** Abort: terminates the worker and resolves with "Stopped." */
  signal?: AbortSignal;
}

/** The part of a Worker the runner uses (a fake in tests). */
export interface WorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

/** Extra time allowed for a cold worker to load before the code's own clock starts. */
const LOAD_GRACE_MS = 8000;

const empty = (error: SandboxResult['error'], extra: Partial<SandboxResult> = {}): SandboxResult => ({ ok: false, logs: [], emits: {}, streams: {}, error, ...extra });

/** Build a runner around a worker factory (the page uses the real module Worker; tests pass fakes). */
export function createSandbox(makeWorker: () => WorkerLike) {
  let spare: WorkerLike | null = null;
  let nextId = 1;
  const take = (): WorkerLike => {
    const w = spare ?? makeWorker();
    spare = null;
    return w;
  };
  const warm = () => {
    if (!spare) {
      try {
        spare = makeWorker();
      } catch {
        spare = null;
      }
    }
  };

  return function run(req: SandboxRequest, opts: SandboxOptions = {}): Promise<SandboxResult> {
    const issue = req.inputs ? cloneIssue(req.inputs, 'inputs') : null;
    if (issue) return Promise.resolve(empty({ message: issue, where: 'code' }));
    if (opts.signal?.aborted) return Promise.resolve(empty({ message: 'Stopped.', where: 'code' }));
    const timeoutMs = req.timeoutMs ?? 2000;
    const id = nextId++;
    let worker: WorkerLike;
    try {
      worker = take();
    } catch (err) {
      return Promise.resolve(empty({ message: `The sandbox couldn’t start (${(err as Error).message}).`, where: 'code' }));
    }
    const message: WorkerRequest = {
      id,
      code: req.code,
      inputs: req.inputs,
      helpers: helperSources(req.helpers),
      prelude: req.prelude,
      tests: req.tests,
      stream: req.stream,
    };
    return new Promise<SandboxResult>((resolve) => {
      let settled = false;
      let clock: ReturnType<typeof setTimeout> | undefined;
      const settle = (r: SandboxResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(clock);
        opts.signal?.removeEventListener('abort', onAbort);
        worker.onmessage = null;
        worker.onerror = null;
        worker.terminate(); // one run per worker: nothing leaks into the next run
        resolve(r);
      };
      const stop = (ms: number) => settle(empty({ message: timeoutMessage(ms), where: 'code' }, { timedOut: true }));
      const onAbort = () => settle(empty({ message: 'Stopped.', where: 'code' }));
      opts.signal?.addEventListener('abort', onAbort);
      worker.onmessage = (e) => {
        const m = e.data as WorkerMessage;
        if (!m || m.id !== id) return;
        if (m.type === 'start') {
          clearTimeout(clock);
          clock = setTimeout(() => stop(timeoutMs), timeoutMs);
        } else if (m.type === 'emit') {
          if (!settled) opts.onEmit?.(m.name, m.value);
        } else if (m.type === 'done') settle(m.result);
      };
      worker.onerror = (e) => {
        const msg = (e as { message?: string })?.message;
        settle(empty({ message: `The sandbox failed to run${msg ? `: ${msg}` : '.'}`, where: 'code' }));
      };
      clock = setTimeout(() => stop(timeoutMs), timeoutMs + LOAD_GRACE_MS);
      worker.postMessage(message);
      warm();
    });
  };
}

let shared: ReturnType<typeof createSandbox> | null = null;

/** Run code in the sandbox Worker (README §7.7). Browser only. */
export function runSandboxed(req: SandboxRequest, opts?: SandboxOptions): Promise<SandboxResult> {
  shared ??= createSandbox(() => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike);
  return shared(req, opts);
}
