import { signal } from '@preact/signals';
import { describe, expect, it } from 'vitest';
import { createFrameWriter, frameEffect, type FrameScheduler } from './frame';

/** A fake frame clock: callbacks run when `tick()` is called. */
function fakeFrames(): FrameScheduler & { tick(): void; queued(): number } {
  let next = 1;
  const q = new Map<number, () => void>();
  return {
    request(cb) {
      const id = next++;
      q.set(id, cb);
      return id;
    },
    cancel(id) {
      q.delete(id);
    },
    tick() {
      const cbs = [...q.values()];
      q.clear();
      for (const cb of cbs) cb();
    },
    queued: () => q.size,
  };
}

describe('createFrameWriter', () => {
  it('writes only the last value, once per frame', () => {
    const clock = fakeFrames();
    const writes: number[] = [];
    const w = createFrameWriter<number>((v) => writes.push(v), clock);
    w.push(1);
    w.push(2);
    w.push(3);
    expect(writes).toEqual([]);
    expect(clock.queued()).toBe(1);
    clock.tick();
    expect(writes).toEqual([3]);
    clock.tick();
    expect(writes).toEqual([3]);
  });
  it('flush writes the pending value now; cancel drops it', () => {
    const clock = fakeFrames();
    const writes: number[] = [];
    const w = createFrameWriter<number>((v) => writes.push(v), clock);
    w.push(7);
    w.flush();
    expect(writes).toEqual([7]);
    expect(w.pending).toBe(false);
    w.push(8);
    w.cancel();
    clock.tick();
    expect(writes).toEqual([7]);
  });
});

describe('frameEffect', () => {
  it('runs now, then at most once per frame after its signals change', () => {
    const clock = fakeFrames();
    const a = signal(0);
    const seen: number[] = [];
    const stop = frameEffect(() => seen.push(a.value), clock);
    expect(seen).toEqual([0]);
    a.value = 1;
    a.value = 2;
    a.value = 3;
    expect(seen).toEqual([0]);
    clock.tick();
    expect(seen).toEqual([0, 3]);
    // still tracking after the deferred run
    a.value = 4;
    clock.tick();
    expect(seen).toEqual([0, 3, 4]);
    stop();
    a.value = 5;
    clock.tick();
    expect(seen).toEqual([0, 3, 4]);
  });
  it('tracks only what the latest run read', () => {
    const clock = fakeFrames();
    const which = signal<'a' | 'b'>('a');
    const a = signal(1);
    const b = signal(10);
    let runs = 0;
    frameEffect(() => {
      runs++;
      void (which.value === 'a' ? a.value : b.value);
    }, clock);
    which.value = 'b';
    clock.tick();
    expect(runs).toBe(2);
    a.value = 2; // no longer read
    clock.tick();
    expect(runs).toBe(2);
    b.value = 11;
    clock.tick();
    expect(runs).toBe(3);
  });
});
