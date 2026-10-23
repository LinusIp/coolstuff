import { describe, expect, it, vi } from 'vitest';
import { createSandbox, type WorkerLike } from './sandbox';
import { helperSources, lockDown, runRequest, SANDBOX_BLOCKED, timeoutMessage, type WorkerMessage, type WorkerRequest } from './sandbox-core';

const collect = () => {
  const msgs: WorkerMessage[] = [];
  return { msgs, post: (m: WorkerMessage) => msgs.push(m) };
};

describe('runRequest (what the Worker does)', () => {
  it('runs a snippet: logs, last emits, every streamed value, start then done', () => {
    const { msgs, post } = collect();
    const r = runRequest({ id: 7, code: 'for (let k = 0; k < 3; k++) emit("k", k * w);\nconsole.log("done", w);', inputs: { w: 2 } }, post);
    expect(r.ok).toBe(true);
    expect(r.logs).toEqual(['done 2']);
    expect(r.emits).toEqual({ k: 4 });
    expect(r.streams).toEqual({ k: [0, 2, 4] });
    expect(msgs[0]).toEqual({ type: 'start', id: 7 });
    expect(msgs.at(-1)).toMatchObject({ type: 'done', id: 7 });
    expect(msgs.filter((m) => m.type === 'emit')).toHaveLength(0); // not streaming
  });

  it('reports errors with lines relative to the visible code, and prelude errors as such', () => {
    const { post } = collect();
    const r = runRequest({ id: 1, code: 'const a = 1;\nnope();', prelude: 'const hidden = 2;' }, post);
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ where: 'code', line: 2 });
    const p = runRequest({ id: 2, code: 'emit("x", 1);', prelude: 'throw new Error("bad setup");' }, post);
    expect(p.error).toMatchObject({ where: 'prelude', message: 'bad setup' });
  });

  it('streams emits throttled per name, and always delivers the last one', () => {
    const { msgs, post } = collect();
    let t = 0;
    const now = () => t;
    // Each emit advances the fake clock by 10ms; throttle 50ms → roughly one in five gets through.
    runRequest({ id: 3, code: 'for (let k = 1; k <= 20; k++) { tick(); emit("a", k); emit("b", -k); }', helpers: { tick: '() => 0' }, stream: { throttleMs: 50 } }, post, () => {
      t += 10;
      return now();
    });
    const a = msgs.filter((m): m is Extract<WorkerMessage, { type: 'emit' }> => m.type === 'emit' && m.name === 'a').map((m) => m.value);
    const b = msgs.filter((m): m is Extract<WorkerMessage, { type: 'emit' }> => m.type === 'emit' && m.name === 'b').map((m) => m.value);
    expect(a.length).toBeGreaterThan(2);
    expect(a.length).toBeLessThan(20);
    expect(a.at(-1)).toBe(20);
    expect(b.at(-1)).toBe(-20); // per-name throttle: b is never starved by a
    const doneAt = msgs.findIndex((m) => m.type === 'done');
    expect(msgs.slice(doneAt + 1)).toHaveLength(0); // flushes come before done
  });

  it('streaming with throttle 0 delivers every emit', () => {
    const { msgs, post } = collect();
    runRequest({ id: 4, code: 'for (let k = 0; k < 5; k++) emit("k", k);', stream: { throttleMs: 0 } }, post);
    expect(msgs.filter((m) => m.type === 'emit').map((m) => (m as { value: unknown }).value)).toEqual([0, 1, 2, 3, 4]);
  });

  it('runs write-the-code tests and sanitises the report (hidden tests keep only name and pass/fail)', () => {
    const { post } = collect();
    const r = runRequest(
      {
        id: 5,
        code: 'function double(x) { return 2 * x; }',
        tests: { entry: 'double', tests: [{ args: [2], expect: 4 }, { args: [5], expect: 10, hidden: true, name: 'secret' }] },
      },
      post,
    );
    expect(r.ok).toBe(true);
    expect(r.report?.passed).toBe(2);
    expect(r.report?.results[1]).toEqual({ name: 'secret', ok: true, hidden: true });
  });

  it('a test that returns a function, or a snippet that returns a cyclic value, still posts', () => {
    const { post } = collect();
    const r = runRequest({ id: 6, code: 'function f() { return () => 1; }', tests: { entry: 'f', tests: [{ args: [], expect: 1 }] } }, post);
    expect(() => structuredClone(r)).not.toThrow();
    expect(r.report?.results[0].got).toBe('a function');
    const s = runRequest({ id: 7, code: 'const o = { a: 1 }; o.self = o; o.f = () => 1; return o;' }, post);
    expect(() => structuredClone(s)).not.toThrow();
    expect(typeof s.returned).toBe('string');
  });

  it('refuses import() before running anything', () => {
    const { post } = collect();
    const r = runRequest({ id: 8, code: 'const m = await import("https://example.com/x.js");' }, post);
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/import isn’t available/);
    expect(runRequest({ id: 9, code: '// import("x") in a comment is fine\nconst s = "import(y)"; emit("s", s);' }, post).ok).toBe(true);
  });
});

describe('lockDown', () => {
  it('removes globals from the object and its prototype chain, and pins them', () => {
    class Proto {
      fetch() {
        return 'network!';
      }
    }
    const g = Object.create(Proto.prototype) as Record<string, unknown>;
    g.importScripts = () => 'loaded';
    g.keep = 1;
    const found = lockDown(g, ['fetch', 'importScripts', 'indexedDB']);
    expect(found.sort()).toEqual(['fetch', 'importScripts']);
    expect(g.fetch).toBeUndefined();
    expect(g.importScripts).toBeUndefined();
    expect(g.indexedDB).toBeUndefined();
    expect(Proto.prototype.fetch).toBeUndefined();
    expect(g.keep).toBe(1);
    expect(() => {
      'use strict';
      g.fetch = () => 'back';
    }).toThrow();
  });

  it('blocks the network, storage and messaging names the README lists', () => {
    for (const n of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'indexedDB', 'postMessage']) expect(SANDBOX_BLOCKED).toContain(n);
  });
});

/** A fake Worker that runs requests with runRequest, asynchronously, like the real one. */
function fakeWorker(opts: { hang?: boolean; fail?: boolean } = {}) {
  const w: WorkerLike & { terminated: boolean } = {
    terminated: false,
    onmessage: null,
    onerror: null,
    postMessage(message: unknown) {
      setTimeout(() => {
        if (w.terminated) return;
        if (opts.fail) return w.onerror?.({ message: 'boom' });
        const req = message as WorkerRequest;
        if (opts.hang) return w.onmessage?.({ data: { type: 'start', id: req.id } });
        runRequest(req, (m) => setTimeout(() => !w.terminated && w.onmessage?.({ data: m }), 0));
      }, 0);
    },
    terminate() {
      w.terminated = true;
    },
  };
  return w;
}

describe('createSandbox (the main-thread runner)', () => {
  it('runs code, streams emits to onEmit, and uses a fresh worker per run', async () => {
    const made: ReturnType<typeof fakeWorker>[] = [];
    const run = createSandbox(() => {
      const w = fakeWorker();
      made.push(w);
      return w;
    });
    const seen: unknown[] = [];
    const r = await run({ code: 'for (let k = 0; k < 3; k++) emit("k", k);', stream: { throttleMs: 0 } }, { onEmit: (_, v) => seen.push(v) });
    expect(r.ok).toBe(true);
    expect(seen).toEqual([0, 1, 2]);
    expect(made[0].terminated).toBe(true);
    expect(made).toHaveLength(2); // the spare for the next run is already warm
    const r2 = await run({ code: 'emit("x", 1);' });
    expect(r2.emits).toEqual({ x: 1 });
    expect(made[1].terminated).toBe(true);
  });

  it('stops an infinite loop at the time limit and the next run still works', async () => {
    vi.useFakeTimers();
    try {
      let n = 0;
      const run = createSandbox(() => fakeWorker({ hang: n++ === 0 }));
      const p = run({ code: 'while (true) {}', timeoutMs: 300 });
      await vi.advanceTimersByTimeAsync(10);
      await vi.advanceTimersByTimeAsync(300);
      const r = await p;
      expect(r.timedOut).toBe(true);
      expect(r.error?.message).toBe(timeoutMessage(300));
      const next = run({ code: 'emit("ok", true);' });
      await vi.advanceTimersByTimeAsync(10);
      expect((await next).emits).toEqual({ ok: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuses non-cloneable inputs with cloneIssue’s message, without starting a worker', async () => {
    const make = vi.fn(() => fakeWorker());
    const run = createSandbox(make);
    const r = await run({ code: 'emit("x", f(1));', inputs: { f: (x: number) => x } as Record<string, unknown> });
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/inputs\.f is a function/);
    expect(make).not.toHaveBeenCalled();
  });

  it('abort terminates the run', async () => {
    const run = createSandbox(() => fakeWorker({ hang: true }));
    const ctl = new AbortController();
    const p = run({ code: 'while (true) {}' }, { signal: ctl.signal });
    ctl.abort();
    expect((await p).error?.message).toBe('Stopped.');
  });

  it('a worker error resolves with a message instead of hanging', async () => {
    const run = createSandbox(() => fakeWorker({ fail: true }));
    const r = await run({ code: '1' });
    expect(r.ok).toBe(false);
    expect(r.error?.message).toMatch(/boom/);
  });
});

describe('small helpers', () => {
  it('helpers become source strings', () => {
    expect(helperSources({ sq: (x: number) => x * x, id: '(x) => x' })).toEqual({ sq: expect.stringMatching(/x \* x/), id: '(x) => x' });
    expect(helperSources(undefined)).toBeUndefined();
  });
  it('timeout messages read in seconds', () => {
    expect(timeoutMessage(2000)).toMatch(/^Stopped after 2 s/);
    expect(timeoutMessage(500)).toMatch(/^Stopped after 0\.5 s/);
  });
});
