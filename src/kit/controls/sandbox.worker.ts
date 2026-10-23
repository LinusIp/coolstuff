/**
 * The sandbox Worker (module worker, created by sandbox.ts). It captures
 * `postMessage`, removes the network, storage and messaging globals
 * (SANDBOX_BLOCKED: fetch, XMLHttpRequest, WebSocket, EventSource,
 * importScripts, indexedDB, …, and postMessage itself, so learner code can't
 * fake a result), then answers each request with the same pure functions the
 * lesson tests call. Typed with `workerScope()` instead of the webworker lib.
 */
import { workerScope } from '../util/worker';
import { lockDown, runRequest, SANDBOX_BLOCKED, type WorkerMessage, type WorkerRequest } from './sandbox-core';

const scope = workerScope();
const post = scope.postMessage.bind(scope) as (m: WorkerMessage) => void;
const listen = scope.addEventListener.bind(scope);
lockDown(globalThis, SANDBOX_BLOCKED);

listen('message', (e: MessageEvent) => {
  const req = e.data as WorkerRequest;
  try {
    runRequest(req, post);
  } catch (err) {
    // Only reachable if posting itself failed; report it as a plain error.
    post({ type: 'done', id: req.id, result: { ok: false, logs: [], emits: {}, streams: {}, error: { message: (err as Error)?.message ?? String(err), where: 'code' } } });
  }
});
