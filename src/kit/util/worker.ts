/**
 * Typed access to a dedicated Worker's global scope without the `webworker`
 * lib (tsconfig.json carries DOM for the page code; adding `webworker` too
 * makes the two lib files clash). Worker modules (G4's sandbox.worker.ts)
 * write:
 *
 *   import { workerScope } from '../util/worker';
 *   const scope = workerScope();
 *   scope.addEventListener('message', (e) => { …; scope.postMessage(result); });
 *
 * Only call it inside a Worker. Node-safe to import.
 */
export interface WorkerScope {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  addEventListener(type: 'error' | 'messageerror', listener: (e: Event) => void): void;
  removeEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  close(): void;
}

/** The current dedicated worker's global scope, typed. */
export function workerScope(): WorkerScope {
  return globalThis as unknown as WorkerScope;
}

/** True inside a dedicated worker (no `document`, has `importScripts`), e.g. to guard worker-only code paths. */
export function inWorker(): boolean {
  return typeof (globalThis as { document?: unknown }).document === 'undefined' && typeof (globalThis as { importScripts?: unknown }).importScripts === 'function';
}
